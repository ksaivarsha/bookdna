# BookDNA MCP server

A standalone [mcp-use](https://docs.mcp-use.com) v2 server that brings BookDNA to any MCP client. It does its own Open Library lookups and Claude calls, using the prompts from `backend/app/services/dna.py` and the validation from `backend/app/routes/recommendations.py`.

## Tools

| Tool | What it does | Uses Claude |
|---|---|---|
| `search_book(query)` | Best Open Library match: title, authors, year, cover, description | No |
| `get_book_dna(query)` | Tropes, world setting, subgenre, tone, storyline summary | Yes |
| `recommend(query, shelf)` | Up to 6 books like a book, for one shelf: `storyline`, `tropes`, `world` or `vibe`. Renders the `book-shelf` widget | Yes |
| `recommend_by_tropes(tropes, setting?)` | Up to 6 books built on the given tropes, optionally in a setting. Renders the `trope-shelf` widget | Yes |

Every recommended book is looked up on Open Library and dropped unless at least half of its title words match, the same rule the app uses. Claude is asked for 8 candidates per shelf so the shelf stays full after drops.

## Cost protection

All guard state lives in memory (see `src/guard.ts`):

- **Cache.** Claude-backed results are kept for 24 hours, keyed by tool and normalised input. Repeat requests skip Claude and the limits.
- **Rate limit.** 10 Claude calls a minute overall and 3 a minute per caller. Callers are identified by client IP (the first `X-Forwarded-For` hop, which the Manufact edge writes itself), because mcp-use v2 serves MCP statelessly and has no session ID. Over the limit, tools return a friendly "try again in N seconds".
- **Daily cap.** 100 Claude calls a day (UTC). Once it is reached, `get_book_dna` returns Open Library details only, and the recommend tools return books that share Open Library subjects, each with a notice.

The state resets when the server restarts and is not shared between instances. Set a spend limit in the Anthropic console as the hard backstop.

## Environment

Copy `.env.example` to `.env` (gitignored) and set `ANTHROPIC_API_KEY`. The key is only read from the environment and is never logged. Errors are logged by class name only. Optional overrides: `CLAUDE_CALLS_PER_MINUTE`, `CLAUDE_CALLS_PER_CALLER_PER_MINUTE` and `CLAUDE_DAILY_CAP`.

## Run

```bash
npm install
npm run dev        # MCP at http://localhost:3000/mcp, Inspector at /mcp/inspector
npm run typecheck
npm run build
```
