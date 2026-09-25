import base64
import os
import unittest
from unittest.mock import patch


os.environ["DATABASE_URL"] = "sqlite:///:memory:"
os.environ["EDITOR_USERNAME"] = "cta-test-editor"
os.environ["EDITOR_PASSWORD"] = "cta-test-password"

import app as app_module  # noqa: E402
from app import app  # noqa: E402


class GlobalCtaTestCase(unittest.TestCase):
    def setUp(self):
        self.client = app.test_client()

    def test_public_pages_load_one_shared_consultation_component(self):
        with patch("app.get_audience_resource_posts", return_value=[]), patch("app.get_agent_resource_posts", return_value=[]):
            for path in ("/", "/buyers", "/sellers", "/agents", "/reviews", "/blog", "/blog/1", "/contact"):
                response = self.client.get(path)
                self.assertEqual(response.status_code, 200, path)
                self.assertEqual(response.data.count(b'data-consultation-modal'), 1, path)
                self.assertIn(b'consultation-modal.css', response.data, path)
                self.assertIn(b'consultation-modal.js', response.data, path)

    def test_visible_contact_ctas_use_contact_page(self):
        for template_name in (
            "site/index.html", "site/client_journey.html", "site/agents.html",
            "site/reviews.html", "blog/index.html", "blog/article.html",
        ):
            source = app.jinja_env.loader.get_source(app.jinja_env, template_name)[0]
            self.assertNotIn('href="/#contact">Let\'s Connect', source, template_name)
            self.assertNotIn('href="mailto:RealtorStephanieAV@gmail.com">Let\'s Connect', source, template_name)

    def test_shared_modal_script_preserves_accessibility_contract(self):
        source = (app.static_folder / "site/js/consultation-modal.js") if hasattr(app.static_folder, "__truediv__") else None
        if source is None:
            from pathlib import Path
            source = Path(app.static_folder) / "site/js/consultation-modal.js"
        script = source.read_text(encoding="utf-8")
        self.assertIn('event.key === "Escape"', script)
        self.assertIn("previousFocus?.focus()", script)
        self.assertIn('button.type = "button"', script)
        self.assertIn("event?.preventDefault()", script)

    def test_homepage_reviews_use_public_feed_and_link_to_full_reviews(self):
        response = self.client.get("/")
        self.assertIn(b'data-homepage-reviews-feed', response.data)
        self.assertIn(b'href="/reviews#client-stories">Read More Reviews', response.data)
        self.assertIn(b'>Kind Words<', response.data)
        self.assertIn(b'>From the Blog<', response.data)
        from pathlib import Path
        script = (Path(app.static_folder) / "site/js/homepage-reviews.js").read_text(encoding="utf-8")
        self.assertIn('fetch("/api/reviews"', script)
        self.assertIn("window.setInterval", script)
        self.assertIn("prefers-reduced-motion", script)


if __name__ == "__main__":
    unittest.main()
