// Claude prompts, ported from backend/app/services/dna.py.
// The API key is read from the environment only. Errors are logged by class
// name alone, never with messages or request details, so the key can't leak.

import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod/v4";
import type { Book, Candidate } from "./openlibrary.js";

const MODEL = "claude-haiku-5-5";

export const ProfileSchema = z.object({
  tropes: z.array(z.string()),
  world_setting: z.string(),
  subgenre: z.string(),
  tone: z.string(),
  storyline_summary: z.string(),
});
export type Profile = z.infer<typeof ProfileSchema>;

const CandidatesSchema = z.object({
  books: z.array(z.object({ title: z.string(), author: z.string(), reason: z.string() })),
});

export const SHELVES = {
  storyline: { label: "Similar Storyline", guide: "books whose storyline resembles this one's" },
  tropes: { label: "Similar Tropes", guide: "books sharing its tropes" },
  world: { label: "Similar World/Setting", guide: "books with a similar world/setting and subgenre" },
  vibe: { label: "Same Vibe", guide: "books matching its tone" },
} as const;
export type ShelfKey = keyof typeof SHELVES;

export type ClaudeResult<T> = { ok: true; value: T } | { ok: false; message: string };

let client: Anthropic | null = null;
let warnedNoKey = false;

export function hasApiKey(): boolean {
  const ok = Boolean(process.env.ANTHROPIC_API_KEY?.trim());
  if (!ok && !warnedNoKey) {
    console.warn("ANTHROPIC_API_KEY is not set; AI features are disabled");
    warnedNoKey = true;
  }
  return ok;
}

function getClient(): Anthropic {
  client ??= new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY!.trim(), maxRetries: 1, timeout: 60_000 });
  return client;
}

function friendly(e: unknown): string {
  if (e instanceof Anthropic.AuthenticationError) return "BookDNA's AI service isn't configured correctly right now.";
  if (e instanceof Anthropic.RateLimitError) return "BookDNA's AI service is busy. Please try again in a minute.";
  if (e instanceof Anthropic.APIConnectionError) return "BookDNA couldn't reach its AI service. Please try again shortly.";
  return "BookDNA's AI analysis failed for this request. Please try again.";
}

async function ask<S extends z.ZodType>(step: string, prompt: string, schema: S, maxTokens: number): Promise<ClaudeResult<z.infer<S>>> {
  try {
    const message = await getClient().messages.parse({
      model: MODEL,
      max_tokens: maxTokens,
      messages: [{ role: "user", content: prompt }],
      output_config: { format: zodOutputFormat(schema) },
      // Thinking off, as in the app: matched thinking-on quality in testing at
      // under half the latency.
      thinking: { type: "disabled" },
    });
    console.log(`usage step=${step} in=${message.usage.input_tokens} out=${message.usage.output_tokens}`);
    if (message.stop_reason !== "end_turn") console.warn(`${step}: stop_reason=${message.stop_reason}`);
    if (!message.parsed_output) return { ok: false, message: "BookDNA's AI returned an unreadable answer. Please try again." };
    return { ok: true, value: message.parsed_output as z.infer<S> };
  } catch (e) {
    console.error(`${step} failed: ${(e as Error)?.constructor?.name ?? "Error"}`);
    return { ok: false, message: friendly(e) };
  }
}

function bookHeader(book: Book, descriptionChars: number): string {
  return [
    `Book: "${book.title}" by ${book.authors.join(", ") || "Unknown"}`,
    `Published: ${book.year ?? ""}`,
    `Genres: ${book.subjects.join(", ")}`,
    `Description: ${book.description.slice(0, descriptionChars)}`,
  ].join("\n");
}

function profileBlock(p: Profile | null): string {
  if (!p) return "";
  return `
Book DNA:
Tropes: ${p.tropes.join(", ")}
World/setting: ${p.world_setting}
Subgenre: ${p.subgenre}
Tone: ${p.tone}
Storyline: ${p.storyline_summary}
`;
}

/** Structured DNA profile of a book. */
export async function extractProfile(book: Book): Promise<ClaudeResult<Profile>> {
  const prompt = `You are a literary expert. Describe the DNA of the book below.

${bookHeader(book, 2000)}

- tropes: 3 to 6 short, widely used trope names (e.g. "enemies to lovers", "chosen one", "found family"), lowercase.
- world_setting: the world or setting in a short phrase (e.g. "Victorian London", "fae courts", "near-future Mars colony").
- subgenre: the single most fitting subgenre (e.g. "romantasy", "cozy mystery", "space opera").
- tone: two or three words for the emotional tone (e.g. "dark and lush", "witty, warm").
- storyline_summary: one or two sentences summarizing the core storyline without spoilers.

Use your own knowledge of the book if the description is thin.`;

  const r = await ask("profile_extraction", prompt, ProfileSchema, 2000);
  if (r.ok) r.value.tropes = r.value.tropes.map((t) => t.trim().toLowerCase()).filter(Boolean);
  return r;
}

/** Candidate books for one shelf, grounded in the DNA profile when known. */
export async function shelfCandidates(book: Book, profile: Profile | null, shelf: ShelfKey, count: number): Promise<ClaudeResult<Candidate[]>> {
  const others = (Object.keys(SHELVES) as ShelfKey[]).filter((k) => k !== shelf);
  const prompt = `You are a literary expert. Given the book below, recommend real existing books
in exactly one category. Only recommend books you are highly confident actually exist,
and never "${book.title}" itself.

${bookHeader(book, 400)}
${profileBlock(profile)}
${profile ? "Use the Book DNA to drive the category:" : "Base the category on the book above:"}
- ${SHELVES[shelf].label}: ${SHELVES[shelf].guide}.

Other shelves, written separately, cover: ${others.map((k) => `${SHELVES[k].label} (${SHELVES[k].guide})`).join("; ")}.
Choose books whose strongest connection to this book is this category's theme,
and avoid the obvious read-alikes that would fit every shelf.

Provide exactly ${count} real books in "books", each with the exact title, the author's full name,
and a one-line reason (under 15 words) explaining why a fan of "${book.title}" would enjoy it.`;

  const r = await ask(`shelf_${shelf}`, prompt, CandidatesSchema, 4000);
  return r.ok ? { ok: true, value: r.value.books } : r;
}

/** Candidate books built on the given tropes, optionally in a given setting. */
export async function tropeCandidates(tropes: string[], setting: string | undefined, count: number): Promise<ClaudeResult<Candidate[]>> {
  const prompt = `You are a literary expert building a shelf for a reader who wants these tropes:
${tropes.map((t) => `- ${t}`).join("\n")}
${setting ? `\nThe books should be set in or around: ${setting}.\n` : ""}
Recommend real existing books that are clearly built on these tropes${setting ? " in that kind of world" : ""}.
Only recommend books you are highly confident actually exist. Prefer books that combine
several of the tropes, and order the list best match first.

Provide exactly ${count} real books in "books", each with the exact title, the author's full name,
and a one-line reason (under 15 words) naming which of the tropes${setting ? " and setting" : ""} it delivers.`;

  const r = await ask("trope_shelf", prompt, CandidatesSchema, 4000);
  return r.ok ? { ok: true, value: r.value.books } : r;
}
