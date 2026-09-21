import os
import unittest

from sqlalchemy.exc import IntegrityError


os.environ["DATABASE_URL"] = "sqlite:///:memory:"
os.environ["EDITOR_USERNAME"] = "page-test-editor"
os.environ["EDITOR_PASSWORD"] = "page-test-password"

from app import app  # noqa: E402
from extensions import db  # noqa: E402
from models import Review, ReviewPageContent  # noqa: E402


class ReviewPageFoundationTestCase(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.app_context = app.app_context()
        cls.app_context.push()
        Review.__table__.create(db.engine)
        ReviewPageContent.__table__.create(db.engine)

    @classmethod
    def tearDownClass(cls):
        db.session.remove()
        ReviewPageContent.__table__.drop(db.engine)
        Review.__table__.drop(db.engine)
        cls.app_context.pop()

    def tearDown(self):
        db.session.rollback()
        db.session.query(ReviewPageContent).delete()
        db.session.query(Review).delete()
        db.session.commit()

    def test_singleton_content_and_featured_review_reference(self):
        review = Review(client_name="Featured Client", quote="A real review.", is_published=True)
        db.session.add(review)
        db.session.flush()
        content = ReviewPageContent(
            id=1,
            hero={"eyebrow": "Client stories"},
            about={"eyebrow": "About Stephanie", "image": None},
            featured_story={"eyebrow": "Featured story", "image": None},
            featured_review_id=review.id,
            final_cta={"eyebrow": "Ready?", "image": None},
        )
        db.session.add(content)
        db.session.commit()
        self.assertEqual(db.session.get(ReviewPageContent, 1).featured_review_id, review.id)

    def test_singleton_constraint_rejects_another_identifier(self):
        content = ReviewPageContent(
            id=2,
            hero={},
            about={},
            featured_story={},
            final_cta={},
        )
        db.session.add(content)
        with self.assertRaises(IntegrityError):
            db.session.commit()


if __name__ == "__main__":
    unittest.main()
