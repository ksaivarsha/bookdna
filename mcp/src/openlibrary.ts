// Open Library access, ported from backend/app/services/ol.py and the
// candidate validation in backend/app/routes/recommendations.py.
// Every lookup is cached in memory and retried once; failures return null
// (unreachable) rather than throwing, so tools can explain what happened.

import { TTLCache } from "./guard.js";

const BASE = "https://openlibrary.org";
const TIMEOUT_MS = 8000;
// Validation lookups are many and small; a short timeout keeps one slow
// response from holding up a whole shelf.
const VALIDATE_TIMEOUT_MS = 4000;
const RETRY_DELAY_MS = 400;
const HEADERS = { "User-Agent": "BookDNA-MCP/1.0 (https://github.com/ksaivarsha/bookdna)" };

export type Book = {
  id: string; // Open Library work key, e.g. "/works/OL123W"
  title: string;
  authors: string[];
  year: number | null;
  cover: string;
  description: string;
  subjects: string[];
};

export type Candidate = { title: string; author: string; reason: string };

export type ShelfBook = {
  id: string;
  title: string;
  author: string;
  cover: string;
  reason: string;
  url: string;
};

type Doc = {
  key?: string;
  title?: string;
  author_name?: string[];
  first_publish_year?: number;
  cover_i?: number;
  subject?: string[];
};

const cache = new TTLCache<unknown>(2000, 24 * 60 * 60 * 1000);

async function getJson(path: string, params: Record<string, string>, timeoutMs: number): Promise<unknown | null> {
  const url = `${BASE}${path}?${new URLSearchParams(params)}`;
  const hit = cache.get(url);
  if (hit !== undefined) return hit;

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const r = await fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(timeoutMs) });
      if (r.status === 404) return null;
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const data = await r.json();
      cache.set(url, data);
      return data;
    } catch (e) {
      console.warn(`Open Library attempt ${attempt + 1} failed: ${(e as Error).name}`);
      if (attempt === 0) await new Promise((res) => setTimeout(res, RETRY_DELAY_MS));
    }
  }
  return null;
}

/** OL docs for a search, [] if nothing matched, null if OL is unreachable. */
async function search(params: Record<string, string>, timeoutMs = TIMEOUT_MS): Promise<Doc[] | null> {
  const data = (await getJson("/search.json", params, timeoutMs)) as { docs?: Doc[] } | null;
  return data ? data.docs ?? [] : null;
}

export const coverUrl = (coverId?: number, size: "M" | "L" = "M") =>
  coverId ? `https://covers.openlibrary.org/b/id/${coverId}-${size}.jpg` : "";

const workUrl = (key: string) => (key ? `https://openlibrary.org${key}` : "");

function cleanDescription(text: string): string {
  return text
    .split("----------")[0]
    .replace(/^\s*\[\d+\]:\s*\S+.*$/gm, "")
    .replace(/\[([^\]]+)\]\((?:[^)]+)\)|\[([^\]]+)\]\[\d+\]/g, (_, a, b) => a ?? b)
    .replace(/\(\s*source:?\s*[^)]*\)\s*$/i, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

async function workDescription(key: string): Promise<string> {
  if (!key.startsWith("/works/")) return "";
  const work = (await getJson(`${key}.json`, {}, TIMEOUT_MS)) as { description?: string | { value?: string } } | null;
  const desc = work?.description;
  const text = typeof desc === "string" ? desc : desc?.value ?? "";
  return cleanDescription(text);
}

export type FindResult = { ok: true; book: Book } | { ok: false; reason: "not_found" | "unreachable" };

/** Best Open Library match for a free-text query (title, or title plus author). */
export async function findBook(query: string): Promise<FindResult> {
  const docs = await search({
    q: query,
    limit: "1",
    fields: "key,title,author_name,first_publish_year,cover_i,subject",
  });
  if (docs === null) return { ok: false, reason: "unreachable" };
  const doc = docs[0];
  if (!doc?.key) return { ok: false, reason: "not_found" };
  return {
    ok: true,
    book: {
      id: doc.key,
      title: doc.title ?? query,
      authors: doc.author_name ?? [],
      year: doc.first_publish_year ?? null,
      cover: coverUrl(doc.cover_i, "L"),
      description: await workDescription(doc.key),
      subjects: (doc.subject ?? []).slice(0, 12),
    },
  };
}

const normalize = (s: string) =>
  s.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, "").trim();

/**
 * Look a suggested book up on Open Library. Returns null unless at least half
 * of the suggested title's words (longer than two letters) appear in the
 * matched title, the same rule as the app.
 */
async function validateCandidate(c: Candidate): Promise<ShelfBook | null> {
  const docs = await search(
    { title: c.title, author: c.author, limit: "1", fields: "key,title,author_name,cover_i" },
    VALIDATE_TIMEOUT_MS,
  );
  const doc = docs?.[0];
  if (!doc?.key) return null;
  const olTitle = normalize(doc.title ?? "");
  const words = normalize(c.title).split(/\s+/).filter((w) => w.length > 2);
  if (!words.length) return null;
  if (words.filter((w) => olTitle.includes(w)).length / words.length < 0.5) return null;
  return {
    id: doc.key,
    title: doc.title ?? c.title,
    author: doc.author_name?.[0] ?? c.author,
    cover: coverUrl(doc.cover_i),
    reason: c.reason,
    url: workUrl(doc.key),
  };
}

/**
 * Validate every candidate in parallel, keep only books Open Library knows,
 * drop duplicates and excluded work IDs, and cut to `limit`.
 */
export async function validateShelf(candidates: Candidate[], limit: number, exclude: string[] = []) {
  const results = await Promise.all(candidates.map(validateCandidate));
  const seen = new Set(exclude);
  const books: ShelfBook[] = [];
  for (const b of results) {
    if (b && !seen.has(b.id)) {
      seen.add(b.id);
      books.push(b);
    }
  }
  return { books: books.slice(0, limit), suggested: candidates.length, passed: books.length };
}

/**
 * Open Library-only fallback used when the AI budget is spent: books sharing
 * any of the given subjects, most popular first. Null if OL is unreachable.
 */
export async function booksBySubjects(subjects: string[], limit: number, exclude: string[] = []): Promise<ShelfBook[] | null> {
  const terms = subjects.map((s) => s.trim()).filter(Boolean).slice(0, 4);
  if (!terms.length) return [];
  const q = terms.map((s) => `subject:"${s.replace(/"/g, "")}"`).join(" OR ");
  const docs = await search({ q, limit: String(limit + exclude.length + 4), fields: "key,title,author_name,cover_i,subject" });
  if (docs === null) return null;
  const seen = new Set(exclude);
  const books: ShelfBook[] = [];
  for (const d of docs) {
    if (!d.key || seen.has(d.key)) continue;
    seen.add(d.key);
    const lower = (d.subject ?? []).map((s) => s.toLowerCase());
    const shared = terms.find((t) => lower.includes(t.toLowerCase())) ?? terms[0];
    books.push({
      id: d.key,
      title: d.title ?? "Untitled",
      author: d.author_name?.[0] ?? "Unknown",
      cover: coverUrl(d.cover_i),
      reason: `Shares the Open Library subject "${shared}".`,
      url: workUrl(d.key),
    });
    if (books.length >= limit) break;
  }
  return books;
}
