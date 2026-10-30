"""Limits how many memory-heavy Earth Engine operations run at once in this process."""

import threading
from functools import wraps

from django.conf import settings
from ipywidgets import Widget

analysis_slot = threading.BoundedSemaphore(settings.ANALYSIS_CONCURRENCY)
_map_widgets_lock = threading.Lock()


def limit_to_analysis_slot(func):
    """Wait for a free slot before running func, so it can't add to a running analysis's memory."""
    @wraps(func)
    def wrapper(*args, **kwargs):
        with analysis_slot:
            return func(*args, **kwargs)
    return wrapper


def isolate_map_widgets(func):
    """Close func's map widgets when it returns, and never let two maps build at once.

    ipywidgets keeps every widget in one global registry, and a map's HTML export includes
    the whole registry. Without this, each map contains every map made since the last restart.
    """
    @wraps(func)
    def wrapper(*args, **kwargs):
        with _map_widgets_lock:
            try:
                return func(*args, **kwargs)
            finally:
                Widget.close_all()
    return wrapper
