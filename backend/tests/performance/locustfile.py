"""
Locust Load Testing for Earth Observation Platform

Usage:
  # Default (uses built-in test users)
  locust -f locustfile.py --host=https://earthobservationapi.azurewebsites.net
  
  # With custom user pool from environment variables
  export TEST_USERS='[{"email":"user1@test.com","password":"pass1"},{"email":"user2@test.com","password":"pass2"}]'
  locust -f locustfile.py --host=https://earthobservationapi.azurewebsites.net
  
  # With single user from environment variables
  export TEST_EMAIL=your.email@example.com
  export TEST_PASSWORD=YourPassword123
  locust -f locustfile.py --host=https://earthobservationapi.azurewebsites.net
"""

from locust import HttpUser, task, between
import json
import random
import os

# USER POOL CONFIGURATION

def get_test_users():
    """
    Get test users from environment variables or use default test users.
    
    Priority:
    1. TEST_USERS environment variable (JSON array)
    2. TEST_EMAIL + TEST_PASSWORD environment variables
    3. Default test users (hardcoded)
    
    Returns:
        list: List of user dictionaries with 'email' and 'password' keys
    """
    # Option 1: Load from TEST_USERS environment variable (JSON array)
    test_users_json = os.getenv('TEST_USERS')
    if test_users_json:
        try:
            users = json.loads(test_users_json)
            print(f"✅ Loaded {len(users)} test users from TEST_USERS environment variable")
            return users
        except json.JSONDecodeError:
            print("⚠️  Failed to parse TEST_USERS JSON, falling back to default users")
    
    # Option 2: Single user from environment variables
    test_email = os.getenv('TEST_EMAIL')
    test_password = os.getenv('TEST_PASSWORD')
    if test_email and test_password:
        print(f"✅ Using single test user from environment: {test_email}")
        return [{"email": test_email, "password": test_password}]
    
    # Option 3: Default test users (for development/testing)
    print("ℹ️  Using default test user pool")
    return [
        {"email": "a.adeleke@alustudent.com", "password": "Admin@01"},
        # Add more test users here for load testing with multiple accounts
        # {"email": "user2@example.com", "password": "password2"},
        # {"email": "user3@example.com", "password": "password3"},
    ]

# Load test users once at module level
TEST_USER_POOL = get_test_users()


def create_geojson_aoi(coordinates):
    """
    Create a GeoJSON FeatureCollection from coordinates.
    
    Args:
        coordinates: List of [lon, lat] pairs forming a polygon
        
    Returns:
        JSON string of GeoJSON FeatureCollection
    """
    return json.dumps({
        "type": "FeatureCollection",
        "features": [{
            "type": "Feature",
            "geometry": {
                "type": "Polygon",
                "coordinates": [coordinates]
            },
            "properties": {}
        }]
    })


class EarthObservationUser(HttpUser):
    """Simulates normal user behavior with authentication"""
    wait_time = between(1, 3)  # Wait 1-3 seconds between tasks
    token = None
    user_credentials = None
    
    def on_start(self):
        """Login and get authentication token using a random user from the pool"""
        # Select a random user from the pool
        self.user_credentials = random.choice(TEST_USER_POOL)
        
        with self.client.post(
            "/api/v1/login/",
            json={
                "email": self.user_credentials["email"],
                "password": self.user_credentials["password"]
            },
            catch_response=True,
            name="Login"
        ) as response:
            if response.status_code == 200:
                data = response.json()
                self.token = data.get("access") or data.get("token")
                response.success()
                print(f"✅ User logged in: {self.user_credentials['email']}")
            else:
                response.failure(f"Login failed with status {response.status_code}: {response.text}")
    
    @task(3)  # Weight: 3
    def get_image_metadata(self):
        """Test image metadata retrieval endpoint"""
        if not self.token:
            return
            
        headers = {"Authorization": f"Bearer {self.token}"}
        
        # Create coordinates as list of [lng, lat] pairs
        coordinates = [
            [-122.4194, 37.7749],
            [-122.3194, 37.7749],
            [-122.3194, 37.8749],
            [-122.4194, 37.8749],
            [-122.4194, 37.7749]
        ]
        
        data = {
            "satellite": random.choice(["landsat", "sentinel1", "sentinel2"]),
            "analysis_type": random.choice(["ndvi", "lst", "backscatter"]),
            "start_date": "2024-06-01",  # Shorter date range
            "end_date": "2024-07-31",
            "cloud_cover": random.choice([10, 20, 30]),
            "coordinates": coordinates
        }
        
        with self.client.post(
            "/api/v1/analysis/get_image_metadata/",
            json=data,
            headers=headers,
            catch_response=True,
            name="Get Image Metadata"
        ) as response:
            if response.status_code == 200:
                response.success()
            elif response.status_code == 401:
                response.failure("Authentication failed - token may have expired")
                self.on_start()  # Re-login
            elif response.status_code == 404:
                response.failure(f"Endpoint not found: {response.request.url}")
            else:
                response.failure(f"Got status code {response.status_code}: {response.text[:200]}")
    
    @task(2)  # Weight: 2
    def run_ndvi_analysis(self):
        """Test NDVI analysis endpoint"""
        if not self.token:
            return
            
        headers = {"Authorization": f"Bearer {self.token}"}
        
        # Create proper GeoJSON for AOI (San Francisco Bay Area example)
        coordinates = [
            [-122.4194, 37.7749],
            [-122.3194, 37.7749],
            [-122.3194, 37.8749],
            [-122.4194, 37.8749],
            [-122.4194, 37.7749]
        ]
        
        data = {
            "aoi_data": create_geojson_aoi(coordinates),
            "start_date": "2024-06-01",  # Shorter date range for faster processing
            "end_date": "2024-07-31",
            "satellite": random.choice(["landsat", "sentinel2"]),
            "cloud_cover": 20
        }
        
        with self.client.post(
            "/api/v1/analysis/process_ndvi/",
            json=data,
            headers=headers,
            catch_response=True,
            name="NDVI Analysis",
            timeout=120  # Increased timeout for Earth Engine processing
        ) as response:
            if response.status_code == 200:
                response.success()
            elif response.status_code == 401:
                response.failure("Authentication failed - token may have expired")
                self.on_start()  # Re-login
            elif response.status_code == 404:
                response.failure(f"Endpoint not found: {response.request.url}")
            elif response.status_code == 500:
                response.failure(f"Server error during NDVI analysis: {response.text[:200]}")
            else:
                response.failure(f"Got status code {response.status_code}: {response.text[:200]}")
    
    @task(2)
    def run_lst_analysis(self):
        """Test LST analysis endpoint"""
        if not self.token:
            return
            
        headers = {"Authorization": f"Bearer {self.token}"}
        
        # Create proper GeoJSON for AOI
        coordinates = [
            [-122.4194, 37.7749],
            [-122.3194, 37.7749],
            [-122.3194, 37.8749],
            [-122.4194, 37.8749],
            [-122.4194, 37.7749]
        ]
        
        data = {
            "aoi_data": create_geojson_aoi(coordinates),
            "start_date": "2024-06-01",  # Shorter date range for faster processing
            "end_date": "2024-07-31",
            "satellite": "landsat",  # Only Landsat supports LST
            "cloud_cover": 20
        }
        
        with self.client.post(
            "/api/v1/analysis/process_lst/",
            json=data,
            headers=headers,
            catch_response=True,
            name="LST Analysis",
            timeout=120  # Increased timeout for Earth Engine processing
        ) as response:
            if response.status_code == 200:
                response.success()
            elif response.status_code == 401:
                response.failure("Authentication failed - token may have expired")
                self.on_start()  # Re-login
            elif response.status_code == 404:
                response.failure(f"Endpoint not found: {response.request.url}")
            elif response.status_code == 500:
                response.failure(f"Server error during LST analysis: {response.text[:200]}")
            else:
                response.failure(f"Got status code {response.status_code}: {response.text[:200]}")
    
    @task(1)  # Weight: 1 (less common, takes longer)
    def create_interactive_map(self):
        """Test map visualization endpoint"""
        if not self.token:
            return
            
        headers = {"Authorization": f"Bearer {self.token}"}
        data = {
            "coordinates": [
                [-122.4194, 37.7749],
                [-122.3194, 37.7749],
                [-122.3194, 37.8749],
                [-122.4194, 37.8749],
                [-122.4194, 37.7749]
            ],
            "start_date": "2024-06-01",
            "end_date": "2024-07-31",
            "satellite": "landsat",
            "analysis_type": random.choice(["ndvi", "lst"]),
            "cloud_cover": 20,
            "selected_indices": []
        }
        
        with self.client.post(
            "/api/v1/visualization/create_custom_map/",
            json=data,
            headers=headers,
            catch_response=True,
            name="Create Interactive Map",
            timeout=120
        ) as response:
            if response.status_code == 200:
                response.success()
            elif response.status_code == 401:
                response.failure("Authentication failed - token may have expired")
                self.on_start()  # Re-login
            elif response.status_code == 404:
                response.failure(f"Endpoint not found: {response.request.url}")
            elif response.status_code == 500:
                response.failure(f"Server error during map creation: {response.text[:200]}")
            else:
                response.failure(f"Got status code {response.status_code}: {response.text[:200]}")
    
    @task(1)
    def get_projects(self):
        """Test user projects listing endpoint"""
        if not self.token:
            return
            
        headers = {"Authorization": f"Bearer {self.token}"}
        
        with self.client.get(
            "/api/v1/users/me/projects/",
            headers=headers,
            catch_response=True,
            name="Get User Projects"
        ) as response:
            if response.status_code == 200:
                response.success()
            elif response.status_code == 401:
                response.failure("Authentication failed - token may have expired")
                # Try to re-login
                self.on_start()
            else:
                response.failure(f"Got status code {response.status_code}: {response.text}")


class StressTestUser(HttpUser):
    """Simulates stress test with rapid requests and authentication"""
    wait_time = between(0.5, 1)
    token = None
    user_credentials = None
    
    def on_start(self):
        """Login once at start using a random user from the pool"""
        # Select a random user from the pool
        self.user_credentials = random.choice(TEST_USER_POOL)
        
        with self.client.post(
            "/api/v1/login/",
            json={
                "email": self.user_credentials["email"],
                "password": self.user_credentials["password"]
            },
            catch_response=True,
            name="Login"
        ) as response:
            if response.status_code == 200:
                data = response.json()
                self.token = data.get("access") or data.get("token")
                print(f"✅ Stress test user logged in: {self.user_credentials['email']}")
                response.success()
            else:
                response.failure(f"Login failed with status {response.status_code}: {response.text}")
    
    @task
    def rapid_metadata_requests(self):
        """Simulate rapid successive requests"""
        if not self.token:
            return
            
        headers = {"Authorization": f"Bearer {self.token}"}
        
        # Create coordinates as list of [lng, lat] pairs
        coordinates = [
            [-122.4194, 37.7749],
            [-122.3194, 37.7749],
            [-122.3194, 37.8749],
            [-122.4194, 37.8749],
            [-122.4194, 37.7749]
        ]
        
        # Make 5 rapid requests
        for i in range(5):
            self.client.post(
                "/api/v1/analysis/get_image_metadata/",
                json={
                    "satellite": "landsat",
                    "analysis_type": "ndvi",
                    "start_date": "2024-06-01",  # Shorter date range
                    "end_date": "2024-07-31",
                    "cloud_cover": 20,
                    "coordinates": coordinates
                },
                headers=headers,
                name=f"Rapid Metadata Request #{i+1}"
            )
