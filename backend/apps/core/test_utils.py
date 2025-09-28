"""
Test utilities for secure test data creation.
"""

import os
import secrets
import string
from django.contrib.auth import get_user_model

User = get_user_model()


def generate_test_password():
    """Generate a secure random password for testing."""
    # Use environment variable if available, otherwise generate random
    if os.environ.get("TEST_PASSWORD"):
        return os.environ.get("TEST_PASSWORD")

    # Generate a secure random password for tests
    alphabet = string.ascii_letters + string.digits + "!@#$%^&*"
    password = "".join(secrets.choice(alphabet) for _ in range(12))
    return password


def create_test_user(email="test@example.com", username="testuser", **kwargs):
    """Create a test user with secure password."""
    password = kwargs.pop("password", generate_test_password())
    return User.objects.create_user(
        email=email, username=username, password=password, **kwargs
    )
