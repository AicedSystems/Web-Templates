import base64
import os
import unittest
from datetime import datetime


os.environ["DATABASE_URL"] = "sqlite:///:memory:"
os.environ["EDITOR_USERNAME"] = "review-test-editor"
os.environ["EDITOR_PASSWORD"] = "review-test-password"

from app import app  # noqa: E402
from extensions import db  # noqa: E402
from models import Review  # noqa: E402


class ReviewsApiTestCase(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.app_context = app.app_context()
        cls.app_context.push()
        Review.__table__.create(db.engine)

    @classmethod
    def tearDownClass(cls):
        db.session.remove()
        Review.__table__.drop(db.engine)
        cls.app_context.pop()

    def setUp(self):
        db.session.query(Review).delete()
        db.session.commit()
        self.client = app.test_client()
        token = base64.b64encode(b"review-test-editor:review-test-password").decode("ascii")
        self.auth_headers = {"Authorization": f"Basic {token}"}

    def test_public_list_is_empty_and_mutations_require_authentication(self):
        self.assertEqual(self.client.get("/api/reviews").status_code, 200)
        response = self.client.post(
            "/api/reviews",
            json={"clientName": "Client", "quote": "A thoughtful review."},
        )
        self.assertEqual(response.status_code, 401)

    def test_unpublished_review_is_never_public(self):
        response = self.client.post(
            "/api/reviews",
            headers=self.auth_headers,
            json={"clientName": "Hidden Client", "quote": "Not published."},
        )
        self.assertEqual(response.status_code, 201)
        review_id = response.get_json()["id"]
        self.assertEqual(self.client.get("/api/reviews").get_json(), [])
        self.assertEqual(self.client.get(f"/api/reviews/{review_id}").status_code, 404)

    def test_published_reviews_are_ordered_and_detail_is_public(self):
        for name, order in (("Second", 20), ("First", 10)):
            response = self.client.post(
                "/api/reviews",
                headers=self.auth_headers,
                json={
                    "clientName": name,
                    "quote": f"Review from {name}.",
                    "rating": 5,
                    "displayOrder": order,
                    "isPublished": True,
                },
            )
            self.assertEqual(response.status_code, 201)

        reviews = self.client.get("/api/reviews").get_json()
        self.assertEqual([review["clientName"] for review in reviews], ["First", "Second"])
        detail = self.client.get(f"/api/reviews/{reviews[0]['id']}")
        self.assertEqual(detail.status_code, 200)
        self.assertNotIn("isPublished", detail.get_json())

    def test_archived_review_is_never_public_even_when_published(self):
        review = Review(
            client_name="Archived Client",
            quote="This published review is archived.",
            display_order=1,
            is_published=True,
            archived_at=datetime.utcnow(),
        )
        db.session.add(review)
        db.session.commit()

        self.assertEqual(self.client.get("/api/reviews").get_json(), [])
        self.assertEqual(self.client.get(f"/api/reviews/{review.id}").status_code, 404)

    def test_patch_and_delete_require_authentication(self):
        response = self.client.post(
            "/api/reviews",
            headers=self.auth_headers,
            json={"clientName": "Client", "quote": "Original."},
        )
        review_id = response.get_json()["id"]
        self.assertEqual(self.client.patch(f"/api/reviews/{review_id}", json={"isPublished": True}).status_code, 401)
        self.assertEqual(self.client.delete(f"/api/reviews/{review_id}").status_code, 401)

        updated = self.client.patch(
            f"/api/reviews/{review_id}",
            headers=self.auth_headers,
            json={"quote": "Updated.", "isPublished": True},
        )
        self.assertEqual(updated.status_code, 200)
        self.assertEqual(updated.get_json()["quote"], "Updated.")
        self.assertEqual(self.client.delete(f"/api/reviews/{review_id}", headers=self.auth_headers).status_code, 204)

    def test_validation_rejects_malformed_payloads(self):
        invalid_payloads = (
            {},
            {"clientName": "", "quote": "Review"},
            {"clientName": "Client", "quote": ""},
            {"clientName": "Client", "quote": "Review", "rating": 6},
            {"clientName": "Client", "quote": "Review", "displayOrder": -1},
            {"clientName": "Client", "quote": "Review", "isPublished": "yes"},
            {"clientName": "Client", "quote": "Review", "clientImageUrl": "data:image/png;base64,AAAA"},
        )
        for payload in invalid_payloads:
            with self.subTest(payload=payload):
                response = self.client.post("/api/reviews", headers=self.auth_headers, json=payload)
                self.assertEqual(response.status_code, 400)
                self.assertIn("message", response.get_json())


if __name__ == "__main__":
    unittest.main()
