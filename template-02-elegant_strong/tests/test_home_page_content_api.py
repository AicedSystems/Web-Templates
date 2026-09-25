import base64
import os
import unittest
from datetime import datetime
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

from sqlalchemy.exc import SQLAlchemyError


os.environ["DATABASE_URL"] = "sqlite:///:memory:"
os.environ["EDITOR_USERNAME"] = "home-page-test-editor"
os.environ["EDITOR_PASSWORD"] = "home-page-test-password"
os.environ["SUPABASE_URL"] = "https://example.supabase.co"
os.environ["SUPABASE_STORAGE_BUCKET"] = "site-media"

import app as app_module  # noqa: E402
from app import app  # noqa: E402
from extensions import db  # noqa: E402
from models import HomePageContent  # noqa: E402


def home_page_payload():
    return {
        "hero": {
            "eyebrow": "Real estate. Real connections. Real results.",
            "headingLine1": "Guiding clients forward.",
            "headingLine2": "Empowering agents to grow.",
            "description": "Trusted guidance for clients and agents.",
            "image": None,
        },
        "blog": {
            "previewLabel": "From the Blog",
            "eyebrow": "From the Blog",
            "heading": "Latest insights",
            "filterType": "all",
            "filterValue": None,
            "articleCount": 3,
        },
        "serviceDirectory": {
            "items": [
                {"heading": "For Buyers or Sellers", "description": "Guidance for your next move."},
                {"heading": "About Stephanie", "description": "Your realtor and advocate."},
                {"heading": "For Agents", "description": "Mentorship and support."},
            ]
        },
        "clients": {
            "eyebrow": "For Buyers or Sellers",
            "headingLine1": "Buy with clarity.",
            "headingLine2": "Sell with confidence.",
            "description": "A seamless experience from start to finish.",
            "serviceArea": "Proudly serving the Antelope Valley & surrounding areas",
            "serviceLabels": ["Buying a Home", "Selling a Home"],
            "image": None,
        },
        "about": {
            "eyebrow": "About / Stephanie",
            "heading": "Guidance grounded in real connection.",
            "description": "Stephanie helps clients and agents move forward with clarity.",
            "buttonLabel": "Read Client Stories",
            "image": None,
        },
        "agents": {
            "eyebrow": "For Agents",
            "headingLine1": "Build more than a business.",
            "headingLine2": "Build something that's yours.",
            "description": "Mentorship, training, and a supportive community.",
            "buttonLabel": "Explore Mentorship",
            "benefits": [
                {"heading": "Mentorship", "description": "One-on-one guidance."},
                {"heading": "Training", "description": "Practical tools and strategies."},
                {"heading": "Community", "description": "A supportive agent network."},
                {"heading": "Growth", "description": "Build a business you are proud of."},
            ],
            "image": None,
        },
        "reviews": {
            "eyebrow": "Kind Words",
            "heading": "What clients are saying",
            "linkLabel": "Read More Reviews",
        },
        "finalCta": {
            "eyebrow": "Ready When You Are",
            "heading": "Let's create your next chapter.",
            "description": "Whether you're buying, selling, or ready to grow, I'd love to help.",
            "buttonLabel": "Let's Connect",
        },
    }


class HomePageContentApiTestCase(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.context = app.app_context()
        cls.context.push()
        HomePageContent.__table__.create(db.engine, checkfirst=True)

    @classmethod
    def tearDownClass(cls):
        db.session.remove()
        HomePageContent.__table__.drop(db.engine, checkfirst=True)
        cls.context.pop()

    def setUp(self):
        db.session.rollback()
        db.session.query(HomePageContent).delete()
        payload = home_page_payload()
        db.session.add(HomePageContent(
            id=1,
            hero=payload["hero"],
            blog=payload["blog"],
            service_directory=payload["serviceDirectory"],
            clients=payload["clients"],
            about=payload["about"],
            agents=payload["agents"],
            reviews=payload["reviews"],
            final_cta=payload["finalCta"],
        ))
        db.session.commit()
        self.client = app.test_client()
        credentials = f"{app_module.editor_username}:{app_module.editor_password}".encode()
        self.auth = {"Authorization": f"Basic {base64.b64encode(credentials).decode()}"}

    def tearDown(self):
        db.session.rollback()

    def test_migration_initializes_one_singleton_record(self):
        migration = Path("migrations/006_create_home_page_content.sql").read_text(encoding="utf-8")
        self.assertIn("CREATE TABLE public.home_page_content", migration)
        self.assertIn("ck_home_page_content_singleton CHECK (id = 1)", migration)
        self.assertIn("INSERT INTO public.home_page_content", migration)
        duplicate = HomePageContent(
            id=2, hero={}, blog={}, service_directory={}, clients={}, about={}, agents={}, reviews={}, final_cta={}
        )
        db.session.add(duplicate)
        with self.assertRaises(SQLAlchemyError):
            db.session.commit()
        db.session.rollback()

    def test_video_extension_migration_preserves_existing_hero(self):
        migration = Path("migrations/007_extend_home_hero_media.sql").read_text(encoding="utf-8")
        self.assertIn("hero = hero || jsonb_build_object", migration)
        self.assertIn("'mediaType', 'image'", migration)
        self.assertIn("'video', NULL", migration)
        self.assertIn("'videoPoster', NULL", migration)
        self.assertIn("schema_version = 2", migration)
        self.assertNotIn("DROP TABLE", migration.upper())

    def test_get_and_put_require_authentication(self):
        self.assertEqual(self.client.get("/api/admin/home-page").status_code, 401)
        self.assertEqual(self.client.put("/api/admin/home-page", json=home_page_payload()).status_code, 401)

    def test_get_and_put_complete_document(self):
        get_response = self.client.get("/api/admin/home-page", headers=self.auth)
        self.assertEqual(get_response.status_code, 200)
        self.assertEqual(get_response.headers.get("Cache-Control"), "no-store")
        self.assertEqual(get_response.get_json()["hero"]["headingLine1"], "Guiding clients forward.")

        payload = home_page_payload()
        payload["about"]["heading"] = "Connection comes first."
        put_response = self.client.put("/api/admin/home-page", headers=self.auth, json=payload)
        self.assertEqual(put_response.status_code, 200)
        self.assertEqual(put_response.headers.get("Cache-Control"), "no-store")
        self.assertEqual(put_response.get_json()["about"]["heading"], "Connection comes first.")

    def test_legacy_image_only_hero_is_normalized_without_switching_modes(self):
        response = self.client.get("/api/admin/home-page", headers=self.auth)
        self.assertEqual(response.status_code, 200)
        hero = response.get_json()["hero"]
        self.assertEqual(hero["mediaType"], "image")
        self.assertIsNone(hero["video"])
        self.assertIsNone(hero["videoPoster"])

    def test_image_and_video_modes_preserve_inactive_media(self):
        payload = home_page_payload()
        payload["hero"].update({
            "mediaType": "video",
            "image": {
                "storagePath": f"home-page/hero/{'a' * 32}.webp", "mediaType": "image",
                "mimeType": "image/webp", "focalX": 50, "focalY": 50, "fit": "contain", "zoom": 110,
            },
            "video": {
                "storagePath": f"home-page/hero/video/{'b' * 32}.mp4", "mediaType": "video",
                "mimeType": "video/mp4", "focalX": 44, "focalY": 61,
            },
            "videoPoster": {
                "storagePath": f"home-page/hero/{'c' * 32}.webp", "mediaType": "image",
                "mimeType": "image/webp", "focalX": 50, "focalY": 50, "fit": "cover", "zoom": 100,
            },
        })
        response = self.client.put("/api/admin/home-page", headers=self.auth, json=payload)
        self.assertEqual(response.status_code, 200)
        hero = response.get_json()["hero"]
        self.assertEqual(hero["mediaType"], "video")
        self.assertIsNotNone(hero["image"])
        self.assertIn("/home-page/hero/video/", hero["video"]["publicUrl"])

        payload = {key: value for key, value in response.get_json().items() if key in home_page_payload()}
        for media_key in ("image", "video", "videoPoster"):
            payload["hero"][media_key].pop("publicUrl", None)
        payload["hero"]["mediaType"] = "image"
        switched = self.client.put("/api/admin/home-page", headers=self.auth, json=payload)
        self.assertEqual(switched.status_code, 200)
        self.assertIsNotNone(switched.get_json()["hero"]["video"])

    def test_video_mode_uses_automatic_fallback_and_rejects_invalid_paths(self):
        payload = home_page_payload()
        payload["hero"].update({
            "mediaType": "video", "videoPoster": None,
            "video": {"storagePath": f"home-page/hero/video/{'d' * 32}.mp4", "mediaType": "video", "mimeType": "video/mp4", "focalX": 50, "focalY": 50},
        })
        self.assertEqual(self.client.put("/api/admin/home-page", headers=self.auth, json=payload).status_code, 200)
        payload = home_page_payload()
        payload["hero"].update({
            "mediaType": "video", "videoPoster": None,
            "video": {"storagePath": f"home-page/hero/video/{'d' * 32}.mp4", "mediaType": "video", "mimeType": "video/mp4", "focalX": 50, "focalY": 50},
        })
        payload["hero"]["videoPoster"] = {"storagePath": f"home-page/hero/{'e' * 32}.webp", "mediaType": "image", "mimeType": "image/webp", "focalX": 50, "focalY": 50, "fit": "cover", "zoom": 100}
        payload["hero"]["video"]["storagePath"] = f"agents-page/hero/{'d' * 32}.mp4"
        self.assertEqual(self.client.put("/api/admin/home-page", headers=self.auth, json=payload).status_code, 400)

    def test_visual_editor_and_actual_preview_are_authenticated(self):
        self.assertEqual(self.client.get("/admin/home/page").status_code, 401)
        editor = self.client.get("/admin/home/page", headers=self.auth)
        preview = self.client.get("/admin/home/page/preview", headers=self.auth)
        self.assertEqual(editor.status_code, 200)
        self.assertIn(b'id="home-page-preview"', editor.data)
        self.assertIn(b'Desktop', editor.data)
        self.assertIn(b'Mobile', editor.data)
        self.assertEqual(preview.status_code, 200)
        self.assertIn(b'data-home-preview="true"', preview.data)
        self.assertIn(b'admin/home/js/page-preview.js', preview.data)

    def test_public_video_uses_decorative_playback_and_poster_fallback(self):
        content = db.session.get(HomePageContent, 1)
        hero = {**content.hero, "mediaType": "video", "video": {
            "storagePath": f"home-page/hero/video/{'7' * 32}.mp4", "mediaType": "video",
            "mimeType": "video/mp4", "focalX": 48, "focalY": 32,
        }, "videoPoster": {
            "storagePath": f"home-page/hero/{'8' * 32}.webp", "mediaType": "image",
            "mimeType": "image/webp", "focalX": 50, "focalY": 50, "fit": "cover", "zoom": 100,
        }}
        content.hero = hero
        db.session.commit()
        with patch("app.get_home_blog_posts", return_value=[]):
            response = self.client.get("/")
        self.assertEqual(response.status_code, 200)
        self.assertIn(b"data-hero-video", response.data)
        self.assertIn(b"autoplay muted loop playsinline", response.data)
        self.assertNotIn(b"data-hero-video-fallback", response.data)
        self.assertNotIn(b'<video data-hero-video data-cms-image="true" poster=', response.data)
        self.assertIn(b"homepage-hero-media.js", response.data)

    def test_missing_unknown_locked_and_html_fields_are_rejected(self):
        missing = home_page_payload()
        del missing["reviews"]
        self.assertEqual(self.client.put("/api/admin/home-page", headers=self.auth, json=missing).status_code, 400)

        unknown = home_page_payload()
        unknown["about"]["color"] = "red"
        self.assertEqual(self.client.put("/api/admin/home-page", headers=self.auth, json=unknown).status_code, 400)

        locked = home_page_payload()
        locked["hero"]["clientCtaHref"] = "/somewhere-else"
        self.assertEqual(self.client.put("/api/admin/home-page", headers=self.auth, json=locked).status_code, 400)

        unsafe = home_page_payload()
        unsafe["finalCta"]["href"] = "javascript:alert(1)"
        self.assertEqual(self.client.put("/api/admin/home-page", headers=self.auth, json=unsafe).status_code, 400)

        html = home_page_payload()
        html["hero"]["headingLine1"] = "<strong>Unsafe</strong>"
        self.assertEqual(self.client.put("/api/admin/home-page", headers=self.auth, json=html).status_code, 400)

    def test_managed_image_is_scoped_validated_and_serialized(self):
        payload = home_page_payload()
        payload["hero"]["image"] = {
            "storagePath": f"home-page/hero/{'a' * 32}.webp",
            "mediaType": "image",
            "mimeType": "image/webp",
            "focalX": 62,
            "focalY": 35,
            "fit": "contain",
            "zoom": 110,
        }
        response = self.client.put("/api/admin/home-page", headers=self.auth, json=payload)
        self.assertEqual(response.status_code, 200)
        image = response.get_json()["hero"]["image"]
        self.assertIn("/storage/v1/object/public/site-media/home-page/hero/", image["publicUrl"])
        self.assertEqual(image["fit"], "contain")
        self.assertEqual(image["zoom"], 110)

        payload["hero"]["image"]["storagePath"] = f"home-page/about/{'a' * 32}.webp"
        self.assertEqual(self.client.put("/api/admin/home-page", headers=self.auth, json=payload).status_code, 400)
        payload["hero"]["image"]["storagePath"] = f"home-page/hero/{'a' * 32}.png"
        self.assertEqual(self.client.put("/api/admin/home-page", headers=self.auth, json=payload).status_code, 400)

    def test_blog_filters_and_article_limits_are_validated(self):
        invalid = home_page_payload()
        invalid["blog"].update({"filterType": "category", "filterValue": "unknown"})
        self.assertEqual(self.client.put("/api/admin/home-page", headers=self.auth, json=invalid).status_code, 400)

        with patch("app.get_published_post_tags", return_value={"buyers": "Buyers"}):
            tagged = home_page_payload()
            tagged["blog"].update({"filterType": "tag", "filterValue": "buyers"})
            self.assertEqual(self.client.put("/api/admin/home-page", headers=self.auth, json=tagged).status_code, 200)

        for count in (0, 13, 2.5):
            invalid_count = home_page_payload()
            invalid_count["blog"]["articleCount"] = count
            self.assertEqual(self.client.put("/api/admin/home-page", headers=self.auth, json=invalid_count).status_code, 400)

    def test_database_save_failure_rolls_back(self):
        payload = home_page_payload()
        payload["hero"]["eyebrow"] = "This must not persist"
        with patch.object(db.session, "commit", side_effect=SQLAlchemyError("save failed")), patch.object(db.session, "rollback") as rollback:
            response = self.client.put("/api/admin/home-page", headers=self.auth, json=payload)
        self.assertEqual(response.status_code, 500)
        rollback.assert_called_once()

    def test_public_home_page_renders_all_sections_and_preserves_locked_markup(self):
        content = db.session.get(HomePageContent, 1)
        content.hero = {**content.hero, "eyebrow": "CMS Hero", "headingLine1": "CMS Heading One"}
        content.blog = {**content.blog, "previewLabel": "CMS Preview", "heading": "CMS Insights"}
        content.service_directory = {"items": [
            {"heading": "CMS Directory One", "description": "First description"},
            {"heading": "CMS Directory Two", "description": "Second description"},
            {"heading": "CMS Directory Three", "description": "Third description"},
        ]}
        content.clients = {**content.clients, "headingLine1": "CMS Clients"}
        content.about = {**content.about, "heading": "CMS About"}
        content.agents = {**content.agents, "headingLine1": "CMS Agents"}
        content.reviews = {**content.reviews, "heading": "CMS Reviews"}
        content.final_cta = {**content.final_cta, "heading": "CMS Final CTA"}
        db.session.commit()
        articles = [{"id": 7, "title": "Published insight", "category": "training", "excerpt": "Summary", "publishedDate": "2026-09-01T00:00:00Z"}]
        with patch("app.get_home_blog_posts", return_value=articles):
            response = self.client.get("/")
        self.assertEqual(response.status_code, 200)
        for expected in (b"CMS Hero", b"CMS Heading One", b"CMS Preview", b"CMS Insights", b"CMS Directory One", b"CMS Clients", b"CMS About", b"CMS Agents", b"CMS Reviews", b"CMS Final CTA", b"Published insight"):
            self.assertIn(expected, response.data)
        self.assertIn(b'class="hero__copy"', response.data)
        self.assertIn(b'class="hero__visual"', response.data)
        self.assertIn(b'class="hero-directory"', response.data)
        self.assertIn(b'data-blog-preview', response.data)
        self.assertIn(b'data-blog-list', response.data)
        self.assertIn(b'data-homepage-reviews-feed', response.data)
        self.assertIn(b'href="#clients">Buy or Sell a Home', response.data)
        self.assertIn(b'href="/agents">I\'m an Agent', response.data)
        self.assertIn(b'href="/reviews#client-stories"', response.data)
        self.assertIn(b'href="/contact">', response.data)

    def test_managed_images_render_and_null_images_use_bundled_fallbacks(self):
        content = db.session.get(HomePageContent, 1)
        managed = {
            "storagePath": f"home-page/hero/{'d' * 32}.webp", "mediaType": "image",
            "mimeType": "image/webp", "focalX": 64, "focalY": 31, "fit": "contain", "zoom": 115,
        }
        content.hero = {**content.hero, "image": managed}
        db.session.commit()
        with patch("app.get_home_blog_posts", return_value=[]):
            response = self.client.get("/")
        self.assertIn(b"home-page/hero/", response.data)
        self.assertIn(b"--home-image-position: 64% 31%", response.data)
        self.assertIn(b"--home-image-fit: contain", response.data)
        self.assertIn(b"--home-image-zoom: 1.15", response.data)
        self.assertIn(b"about-portrait.webp", response.data)
        self.assertIn(b"agents-feature.jpg", response.data)

    def test_hero_layout_state_follows_rendered_media_not_stale_media_type(self):
        content = db.session.get(HomePageContent, 1)
        content.hero = {**content.hero, "mediaType": "image", "image": None, "video": None}
        db.session.commit()

        with patch("app.get_home_blog_posts", return_value=[]):
            fallback = self.client.get("/")

        self.assertIn(b"hero hero--fallback-media", fallback.data)
        self.assertNotIn(b"hero hero--managed-media", fallback.data)
        self.assertIn(b"hero-portrait.png", fallback.data)

    def test_invalid_and_unavailable_content_use_home_fallback_without_writes(self):
        content = db.session.get(HomePageContent, 1)
        content.hero = {**content.hero, "headingLine1": "<strong>Invalid</strong>"}
        db.session.commit()
        with patch("app.get_home_blog_posts", return_value=[]):
            invalid = self.client.get("/")
        self.assertEqual(invalid.status_code, 200)
        self.assertIn(b"Guiding clients forward.", invalid.data)
        self.assertNotIn(b"<strong>Invalid</strong>", invalid.data)
        self.assertIn("<strong>Invalid</strong>", db.session.get(HomePageContent, 1).hero["headingLine1"])

        with patch.object(db.session, "get", side_effect=SQLAlchemyError("missing table")), patch("app.get_home_blog_posts", return_value=[]):
            unavailable = self.client.get("/")
        self.assertEqual(unavailable.status_code, 200)
        self.assertIn(b"Real estate. Real connections. Real results.", unavailable.data)

    def test_home_blog_query_filters_published_rows_and_deduplicates_cards(self):
        row = SimpleNamespace(
            id=8, title="Buyer guidance", category="training", tags="Buyers, Guidance",
            excerpt="A useful article.", published_at=datetime(2026, 9, 4),
        )
        result = SimpleNamespace(all=lambda: [row, row])
        config = {"filterType": "tag", "filterValue": "buyers", "articleCount": 3}
        with patch.object(db.session, "execute", return_value=result) as execute:
            articles = app_module.get_home_blog_posts(config)
        statement = str(execute.call_args.args[0])
        self.assertIn("posts.status", statement)
        self.assertNotIn("posts.content", statement)
        self.assertNotIn("posts.featured_image", statement)
        self.assertEqual([article["id"] for article in articles], [8])

    def test_reviews_keep_existing_source_and_blog_uses_one_bootstrap_dataset(self):
        source = Path("static/site/js/homepage-reviews.js").read_text(encoding="utf-8")
        blog_source = Path("static/site/js/homepage-blog.js").read_text(encoding="utf-8")
        self.assertIn('fetch("/api/reviews"', source)
        self.assertIn('#homepage-articles-data', blog_source)
        self.assertNotIn('fetch("/api/posts"', blog_source)
        self.assertEqual(blog_source.count("latestPosts.map(createArticleCard)"), 1)
        self.assertEqual(blog_source.count("latestPosts.map(createHeroArticle)"), 1)


if __name__ == "__main__":
    unittest.main()
