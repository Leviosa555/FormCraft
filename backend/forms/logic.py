"""Conditional-rule evaluation and server-side response validation."""
from datetime import date
from numbers import Number

from django.core.validators import validate_email
from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework.exceptions import ValidationError


def is_empty(value):
    return value is None or value == "" or (isinstance(value, (list, tuple, dict)) and not value)


def rule_matches(rule, value):
    if rule.operator == "is_empty":
        return is_empty(value)
    if rule.operator == "equals":
        if isinstance(value, str) and isinstance(rule.comparison_value, str):
            return value.strip().lower() == rule.comparison_value.strip().lower()
        return value == rule.comparison_value
    if rule.operator == "not_equals":
        if isinstance(value, str) and isinstance(rule.comparison_value, str):
            return value.strip().lower() != rule.comparison_value.strip().lower()
        return value != rule.comparison_value
    if rule.operator == "contains":
        if isinstance(value, str) and isinstance(rule.comparison_value, str):
            return rule.comparison_value.strip().lower() in value.lower()
        elif isinstance(value, list):
            target = str(rule.comparison_value).strip().lower()
            return any(str(v).strip().lower() == target for v in value)
        return rule.comparison_value in value if isinstance(value, (str, list)) else False
    if rule.operator == "greater_than":
        try:
            return float(value) > float(rule.comparison_value)
        except (TypeError, ValueError):
            return False
    return False



def evaluate_rules(fields, rules, values):
    """Return each field's effective visibility and required state."""
    # Find which fields are targeted by a "show" rule
    fields_targeted_by_show = {rule.target_field_id for rule in rules if rule.action == "show"}

    # Initialize state: if a field is targeted by a "show" rule, it starts hidden.
    # Otherwise, it starts as visible.
    state = {}
    for field in fields:
        is_targeted_by_show = field.id in fields_targeted_by_show
        state[field.id] = {
            "visible": not is_targeted_by_show,
            "required": field.required
        }

    for rule in rules:
        if rule_matches(rule, values.get(rule.trigger_field_id)):
            target = state[rule.target_field_id]
            if rule.action == "show":
                target["visible"] = True
            elif rule.action == "hide":
                target["visible"] = False
            elif rule.action == "require":
                target["required"] = True
    return state


def validate_value(field, value, uploaded_file=None):
    """Validate a non-empty response against its field schema."""
    if uploaded_file is not None:
        config = field.config or {}
        extensions = [ext.lower().lstrip(".") for ext in config.get("allowed_extensions", [])]
        extension = uploaded_file.name.rsplit(".", 1)[-1].lower() if "." in uploaded_file.name else ""
        if extensions and extension not in extensions:
            raise ValidationError("This file type is not allowed.")
        max_size = config.get("max_size_mb")
        if max_size and uploaded_file.size > max_size * 1024 * 1024:
            raise ValidationError("This file exceeds the maximum allowed size.")
        return

    config = field.config or {}
    if field.field_type == "text":
        if not isinstance(value, str):
            raise ValidationError("Enter text.")
        if config.get("min_length") is not None and len(value) < config["min_length"]:
            raise ValidationError(f"Must contain at least {config['min_length']} characters.")
        if config.get("max_length") is not None and len(value) > config["max_length"]:
            raise ValidationError(f"Must contain no more than {config['max_length']} characters.")
        
        text_pattern = config.get("text_pattern")
        if text_pattern == "alphanumeric":
            if not value.isalnum():
                raise ValidationError("Must contain letters and numbers only.")
        elif text_pattern == "alpha":
            if not value.replace(" ", "").isalpha():
                raise ValidationError("Must contain letters only.")
    elif field.field_type == "email":
        if not isinstance(value, str):
            raise ValidationError("Enter a valid email address.")
        try:
            validate_email(value)
        except DjangoValidationError:
            raise ValidationError("Enter a valid email address.")
    elif field.field_type == "number":
        number_pattern = config.get("number_pattern", "numeric")
        if number_pattern == "alphanumeric":
            val_str = str(value)
            if not val_str.isalnum():
                raise ValidationError("Must contain letters and numbers only.")
            if config.get("min_length") is not None and len(val_str) < config["min_length"]:
                raise ValidationError(f"Must contain at least {config['min_length']} characters.")
            if config.get("max_length") is not None and len(val_str) > config["max_length"]:
                raise ValidationError(f"Must contain no more than {config['max_length']} characters.")
        else:
            if isinstance(value, bool):
                raise ValidationError("Enter a number.")
            
            parsed_val = None
            if isinstance(value, Number):
                parsed_val = value
            elif isinstance(value, str):
                try:
                    parsed_val = float(value) if "." in value else int(value)
                except ValueError:
                    raise ValidationError("Enter a number.")
            else:
                raise ValidationError("Enter a number.")

            if not config.get("decimal", False) and int(parsed_val) != parsed_val:
                raise ValidationError("Enter a whole number.")
            if config.get("min") is not None and parsed_val < config["min"]:
                raise ValidationError(f"Must be at least {config['min']}.")
            if config.get("max") is not None and parsed_val > config["max"]:
                raise ValidationError(f"Must be no more than {config['max']}.")
            
            val_str = str(value)
            if config.get("min_length") is not None and len(val_str) < config["min_length"]:
                raise ValidationError(f"Must contain at least {config['min_length']} digits.")
            if config.get("max_length") is not None and len(val_str) > config["max_length"]:
                raise ValidationError(f"Must contain no more than {config['max_length']} digits.")
    elif field.field_type == "date":
        if not isinstance(value, str):
            raise ValidationError("Enter a valid date.")
        try:
            parsed = date.fromisoformat(value)
        except ValueError:
            raise ValidationError("Enter a valid date.")
        if config.get("min_date") and parsed < date.fromisoformat(config["min_date"]):
            raise ValidationError("Date is before the allowed range.")
        if config.get("max_date") and parsed > date.fromisoformat(config["max_date"]):
            raise ValidationError("Date is after the allowed range.")
    elif field.field_type == "dropdown":
        allowed = set(field.options.values_list("value", flat=True))
        if value not in allowed and not config.get("allow_other", False):
            raise ValidationError("Choose an option from the list.")
    elif field.field_type == "checkbox":
        if not isinstance(value, list):
            raise ValidationError("Choose one or more options.")
        allowed = set(field.options.values_list("value", flat=True))
        if not set(value).issubset(allowed):
            raise ValidationError("One or more selected options are invalid.")
        if config.get("min_select") is not None and len(value) < config["min_select"]:
            raise ValidationError("Select more options.")
        if config.get("max_select") is not None and len(value) > config["max_select"]:
            raise ValidationError("Select fewer options.")
    elif field.field_type == "rating":
        max_rating = config.get("max_rating", 5)
        if isinstance(value, bool) or not isinstance(value, int) or not 1 <= value <= max_rating:
            raise ValidationError(f"Choose a rating from 1 to {max_rating}.")
