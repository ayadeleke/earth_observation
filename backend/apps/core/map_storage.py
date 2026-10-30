"""
Keeps generated map pages in a private Supabase Storage bucket.

Render's disk is wiped on every restart and deploy, so a map left on disk disappears.
Pages are read back through serve_generated_map, which sets the headers that let the
frontend embed them.
"""

import logging
import os

import requests
from django.conf import settings

logger = logging.getLogger(__name__)

REQUEST_TIMEOUT_SECONDS = 30


def is_configured():
    return bool(settings.SUPABASE_URL and settings.SUPABASE_SERVICE_KEY)


def _object_url(filename):
    return f"{settings.SUPABASE_URL}/storage/v1/object/{settings.SUPABASE_MAPS_BUCKET}/{filename}"


def _headers():
    return {
        "apikey": settings.SUPABASE_SERVICE_KEY,
        "Authorization": f"Bearer {settings.SUPABASE_SERVICE_KEY}",
    }


def publish_map(filename, path):
    """Upload a map file and remove the local copy. Keeps the local copy if the upload fails."""
    if not is_configured():
        return False
    try:
        with open(path, "rb") as f:
            response = requests.post(
                _object_url(filename),
                data=f,
                headers={**_headers(), "Content-Type": "text/html; charset=utf-8", "x-upsert": "true"},
                timeout=REQUEST_TIMEOUT_SECONDS,
            )
        response.raise_for_status()
    except (OSError, requests.RequestException) as e:
        logger.error(f"Could not upload map {filename} to Supabase Storage: {e}")
        return False
    os.remove(path)
    return True


def fetch_map(filename):
    """Return a stored map's bytes, or None if it is missing or storage is unavailable."""
    if not is_configured():
        return None
    try:
        response = requests.get(_object_url(filename), headers=_headers(), timeout=REQUEST_TIMEOUT_SECONDS)
    except requests.RequestException as e:
        logger.error(f"Could not read map {filename} from Supabase Storage: {e}")
        return None
    return response.content if response.status_code == 200 else None
