import os
import unittest
from datetime import datetime
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch


os.environ["DATABASE_URL"] = "sqlite:///:memory:"
os.environ["EDITOR_USERNAME"] = "article-test-editor"
os.environ["EDITOR_PASSWORD"] = "article-test-password"

import app as app_module  # noqa: E402
from app import app  # noqa: E402
from extensions import db  # noqa: E402


class BlogArticleRedesignTestCase(unittest.TestCase):
    def setUp(self):
        self.client = app.test_client()
        self.post = SimpleNamespace(
            id=10,
            title="Buyer Strategy",
            excerpt="A practical guide.",
            category="market-updates",
            tags="buyers, Antelope Valley",
            status="published",
            published_at=datetime(2026, 9, 1),
        )

    def test_article_shell_reuses_featured_image_endpoint_and_consultation_modal(self):
        with patch.object(db.session, "get", return_value=self.post), patch("app.get_related_article_posts", return_value=[]):
            response = self.client.get("/blog/10")

        self.assertEqual(response.status_code, 200)
        self.assertIn(b'id="article-image"', response.data)
        self.assertIn(b'id="article-cover-fallback"', response.data)
        self.assertIn(b'data-consultation-open', response.data)
        self.assertEqual(response.data.count(b'data-consultation-modal'), 1)
        self.assertIn(b'<link rel="canonical"', response.data)

    def test_related_posts_prioritize_shared_metadata_and_exclude_current(self):
        rows = [
            SimpleNamespace(id=11, title="Same category", category="market-updates", tags="sellers", excerpt="", published_at=datetime(2026, 9, 3)),
            SimpleNamespace(id=12, title="Shared tag", category="training", tags="buyers", excerpt="", published_at=datetime(2026, 9, 2)),
            SimpleNamespace(id=13, title="Recent fill", category="training", tags="agents", excerpt="", published_at=datetime(2026, 9, 4)),
        ]
        result = SimpleNamespace(all=lambda: rows)
        with patch.object(db.session, "execute", return_value=result) as execute:
            related = app_module.get_related_article_posts(self.post)

        self.assertEqual([post["id"] for post in related], [11, 12, 13])
        statement = str(execute.call_args.args[0])
        self.assertIn("posts.status", statement)
        self.assertIn("posts.id !=", statement)
        self.assertNotIn("posts.content_blocks", statement)
        self.assertNotIn("posts.featured_image", statement)

    def test_article_script_builds_unique_toc_and_uses_public_cover_endpoint(self):
        source = Path(app.static_folder, "blog/js/article.js").read_text(encoding="utf-8")
        self.assertIn('heading.id = count === 1 ? base : `${base}-${count}`', source)
        self.assertIn('articleContent.querySelectorAll("h2")', source)
        self.assertIn("headings.length < 2", source)
        self.assertIn("IntersectionObserver", source)
        self.assertIn("`/api/posts/${post.id}/featured-image`", source)
        self.assertIn("articleCoverFallback.hidden = false", source)
        self.assertIn("post.featuredImageSettings", source)
        self.assertIn("articleImage.style.objectPosition", source)

    def test_responsive_article_css_contains_tablet_and_mobile_collapses(self):
        source = Path(app.static_folder, "blog/css/public-blog.css").read_text(encoding="utf-8")
        self.assertIn("grid-template-columns: minmax(150px, 210px) minmax(0, 760px) minmax(210px, 280px)", source)
        self.assertIn("@media (max-width: 1180px)", source)
        self.assertIn("@media (max-width: 820px)", source)
        self.assertIn(".article-toc-mobile", source)
        self.assertIn("max-height: calc(100dvh - 56px)", source)
        self.assertIn("overscroll-behavior: contain", source)
        self.assertIn(".article__main-column { min-width: 0; grid-column: 2; }", source)
        self.assertIn(".article__aside { min-width: 0; grid-column: 3; }", source)

    def test_blog_cards_use_the_same_published_featured_image_endpoint(self):
        source = Path(app.static_folder, "blog/js/blog.js").read_text(encoding="utf-8")
        self.assertIn("`/api/posts/${post.id}/featured-image`", source)
        self.assertIn("image.src = fallback", source)
        self.assertIn("post.featuredImageSettings", source)

    def test_article_editor_exposes_persistent_featured_image_controls(self):
        template = Path(app.template_folder, "admin/blog/create_post.html").read_text(encoding="utf-8")
        script = Path(app.static_folder, "admin/blog/js/create_post.js").read_text(encoding="utf-8")
        self.assertIn('id="featured-image-controls"', template)
        self.assertIn('data-featured-fit="cover"', template)
        self.assertIn('data-featured-fit="contain"', template)
        self.assertIn("featuredImageSettings: { ...featuredImageSettings }", script)
        self.assertIn("applyFeaturedImagePresentation", script)


if __name__ == "__main__":
    unittest.main()
