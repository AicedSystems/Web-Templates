import os
import unittest
from pathlib import Path


os.environ.setdefault("DATABASE_URL", "sqlite:///:memory:")
os.environ.setdefault("EDITOR_USERNAME", "layout-test-editor")
os.environ.setdefault("EDITOR_PASSWORD", "layout-test-password")
os.environ.setdefault("APP_ENV", "test")
os.environ.setdefault("EDITOR_PASSWORD_HASH", "pbkdf2:sha256:1000000$GP639Ean0NEysEtz$fa522afca3dbab3d179c095d8417c5011e86aa9f2e942fc9d82aa0254d09194b")

from app import app  # noqa: E402


class PageEditorWorkspaceLayoutTestCase(unittest.TestCase):
    def test_shared_desktop_workspace_has_room_without_unlocking_shell(self):
        stylesheet = Path(
            app.static_folder, "admin/reviews/css/page-editor.css"
        ).read_text(encoding="utf-8")

        self.assertIn("height: max(720px, calc(100dvh - 280px))", stylesheet)
        self.assertIn("min-height: 720px", stylesheet)
        self.assertIn("overflow-y: auto", stylesheet)
        self.assertIn(".admin-editor-page { height: 100vh; height: 100dvh; overflow: hidden; }", stylesheet)

    def test_all_visual_page_editors_load_shared_workspace_styles(self):
        template_names = (
            "admin/home/page_editor.html",
            "admin/agents/page_editor.html",
            "admin/audience/page_editor.html",
            "admin/reviews/page_editor.html",
        )

        for template_name in template_names:
            with self.subTest(template=template_name):
                template = Path(app.template_folder, template_name).read_text(encoding="utf-8")
                self.assertIn("admin/reviews/css/page-editor.css", template)
                self.assertIn("v='11'", template)


if __name__ == "__main__":
    unittest.main()
