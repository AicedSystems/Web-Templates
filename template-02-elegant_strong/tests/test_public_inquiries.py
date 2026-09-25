import os
import unittest
from unittest.mock import Mock, patch


os.environ["DATABASE_URL"] = "sqlite:///:memory:"
os.environ["EDITOR_USERNAME"] = "inquiry-test-editor"
os.environ["EDITOR_PASSWORD"] = "inquiry-test-password"

import app as app_module  # noqa: E402
from app import app  # noqa: E402


class PublicInquiryTestCase(unittest.TestCase):
    def setUp(self):
        self.client = app.test_client()
        self.payload = {
            "name": "Jamie Rivera",
            "email": "jamie@example.com",
            "phone": "661-555-0199",
            "timeline": "Within 3 months",
            "audience": "buyers",
            "website": "",
        }

    def configured_delivery(self):
        return patch.multiple(
            app_module,
            follow_up_boss_api_key="private-user-key",
            follow_up_boss_system="StephanieWebsite",
            follow_up_boss_system_key="private-system-key",
        )

    def test_valid_buyer_inquiry_is_sent_as_event_without_exposing_keys(self):
        follow_up_response = Mock(status_code=201)
        with self.configured_delivery(), patch.object(app_module.httpx, "post", return_value=follow_up_response) as post:
            response = self.client.post("/api/inquiries", json=self.payload)

        self.assertEqual(response.status_code, 200)
        request_kwargs = post.call_args.kwargs
        self.assertEqual(request_kwargs["json"]["type"], "General Inquiry")
        self.assertEqual(request_kwargs["json"]["person"]["firstName"], "Jamie")
        self.assertEqual(request_kwargs["json"]["person"]["lastName"], "Rivera")
        self.assertEqual(request_kwargs["auth"], ("private-user-key", ""))
        self.assertNotIn("private-user-key", response.get_data(as_text=True))
        self.assertNotIn("private-system-key", response.get_data(as_text=True))

    def test_seller_inquiry_uses_seller_event_type(self):
        self.payload["audience"] = "sellers"
        with self.configured_delivery(), patch.object(app_module.httpx, "post", return_value=Mock(status_code=200)) as post:
            response = self.client.post("/api/inquiries", json=self.payload)

        self.assertEqual(response.status_code, 200)
        self.assertEqual(post.call_args.kwargs["json"]["type"], "Seller Inquiry")

    def test_contact_form_is_sent_with_message_and_optional_phone(self):
        payload = {
            "formType": "contact",
            "firstName": "Jamie",
            "lastName": "Rivera",
            "email": "jamie@example.com",
            "phone": "",
            "interest": "General real estate question",
            "message": "I would like to learn more.",
            "website": "",
        }
        with self.configured_delivery(), patch.object(app_module.httpx, "post", return_value=Mock(status_code=201)) as post:
            response = self.client.post("/api/inquiries", json=payload)

        self.assertEqual(response.status_code, 200)
        event = post.call_args.kwargs["json"]
        self.assertEqual(event["type"], "General Inquiry")
        self.assertEqual(event["person"]["firstName"], "Jamie")
        self.assertEqual(event["person"]["lastName"], "Rivera")
        self.assertNotIn("phones", event["person"])
        self.assertIn("General real estate question", event["message"])
        self.assertIn("I would like to learn more.", event["message"])

    def test_contact_seller_interest_uses_seller_event_type(self):
        payload = {
            "formType": "contact",
            "firstName": "Taylor",
            "lastName": "Morgan",
            "email": "taylor@example.com",
            "phone": "661-555-0100",
            "interest": "Selling a home",
            "message": "I am considering selling.",
        }
        with self.configured_delivery(), patch.object(app_module.httpx, "post", return_value=Mock(status_code=200)) as post:
            response = self.client.post("/api/inquiries", json=payload)

        self.assertEqual(response.status_code, 200)
        self.assertEqual(post.call_args.kwargs["json"]["type"], "Seller Inquiry")

    def test_invalid_contact_form_never_calls_follow_up_boss(self):
        payload = {
            "formType": "contact",
            "firstName": "Jamie",
            "lastName": "",
            "email": "jamie@example.com",
            "interest": "Something else",
            "message": "Hello",
        }
        with patch.object(app_module.httpx, "post") as post:
            response = self.client.post("/api/inquiries", json=payload)

        self.assertEqual(response.status_code, 400)
        post.assert_not_called()

    def test_invalid_input_never_calls_follow_up_boss(self):
        self.payload["email"] = "not-an-email"
        with patch.object(app_module.httpx, "post") as post:
            response = self.client.post("/api/inquiries", json=self.payload)

        self.assertEqual(response.status_code, 400)
        post.assert_not_called()

    def test_unconfigured_delivery_returns_friendly_error(self):
        with patch.multiple(
            app_module,
            follow_up_boss_api_key="",
            follow_up_boss_system="",
            follow_up_boss_system_key="",
        ), patch.object(app_module.httpx, "post") as post:
            response = self.client.post("/api/inquiries", json=self.payload)

        self.assertEqual(response.status_code, 503)
        post.assert_not_called()
        self.assertNotIn("key", response.get_json()["message"].lower())

    def test_honeypot_submission_is_ignored(self):
        self.payload["website"] = "https://spam.example"
        with patch.object(app_module.httpx, "post") as post:
            response = self.client.post("/api/inquiries", json=self.payload)

        self.assertEqual(response.status_code, 200)
        post.assert_not_called()

    def test_follow_up_boss_failure_is_not_leaked(self):
        with self.configured_delivery(), patch.object(app_module.httpx, "post", return_value=Mock(status_code=401)):
            response = self.client.post("/api/inquiries", json=self.payload)

        self.assertEqual(response.status_code, 502)
        self.assertNotIn("401", response.get_data(as_text=True))


if __name__ == "__main__":
    unittest.main()
