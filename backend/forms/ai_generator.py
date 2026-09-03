import re
import os
import json
import logging
import requests
from decouple import config
from django.db import transaction
from .models import Form, FormVersion, ConditionalRule
from fields.models import Field, FieldOption


logger = logging.getLogger(__name__)

# Exact field types supported in FormCraft's Field Palette & DB schema
VALID_FIELD_TYPES = {
    "text", "number", "email", "dropdown", "checkbox", "date", "rating", "file"
}

# Type normalizer mapping external or unsupported types into FormCraft's palette
TYPE_NORMALIZATION = {
    "radio": "dropdown",
    "textarea": "text",
    "phone": "text",
    "url": "text",
    "select": "dropdown",
    "multiselect": "checkbox",
    "boolean": "checkbox",
    "stars": "rating",
    "attachment": "file",
}


def normalize_field_type(f_type: str) -> str:
    cleaned = (f_type or "text").lower().strip()
    if cleaned in VALID_FIELD_TYPES:
        return cleaned
    return TYPE_NORMALIZATION.get(cleaned, "text")


VALID_OPERATORS = {"equals", "not_equals", "contains", "greater_than", "is_empty"}
VALID_ACTIONS = {"show", "hide", "require"}


def infer_and_enrich_field_validations(
    f_type: str,
    label: str,
    key: str = "",
    placeholder: str = "",
    raw_config: dict = None,
    options: list = None,
) -> dict:
    """
    Intelligently infers, normalizes, and enriches format and validation properties for any field
    based on its type, label, key, placeholder, and choices.
    Strictly conforms to FormCraft's FieldConfigValidator allowed keys and constraints.
    """
    config = dict(raw_config or {})
    text_context = f"{label} {key} {placeholder}".lower()
    options = options or []

    # Map aliases / alternate naming conventions from various LLM outputs
    if "min_value" in config and "min" not in config:
        config["min"] = config.pop("min_value")
    if "max_value" in config and "max" not in config:
        config["max"] = config.pop("max_value")
    if "min_choices" in config and "min_select" not in config:
        config["min_select"] = config.pop("min_choices")
    if "max_choices" in config and "max_select" not in config:
        config["max_select"] = config.pop("max_choices")
    if "max_size" in config and "max_size_mb" not in config:
        config["max_size_mb"] = config.pop("max_size")

    if f_type == "text":
        cleaned_config = {}

        # 1. Infer text_pattern
        pattern = config.get("text_pattern")
        if pattern not in {"any", "alphanumeric", "alpha"}:
            if any(k in text_context for k in [
                "full name", "first name", "last name", "first_name", "last_name",
                "your name", "applicant name", "person name", "author", "attendee name",
                "candidate name", "city", "state", "province", "country", "nationality"
            ]):
                pattern = "alpha"
            elif any(k in text_context for k in [
                "code", "id", "passport", "license", "registration", "postal",
                "zip", "serial", "promo", "sku", "ticket number", "order number",
                "account", "reference", "username"
            ]):
                pattern = "alphanumeric"
            else:
                pattern = "any"
        cleaned_config["text_pattern"] = pattern

        # 2. Infer min_length and max_length
        min_len = config.get("min_length")
        max_len = config.get("max_length")

        if min_len is None:
            if pattern == "alpha":
                min_len = 2
            elif pattern == "alphanumeric":
                min_len = 3
            elif any(k in text_context for k in [
                "description", "details", "reason", "feedback", "bio", "essay",
                "comments", "cover letter", "message", "summary", "problem", "project"
            ]):
                min_len = 10
            elif any(k in text_context for k in ["title", "headline", "subject", "organization", "company"]):
                min_len = 2

        if max_len is None:
            if any(k in text_context for k in [
                "description", "details", "reason", "feedback", "bio", "essay",
                "comments", "cover letter", "message", "summary", "problem", "project"
            ]):
                max_len = 1000
            elif pattern == "alphanumeric":
                max_len = 30
            elif pattern == "alpha":
                max_len = 80
            else:
                max_len = 255

        if min_len is not None:
            try:
                min_len = max(0, int(min_len))
                cleaned_config["min_length"] = min_len
            except (ValueError, TypeError):
                pass

        if max_len is not None:
            try:
                max_len = max(1, int(max_len))
                if min_len is not None and min_len > max_len:
                    max_len = min_len + 50
                cleaned_config["max_length"] = max_len
            except (ValueError, TypeError):
                pass

        return cleaned_config

    elif f_type == "number":
        cleaned_config = {}
        pattern = config.get("number_pattern")
        if pattern not in {"numeric", "alphanumeric"}:
            if any(k in text_context for k in ["alphanumeric", "code", "id", "serial", "license"]):
                pattern = "alphanumeric"
            else:
                pattern = "numeric"
        cleaned_config["number_pattern"] = pattern

        # Decimal inference
        decimal = config.get("decimal")
        if decimal is None:
            if any(k in text_context for k in [
                "price", "cost", "salary", "budget", "amount", "fee", "rate",
                "revenue", "donation", "compensation", "hourly", "gpa", "weight", "height", "average"
            ]):
                decimal = True
            else:
                decimal = False
        cleaned_config["decimal"] = bool(decimal)

        # Min & Max value inference
        min_v = config.get("min")
        max_v = config.get("max")

        if min_v is None:
            if any(k in text_context for k in ["age", "years_exp", "years of experience", "experience"]):
                if "age" in text_context:
                    min_v = 18 if any(k in text_context for k in ["job", "adult", "work", "application", "employee"]) else 0
                else:
                    min_v = 0
            elif any(k in text_context for k in ["quantity", "count", "tickets", "guests", "attendees", "group_size", "party size", "seats"]):
                min_v = 1
            elif any(k in text_context for k in ["salary", "budget", "price", "amount", "cost", "score", "percentage", "rating"]):
                min_v = 0

        if max_v is None:
            if "age" in text_context:
                max_v = 120
            elif any(k in text_context for k in ["years_exp", "years of experience", "experience"]):
                max_v = 50
            elif any(k in text_context for k in ["quantity", "tickets", "guests", "attendees", "group_size", "party size"]):
                max_v = 20
            elif any(k in text_context for k in ["percentage", "percent"]):
                max_v = 100
            elif any(k in text_context for k in ["salary", "budget", "amount", "price", "cost"]):
                max_v = 10000000

        if min_v is not None:
            try:
                min_v = float(min_v) if decimal else int(float(min_v))
                cleaned_config["min"] = min_v
            except (ValueError, TypeError):
                pass

        if max_v is not None:
            try:
                max_v = float(max_v) if decimal else int(float(max_v))
                if min_v is not None and min_v > max_v:
                    max_v = min_v + 10
                cleaned_config["max"] = max_v
            except (ValueError, TypeError):
                pass

        # Digit length (for phone or fixed-digit numbers)
        min_len = config.get("min_length")
        max_len = config.get("max_length")
        if any(k in text_context for k in ["phone", "mobile", "contact number", "cell"]):
            min_len = min_len or 10
            max_len = max_len or 15
        elif any(k in text_context for k in ["zip", "postal", "pin"]):
            min_len = min_len or 4
            max_len = max_len or 10

        if min_len is not None:
            try:
                cleaned_config["min_length"] = max(0, int(min_len))
            except (ValueError, TypeError):
                pass
        if max_len is not None:
            try:
                cleaned_config["max_length"] = max(1, int(max_len))
            except (ValueError, TypeError):
                pass

        return cleaned_config

    elif f_type == "email":
        # Email field validator requires empty config
        return {}

    elif f_type == "dropdown":
        allow_other = bool(config.get("allow_other", False))
        if not allow_other and any("other" in str(opt).lower() for opt in options):
            allow_other = True
        return {"allow_other": allow_other}

    elif f_type == "checkbox":
        cleaned_config = {}
        min_select = config.get("min_select")
        max_select = config.get("max_select")

        num_options = len(options) if options else 4
        if min_select is None:
            min_select = 1
        if max_select is None and num_options > 0:
            max_select = num_options

        try:
            min_select = max(0, int(min_select))
            cleaned_config["min_select"] = min_select
        except (ValueError, TypeError):
            pass

        try:
            max_select = max(1, int(max_select))
            if min_select is not None and min_select > max_select:
                max_select = min_select
            cleaned_config["max_select"] = max_select
        except (ValueError, TypeError):
            pass

        return cleaned_config

    elif f_type == "date":
        return {}

    elif f_type == "file":
        exts = config.get("allowed_extensions")
        if not isinstance(exts, list) or not exts:
            if any(k in text_context for k in ["resume", "cv", "cover letter", "document", "contract"]):
                exts = ["pdf", "docx", "doc"]
            elif any(k in text_context for k in ["photo", "image", "picture", "avatar", "headshot"]):
                exts = ["png", "jpg", "jpeg", "webp"]
            elif any(k in text_context for k in ["portfolio", "design", "artwork"]):
                exts = ["pdf", "png", "jpg", "zip"]
            elif any(k in text_context for k in ["data", "sheet", "excel", "csv", "report"]):
                exts = ["csv", "xlsx", "pdf"]
            else:
                exts = ["pdf", "docx", "png", "jpg"]

        cleaned_exts = [str(e).lower().lstrip(".") for e in exts if str(e).strip()]
        max_size_mb = config.get("max_size_mb", 10)
        try:
            max_size_mb = max(1, int(max_size_mb))
        except (ValueError, TypeError):
            max_size_mb = 10

        return {
            "allowed_extensions": cleaned_exts,
            "max_size_mb": max_size_mb,
        }

    elif f_type == "rating":
        return {"max_rating": 5}

    return {}


def generate_form_from_idea(idea: str, user):
    """
    Dynamically generates a complete form with fields, options, validation configs,
    and conditional logic rules based on a natural language idea/prompt.
    Uses Google Gemini AI if GEMINI_API_KEY is available, or an advanced
    dynamic schema synthesizer fallback.
    """
    idea_clean = (idea or "").strip()
    if not idea_clean:
        idea_clean = "General Inquiry and Feedback Form"

    schema = None
    gemini_key = config("GEMINI_API_KEY", default=os.getenv("GEMINI_API_KEY", "")).strip()

    if gemini_key:
        try:
            schema = _generate_with_gemini(idea_clean, gemini_key)
            logger.info("Successfully generated form schema using Google Gemini AI.")
        except Exception as exc:
            logger.warning(f"Gemini AI generation error: {exc}. Using intelligent dynamic fallback generator.")
            schema = None

    if not schema:
        schema = _generate_dynamic_fallback(idea_clean)

    with transaction.atomic():
        form = Form.objects.create(
            title=schema["title"],
            description=schema.get("description", ""),
            status="draft",
            owner=user,
        )

        version = FormVersion.objects.create(
            form=form,
            version=1,
            status="draft",
            is_active=True,
        )

        created_fields_map = {}
        fields_list = schema.get("fields") or []
        for index, f_data in enumerate(fields_list, start=1):
            if not isinstance(f_data, dict):
                continue

            raw_type = f_data.get("field_type", "text")
            f_type = normalize_field_type(raw_type)

            field_label = (f_data.get("label") or f"Question {index}").strip()
            field_key = str(f_data.get("key") or f"field_{index}").strip()
            field_placeholder = str(f_data.get("placeholder") or "")
            field_help = str(f_data.get("help_text") or "")
            raw_options = f_data.get("options") or []

            # Enrich and infer intelligent validation and format rules
            field_config = infer_and_enrich_field_validations(
                f_type=f_type,
                label=field_label,
                key=field_key,
                placeholder=field_placeholder,
                raw_config=f_data.get("config"),
                options=raw_options,
            )

            field = Field.objects.create(
                form_version=version,
                label=field_label,
                field_type=f_type,
                required=bool(f_data.get("required", False)),
                placeholder=field_placeholder,
                help_text=field_help,
                display_order=index,
                config=field_config,
            )
            created_fields_map[field_key] = field

            for opt_index, opt in enumerate(raw_options, start=1):
                if isinstance(opt, dict):
                    opt_label = opt.get("label", "")
                    opt_value = opt.get("value", opt_label)
                else:
                    opt_label = str(opt)
                    opt_value = str(opt)

                if opt_label:
                    FieldOption.objects.create(
                        field=field,
                        label=opt_label,
                        value=opt_value,
                        display_order=opt_index,
                    )

        # Create conditional rules with strict operator and action validation
        rules_list = schema.get("conditional_rules") or []
        for r_data in rules_list:
            if not isinstance(r_data, dict):
                continue
            trigger = created_fields_map.get(r_data.get("trigger_key"))
            target = created_fields_map.get(r_data.get("target_key"))
            if trigger and target:
                op = str(r_data.get("operator", "equals")).lower().strip()
                if op not in VALID_OPERATORS:
                    op = "equals"
                act = str(r_data.get("action", "show")).lower().strip()
                if act not in VALID_ACTIONS:
                    act = "show"

                ConditionalRule.objects.create(
                    form_version=version,
                    trigger_field=trigger,
                    target_field=target,
                    operator=op,
                    comparison_value=r_data.get("comparison_value"),
                    action=act,
                )

        return form


def _generate_with_gemini(prompt: str, api_key: str) -> dict:
    """
    Calls Google Gemini AI API adhering to FormCraft's exact field types and validation configs.
    Supports both modern google-genai SDK and raw REST API with strict 'x-goog-api-key' header
    (fully compatible with new 'AQ.' and legacy 'AIza' keys).
    """
    clean_key = (api_key or "").strip()
    if not clean_key:
        raise ValueError("GEMINI_API_KEY is empty.")

    full_prompt = (
        "You are an expert Form Architect for FormCraft. Generate a rich, complete, professional form schema "
        f"tailored specifically and dynamically to the user's prompt: '{prompt}'.\n\n"
        "CRITICAL RULES & FORMAT / VALIDATION CONFIGURATIONS:\n"
        "1. Allowed field_types: ONLY ['text', 'number', 'email', 'dropdown', 'checkbox', 'date', 'rating', 'file']. "
        "Do NOT use 'radio', 'phone', or 'textarea' (use 'dropdown' for single choice, 'text' for text/paragraphs, 'checkbox' for multi-choice).\n"
        "2. Automatically Pick Validation Rules & Format Properties for Every Field in 'config':\n"
        "   - 'text':\n"
        "     * Person names, locations, country, city -> config: {\"text_pattern\": \"alpha\", \"min_length\": 2, \"max_length\": 80}\n"
        "     * Codes, IDs, license, passport, postal code, promo, SKU -> config: {\"text_pattern\": \"alphanumeric\", \"min_length\": 3, \"max_length\": 25}\n"
        "     * Short text, title, company, subject, address -> config: {\"text_pattern\": \"any\", \"min_length\": 2, \"max_length\": 120}\n"
        "     * Long text, bio, description, feedback, essay, explanation -> config: {\"text_pattern\": \"any\", \"min_length\": 10, \"max_length\": 1000}\n"
        "   - 'number':\n"
        "     * Age -> config: {\"min\": 18, \"max\": 120, \"decimal\": false, \"number_pattern\": \"numeric\"}\n"
        "     * Experience / years -> config: {\"min\": 0, \"max\": 45, \"decimal\": false, \"number_pattern\": \"numeric\"}\n"
        "     * Quantity / tickets / attendees / group size -> config: {\"min\": 1, \"max\": 20, \"decimal\": false, \"number_pattern\": \"numeric\"}\n"
        "     * Price / salary / budget / fee / cost / amount -> config: {\"min\": 0, \"decimal\": true, \"number_pattern\": \"numeric\"}\n"
        "     * Phone / mobile / digits -> config: {\"number_pattern\": \"numeric\", \"min_length\": 10, \"max_length\": 15}\n"
        "   - 'email': config: {}\n"
        "   - 'dropdown': config: {\"allow_other\": false}, provide 3 to 6 realistic options\n"
        "   - 'checkbox': config: {\"min_select\": 1, \"max_select\": 4}, provide 3 to 8 multi-select options\n"
        "   - 'date': config: {}\n"
        "   - 'rating': config: {\"max_rating\": 5}\n"
        "   - 'file': config: {\"allowed_extensions\": [\"pdf\", \"docx\", \"doc\"], \"max_size_mb\": 10} (or [\"pdf\", \"png\", \"jpg\"] for media)\n"
        "3. Conditional Logic: Include 1 to 3 smart conditional rules linking dependent questions.\n"
        "4. Output ONLY valid JSON adhering to this exact schema:\n"
        "{\n"
        '  "title": "Clear Form Title",\n'
        '  "description": "Engaging description explaining purpose of the form",\n'
        '  "fields": [\n'
        '    {\n'
        '      "key": "unique_str_key_like_full_name",\n'
        '      "label": "Human readable question label",\n'
        '      "field_type": "text|number|email|dropdown|checkbox|date|rating|file",\n'
        '      "required": true,\n'
        '      "placeholder": "Helpful placeholder",\n'
        '      "help_text": "Short guidance text",\n'
        '      "options": ["Option 1", "Option 2"],\n'
        '      "config": {}\n'
        '    }\n'
        '  ],\n'
        '  "conditional_rules": [\n'
        '    {\n'
        '      "trigger_key": "key_of_trigger_field",\n'
        '      "target_key": "key_of_target_field",\n'
        '      "operator": "equals|not_equals|contains",\n'
        '      "comparison_value": "Trigger Option Value",\n'
        '      "action": "show|hide|require"\n'
        '    }\n'
        '  ]\n'
        "}"
    )

    models = [
        "gemini-3.5-flash",
        "gemini-3.6-flash",
    ]

    last_error = None
    headers = {
        "Content-Type": "application/json",
        "x-goog-api-key": clean_key,
    }

    for model_name in models:
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{model_name}:generateContent"
        payload = {
            "contents": [
                {
                    "parts": [
                        {"text": full_prompt}
                    ]
                }
            ],
            "generationConfig": {
                "responseMimeType": "application/json",
                "temperature": 0.2,
            }
        }

        try:
            # 22-second timeout gives Google Gemini ample time to synthesize full schemas with fields and logic
            response = requests.post(url, headers=headers, json=payload, timeout=22)
            if response.status_code == 200:
                data = response.json()
                candidates = data.get("candidates") or []
                if candidates:
                    parts = candidates[0].get("content", {}).get("parts") or []
                    if parts:
                        text = parts[0].get("text", "")
                        cleaned_text = re.sub(r"^```json\s*", "", text.strip())
                        cleaned_text = re.sub(r"```$", "", cleaned_text.strip())
                        schema = json.loads(cleaned_text)
                        if schema.get("title") and schema.get("fields"):
                            return schema
            elif response.status_code in (400, 401, 403):
                last_error = f"Auth/Client Error ({model_name}) {response.status_code}: {response.text[:200]}"
                logger.warning(last_error)
                break
            else:
                last_error = f"Model {model_name} returned status {response.status_code}: {response.text[:200]}"
                logger.warning(last_error)
        except requests.exceptions.Timeout:
            last_error = f"Model {model_name} timed out after 22s."
            logger.warning(last_error)
            break
        except Exception as exc:
            last_error = f"Request ({model_name}) exception: {exc}"
            logger.warning(last_error)

    raise RuntimeError(f"Gemini API generation failed: {last_error}")



def _generate_dynamic_fallback(prompt: str) -> dict:
    """
    Intelligent dynamic schema generator using ONLY FormCraft's 8 field palette types:
    ['text', 'number', 'email', 'dropdown', 'checkbox', 'date', 'rating', 'file']
    Equipped with complete format, boundary, and validation properties for every field.
    """
    lower = prompt.lower()
    title = prompt.strip().rstrip(".").title()
    if len(title) > 60:
        title = title[:57] + "..."

    # Common Contact fields with exact validation rules
    base_contact_fields = [
        {
            "key": "full_name",
            "label": "Full Name",
            "field_type": "text",
            "required": True,
            "placeholder": "e.g. Jordan Smith",
            "help_text": "Please enter your full name (letters only).",
            "config": {"text_pattern": "alpha", "min_length": 2, "max_length": 80},
        },
        {
            "key": "email",
            "label": "Email Address",
            "field_type": "email",
            "required": True,
            "placeholder": "jordan@example.com",
            "help_text": "We will send confirmations to this email.",
            "config": {},
        },
        {
            "key": "contact_number",
            "label": "Contact Phone Number",
            "field_type": "text",
            "required": False,
            "placeholder": "+1 (555) 000-0000",
            "help_text": "Optional direct contact number.",
            "config": {"min_length": 7, "max_length": 20, "text_pattern": "any"},
        },
    ]

    # DOMAIN 1: Database Engineer / DBA / SQL / Data Architect
    if any(k in lower for k in ["database", "dba", "sql", "data engineer", "data warehouse", "etl", "nosql"]):
        fields = base_contact_fields + [
            {
                "key": "years_exp",
                "label": "Years of Database Engineering Experience",
                "field_type": "number",
                "required": True,
                "placeholder": "e.g. 5",
                "help_text": "Number of years in professional database administration.",
                "config": {"min": 0, "max": 40, "decimal": False, "number_pattern": "numeric"},
            },
            {
                "key": "primary_databases",
                "label": "Core Database Systems & Engines",
                "field_type": "checkbox",
                "required": True,
                "help_text": "Select all database technologies you have deployed in production.",
                "config": {"min_select": 1, "max_select": 9},
                "options": [
                    "PostgreSQL", "MySQL / MariaDB", "MongoDB", "Redis",
                    "Oracle Database", "Microsoft SQL Server", "Cassandra / ScyllaDB",
                    "Snowflake / BigQuery", "DynamoDB"
                ],
            },
            {
                "key": "query_tuning",
                "label": "SQL Query Optimization & Indexing Proficiency",
                "field_type": "dropdown",
                "required": True,
                "help_text": "Select your level of query performance tuning expertise.",
                "config": {"allow_other": False},
                "options": [
                    "Expert (Execution Plan Analysis, Partitioning & Sharding)",
                    "Advanced (Complex CTEs, Window Functions, Index Tuning)",
                    "Intermediate (Standard SQL Joins & Schema Design)",
                    "Basic / Familiar"
                ],
            },
            {
                "key": "ha_experience",
                "label": "High Availability (HA), Replication & Clustering Experience?",
                "field_type": "dropdown",
                "required": True,
                "config": {"allow_other": False},
                "options": [
                    "Yes - Multi-Region Active/Active & Automated Failover",
                    "Yes - Standard Master-Replica Setup",
                    "No - Learning High Availability"
                ],
            },
            {
                "key": "etl_tools",
                "label": "Data Pipeline, Migration & ETL Tooling",
                "field_type": "text",
                "required": False,
                "placeholder": "e.g. dbt, Apache Airflow, Kafka, Debezium, Liquibase...",
                "config": {"min_length": 2, "max_length": 500, "text_pattern": "any"},
            },
            {
                "key": "github_portfolio",
                "label": "GitHub / Technical Profile URL",
                "field_type": "text",
                "required": False,
                "placeholder": "https://github.com/username",
                "config": {"min_length": 5, "max_length": 200, "text_pattern": "any"},
            },
            {
                "key": "resume_upload",
                "label": "Upload Resume / Technical CV (PDF/DOCX)",
                "field_type": "file",
                "required": True,
                "config": {"allowed_extensions": ["pdf", "docx", "doc"], "max_size_mb": 10},
            },
            {
                "key": "db_performance_rating",
                "label": "Self-Assessment in Performance Tuning & Capacity Planning",
                "field_type": "rating",
                "required": False,
                "config": {"max_rating": 5},
            },
            {
                "key": "earliest_start",
                "label": "Earliest Available Start Date",
                "field_type": "date",
                "required": True,
                "config": {},
            },
        ]

        return {
            "title": title if "Application" in title else f"{title} Application",
            "description": f"Submit your application for the {title} role. Please detail your database architecture, indexing, and clustering expertise.",
            "fields": fields,
            "conditional_rules": [
                {
                    "trigger_key": "ha_experience",
                    "target_key": "resume_upload",
                    "operator": "equals",
                    "comparison_value": "Yes - Multi-Region Active/Active & Automated Failover",
                    "action": "show",
                },
            ],
        }

    # DOMAIN 2: Full Stack Developer
    if any(k in lower for k in ["full stack", "fullstack", "full-stack"]):
        fields = base_contact_fields + [
            {
                "key": "years_exp",
                "label": "Years of Full Stack Development Experience",
                "field_type": "number",
                "required": True,
                "placeholder": "e.g. 4",
                "config": {"min": 0, "max": 40, "decimal": False, "number_pattern": "numeric"},
            },
            {
                "key": "frontend_stack",
                "label": "Primary Frontend Frameworks",
                "field_type": "dropdown",
                "required": True,
                "config": {"allow_other": False},
                "options": ["React & Next.js", "Vue.js & Nuxt", "Angular", "Svelte", "TypeScript / Vanilla"],
            },
            {
                "key": "backend_stack",
                "label": "Primary Backend Environment",
                "field_type": "dropdown",
                "required": True,
                "config": {"allow_other": False},
                "options": ["Node.js / Express / Nest", "Python (Django / FastAPI)", "Go (Golang)", "Java (Spring Boot)", "C# (.NET Core)"],
            },
            {
                "key": "database_skills",
                "label": "Databases & Storage Systems",
                "field_type": "checkbox",
                "required": True,
                "config": {"min_select": 1, "max_select": 5},
                "options": ["PostgreSQL", "MongoDB", "Redis", "MySQL", "Prisma / TypeORM / SQLAlchemy"],
            },
            {
                "key": "portfolio_url",
                "label": "Live Portfolio / Project Demos URL",
                "field_type": "text",
                "required": False,
                "placeholder": "https://yourportfolio.dev",
                "config": {"min_length": 5, "max_length": 255, "text_pattern": "any"},
            },
            {
                "key": "resume_upload",
                "label": "Upload Resume / CV (PDF/DOCX)",
                "field_type": "file",
                "required": True,
                "config": {"allowed_extensions": ["pdf", "docx", "doc"], "max_size_mb": 10},
            },
            {
                "key": "fullstack_rating",
                "label": "End-to-End Application Architecture Self-Rating",
                "field_type": "rating",
                "required": False,
                "config": {"max_rating": 5},
            },
            {
                "key": "earliest_start",
                "label": "Earliest Available Start Date",
                "field_type": "date",
                "required": True,
                "config": {},
            },
        ]
        return {
            "title": title if "Application" in title else f"{title} Application",
            "description": f"Apply for the {title} position. Please specify your frontend, backend, and database proficiency.",
            "fields": fields,
            "conditional_rules": [
                {
                    "trigger_key": "frontend_stack",
                    "target_key": "portfolio_url",
                    "operator": "equals",
                    "comparison_value": "React & Next.js",
                    "action": "show",
                },
            ],
        }

    # DOMAIN 3: Software Engineer (General / Specialized)
    if any(k in lower for k in ["software engineer", "developer", "engineer", "programmer", "coder"]):
        fields = base_contact_fields + [
            {
                "key": "years_exp",
                "label": "Years of Professional Software Engineering Experience",
                "field_type": "number",
                "required": True,
                "placeholder": "e.g. 3",
                "config": {"min": 0, "max": 40, "decimal": False, "number_pattern": "numeric"},
            },
            {
                "key": "core_languages",
                "label": "Core Programming Languages",
                "field_type": "checkbox",
                "required": True,
                "config": {"min_select": 1, "max_select": 6},
                "options": ["Python", "TypeScript / JavaScript", "Java", "C++ / C#", "Go", "Rust"],
            },
            {
                "key": "system_design",
                "label": "Experience with Distributed Systems & Scalable Architecture",
                "field_type": "dropdown",
                "required": True,
                "config": {"allow_other": False},
                "options": [
                    "Extensive (Designed high-concurrency microservices)",
                    "Moderate (Maintained distributed services & caching)",
                    "Junior / Developing"
                ],
            },
            {
                "key": "complex_project",
                "label": "Describe a challenging engineering problem or system you built",
                "field_type": "text",
                "required": False,
                "placeholder": "Explain the architecture, trade-offs, and technical solutions...",
                "config": {"min_length": 10, "max_length": 1500, "text_pattern": "any"},
            },
            {
                "key": "github_url",
                "label": "GitHub / GitLab Profile",
                "field_type": "text",
                "required": False,
                "placeholder": "https://github.com/username",
                "config": {"min_length": 5, "max_length": 200, "text_pattern": "any"},
            },
            {
                "key": "resume_upload",
                "label": "Upload Resume / CV (PDF/DOCX)",
                "field_type": "file",
                "required": True,
                "config": {"allowed_extensions": ["pdf", "docx", "doc"], "max_size_mb": 10},
            },
            {
                "key": "problem_solving_rating",
                "label": "Self-Assessment in Algorithms & Problem Solving",
                "field_type": "rating",
                "required": False,
                "config": {"max_rating": 5},
            },
            {
                "key": "earliest_start",
                "label": "Earliest Available Start Date",
                "field_type": "date",
                "required": True,
                "config": {},
            },
        ]
        return {
            "title": title if "Application" in title else f"{title} Application",
            "description": f"Submit your application for the {title} position.",
            "fields": fields,
            "conditional_rules": [
                {
                    "trigger_key": "years_exp",
                    "target_key": "complex_project",
                    "operator": "greater_than",
                    "comparison_value": 2,
                    "action": "show",
                },
            ],
        }

    # DOMAIN 4: Feedback / Survey
    if any(k in lower for k in ["feedback", "survey", "review", "satisfaction", "nps", "rating"]):
        fields = [
            {"key": "respondent_name", "label": "Your Name (Optional)", "field_type": "text", "required": False, "placeholder": "Jane Doe", "config": {"text_pattern": "alpha", "min_length": 2, "max_length": 80}},
            {"key": "respondent_email", "label": "Email Address", "field_type": "email", "required": True, "placeholder": "jane@example.com", "config": {}},
            {"key": "overall_rating", "label": "Overall Experience & Satisfaction", "field_type": "rating", "required": True, "config": {"max_rating": 5}},
            {"key": "features_used", "label": "Which features or services did you use?", "field_type": "checkbox", "required": True, "config": {"min_select": 1, "max_select": 5}, "options": ["Core Platform", "Customer Support", "API & Integrations", "Billing & Plans", "Mobile App"]},
            {"key": "recommend_likelihood", "label": "How likely are you to recommend us to a friend or colleague?", "field_type": "dropdown", "required": True, "config": {"allow_other": False}, "options": ["10 - Extremely Likely", "8-9 - Likely", "5-7 - Neutral", "1-4 - Unlikely"]},
            {"key": "detailed_feedback", "label": "What can we improve or do better?", "field_type": "text", "required": False, "placeholder": "Share your thoughts or suggestions...", "config": {"min_length": 5, "max_length": 1000, "text_pattern": "any"}},
            {"key": "follow_up_date", "label": "Preferred Date for Follow-up Call (if requested)", "field_type": "date", "required": False, "config": {}},
        ]
        return {
            "title": title if "Feedback" in title or "Survey" in title else f"{title} Survey",
            "description": "We value your feedback. Please take a moment to share your experience with us.",
            "fields": fields,
            "conditional_rules": [
                {
                    "trigger_key": "overall_rating",
                    "target_key": "detailed_feedback",
                    "operator": "not_equals",
                    "comparison_value": 5,
                    "action": "show",
                },
            ],
        }

    # DOMAIN 5: Event / RSVP / Webinar
    if any(k in lower for k in ["event", "rsvp", "webinar", "conference", "party", "ticket", "attendee"]):
        fields = [
            {"key": "attendee_name", "label": "Attendee Full Name", "field_type": "text", "required": True, "placeholder": "Alex Parker", "config": {"text_pattern": "alpha", "min_length": 2, "max_length": 80}},
            {"key": "email", "label": "Email Address for Ticket Confirmation", "field_type": "email", "required": True, "placeholder": "alex@example.com", "config": {}},
            {"key": "ticket_type", "label": "Select Pass / Ticket Type", "field_type": "dropdown", "required": True, "config": {"allow_other": False}, "options": ["General Admission (Free)", "VIP All-Access Pass", "Virtual Attendee Livestream", "Student / Educator Pass"]},
            {"key": "sessions_interested", "label": "Sessions & Workshops You Plan to Attend", "field_type": "checkbox", "required": False, "config": {"min_select": 1, "max_select": 4}, "options": ["Keynote Presentation", "Technical Deep Dive", "Panel Discussion & QA", "Networking Reception"]},
            {"key": "group_size", "label": "Number of Attendees in Your Party", "field_type": "number", "required": True, "placeholder": "1", "config": {"min": 1, "max": 10, "decimal": False, "number_pattern": "numeric"}},
            {"key": "dietary_needs", "label": "Dietary Preferences / Special Accommodations", "field_type": "dropdown", "required": False, "config": {"allow_other": True}, "options": ["None", "Vegetarian", "Vegan", "Gluten-Free", "Halal / Kosher"]},
            {"key": "attendance_date", "label": "Preferred Attendance Date", "field_type": "date", "required": True, "config": {}},
        ]
        return {
            "title": title if "RSVP" in title or "Registration" in title else f"{title} Registration",
            "description": "Reserve your spot for the event. Please confirm your details below.",
            "fields": fields,
            "conditional_rules": [
                {
                    "trigger_key": "ticket_type",
                    "target_key": "dietary_needs",
                    "operator": "not_equals",
                    "comparison_value": "Virtual Attendee Livestream",
                    "action": "show",
                },
            ],
        }

    # DEFAULT VERSATILE DYNAMIC FORM (Guaranteed to use only FormCraft's 8 field types)
    return {
        "title": title,
        "description": f"Please provide your information for: {prompt}",
        "fields": base_contact_fields + [
            {"key": "details", "label": f"Details regarding {prompt}", "field_type": "text", "required": True, "placeholder": "Enter details here...", "config": {"min_length": 5, "max_length": 1000, "text_pattern": "any"}},
            {"key": "priority_level", "label": "Priority / Category", "field_type": "dropdown", "required": True, "config": {"allow_other": False}, "options": ["Standard", "High Priority", "Urgent Inquiry"]},
            {"key": "requested_date", "label": "Requested / Preferred Date", "field_type": "date", "required": False, "config": {}},
            {"key": "document_attachment", "label": "Supporting Documents or Files", "field_type": "file", "required": False, "config": {"allowed_extensions": ["pdf", "docx", "png", "jpg"], "max_size_mb": 10}},
            {"key": "satisfaction_rating", "label": "Overall Satisfaction / Urgency Rating", "field_type": "rating", "required": False, "config": {"max_rating": 5}},
        ],
        "conditional_rules": [
            {
                "trigger_key": "priority_level",
                "target_key": "document_attachment",
                "operator": "equals",
                "comparison_value": "Urgent Inquiry",
                "action": "show",
            },
        ],
    }
