"""
WSGI config for geoanalysis project.
"""

import os

from django.core.wsgi import get_wsgi_application

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "geoanalysis.settings")

application = get_wsgi_application()

# Importing the URLconf loads the heavy geospatial libraries, so do it now, not on the first request
import geoanalysis.urls  # noqa: E402,F401
