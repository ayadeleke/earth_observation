"""Limits how many memory-heavy Earth Engine operations run at once in this process."""

import threading
from functools import wraps

from django.conf import settings

analysis_slot = threading.BoundedSemaphore(settings.ANALYSIS_CONCURRENCY)


def limit_to_analysis_slot(func):
    """Wait for a free slot before running func, so it can't add to a running analysis's memory."""
    @wraps(func)
    def wrapper(*args, **kwargs):
        with analysis_slot:
            return func(*args, **kwargs)
    return wrapper
