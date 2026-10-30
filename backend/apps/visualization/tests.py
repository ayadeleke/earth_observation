import tempfile
from pathlib import Path
from unittest.mock import Mock, patch

import requests
from django.test import TestCase, override_settings

from apps.core.map_storage import publish_map

SUPABASE_SETTINGS = {
    "SUPABASE_URL": "https://x.supabase.co",
    "SUPABASE_SERVICE_KEY": "k",
    "SUPABASE_MAPS_BUCKET": "maps",
}


@override_settings(**SUPABASE_SETTINGS)
class StoredMapTest(TestCase):
    """Tests for maps kept in Supabase Storage."""

    NAME = "interactive_map_20261030_092152_0123456789abcdef0123456789abcdef.html"

    def test_serves_map_from_storage(self):
        with patch("apps.core.map_storage.requests.get") as get:
            get.return_value = Mock(status_code=200, content=b"<html>stored</html>")
            response = self.client.get(f"/static/{self.NAME}")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.content, b"<html>stored</html>")
        self.assertEqual(get.call_args.args[0], f"https://x.supabase.co/storage/v1/object/maps/{self.NAME}")

    def test_missing_stored_map_returns_404(self):
        with patch("apps.core.map_storage.requests.get") as get:
            get.return_value = Mock(status_code=404, content=b"")
            self.assertEqual(self.client.get(f"/static/{self.NAME}").status_code, 404)

    def test_publish_removes_local_copy_only_after_upload(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / self.NAME
            path.write_text("<html></html>")
            with patch("apps.core.map_storage.requests.post") as post:
                post.return_value.raise_for_status.side_effect = requests.HTTPError("nope")
                self.assertFalse(publish_map(self.NAME, path))
                self.assertTrue(path.exists())
                post.return_value.raise_for_status.side_effect = None
                self.assertTrue(publish_map(self.NAME, path))
                self.assertFalse(path.exists())


class ServeGeneratedMapTest(TestCase):
    """Tests for maps written to disk at runtime."""

    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name)
        (self.root / "static").mkdir()
        (self.root / "static" / "interactive_map_20261030_092152.html").write_text("<html>map</html>")

    def get(self, name):
        with override_settings(
            BASE_DIR=self.root,
            STATIC_ROOT=self.root / "staticfiles",
            CORS_ALLOWED_ORIGINS=["https://frontend.example"],
        ):
            response = self.client.get(f"/static/{name}")
        self.addCleanup(response.close)
        return response

    def test_serves_existing_map(self):
        response = self.get("interactive_map_20261030_092152.html")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(b"".join(response.streaming_content), b"<html>map</html>")
        self.assertEqual(response["Content-Type"], "text/html; charset=utf-8")

    def test_frontend_may_embed_map(self):
        response = self.get("interactive_map_20261030_092152.html")
        self.assertIn("frame-ancestors 'self' https://frontend.example", response["Content-Security-Policy"])

    def test_missing_map_returns_404(self):
        self.assertEqual(self.get("interactive_map_20200101_000000.html").status_code, 404)

    def test_other_files_are_not_served(self):
        self.assertEqual(self.get("secrets.html").status_code, 404)
        self.assertEqual(self.get("..%2F.env").status_code, 404)
