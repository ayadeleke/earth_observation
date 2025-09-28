"""
Tests for the core app.
"""

from .models import AnalysisProject
from rest_framework import status
from rest_framework.test import APITestCase, APIClient
from django.test import TestCase
from django.urls import reverse
from django.contrib.auth import get_user_model

User = get_user_model()


class UserModelTest(TestCase):
    """Test the custom User model."""

    def test_user_creation(self):
        """Test creating a user with the custom model."""
        user = User.objects.create_user(
            email="test@example.com", username="testuser", password="test_password_123!"
        )

        self.assertEqual(user.email, "test@example.com")
        self.assertEqual(user.username, "testuser")
        self.assertFalse(user.is_earth_engine_authenticated)
        self.assertIsNone(user.earth_engine_project_id)

    def test_user_email_unique(self):
        """Test that email field is unique."""
        User.objects.create_user(
            email="test@example.com",
            username="testuser1",
            password="test_password_123!",
        )

        # This should raise an error due to unique email constraint
        with self.assertRaises(Exception):
            User.objects.create_user(
                email="test@example.com",
                username="testuser2",
                password="test_password_123!",
            )


class AnalysisProjectModelTest(TestCase):
    """Test the AnalysisProject model."""

    def setUp(self):
        """Set up test data."""
        self.user = User.objects.create_user(
            email="test@example.com", username="testuser", password="test_password_123!"
        )

    def test_analysis_project_creation(self):
        """Test creating an analysis project."""
        project = AnalysisProject.objects.create(
            name="Test Project",
            description="A test project for analysis",
            user=self.user,
        )

        self.assertEqual(project.name, "Test Project")
        self.assertEqual(project.user, self.user)
        self.assertEqual(str(project), f"Test Project - {self.user.username}")

    def test_analysis_project_cascade_delete(self):
        """Test that projects are deleted when user is deleted."""
        project = AnalysisProject.objects.create(name="Test Project", user=self.user)

        project_id = project.id
        self.user.delete()

        with self.assertRaises(AnalysisProject.DoesNotExist):
            AnalysisProject.objects.get(id=project_id)


class CoreAPITest(APITestCase):
    """Test the Core API endpoints."""

    def setUp(self):
        """Set up test data."""
        self.client = APIClient()
        self.user = User.objects.create_user(
            email="test@example.com", username="testuser", password="test_password_123!"
        )

    def test_user_profile_requires_auth(self):
        """Test that user profile requires authentication."""
        url = reverse("profile")
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_user_profile_authenticated(self):
        """Test authenticated access to user profile."""
        self.client.force_authenticate(user=self.user)
        url = reverse("profile")
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_analysis_project_creation_via_api(self):
        """Test creating an analysis project via API."""
        self.client.force_authenticate(user=self.user)
        url = reverse("project-list")
        data = {"name": "Test Project", "description": "A test project created via API"}

        response = self.client.post(url, data, format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

        project = AnalysisProject.objects.get(user=self.user)
        self.assertEqual(project.name, "Test Project")

    def test_analysis_project_update(self):
        """Test updating an analysis project."""
        self.client.force_authenticate(user=self.user)
        project = AnalysisProject.objects.create(name="Old Project", user=self.user)

        url = reverse("project-detail", kwargs={"pk": project.pk})
        data = {"name": "Updated Project", "description": "Updated description"}

        response = self.client.put(url, data, format="json")
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        project.refresh_from_db()
        self.assertEqual(project.name, "Updated Project")


class AnalysisCapabilitiesTest(TestCase):
    """Test analysis capabilities endpoint."""

    def test_analysis_capabilities(self):
        """Test the analysis capabilities endpoint."""
        url = reverse("analysis_capabilities")
        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("available_analyses", response.data)
        self.assertIn("supported_satellites", response.data)
