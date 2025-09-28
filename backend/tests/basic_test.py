"""
Basic tests to verify the testing setup works.
"""
from django.test import TestCase
from django.contrib.auth import get_user_model

User = get_user_model()


class BasicTest(TestCase):
    """Basic tests to verify testing setup."""

    def test_database_connection(self):
        """Test that database connection works."""
        # This test will fail if database isn't accessible
        User.objects.all().count()
        self.assertTrue(True)

    def test_user_creation(self):
        """Test basic user creation."""
        user = User.objects.create_user(
            email='test@example.com',
            username='testuser',
            password='testpass123'
        )

        self.assertEqual(user.username, 'testuser')
        self.assertEqual(user.email, 'test@example.com')
        self.assertTrue(user.check_password('testpass123'))

    def test_basic_math(self):
        """Test basic functionality."""
        self.assertEqual(2 + 2, 4)
        self.assertTrue(isinstance("hello", str))
        self.assertIn('test', 'this is a test string')

    def test_django_settings(self):
        """Test Django settings are loaded."""
        from django.conf import settings

        self.assertTrue(hasattr(settings, 'DATABASES'))
        self.assertTrue(hasattr(settings, 'INSTALLED_APPS'))
