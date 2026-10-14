// Cost protection for the tools that call Claude: an in-memory result cache,
// a sliding-window rate limit (global and per MCP session), and a daily cap.
// State lives in this process, so it resets on restart and is not shared
// between instances; the Anthropic console spend limit is the hard backstop.

import { AsyncLocalStorage } from "node:async_hooks";

function intEnv(name: string, fallback: number): number {
  const n = Number.parseInt(process.env[name] ?? "", 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

export const LIMITS = {
  perMinute: intEnv("CLAUDE_CALLS_PER_MINUTE", 10),
  perSessionPerMinute: intEnv("CLAUDE_CALLS_PER_SESSION_PER_MINUTE", 3),
  dailyCap: intEnv("CLAUDE_DAILY_CAP", 100),
};

/** Map-backed LRU with a time-to-live per entry. */
export class TTLCache<V> {
  private map = new Map<string, { value: V; expires: number }>();
  constructor(private maxEntries: number, private ttlMs: number) {}

  get(key: string): V | undefined {
    const hit = this.map.get(key);
    if (!hit) return undefined;
    if (hit.expires < Date.now()) {
      this.map.delete(key);
      return undefined;
    }
    this.map.delete(key); // re-insert to mark as recently used
    this.map.set(key, hit);
    return hit.value;
  }

  set(key: string, value: V): void {
    this.map.delete(key);
    this.map.set(key, { value, expires: Date.now() + this.ttlMs });
    while (this.map.size > this.maxEntries) {
      this.map.delete(this.map.keys().next().value!);
    }
  }
}

/** Claude-backed results, keyed by tool and normalised input. */
export const resultCache = new TTLCache<unknown>(500, 24 * 60 * 60 * 1000);

const WINDOW_MS = 60_000;
const globalCalls: number[] = [];
const sessionCalls = new Map<string, number[]>();
let day = "";
let dailyCount = 0;

const today = () => new Date().toISOString().slice(0, 10); // UTC date

function prune(calls: number[], now: number) {
  while (calls.length && calls[0] <= now - WINDOW_MS) calls.shift();
}

// The MCP session ID is only visible to middleware, so index.ts runs each
// tool call inside this store and the guard reads it from here.
export const sessionStore = new AsyncLocalStorage<string>();

export type Gate =
  | { ok: true }
  | { ok: false; kind: "rate"; retryAfterSeconds: number; message: string }
  | { ok: false; kind: "daily"; message: string };

/**
 * Ask permission for one Claude call. On success the call is counted against
 * every limit, so only call this right before actually calling Claude.
 */
export function claudeGate(): Gate {
  const now = Date.now();
  if (day !== today()) {
    day = today();
    dailyCount = 0;
  }
  if (dailyCount >= LIMITS.dailyCap) {
    return {
      ok: false,
      kind: "daily",
      message:
        "Today's AI budget for BookDNA is spent, so these results come from Open Library alone. AI analysis resets at midnight UTC.",
    };
  }

  const session = sessionStore.getStore() ?? "anonymous";
  const mine = sessionCalls.get(session) ?? [];
  prune(globalCalls, now);
  prune(mine, now);

  const blocking =
    mine.length >= LIMITS.perSessionPerMinute ? mine[0] :
    globalCalls.length >= LIMITS.perMinute ? globalCalls[0] : null;
  if (blocking !== null) {
    const retryAfterSeconds = Math.max(1, Math.ceil((blocking + WINDOW_MS - now) / 1000));
    return {
      ok: false,
      kind: "rate",
      retryAfterSeconds,
      message: `BookDNA is pacing its AI calls. Please try again in about ${retryAfterSeconds} seconds. Repeat requests are served from cache and don't count.`,
    };
  }

  globalCalls.push(now);
  mine.push(now);
  sessionCalls.set(session, mine);
  dailyCount++;
  if (sessionCalls.size > 5000) {
    for (const [id, calls] of sessionCalls) {
      prune(calls, now);
      if (!calls.length) sessionCalls.delete(id);
    }
  }
  return { ok: true };
}

export function usage() {
  return { today: day === today() ? dailyCount : 0, dailyCap: LIMITS.dailyCap };
}
