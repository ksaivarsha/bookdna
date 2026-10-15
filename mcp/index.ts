import { MCPServer } from "mcp-use";
import { z } from "zod";
import { SHELVES, extractProfile, hasApiKey, shelfCandidates, tropeCandidates, type ClaudeResult, type Profile, type ShelfKey } from "./src/claude.js";
import { callerOf, claudeGate, resultCache, LIMITS } from "./src/guard.js";
import { booksBySubjects, findBook, specificSubjects, validateShelf, type Book, type Candidate, type ShelfBook } from "./src/openlibrary.js";

const SHELF_SIZE = 6;
// Claude over-asks so books Open Library can't verify still leave a full shelf.
const CANDIDATES = 8;

const server = new MCPServer({
  name: "bookdna",
  title: "BookDNA",
  version: "1.0.0",
  description: "Book DNA (tropes, world, subgenre, tone) and verified reading recommendations, backed by Open Library.",
  instructions:
    "Use search_book to identify a book, get_book_dna to break it into tropes, setting, subgenre, tone and storyline, " +
    "recommend for one shelf of books like a given book, and recommend_by_tropes when the reader names tropes rather than a book. " +
    "Every recommended book has been verified to exist on Open Library.",
  websiteUrl: "https://openlibrary.org",
  icons: [{ src: "icon.svg", mimeType: "image/svg+xml", sizes: ["512x512"] }],
});

// ── Shared schemas and helpers ────────────────────────────────────────────

const ShelfBookSchema = z.object({
  id: z.string().describe("Open Library work key"),
  title: z.string(),
  author: z.string(),
  cover: z.string().describe("Cover image URL, empty if Open Library has none"),
  reason: z.string().describe("Why this book fits"),
  url: z.string().describe("Open Library page for the book"),
});

const SourceSchema = z
  .enum(["ai", "cache", "open_library_only"])
  .describe("ai: fresh Claude analysis; cache: a repeat of an earlier result; open_library_only: AI budget spent, Open Library data only");

const ShelfOutputSchema = z.object({
  heading: z.string().describe("Shelf title, e.g. 'Similar Tropes'"),
  subheading: z.string().describe("What the shelf is based on"),
  books: z.array(ShelfBookSchema),
  source: SourceSchema,
  notice: z.string().optional().describe("Message for the reader, e.g. that the AI budget is spent"),
});
type ShelfOutput = z.infer<typeof ShelfOutputSchema>;

const fail = (text: string) => ({ isError: true as const, content: [{ type: "text" as const, text }] });

const NOT_FOUND = (q: string) => fail(`Open Library has no book matching "${q}". Try the exact title, or add the author's name.`);
const UNREACHABLE = fail("Open Library isn't responding right now, so BookDNA can't look books up. Please try again in a minute.");
const NO_KEY = "BookDNA's AI features aren't configured on this server, so these results come from Open Library alone.";

/** Runs a handler, turning anything unexpected into a friendly tool error. */
type Ctx = Parameters<typeof callerOf>[0];

function safe<A, R>(name: string, fn: (args: A, caller: string) => Promise<R>) {
  return async (args: A, ctx: Ctx) => {
    try {
      return await fn(args, callerOf(ctx));
    } catch (e) {
      console.error(`${name} crashed: ${(e as Error)?.name ?? "Error"}`);
      return fail("Something went wrong inside BookDNA. Please try again.");
    }
  };
}

async function lookup(query: string): Promise<{ book: Book } | { error: ReturnType<typeof fail> }> {
  const found = await findBook(query);
  if (found.ok) return { book: found.book };
  return { error: found.reason === "not_found" ? NOT_FOUND(query) : UNREACHABLE };
}

const byline = (b: Book) => `${b.title}${b.authors.length ? ` by ${b.authors.join(", ")}` : ""}`;

function shelfResult(out: ShelfOutput) {
  const lines = out.books.map((b, i) => `${i + 1}. ${b.title} by ${b.author}: ${b.reason}`);
  const text = [
    `${out.heading} (${out.subheading})`,
    ...(out.notice ? [out.notice] : []),
    ...(lines.length ? lines : ["No books could be verified on Open Library for this shelf."]),
  ].join("\n");
  return { content: [{ type: "text" as const, text }], structuredContent: out };
}

type Gated<T> = { ok: true; value: T } | { ok: false; fallback: string } | { ok: false; error: ReturnType<typeof fail> };

/**
 * One Claude call behind the cost guard. A spent daily budget or a missing
 * key asks the caller for its Open Library fallback; rate limits and API
 * failures become friendly errors.
 */
async function guarded<T>(caller: string, call: () => Promise<ClaudeResult<T>>): Promise<Gated<T>> {
  if (!hasApiKey()) return { ok: false, fallback: NO_KEY };
  const gate = claudeGate(caller);
  if (!gate.ok) return gate.kind === "daily" ? { ok: false, fallback: gate.message } : { ok: false, error: fail(gate.message) };
  const r = await call();
  return r.ok ? r : { ok: false, error: fail(r.message) };
}

/** Validates Claude's candidates and builds a shelf, or an Open Library fallback. */
async function buildShelf(
  caller: string,
  cacheKey: string,
  heading: string,
  subheading: string,
  candidates: () => Promise<ClaudeResult<Candidate[]>>,
  fallbackSubjects: string[],
  exclude: string[] = [],
) {
  const cached = resultCache.get(cacheKey) as ShelfBook[] | undefined;
  if (cached) return shelfResult({ heading, subheading, books: cached, source: "cache" });

  const r = await guarded(caller, candidates);
  if (!r.ok && "error" in r) return r.error;
  if (!r.ok) {
    const books = await booksBySubjects(fallbackSubjects, SHELF_SIZE, exclude);
    if (books === null) return UNREACHABLE;
    return shelfResult({ heading, subheading, books, source: "open_library_only", notice: r.fallback });
  }

  const { books, suggested, passed } = await validateShelf(r.value, SHELF_SIZE, exclude);
  console.log(`validation shelf=${cacheKey.split(":")[0]} passed=${passed} of=${suggested}`);
  if (books.length) resultCache.set(cacheKey, books);
  return shelfResult({ heading, subheading, books, source: "ai" });
}

// ── Tools ────────────────────────────────────────────────────────────────

const BookSchema = z.object({
  id: z.string().describe("Open Library work key"),
  title: z.string(),
  authors: z.array(z.string()),
  year: z.number().nullable().describe("First publication year"),
  cover: z.string().describe("Cover image URL, empty if none"),
  description: z.string().describe("Open Library description, may be empty"),
  url: z.string().describe("Open Library page"),
});

const queryParam = z
  .string()
  .min(1)
  .max(200)
  .describe(
    "The book to look up by its title. Add the author's name when several books share the title, " +
      'e.g. "A Court of Thorns and Roses" or "Piranesi Susanna Clarke"',
  );

const toBookOut = (b: Book) => ({
  id: b.id,
  title: b.title,
  authors: b.authors,
  year: b.year,
  cover: b.cover,
  description: b.description,
  url: `https://openlibrary.org${b.id}`,
});

export const searchBook = server.tool(
  {
    name: "search_book",
    title: "Search for a book",
    description:
      "Find the single best Open Library match for a book and return its title, authors, " +
      "first publication year, cover URL and description. Use this to identify or confirm a book; it does not analyse " +
      "or recommend. Does not use AI, so it is never rate limited.",
    inputSchema: z.object({ query: queryParam }),
    outputSchema: z.object({ book: BookSchema }),
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
  },
  safe("search_book", async ({ query }: { query: string }) => {
    const r = await lookup(query);
    if ("error" in r) return r.error;
    const book = toBookOut(r.book);
    const text = `${byline(r.book)}${book.year ? ` (${book.year})` : ""}\n${book.description || "No description on Open Library."}\nCover: ${book.cover || "none"}`;
    return { content: [{ type: "text" as const, text }], structuredContent: { book } };
  }),
);

export const getBookDna = server.tool(
  {
    name: "get_book_dna",
    title: "Get a book's DNA",
    description:
      "Break a book down into its DNA: 3 to 6 tropes, world/setting, subgenre, emotional tone and a spoiler-free storyline " +
      "summary. Use this when someone asks what a book is like, what tropes it has, or what makes it tick. " +
      "Uses AI (rate limited); repeat requests are cached. If the daily AI budget is spent, returns Open Library " +
      "details and subjects only, with dna set to null.",
    inputSchema: z.object({ query: queryParam }),
    outputSchema: z.object({
      book: BookSchema,
      dna: z
        .object({
          tropes: z.array(z.string()),
          world_setting: z.string(),
          subgenre: z.string(),
          tone: z.string(),
          storyline_summary: z.string(),
        })
        .nullable()
        .describe("Null when only Open Library data is available"),
      subjects: z.array(z.string()).describe("Open Library subjects for the book"),
      source: SourceSchema,
      notice: z.string().optional(),
    }),
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
  },
  safe("get_book_dna", async ({ query }: { query: string }, caller) => {
    const r = await lookup(query);
    if ("error" in r) return r.error;
    const book = r.book;
    const key = `dna:${book.id}`;

    let dna = resultCache.get(key) as Profile | undefined;
    let source: "ai" | "cache" | "open_library_only" = "cache";
    let notice: string | undefined;
    if (!dna) {
      const g = await guarded(caller, () => extractProfile(book));
      if (!g.ok && "error" in g) return g.error;
      if (g.ok) {
        dna = g.value;
        source = "ai";
        resultCache.set(key, dna);
      } else {
        source = "open_library_only";
        notice = g.fallback;
      }
    }

    const text = dna
      ? [
          `DNA of ${byline(book)}`,
          `Tropes: ${dna.tropes.join(", ")}`,
          `World/setting: ${dna.world_setting}`,
          `Subgenre: ${dna.subgenre}`,
          `Tone: ${dna.tone}`,
          `Storyline: ${dna.storyline_summary}`,
        ].join("\n")
      : `${notice}\n${byline(book)}\nOpen Library subjects: ${specificSubjects(book.subjects, 10).join(", ") || "none listed"}`;
    return {
      content: [{ type: "text" as const, text }],
      structuredContent: { book: toBookOut(book), dna: dna ?? null, subjects: book.subjects, source, ...(notice ? { notice } : {}) },
    };
  }),
);

// Each view binds to exactly one tool, so the two shelf tools get a view
// each; both render the shared Shelf component.
const shelfView = (name: "book-shelf" | "trope-shelf") => ({
  name,
  description: "A shelf of book covers with titles, authors and the reason each was chosen",
  prefersBorder: false,
  // ChatGPT requires one dedicated origin shared by every view in the app.
  domain: "https://calm-wave-h30fs.run.mcp-use.com",
  csp: {
    resourceDomains: [
      "https://covers.openlibrary.org",
      // Older covers redirect to archive.org, then to a storage node such as
      // ia800703.us.archive.org.
      "https://archive.org",
      "https://*.archive.org",
      "https://fonts.googleapis.com",
      "https://fonts.gstatic.com",
    ],
  },
});

export const recommend = server.tool(
  {
    name: "recommend",
    title: "Recommend similar books",
    description:
      "Recommend up to 6 books similar to a given book along one kind of similarity, chosen with shelf. " +
      "Use this when the reader names a book they liked. Every book is verified on Open Library, and unverifiable ones are dropped. " +
      "Shows a shelf of covers. Uses AI (rate limited); repeats are cached. If the daily AI budget is spent, returns books " +
      "sharing Open Library subjects instead.",
    inputSchema: z.object({
      query: queryParam.describe(
        "The book the reader liked, by its title; the shelf is built from books similar to it. " +
          "Add the author's name when several books share the title.",
      ),
      shelf: z
        .enum(["storyline", "tropes", "world", "vibe"])
        .describe(
          "The kind of similarity to recommend by: storyline means a similar plot, tropes means shared tropes, " +
            "world means a similar setting and subgenre, and vibe means the same emotional tone",
        ),
    }),
    outputSchema: ShelfOutputSchema,
    view: shelfView("book-shelf"),
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    _meta: { "openai/toolInvocation/invoking": "Finding similar books…", "openai/toolInvocation/invoked": "Found similar books" },
  },
  safe("recommend", async ({ query, shelf }: { query: string; shelf: ShelfKey }, caller) => {
    const r = await lookup(query);
    if ("error" in r) return r.error;
    const book = r.book;
    // Ground the prompt in the book's DNA when get_book_dna already produced it.
    const profile = (resultCache.get(`dna:${book.id}`) as Profile | undefined) ?? null;
    return buildShelf(
      caller,
      `${shelf}:${book.id}`,
      SHELVES[shelf].label,
      `For readers of ${byline(book)}`,
      () => shelfCandidates(book, profile, shelf, CANDIDATES),
      book.subjects,
      [book.id],
    );
  }),
);

const normTropes = (ts: string[]) => [...new Set(ts.map((t) => t.trim().toLowerCase()).filter(Boolean))];

export const recommendByTropes = server.tool(
  {
    name: "recommend_by_tropes",
    title: "Recommend books by tropes",
    description:
      "Recommend up to 6 books built on the given tropes, in the given kind of world when a setting is named, e.g. tropes " +
      "[\"enemies to lovers\"] with setting \"fae court\". Use this when the reader describes what they want rather than " +
      "naming a book (use recommend for 'books like X'). Every book is verified on Open Library, and unverifiable ones are dropped. " +
      "Shows a shelf of covers. Uses AI (rate limited); repeats are cached. If the daily AI budget is spent, returns " +
      "books whose Open Library subjects match the tropes instead.",
    inputSchema: z.object({
      tropes: z
        .array(z.string().min(1).max(60))
        .min(1)
        .max(6)
        .describe(
          'Trope names the reader wants, e.g. ["enemies to lovers", "forced proximity"]. ' +
            "Books that combine several of them are preferred.",
        ),
      setting: z
        .string()
        .max(80)
        .optional()
        .describe(
          'World or setting the books should take place in, e.g. "fae court", "Victorian London", "space station". ' +
            "Leave it out to recommend on tropes alone.",
        ),
    }),
    outputSchema: ShelfOutputSchema,
    view: shelfView("trope-shelf"),
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    _meta: { "openai/toolInvocation/invoking": "Finding books by trope…", "openai/toolInvocation/invoked": "Found books by trope" },
  },
  safe("recommend_by_tropes", async ({ tropes, setting }: { tropes: string[]; setting?: string }, caller) => {
    const ts = normTropes(tropes);
    if (!ts.length) return fail("Please name at least one trope, e.g. \"enemies to lovers\".");
    const place = setting?.trim();
    return buildShelf(
      caller,
      `tropes:${[...ts].sort().join("|")}:${place?.toLowerCase() ?? ""}`,
      "Books by Trope",
      `${ts.join(" · ")}${place ? ` in ${place}` : ""}`,
      () => tropeCandidates(ts, place, CANDIDATES),
      place ? [...ts, place] : ts,
    );
  }),
);

console.log(`BookDNA guard: ${LIMITS.perMinute}/min, ${LIMITS.perCallerPerMinute}/min per caller, ${LIMITS.dailyCap}/day`);

export default server;
