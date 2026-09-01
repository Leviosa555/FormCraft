import json

from django.http import QueryDict
from rest_framework import serializers
from .models import Form, FormVersion
from fields.serializers import FieldSerializer
from .models import Submission, ResponseValue
from .models import ConditionalRule


class FormSerializer(serializers.ModelSerializer):
    owner = serializers.StringRelatedField(read_only=True)
    share_token = serializers.SerializerMethodField()

    class Meta:
        model = Form
        fields = [
            "id",
            "title",
            "description",
            "status",
            "owner",
            "created_at",
            "updated_at",
            "retention_days",
            "expires_at",
            "require_email_verification",
            "limit_one_submission_per_email",
            "share_token",
        ]
        read_only_fields = [
            "id",
            "status",
            "owner",
            "created_at",
            "updated_at",
            "share_token",
        ]

    def get_share_token(self, obj):
        # Return the active published version's share_token until archived
        if obj.status == "published":
            published_version = obj.versions.filter(status="published").order_by("-version").first()
            if published_version and published_version.share_token:
                return str(published_version.share_token)
            active_version = obj.versions.filter(is_active=True).first()
            if active_version and active_version.share_token:
                return str(active_version.share_token)
            latest = obj.versions.order_by("-version").first()
            if latest and latest.share_token:
                return str(latest.share_token)
        return None

    def validate_title(self, value):
        trimmed = value.strip()
        if not trimmed:
            raise serializers.ValidationError("Title is required.")
        if len(trimmed) > 26:
            raise serializers.ValidationError("Form title cannot exceed 26 characters.")
        return trimmed

    def validate_description(self, value):
        if value:
            words = value.strip().split()
            if len(words) > 14:
                raise serializers.ValidationError("Description cannot exceed 14 words.")
        return value


class PublicConditionalRuleSerializer(serializers.ModelSerializer):
    class Meta:
        model = ConditionalRule
        fields = ["trigger_field", "operator", "comparison_value", "target_field", "action"]


class PublicFormVersionSerializer(serializers.ModelSerializer):
    fields = FieldSerializer(many=True, read_only=True)
    conditional_rules = PublicConditionalRuleSerializer(many=True, read_only=True)

    class Meta:
        model = FormVersion
        fields = [
            "version",
            "share_token",
            "published_at",
            "fields",
            "conditional_rules",
        ]


class PublicFormSerializer(serializers.ModelSerializer):
    version = serializers.SerializerMethodField()

    class Meta:
        model = Form
        fields = [
            "id",
            "title",
            "description",
            "expires_at",
            "require_email_verification",
            "limit_one_submission_per_email",
            "version",
        ]

    def get_version(self, obj):
        published_version = obj.versions.filter(
            status="published"
        ).first()
        if not published_version:
            return None

        return PublicFormVersionSerializer(
            published_version
        ).data


class ResponseInputSerializer(serializers.Serializer):
    field = serializers.IntegerField()
    value = serializers.JSONField()


class SubmissionSerializer(serializers.Serializer):
    responses = ResponseInputSerializer(many=True)
    session_token = serializers.UUIDField(required=False)
    verification_token = serializers.UUIDField(required=False)
    respondent_email = serializers.EmailField(required=False)

    def to_internal_value(self, data):
        """Accept JSON bodies and the `responses` JSON string used in multipart bodies.

        DRF treats a QueryDict as HTML form data for nested serializers.  A
        multipart `responses='[{...}]'` value therefore has to be converted
        into a plain dictionary before `ResponseInputSerializer(many=True)`
        is allowed to parse it.
        """
        if isinstance(data, QueryDict):
            payload = data.dict()
        else:
            payload = data.copy() if hasattr(data, "copy") else dict(data)

        responses = payload.get("responses")
        if isinstance(responses, str):
            try:
                payload["responses"] = json.loads(responses)
            except json.JSONDecodeError:
                raise serializers.ValidationError(
                    {"responses": "Must be a valid JSON array."}
                )

        return super().to_internal_value(payload)


class ResponseValueSerializer(serializers.ModelSerializer):
    field = serializers.CharField(source="field.label", read_only=True)
    download_url = serializers.SerializerMethodField()

    def get_download_url(self, obj):
        if not obj.upload:
            return None
        from django.core import signing
        request = self.context.get("request")
        path = f"/api/uploads/{signing.dumps(obj.upload_id, salt='form-upload')}/"
        return request.build_absolute_uri(path) if request else path

    class Meta:
        model = ResponseValue
        fields = [
            "field",
            "value",
            "download_url",
        ]


class SubmissionDetailSerializer(serializers.ModelSerializer):
    responses = ResponseValueSerializer(many=True, read_only=True)

    class Meta:
        model = Submission
        fields = [
            "id",
            "created_at",
            "started_at",
            "submitted_at",
            "status",
            "respondent_email",
            "responses",
        ]


class BulkDeleteSerializer(serializers.Serializer):
    submission_ids = serializers.ListField(child=serializers.IntegerField(), allow_empty=False)


class RetentionSerializer(serializers.Serializer):
    retention_days = serializers.IntegerField(min_value=1, max_value=3650, allow_null=True)


class ExpirationSerializer(serializers.Serializer):
    expires_at = serializers.DateTimeField(allow_null=True, required=True)

    def validate_expires_at(self, value):
        # Expiration datetime validation is client-region driven; backend safely accepts valid ISO timestamps
        return value


class ConditionalRuleSerializer(serializers.ModelSerializer):
    def validate(self, attrs):
        request = self.context.get("request")
        version = self.context.get("form_version")
        trigger = attrs.get("trigger_field", getattr(self.instance, "trigger_field", None))
        target = attrs.get("target_field", getattr(self.instance, "target_field", None))
        operator = attrs.get("operator", getattr(self.instance, "operator", "equals"))
        comparison = attrs.get("comparison_value", getattr(self.instance, "comparison_value", None))
        if not trigger or not target:
            raise serializers.ValidationError("A trigger field and target field are required.")
        if trigger == target:
            raise serializers.ValidationError("A rule cannot target its trigger field.")
        if version and (trigger.form_version_id != version.id or target.form_version_id != version.id):
            raise serializers.ValidationError("Rule fields must belong to the active form version.")
        if operator == "is_empty" and comparison not in (None, ""):
            raise serializers.ValidationError({"comparison_value": "is_empty does not use a comparison value."})
        if operator != "is_empty" and comparison in (None, ""):
            raise serializers.ValidationError({"comparison_value": "A comparison value is required."})
        return attrs

    class Meta:
        model = ConditionalRule
        fields = [
            "id",
            "form_version",
            "trigger_field",
            "operator",
            "comparison_value",
            "target_field",
            "action",
            "created_at",
        ]

        read_only_fields = [
            "id",
            "created_at",
            "form_version",
        ]


class OneTimeTokenSerializer(serializers.ModelSerializer):
    url = serializers.SerializerMethodField()
    is_expired = serializers.BooleanField(read_only=True)

    class Meta:
        from .models import OneTimeToken
        model = OneTimeToken
        fields = [
            "id",
            "token",
            "label",
            "is_used",
            "used_at",
            "expires_at",
            "created_at",
            "is_expired",
            "url",
        ]
        read_only_fields = ["id", "token", "is_used", "used_at", "created_at", "is_expired", "url"]

    def get_url(self, obj):
        request = self.context.get("request")
        if request:
            return request.build_absolute_uri(f"/forms/single/{obj.token}")
        return f"/forms/single/{obj.token}"

