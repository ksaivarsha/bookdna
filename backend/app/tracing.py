"""
OpenTelemetry spans for the search pipeline (exported to SigNoz when the app is
started with `opentelemetry-instrument`; without it every call here is a no-op).

Spans carry counts, flags and token usage only. Prompts, completions, book
descriptions and API keys are never set as attributes, and errors record the
exception type name only, matching the logging rule in services/dna.py.
"""

from contextlib import contextmanager

from opentelemetry import trace
from opentelemetry.trace import Status, StatusCode

tracer = trace.get_tracer("bookdna")


def mark_error(exc: BaseException, span: trace.Span | None = None) -> None:
    (span or trace.get_current_span()).set_status(
        Status(StatusCode.ERROR, type(exc).__name__)
    )


@contextmanager
def span(name: str, **attributes):
    """
    Start a child span of the current one. Exception messages are not recorded
    (they can quote API responses); an escaping exception marks the span as an
    error with its type name.
    """
    with tracer.start_as_current_span(
        name,
        attributes=attributes,
        record_exception=False,
        set_status_on_exception=False,
    ) as s:
        try:
            yield s
        except Exception as e:
            mark_error(e, s)
            raise
