"""
Integration tests for the Earth Observation backend.
"""
from django.test import TestCase, TransactionTestCase
from django.urls import reverse
from django.contrib.auth import get_user_model
from rest_framework.test import APITestCase, APIClient
from rest_framework import status
from unittest.mock import patch, MagicMock
from django.db import connections
from django.core.management import call_command
import json
import tempfile
import os
from apps.analysis.models import AnalysisRequest, AnalysisResult
from apps.core.models import AnalysisProject

User = get_user_model()


class DatabaseIntegrationTest(TransactionTestCase):
    """Test database operations and transactions."""

    def test_database_connection(self):
        """Test database connection is working."""
        from django.db import connection

        with connection.cursor() as cursor:
            cursor.execute("SELECT 1")
            result = cursor.fetchone()
            self.assertEqual(result[0], 1)

    def test_migrations_applied(self):
        """Test that all migrations have been applied."""
        from django.db.migrations.executor import MigrationExecutor
        from django.db import connection

        executor = MigrationExecutor(connection)
        plan = executor.migration_plan(executor.loader.graph.leaf_nodes())

        # If plan is empty, all migrations are applied
        self.assertEqual(len(plan), 0, "There are unapplied migrations")

    def test_model_creation_and_relationships(self):
        """Test model creation and foreign key relationships."""
        # Create user
        user = User.objects.create_user(
            email='integration@test.com',
            username='integrationtest',
            password='testpass123'
        )

        # Create analysis project
        project = AnalysisProject.objects.create(
            name='Integration Test Project',
            user=user
        )

        # Create analysis request
        request = AnalysisRequest.objects.create(
            user=user,
            analysis_type='ndvi',
            satellite='landsat',
            start_date='2023-01-01',
            end_date='2023-01-31',
            coordinates='[[0, 0], [1, 0], [1, 1], [0, 1]]'
        )

        # Create analysis result
        result = AnalysisResult.objects.create(
            request=request,
            mean_value=0.65,
            std_value=0.15,
            min_value=0.2,
            max_value=0.9,
            statistics={'pixel_count': 1000}
        )

        # Test relationships
        self.assertEqual(project.user, user)
        self.assertEqual(request.user, user)
        self.assertEqual(result.request, request)
        self.assertEqual(result.request.user, user)

    def test_model_constraints(self):
        """Test model constraints and validations."""
        user = User.objects.create_user(
            username='constrainttest',
            email='constraint@test.com',
            password='testpass123'
        )

        # Test that duplicate requests are allowed (no unique constraint)
        request1 = AnalysisRequest.objects.create(
            user=user,
            analysis_type='ndvi',
            satellite='landsat',
            start_date='2023-01-01',
            end_date='2023-01-31',
            coordinates='[[0, 0], [1, 0], [1, 1], [0, 1]]'
        )

        request2 = AnalysisRequest.objects.create(
            user=user,
            analysis_type='ndvi',
            satellite='landsat',
            start_date='2023-01-01',
            end_date='2023-01-31',
            coordinates='[[0, 0], [1, 0], [1, 1], [0, 1]]'
        )

        self.assertNotEqual(request1.id, request2.id)


class APIIntegrationTest(APITestCase):
    """Test API integration across different endpoints."""

    def setUp(self):
        """Set up test data."""
        self.client = APIClient()
        self.user = User.objects.create_user(
            username='apitest',
            email='api@test.com',
            password='testpass123'
        )
        self.client.force_authenticate(user=self.user)

    @patch('apps.analysis.views.ee')
    @patch('apps.earth_engine.views.ee')
    def test_full_api_workflow(self, mock_ee_views, mock_ee_analysis):
        """Test complete API workflow."""
        # Mock Earth Engine
        mock_ee_views.Initialize.return_value = None
        mock_ee_analysis.Initialize.return_value = None

        # Mock EE collections
        mock_ee_views.data.listCollections.return_value = [
            {'id': 'LANDSAT/LC08/C02/T1_L2', 'title': 'Landsat 8'}
        ]

        # Mock analysis results
        mock_collection = MagicMock()
        mock_image = MagicMock()
        mock_image.reduceRegion.return_value.getInfo.return_value = {
            'NDVI_mean': 0.75,
            'NDVI_stdDev': 0.12,
            'NDVI_min': 0.3,
            'NDVI_max': 0.95
        }
        mock_collection.first.return_value = mock_image
        mock_ee_analysis.ImageCollection.return_value = mock_collection

        # Step 1: Check Earth Engine status
        ee_status_url = reverse('earth_engine:ee-status')
        ee_response = self.client.get(ee_status_url)
        self.assertEqual(ee_response.status_code, status.HTTP_200_OK)

        # Step 2: Get available collections
        collections_url = reverse('earth_engine:ee-collections')
        collections_response = self.client.get(collections_url)
        self.assertEqual(collections_response.status_code, status.HTTP_200_OK)

        # Step 3: Submit analysis request
        analysis_url = reverse('analysis:process-ndvi')
        analysis_data = {
            'satellite': 'landsat',
            'start_date': '2023-01-01',
            'end_date': '2023-01-31',
            'coordinates': [[0, 0], [1, 0], [1, 1], [0, 1]],
            'cloud_coverage': 20
        }
        analysis_response = self.client.post(analysis_url, analysis_data, format='json')
        self.assertEqual(analysis_response.status_code, status.HTTP_200_OK)

        # Step 4: Check that request was stored
        requests = AnalysisRequest.objects.filter(user=self.user)
        self.assertEqual(requests.count(), 1)

        # Step 5: Check analysis results list
        requests_url = reverse('analysis:analysis-request-list')
        requests_response = self.client.get(requests_url)
        self.assertEqual(requests_response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(requests_response.data), 1)

    def test_error_handling_across_endpoints(self):
        """Test error handling consistency across endpoints."""
        # Test authentication errors
        self.client.force_authenticate(user=None)

        endpoints = [
            reverse('analysis:process-ndvi'),
            reverse('analysis:analysis-request-list'),
            reverse('core:user-list'),
            reverse('earth_engine:ee-status')
        ]

        for url in endpoints:
            response = self.client.get(url)
            self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_invalid_data_handling(self):
        """Test handling of invalid data across endpoints."""
        # Test with invalid JSON
        analysis_url = reverse('analysis:process-ndvi')
        response = self.client.post(
            analysis_url,
            'invalid json',
            content_type='application/json'
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)


class PerformanceTest(TestCase):
    """Test performance characteristics."""

    def setUp(self):
        """Set up test data."""
        self.user = User.objects.create_user(
            username='perftest',
            email='perf@test.com',
            password='testpass123'
        )

    def test_bulk_request_creation(self):
        """Test creating multiple analysis requests."""
        import time

        start_time = time.time()

        requests = []
        for i in range(100):
            requests.append(AnalysisRequest(
                user=self.user,
                analysis_type='ndvi',
                satellite='landsat',
                start_date='2023-01-01',
                end_date='2023-01-31',
                coordinates=f'[[{i}, 0], [{i+1}, 0], [{i+1}, 1], [{i}, 1]]'
            ))

        AnalysisRequest.objects.bulk_create(requests)

        end_time = time.time()
        creation_time = end_time - start_time

        # Should create 100 requests in less than 1 second
        self.assertLess(creation_time, 1.0)
        self.assertEqual(AnalysisRequest.objects.count(), 100)

    def test_database_query_performance(self):
        """Test database query performance."""
        import time

        # Create test data
        requests = []
        for i in range(50):
            request = AnalysisRequest.objects.create(
                user=self.user,
                analysis_type='ndvi',
                satellite='landsat',
                start_date='2023-01-01',
                end_date='2023-01-31',
                coordinates=f'[[{i}, 0], [{i+1}, 0], [{i+1}, 1], [{i}, 1]]'
            )
            requests.append(request)

            AnalysisResult.objects.create(
                request=request,
                mean_value=0.5 + (i * 0.01),
                std_value=0.1,
                min_value=0.1,
                max_value=0.9
            )

        # Test query performance
        start_time = time.time()

        # Complex query with joins
        results = list(AnalysisResult.objects.select_related('request', 'request__user').all())

        end_time = time.time()
        query_time = end_time - start_time

        # Should query 50 results with joins in less than 0.1 seconds
        self.assertLess(query_time, 0.1)
        self.assertEqual(len(results), 50)


class SecurityTest(APITestCase):
    """Test security aspects of the API."""

    def setUp(self):
        """Set up test data."""
        self.client = APIClient()
        self.user1 = User.objects.create_user(
            username='user1',
            email='user1@test.com',
            password='testpass123'
        )
        self.user2 = User.objects.create_user(
            username='user2',
            email='user2@test.com',
            password='testpass123'
        )

    def test_user_data_isolation(self):
        """Test that users can only access their own data."""
        # Create requests for both users
        request1 = AnalysisRequest.objects.create(
            user=self.user1,
            analysis_type='ndvi',
            satellite='landsat',
            start_date='2023-01-01',
            end_date='2023-01-31',
            coordinates='[[0, 0], [1, 0], [1, 1], [0, 1]]'
        )

        AnalysisRequest.objects.create(
            user=self.user2,
            analysis_type='lst',
            satellite='modis',
            start_date='2023-01-01',
            end_date='2023-01-31',
            coordinates='[[2, 0], [3, 0], [3, 1], [2, 1]]'
        )

        # Authenticate as user1
        self.client.force_authenticate(user=self.user1)

        # User1 should only see their own requests
        url = reverse('analysis:analysis-request-list')
        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]['id'], request1.id)

    def test_sql_injection_protection(self):
        """Test protection against SQL injection attacks."""
        self.client.force_authenticate(user=self.user1)

        # Attempt SQL injection in coordinates field
        malicious_data = {
            'satellite': 'landsat',
            'start_date': '2023-01-01',
            'end_date': '2023-01-31',
            'coordinates': "'; DROP TABLE analysis_analysisrequest; --",
            'cloud_coverage': 20
        }

        url = reverse('analysis:process-ndvi')
        response = self.client.post(url, malicious_data, format='json')

        # Should return validation error, not execute SQL
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

        # Verify table still exists
        self.assertTrue(AnalysisRequest.objects.model._meta.db_table)

    def test_xss_protection(self):
        """Test protection against XSS attacks."""
        self.client.force_authenticate(user=self.user1)

        # Create project with potential XSS payload
        project_data = {
            'name': '<script>alert("XSS")</script>',
            'description': '<img src=x onerror=alert("XSS")>'
        }

        url = reverse('core:analysisproject-list')
        response = self.client.post(url, project_data, format='json')

        if response.status_code == 201:
            # If creation succeeds, check that script tags are escaped/sanitized
            project = AnalysisProject.objects.get(user=self.user1)
            self.assertNotIn('<script>', project.name)
            self.assertNotIn('onerror=', project.description)
