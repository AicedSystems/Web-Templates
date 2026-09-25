import os
import unittest


os.environ["DATABASE_URL"] = "sqlite:///:memory:"
os.environ["EDITOR_USERNAME"] = "contact-test-editor"
os.environ["EDITOR_PASSWORD"] = "contact-test-password"

from app import app  # noqa: E402


class ContactPageTestCase(unittest.TestCase):
    def setUp(self):
        self.client = app.test_client()

    def test_contact_page_and_trailing_slash_render(self):
        for path in ("/contact", "/contact/"):
            response = self.client.get(path)
            self.assertEqual(response.status_code, 200)
            self.assertIn(b"contactpagehero.webp", response.data)
            self.assertIn(b"I&#39;d Love", response.data.replace(b"\xe2\x80\x99", b"&#39;"))
            self.assertIn(b'data-contact-form', response.data)
            self.assertIn(b'site-footer__inner', response.data)

    def test_contact_form_contract_is_accessible_and_frontend_only(self):
        response = self.client.get("/contact")
        for field in (b'firstName', b'lastName', b'email', b'phone', b'interest', b'message'):
            self.assertIn(b'name="' + field + b'"', response.data)
        self.assertIn(b'type="email"', response.data)
        self.assertIn(b'type="tel"', response.data)
        self.assertIn(b'contact.js', response.data)
        self.assertNotIn(b'action=', response.data)

    def test_consultation_modal_uses_secure_calendly_links(self):
        response = self.client.get("/contact")
        self.assertIn(b'data-consultation-open', response.data)
        self.assertIn(b'role="dialog"', response.data)
        self.assertEqual(response.data.count(b'href="https://calendly.com/connectwithstephm"'), 3)
        self.assertNotIn(b'/buyers-consultation', response.data)
        self.assertNotIn(b'/seller-s-consultation', response.data)
        self.assertEqual(response.data.count(b'target="_blank" rel="noopener" data-consultation-choice'), 3)
        self.assertEqual(response.data.count(b'data-consultation-modal'), 1)
        self.assertIn(b'consultation-modal.js', response.data)


if __name__ == "__main__":
    unittest.main()
