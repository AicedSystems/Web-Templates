from datetime import datetime
from typing import Optional

from sqlalchemy import Boolean, CheckConstraint, DateTime, ForeignKey, Integer, JSON, SmallInteger, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from extensions import db


class Post(db.Model):
    __tablename__ = "posts"

    id: Mapped[int] = mapped_column(primary_key=True)
    title: Mapped[str] = mapped_column(String(100), nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    category: Mapped[str] = mapped_column(String(50), nullable=False)
    tags: Mapped[str] = mapped_column(Text, nullable=False)
    excerpt: Mapped[str] = mapped_column(String(160), nullable=False)
    featured_image: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String(20), nullable=False)
    published_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    content_blocks: Mapped[Optional[list[dict]]] = mapped_column(JSONB, nullable=True)


class Review(db.Model):
    __tablename__ = "reviews"
    __table_args__ = (
        CheckConstraint("rating IS NULL OR rating BETWEEN 1 AND 5", name="ck_reviews_rating_range"),
        CheckConstraint("display_order >= 0", name="ck_reviews_display_order_nonnegative"),
        CheckConstraint("client_image_focal_x BETWEEN 0 AND 100", name="ck_reviews_image_focal_x_range"),
        CheckConstraint("client_image_focal_y BETWEEN 0 AND 100", name="ck_reviews_image_focal_y_range"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    client_name: Mapped[str] = mapped_column(String(120), nullable=False)
    quote: Mapped[str] = mapped_column(Text, nullable=False)
    client_image_url: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    client_image_path: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    client_image_focal_x: Mapped[int] = mapped_column(SmallInteger, nullable=False, default=50)
    client_image_focal_y: Mapped[int] = mapped_column(SmallInteger, nullable=False, default=50)
    rating: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    client_type: Mapped[Optional[str]] = mapped_column(String(80), nullable=True)
    display_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    is_published: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    archived_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        nullable=False,
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
    )


class ReviewPageContent(db.Model):
    __tablename__ = "review_page_content"
    __table_args__ = (
        CheckConstraint("id = 1", name="ck_review_page_content_singleton"),
    )

    id: Mapped[int] = mapped_column(SmallInteger, primary_key=True, default=1)
    schema_version: Mapped[int] = mapped_column(SmallInteger, nullable=False, default=1)
    hero: Mapped[dict] = mapped_column(JSON().with_variant(JSONB, "postgresql"), nullable=False)
    about: Mapped[dict] = mapped_column(JSON().with_variant(JSONB, "postgresql"), nullable=False)
    featured_story: Mapped[dict] = mapped_column(JSON().with_variant(JSONB, "postgresql"), nullable=False)
    featured_review_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("reviews.id", ondelete="SET NULL"),
        nullable=True,
    )
    final_cta: Mapped[dict] = mapped_column(JSON().with_variant(JSONB, "postgresql"), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        nullable=False,
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
    )
