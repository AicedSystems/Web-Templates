import base64
import os
import unittest
from datetime import datetime
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

from sqlalchemy.exc import SQLAlchemyError


os.environ["DATABASE_URL"] = "sqlite:///:memory:"
os.environ["EDITOR_USERNAME"] = "agents-page-test-editor"
os.environ["EDITOR_PASSWORD"] = "agents-page-test-password"
os.environ["SUPABASE_URL"] = "https://example.supabase.co"
os.environ["SUPABASE_STORAGE_BUCKET"] = "site-media"

import app as app_module  # noqa: E402
from app import app  # noqa: E402
from extensions import db  # noqa: E402
from models import AgentPageContent  # noqa: E402


def agents_page_payload():
    return {
        "hero": {
            "eyebrow": "For Real Estate Agents",
            "heading": "A Mentor for Your Next Chapter.",
            "description": "Support for building a meaningful real estate business.",
            "benefits": ["Mentorship", "Practical strategy", "Community"],
            "media": None,
        },
        "spotlight": {
            "heading": "She truly invests in her agents.",
            "quote": "Stephanie helped me grow with confidence.",
            "agentName": "Marissa R.",
            "attribution": "Real Estate Agent",
            "rating": 5,
            "image": None,
        },
        "application": {
            "heading": "Let's build what's next.",
            "description": "Your next chapter starts with a conversation.",
            "benefits": ["Mentorship", "Collaboration", "Growth opportunities"],
        },
        "resources": {
            "heading": "Insights for Your Next Chapter.",
            "filterType": "category",
            "filterValue": "recruiting",
            "articleCount": 3,
        },
        "finalCta": {
            "heading": "You don't have to do it alone.",
            "button": {"label": "Let's Talk", "href": "#agent-application"},
            "image": None,
        },
    }


class AgentPageContentApiTestCase(unittest.TestCase):
    def test_buyer_resources_include_only_published_rows_tagged_buyers(self):
        rows = [
            SimpleNamespace(id=1, title="Buyer Post", category="training", tags="Buyers, checklist", excerpt="Buyer help.", published_at=datetime(2026, 9, 1)),
            SimpleNamespace(id=2, title="Seller Post", category="training", tags="sellers", excerpt="Seller help.", published_at=datetime(2026, 8, 1)),
        ]
        with patch.object(db.session, "execute", return_value=SimpleNamespace(all=lambda: rows)):
            resources = app_module.get_buyer_resource_posts()

        self.assertEqual([resource["id"] for resource in resources], [1])
        self.assertEqual(resources[0]["title"], "Buyer Post")

        with patch.object(db.session, "execute", return_value=SimpleNamespace(all=lambda: rows)):
            seller_resources = app_module.get_seller_resource_posts()
        self.assertEqual([resource["id"] for resource in seller_resources], [2])

    @classmethod
    def setUpClass(cls):
        cls.context = app.app_context()
        cls.context.push()
        AgentPageContent.__table__.create(db.engine, checkfirst=True)

    @classmethod
    def tearDownClass(cls):
        db.session.remove()
        AgentPageContent.__table__.drop(db.engine, checkfirst=True)
        cls.context.pop()

    def setUp(self):
        db.session.rollback()
        db.session.query(AgentPageContent).delete()
        payload = agents_page_payload()
        db.session.add(AgentPageContent(
            id=1,
            hero=payload["hero"],
            spotlight=payload["spotlight"],
            application=payload["application"],
            resources=payload["resources"],
            final_cta=payload["finalCta"],
        ))
        db.session.commit()
        self.client = app.test_client()
        credentials = f"{app_module.editor_username}:{app_module.editor_password}".encode()
        self.auth = {"Authorization": f"Basic {base64.b64encode(credentials).decode()}"}

    def tearDown(self):
        db.session.rollback()

    def test_singleton_constraint(self):
        duplicate = AgentPageContent(
            id=2, hero={}, spotlight={}, application={}, resources={}, final_cta={}
        )
        db.session.add(duplicate)
        with self.assertRaises(SQLAlchemyError):
            db.session.commit()

    def test_get_and_put_require_authentication(self):
        self.assertEqual(self.client.get("/api/admin/agents-page").status_code, 401)
        self.assertEqual(self.client.put("/api/admin/agents-page", json=agents_page_payload()).status_code, 401)

    def test_visual_editor_and_preview_require_authentication(self):
        self.assertEqual(self.client.get("/admin/agents/page").status_code, 401)
        self.assertEqual(self.client.get("/admin/agents/page/preview").status_code, 401)
        editor = self.client.get("/admin/agents/page", headers=self.auth)
        preview = self.client.get("/admin/agents/page/preview", headers=self.auth)
        self.assertEqual(editor.status_code, 200)
        self.assertIn(b"agents-page-preview", editor.data)
        self.assertIn(b"Save Changes", editor.data)
        self.assertIn(b"Application fields, options, validation", editor.data)
        self.assertEqual(preview.status_code, 200)
        self.assertIn(b"agents-page--editor-preview", preview.data)
        self.assertIn(b"admin/agents/js/page-preview.js", preview.data)
        self.assertNotIn(b"agents-page--editor-preview", self.client.get("/agents").data)

    def test_editor_javascript_scopes_messages_and_preserves_locked_contract(self):
        source = (Path(app.static_folder) / "admin/agents/js/page-editor.js").read_text(encoding="utf-8")
        self.assertIn('event.origin !== window.location.origin', source)
        self.assertIn('event.source !== previewFrame.contentWindow', source)
        self.assertIn('"agents-editor:preview"', source)
        self.assertIn('"/api/admin/agents-page"', source)
        self.assertIn("window.requestAnimationFrame", source)
        self.assertIn("updateEditorMediaPosition(control, media)", source)
        self.assertNotIn("primaryCta", source)
        self.assertNotIn("licenseStatus", source)

    def test_valid_content_is_saved_and_serialized(self):
        payload = agents_page_payload()
        payload["hero"]["heading"] = "Grow with trusted guidance."
        payload["hero"]["media"] = {
            "storagePath": f"agents-page/hero/{'a' * 32}.webp",
            "mediaType": "image",
            "mimeType": "image/webp",
            "focalX": 60,
            "focalY": 40,
        }
        response = self.client.put("/api/admin/agents-page", headers=self.auth, json=payload)
        self.assertEqual(response.status_code, 200)
        body = response.get_json()
        self.assertEqual(body["hero"]["heading"], "Grow with trusted guidance.")
        self.assertIn("/storage/v1/object/public/site-media/agents-page/hero/", body["hero"]["media"]["publicUrl"])
        self.assertEqual(response.headers.get("Cache-Control"), "no-store")

    def test_editor_api_returns_lightweight_published_article_metadata(self):
        article = SimpleNamespace(
            id=21,
            title="Mentorship Matters",
            category="recruiting",
            tags="Agents, Mentorship",
            published_at=datetime(2026, 9, 2),
        )
        tag_result = SimpleNamespace(scalars=lambda: [article.tags])
        article_result = SimpleNamespace(all=lambda: [article])
        with patch.object(db.session, "execute", side_effect=[tag_result, article_result]):
            response = self.client.get("/api/admin/agents-page", headers=self.auth)
        self.assertEqual(response.status_code, 200)
        body = response.get_json()
        self.assertEqual(body["availableTags"], ["Agents", "Mentorship"])
        self.assertEqual(body["availableArticles"][0]["id"], 21)
        self.assertEqual(body["availableArticles"][0]["imageUrl"], "/static/site/images/agents-feature.jpg")

    def test_missing_unknown_and_locked_properties_are_rejected(self):
        missing = agents_page_payload()
        del missing["application"]
        self.assertEqual(self.client.put("/api/admin/agents-page", headers=self.auth, json=missing).status_code, 400)

        unknown = agents_page_payload()
        unknown["spotlight"]["color"] = "red"
        self.assertEqual(self.client.put("/api/admin/agents-page", headers=self.auth, json=unknown).status_code, 400)

        locked = agents_page_payload()
        locked["hero"]["primaryCta"] = {"label": "Changed", "href": "/"}
        self.assertEqual(self.client.put("/api/admin/agents-page", headers=self.auth, json=locked).status_code, 400)

    def test_html_invalid_paths_and_invalid_cta_are_rejected(self):
        html = agents_page_payload()
        html["hero"]["heading"] = "<strong>Unsafe</strong>"
        self.assertEqual(self.client.put("/api/admin/agents-page", headers=self.auth, json=html).status_code, 400)

        wrong_path = agents_page_payload()
        wrong_path["spotlight"]["image"] = {
            "storagePath": f"agents-page/final-cta/{'b' * 32}.webp",
            "mediaType": "image",
            "mimeType": "image/webp",
            "focalX": 50,
            "focalY": 50,
        }
        self.assertEqual(self.client.put("/api/admin/agents-page", headers=self.auth, json=wrong_path).status_code, 400)

        bad_link = agents_page_payload()
        bad_link["finalCta"]["button"]["href"] = "javascript:alert(1)"
        self.assertEqual(self.client.put("/api/admin/agents-page", headers=self.auth, json=bad_link).status_code, 400)

    def test_optional_rating_is_supported_and_range_is_enforced(self):
        payload = agents_page_payload()
        payload["spotlight"]["rating"] = None
        response = self.client.put("/api/admin/agents-page", headers=self.auth, json=payload)
        self.assertEqual(response.status_code, 200)
        self.assertIsNone(response.get_json()["spotlight"]["rating"])
        payload["spotlight"]["rating"] = 6
        self.assertEqual(self.client.put("/api/admin/agents-page", headers=self.auth, json=payload).status_code, 400)

    def test_resource_filters_and_article_count_are_validated(self):
        invalid_filter = agents_page_payload()
        invalid_filter["resources"]["filterValue"] = "not-a-category"
        self.assertEqual(self.client.put("/api/admin/agents-page", headers=self.auth, json=invalid_filter).status_code, 400)

        with patch("app.get_published_post_tags", return_value={"mentorship": "Mentorship"}):
            tag_payload = agents_page_payload()
            tag_payload["resources"].update({"filterType": "tag", "filterValue": "mentorship"})
            self.assertEqual(self.client.put("/api/admin/agents-page", headers=self.auth, json=tag_payload).status_code, 200)

        for count in (0, 13, 2.5):
            invalid_count = agents_page_payload()
            invalid_count["resources"]["articleCount"] = count
            self.assertEqual(self.client.put("/api/admin/agents-page", headers=self.auth, json=invalid_count).status_code, 400)

    def test_database_save_failure_rolls_back(self):
        payload = agents_page_payload()
        payload["hero"]["heading"] = "This must not persist"
        with patch.object(db.session, "commit", side_effect=SQLAlchemyError("save failed")), patch.object(db.session, "rollback") as rollback:
            response = self.client.put("/api/admin/agents-page", headers=self.auth, json=payload)
        self.assertEqual(response.status_code, 500)
        rollback.assert_called_once()

    def test_public_page_uses_singleton_content_without_changing_locked_form_or_ctas(self):
        content = db.session.get(AgentPageContent, 1)
        content.hero = {**content.hero, "eyebrow": "CMS Hero", "heading": "Guidance for Your Bright Future."}
        content.application = {**content.application, "heading": "CMS Application"}
        content.spotlight = {**content.spotlight, "agentName": "CMS Agent"}
        content.final_cta = {**content.final_cta, "heading": "CMS Final CTA"}
        db.session.commit()

        with patch("app.get_agent_resource_posts", return_value=[]):
            response = self.client.get("/agents")
        self.assertEqual(response.status_code, 200)
        self.assertIn(b"CMS Hero", response.data)
        self.assertIn(b"CMS Agent", response.data)
        self.assertIn(b"CMS Application", response.data)
        self.assertIn(b"CMS Final CTA", response.data)
        self.assertIn(b'href="/contact">Let\'s Connect', response.data)
        self.assertIn(b'id="agent-license"', response.data)
        self.assertIn(b'name="goals"', response.data)

    def test_public_page_renders_managed_media_and_static_fallbacks(self):
        content = db.session.get(AgentPageContent, 1)
        content.hero = {
            **content.hero,
            "media": {
                "storagePath": f"agents-page/hero/{'c' * 32}.mp4",
                "mediaType": "video",
                "mimeType": "video/mp4",
            },
        }
        db.session.commit()
        with patch("app.get_agent_resource_posts", return_value=[]):
            response = self.client.get("/agents")
        self.assertIn(b"<video", response.data)
        self.assertIn(b"agents-page/hero/", response.data)
        self.assertIn(b"steph-testimonial-reviews.webp", response.data)

        db.session.query(AgentPageContent).delete()
        db.session.commit()
        with patch("app.get_agent_resource_posts", return_value=[]):
            fallback = self.client.get("/agents")
        self.assertEqual(fallback.status_code, 200)
        self.assertIn(b"A Mentor for", fallback.data)
        self.assertIn(b"agents-feature.jpg", fallback.data)
        self.assertNotIn(b"Grow<br>", fallback.data)

    def test_agent_images_save_fit_zoom_and_render_on_public_page(self):
        payload = agents_page_payload()
        payload["spotlight"]["image"] = {
            "storagePath": f"agents-page/spotlight/{'d' * 32}.webp",
            "mediaType": "image",
            "mimeType": "image/webp",
            "focalX": 64,
            "focalY": 38,
            "fit": "contain",
            "zoom": 120,
        }
        response = self.client.put("/api/admin/agents-page", headers=self.auth, json=payload)
        self.assertEqual(response.status_code, 200)
        image = response.get_json()["spotlight"]["image"]
        self.assertEqual(image["fit"], "contain")
        self.assertEqual(image["zoom"], 120)
        with patch("app.get_agent_resource_posts", return_value=[]):
            public_page = self.client.get("/agents")
        self.assertIn(b"--agents-image-fit: contain", public_page.data)
        self.assertIn(b"--agents-image-zoom: 1.2", public_page.data)

        payload["spotlight"]["image"]["zoom"] = 153
        self.assertEqual(self.client.put("/api/admin/agents-page", headers=self.auth, json=payload).status_code, 400)

    def test_resource_query_uses_published_category_and_saved_limit(self):
        result = SimpleNamespace(all=lambda: [
            SimpleNamespace(
                id=9,
                title="Agent Growth",
                category="recruiting",
                tags="Agents, Mentorship",
                published_at=datetime(2026, 9, 1),
            )
        ])
        resources = agents_page_payload()["resources"]
        with patch.object(db.session, "execute", return_value=result) as execute:
            posts = app_module.get_agent_resource_posts(resources)
        statement = str(execute.call_args.args[0])
        self.assertIn("posts.status", statement)
        self.assertIn("posts.category", statement)
        self.assertIn("LIMIT", statement)
        self.assertEqual(posts[0]["id"], 9)
        self.assertEqual(posts[0]["title"], "Agent Growth")


if __name__ == "__main__":
    unittest.main()
