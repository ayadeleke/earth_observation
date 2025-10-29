FROM python:3.10-slim

# Set environment variables
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

# Install system dependencies (minimized)
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        postgresql-client \
        gdal-bin \
        libgdal-dev \
        libpq-dev \
        gcc \
    && rm -rf /var/lib/apt/lists/* \
    && apt-get clean

# Install Python dependencies (production only)
COPY requirements.prod.txt /tmp/
RUN pip install --no-cache-dir -r /tmp/requirements.prod.txt \
    && pip install --no-cache-dir gunicorn \
    && rm /tmp/requirements.prod.txt

# Set work directory
WORKDIR /app

# Copy only necessary application files
COPY manage.py /app/
COPY geoanalysis/ /app/geoanalysis/
COPY apps/ /app/apps/
COPY auth/ /app/auth/
COPY tests/ /app/tests/
COPY support/ /app/support/

# Create directories for runtime
RUN mkdir -p /app/staticfiles /app/media /app/logs

# Expose port
EXPOSE 8000

# Use gunicorn for production instead of development server
RUN pip install --no-cache-dir gunicorn

# Command to run the application
# Increased timeout to 300s (5 min) for long-running SAR/NDVI analysis
# Workers=2 for better handling of concurrent requests
# Max requests with jitter for memory management
CMD ["gunicorn", \
     "--bind", "0.0.0.0:8000", \
     "--workers", "2", \
     "--timeout", "300", \
     "--graceful-timeout", "30", \
     "--max-requests", "1000", \
     "--max-requests-jitter", "50", \
     "--worker-class", "sync", \
     "geoanalysis.wsgi:application"]