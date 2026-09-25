import io
import os
import re
from dataclasses import dataclass
from urllib.parse import quote, urlparse
from uuid import uuid4

import httpx
from PIL import Image, ImageOps, UnidentifiedImageError


MAXIMUM_IMAGE_UPLOAD_BYTES = 8 * 1024 * 1024
MAXIMUM_VIDEO_UPLOAD_BYTES = 50 * 1024 * 1024
MAXIMUM_PDF_UPLOAD_BYTES = 15 * 1024 * 1024
MAXIMUM_IMAGE_DIMENSION = 2400
MAXIMUM_IMAGE_PIXELS = 40_000_000
OUTPUT_IMAGE_QUALITY = 85
ALLOWED_SOURCE_FORMATS = {"JPEG", "PNG", "WEBP"}
STORAGE_SCOPE_PREFIXES = {
    "home-page/hero": "home-page/hero",
    "home-page/hero/video": "home-page/hero/video",
    "home-page/clients": "home-page/clients",
    "home-page/about": "home-page/about",
    "home-page/agents": "home-page/agents",
    "agents-page/hero": "agents-page/hero",
    "agents-page/spotlight": "agents-page/spotlight",
    "agents-page/final-cta": "agents-page/final-cta",
    "audience-page/buyers/hero": "audience-page/buyers/hero",
    "audience-page/buyers/guide": "audience-page/buyers/guide",
    "audience-page/sellers/hero": "audience-page/sellers/hero",
    "audience-page/sellers/guide": "audience-page/sellers/guide",
    "reviews-page/hero": "reviews-page/hero",
    "reviews-page/about": "reviews-page/about",
    "reviews-page/featured-story": "reviews-page/featured-story",
    "reviews-page/final-cta": "reviews-page/final-cta",
    "review-card": "review-cards",
}
DOCUMENT_SCOPE_PREFIXES = {
    "audience-page/buyers/guide-pdf": "audience-page/buyers/guide-pdf",
    "audience-page/sellers/guide-pdf": "audience-page/sellers/guide-pdf",
}
MANAGED_STORAGE_PATH_PATTERN = re.compile(
    r"^(?:(?:home-page/(?:hero|clients|about|agents)|reviews-page/(?:about|featured-story|final-cta)|"
    r"agents-page/(?:spotlight|final-cta)|audience-page/(?:buyers|sellers)/(?:hero|guide)|review-cards)/[0-9a-f]{32}\.webp|"
    r"(?:reviews-page|agents-page)/hero/[0-9a-f]{32}\.(?:webp|mp4|webm)|"
    r"home-page/hero/video/[0-9a-f]{32}\.mp4|"
    r"audience-page/(?:buyers|sellers)/guide-pdf/[0-9a-f]{32}\.pdf)$"
)
VIDEO_UPLOAD_SCOPES = {"reviews-page/hero", "agents-page/hero", "home-page/hero/video"}


class MediaStorageError(Exception):
    status_code = 500


class MediaConfigurationError(MediaStorageError):
    status_code = 503


class MediaValidationError(MediaStorageError):
    status_code = 400


class MediaUpstreamError(MediaStorageError):
    status_code = 502


@dataclass(frozen=True)
class StorageSettings:
    project_url: str
    secret_key: str
    bucket: str

    @classmethod
    def from_environment(cls):
        project_url = os.environ.get("SUPABASE_URL", "").strip().rstrip("/")
        secret_key = os.environ.get("SUPABASE_SECRET_KEY", "").strip()
        bucket = os.environ.get("SUPABASE_STORAGE_BUCKET", "").strip()

        parsed_url = urlparse(project_url)
        if parsed_url.scheme not in {"http", "https"} or not parsed_url.netloc:
            raise MediaConfigurationError("Supabase Storage is not configured correctly.")
        if not secret_key or not bucket:
            raise MediaConfigurationError("Supabase Storage is not configured correctly.")
        return cls(project_url=project_url, secret_key=secret_key, bucket=bucket)


def is_managed_storage_path(path):
    return isinstance(path, str) and MANAGED_STORAGE_PATH_PATTERN.fullmatch(path) is not None


def derive_public_url(storage_path, project_url=None, bucket=None):
    if not is_managed_storage_path(storage_path):
        return None

    project_url = (project_url or os.environ.get("SUPABASE_URL", "")).strip().rstrip("/")
    bucket = (bucket or os.environ.get("SUPABASE_STORAGE_BUCKET", "")).strip()
    parsed_url = urlparse(project_url)
    if parsed_url.scheme not in {"http", "https"} or not parsed_url.netloc or not bucket:
        return None

    encoded_bucket = quote(bucket, safe="")
    encoded_path = "/".join(quote(segment, safe="") for segment in storage_path.split("/"))
    return f"{project_url}/storage/v1/object/public/{encoded_bucket}/{encoded_path}"


def process_image_upload(file_storage):
    if file_storage is None or not getattr(file_storage, "filename", ""):
        raise MediaValidationError("Choose an image to upload.")

    raw_image = file_storage.stream.read(MAXIMUM_IMAGE_UPLOAD_BYTES + 1)
    if not raw_image:
        raise MediaValidationError("The uploaded image is empty.")
    if len(raw_image) > MAXIMUM_IMAGE_UPLOAD_BYTES:
        raise MediaValidationError("Images must be 8 MB or smaller.")

    try:
        with Image.open(io.BytesIO(raw_image)) as source_image:
            if source_image.format not in ALLOWED_SOURCE_FORMATS:
                raise MediaValidationError("Upload a JPEG, PNG, or WebP image.")
            if getattr(source_image, "is_animated", False):
                raise MediaValidationError("Animated images are not supported.")
            if source_image.width * source_image.height > MAXIMUM_IMAGE_PIXELS:
                raise MediaValidationError("The image dimensions are too large.")

            image = ImageOps.exif_transpose(source_image)
            image.thumbnail(
                (MAXIMUM_IMAGE_DIMENSION, MAXIMUM_IMAGE_DIMENSION),
                Image.Resampling.LANCZOS,
            )
            if image.mode not in {"RGB", "RGBA"}:
                image = image.convert("RGBA" if "transparency" in image.info else "RGB")

            output = io.BytesIO()
            image.save(
                output,
                format="WEBP",
                quality=OUTPUT_IMAGE_QUALITY,
                method=6,
            )
            return output.getvalue(), image.width, image.height
    except MediaValidationError:
        raise
    except (Image.DecompressionBombError, UnidentifiedImageError, OSError, ValueError):
        raise MediaValidationError("The uploaded file is not a valid supported image.")


def process_video_upload(file_storage):
    if file_storage is None or not getattr(file_storage, "filename", ""):
        raise MediaValidationError("Choose a video to upload.")

    raw_video = file_storage.stream.read(MAXIMUM_VIDEO_UPLOAD_BYTES + 1)
    if not raw_video:
        raise MediaValidationError("The uploaded video is empty.")
    if len(raw_video) > MAXIMUM_VIDEO_UPLOAD_BYTES:
        raise MediaValidationError("Videos must be 50 MB or smaller.")

    declared_type = (getattr(file_storage, "content_type", "") or "").lower()
    is_mp4 = len(raw_video) >= 12 and raw_video[4:8] == b"ftyp"
    is_webm = raw_video.startswith(b"\x1a\x45\xdf\xa3") and b"webm" in raw_video[:4096].lower()

    if is_mp4 and declared_type == "video/mp4":
        return raw_video, "video/mp4", "mp4"
    if is_webm and declared_type == "video/webm":
        return raw_video, "video/webm", "webm"
    raise MediaValidationError("Upload a valid MP4 or WebM video.")


def process_home_hero_video_upload(file_storage):
    raw_video, content_type, extension = process_video_upload(file_storage)
    if content_type != "video/mp4" or extension != "mp4":
        raise MediaValidationError("The Home Page Hero supports MP4 video only.")
    # Browser-safe MP4 exports identify AVC/H.264 samples with avc1 or avc3.
    # This is a conservative container inspection, not transcoding.
    if b"avc1" not in raw_video and b"avc3" not in raw_video:
        raise MediaValidationError("Export the Hero video as an H.264 MP4 and try again.")
    return raw_video, content_type, extension


def process_pdf_upload(file_storage):
    if file_storage is None or not getattr(file_storage, "filename", ""):
        raise MediaValidationError("Choose a PDF guide to upload.")

    filename = file_storage.filename.lower()
    declared_type = (getattr(file_storage, "content_type", "") or "").lower()
    if not filename.endswith(".pdf") or declared_type != "application/pdf":
        raise MediaValidationError("Upload a PDF guide.")

    raw_pdf = file_storage.stream.read(MAXIMUM_PDF_UPLOAD_BYTES + 1)
    if not raw_pdf:
        raise MediaValidationError("The uploaded PDF is empty.")
    if len(raw_pdf) > MAXIMUM_PDF_UPLOAD_BYTES:
        raise MediaValidationError("PDF guides must be 15 MB or smaller.")
    if not raw_pdf.startswith(b"%PDF-") or b"%%EOF" not in raw_pdf[-2048:]:
        raise MediaValidationError("The uploaded file is not a valid PDF guide.")
    return raw_pdf


def upload_image(file_storage, scope):
    prefix = STORAGE_SCOPE_PREFIXES.get(scope)
    if prefix is None:
        raise MediaValidationError("Unsupported media upload destination.")

    declared_type = (getattr(file_storage, "content_type", "") or "").lower()
    is_video = declared_type in {"video/mp4", "video/webm"}
    if is_video:
        if scope not in VIDEO_UPLOAD_SCOPES:
            raise MediaValidationError("Videos can only be uploaded to the Hero section.")
        if scope == "home-page/hero/video":
            media_bytes, content_type, extension = process_home_hero_video_upload(file_storage)
        else:
            media_bytes, content_type, extension = process_video_upload(file_storage)
        width = height = None
        media_type = "video"
    else:
        media_bytes, width, height = process_image_upload(file_storage)
        content_type = "image/webp"
        extension = "webp"
        media_type = "image"

    settings = StorageSettings.from_environment()
    storage_path = f"{prefix}/{uuid4().hex}.{extension}"
    encoded_bucket = quote(settings.bucket, safe="")
    encoded_path = "/".join(quote(segment, safe="") for segment in storage_path.split("/"))
    upload_url = (
        f"{settings.project_url}/storage/v1/object/"
        f"{encoded_bucket}/{encoded_path}"
    )
    headers = {
        "apikey": settings.secret_key,
        "Authorization": f"Bearer {settings.secret_key}",
        "Content-Type": content_type,
        "x-upsert": "false",
    }

    try:
        response = httpx.post(upload_url, headers=headers, content=media_bytes, timeout=90.0)
        response.raise_for_status()
    except httpx.HTTPError as error:
        raise MediaUpstreamError("The media could not be uploaded to Storage.") from error

    result = {
        "storagePath": storage_path,
        "publicUrl": derive_public_url(
            storage_path,
            project_url=settings.project_url,
            bucket=settings.bucket,
        ),
        "mediaType": media_type,
        "mimeType": content_type,
    }
    if media_type == "image":
        result.update({"width": width, "height": height})
    return result


def upload_document(file_storage, scope):
    prefix = DOCUMENT_SCOPE_PREFIXES.get(scope)
    if prefix is None:
        raise MediaValidationError("Unsupported document upload destination.")

    document_bytes = process_pdf_upload(file_storage)
    settings = StorageSettings.from_environment()
    storage_path = f"{prefix}/{uuid4().hex}.pdf"
    encoded_bucket = quote(settings.bucket, safe="")
    encoded_path = "/".join(quote(segment, safe="") for segment in storage_path.split("/"))
    upload_url = f"{settings.project_url}/storage/v1/object/{encoded_bucket}/{encoded_path}"
    headers = {
        "apikey": settings.secret_key,
        "Authorization": f"Bearer {settings.secret_key}",
        "Content-Type": "application/pdf",
        "x-upsert": "false",
    }

    try:
        response = httpx.post(upload_url, headers=headers, content=document_bytes, timeout=90.0)
        response.raise_for_status()
    except httpx.HTTPError as error:
        raise MediaUpstreamError("The PDF guide could not be uploaded to Storage.") from error

    return {
        "storagePath": storage_path,
        "publicUrl": derive_public_url(
            storage_path,
            project_url=settings.project_url,
            bucket=settings.bucket,
        ),
        "mediaType": "document",
        "mimeType": "application/pdf",
    }


def delete_image(storage_path):
    if not is_managed_storage_path(storage_path):
        raise MediaValidationError("Unsupported managed media path.")

    settings = StorageSettings.from_environment()
    encoded_bucket = quote(settings.bucket, safe="")
    delete_url = f"{settings.project_url}/storage/v1/object/{encoded_bucket}"
    headers = {
        "apikey": settings.secret_key,
        "Authorization": f"Bearer {settings.secret_key}",
        "Content-Type": "application/json",
    }

    try:
        response = httpx.request(
            "DELETE",
            delete_url,
            headers=headers,
            json={"prefixes": [storage_path]},
            timeout=30.0,
        )
        response.raise_for_status()
    except httpx.HTTPError as error:
        raise MediaUpstreamError("The media could not be removed from Storage.") from error
