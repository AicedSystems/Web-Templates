import base64
import os
import unittest
from copy import deepcopy
from pathlib import Path
from unittest.mock import patch

from sqlalchemy.exc import SQLAlchemyError


os.environ["DATABASE_URL"] = "sqlite:///:memory:"
os.environ["EDITOR_USERNAME"] = "audience-test-editor"
os.environ["EDITOR_PASSWORD"] = "audience-test-password"
os.environ["SUPABASE_URL"] = "https://example.supabase.co"
os.environ["SUPABASE_STORAGE_BUCKET"] = "site-media"

import app as app_module  # noqa: E402
from app import app  # noqa: E402
from extensions import db  # noqa: E402
from models import AudiencePageContent  # noqa: E402


def audience_payload(page_type="buyers"):
    label = "Buyer" if page_type == "buyers" else "Seller"
    return {
        "hero": {
            "eyebrow": f"For Home {label}s",
            "heading": "Your next chapter starts here.",
            "description": "Clear, thoughtful guidance for your next move.",
            "benefits": ["Expert Guidance", "Local Insights", "Ongoing Support"],
            "image": None,
        },
        "guide": {
            "eyebrow": "Free Resource",
            "heading": f"The Home {label}'s Guide",
            "description": "Practical guidance from preparation through closing.",
            "image": None,
            "cardTitle": f"The Complete Home {label}'s Guide",
            "cardSummary": "Everything you need in one comprehensive guide.",
            "pdf": None,
        },
        "formIntro": {
            "eyebrow": "Interested in taking the next step?",
            "heading": "Let's Talk About Your Home Goals",
            "description": "Tell Stephanie what you are planning for your next move.",
        },
        "resources": {
            "heading": f"Helpful Resources for {label}s",
            "filterType": "tag",
            "filterValue": page_type,
            "articleCount": 3,
        },
    }


class AudiencePageContentApiTestCase(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.context = app.app_context()
        cls.context.push()
        AudiencePageContent.__table__.create(db.engine, checkfirst=True)

    @classmethod
    def tearDownClass(cls):
        db.session.remove()
        AudiencePageContent.__table__.drop(db.engine, checkfirst=True)
        cls.context.pop()

    def setUp(self):
        db.session.rollback()
        db.session.query(AudiencePageContent).delete()
        for identifier, page_type in ((1, "buyers"), (2, "sellers")):
            payload = audience_payload(page_type)
            db.session.add(AudiencePageContent(
                id=identifier,
                page_type=page_type,
                hero=payload["hero"],
                guide=payload["guide"],
                form_intro=payload["formIntro"],
                resources=payload["resources"],
            ))
        db.session.commit()
        self.client = app.test_client()
        credentials = f"{app_module.editor_username}:{app_module.editor_password}".encode()
        self.auth = {"Authorization": f"Basic {base64.b64encode(credentials).decode()}"}

    def tearDown(self):
        db.session.rollback()

    def test_initial_records_and_unique_page_type(self):
        records = db.session.query(AudiencePageContent).order_by(AudiencePageContent.id).all()
        self.assertEqual([record.page_type for record in records], ["buyers", "sellers"])
        duplicate = audience_payload("buyers")
        db.session.add(AudiencePageContent(
            id=3,
            page_type="buyers",
            hero=duplicate["hero"],
            guide=duplicate["guide"],
            form_intro=duplicate["formIntro"],
            resources=duplicate["resources"],
        ))
        with self.assertRaises(SQLAlchemyError):
            db.session.commit()

    def test_authentication_get_put_and_unsupported_page_type(self):
        self.assertEqual(self.client.get("/api/admin/audience-page/buyers").status_code, 401)
        self.assertEqual(self.client.put("/api/admin/audience-page/buyers", json=audience_payload()).status_code, 401)
        unsupported = self.client.get("/api/admin/audience-page/investors", headers=self.auth)
        self.assertEqual(unsupported.status_code, 404)

    def test_shared_visual_editors_and_draft_previews_require_authentication(self):
        for page_type in ("buyers", "sellers"):
            editor_url = f"/admin/audience/{page_type}"
            preview_url = f"{editor_url}/preview"
            self.assertEqual(self.client.get(editor_url).status_code, 401)
            self.assertEqual(self.client.get(preview_url).status_code, 401)
            editor = self.client.get(editor_url, headers=self.auth)
            preview = self.client.get(preview_url, headers=self.auth)
            self.assertEqual(editor.status_code, 200)
            self.assertIn(f'"pageType": "{page_type}"'.encode(), editor.data)
            self.assertIn(b"audience-page-preview", editor.data)
            self.assertIn(b"Save Changes", editor.data)
            self.assertIn(b"Discard Changes", editor.data)
            self.assertIn(b"Form fields, labels, options", editor.data)
            self.assertEqual(preview.status_code, 200)
            self.assertIn(f'data-audience-preview="{page_type}"'.encode(), preview.data)
            self.assertIn(b"admin/audience/js/page-preview.js", preview.data)
        self.assertEqual(self.client.get("/admin/audience/investors", headers=self.auth).status_code, 404)
        self.assertEqual(self.client.get("/admin/audience/investors/preview", headers=self.auth).status_code, 404)

    def test_editor_javascript_preserves_locked_form_and_safe_asset_lifecycle(self):
        source = (Path(app.static_folder) / "admin/audience/js/page-editor.js").read_text(encoding="utf-8")
        preview = (Path(app.static_folder) / "admin/audience/js/page-preview.js").read_text(encoding="utf-8")
        self.assertIn('event.origin !== window.location.origin', source)
        self.assertIn('event.source !== previewFrame.contentWindow', source)
        self.assertIn('"audience-editor:preview"', source)
        self.assertIn('method: "PUT"', source)
        self.assertIn("Promise.allSettled(superseded", source)
        self.assertIn("uploadedThisSession", source)
        self.assertIn("discardChanges", source)
        self.assertNotIn("buyer-email", source)
        self.assertNotIn("buyer-timeline", source)
        self.assertIn('form.addEventListener("submit"', preview)

    def test_valid_get_and_put_derive_managed_urls(self):
        payload = audience_payload()
        payload["hero"]["heading"] = "A confident buying journey."
        payload["hero"]["image"] = {
            "storagePath": f"audience-page/buyers/hero/{'a' * 32}.webp",
            "mediaType": "image",
            "mimeType": "image/webp",
            "focalX": 60,
            "focalY": 42,
            "fit": "cover",
            "zoom": 105,
        }
        payload["guide"]["pdf"] = {
            "storagePath": f"audience-page/buyers/guide-pdf/{'b' * 32}.pdf",
            "mimeType": "application/pdf",
        }
        response = self.client.put("/api/admin/audience-page/buyers", headers=self.auth, json=payload)
        self.assertEqual(response.status_code, 200)
        body = response.get_json()
        self.assertEqual(body["pageType"], "buyers")
        self.assertEqual(body["hero"]["heading"], "A confident buying journey.")
        self.assertIn("/audience-page/buyers/hero/", body["hero"]["image"]["publicUrl"])
        self.assertIn("/audience-page/buyers/guide-pdf/", body["guide"]["pdf"]["publicUrl"])
        self.assertEqual(response.headers.get("Cache-Control"), "no-store")
        fetched = self.client.get("/api/admin/audience-page/buyers", headers=self.auth)
        self.assertEqual(fetched.status_code, 200)
        self.assertEqual(fetched.headers.get("Cache-Control"), "no-store")

    def test_public_pages_render_their_own_database_content_and_preserve_forms(self):
        buyers = db.session.execute(
            db.select(AudiencePageContent).where(AudiencePageContent.page_type == "buyers")
        ).scalar_one()
        sellers = db.session.execute(
            db.select(AudiencePageContent).where(AudiencePageContent.page_type == "sellers")
        ).scalar_one()
        buyers.hero = {**buyers.hero, "heading": "Buyers Database Heading", "benefits": ["Buyer One", "Buyer Two", "Buyer Three"]}
        buyers.guide = {**buyers.guide, "cardTitle": "Buyers Database Guide"}
        sellers.hero = {**sellers.hero, "heading": "Sellers Database Heading", "benefits": ["Seller One", "Seller Two", "Seller Three"]}
        sellers.guide = {**sellers.guide, "cardTitle": "Sellers Database Guide"}
        db.session.commit()

        with patch("app.get_audience_resource_posts", return_value=[]):
            buyers_response = self.client.get("/buyers")
            sellers_response = self.client.get("/sellers")
        self.assertEqual(buyers_response.status_code, 200)
        self.assertEqual(sellers_response.status_code, 200)
        self.assertIn(b"Buyers Database Heading", buyers_response.data)
        self.assertIn(b"Buyers Database Guide", buyers_response.data)
        self.assertIn(b"Buyer Three", buyers_response.data)
        self.assertNotIn(b"Sellers Database Heading", buyers_response.data)
        self.assertIn(b"Sellers Database Heading", sellers_response.data)
        self.assertIn(b"Sellers Database Guide", sellers_response.data)
        self.assertNotIn(b"Buyers Database Heading", sellers_response.data)
        for response in (buyers_response, sellers_response):
            self.assertIn(b'data-buyer-inquiry', response.data)
            self.assertIn(b'name="email" type="email"', response.data)
            self.assertIn(b'<option>Within 6 months</option>', response.data)

    def test_public_managed_images_and_pdf_are_derived_server_side(self):
        buyers = db.session.execute(
            db.select(AudiencePageContent).where(AudiencePageContent.page_type == "buyers")
        ).scalar_one()
        buyers.hero = {**buyers.hero, "image": {
            "storagePath": f"audience-page/buyers/hero/{'1' * 32}.webp",
            "mediaType": "image", "mimeType": "image/webp", "focalX": 62, "focalY": 35, "fit": "cover", "zoom": 110,
        }}
        buyers.guide = {**buyers.guide,
            "image": {"storagePath": f"audience-page/buyers/guide/{'2' * 32}.webp", "mediaType": "image", "mimeType": "image/webp", "focalX": 45, "focalY": 55, "fit": "contain", "zoom": 100},
            "pdf": {"storagePath": f"audience-page/buyers/guide-pdf/{'3' * 32}.pdf", "mimeType": "application/pdf"},
        }
        db.session.commit()
        with patch("app.get_audience_resource_posts", return_value=[]):
            response = self.client.get("/buyers")
        self.assertIn(b"/audience-page/buyers/hero/", response.data)
        self.assertIn(b"--buyers-hero-position: 62% 35%", response.data)
        self.assertIn(b"/audience-page/buyers/guide/", response.data)
        self.assertIn(b"--guide-image-fit: contain", response.data)
        self.assertIn(b"/audience-page/buyers/guide-pdf/", response.data)
        self.assertIn(b'target="_blank"', response.data)

    def test_missing_media_record_and_invalid_content_use_safe_fallbacks(self):
        with patch("app.get_audience_resource_posts", return_value=[]):
            normal = self.client.get("/sellers")
        self.assertIn(b"sellersecondimg.webp", normal.data)
        self.assertIn(b"PDF Guide", normal.data)
        self.assertIn(b"Coming Soon", normal.data)

        buyers = db.session.execute(
            db.select(AudiencePageContent).where(AudiencePageContent.page_type == "buyers")
        ).scalar_one()
        db.session.delete(buyers)
        db.session.commit()
        with patch("app.get_audience_resource_posts", return_value=[]):
            missing = self.client.get("/buyers")
        self.assertEqual(missing.status_code, 200)
        self.assertIn("Your Next Chapter Starts Here.".encode(), missing.data)
        self.assertIn(b"buyers-hero.jpg", missing.data)

        sellers = db.session.execute(
            db.select(AudiencePageContent).where(AudiencePageContent.page_type == "sellers")
        ).scalar_one()
        sellers.hero = {**sellers.hero, "heading": "<script>bad</script>"}
        db.session.commit()
        with patch("app.get_audience_resource_posts", return_value=[]):
            invalid = self.client.get("/sellers")
        self.assertEqual(invalid.status_code, 200)
        self.assertIn(b"Your Best Move Starts with a Strong Strategy.", invalid.data)
        self.assertNotIn(b"<script>bad</script>", invalid.data)

    def test_public_resource_query_is_lightweight_published_and_count_limited(self):
        rows = [
            type("Row", (), {"id": index, "title": f"Post {index}", "category": "training", "tags": "buyers", "excerpt": "Summary", "published_at": None})()
            for index in range(1, 8)
        ]
        captured = []

        def execute(statement):
            captured.append(statement)
            return type("Result", (), {"all": lambda self: rows})()

        with patch.object(db.session, "execute", side_effect=execute):
            resources = app_module.get_audience_resource_posts({"filterType": "tag", "filterValue": "buyers", "articleCount": 3})
        self.assertEqual(len(resources), 3)
        statement_text = str(captured[0])
        self.assertIn("posts.status", statement_text)
        self.assertIn("published", captured[0].compile().params.values())
        self.assertNotIn("posts.content,", statement_text)
        self.assertNotIn("posts.content_blocks", statement_text)
        self.assertNotIn("posts.featured_image", statement_text)

    def test_buyer_resources_fall_back_to_audience_words_for_legacy_posts(self):
        rows = [
            type("Row", (), {"id": 1, "title": "A Guide for First-Time Buyers", "category": "market-updates", "tags": "local market", "excerpt": "Summary", "published_at": None})(),
            type("Row", (), {"id": 2, "title": "Agent Mentorship", "category": "recruiting", "tags": "agents", "excerpt": "Summary", "published_at": None})(),
        ]

        with patch.object(db.session, "execute", return_value=type("Result", (), {"all": lambda self: rows})()):
            resources = app_module.get_audience_resource_posts({"filterType": "tag", "filterValue": "buyers", "articleCount": 3})

        self.assertEqual([resource["id"] for resource in resources], [1])
        self.assertEqual(resources[0]["imageUrl"], "/api/posts/1/featured-image")

    def test_saves_are_independent(self):
        sellers_before = deepcopy(db.session.execute(
            db.select(AudiencePageContent).where(AudiencePageContent.page_type == "sellers")
        ).scalar_one().hero)
        payload = audience_payload("buyers")
        payload["hero"]["heading"] = "Buyers only."
        response = self.client.put("/api/admin/audience-page/buyers", headers=self.auth, json=payload)
        self.assertEqual(response.status_code, 200)
        sellers_after = db.session.execute(
            db.select(AudiencePageContent).where(AudiencePageContent.page_type == "sellers")
        ).scalar_one().hero
        self.assertEqual(sellers_after, sellers_before)

    def test_complete_contract_locked_fields_and_html_are_rejected(self):
        missing = audience_payload()
        missing.pop("guide")
        self.assertEqual(self.client.put("/api/admin/audience-page/buyers", headers=self.auth, json=missing).status_code, 400)
        locked = audience_payload()
        locked["hero"]["layout"] = "full-width"
        self.assertEqual(self.client.put("/api/admin/audience-page/buyers", headers=self.auth, json=locked).status_code, 400)
        html = audience_payload()
        html["hero"]["heading"] = "<strong>Unsafe</strong>"
        self.assertEqual(self.client.put("/api/admin/audience-page/buyers", headers=self.auth, json=html).status_code, 400)

    def test_cross_page_image_and_pdf_paths_are_rejected(self):
        payload = audience_payload("buyers")
        payload["guide"]["image"] = {
            "storagePath": f"audience-page/sellers/guide/{'c' * 32}.webp",
            "mediaType": "image",
            "mimeType": "image/webp",
            "focalX": 50,
            "focalY": 50,
            "fit": "cover",
            "zoom": 100,
        }
        self.assertEqual(self.client.put("/api/admin/audience-page/buyers", headers=self.auth, json=payload).status_code, 400)
        payload = audience_payload("buyers")
        payload["guide"]["pdf"] = {
            "storagePath": f"audience-page/sellers/guide-pdf/{'d' * 32}.pdf",
            "mimeType": "application/pdf",
        }
        self.assertEqual(self.client.put("/api/admin/audience-page/buyers", headers=self.auth, json=payload).status_code, 400)

    def test_invalid_focal_filter_and_article_count_are_rejected(self):
        payload = audience_payload()
        payload["hero"]["image"] = {
            "storagePath": f"audience-page/buyers/hero/{'e' * 32}.webp",
            "mediaType": "image",
            "mimeType": "image/webp",
            "focalX": 101,
            "focalY": 50,
            "fit": "cover",
            "zoom": 100,
        }
        self.assertEqual(self.client.put("/api/admin/audience-page/buyers", headers=self.auth, json=payload).status_code, 400)
        payload = audience_payload()
        payload["resources"].update({"filterType": "category", "filterValue": "not-real"})
        self.assertEqual(self.client.put("/api/admin/audience-page/buyers", headers=self.auth, json=payload).status_code, 400)
        payload = audience_payload()
        payload["resources"]["articleCount"] = 13
        self.assertEqual(self.client.put("/api/admin/audience-page/buyers", headers=self.auth, json=payload).status_code, 400)

    def test_database_failure_rolls_back(self):
        with patch.object(db.session, "commit", side_effect=SQLAlchemyError("offline")), patch.object(db.session, "rollback") as rollback:
            response = self.client.put(
                "/api/admin/audience-page/buyers",
                headers=self.auth,
                json=audience_payload("buyers"),
            )
        self.assertEqual(response.status_code, 500)
        rollback.assert_called_once()


if __name__ == "__main__":
    unittest.main()
