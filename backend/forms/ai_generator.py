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

            field_config = f_data.get("config") or {}
            if not isinstance(field_config, dict):
                field_config = {}

            # Ensure proper type-specific validation configs
            if f_type == "rating" and "max_rating" not in field_config:
                field_config["max_rating"] = 5
            elif f_type == "file" and "allowed_extensions" not in field_config:
                field_config["allowed_extensions"] = ["pdf", "docx", "png", "jpg"]
                field_config["max_size_mb"] = field_config.get("max_size_mb", 10)
            elif f_type == "number":
                if "min_value" not in field_config:
                    field_config["min_value"] = 0

            field_label = (f_data.get("label") or f"Question {index}").strip()

            field = Field.objects.create(
                form_version=version,
                label=field_label,
                field_type=f_type,
                required=bool(f_data.get("required", False)),
                placeholder=str(f_data.get("placeholder") or ""),
                help_text=str(f_data.get("help_text") or ""),
                display_order=index,
                config=field_config,
            )
            created_fields_map[f_data.get("key", f"field_{index}")] = field

            raw_options = f_data.get("options") or []
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
        "CRITICAL RULES:\n"
        "1. Allowed field_types: ONLY ['text', 'number', 'email', 'dropdown', 'checkbox', 'date', 'rating', 'file']. "
        "Do NOT use 'radio', 'phone', or 'textarea' (use 'dropdown' for single choice, 'text' for text/paragraphs, 'checkbox' for multi-choice).\n"
        "2. Validations & Configs: Include type-specific configs (for 'file' include allowed_extensions ['pdf','docx','png'] and max_size_mb 10; for 'number' include min_value/max_value; for 'rating' include max_rating 5).\n"
        "3. Conditional Logic: Include 1 to 3 smart conditional rules linking dependent questions (e.g. if a dropdown option 'Yes' or 'Other' is chosen, show a follow-up text field).\n"
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
        "gemini-3.5-flash-lite",
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
            response = requests.post(url, headers=headers, json=payload, timeout=15)
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
        except Exception as exc:
            last_error = f"Request ({model_name}) exception: {exc}"
            logger.warning(last_error)

    raise RuntimeError(f"Gemini API generation failed: {last_error}")



def _generate_dynamic_fallback(prompt: str) -> dict:
    """
    Intelligent dynamic schema generator using ONLY FormCraft's 8 field palette types:
    ['text', 'number', 'email', 'dropdown', 'checkbox', 'date', 'rating', 'file']
    """
    lower = prompt.lower()
    title = prompt.strip().rstrip(".").title()
    if len(title) > 60:
        title = title[:57] + "..."

    # Common Contact fields
    base_contact_fields = [
        {
            "key": "full_name",
            "label": "Full Name",
            "field_type": "text",
            "required": True,
            "placeholder": "e.g. Jordan Smith",
        },
        {
            "key": "email",
            "label": "Email Address",
            "field_type": "email",
            "required": True,
            "placeholder": "jordan@example.com",
        },
        {
            "key": "contact_number",
            "label": "Contact Phone Number",
            "field_type": "text",
            "required": False,
            "placeholder": "+1 (555) 000-0000",
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
                "config": {"min": 0, "max": 40},
            },
            {
                "key": "primary_databases",
                "label": "Core Database Systems & Engines",
                "field_type": "checkbox",
                "required": True,
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
                "placeholder": "e.g. dbt, Apache Airflow, Kafka, Debezium, Liquibase, Flyway...",
            },
            {
                "key": "github_portfolio",
                "label": "GitHub / Technical Profile URL",
                "field_type": "text",
                "required": False,
                "placeholder": "https://github.com/username",
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
                "config": {"min": 0, "max": 40},
            },
            {
                "key": "frontend_stack",
                "label": "Primary Frontend Frameworks",
                "field_type": "dropdown",
                "required": True,
                "options": ["React & Next.js", "Vue.js & Nuxt", "Angular", "Svelte", "TypeScript / Vanilla"],
            },
            {
                "key": "backend_stack",
                "label": "Primary Backend Environment",
                "field_type": "dropdown",
                "required": True,
                "options": ["Node.js / Express / Nest", "Python (Django / FastAPI)", "Go (Golang)", "Java (Spring Boot)", "C# (.NET Core)"],
            },
            {
                "key": "database_skills",
                "label": "Databases & Storage Systems",
                "field_type": "checkbox",
                "required": True,
                "options": ["PostgreSQL", "MongoDB", "Redis", "MySQL", "Prisma / TypeORM / SQLAlchemy"],
            },
            {
                "key": "portfolio_url",
                "label": "Live Portfolio / Project Demos URL",
                "field_type": "text",
                "required": False,
                "placeholder": "https://yourportfolio.dev",
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
                "config": {"min": 0, "max": 40},
            },
            {
                "key": "core_languages",
                "label": "Core Programming Languages",
                "field_type": "checkbox",
                "required": True,
                "options": ["Python", "TypeScript / JavaScript", "Java", "C++ / C#", "Go", "Rust"],
            },
            {
                "key": "system_design",
                "label": "Experience with Distributed Systems & Scalable Architecture",
                "field_type": "dropdown",
                "required": True,
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
            },
            {
                "key": "github_url",
                "label": "GitHub / GitLab Profile",
                "field_type": "text",
                "required": False,
                "placeholder": "https://github.com/username",
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
            {"key": "respondent_name", "label": "Your Name (Optional)", "field_type": "text", "required": False, "placeholder": "Jane Doe"},
            {"key": "respondent_email", "label": "Email Address", "field_type": "email", "required": True, "placeholder": "jane@example.com"},
            {"key": "overall_rating", "label": "Overall Experience & Satisfaction", "field_type": "rating", "required": True, "config": {"max_rating": 5}},
            {"key": "features_used", "label": "Which features or services did you use?", "field_type": "checkbox", "required": True, "options": ["Core Platform", "Customer Support", "API & Integrations", "Billing & Plans", "Mobile App"]},
            {"key": "recommend_likelihood", "label": "How likely are you to recommend us to a friend or colleague?", "field_type": "dropdown", "required": True, "options": ["10 - Extremely Likely", "8-9 - Likely", "5-7 - Neutral", "1-4 - Unlikely"]},
            {"key": "detailed_feedback", "label": "What can we improve or do better?", "field_type": "text", "required": False, "placeholder": "Share your thoughts or suggestions..."},
            {"key": "follow_up_date", "label": "Preferred Date for Follow-up Call (if requested)", "field_type": "date", "required": False},
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
            {"key": "attendee_name", "label": "Attendee Full Name", "field_type": "text", "required": True, "placeholder": "Alex Parker"},
            {"key": "email", "label": "Email Address for Ticket Confirmation", "field_type": "email", "required": True, "placeholder": "alex@example.com"},
            {"key": "ticket_type", "label": "Select Pass / Ticket Type", "field_type": "dropdown", "required": True, "options": ["General Admission (Free)", "VIP All-Access Pass", "Virtual Attendee Livestream", "Student / Educator Pass"]},
            {"key": "sessions_interested", "label": "Sessions & Workshops You Plan to Attend", "field_type": "checkbox", "required": False, "options": ["Keynote Presentation", "Technical Deep Dive", "Panel Discussion & QA", "Networking Reception"]},
            {"key": "group_size", "label": "Number of Attendees in Your Party", "field_type": "number", "required": True, "placeholder": "1", "config": {"min": 1, "max": 10}},
            {"key": "dietary_needs", "label": "Dietary Preferences / Special Accommodations", "field_type": "dropdown", "required": False, "options": ["None", "Vegetarian", "Vegan", "Gluten-Free", "Halal / Kosher"]},
            {"key": "attendance_date", "label": "Preferred Attendance Date", "field_type": "date", "required": True},
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
            {"key": "details", "label": f"Details regarding {prompt}", "field_type": "text", "required": True, "placeholder": "Enter details here..."},
            {"key": "priority_level", "label": "Priority / Category", "field_type": "dropdown", "required": True, "options": ["Standard", "High Priority", "Urgent Inquiry"]},
            {"key": "requested_date", "label": "Requested / Preferred Date", "field_type": "date", "required": False},
            {"key": "document_attachment", "label": "Supporting Documents or Files", "field_type": "file", "required": False, "config": {"max_size_mb": 10}},
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
