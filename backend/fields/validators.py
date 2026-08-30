from rest_framework.exceptions import ValidationError


class FieldConfigValidator:

    @staticmethod
    def validate(field_type, config):

        if config is None:
            config = {}

        if field_type == "text":
            FieldConfigValidator.validate_text(config)

        elif field_type == "number":
            FieldConfigValidator.validate_number(config)

        elif field_type == "email":
            FieldConfigValidator.validate_email(config)

        elif field_type == "dropdown":
            FieldConfigValidator.validate_dropdown(config)

        elif field_type == "checkbox":
            FieldConfigValidator.validate_checkbox(config)

        elif field_type == "date":
            FieldConfigValidator.validate_date(config)

        elif field_type == "file":
            FieldConfigValidator.validate_file(config)

        elif field_type == "rating":
            FieldConfigValidator.validate_rating(config)

    @staticmethod
    def validate_text(config):

        allowed_keys = {
            "min_length",
            "max_length",
            "text_pattern",
        }

        invalid = set(config.keys()) - allowed_keys

        if invalid:
            raise ValidationError(
                f"Invalid config keys for text field: {invalid}"
            )

        min_length = config.get("min_length")
        max_length = config.get("max_length")
        text_pattern = config.get("text_pattern")

        if min_length is not None:
            try:
                min_length = int(min_length)
            except (ValueError, TypeError):
                raise ValidationError("min_length must be an integer.")
            if min_length < 0:
                raise ValidationError("min_length cannot be negative.")

        if max_length is not None:
            try:
                max_length = int(max_length)
            except (ValueError, TypeError):
                raise ValidationError("max_length must be an integer.")
            if max_length <= 0:
                raise ValidationError("max_length must be greater than zero.")

        if (
            min_length is not None
            and max_length is not None
            and min_length > max_length
        ):
            raise ValidationError(
                "min_length cannot exceed max_length."
            )

        if text_pattern is not None and text_pattern not in {"any", "alphanumeric", "alpha"}:
            raise ValidationError(
                "text_pattern must be 'any', 'alphanumeric', or 'alpha'."
            )

    @staticmethod
    def validate_number(config):

        allowed_keys = {
            "min",
            "max",
            "decimal",
            "min_length",
            "max_length",
            "number_pattern",
        }

        invalid = set(config.keys()) - allowed_keys

        if invalid:
            raise ValidationError(
                f"Invalid config keys for number field: {invalid}"
            )

        minimum = config.get("min")
        maximum = config.get("max")
        decimal = config.get("decimal")
        min_length = config.get("min_length")
        max_length = config.get("max_length")
        number_pattern = config.get("number_pattern")

        if minimum is not None:
            try:
                minimum = float(minimum)
            except (ValueError, TypeError):
                raise ValidationError("min must be a number.")

        if maximum is not None:
            try:
                maximum = float(maximum)
            except (ValueError, TypeError):
                raise ValidationError("max must be a number.")

        if (
            minimum is not None
            and maximum is not None
            and minimum > maximum
        ):
            raise ValidationError(
                "min cannot exceed max."
            )

        if (
            decimal is not None
            and not isinstance(decimal, bool)
        ):
            raise ValidationError(
                "decimal must be true or false."
            )

        if min_length is not None:
            try:
                min_length = int(min_length)
            except (ValueError, TypeError):
                raise ValidationError("min_length must be an integer.")
            if min_length < 0:
                raise ValidationError("min_length cannot be negative.")

        if max_length is not None:
            try:
                max_length = int(max_length)
            except (ValueError, TypeError):
                raise ValidationError("max_length must be an integer.")
            if max_length <= 0:
                raise ValidationError("max_length must be greater than zero.")

        if (
            min_length is not None
            and max_length is not None
            and min_length > max_length
        ):
            raise ValidationError(
                "min_length cannot exceed max_length."
            )

        if number_pattern is not None and number_pattern not in {"numeric", "alphanumeric"}:
            raise ValidationError(
                "number_pattern must be 'numeric' or 'alphanumeric'."
            )

    @staticmethod
    def validate_email(config):

        if config:
            raise ValidationError(
                "Email field does not support configuration."
            )

    @staticmethod
    def validate_dropdown(config):

        allowed_keys = {
            "allow_other",
        }

        invalid = set(config.keys()) - allowed_keys

        if invalid:
            raise ValidationError(
                f"Invalid config keys for dropdown field: {invalid}"
            )

        allow_other = config.get("allow_other")

        if (
            allow_other is not None
            and not isinstance(allow_other, bool)
        ):
            raise ValidationError(
                "allow_other must be true or false."
            )

    @staticmethod
    def validate_checkbox(config):

        allowed_keys = {
            "min_select",
            "max_select",
        }

        invalid = set(config.keys()) - allowed_keys

        if invalid:
            raise ValidationError(
                f"Invalid config keys for checkbox field: {invalid}"
            )

        minimum = config.get("min_select")
        maximum = config.get("max_select")

        if minimum is not None and minimum < 0:
            raise ValidationError(
                "min_select cannot be negative."
            )

        if maximum is not None and maximum <= 0:
            raise ValidationError(
                "max_select must be greater than zero."
            )

        if (
            minimum is not None
            and maximum is not None
            and minimum > maximum
        ):
            raise ValidationError(
                "min_select cannot exceed max_select."
            )

    @staticmethod
    def validate_date(config):

        allowed_keys = {
            "min_date",
            "max_date",
        }

        invalid = set(config.keys()) - allowed_keys

        if invalid:
            raise ValidationError(
                f"Invalid config keys for date field: {invalid}"
            )

    @staticmethod
    def validate_file(config):

        allowed_keys = {
            "allowed_extensions",
            "max_size_mb",
        }

        invalid = set(config.keys()) - allowed_keys

        if invalid:
            raise ValidationError(
                f"Invalid config keys for file field: {invalid}"
            )

        extensions = config.get("allowed_extensions")

        if (
            extensions is not None
            and not isinstance(extensions, list)
        ):
            raise ValidationError(
                "allowed_extensions must be a list."
            )

        max_size = config.get("max_size_mb")

        if (
            max_size is not None
            and max_size <= 0
        ):
            raise ValidationError(
                "max_size_mb must be greater than zero."
            )

    @staticmethod
    def validate_rating(config):

        allowed_keys = {
            "max_rating",
        }

        invalid = set(config.keys()) - allowed_keys

        if invalid:
            raise ValidationError(
                f"Invalid config keys for rating field: {invalid}"
            )

        max_rating = config.get("max_rating")

        if (
            max_rating is not None
            and max_rating < 2
        ):
            raise ValidationError(
                "max_rating must be at least 2."
            )