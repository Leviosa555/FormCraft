from django.db import transaction
from rest_framework import serializers

from .models import Field, FieldOption
from .validators import FieldConfigValidator


class FieldOptionSerializer(serializers.ModelSerializer):
    class Meta:
        model = FieldOption
        fields = [
            "id",
            "label",
            "value",
            "display_order",
        ]
        read_only_fields = ["id"]


class FieldSerializer(serializers.ModelSerializer):
    options = FieldOptionSerializer(
        many=True,
        required=False,
    )

    class Meta:
        model = Field

        fields = [
            "id",
            "label",
            "field_type",
            "required",
            "placeholder",
            "help_text",
            "display_order",
            "config",
            "options",
            "created_at",
            "updated_at",
        ]

        read_only_fields = [
            "id",
            "created_at",
            "updated_at",
        ]

    def validate(self, attrs):
        """
        Supports both CREATE and PATCH requests.
        """

        # During PATCH, field_type may not be provided.
        field_type = attrs.get(
            "field_type",
            self.instance.field_type if self.instance else None,
        )

        # During PATCH, config may not be provided.
        config = attrs.get(
            "config",
            self.instance.config if self.instance else {},
        )

        FieldConfigValidator.validate(
            field_type,
            config,
        )

        # Validate options only if the request actually includes them.
        options = attrs.get("options")

        if (
            options is not None
            and field_type in ["dropdown", "checkbox"]
            and len(options) < 2
        ):
            raise serializers.ValidationError(
                "Dropdown and Checkbox fields require at least two options."
            )

        return attrs

    @transaction.atomic
    def create(self, validated_data):
        options_data = validated_data.pop("options", [])

        field = Field.objects.create(**validated_data)

        for option in options_data:
            FieldOption.objects.create(
                field=field,
                **option,
            )

        return field

    @transaction.atomic
    def update(self, instance, validated_data):
        """
        Handles PATCH/PUT requests.
        """

        options_data = validated_data.pop("options", None)

        for attr, value in validated_data.items():
            setattr(instance, attr, value)

        instance.save()

        # Update field options only if they were supplied.
        if options_data is not None:
            instance.options.all().delete()

            for option in options_data:
                FieldOption.objects.create(
                    field=instance,
                    **option,
                )

        return instance


class ReorderFieldItemSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    display_order = serializers.IntegerField(min_value=1)


class ReorderFieldsSerializer(serializers.Serializer):
    field_order = ReorderFieldItemSerializer(many=True)