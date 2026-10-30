import tempfile
from pathlib import Path

from django.test import TestCase, override_settings


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
