import os
import unittest
from unittest.mock import patch

from werkzeug.security import generate_password_hash


os.environ.setdefault("DATABASE_URL", "sqlite:///:memory:")
os.environ.setdefault("EDITOR_USERNAME", "auth-test-editor")
os.environ.setdefault("EDITOR_PASSWORD", "legacy-test-only")
os.environ.setdefault("APP_ENV", "test")
os.environ.setdefault("EDITOR_PASSWORD_HASH", "pbkdf2:sha256:1000000$GP639Ean0NEysEtz$fa522afca3dbab3d179c095d8417c5011e86aa9f2e942fc9d82aa0254d09194b")

import app as app_module  # noqa: E402
from app import app  # noqa: E402


class AdminAuthenticationTestCase(unittest.TestCase):
    def setUp(self):
        self.client = app.test_client()
        self.username = "stephanie-admin"
        self.password = "correct horse battery staple"
        app_module._login_failures.clear()
        self.auth_patch = patch.multiple(
            app_module,
            editor_username=self.username,
            editor_password_hash=generate_password_hash(self.password, method="pbkdf2:sha256"),
        )
        self.auth_patch.start()

    def tearDown(self):
        self.auth_patch.stop()
        app_module._login_failures.clear()

    def csrf_token(self):
        with self.client.session_transaction() as session:
            return session[app_module.CSRF_SESSION_KEY]

    def login(self, next_path=""):
        self.client.get("/admin/login")
        return self.client.post(
            "/admin/login",
            data={
                "username": self.username,
                "password": self.password,
                "csrf_token": self.csrf_token(),
                "next": next_path,
            },
        )

    def test_anonymous_pages_redirect_and_apis_return_json_401(self):
        root = self.client.get("/admin")
        self.assertEqual(root.status_code, 302)
        self.assertIn("/admin/login", root.headers["Location"])

        page = self.client.get("/admin/home/page/preview")
        self.assertEqual(page.status_code, 302)
        self.assertIn("next=/admin/home/page/preview", page.headers["Location"])

        api = self.client.get("/api/admin/home-page")
        self.assertEqual(api.status_code, 401)
        self.assertEqual(api.get_json()["message"], "Administrator authentication is required.")
        self.assertEqual(api.headers["Cache-Control"], "no-store")

        mutation = self.client.post("/api/reviews", json={"clientName": "Nope"})
        self.assertEqual(mutation.status_code, 401)

    def test_valid_login_creates_bounded_session_and_grants_access(self):
        response = self.login()
        self.assertEqual(response.status_code, 302)
        self.assertTrue(response.headers["Location"].endswith("/admin"))
        self.assertEqual(self.client.get("/admin").status_code, 302)
        dashboard = self.client.get("/admin/blog")
        self.assertEqual(dashboard.status_code, 200)
        self.assertEqual(dashboard.headers["Cache-Control"], "no-store")
        self.assertIn(b'name="csrf-token"', dashboard.data)
        with self.client.session_transaction() as session:
            self.assertTrue(session[app_module.ADMIN_SESSION_KEY])
            self.assertTrue(session.permanent)
            self.assertNotIn("password", session)

    def test_invalid_login_is_generic_and_rate_limited(self):
        self.client.get("/admin/login")
        for _ in range(app_module.LOGIN_FAILURE_LIMIT):
            response = self.client.post(
                "/admin/login",
                data={
                    "username": self.username,
                    "password": "wrong",
                    "csrf_token": self.csrf_token(),
                },
            )
            self.assertEqual(response.status_code, 401)
            self.assertIn(b"Invalid username or password.", response.data)

        throttled = self.client.post(
            "/admin/login",
            data={
                "username": self.username,
                "password": self.password,
                "csrf_token": self.csrf_token(),
            },
        )
        self.assertEqual(throttled.status_code, 429)
        self.assertNotIn(b"username was", throttled.data)

    def test_login_requires_csrf(self):
        response = self.client.post(
            "/admin/login",
            data={"username": self.username, "password": self.password},
        )
        self.assertEqual(response.status_code, 403)

    def test_safe_next_is_honored_and_external_next_is_rejected(self):
        safe = self.login("/admin/reviews")
        self.assertTrue(safe.headers["Location"].endswith("/admin/reviews"))

        self.client = app.test_client()
        unsafe = self.login("https://evil.example/steal")
        self.assertTrue(unsafe.headers["Location"].endswith("/admin"))
        self.assertNotIn("evil.example", unsafe.headers["Location"])

    def test_csrf_protects_mutations_and_logout_invalidates_session(self):
        self.login()
        missing = self.client.post("/api/reviews", json={})
        self.assertEqual(missing.status_code, 403)
        invalid = self.client.post("/api/reviews", json={}, headers={"X-CSRF-Token": "invalid"})
        self.assertEqual(invalid.status_code, 403)

        valid_token = self.csrf_token()
        passed_csrf = self.client.post("/api/reviews", json={}, headers={"X-CSRF-Token": valid_token})
        self.assertEqual(passed_csrf.status_code, 400)

        logout = self.client.post("/admin/logout", data={"csrf_token": valid_token})
        self.assertEqual(logout.status_code, 302)
        self.assertIn("/admin/login", logout.headers["Location"])
        self.assertEqual(self.client.get("/admin/blog").status_code, 302)

    def test_public_routes_remain_public_and_inquiries_do_not_require_csrf(self):
        self.assertEqual(self.client.get("/contact").status_code, 200)
        inquiry = self.client.post("/api/inquiries", json={})
        self.assertNotEqual(inquiry.status_code, 403)

    def test_missing_admin_credentials_leave_public_site_up_and_admin_closed(self):
        with patch.multiple(app_module, editor_username=None, editor_password_hash=""):
            self.assertEqual(self.client.get("/contact").status_code, 200)
            login_page = self.client.get("/admin/login")
            self.assertEqual(login_page.status_code, 200)
            self.assertIn(b"temporarily unavailable", login_page.data)

            with self.client.session_transaction() as session:
                session[app_module.ADMIN_SESSION_KEY] = True
                session[app_module.CSRF_SESSION_KEY] = "forged-test-token"
            self.assertEqual(self.client.get("/admin/blog").status_code, 302)

            unavailable = self.client.post(
                "/admin/login",
                data={
                    "username": "anything",
                    "password": "anything",
                    "csrf_token": "forged-test-token",
                },
            )
            self.assertEqual(unavailable.status_code, 503)


if __name__ == "__main__":
    unittest.main()
