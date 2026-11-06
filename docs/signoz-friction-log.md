# SigNoz setup friction log

What was confusing or surprising while adding SigNoz Cloud tracing to the
BookDNA backend (FastAPI 0.115, Python 3.13, OpenTelemetry SDK 1.45 / 0.66b2).
Each entry has what happened and what we did about it.

## Docs

1. **No guidance on `.env` files.** None of the SigNoz Python/FastAPI pages
   mention `.env` or python-dotenv; they only show `export`, `$env:`, Docker
   `ENV` and Kubernetes manifests. `opentelemetry-instrument` reads `OTEL_*`
   variables when the interpreter starts, before the app's `load_dotenv()`, so
   putting the ingestion key in `backend/.env` silently does nothing.
   *Fix:* start with `dotenv run -- opentelemetry-instrument uvicorn ...`
   (python-dotenv's CLI loads `.env` before the wrapper starts).

2. **Inconsistent Python minimums.** The FastAPI page says 3.8+, the Python
   guide 3.9+ (tested only on 3.11 / SDK 1.27), the native-FastAPI page 3.10+.
   Nothing says whether 3.13 works. *Result:* it does, with SDK 1.45.

3. **`--reload` is forbidden, but it's the usual FastAPI dev command** (and is
   in our README). The docs say it breaks instrumentation but don't suggest a
   dev workflow. *Fix:* tracing is opt-in via a separate command; plain
   `uvicorn --reload` still works, just without traces.

4. **"Manual instrumentation" page assumes setup is already done.** It shows
   `start_as_current_span` and attributes but no Cloud exporter config; the
   only in-code `TracerProvider`/`OTLPSpanExporter` example is in the Celery
   section of the general Python page.

5. **FastAPI-native OTel is easy to get wrong.** It needs FastAPI 0.143+ (the
   page also mentions 0.142), and without `FASTAPI_OTEL_AUTO_CONFIGURE=true` it
   sends nothing and prints no warning. Not used here (we're on 0.115).

6. **No LLM guidance.** The Python docs don't mention Anthropic/LLM calls.
   Third-party LLM instrumentations (e.g. OpenLLMetry) record prompts and
   completions by default, which we must not send. *Fix:* hand-written spans
   with token counts only.

## Tooling

7. **`opentelemetry-bootstrap --action=install` installs a lot.** On this app it
   wanted ~20 instrumentations (asyncio, threading, sqlite3, grpc, wsgi,
   tortoiseorm, click, ...), listed `httpx` twice, and installs unpinned
   versions into whatever Python is active. *Fix:* ran `--action=requirements`
   to see the list and pinned only `fastapi` and `httpx`.

8. **Unclear whether Claude calls get HTTP spans.** anthropic 1.12 depends on
   `httpx2` (a fork of httpx), and we expected the httpx instrumentation to
   miss it. The console run showed it doesn't: each Claude call gets a `POST`
   span with only `http.method`, `http.url` (`https://api.anthropic.com/v1/messages`)
   and `http.status_code`. No headers, so the API key isn't exported. These
   spans carry no token counts, so the `claude.*` spans are still hand-written.
   For streamed calls the `POST` span is a sibling of `claude.recommendations`,
   not its child, because that span can't be made current inside a generator.

9. **`dotenv run` overrides the shell by default** (`--override` is the
   default). If `.env` sets `OTEL_TRACES_EXPORTER=otlp`, then
   `$env:OTEL_TRACES_EXPORTER="console"` for the docs' troubleshooting step is
   silently ignored. *Fix:* `.env` leaves `OTEL_TRACES_EXPORTER` unset (`otlp`
   is the default).
