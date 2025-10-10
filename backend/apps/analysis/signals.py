"""
Signals for updating project timestamps when analyses are modified
"""

from django.db.models.signals import post_save, post_delete
from django.dispatch import receiver
from django.utils import timezone
from .models import AnalysisRequest, AnalysisResult


@receiver(post_save, sender=AnalysisRequest)
def update_project_timestamp_on_analysis_save(sender, instance, created, **kwargs):
    """Update the project's updated_at timestamp when an analysis is created or updated"""
    if instance.project:
        # Update the project's updated_at timestamp
        instance.project.updated_at = timezone.now()
        instance.project.save(update_fields=['updated_at'])


@receiver(post_delete, sender=AnalysisRequest)
def update_project_timestamp_on_analysis_delete(sender, instance, **kwargs):
    """Update the project's updated_at timestamp when an analysis is deleted"""
    if instance.project:
        # Update the project's updated_at timestamp
        instance.project.updated_at = timezone.now()
        instance.project.save(update_fields=['updated_at'])


@receiver(post_save, sender=AnalysisResult)
def update_project_timestamp_on_result_save(sender, instance, created, **kwargs):
    """Update the project's updated_at timestamp when an analysis result is created or updated"""
    if instance.analysis_request and instance.analysis_request.project:
        # Update the project's updated_at timestamp
        instance.analysis_request.project.updated_at = timezone.now()
        instance.analysis_request.project.save(update_fields=['updated_at'])