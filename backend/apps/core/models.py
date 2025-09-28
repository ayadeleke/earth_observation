from django.contrib.auth.models import AbstractUser
from django.db import models


class User(AbstractUser):
    """Extended user model"""

    email = models.EmailField(unique=True)
    earth_engine_project_id = models.CharField(max_length=255, blank=True, null=True)
    is_earth_engine_authenticated = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = ["username"]


class AnalysisProject(models.Model):
    """Project model to group related analyses"""

    name = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="projects")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.name} - {self.user.username}"


class GeometryInput(models.Model):
    """Model to store user-defined geometries"""

    name = models.CharField(max_length=255)
    geometry_data = models.JSONField()  # Store geometry as GeoJSON
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="geometries")
    project = models.ForeignKey(
        AnalysisProject,
        on_delete=models.CASCADE,
        related_name="geometries",
        null=True,
        blank=True,
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.name} - {self.user.username}"


class FileUpload(models.Model):
    """Model to handle file uploads (shapefiles, etc.)"""

    UPLOAD_TYPE_CHOICES = [
        ("shapefile", "Shapefile"),
        ("geojson", "GeoJSON"),
        ("kml", "KML"),
    ]

    name = models.CharField(max_length=255)
    file = models.FileField(upload_to="uploads/%Y/%m/%d/")
    upload_type = models.CharField(max_length=20, choices=UPLOAD_TYPE_CHOICES)
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="files")
    processed = models.BooleanField(default=False)
    geometry_extracted = models.JSONField(null=True, blank=True)  # Store as GeoJSON
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.name} - {self.upload_type}"
