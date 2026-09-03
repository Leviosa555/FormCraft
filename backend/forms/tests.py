from django.http import QueryDict
from django.test import SimpleTestCase

from .ai_generator import VALID_FIELD_TYPES, _generate_dynamic_fallback
from .serializers import SubmissionSerializer


class SubmissionSerializerTests(SimpleTestCase):
    def test_accepts_json_responses_string_from_multipart_querydict(self):
        """Regression test for multipart responses being reported as required."""
        payload = QueryDict("", mutable=True)
        payload["responses"] = (
            '[{"field": 159, "value": "yes"}, '
            '{"field": 160, "value": "ABCDE"}, '
            '{"field": 161, "value": "person@example.com"}]'
        )

        serializer = SubmissionSerializer(data=payload)

        self.assertTrue(serializer.is_valid(), serializer.errors)
        self.assertEqual(serializer.validated_data["responses"][0]["field"], 159)
        self.assertEqual(serializer.validated_data["responses"][1]["value"], "ABCDE")

    def test_rejects_invalid_multipart_responses_json(self):
        payload = QueryDict("responses=not-json", mutable=True)

        serializer = SubmissionSerializer(data=payload)

        self.assertFalse(serializer.is_valid())
        self.assertIn("responses", serializer.errors)


class DynamicFallbackGeneratorTests(SimpleTestCase):
    def test_fallback_forms_use_palette_types_and_conditional_rules(self):
        prompts = [
            "database engineer application",
            "full stack developer application",
            "software engineer application",
            "customer feedback survey",
            "event RSVP",
            "equipment request",
        ]
        supported_operators = {"equals", "not_equals", "greater_than", "contains", "is_empty"}

        for prompt in prompts:
            with self.subTest(prompt=prompt):
                schema = _generate_dynamic_fallback(prompt)
                field_keys = {field["key"] for field in schema["fields"]}

                self.assertTrue(schema["conditional_rules"])
                self.assertTrue(
                    all(field["field_type"] in VALID_FIELD_TYPES for field in schema["fields"])
                )
                self.assertTrue(
                    all(
                        rule["trigger_key"] in field_keys
                        and rule["target_key"] in field_keys
                        and rule["operator"] in supported_operators
                        for rule in schema["conditional_rules"]
                    )
                )

    def test_fallback_number_limits_match_validation_config(self):
        schema = _generate_dynamic_fallback("event RSVP")
        group_size = next(field for field in schema["fields"] if field["key"] == "group_size")

        self.assertEqual(group_size["config"]["min"], 1)
        self.assertEqual(group_size["config"]["max"], 10)
        self.assertEqual(group_size["config"]["decimal"], False)
        self.assertEqual(group_size["config"]["number_pattern"], "numeric")

    def test_infer_and_enrich_field_validations(self):
        from .ai_generator import infer_and_enrich_field_validations
        from fields.validators import FieldConfigValidator

        # Text name field
        text_cfg = infer_and_enrich_field_validations("text", "Full Name", "full_name")
        self.assertEqual(text_cfg["text_pattern"], "alpha")
        self.assertGreaterEqual(text_cfg["min_length"], 2)
        FieldConfigValidator.validate("text", text_cfg)

        # Alphanumeric text field
        code_cfg = infer_and_enrich_field_validations("text", "Passport ID / Promo Code", "passport_id")
        self.assertEqual(code_cfg["text_pattern"], "alphanumeric")
        FieldConfigValidator.validate("text", code_cfg)

        # Number currency/salary field
        salary_cfg = infer_and_enrich_field_validations("number", "Expected Annual Salary ($)", "salary")
        self.assertTrue(salary_cfg["decimal"])
        self.assertEqual(salary_cfg["min"], 0)
        FieldConfigValidator.validate("number", salary_cfg)

        # Checkbox field
        cb_cfg = infer_and_enrich_field_validations("checkbox", "Preferred Tech Stack", "stack", options=["React", "Vue", "Angular"])
        self.assertEqual(cb_cfg["min_select"], 1)
        self.assertEqual(cb_cfg["max_select"], 3)
        FieldConfigValidator.validate("checkbox", cb_cfg)

        # File resume field
        file_cfg = infer_and_enrich_field_validations("file", "Upload Technical Resume", "resume")
        self.assertIn("pdf", file_cfg["allowed_extensions"])
        self.assertEqual(file_cfg["max_size_mb"], 10)
        FieldConfigValidator.validate("file", file_cfg)

