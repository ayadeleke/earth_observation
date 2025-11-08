# Earth Observation Analysis Platform

The Earth Observation Analysis Platform is a full-stack application designed for geospatial analysis and environmental monitoring using Google Earth Engine, providing NDVI (Normalized Difference Vegetation Index), LST (Land Surface Temperature), and SAR (Synthetic Aperture Radar) backscatter analysis capabilities.. It integrates multiple satellite data sources including Landsat, Sentinel-1, and Sentinel-2 to provide comprehensive Earth observation capabilities.

### Key Features

- **Multi-Satellite Support**: Landsat (5, 7, 8, 9), Sentinel-1, and Sentinel-2 data processing
- **Advanced Analytics**: 
  - NDVI analysis for vegetation monitoring
  - LST analysis using thermal bands
  - SAR backscatter analysis for surface roughness and moisture detection
- **Cloud Masking**: Advanced cloud filtering with basic and strict masking options
- **Shapefile Upload**: Support for custom area-of-interest definition
- **Interactive Visualization**: Dynamic maps, time series charts, and data tables
- **Historical Data**: Analysis from 1988 onwards with multi-mission Landsat harmonization
- **Export Capabilities**: Data export to CSV and interactive map generation
- **Security**: Comprehensive security headers (CSP, HSTS, X-Frame-Options)
- **Cloud Deployment**: Azure deployment with Docker image containerization

## Scientific Methodology

### Analysis Algorithms

This platform implements scientifically validated remote sensing algorithms for environmental monitoring:

#### 1. Normalized Difference Vegetation Index (NDVI)

**Formula** by Rouse et al. (1973):

```
NDVI = (ρNIR – ρR) / (ρNIR + ρR)
```

**Where**:
- `ρNIR` = Near-Infrared spectral reflectance (Landsat 8/9 Band 5)
- `ρR` = Red spectral reflectance (Landsat 8/9 Band 4)

**Reference**:
- Rouse, J. W., Haas, R. H., Schell, J. A., & Deering, D. W. (1973). *Monitoring vegetation systems in the Great Plains with ERTS*. Third Earth Resources Technology Satellite-1 Symposium, Vol. 1, pp. 309-317 https://files.core.ac.uk/download/pdf/42887948.pdf.

#### 2. Land Surface Temperature (LST)

**Formula** by Deliry (2023)

```
LST = (ST_B10 × 0.00341802) + 149.0 - 273.15
```

**Where**:
- `ST_B10` = Thermal Infrared Band of Landsat 9 image (Band 10)
- `0.00341802` = Multiplicative rescaling factor
- `149.0` = Additive rescaling factor (constant offset value)
- `273.15` = Conversion from Kelvin to Celsius


**Reference**:
- Deliry, S. I. (2023). Re: Hi, I want to calculate LST from Landsat Collection 2 Level-2? 
What need I do?. Retrieved from: 
https://www.researchgate.net/post/Hi_I_want_to_calculate_LST_from_Landsat_Collection_2_Level-2_What_need_I_do/64db3515357c5c4c9c03aaba/citation/download..

### Cloud Masking Methodology

The platform implements two cloud masking strategies for optical imagery:

**Basic Cloud Masking**:
- Uses QA_PIXEL band thresholding
- Removes high-confidence clouds and cloud shadows
- Threshold: `cloudMask < 5%`

**Strict Cloud Masking**:
- Applies Fmask algorithm
- Removes all cloud-related pixels including cirrus
- Combines multiple QA bits for comprehensive filtering
- Threshold: `cloudMask < 2%`

### Data Sources

| Satellite | Sensors | Spatial Resolution | Temporal Coverage | Analysis Types |
|-----------|---------|-------------------|-------------------|----------------|
| **Landsat 5** | TM | 30m (optical), 120m (thermal) | 1984-2013 | NDVI, LST |
| **Landsat 7** | ETM+ | 30m (optical), 60m (thermal) | 1999-present | NDVI, LST |
| **Landsat 8** | OLI, TIRS | 30m (optical), 100m (thermal) | 2013-present | NDVI, LST |
| **Landsat 9** | OLI-2, TIRS-2 | 30m (optical), 100m (thermal) | 2021-present | NDVI, LST |
| **Sentinel-1** | C-SAR | 10m (IW mode) | 2014-present | SAR Backscatter |
| **Sentinel-2** | MSI | 10m/20m/60m | 2015-present | NDVI (future) |

**[Link to project GitHub repo](https://github.com/ayadeleke/earth_observation.git)**

## Prototype Presentation

Watch project prototype demonstration showcasing the platform's capabilities:

[![Earth Observation Platform Prototype Demo](https://img.youtube.com/vi/DW72FsNV2z4/maxresdefault.jpg)](https://youtu.be/DW72FsNV2z4)

**[View Prototype Demonstration](https://youtu.be/DW72FsNV2z4)**

The video demonstrates:
- Platform overview and user interface
- NDVI, LST, and SAR analysis workflows
- Interactive mapping and data visualization
- Export and analysis capabilities

## Live Deployment

**Access the deployed application:**
- **Frontend**: [https://earthobservation.azurewebsites.net](https://earthobservation.azurewebsites.net)
- **Backend API**: [https://earthobservationapi.azurewebsites.net](https://earthobservationapi.azurewebsites.net)
- **API Documentation**: [https://earthobservationapi.azurewebsites.net/api/swagger](https://earthobservationapi.azurewebsites.net/api/swagger/)

## Final Version of Product Demo

Watch the final/live product demonstration showcasing the platform's functionalities:

[![Earth Observation Platform Final Version Demo](https://img.youtube.com/vi/VLrtc4yCDSk/maxresdefault.jpg)](https://youtu.be/VLrtc4yCDSk)

**[View Live Product Demonstration](https://youtu.be/VLrtc4yCDSk)**


## Screenshots

### Main Dashboard
![Landing Page](screenshots/landing_page.png)
*The first page of the Application where user choose to try the application or authentical by registering or login*

### Analysis Configuration
![Analysis Demo Page](screenshots/demo_page.png)
*Parameter configuration panel with date range selection, satellite options, and cloud masking settings*
*The main interface showing the analysis selection panel, interactive map, and configuration options*

### User Project Dashboard
![User Dashboard](screenshots/user_dashboard.png)
*List of User's existing project are here or new project is created from here*

### LST Analysis Results
![Sample LST Results](screenshots/lst_results.png)
*Land surface temperature analysis with map and trends*

### NDVI Analysis Results
![Sample NDVI Results](screenshots/ndvi_results.png)
*NDVI analysis with map and trends*

### Technology Stack

**Backend:**
- Django 4.2.7 (Python web framework)
- Django REST Framework (API development)
- Google Earth Engine API (satellite data processing)
- GeoPandas & Shapely (geospatial operations)
- PostgreSQL (database)
- Redis (Caching)
- Shapely (Geometry manipulations)
- Folium (interactive map generation)

**Frontend:**
- React 18.2.0 with TypeScript
- Bootstrap CSS (styling)
- Leaflet & React-Leaflet (interactive maps)
- Recharts (data visualization)
- Axios (HTTP client)
- Framer Motion ()

**Infrastructure:**
- Docker & Docker Compose (containerization)
- Azure App Service (Cloud hosting)
- Azure Container Registry (Docker image registry)
- Azure Blob Storage (File storage)
- Nginx (Reverse proxy & SSL termination)


## Setup Instructions

### Prerequisites

- Python 3.10+
- Node.js 18+
- PostgreSQL 14+
- Google Earth Engine account with service account credentials
- Docker 20.10 or higher
- Git

### 1. Clone the Repository

```bash
git clone <https://github.com/ayadeleke/earth_observation.git>
cd "earth observation working"
```

### 2. Backend Setup

#### Environment Configuration
```bash
cd backend
cp .env.example .env
```

Edit the `.env` file with your configuration:
```bash
# Django Configuration
DEBUG=True
SECRET_KEY=your-super-secret-key-min-50-characters-change-in-production
ALLOWED_HOSTS=localhost,127.0.0.1,your-domain.com

# Database Configuration (PostgreSQL)
DATABASE_URL=postgres://username:password@localhost:5432/geoanalysis
DB_NAME=geoanalysis
DB_USER=postgres
DB_PASSWORD=your-secure-password
DB_HOST=localhost
DB_PORT=5432

# Earth Engine Configuration
EARTH_ENGINE_PROJECT=your-ee-project-id
EARTH_ENGINE_SERVICE_ACCOUNT_KEY=/path/to/service_account.json
# Or use base64 encoded key:
EARTH_ENGINE_SERVICE_ACCOUNT_KEY_BASE64=base64-encoded-json-key
EARTH_ENGINE_USE_SERVICE_ACCOUNT=True

# CORS Configuration
CORS_ALLOWED_ORIGINS=http://localhost:3000,http://127.0.0.1:3000

# Azure Blob Storage
USE_AZURE_STORAGE=False
AZURE_ACCOUNT_NAME=your-storage-account
AZURE_ACCOUNT_KEY=your-storage-key
AZURE_CONTAINER=media

# Redis (for caching)
REDIS_URL=redis://localhost:6379

# Security (Production)
SECURE_SSL_REDIRECT=False
SESSION_COOKIE_SECURE=False
CSRF_COOKIE_SECURE=False
```

#### Google Earth Engine Setup
1. Create a Google Earth Engine project at [https://earthengine.google.com/](https://earthengine.google.com/)
2. Create a service account and download the JSON key
3. Place the service account key in `backend/auth/service_account.json`
4. Update the `EARTH_ENGINE_PROJECT_ID` in your `.env` file

#### Python Environment
```bash
# Create virtual environment
python -m venv .venv

# Activate virtual environment
# On Windows:
.venv\Scripts\activate
# On macOS/Linux:
source .venv/bin/activate

# Install dependencies
pip install -r requirements.txt
```

#### Database Setup
```bash
# Create database (ensure PostgreSQL is running)
createdb geoanalysis

# Or using psql:
psql -U postgres
CREATE DATABASE geoanalysis;
\q

# Run migrations
python manage.py makemigrations
python manage.py migrate

# Create superuser (optional)
python manage.py createsuperuser

# Collect static files
python manage.py collectstatic --noinput
```

#### Start Backend Server
```bash
python manage.py runserver 8000
```

### 3. Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Start development server
npm start
```

The frontend will be available at `http://localhost:3000`

### 4. Docker Setup (Alternative)

For containerized deployment:

```bash
# Backend
cd backend
docker build -t earth-observation-backend .
docker run -p 8000:8000 --env-file .env earth-observation-backend

# Frontend
cd frontend
docker build -t earth-observation-frontend .
docker run -p 3000:3000 earth-observation-frontend
```

## Testing Strategy

### Test Coverage Summary

The platform implements comprehensive testing across multiple layers to ensure reliability, security, and performance.

| Test Type | Coverage | Tools | Status |
|-----------|----------|-------|--------|
| **Integration Tests** | 97% | Django TestCase | Passing (12/12) |
| **Unit Tests** | Backend APIs | pytest, Django test | Passing |
| **Performance Tests** | Database & API | Django TestCase | Passing |
| **Security Tests** | SQL Injection, XSS, Auth | Django TestCase | Passing |
| **E2E Tests** | User workflows | Manual testing | Verified |

#### Test Execution

```bash
# Run all integration tests
python manage.py test tests.test_integration

# Run with coverage report
python -m coverage run --source='apps,tests' manage.py test tests.test_integration
python -m coverage report
python -m coverage html

# Run Load test
locust -f backend/tests/performance/locustfile.py
```

![Integration Test Result Screenshot](screenshots/integration.png)

![Load Testing Chart](screenshots/locust.png)

![Penetration Test from Pentesttool](screenshots/pentest.png)

![Security Testing from Zap screenshot](screenshots/zap_result.png)

###

## Deployment
![Deployment Plan](screenshots/deployment_plan.png)

### Production Environment Setup

#### 1. Infrastructure Requirements

**Server Specifications:**
- **CPU**: 4+ cores (8+ recommended for heavy processing)
- **RAM**: 8GB minimum (32GB recommended)
- **Storage**: 100GB+ SSD for application and data storage
- **Network**: High-bandwidth connection for Earth Engine API calls

**Services:**
- **Web Server**: Nginx (reverse proxy and static file serving)
- **Application Server**: Gunicorn (WSGI server for Django)
- **Database**: PostgreSQL 14+ with PostGIS extension
- **Caching**: Redis (optional, for session storage and caching)

#### 2. Environment Configuration

**Production Backend (.env.production):**
```bash
DEBUG=False
SECRET_KEY=super-secure-production-key-256-characters
ALLOWED_HOSTS=yourdomain.com,www.yourdomain.com

# Database
DB_NAME=geoanalysis_prod
DB_USER=geoapp_user
DB_PASSWORD=secure-database-password
DB_HOST=db-server
DB_PORT=5432

# Earth Engine
EARTH_ENGINE_PROJECT_ID=your-production-ee-project
EARTH_ENGINE_SERVICE_ACCOUNT_KEY=/app/auth/service_account.json

# Security
CORS_ALLOWED_ORIGINS=https://yourdomain.com,https://www.yourdomain.com
SECURE_SSL_REDIRECT=True
SECURE_BROWSER_XSS_FILTER=True
SECURE_CONTENT_TYPE_NOSNIFF=True
```

#### 3. Docker Compose Production

Create `docker-compose.prod.yml`:
```yaml
version: '3.8'

services:
  db:
    image: postgis/postgis:14-3.2
    environment:
      POSTGRES_DB: geoanalysis_prod
      POSTGRES_USER: geoapp_user
      POSTGRES_PASSWORD: secure-database-password
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"

  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile.prod
    environment:
      - DEBUG=False
    env_file:
      - ./backend/.env.production
    volumes:
      - static_volume:/app/staticfiles
      - media_volume:/app/media
      - ./backend/auth:/app/auth
    depends_on:
      - db
    ports:
      - "8000:8000"

  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile.prod
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - REACT_APP_API_URL=https://yourdomain.com/api

  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
      - static_volume:/static
      - media_volume:/media
      - ./ssl:/etc/nginx/ssl
    depends_on:
      - backend
      - frontend

volumes:
  postgres_data:
  static_volume:
  media_volume:
```

#### 4. Nginx Configuration

Create `nginx.conf`:
```nginx
events {
    worker_connections 1024;
}

http {
    upstream backend {
        server backend:8000;
    }

    upstream frontend {
        server frontend:3000;
    }

    server {
        listen 80;
        server_name yourdomain.com www.yourdomain.com;
        return 301 https://$server_name$request_uri;
    }

    server {
        listen 443 ssl http2;
        server_name yourdomain.com www.yourdomain.com;

        ssl_certificate /etc/nginx/ssl/cert.pem;
        ssl_certificate_key /etc/nginx/ssl/key.pem;

        # Frontend
        location / {
            proxy_pass http://frontend;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
        }

        # Backend API
        location /api/ {
            proxy_pass http://backend;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }

        # Static files
        location /static/ {
            alias /static/;
            expires 30d;
        }

        # Media files
        location /media/ {
            alias /media/;
            expires 30d;
        }
    }
}
```

#### 5. Deployment Steps

**Initial Deployment:**
```bash
# 1. Server setup
sudo apt update && sudo apt upgrade -y
sudo apt install docker docker-compose nginx postgresql-client

# 2. Clone repository
git clone <repository-url> /opt/earth-observation
cd /opt/earth-observation

# 3. Environment configuration
cp backend/.env.example backend/.env.production
# Edit production environment variables

# 4. SSL certificates (Let's Encrypt)
sudo apt install certbot
sudo certbot certonly --standalone -d yourdomain.com

# 5. Build and start services
docker-compose -f docker-compose.prod.yml up --build -d

# 6. Database migration
docker-compose -f docker-compose.prod.yml exec backend python manage.py migrate

# 7. Collect static files
docker-compose -f docker-compose.prod.yml exec backend python manage.py collectstatic --noinput
```

**Update Deployment:**
```bash
# 1. Pull latest changes
git pull origin main

# 2. Rebuild and restart services
docker-compose -f docker-compose.prod.yml up --build -d

# 3. Run migrations if needed
docker-compose -f docker-compose.prod.yml exec backend python manage.py migrate
```

#### 6. Monitoring and Maintenance

**Health Checks:**
- Set up monitoring for Django application health
- Monitor PostgreSQL database performance
- Track Earth Engine API quota usage
- Monitor disk space for uploaded files and generated maps

**Backup Strategy:**
- Daily database backups
- Weekly full system backups
- Backup uploaded shapefiles and generated outputs

**Security Considerations:**
- Regular security updates
- Firewall configuration
- SSL certificate renewal
- API rate limiting
- Input validation and sanitization

#### 7. Conclusion & Scaling Considerations
- This prototype demonstrates the core functionality of the Earth Observation App. Future work will focus on expanding features and scaling deployment.

**Horizontal Scaling:**
- Load balancer for multiple backend instances
- Database read replicas
- CDN for static file delivery
- Caching layer with Redis

**Performance Optimization:**
- Earth Engine request caching
- Database query optimization
- Frontend code splitting and lazy loading
- Image compression for map outputs

## Usage

1. **Access the Application**: Navigate to `http://localhost:3000`
2. **Select Analysis Type**: Choose between NDVI, LST, or SAR analysis
3. **Define Area of Interest**: Use the map interface or upload a shapefile
4. **Configure Parameters**: Set date range, cloud cover threshold, and masking options
5. **Run Analysis**: Execute the analysis and view results in tables and charts
6. **Export Data**: Download CSV files or interactive maps

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the **MIT License** - see the [LICENSE](LICENSE) file for details.

### Third-Party Licenses

- **Google Earth Engine**: [Google Earth Engine Terms of Service](https://earthengine.google.com/terms/)
- **Landsat Data**: Public domain (U.S. Government)
- **Sentinel Data**: Copernicus Sentinel data (ESA) - open and free
- **Leaflet**: BSD 2-Clause License
- **React**: MIT License
- **Django**: BSD 3-Clause License

## Support

For support and questions:
- a.adeleke@alustudent.com
- Create an issue on GitHub
- Review the Earth Engine API documentation

## Acknowledgments

This project was developed as part of academic research on **Earth Observation for Forest Monitoring in Nigeria** in fulfilment of undergraduate Capstone project at the African Leadership University.

**Credits:**
- **Google Earth Engine Team**: For providing free access to petabytes of satellite data
- **USGS**: For Landsat mission data
- **ESA**: For Sentinel mission data
- **Project Supervisor**: For guidance and support
- **Open Source Community**: For the amazing tools and libraries

#
