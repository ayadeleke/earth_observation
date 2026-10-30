"""
Test settings for the Earth Observation backend.
Optimized for running tests quickly and safely.
"""

import os
import tempfile

# settings.py refuses the insecure default key when DEBUG is off, so provide one first
os.environ.setdefault(
    "SECRET_KEY",
    os.environ.get("DJANGO_SECRET_KEY", "django-insecure-test-key-only-for-testing-purposes"),
)

from .settings import *  # noqa: E402

# Use in-memory SQLite database for faster tests
DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.sqlite3",
        "NAME": ":memory:",
    }
}


# Disable migrations for faster test runs
class DisableMigrations:
    def __contains__(self, item):
        return True

    def __getitem__(self, item):
        return None


MIGRATION_MODULES = DisableMigrations()

# Use faster password hasher for tests
PASSWORD_HASHERS = [
    "django.contrib.auth.hashers.MD5PasswordHasher",
]

# Disable logging during tests
LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "handlers": {
        "null": {
            "class": "logging.NullHandler",
        },
    },
    "root": {
        "handlers": ["null"],
    },
}

# Disable caching during tests
CACHES = {
    "default": {
        "BACKEND": "django.core.cache.backends.dummy.DummyCache",
    }
}
SESSION_ENGINE = "django.contrib.sessions.backends.db"

# Don't create media files during tests
MEDIA_ROOT = tempfile.mkdtemp(prefix="test_media_")

# Use dummy email backend
EMAIL_BACKEND = "django.core.mail.backends.dummy.EmailBackend"

# Test-specific settings
DEBUG = False
SECRET_KEY = os.environ.get(
    "DJANGO_SECRET_KEY", "django-insecure-test-key-only-for-testing-purposes"
)

# Disable CSRF for API tests
CSRF_COOKIE_SECURE = False
SESSION_COOKIE_SECURE = False

# Ensure test database creation
TEST_DATABASE_PREFIX = "test_"
