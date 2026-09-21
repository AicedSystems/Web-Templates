import base64
import os
import unittest


os.environ["DATABASE_URL"] = "sqlite:///:memory:"
os.environ["EDITOR_USERNAME"] = "page-test-editor"
os.environ["EDITOR_PASSWORD"] = "page-test-password"
os.environ["SUPABASE_URL"] = "https://example.supabase.co"
os.environ["SUPABASE_STORAGE_BUCKET"] = "site-media"

import app as app_module  # noqa: E402
from app import app  # noqa: E402
from extensions import db  # noqa: E402
from models import Review, ReviewPageContent  # noqa: E402


def page_payload(featured_review_id=None):
    return {
        "hero": {
            "eyebrow": "Client stories",
            "titleLine1": "A partner in",
            "titleEmphasis": "your next chapter.",
            "description": "Clear guidance for every move.",
            "cta": {"label": "Let's Connect", "href": "/#contact"},
            "values": [
                {"title": "Local", "subtitle": "Expertise"},
                {"title": "Client-first", "subtitle": "Approach"},
                {"title": "Lasting", "subtitle": "Relationships"},
            ],
            "reelUrl": "https://www.instagram.com/reel/example/",
        },
        "about": {
            "eyebrow": "About Stephanie",
            "titleLine1": "Helping You Find",
            "titleLine2": "More Than a House",
            "body": "A client-first approach to real estate.",
            "cta": {"label": "Get to Know Me", "href": "/#about"},
            "values": [
                {"title": "Local", "subtitle": "Expertise"},
                {"title": "Client-first", "subtitle": "Approach"},
                {"title": "Trusted", "subtitle": "Guidance"},
                {"title": "Lasting", "subtitle": "Relationships"},
            ],
            "image": None,
        },
        "featuredStory": {
            "eyebrow": "Featured story",
            "titleLine1": "A Client Who",
            "titleLine2": "Became a Friend",
            "image": None,
        },
        "featuredReviewId": featured_review_id,
        "finalCta": {
            "eyebrow": "Ready for what's next?",
            "title": "Let's Make It Happen Together.",
            "cta": {"label": "Contact Me", "href": "/#contact"},
            "image": None,
        },
    }


class ReviewPageContentApiTestCase(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.context = app.app_context()
        cls.context.push()
        Review.__table__.create(db.engine)
        ReviewPageContent.__table__.create(db.engine)

    @classmethod
    def tearDownClass(cls):
        db.session.remove()
        ReviewPageContent.__table__.drop(db.engine)
        Review.__table__.drop(db.engine)
        cls.context.pop()

    def setUp(self):
        db.session.query(ReviewPageContent).delete()
        db.session.query(Review).delete()
        payload = page_payload()
        db.session.add(ReviewPageContent(
            id=1,
            hero=payload["hero"],
            about=payload["about"],
            featured_story=payload["featuredStory"],
            featured_review_id=None,
            final_cta=payload["finalCta"],
        ))
        db.session.commit()
        self.client = app.test_client()
        credentials = f"{app_module.editor_username}:{app_module.editor_password}".encode()
        self.auth = {"Authorization": f"Basic {base64.b64encode(credentials).decode()}"}

    def test_editor_and_api_require_authentication(self):
        self.assertEqual(self.client.get("/admin/reviews/page").status_code, 401)
        self.assertEqual(self.client.get("/admin/reviews/page/preview").status_code, 401)
        self.assertEqual(self.client.get("/api/admin/reviews-page").status_code, 401)
        self.assertEqual(self.client.put("/api/admin/reviews-page", json=page_payload()).status_code, 401)
        self.assertEqual(self.client.get("/admin/reviews/page", headers=self.auth).status_code, 200)
        preview = self.client.get("/admin/reviews/page/preview", headers=self.auth)
        self.assertEqual(preview.status_code, 200)
        self.assertIn(b"reviews-page--editor-preview", preview.data)
        self.assertNotIn(b"reviews-page--editor-preview", self.client.get("/reviews").data)

    def test_get_returns_friendly_content_and_only_eligible_reviews(self):
        published = Review(client_name="Published", quote="Excellent care.", is_published=True)
        hidden = Review(client_name="Hidden", quote="Not public.", is_published=False)
        db.session.add_all([published, hidden])
        db.session.commit()
        response = self.client.get("/api/admin/reviews-page", headers=self.auth)
        self.assertEqual(response.status_code, 200)
        body = response.get_json()
        self.assertEqual([review["clientName"] for review in body["eligibleReviews"]], ["Published"])
        self.assertNotIn("schemaVersion", body)
        self.assertEqual(response.headers.get("Cache-Control"), "no-store")

    def test_save_binds_content_and_featured_review_to_public_page(self):
        review = Review(client_name="Featured Client", quote="Wonderful guidance.", client_type="Home Buyer", is_published=True)
        db.session.add(review)
        db.session.commit()
        payload = page_payload(review.id)
        payload["hero"]["titleLine1"] = "Updated hero"
        payload["about"]["image"] = {
            "storagePath": f"reviews-page/about/{'a' * 32}.webp",
            "focalX": 62,
            "focalY": 31,
        }
        response = self.client.put("/api/admin/reviews-page", headers=self.auth, json=payload)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.get_json()["featuredReview"]["clientName"], "Featured Client")
        public_page = self.client.get("/reviews")
        self.assertEqual(public_page.status_code, 200)
        self.assertIn(b"Updated hero", public_page.data)
        self.assertIn(b"Featured Client", public_page.data)
        self.assertIn(b"62% 31%", public_page.data)

    def test_locked_contract_rejects_design_fields_html_and_hidden_review(self):
        hidden = Review(client_name="Hidden", quote="Private.", is_published=False)
        db.session.add(hidden)
        db.session.commit()
        invalid = page_payload(hidden.id)
        invalid["hero"]["color"] = "red"
        self.assertEqual(self.client.put("/api/admin/reviews-page", headers=self.auth, json=invalid).status_code, 400)
        invalid = page_payload()
        invalid["hero"]["titleLine1"] = "<script>unsafe</script>"
        self.assertEqual(self.client.put("/api/admin/reviews-page", headers=self.auth, json=invalid).status_code, 400)
        invalid = page_payload(hidden.id)
        self.assertEqual(self.client.put("/api/admin/reviews-page", headers=self.auth, json=invalid).status_code, 400)

    def test_image_must_match_managed_placement(self):
        invalid = page_payload()
        invalid["about"]["image"] = {
            "storagePath": f"reviews-page/final-cta/{'b' * 32}.webp",
            "focalX": 50,
            "focalY": 50,
        }
        response = self.client.put("/api/admin/reviews-page", headers=self.auth, json=invalid)
        self.assertEqual(response.status_code, 400)


if __name__ == "__main__":
    unittest.main()
