"""Endpoints that queue analyses and report their progress."""

from rest_framework import status
from rest_framework.authentication import SessionAuthentication
from rest_framework.decorators import api_view, authentication_classes, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework_simplejwt.authentication import JWTAuthentication

from apps.core.permissions import CanPerformAnalysis

from . import jobs
from .models import AnalysisJob

MAX_ACTIVE_JOBS_PER_USER = 2


@api_view(["POST"])
@authentication_classes([JWTAuthentication, SessionAuthentication])
@permission_classes([CanPerformAnalysis])
def create_analysis_job(request):
    """Queue an analysis. The body is what the matching process_* endpoint accepts, plus analysis_type."""
    analysis_type = request.data.get("analysis_type")
    if not jobs.supported_type(analysis_type):
        return Response({"error": "Unknown analysis type"}, status=status.HTTP_400_BAD_REQUEST)

    active = AnalysisJob.objects.filter(
        user=request.user, status__in=[AnalysisJob.QUEUED, AnalysisJob.RUNNING]
    )
    if active.count() >= MAX_ACTIVE_JOBS_PER_USER:
        return Response(
            {"error": "Please wait for your running analyses to finish."},
            status=status.HTTP_429_TOO_MANY_REQUESTS,
        )

    job = AnalysisJob.objects.create(user=request.user, analysis_type=analysis_type, payload=request.data)
    jobs.recover_stale_jobs()
    jobs.ensure_workers()
    return Response({"job_id": job.pk, "status": job.status}, status=status.HTTP_202_ACCEPTED)


@api_view(["GET"])
@authentication_classes([JWTAuthentication, SessionAuthentication])
@permission_classes([IsAuthenticated])
def get_analysis_job(request, job_id):
    """Report a job's progress. Only its owner can see it."""
    job = AnalysisJob.objects.filter(pk=job_id, user=request.user).first()
    if job is None:
        return Response({"error": "Job not found"}, status=status.HTTP_404_NOT_FOUND)

    # Restarts leave jobs with no worker, and polling is what picks them up again
    jobs.recover_stale_jobs()
    jobs.ensure_workers()

    body = {"job_id": job.pk, "status": job.status}
    if job.status == AnalysisJob.COMPLETED:
        body["result"] = job.result
    elif job.status == AnalysisJob.FAILED:
        body["error"] = job.error
    return Response(body)
