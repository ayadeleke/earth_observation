"""
Django settings for geoanalysis project.
"""

from datetime import timedelta
import os
import environ
from pathlib import Path
import logging

# Configure logger
logger = logging.getLogger(__name__)

# Build paths inside the project
BASE_DIR = Path(__file__).resolve().parent.parent

# Environment variables
env = environ.Env(DEBUG=(bool, False))

# Take environment variables from .env file
environ.Env.read_env(BASE_DIR / ".env")

# SECURITY WARNING: keep the secret key used in production secret!
SECRET_KEY = env("SECRET_KEY", default="django-insecure-change-me-in-production")

# SECURITY WARNING: don't run with debug turned on in production!
# Default to False for safety - explicitly set DEBUG=True in local .env for development
DEBUG = env("DEBUG", default=False)

ALLOWED_HOSTS = env.list("ALLOWED_HOSTS", default=["localhost", "127.0.0.1", "169.254.131.4"])

# Application definition
DJANGO_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    # 'django.contrib.gis',  # Commented out - no GDAL for development
]

THIRD_PARTY_APPS = [
    "rest_framework",
    "rest_framework_simplejwt",
    "rest_framework_simplejwt.token_blacklist",  # Add token blacklisting
    "corsheaders",
    "django_filters",
    "drf_spectacular",
    "storages",  # Django storages for Azure Blob Storage
    # "cachalot",  # Database query caching - disabled for development
]

LOCAL_APPS = [
    "apps.core",
    "apps.analysis",
    "apps.earth_engine",
    "apps.visualization",
]

INSTALLED_APPS = DJANGO_APPS + THIRD_PARTY_APPS + LOCAL_APPS

MIDDLEWARE = [
    "corsheaders.middleware.CorsMiddleware",
    "django.middleware.security.SecurityMiddleware",
    "apps.core.middleware.security.SecurityHeadersMiddleware",  # Custom security headers
    "apps.core.middleware.security.SecureCookieMiddleware",  # Secure cookie attributes
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    # "django.middleware.clickjacking.XFrameOptionsMiddleware",  # Handled by SecurityHeadersMiddleware
]

ROOT_URLCONF = "geoanalysis.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.debug",
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "geoanalysis.wsgi.application"

# Database
# Support both PostgreSQL and SQLite based on environment variables
if env("DATABASE_URL", default="").startswith("postgres"):
    # PostgreSQL configuration (supports both local and cloud with SSL)
    db_options = {
        "connect_timeout": 10,
        # Optimize for Azure App Service - reduce statement timeout for faster failures
        "options": "-c statement_timeout=30000",  # 30 seconds max query time
    }
    
    # Add SSL configuration for cloud databases (Aiven)
    if "aivencloud.com" in env("DB_HOST", default="localhost"):
        db_options.update({
            "sslmode": "require",
            "sslcert": None,
            "sslkey": None,
            "sslrootcert": None,
        })
    
    DATABASES = {
        "default": {
            "ENGINE": "django.db.backends.postgresql",
            "NAME": env("DB_NAME", default="geoanalysis"),
            "USER": env("DB_USER", default="postgres"),
            "PASSWORD": env("DB_PASSWORD", default=""),
            "HOST": env("DB_HOST", default="localhost"),
            "PORT": env("DB_PORT", default="5432"),
            "OPTIONS": db_options,
            # Optimized connection pooling for Azure
            # Keep connections alive longer to reduce reconnection overhead
            "CONN_MAX_AGE": 900,  # 15 minutes (increased from 10 minutes)
            # Disable persistent connections in development to avoid connection exhaustion
            "DISABLE_SERVER_SIDE_CURSORS": True,  # Better for connection pooling
        }
    }
else:
    # SQLite fallback (for development)
    DATABASES = {
        "default": {
            "ENGINE": "django.db.backends.sqlite3",
            "NAME": BASE_DIR / "db.sqlite3",
        }
    }

# Password validation
AUTH_PASSWORD_VALIDATORS = [
    {
        "NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator",
    },
    {
        "NAME": "django.contrib.auth.password_validation.MinimumLengthValidator",
    },
    {
        "NAME": "django.contrib.auth.password_validation.CommonPasswordValidator",
    },
    {
        "NAME": "django.contrib.auth.password_validation.NumericPasswordValidator",
    },
]

# Internationalization
LANGUAGE_CODE = "en-us"
TIME_ZONE = "UTC"
USE_I18N = True
USE_TZ = True

# Static files (CSS, JavaScript, Images)
STATIC_URL = "/static/"
STATIC_ROOT = BASE_DIR / "staticfiles"

# Additional locations of static files for development
STATICFILES_DIRS = [
    BASE_DIR / "static",
]

# Azure Blob Storage Configuration
USE_AZURE_STORAGE = env.bool("USE_AZURE_STORAGE", default=False)

if USE_AZURE_STORAGE:
    # Azure Storage settings for media files
    AZURE_ACCOUNT_NAME = env("AZURE_ACCOUNT_NAME")
    AZURE_ACCOUNT_KEY = env("AZURE_ACCOUNT_KEY")
    AZURE_CONTAINER = env("AZURE_CONTAINER", default="media")
    AZURE_STATIC_CONTAINER = env("AZURE_STATIC_CONTAINER", default="static")
    AZURE_CUSTOM_DOMAIN = env("AZURE_CUSTOM_DOMAIN", default="").strip()
    
    # Media files will be stored in Azure Blob Storage
    if AZURE_CUSTOM_DOMAIN:  # Empty string evaluates to False
        MEDIA_URL = f"https://{AZURE_CUSTOM_DOMAIN}/"
        STATIC_URL = f"https://{AZURE_CUSTOM_DOMAIN}/static/"
    else:
        MEDIA_URL = f"https://{AZURE_ACCOUNT_NAME}.blob.core.windows.net/{AZURE_CONTAINER}/"
        STATIC_URL = f"https://{AZURE_ACCOUNT_NAME}.blob.core.windows.net/{AZURE_STATIC_CONTAINER}/"
    
    # Azure Storage connection settings
    AZURE_CONNECTION_STRING = f"DefaultEndpointsProtocol=https;AccountName={AZURE_ACCOUNT_NAME};AccountKey={AZURE_ACCOUNT_KEY};EndpointSuffix=core.windows.net"
    AZURE_SSL = True
    AZURE_AUTO_SIGN = True  # Generate SAS tokens for private containers
    AZURE_UPLOAD_MAX_CONN = 2
    AZURE_TIMEOUT = 20
    AZURE_MAX_MEMORY_SIZE = 2 * 1024 * 1024  # 2 MB
    
    # Configure django-storages for Azure (Django 4.2+ STORAGES setting)
    STORAGES = {
        "default": {
            "BACKEND": "storages.backends.azure_storage.AzureStorage",
            "OPTIONS": {
                "account_name": AZURE_ACCOUNT_NAME,
                "account_key": AZURE_ACCOUNT_KEY,
                "azure_container": AZURE_CONTAINER,
                "azure_ssl": AZURE_SSL,
            },
        },
        "staticfiles": {
            "BACKEND": "storages.backends.azure_storage.AzureStorage",
            "OPTIONS": {
                "account_name": AZURE_ACCOUNT_NAME,
                "account_key": AZURE_ACCOUNT_KEY,
                "azure_container": AZURE_STATIC_CONTAINER,
                "azure_ssl": AZURE_SSL,
            },
        },
    }
    
    logger.info(f"✅ Azure Blob Storage enabled for media files: {MEDIA_URL}")
    logger.info(f"✅ Azure Blob Storage enabled for static files: {STATIC_URL}")
else:
    # Local file storage (development)
    MEDIA_URL = "/media/"
    MEDIA_ROOT = BASE_DIR / "media"
    
    STORAGES = {
        "default": {
            "BACKEND": "django.core.files.storage.FileSystemStorage",
        },
        "staticfiles": {
            "BACKEND": "django.contrib.staticfiles.storage.StaticFilesStorage",
        },
    }
    
    logger.info("📁 Using local file storage for media files")

# Default primary key field type
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

# REST Framework configuration
REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "rest_framework_simplejwt.authentication.JWTAuthentication",
        "rest_framework.authentication.SessionAuthentication",
    ],
    "DEFAULT_PERMISSION_CLASSES": [
        "rest_framework.permissions.IsAuthenticated",
    ],
    "DEFAULT_RENDERER_CLASSES": [
        "rest_framework.renderers.JSONRenderer",
    ],
    "DEFAULT_PAGINATION_CLASS": "rest_framework.pagination.PageNumberPagination",
    "PAGE_SIZE": 20,
    "DEFAULT_FILTER_BACKENDS": [
        "django_filters.rest_framework.DjangoFilterBackend",
        "rest_framework.filters.SearchFilter",
        "rest_framework.filters.OrderingFilter",
    ],
    "DEFAULT_SCHEMA_CLASS": "drf_spectacular.openapi.AutoSchema",
}

# Authentication backends
AUTHENTICATION_BACKENDS = [
    "apps.core.auth_backends.CachedModelBackend",  # Custom cached authentication
    "django.contrib.auth.backends.ModelBackend",   # Fallback to default
]

# JWT Configuration
SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(minutes=60),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=7),
    "ROTATE_REFRESH_TOKENS": True,
    # Disable token blacklisting for better performance
    # Trade-off: Old tokens remain valid until expiration, but login is 50-100ms faster
    "BLACKLIST_AFTER_ROTATION": False,  # Disabled for performance (was True)
    "UPDATE_LAST_LOGIN": True,
    "ALGORITHM": "HS256",
    "SIGNING_KEY": SECRET_KEY,
    "AUTH_HEADER_TYPES": ("Bearer",),
    "AUTH_HEADER_NAME": "HTTP_AUTHORIZATION",
    "USER_ID_FIELD": "id",
    "USER_ID_CLAIM": "user_id",
    "AUTH_TOKEN_CLASSES": ("rest_framework_simplejwt.tokens.AccessToken",),
    "TOKEN_TYPE_CLAIM": "token_type",
}

# API Documentation
SPECTACULAR_SETTINGS = {
    "TITLE": "GeoAnalysis API",
    "DESCRIPTION": "API for geospatial analysis including NDVI, LST, and Sentinel data processing using Earth Engine",
    "VERSION": "1.0.0",
    "SERVE_INCLUDE_SCHEMA": False,
    "SCHEMA_PATH_PREFIX": "/api/v1/",
    "COMPONENT_SPLIT_REQUEST": True,
    "SORT_OPERATIONS": False,
    "SWAGGER_UI_SETTINGS": {
        "deepLinking": True,
        "persistAuthorization": True,
        "displayOperationId": True,
        "filter": True,
        "requestSnippetsEnabled": True,
        "requestSnippets": {
            "generators": {
                "curl_bash": {
                    "title": "cURL (bash)",
                    "syntax": "bash",
                },
                "curl_powershell": {
                    "title": "cURL (PowerShell)",
                    "syntax": "powershell",
                },
                "curl_cmd": {
                    "title": "cURL (CMD)",
                    "syntax": "bash",
                },
            },
            "defaultExpanded": True,
            "languages": ["curl_bash", "curl_powershell", "curl_cmd"],
        },
    },
    "CONTACT": {
        "name": "GeoAnalysis API Support",
        "email": "support@geoanalysis.com",
    },
    "LICENSE": {
        "name": "MIT License",
    },
    "TAGS": [
        {
            "name": "Analysis",
            "description": "Geospatial analysis endpoints for NDVI, LST, and SAR processing",
        },
        {
            "name": "Earth Engine",
            "description": "Google Earth Engine integration endpoints",
        },
        {
            "name": "Authentication",
            "description": "User authentication and authorization",
        },
        {
            "name": "Visualization",
            "description": "Data visualization and mapping endpoints",
        },
    ],
}

# Earth Engine Configuration
EARTH_ENGINE_SERVICE_ACCOUNT_KEY = env("EARTH_ENGINE_SERVICE_ACCOUNT_KEY", default=None)
EARTH_ENGINE_SERVICE_ACCOUNT_KEY_BASE64 = env("EARTH_ENGINE_SERVICE_ACCOUNT_KEY_BASE64", default=None)
EARTH_ENGINE_PROJECT = env("EARTH_ENGINE_PROJECT", default="ee-ayotundenew")
EARTH_ENGINE_USE_SERVICE_ACCOUNT = env(
    "EARTH_ENGINE_USE_SERVICE_ACCOUNT", default=False, cast=bool
)
EARTH_ENGINE_USE_APP_DEFAULT = env("EARTH_ENGINE_USE_APP_DEFAULT", default=True)

# File Upload Settings
FILE_UPLOAD_MAX_MEMORY_SIZE = 16 * 1024 * 1024  # 16MB
DATA_UPLOAD_MAX_MEMORY_SIZE = 16 * 1024 * 1024  # 16MB

# CORS configuration - properly handle credentials
CORS_ALLOWED_ORIGINS = env.list(
    "CORS_ALLOWED_ORIGINS",
    default=[
        "http://localhost:3000",   # React development server
        "http://127.0.0.1:3000",   # Alternative localhost
        "https://localhost:3000",  # HTTPS version if used
    ]
)

# Important: Never use CORS_ALLOW_ALL_ORIGINS=True when using credentials
CORS_ALLOW_ALL_ORIGINS = False

# Allow credentials (cookies, authorization headers) in CORS requests
CORS_ALLOW_CREDENTIALS = True

# CORS headers that can be used during the actual request
CORS_ALLOW_HEADERS = [
    'accept',
    'accept-encoding',
    'authorization',
    'content-type',
    'dnt',
    'origin',
    'user-agent',
    'x-csrftoken',
    'x-requested-with',
]

# Methods that are allowed for CORS requests
CORS_ALLOW_METHODS = [
    'DELETE',
    'GET',
    'OPTIONS',
    'PATCH',
    'POST',
    'PUT',
]

# Additional CORS settings for better debugging and security
CORS_PREFLIGHT_MAX_AGE = 86400  # 24 hours
CORS_EXPOSE_HEADERS = [
    'Content-Type',
    'Authorization',
]

# Redis Caching Configuration
REDIS_URL = env("REDIS_URL", default="redis://localhost:6379")

CACHES = {
    "default": {
        "BACKEND": "django_redis.cache.RedisCache",
        "LOCATION": REDIS_URL,  # Full Redis Cloud URL
        "OPTIONS": {
            "CLIENT_CLASS": "django_redis.client.DefaultClient",
            "SSL": False,  # Redis Cloud port 17903 uses plain TCP (SSL available on other ports)
            "IGNORE_EXCEPTIONS": True,
        },
        "TIMEOUT": 3600,
    },
    "sessions": {
        "BACKEND": "django_redis.cache.RedisCache",
        "LOCATION": REDIS_URL,  # Full Redis Cloud URL
        "OPTIONS": {
            "CLIENT_CLASS": "django_redis.client.DefaultClient",
            "SSL": False,
        },
        "TIMEOUT": 86400,
    },
    "analysis": {
        "BACKEND": "django_redis.cache.RedisCache",
        "LOCATION": REDIS_URL,  # Full Redis Cloud URL
        "OPTIONS": {
            "CLIENT_CLASS": "django_redis.client.DefaultClient",
            "SSL": False,
        },
        "TIMEOUT": 7200,
    },
}

# Sessions
SESSION_ENGINE = "django.contrib.sessions.backends.cache"
SESSION_CACHE_ALIAS = "sessions"
SESSION_COOKIE_AGE = 86400
SESSION_SAVE_EVERY_REQUEST = False
SESSION_EXPIRE_AT_BROWSER_CLOSE = False

# Cache middleware configuration
CACHE_MIDDLEWARE_ALIAS = 'default'
CACHE_MIDDLEWARE_SECONDS = 300  # 5 minutes
CACHE_MIDDLEWARE_KEY_PREFIX = 'earth_obs_page'

# Logging
# Use different log levels based on environment
# Development: INFO level shows all details
# Production: WARNING level only shows warnings and errors
LOG_LEVEL = env("LOG_LEVEL", default="WARNING" if not DEBUG else "INFO")

LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "formatters": {
        "verbose": {
            "format": "{levelname} {asctime} {module} {message}",
            "style": "{",
        },
        "simple": {
            "format": "{levelname} {message}",
            "style": "{",
        },
    },
    "handlers": {
        "file": {
            "level": LOG_LEVEL,
            "class": "logging.FileHandler",
            "filename": BASE_DIR / "logs" / "django.log",
            "formatter": "verbose",
            "encoding": "utf-8",
        },
        "console": {
            "level": LOG_LEVEL,
            "class": "logging.StreamHandler",
            "formatter": "simple" if not DEBUG else "verbose",
        },
    },
    "root": {
        "handlers": ["console", "file"],
        "level": LOG_LEVEL,
    },
    "loggers": {
        "django": {
            "handlers": ["console", "file"],
            "level": "WARNING" if not DEBUG else "INFO",  # Reduce Django's verbosity in production
            "propagate": False,
        },
        "apps": {
            "handlers": ["console", "file"],
            "level": LOG_LEVEL,
            "propagate": False,
        },
        # Silence specific noisy loggers in production
        "django.server": {
            "handlers": ["console"],
            "level": "ERROR" if not DEBUG else "INFO",
            "propagate": False,
        },
        "django.request": {
            "handlers": ["console", "file"],
            "level": "ERROR",  # Only log request errors
            "propagate": False,
        },
    },
}

# Custom User Model
AUTH_USER_MODEL = "core.User"

# Create logs directory
LOGS_DIR = BASE_DIR / "logs"
LOGS_DIR.mkdir(exist_ok=True)

# AI Assistant Configuration
GEMINI_API_KEY = env("GEMINI_API_KEY", default=None)
AI_PROVIDER = env("AI_PROVIDER", default="gemini")  # gemini only
AI_ASSISTANT_ENABLED = env.bool("AI_ASSISTANT_ENABLED", default=True)
AI_ASSISTANT_MAX_TOKENS = env.int("AI_ASSISTANT_MAX_TOKENS", default=5000)
AI_ASSISTANT_TEMPERATURE = env.float("AI_ASSISTANT_TEMPERATURE", default=0.7)
AI_ASSISTANT_MODEL = env("AI_ASSISTANT_MODEL", default="gemini-2.5-flash")  # Gemini model

# ============================================
# SECURITY SETTINGS
# ============================================
# Comprehensive security configuration addressing OWASP ZAP findings

# Cookie Security
SESSION_COOKIE_SECURE = not DEBUG
SESSION_COOKIE_HTTPONLY = True
SESSION_COOKIE_SAMESITE = 'Lax'
CSRF_COOKIE_SECURE = not DEBUG
CSRF_COOKIE_HTTPONLY = True
CSRF_COOKIE_SAMESITE = 'Lax'

# CSRF Trusted Origins
CSRF_TRUSTED_ORIGINS = [
    'https://earthobservation.azurewebsites.net',
    'https://earthobservationapi.azurewebsites.net',
    'http://localhost:3000',
    'http://localhost:8000',
]

# Security Headers
SECURE_BROWSER_XSS_FILTER = True
SECURE_CONTENT_TYPE_NOSNIFF = True
SECURE_HSTS_SECONDS = 31536000 if not DEBUG else 0
SECURE_HSTS_INCLUDE_SUBDOMAINS = True
SECURE_HSTS_PRELOAD = True
SECURE_SSL_REDIRECT = False
SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')
X_FRAME_OPTIONS = 'SAMEORIGIN'
SECURE_REFERRER_POLICY = 'strict-origin-when-cross-origin'

