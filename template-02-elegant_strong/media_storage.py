import io
import os
import re
from dataclasses import dataclass
from urllib.parse import quote, urlparse
from uuid import uuid4

import httpx
from PIL import Image, ImageOps, UnidentifiedImageError


MAXIMUM_IMAGE_UPLOAD_BYTES = 8 * 1024 * 1024
MAXIMUM_IMAGE_DIMENSION = 2400
MAXIMUM_IMAGE_PIXELS = 40_000_000
OUTPUT_IMAGE_QUALITY = 85
ALLOWED_SOURCE_FORMATS = {"JPEG", "PNG", "WEBP"}
STORAGE_SCOPE_PREFIXES = {
    "reviews-page/about": "reviews-page/about",
    "reviews-page/featured-story": "reviews-page/featured-story",
    "reviews-page/final-cta": "reviews-page/final-cta",
    "review-card": "review-cards",
}
MANAGED_STORAGE_PATH_PATTERN = re.compile(
    r"^(?:reviews-page/(?:about|featured-story|final-cta)|review-cards)/"
    r"[0-9a-f]{32}\.webp$"
)


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


def upload_image(file_storage, scope):
    prefix = STORAGE_SCOPE_PREFIXES.get(scope)
    if prefix is None:
        raise MediaValidationError("Unsupported image upload destination.")

    image_bytes, width, height = process_image_upload(file_storage)
    settings = StorageSettings.from_environment()
    storage_path = f"{prefix}/{uuid4().hex}.webp"
    encoded_bucket = quote(settings.bucket, safe="")
    encoded_path = "/".join(quote(segment, safe="") for segment in storage_path.split("/"))
    upload_url = (
        f"{settings.project_url}/storage/v1/object/"
        f"{encoded_bucket}/{encoded_path}"
    )
    headers = {
        "apikey": settings.secret_key,
        "Authorization": f"Bearer {settings.secret_key}",
        "Content-Type": "image/webp",
        "x-upsert": "false",
    }

    try:
        response = httpx.post(upload_url, headers=headers, content=image_bytes, timeout=30.0)
        response.raise_for_status()
    except httpx.HTTPError as error:
        raise MediaUpstreamError("The image could not be uploaded to Storage.") from error

    return {
        "storagePath": storage_path,
        "publicUrl": derive_public_url(
            storage_path,
            project_url=settings.project_url,
            bucket=settings.bucket,
        ),
        "width": width,
        "height": height,
    }


def delete_image(storage_path):
    if not is_managed_storage_path(storage_path):
        raise MediaValidationError("Unsupported managed image path.")

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
        raise MediaUpstreamError("The image could not be removed from Storage.") from error
