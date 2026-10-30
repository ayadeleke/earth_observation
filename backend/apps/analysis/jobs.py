"""
Background analysis jobs.

Jobs live in the database, so they survive restarts, and the worker threads run in the web
process. Each job calls the same view as a direct request, so results are identical.
"""

import json
import logging
import threading
import uuid
from datetime import timedelta

from django.conf import settings
from django.db import close_old_connections, connection, transaction
from django.utils import timezone
from rest_framework.renderers import JSONRenderer
from rest_framework.test import APIRequestFactory, force_authenticate

from apps.core.concurrency import analysis_slot

from .models import AnalysisJob

logger = logging.getLogger(__name__)

HEARTBEAT_SECONDS = 15
STALE_AFTER = timedelta(seconds=60)
MAX_ATTEMPTS = 2

# One id per process, so a job's heartbeat shows which process owns it
_worker_id = uuid.uuid4().hex
_workers_lock = threading.Lock()
_active_workers = 0


def _endpoints():
    from . import views

    return {
        "ndvi": ("/analysis/process_ndvi/", views.process_ndvi),
        "lst": ("/analysis/process_lst/", views.process_lst),
        "sar": ("/analysis/process_sentinel/", views.process_sentinel),
        "comprehensive": ("/analysis/process_comprehensive/", views.process_comprehensive),
    }


def supported_type(analysis_type):
    return analysis_type in _endpoints()


def ensure_workers():
    """Start worker threads up to the concurrency limit. They exit when the queue is empty."""
    global _active_workers
    with _workers_lock:
        missing = settings.ANALYSIS_CONCURRENCY - _active_workers
        _active_workers += missing
    for _ in range(missing):
        threading.Thread(target=_work, daemon=True, name="analysis-worker").start()


def recover_stale_jobs():
    """Requeue jobs whose process died, for example when the instance ran out of memory."""
    cutoff = timezone.now() - STALE_AFTER
    stale = AnalysisJob.objects.filter(status=AnalysisJob.RUNNING, heartbeat_at__lt=cutoff)
    stale.filter(attempts__gte=MAX_ATTEMPTS).update(
        status=AnalysisJob.FAILED,
        error="The server restarted while running this analysis. Try a smaller area or shorter date range.",
        finished_at=timezone.now(),
    )
    stale.update(status=AnalysisJob.QUEUED, worker_id="")


def _claim_next_job():
    with transaction.atomic():
        job = (
            AnalysisJob.objects.select_for_update(skip_locked=True)
            .filter(status=AnalysisJob.QUEUED)
            .order_by("created_at")
            .first()
        )
        if job is None:
            return None
        job.status = AnalysisJob.RUNNING
        job.worker_id = _worker_id
        job.attempts += 1
        job.started_at = job.heartbeat_at = timezone.now()
        job.save(update_fields=["status", "worker_id", "attempts", "started_at", "heartbeat_at"])
        return job


def _beat(job_id, stop):
    while not stop.wait(HEARTBEAT_SECONDS):
        AnalysisJob.objects.filter(pk=job_id).update(heartbeat_at=timezone.now())
    connection.close()


def _run(job):
    path, view = _endpoints()[job.analysis_type]
    request = APIRequestFactory().post(f"/api/v1{path}", job.payload, format="json")
    force_authenticate(request, user=job.user)
    response = view(request)
    data = json.loads(JSONRenderer().render(response.data))
    if response.status_code >= 400:
        raise RuntimeError(data.get("error") or data.get("detail") or data.get("message") or "Analysis failed")
    return data


def _work():
    global _active_workers
    try:
        while True:
            close_old_connections()
            with analysis_slot:
                job = _claim_next_job()
                if job is None:
                    return
                stop = threading.Event()
                threading.Thread(target=_beat, args=(job.pk, stop), daemon=True).start()
                try:
                    job.result = _run(job)
                    job.status = AnalysisJob.COMPLETED
                except Exception as e:
                    logger.exception(f"Analysis job {job.pk} failed")
                    job.error = str(e)
                    job.status = AnalysisJob.FAILED
                finally:
                    stop.set()
                job.finished_at = timezone.now()
                job.save(update_fields=["result", "status", "error", "finished_at"])
    finally:
        with _workers_lock:
            _active_workers -= 1
        connection.close()
