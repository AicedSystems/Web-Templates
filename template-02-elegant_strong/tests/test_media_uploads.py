import base64
import io
import os
import unittest
from unittest.mock import patch

from flask import json
from PIL import Image
from werkzeug.datastructures import FileStorage


os.environ["DATABASE_URL"] = "sqlite:///:memory:"
os.environ["EDITOR_USERNAME"] = "media-test-editor"
os.environ["EDITOR_PASSWORD"] = "media-test-password"
os.environ["SUPABASE_URL"] = "https://example.supabase.co"
os.environ["SUPABASE_SECRET_KEY"] = "test-server-secret"
os.environ["SUPABASE_STORAGE_BUCKET"] = "site-media"

import app as app_module  # noqa: E402
from app import app  # noqa: E402
import media_storage  # noqa: E402


def make_image_file(width=120, height=80, image_format="PNG"):
    stream = io.BytesIO()
    Image.new("RGB", (width, height), "#a88c75").save(stream, format=image_format)
    stream.seek(0)
    return FileStorage(
        stream=stream,
        filename=f"upload.{image_format.lower()}",
        content_type=f"image/{image_format.lower()}",
    )


def make_video_file(video_format="mp4"):
    if video_format == "mp4":
        data = b"\x00\x00\x00\x18ftypisom" + b"\x00" * 64
        mime_type = "video/mp4"
    else:
        data = b"\x1a\x45\xdf\xa3" + b"\x00webm" + b"\x00" * 64
        mime_type = "video/webm"
    return FileStorage(stream=io.BytesIO(data), filename=f"hero.{video_format}", content_type=mime_type)


def make_pdf_file():
    data = b"%PDF-1.7\n1 0 obj<</Type/Catalog>>endobj\n%%EOF\n"
    return FileStorage(stream=io.BytesIO(data), filename="guide.pdf", content_type="application/pdf")


class MediaProcessingTestCase(unittest.TestCase):
    def test_validates_pdf_signature_type_and_size(self):
        self.assertTrue(media_storage.process_pdf_upload(make_pdf_file()).startswith(b"%PDF-"))
        invalid = FileStorage(stream=io.BytesIO(b"not a pdf"), filename="guide.pdf", content_type="application/pdf")
        with self.assertRaises(media_storage.MediaValidationError):
            media_storage.process_pdf_upload(invalid)
        mislabeled = FileStorage(stream=io.BytesIO(b"%PDF-1.7\n%%EOF"), filename="guide.pdf", content_type="text/plain")
        with self.assertRaises(media_storage.MediaValidationError):
            media_storage.process_pdf_upload(mislabeled)
        with patch.object(media_storage, "MAXIMUM_PDF_UPLOAD_BYTES", 10):
            with self.assertRaises(media_storage.MediaValidationError):
                media_storage.process_pdf_upload(make_pdf_file())

    @patch("media_storage.httpx.post")
    def test_audience_scopes_support_images_and_isolated_pdfs(self, http_post):
        http_post.return_value.raise_for_status.return_value = None
        image = media_storage.upload_image(make_image_file(), "audience-page/buyers/hero")
        self.assertRegex(image["storagePath"], r"^audience-page/buyers/hero/[0-9a-f]{32}\.webp$")
        document = media_storage.upload_document(make_pdf_file(), "audience-page/sellers/guide-pdf")
        self.assertRegex(document["storagePath"], r"^audience-page/sellers/guide-pdf/[0-9a-f]{32}\.pdf$")
        self.assertEqual(document["mimeType"], "application/pdf")
        with self.assertRaises(media_storage.MediaValidationError):
            media_storage.upload_document(make_pdf_file(), "reviews-page/about")

    def test_processes_supported_image_as_webp(self):
        output, width, height = media_storage.process_image_upload(make_image_file())
        self.assertEqual((width, height), (120, 80))
        with Image.open(io.BytesIO(output)) as processed:
            self.assertEqual(processed.format, "WEBP")
            self.assertEqual(processed.size, (120, 80))

    def test_rejects_non_image_and_unsupported_scope(self):
        invalid = FileStorage(
            stream=io.BytesIO(b"not an image"),
            filename="fake.png",
            content_type="image/png",
        )
        with self.assertRaises(media_storage.MediaValidationError):
            media_storage.process_image_upload(invalid)
        with self.assertRaises(media_storage.MediaValidationError):
            media_storage.upload_image(make_image_file(), "unknown")

    def test_public_url_is_derived_from_canonical_path(self):
        path = f"reviews-page/about/{'b' * 32}.webp"
        self.assertEqual(
            media_storage.derive_public_url(path),
            f"https://example.supabase.co/storage/v1/object/public/site-media/{path}",
        )
        self.assertIsNone(media_storage.derive_public_url("../unsafe.webp"))

    def test_validates_mp4_and_webm_signatures(self):
        self.assertEqual(media_storage.MAXIMUM_VIDEO_UPLOAD_BYTES, 150 * 1024 * 1024)
        mp4, mp4_type, mp4_extension = media_storage.process_video_upload(make_video_file("mp4"))
        self.assertTrue(mp4)
        self.assertEqual((mp4_type, mp4_extension), ("video/mp4", "mp4"))
        webm, webm_type, webm_extension = media_storage.process_video_upload(make_video_file("webm"))
        self.assertTrue(webm)
        self.assertEqual((webm_type, webm_extension), ("video/webm", "webm"))

    def test_rejects_mislabeled_and_oversized_video(self):
        mp4 = make_video_file("mp4")
        mislabeled = FileStorage(
            stream=io.BytesIO(mp4.stream.read()),
            filename="hero.webm",
            content_type="video/webm",
        )
        with self.assertRaises(media_storage.MediaValidationError):
            media_storage.process_video_upload(mislabeled)
        with patch.object(media_storage, "MAXIMUM_VIDEO_UPLOAD_BYTES", 10):
            with self.assertRaises(media_storage.MediaValidationError):
                media_storage.process_video_upload(make_video_file("mp4"))

    @patch("media_storage.httpx.post")
    def test_uploads_hero_video_without_image_processing(self, http_post):
        http_post.return_value.raise_for_status.return_value = None
        result = media_storage.upload_image(make_video_file("mp4"), "reviews-page/hero")
        self.assertEqual(result["mediaType"], "video")
        self.assertEqual(result["mimeType"], "video/mp4")
        self.assertRegex(result["storagePath"], r"^reviews-page/hero/[0-9a-f]{32}\.mp4$")
        self.assertNotIn("width", result)

    def test_video_is_not_allowed_in_image_only_scope(self):
        with self.assertRaises(media_storage.MediaValidationError):
            media_storage.upload_image(make_video_file("mp4"), "reviews-page/about")

    @patch("media_storage.httpx.post")
    def test_agents_page_scopes_reuse_managed_storage(self, http_post):
        http_post.return_value.raise_for_status.return_value = None
        image = media_storage.upload_image(make_image_file(), "agents-page/spotlight")
        self.assertRegex(image["storagePath"], r"^agents-page/spotlight/[0-9a-f]{32}\.webp$")
        video = media_storage.upload_image(make_video_file("webm"), "agents-page/hero")
        self.assertRegex(video["storagePath"], r"^agents-page/hero/[0-9a-f]{32}\.webm$")
        self.assertEqual(video["mediaType"], "video")

        with self.assertRaises(media_storage.MediaValidationError):
            media_storage.upload_image(make_video_file("mp4"), "agents-page/final-cta")

    @patch("media_storage.httpx.post")
    def test_home_page_scopes_are_image_only_and_managed(self, http_post):
        http_post.return_value.raise_for_status.return_value = None
        for placement in ("hero", "clients", "about", "agents"):
            image = media_storage.upload_image(make_image_file(), f"home-page/{placement}")
            self.assertRegex(image["storagePath"], rf"^home-page/{placement}/[0-9a-f]{{32}}\.webp$")
            self.assertTrue(media_storage.is_managed_storage_path(image["storagePath"]))
        with self.assertRaises(media_storage.MediaValidationError):
            media_storage.upload_image(make_video_file("mp4"), "home-page/hero")

    @patch("media_storage.httpx.post")
    def test_home_hero_video_requires_h264_mp4_and_uses_dedicated_scope(self, http_post):
        http_post.return_value.raise_for_status.return_value = None
        h264 = FileStorage(
            stream=io.BytesIO(b"\x00\x00\x00\x18ftypisom" + b"\x00" * 24 + b"avc1" + b"\x00" * 32),
            filename="hero.mp4", content_type="video/mp4",
        )
        result = media_storage.upload_image(h264, "home-page/hero/video")
        self.assertRegex(result["storagePath"], r"^home-page/hero/video/[0-9a-f]{32}\.mp4$")
        self.assertTrue(media_storage.is_managed_storage_path(result["storagePath"]))
        self.assertEqual(result["mimeType"], "video/mp4")

        with self.assertRaises(media_storage.MediaValidationError):
            media_storage.upload_image(make_video_file("mp4"), "home-page/hero/video")
        with self.assertRaises(media_storage.MediaValidationError):
            media_storage.upload_image(make_video_file("webm"), "home-page/hero/video")


class MediaEndpointTestCase(unittest.TestCase):
    def setUp(self):
        self.client = app.test_client()
        credentials = f"{app_module.editor_username}:{app_module.editor_password}".encode("utf-8")
        token = base64.b64encode(credentials).decode("ascii")
        self.auth_headers = {"Authorization": f"Basic {token}"}

    def test_upload_requires_authentication(self):
        response = self.client.post("/api/admin/media/images")
        self.assertEqual(response.status_code, 401)
        self.assertEqual(self.client.post("/api/admin/media/documents").status_code, 401)

    @patch("app.media_storage.upload_document")
    def test_document_upload_is_authenticated_and_returns_managed_metadata(self, upload_document):
        path = f"audience-page/buyers/guide-pdf/{'e' * 32}.pdf"
        upload_document.return_value = {
            "storagePath": path,
            "publicUrl": f"https://example.supabase.co/storage/v1/object/public/site-media/{path}",
            "mediaType": "document",
            "mimeType": "application/pdf",
        }
        response = self.client.post(
            "/api/admin/media/documents",
            headers=self.auth_headers,
            data={"scope": "audience-page/buyers/guide-pdf", "file": (io.BytesIO(b"mocked"), "guide.pdf")},
            content_type="multipart/form-data",
        )
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.get_json()["storagePath"], path)
        self.assertEqual(response.headers.get("Cache-Control"), "no-store")

    @patch("app.media_storage.upload_image")
    def test_upload_returns_only_derived_media_metadata(self, upload_image):
        path = f"reviews-page/about/{'c' * 32}.webp"
        upload_image.return_value = {
            "storagePath": path,
            "publicUrl": f"https://example.supabase.co/storage/v1/object/public/site-media/{path}",
            "width": 1200,
            "height": 1600,
        }
        response = self.client.post(
            "/api/admin/media/images",
            headers=self.auth_headers,
            data={
                "scope": "reviews-page/about",
                "file": (io.BytesIO(b"mocked"), "portrait.jpg"),
            },
            content_type="multipart/form-data",
        )
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.get_json()["storagePath"], path)
        self.assertEqual(response.headers.get("Cache-Control"), "no-store")

    @patch("app.media_storage.delete_image")
    def test_delete_is_authenticated_and_requires_exact_payload(self, delete_image):
        path = f"review-cards/{'d' * 32}.webp"
        self.assertEqual(
            self.client.delete("/api/admin/media/images", json={"storagePath": path}).status_code,
            401,
        )
        invalid = self.client.delete(
            "/api/admin/media/images",
            headers=self.auth_headers,
            json={"storagePath": path, "extra": True},
        )
        self.assertEqual(invalid.status_code, 400)
        deleted = self.client.delete(
            "/api/admin/media/images",
            headers=self.auth_headers,
            data=json.dumps({"storagePath": path}),
            content_type="application/json",
        )
        self.assertEqual(deleted.status_code, 204)
        delete_image.assert_called_once_with(path)

    @patch("app.media_storage.delete_image")
    def test_document_delete_is_authenticated_and_pdf_scoped(self, delete_image):
        path = f"audience-page/sellers/guide-pdf/{'f' * 32}.pdf"
        self.assertEqual(
            self.client.delete("/api/admin/media/documents", json={"storagePath": path}).status_code,
            401,
        )
        rejected = self.client.delete(
            "/api/admin/media/documents",
            headers=self.auth_headers,
            json={"storagePath": f"audience-page/sellers/guide/{'f' * 32}.webp"},
        )
        self.assertEqual(rejected.status_code, 400)
        deleted = self.client.delete(
            "/api/admin/media/documents",
            headers=self.auth_headers,
            json={"storagePath": path},
        )
        self.assertEqual(deleted.status_code, 204)
        delete_image.assert_called_once_with(path)


if __name__ == "__main__":
    unittest.main()
