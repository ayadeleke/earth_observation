from types import SimpleNamespace
from unittest.mock import Mock

from django.core.cache import cache
from django.test import SimpleTestCase, override_settings

from .ai_views import AIQueryView

USER = SimpleNamespace(pk=1, is_authenticated=True)


# Tests normally use DummyCache, while Render uses the in-memory cache
@override_settings(
    AI_ASSISTANT_DAILY_LIMIT=2,
    CACHES={"default": {"BACKEND": "django.core.cache.backends.locmem.LocMemCache", "LOCATION": "ai-tests"}},
)
class GeminiUsageTest(SimpleTestCase):
    def setUp(self):
        cache.clear()
        self.view = AIQueryView()
        self.view.ai_available = True
        self.view.ai_provider = "gemini"
        self.view.model_name = "gemini-flash-lite-latest"
        self.view.gemini_model = Mock()
        self.view.gemini_model.generate_content.return_value = Mock(text="NDVI measures vegetation.")

    def ask(self, message="What is NDVI?", context=None):
        return self.view._generate_ai_response(message, {}, context or [], USER)

    def test_repeated_opening_question_reuses_the_answer(self):
        self.assertEqual(self.ask()["content"], "NDVI measures vegetation.")
        self.assertEqual(self.ask(" what is ndvi? ")["content"], "NDVI measures vegetation.")
        self.assertEqual(self.view.gemini_model.generate_content.call_count, 1)

    def test_follow_up_questions_are_not_reused(self):
        context = [{"type": "user", "content": "Hello"}]
        self.ask(context=context)
        self.ask(context=context)
        self.assertEqual(self.view.gemini_model.generate_content.call_count, 2)

    def test_daily_limit_falls_back_to_the_knowledge_base(self):
        self.ask("What is NDVI?")
        self.ask("What is LST?")
        answer = self.ask("What is SAR?")["content"]
        self.assertEqual(self.view.gemini_model.generate_content.call_count, 2)
        self.assertIn("You've used today's 2 AI questions", answer)

    def test_used_up_allowance_is_not_retried(self):
        self.view.gemini_model.generate_content.side_effect = Exception("429 You exceeded your current quota")
        answer = self.ask()["content"]
        self.assertEqual(self.view.gemini_model.generate_content.call_args.kwargs["request_options"]["retry"], None)
        self.assertIn("API quota limits", answer)
        self.assertIsNone(cache.get(self.view._answer_cache_key("What is NDVI?", self.view._extract_analysis_summary({}))))
