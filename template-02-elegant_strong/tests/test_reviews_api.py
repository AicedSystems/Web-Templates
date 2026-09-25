import base64
import os
import unittest
from datetime import datetime


os.environ["DATABASE_URL"] = "sqlite:///:memory:"
os.environ["EDITOR_USERNAME"] = "review-test-editor"
os.environ["EDITOR_PASSWORD"] = "review-test-password"
os.environ["SUPABASE_URL"] = "https://example.supabase.co"
os.environ["SUPABASE_STORAGE_BUCKET"] = "site-media"

import app as app_module  # noqa: E402
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
        credentials = f"{app_module.editor_username}:{app_module.editor_password}".encode("utf-8")
        token = base64.b64encode(credentials).decode("ascii")
        self.auth_headers = {"Authorization": f"Basic {token}"}

    def test_public_list_is_empty_and_mutations_require_authentication(self):
        self.assertEqual(self.client.get("/api/reviews").status_code, 200)
        self.assertEqual(self.client.get("/api/admin/reviews").status_code, 401)
        self.assertEqual(self.client.get("/admin/reviews").status_code, 401)
        response = self.client.post(
            "/api/reviews",
            json={"clientName": "Client", "quote": "A thoughtful review."},
        )
        self.assertEqual(response.status_code, 401)

    def test_admin_list_and_manager_require_auth_and_include_every_state(self):
        records = (
            Review(client_name="Published", quote="Public", is_published=True),
            Review(client_name="Hidden", quote="Private", is_published=False),
            Review(client_name="Archived", quote="Stored", is_published=True, archived_at=datetime.utcnow()),
        )
        db.session.add_all(records)
        db.session.commit()

        response = self.client.get("/api/admin/reviews", headers=self.auth_headers)
        self.assertEqual(response.status_code, 200)
        self.assertEqual({review["clientName"] for review in response.get_json()}, {"Published", "Hidden", "Archived"})
        self.assertEqual(response.headers.get("Cache-Control"), "no-store")
        self.assertEqual(self.client.get("/admin/reviews", headers=self.auth_headers).status_code, 200)

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

    def test_agent_reviews_only_returns_published_active_agent_reviews(self):
        db.session.add_all([
            Review(client_name="Agent Story", quote="Mentorship helped.", client_type="Agent", is_published=True),
            Review(client_name="Buyer Story", quote="Bought a home.", client_type="Buyer", is_published=True),
            Review(client_name="Hidden Agent", quote="Hidden.", client_type="Agent", is_published=False),
            Review(client_name="Archived Agent", quote="Archived.", client_type="Agent", is_published=True, archived_at=datetime.utcnow()),
        ])
        db.session.commit()

        response = self.client.get("/api/agent-reviews")

        self.assertEqual(response.status_code, 200)
        self.assertEqual([review["clientName"] for review in response.get_json()], ["Agent Story"])
        self.assertEqual([review["clientName"] for review in self.client.get("/api/reviews").get_json()], ["Buyer Story"])

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

    def test_archive_and_restore_are_authenticated_and_preserve_publication(self):
        response = self.client.post(
            "/api/reviews",
            headers=self.auth_headers,
            json={"clientName": "Client", "quote": "Review", "isPublished": True},
        )
        review_id = response.get_json()["id"]

        self.assertEqual(self.client.patch(f"/api/reviews/{review_id}/archive").status_code, 401)
        archived = self.client.patch(f"/api/reviews/{review_id}/archive", headers=self.auth_headers)
        self.assertEqual(archived.status_code, 200)
        self.assertTrue(archived.get_json()["isPublished"])
        self.assertIsNotNone(archived.get_json()["archivedAt"])
        self.assertEqual(self.client.get("/api/reviews").get_json(), [])
        self.assertEqual(self.client.patch(f"/api/reviews/{review_id}/archive", headers=self.auth_headers).status_code, 409)

        self.assertEqual(self.client.patch(f"/api/reviews/{review_id}/restore").status_code, 401)
        restored = self.client.patch(f"/api/reviews/{review_id}/restore", headers=self.auth_headers)
        self.assertEqual(restored.status_code, 200)
        self.assertTrue(restored.get_json()["isPublished"])
        self.assertIsNone(restored.get_json()["archivedAt"])
        self.assertEqual(len(self.client.get("/api/reviews").get_json()), 1)
        self.assertEqual(self.client.patch(f"/api/reviews/{review_id}/restore", headers=self.auth_headers).status_code, 409)

    def test_validation_rejects_malformed_payloads(self):
        invalid_payloads = (
            {},
            {"clientName": "", "quote": "Review"},
            {"clientName": "Client", "quote": ""},
            {"clientName": "Client", "quote": "Review", "rating": 6},
            {"clientName": "Client", "quote": "Review", "displayOrder": -1},
            {"clientName": "Client", "quote": "Review", "isPublished": "yes"},
            {"clientName": "Client", "quote": "Review", "clientImageUrl": "data:image/png;base64,AAAA"},
            {"clientName": "Client", "quote": "Review", "clientImagePath": "other/unmanaged.webp"},
            {"clientName": "Client", "quote": "Review", "clientImageFocalX": -1},
            {"clientName": "Client", "quote": "Review", "clientImageFocalY": 101},
            {"clientName": "Client", "quote": "Review", "clientImageFit": "stretch"},
        )
        for payload in invalid_payloads:
            with self.subTest(payload=payload):
                response = self.client.post("/api/reviews", headers=self.auth_headers, json=payload)
                self.assertEqual(response.status_code, 400)
                self.assertIn("message", response.get_json())

    def test_managed_review_image_path_derives_public_url(self):
        storage_path = f"review-cards/{'a' * 32}.webp"
        response = self.client.post(
            "/api/reviews",
            headers=self.auth_headers,
            json={
                "clientName": "Storage Client",
                "quote": "Stored outside PostgreSQL.",
                "clientImagePath": storage_path,
                "clientImageFocalX": 64,
                "clientImageFocalY": 27,
                "clientImageFit": "contain",
                "isPublished": True,
            },
        )
        self.assertEqual(response.status_code, 201)
        payload = response.get_json()
        self.assertEqual(payload["clientImagePath"], storage_path)
        self.assertEqual(
            payload["clientImageUrl"],
            f"https://example.supabase.co/storage/v1/object/public/site-media/{storage_path}",
        )
        self.assertEqual(payload["clientImageFocalX"], 64)
        self.assertEqual(payload["clientImageFocalY"], 27)
        self.assertEqual(payload["clientImageFit"], "contain")
        public_payload = self.client.get("/api/reviews").get_json()[0]
        self.assertEqual(public_payload["clientImageUrl"], payload["clientImageUrl"])
        self.assertEqual(public_payload["clientImageFocalX"], 64)
        self.assertEqual(public_payload["clientImageFocalY"], 27)


if __name__ == "__main__":
    unittest.main()
