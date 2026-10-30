from datetime import timedelta
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.response import Response
from rest_framework.test import APIClient, APITestCase

from . import jobs
from .models import AnalysisJob

User = get_user_model()


def run_worker(view):
    """Run the queue in this thread, with a fake analysis view."""
    with patch.object(jobs, "_endpoints", return_value={"ndvi": ("/analysis/process_ndvi/", view)}), \
            patch.object(jobs, "connection"), patch.object(jobs, "close_old_connections"), \
            patch.object(jobs, "_beat"):
        jobs._active_workers += 1
        jobs._work()


class AnalysisJobTest(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(email="a@example.com", username="a", password="test_password_123!")
        self.other = User.objects.create_user(email="b@example.com", username="b", password="test_password_123!")
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)
        patcher = patch.object(jobs, "ensure_workers")
        patcher.start()
        self.addCleanup(patcher.stop)

    def create_job(self, **fields):
        return AnalysisJob.objects.create(user=self.user, analysis_type="ndvi", payload={"a": 1}, **fields)

    def detail(self, job):
        return reverse("analysis:analysis_job_detail", kwargs={"job_id": job.pk})

    def test_create_requires_auth(self):
        self.client.force_authenticate(user=None)
        response = self.client.post(reverse("analysis:analysis_job_create"), {"analysis_type": "ndvi"}, format="json")
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_create_queues_job(self):
        response = self.client.post(reverse("analysis:analysis_job_create"), {"analysis_type": "ndvi"}, format="json")
        self.assertEqual(response.status_code, status.HTTP_202_ACCEPTED)
        self.assertEqual(AnalysisJob.objects.get().status, AnalysisJob.QUEUED)

    def test_unknown_type_is_rejected(self):
        response = self.client.post(reverse("analysis:analysis_job_create"), {"analysis_type": "x"}, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_active_job_limit(self):
        self.create_job()
        self.create_job(status=AnalysisJob.RUNNING)
        response = self.client.post(reverse("analysis:analysis_job_create"), {"analysis_type": "ndvi"}, format="json")
        self.assertEqual(response.status_code, status.HTTP_429_TOO_MANY_REQUESTS)

    def test_only_owner_can_read_job(self):
        job = self.create_job()
        self.client.force_authenticate(user=self.other)
        self.assertEqual(self.client.get(self.detail(job)).status_code, status.HTTP_404_NOT_FOUND)

    def test_worker_completes_job_as_its_owner(self):
        job = self.create_job()
        seen = {}

        def view(request):
            seen["user"] = request._force_auth_user
            return Response({"success": True, "rows": 3})

        run_worker(view)
        response = self.client.get(self.detail(job))
        self.assertEqual(seen["user"], self.user)
        self.assertEqual(response.data["status"], AnalysisJob.COMPLETED)
        self.assertEqual(response.data["result"], {"success": True, "rows": 3})

    def test_worker_records_failure(self):
        job = self.create_job()
        run_worker(lambda request: Response({"error": "No images"}, status=500))
        response = self.client.get(self.detail(job))
        self.assertEqual(response.data["status"], AnalysisJob.FAILED)
        self.assertEqual(response.data["error"], "No images")

    def test_interrupted_job_is_retried_then_failed(self):
        old = timezone.now() - timedelta(minutes=5)
        retry = self.create_job(status=AnalysisJob.RUNNING, attempts=1, heartbeat_at=old)
        give_up = self.create_job(status=AnalysisJob.RUNNING, attempts=2, heartbeat_at=old)
        jobs.recover_stale_jobs()
        retry.refresh_from_db()
        give_up.refresh_from_db()
        self.assertEqual(retry.status, AnalysisJob.QUEUED)
        self.assertEqual(give_up.status, AnalysisJob.FAILED)

    def test_live_job_is_left_alone(self):
        job = self.create_job(status=AnalysisJob.RUNNING, attempts=1, heartbeat_at=timezone.now())
        jobs.recover_stale_jobs()
        job.refresh_from_db()
        self.assertEqual(job.status, AnalysisJob.RUNNING)
