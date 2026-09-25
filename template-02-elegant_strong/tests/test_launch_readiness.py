import os
import unittest


os.environ["DATABASE_URL"] = "sqlite:///:memory:"
os.environ["EDITOR_USERNAME"] = "launch-test-editor"
os.environ["EDITOR_PASSWORD"] = "launch-test-password"

from app import app  # noqa: E402


class LaunchReadinessTestCase(unittest.TestCase):
    def setUp(self):
        self.client = app.test_client()

    def test_health_check_is_database_aware(self):
        response = self.client.get("/healthz")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.get_json(), {"status": "ok"})

    def test_public_security_headers_are_present(self):
        response = self.client.get("/contact")
        self.assertEqual(response.headers["X-Content-Type-Options"], "nosniff")
        self.assertEqual(response.headers["X-Frame-Options"], "SAMEORIGIN")
        self.assertEqual(response.headers["Referrer-Policy"], "strict-origin-when-cross-origin")

    def test_admin_responses_are_not_cached(self):
        response = self.client.get("/admin/blog")
        self.assertEqual(response.status_code, 401)
        self.assertEqual(response.headers["Cache-Control"], "no-store")

    def test_agent_application_uses_server_delivery_contract(self):
        response = self.client.get("/agents")
        self.assertEqual(response.status_code, 200)
        self.assertIn(b'data-agent-application', response.data)
        self.assertIn(b'name="website"', response.data)
        self.assertIn(b'agents.js?v=3', response.data)


if __name__ == "__main__":
    unittest.main()
