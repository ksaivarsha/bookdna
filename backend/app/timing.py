"""Stage timing for the search pipeline, logged as `timing stage=<name> ms=<n>`."""

import logging
import time
from contextlib import contextmanager

logger = logging.getLogger("app.timing")


@contextmanager
def stage(name: str):
    start = time.perf_counter()
    try:
        yield
    finally:
        logger.info("timing stage=%s ms=%.0f", name, (time.perf_counter() - start) * 1000)
