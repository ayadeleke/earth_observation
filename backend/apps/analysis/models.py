from django.db import models
from apps.core.models import User, AnalysisProject


class AnalysisRequest(models.Model):
    """Model to store analysis requests and their parameters"""

    ANALYSIS_TYPE_CHOICES = [
        ("ndvi", "NDVI Analysis"),
        ("lst", "Land Surface Temperature"),
        ("backscatter", "SAR Backscatter Analysis"),
        ("sentinel1", "Sentinel-1 SAR"),
        ("sentinel2", "Sentinel-2 NDVI"),
        ("comprehensive", "Comprehensive Analysis"),
    ]

    SATELLITE_CHOICES = [
        ("landsat", "Landsat"),
        ("sentinel", "Sentinel"),
        ("sentinel1", "Sentinel-1 SAR"),
        ("sentinel2", "Sentinel-2 MSI"),
    ]

    STATUS_CHOICES = [
        ("pending", "Pending"),
        ("processing", "Processing"),
        ("completed", "Completed"),
        ("failed", "Failed"),
    ]

    user = models.ForeignKey(
        User, on_delete=models.CASCADE, related_name="analyses", null=True, blank=True
    )
    project = models.ForeignKey(
        AnalysisProject,
        on_delete=models.CASCADE,
        related_name="analyses",
        null=True,
        blank=True,
    )

    # Analysis parameters
    name = models.CharField(max_length=255)
    analysis_type = models.CharField(max_length=20, choices=ANALYSIS_TYPE_CHOICES)
    satellite = models.CharField(
        max_length=20, choices=SATELLITE_CHOICES, default="landsat"
    )
    geometry_data = models.JSONField()  # Store geometry as GeoJSON

    # Date parameters
    start_date = models.DateField()
    end_date = models.DateField()

    # Analysis settings
    cloud_cover = models.IntegerField(default=20)
    use_cloud_masking = models.BooleanField(default=True)
    strict_masking = models.BooleanField(default=False)
    selected_images = models.JSONField(
        null=True, blank=True
    )  # Store selected image indices

    # SAR-specific settings
    POLARIZATION_CHOICES = [
        ("VV", "VV Polarization"),
        ("VH", "VH Polarization"),
        ("both", "Both VV and VH"),
    ]
    polarization = models.CharField(
        max_length=10, choices=POLARIZATION_CHOICES, default="VV", null=True, blank=True
    )

    # Status and results
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="pending")
    progress = models.IntegerField(default=0)  # Progress percentage
    error_message = models.TextField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    completed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.name} - {self.analysis_type} - {self.user.username}"


class AnalysisResult(models.Model):
    """Model to store analysis results"""

    analysis_request = models.OneToOneField(
        AnalysisRequest, on_delete=models.CASCADE, related_name="result"
    )

    # Result data (JSON format)
    data = models.JSONField()
    statistics = models.JSONField(null=True, blank=True)

    # Generated files
    plot_file = models.FileField(
        upload_to="results/plots/%Y/%m/%d/", null=True, blank=True
    )
    csv_file = models.FileField(
        upload_to="results/csv/%Y/%m/%d/", null=True, blank=True
    )
    map_file = models.FileField(
        upload_to="results/maps/%Y/%m/%d/", null=True, blank=True
    )

    # Metadata
    total_observations = models.IntegerField(default=0)
    date_range_covered = models.CharField(max_length=100, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"Result for {self.analysis_request.name}"


class ImageCollection(models.Model):
    """Model to store information about image collections used in analysis"""

    analysis_request = models.ForeignKey(
        AnalysisRequest, on_delete=models.CASCADE, related_name="image_collections"
    )

    collection_name = models.CharField(max_length=255)  # e.g., "LANDSAT/LC08/C02/T1_L2"
    total_images = models.IntegerField()
    images_used = models.IntegerField()
    date_range = models.CharField(max_length=100)
    cloud_cover_range = models.CharField(max_length=100, blank=True)

    # Store image metadata as JSON
    image_metadata = models.JSONField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.collection_name} - {self.total_images} images"
