"""
WSGI config for geoanalysis project.
"""

import os

from django.core.wsgi import get_wsgi_application

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "geoanalysis.settings")

application = get_wsgi_application()
