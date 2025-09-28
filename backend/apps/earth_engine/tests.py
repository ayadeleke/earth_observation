"""
Tests for the Earth Engine integration.
"""

from unittest.mock import patch
from rest_framework import status
from rest_framework.test import APITestCase, APIClient
from django.test import TestCase
from django.urls import reverse
from django.contrib.auth import get_user_model

User = get_user_model()


class EarthEngineAPITest(APITestCase):
    """Test Earth Engine API endpoints."""

    def setUp(self):
        """Set up test data."""
        self.client = APIClient()
        self.user = User.objects.create_user(
            email="test@example.com", username="testuser", password="test_password_123!"
        )
        self.client.force_authenticate(user=self.user)

    @patch("apps.earth_engine.views.ee")
    def test_ee_status_endpoint(self, mock_ee):
        """Test Earth Engine status endpoint."""
        # Mock successful initialization
        mock_ee.Initialize.return_value = None
        mock_ee.data.getInfo.return_value = {"status": "initialized"}

        url = reverse("earth_engine:ee-status")
        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("status", response.data)

    @patch("apps.earth_engine.views.ee")
    def test_ee_status_error(self, mock_ee):
        """Test Earth Engine status when initialization fails."""
        # Mock initialization error
        mock_ee.Initialize.side_effect = Exception("Authentication failed")

        url = reverse("earth_engine:ee-status")
        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_500_INTERNAL_SERVER_ERROR)
        self.assertIn("error", response.data)

    @patch("apps.earth_engine.views.ee")
    def test_ee_collections_endpoint(self, mock_ee):
        """Test Earth Engine collections endpoint."""
        # Mock Earth Engine collections
        mock_ee.Initialize.return_value = None
        mock_collections = [
            {"id": "LANDSAT/LC08/C02/T1_L2", "title": "Landsat 8 Collection 2"},
            {"id": "COPERNICUS/S2_SR_HARMONIZED", "title": "Sentinel-2 MSI"},
            {"id": "COPERNICUS/S1_GRD", "title": "Sentinel-1 SAR GRD"},
        ]
        mock_ee.data.listCollections.return_value = mock_collections

        url = reverse("earth_engine:ee-collections")
        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("collections", response.data)
        self.assertEqual(len(response.data["collections"]), 3)

    def test_ee_endpoints_require_auth(self):
        """Test that Earth Engine endpoints require authentication."""
        self.client.force_authenticate(user=None)

        endpoints = ["earth_engine:ee-status", "earth_engine:ee-collections"]

        for endpoint in endpoints:
            url = reverse(endpoint)
            response = self.client.get(url)
            self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)


class EarthEngineConfigTest(TestCase):
    """Test Earth Engine configuration."""

    @patch("apps.earth_engine.ee_config.ee")
    def test_ee_initialization(self, mock_ee):
        """Test Earth Engine initialization."""
        from apps.earth_engine.ee_config import initialize_earth_engine

        # Mock successful initialization
        mock_ee.Initialize.return_value = None

        result = initialize_earth_engine()
        self.assertTrue(result)
        mock_ee.Initialize.assert_called_once()

    @patch("apps.earth_engine.ee_config.ee")
    def test_ee_initialization_error(self, mock_ee):
        """Test Earth Engine initialization with error."""
        from apps.earth_engine.ee_config import initialize_earth_engine

        # Mock initialization error
        mock_ee.Initialize.side_effect = Exception("Service account error")

        result = initialize_earth_engine()
        self.assertFalse(result)

    @patch("apps.earth_engine.ee_config.os.path.exists")
    @patch("apps.earth_engine.ee_config.ee")
    def test_service_account_authentication(self, mock_ee, mock_exists):
        """Test service account authentication."""
        from apps.earth_engine.ee_config import initialize_earth_engine

        # Mock service account file exists
        mock_exists.return_value = True
        mock_ee.Initialize.return_value = None

        result = initialize_earth_engine()
        self.assertTrue(result)

    @patch("apps.earth_engine.ee_config.os.path.exists")
    @patch("apps.earth_engine.ee_config.ee")
    def test_fallback_authentication(self, mock_ee, mock_exists):
        """Test fallback authentication when service account is not available."""
        from apps.earth_engine.ee_config import initialize_earth_engine

        # Mock service account file doesn't exist
        mock_exists.return_value = False
        mock_ee.Initialize.return_value = None

        result = initialize_earth_engine()
        self.assertTrue(result)
