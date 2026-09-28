import base64
import json
import os
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch


os.environ.setdefault("DATABASE_URL", "sqlite:///:memory:")
os.environ.setdefault("EDITOR_USERNAME", "aiced-test-editor")
os.environ.setdefault("EDITOR_PASSWORD", "aiced-test-password")
os.environ.setdefault("APP_ENV", "test")
os.environ.setdefault("EDITOR_PASSWORD_HASH", "pbkdf2:sha256:1000000$GP639Ean0NEysEtz$fa522afca3dbab3d179c095d8417c5011e86aa9f2e942fc9d82aa0254d09194b")

import app as app_module  # noqa: E402


def article_payload(action="readability"):
    return {
        "action": action,
        "title": "A Clear Home Buying Guide",
        "excerpt": "Helpful guidance for preparing to buy your next home.",
        "category": "training",
        "tags": ["buyers"],
        "contentBlocks": [
            {"type": "heading", "text": "Start with a plan"},
            {"type": "image", "url": "https://example.com/home.jpg"},
            {"type": "paragraph", "text": "Speak with a lender before touring homes."},
            {"type": "youtube", "url": "https://youtu.be/example"},
            {"type": "cta", "text": "Contact us", "url": "https://example.com/contact"},
        ],
    }


def proposed_result(source):
    return {
        "title": source["title"],
        "excerpt": "Clear guidance to help you prepare for your next home purchase.",
        "category": source["category"],
        "tags": list(source["tags"]),
        "contentBlocks": [
            {"type": "heading", "text": "Begin with a clear plan"},
            {"type": "image", "url": "https://example.com/home.jpg"},
            {"type": "paragraph", "text": "Talk with a lender before touring homes."},
            {"type": "youtube", "url": "https://youtu.be/example"},
            {"type": "cta", "text": "Contact us", "url": "https://example.com/contact"},
        ],
    }


class AicedBotAiEditTestCase(unittest.TestCase):
    def setUp(self):
        self.client = app_module.app.test_client()
        token = "aiced-test-csrf"
        with self.client.session_transaction() as session:
            session[app_module.ADMIN_SESSION_KEY] = True
            session[app_module.CSRF_SESSION_KEY] = token
        self.auth = {"X-CSRF-Token": token}

    def test_ai_edit_requires_authentication(self):
        response = app_module.app.test_client().post("/api/posts/ai-edit", json=article_payload())
        self.assertEqual(response.status_code, 401)

    def test_quick_actions_use_server_owned_instructions(self):
        for action in ("shorter", "readability", "warmer_tone"):
            with self.subTest(action=action):
                payload = article_payload(action)
                with patch.object(
                    app_module,
                    "request_ai_enhancement",
                    return_value=(proposed_result(payload), None, 200),
                ) as request_ai:
                    response = self.client.post(
                        "/api/posts/ai-edit", json=payload, headers=self.auth
                    )

                self.assertEqual(response.status_code, 200)
                self.assertEqual(
                    request_ai.call_args.args[0],
                    app_module.AI_EDIT_ACTION_INSTRUCTIONS[action],
                )
                self.assertEqual(request_ai.call_args.kwargs["action"], action)

    def test_custom_request_is_required_and_reaches_provider_wrapper(self):
        payload = article_payload("custom")
        response = self.client.post(
            "/api/posts/ai-edit", json=payload, headers=self.auth
        )
        self.assertEqual(response.status_code, 400)

        payload["instruction"] = "Make the introduction more welcoming."
        with patch.object(
            app_module,
            "request_ai_enhancement",
            return_value=(proposed_result(payload), None, 200),
        ) as request_ai:
            response = self.client.post(
                "/api/posts/ai-edit", json=payload, headers=self.auth
            )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(request_ai.call_args.args[0], app_module.AI_CUSTOM_EDIT_INSTRUCTIONS)
        self.assertIn(payload["instruction"], request_ai.call_args.args[1])

    def test_validation_preserves_non_text_blocks(self):
        source = article_payload()
        enhancement = {
            "title": source["title"],
            "excerpt": "Clear guidance to help you prepare for your next home purchase.",
            "category": source["category"],
            "tags": source["tags"],
            "contentBlocks": [
                {"type": "heading", "text": "Begin with a clear plan"},
                {"type": "paragraph", "text": "Talk with a lender before touring homes."},
            ],
        }

        result, error = app_module.validate_ai_enhancement(enhancement, source)

        self.assertIsNone(error)
        self.assertEqual(
            [block["type"] for block in result["contentBlocks"]],
            [block["type"] for block in source["contentBlocks"]],
        )
        self.assertEqual(result["contentBlocks"][1], source["contentBlocks"][1])
        self.assertEqual(result["contentBlocks"][3], source["contentBlocks"][3])
        self.assertEqual(result["contentBlocks"][4], source["contentBlocks"][4])

    def test_custom_no_op_response_is_rejected(self):
        source = article_payload("custom")
        unchanged = {
            "title": source["title"],
            "excerpt": source["excerpt"],
            "category": source["category"],
            "tags": source["tags"],
            "contentBlocks": [
                block for block in source["contentBlocks"]
                if block["type"] in app_module.AI_SUPPORTED_BLOCK_TYPES
            ],
        }
        response = SimpleNamespace(output_text=json.dumps(unchanged))
        client = SimpleNamespace(responses=SimpleNamespace(create=lambda **kwargs: response))

        with patch.dict(os.environ, {"OPENAI_API_KEY": "test-key"}), patch.object(
            app_module, "create_openai_client", return_value=client
        ):
            result, error, status = app_module.request_ai_enhancement(
                app_module.AI_CUSTOM_EDIT_INSTRUCTIONS,
                "test input",
                source_article=source,
                action="custom",
            )

        self.assertIsNone(result)
        self.assertEqual(status, 422)
        self.assertIn("did not produce a change", error)

    def test_article_builder_drawer_exposes_shared_quick_actions_and_composer(self):
        template = Path(app_module.app.template_folder, "admin/blog/create_post.html").read_text(encoding="utf-8")
        script = Path(app_module.app.static_folder, "admin/blog/js/create_post.js").read_text(encoding="utf-8")
        stylesheet = Path(app_module.app.static_folder, "admin/blog/css/aiced-bot.css").read_text(encoding="utf-8")

        for action in ("seo", "readability", "shorter", "warmer_tone"):
            self.assertIn(f'data-aiced-panel-action="{action}"', template)
        for asset in ("aicedbot-seo-bars.png", "aicedbot-readability.png", "aicedbot-shorten.png", "aicedbot-tone.png"):
            self.assertIn(asset, template)
            self.assertTrue(Path(app_module.app.static_folder, "admin/blog/images/aiced-bot", asset).is_file())
        self.assertIn("aicedbot-wave.png", template)
        self.assertIn('id="aiced-panel-request"', template)
        self.assertIn('id="aiced-panel-send"', template)
        self.assertIn('aicedBackdrop.classList.add("is-open")', script)
        self.assertIn('runAiEdit("custom", aicedPanelRequest.value)', script)
        self.assertIn("aicedPanelComposer.hidden = !isIdle", script)
        self.assertIn(".aiced-backdrop.is-open .aiced-panel", stylesheet)


if __name__ == "__main__":
    unittest.main()
