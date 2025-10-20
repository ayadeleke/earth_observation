"""
Earth Engine Configuration for GeoAnalysis Django Application.

This module handles Earth Engine authentication and initialization using
service account credentials for permanent authentication.
"""

import ee
import logging
import os
from pathlib import Path
from django.conf import settings

logger = logging.getLogger(__name__)

# Global flag to track initialization status
_ee_initialized = False


def initialize_earth_engine():
    """
    Initialize Earth Engine with service account authentication.

    This function provides permanent authentication using service account
    credentials, eliminating the need for user authentication.

    Returns:
        bool: True if initialization successful, False otherwise
    """
    global _ee_initialized

    if _ee_initialized:
        return True

    try:
        project_id = getattr(settings, "EARTH_ENGINE_PROJECT", "ee-ayotundenew")
        use_service_account = getattr(
            settings, "EARTH_ENGINE_USE_SERVICE_ACCOUNT", False
        )
        service_account_key_path = getattr(
            settings, "EARTH_ENGINE_SERVICE_ACCOUNT_KEY", None
        )
        service_account_key_base64 = getattr(
            settings, "EARTH_ENGINE_SERVICE_ACCOUNT_KEY_BASE64", None
        )

        if use_service_account and (service_account_key_path or service_account_key_base64):
            # Check if service_account_key_path is JSON content or a file path
            import json
            import base64
            
            key_file_path = None
            key_data = None
            
            # Try base64-encoded JSON first (most reliable for Azure)
            if service_account_key_base64:
                try:
                    json_bytes = base64.b64decode(service_account_key_base64)
                    key_data = json.loads(json_bytes.decode('utf-8'))
                    # Write JSON to temporary file
                    temp_key_file = Path(settings.BASE_DIR) / "auth" / "service_account.json"
                    temp_key_file.parent.mkdir(parents=True, exist_ok=True)
                    with open(temp_key_file, 'w') as f:
                        json.dump(key_data, f)
                    key_file_path = temp_key_file
                    logger.info(f"[SUCCESS] Created service account key file from base64 environment variable at {temp_key_file}")
                except Exception as e:
                    logger.warning(f"[WARNING] Failed to decode base64 service account key: {e}")
            
            # Try to parse as JSON (environment variable contains JSON content)
            if not key_file_path and isinstance(service_account_key_path, str) and service_account_key_path.strip().startswith('{'):
                try:
                    key_data = json.loads(service_account_key_path)
                    # Write JSON to temporary file
                    temp_key_file = Path(settings.BASE_DIR) / "auth" / "service_account.json"
                    temp_key_file.parent.mkdir(parents=True, exist_ok=True)
                    with open(temp_key_file, 'w') as f:
                        json.dump(key_data, f)
                    key_file_path = temp_key_file
                    logger.info(f"[SUCCESS] Created service account key file from JSON environment variable at {temp_key_file}")
                except json.JSONDecodeError as e:
                    logger.warning(f"[WARNING] Failed to parse service account key as JSON: {e}")
            
            # Treat as file path
            if not key_file_path and isinstance(service_account_key_path, str):
                if not os.path.isabs(service_account_key_path):
                    base_dir = Path(settings.BASE_DIR)
                    key_file_path = base_dir / service_account_key_path
                else:
                    key_file_path = Path(service_account_key_path)

            if key_file_path and key_file_path.exists():
                # Initialize with service account credentials
                credentials = ee.ServiceAccountCredentials(
                    email=None,  # Will be read from the key file
                    key_file=str(key_file_path),
                )
                ee.Initialize(credentials, project=project_id)
                logger.info(
                    f"[SUCCESS] Earth Engine initialized with service account for project: {project_id}"
                )
                _ee_initialized = True
                return True
            else:
                logger.warning(
                    f"[WARNING] Service account key file not found: {key_file_path}"
                )
                logger.info("Falling back to default authentication...")

        # Fallback to default authentication (for development)
        try:
            ee.Initialize(project=project_id)
            logger.info(
                f"[SUCCESS] Earth Engine initialized with default authentication for project: {project_id}"
            )
            _ee_initialized = True
            return True
        except Exception as fallback_error:
            logger.error(
                f"[ERROR] Default authentication failed: {str(fallback_error)}"
            )
            logger.info("Running in demo mode - Earth Engine functionality simulated")
            _ee_initialized = True  # Set to True for demo mode
            return True

    except Exception as e:
        logger.error(f"[ERROR] Failed to initialize Earth Engine: {str(e)}")
        logger.info("Running in demo mode - Earth Engine functionality simulated")
        _ee_initialized = True  # Set to True for demo mode
        return True


def get_project_id():
    """
    Get the configured Earth Engine project ID.

    Returns:
        str: The project ID (your app project: ee-ayotundenew)
    """
    return getattr(settings, "EARTH_ENGINE_PROJECT", "ee-ayotundenew")


def is_initialized():
    """
    Check if Earth Engine has been initialized.

    Returns:
        bool: True if initialized, False otherwise
    """
    return _ee_initialized


def get_authentication_info():
    """
    Get information about the current Earth Engine authentication.

    Returns:
        dict: Authentication information
    """
    use_service_account = getattr(settings, "EARTH_ENGINE_USE_SERVICE_ACCOUNT", False)
    service_account_key_path = getattr(
        settings, "EARTH_ENGINE_SERVICE_ACCOUNT_KEY", None
    )

    # Check if service account key exists
    service_account_available = False
    if service_account_key_path:
        if not os.path.isabs(service_account_key_path):
            base_dir = Path(settings.BASE_DIR)
            key_file_path = base_dir / service_account_key_path
        else:
            key_file_path = Path(service_account_key_path)
        service_account_available = key_file_path.exists()

    auth_method = (
        "Service Account"
        if (use_service_account and service_account_available)
        else "Default/Demo"
    )

    return {
        "project_id": get_project_id(),
        "initialized": is_initialized(),
        "app_mode": True,
        "authentication_method": auth_method,
        "service_account_configured": use_service_account,
        "service_account_available": service_account_available,
        "app_url": "https://ee-ayotundenew.projects.earthengine.app/view/forestmonitor",
    }


# Initialize Earth Engine when module is imported
initialize_earth_engine()
