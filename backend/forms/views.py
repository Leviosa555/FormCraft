import logging
from rest_framework.views import APIView
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework import viewsets, status
from rest_framework.decorators import action
from django.shortcuts import get_object_or_404
from django.utils import timezone
from .models import Submission, ResponseValue
from .serializers import (
    FormSerializer,
    PublicFormSerializer,
    SubmissionSerializer,
    SubmissionDetailSerializer,
    ConditionalRuleSerializer,
)

logger = logging.getLogger(__name__)

from rest_framework.response import Response
from rest_framework.exceptions import ValidationError
from drf_spectacular.utils import extend_schema, OpenApiResponse, OpenApiExample
from django.db import transaction
from django.http import FileResponse, Http404, HttpResponse
from django.core import signing
from rest_framework.parsers import JSONParser, MultiPartParser, FormParser
from django.core.paginator import Paginator
from django.utils.dateparse import parse_date
import csv
import json

from datetime import timedelta
from .models import (
    Form,
    FormVersion,
    ConditionalRule,
    StoredUpload,
    AuditLog,
    OneTimeToken,
    EmailVerificationOTP,
)

from fields.models import Field, FieldOption
from .logic import evaluate_rules, is_empty, validate_value
from .services import analytics_for_form, archive_expired_submissions, signed_upload_url
from .serializers import (
    BulkDeleteSerializer,
    ExpirationSerializer,
    RetentionSerializer,
    OneTimeTokenSerializer,
)
from .email_service import generate_otp_code, send_otp_email, send_submission_confirmation_email
from .ai_generator import generate_form_from_idea



class FormViewSet(viewsets.ModelViewSet):
    serializer_class = FormSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return (
            Form.objects
            .filter(owner=self.request.user)
            .select_related("owner")
            .order_by("-created_at")
        )

    def retrieve(self, request, *args, **kwargs):
        instance = self.get_object()
        instance.check_auto_expire()
        serializer = self.get_serializer(instance)
        return Response(serializer.data)

    def list(self, request, *args, **kwargs):
        queryset = self.filter_queryset(self.get_queryset())
        for form in queryset:
            form.check_auto_expire()
        page = self.paginate_queryset(queryset)
        if page is not None:
            serializer = self.get_serializer(page, many=True)
            return self.get_paginated_response(serializer.data)
        serializer = self.get_serializer(queryset, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=["post"])
    def expiration(self, request, pk=None):
        form = self.get_object()
        serializer = ExpirationSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        form.expires_at = serializer.validated_data["expires_at"]
        form.save(update_fields=["expires_at"])
        form.check_auto_expire()
        AuditLog.objects.create(
            form=form,
            actor=request.user,
            action="form_expiration_updated",
            details={"expires_at": str(form.expires_at) if form.expires_at else None},
        )
        return Response(FormSerializer(form).data, status=status.HTTP_200_OK)

    @action(detail=True, methods=["post"])
    def email_settings(self, request, pk=None):
        form = self.get_object()
        if "require_email_verification" in request.data:
            form.require_email_verification = bool(request.data.get("require_email_verification"))
        if "limit_one_submission_per_email" in request.data:
            form.limit_one_submission_per_email = bool(request.data.get("limit_one_submission_per_email"))
        form.save(update_fields=["require_email_verification", "limit_one_submission_per_email"])
        AuditLog.objects.create(
            form=form,
            actor=request.user,
            action="form_email_settings_updated",
            details={
                "require_email_verification": form.require_email_verification,
                "limit_one_submission_per_email": form.limit_one_submission_per_email,
            },
        )
        return Response(FormSerializer(form).data, status=status.HTTP_200_OK)

    def perform_create(self, serializer):
        form = serializer.save(owner=self.request.user)

        FormVersion.objects.create(
            form=form,
            version=1,
            status="draft",
            is_active=True,
        )

    @action(detail=True, methods=["post"])
    @transaction.atomic
    def duplicate(self, request, pk=None):
        source = self.get_object()
        source_version = source.versions.filter(is_active=True).first()
        if not source_version:
            raise ValidationError("No active version found.")

        copied_form = Form.objects.create(
            owner=request.user,
            title=request.data.get("title") or f"Copy of {source.title}",
            description=source.description,
            retention_days=source.retention_days,
        )
        copied_version = FormVersion.objects.create(
            form=copied_form,
            version=1,
            status="draft",
            is_active=True,
        )
        field_map = {}
        for field in source_version.fields.prefetch_related("options"):
            copied_field = Field.objects.create(
                form_version=copied_version,
                label=field.label,
                field_type=field.field_type,
                required=field.required,
                placeholder=field.placeholder,
                help_text=field.help_text,
                display_order=field.display_order,
                config=field.config,
            )
            field_map[field.id] = copied_field
            for option in field.options.all():
                FieldOption.objects.create(
                    field=copied_field,
                    label=option.label,
                    value=option.value,
                    display_order=option.display_order,
                )

        for rule in source_version.conditional_rules.all():
            ConditionalRule.objects.create(
                form_version=copied_version,
                trigger_field=field_map[rule.trigger_field_id],
                target_field=field_map[rule.target_field_id],
                operator=rule.operator,
                comparison_value=rule.comparison_value,
                action=rule.action,
            )

        AuditLog.objects.create(
            form=copied_form,
            actor=request.user,
            action="form_duplicated",
            details={"source_form_id": source.id},
        )
        return Response(FormSerializer(copied_form).data, status=status.HTTP_201_CREATED)

    @extend_schema(
        request=None,
        responses={
            200: OpenApiResponse(
                description="Form published successfully."
            )
        },
    )
    @action(detail=True, methods=["post"])
    def publish(self, request, pk=None):

        form = self.get_object()

        version = form.versions.filter(
            is_active=True,
            status="draft"
        ).first()

        if not version:
            raise ValidationError(
                "No active draft version found."
            )

        if not version.fields.exists():
            raise ValidationError(
                "A form must contain at least one field before publishing."
            )

        version.status = "published"
        version.published_at = timezone.now()

        version.save(
            update_fields=[
                "status",
                "published_at",
            ]
        )

        form.status = "published"
        form.save(update_fields=["status"])

        return Response(
            {
                "message": "Form published successfully.",
                "version": version.version,
                "share_token": str(version.share_token),
            },
            status=status.HTTP_200_OK,
        )

    @transaction.atomic
    @action(detail=True, methods=["post"])
    def edit(self, request, pk=None):

        form = self.get_object()

        current_version = form.versions.filter(
            is_active=True
        ).first()

        if not current_version:
            raise ValidationError(
                "No active version found."
            )

        if current_version.status != "published":
            raise ValidationError(
                "Only published forms can be edited."
            )

        current_version.is_active = False

        current_version.save(
            update_fields=["is_active"]
        )

        new_version = FormVersion.objects.create(
            form=form,
            version=current_version.version + 1,
            status="draft",
            is_active=True,
        )

        form.status = "draft"

        form.save(
            update_fields=["status"]
        )

        old_fields = current_version.fields.prefetch_related(
            "options"
        )

        field_map = {}
        for old_field in old_fields:

            new_field = Field.objects.create(
                form_version=new_version,
                label=old_field.label,
                field_type=old_field.field_type,
                required=old_field.required,
                placeholder=old_field.placeholder,
                help_text=old_field.help_text,
                display_order=old_field.display_order,
                config=old_field.config,
            )
            field_map[old_field.id] = new_field

            for option in old_field.options.all():

                FieldOption.objects.create(
                    field=new_field,
                    label=option.label,
                    value=option.value,
                    display_order=option.display_order,
                )

        for rule in current_version.conditional_rules.all():
            ConditionalRule.objects.create(
                form_version=new_version,
                trigger_field=field_map[rule.trigger_field_id],
                target_field=field_map[rule.target_field_id],
                operator=rule.operator,
                comparison_value=rule.comparison_value,
                action=rule.action,
            )

        return Response(
            {
                "message": "Draft version created successfully.",
                "version": new_version.version,
            },
            status=status.HTTP_201_CREATED,
        )

    @action(detail=True, methods=["post"])
    def archive(self, request, pk=None):

        form = self.get_object()

        if form.status == "archived":
            raise ValidationError(
                "Form is already archived."
            )

        active_version = form.versions.filter(
            is_active=True
        ).first()

        if active_version:
            active_version.is_active = False

            active_version.save(
                update_fields=["is_active"]
            )

        form.status = "archived"
        form.expires_at = None

        form.save(
            update_fields=["status", "expires_at"]
        )

        return Response(
            {
                "message": "Form archived successfully."
            },
            status=status.HTTP_200_OK,
        )

    @action(detail=True, methods=["get", "post"])
    def conditional_rules(self, request, pk=None):

        form = self.get_object()

        version = form.versions.filter(
            is_active=True
        ).first()

        if not version:
            raise ValidationError(
                "No active form version found."
            )

        if request.method == "GET":

            serializer = ConditionalRuleSerializer(
                version.conditional_rules.all(),
                many=True,
            )

            return Response(serializer.data)

        if version.status != "draft":
            raise ValidationError("Create or edit a draft version before changing conditional rules.")

        serializer = ConditionalRuleSerializer(data=request.data, context={"request": request, "form_version": version})

        serializer.is_valid(
            raise_exception=True
        )

        serializer.save(
            form_version=version
        )

        return Response(
            serializer.data,
            status=status.HTTP_201_CREATED,
        )


class PublicFormView(APIView):
    permission_classes = [AllowAny]

    def get(self, request, share_token=None, single_token=None):
        is_single_use = False
        ot_record = None
        if single_token:
            ot_record = get_object_or_404(OneTimeToken, token=single_token)
            if ot_record.is_used:
                return Response(
                    {
                        "error": "This one-time submission link has already been used.",
                        "already_used": True,
                        "used_at": ot_record.used_at,
                    },
                    status=status.HTTP_410_GONE,
                )
            if ot_record.is_expired:
                return Response(
                    {"error": "This one-time submission link has expired.", "expired": True},
                    status=status.HTTP_410_GONE,
                )
            version = ot_record.form_version
            is_single_use = True
        else:
            version = get_object_or_404(
                FormVersion,
                share_token=share_token,
                status="published",
            )

        if version.form.check_auto_expire() or version.form.status == "archived":
            return Response(
                {"error": "This form has expired and is no longer accepting responses.", "expired": True},
                status=status.HTTP_410_GONE,
            )

        serializer = PublicFormSerializer(version.form)
        data = dict(serializer.data)
        data["is_single_use"] = is_single_use
        if ot_record:
            data["recipient_label"] = ot_record.label
            data["single_token"] = str(ot_record.token)
        return Response(data)


class StartFormResponseView(APIView):
    permission_classes = [AllowAny]

    def post(self, request, share_token=None, single_token=None):
        if single_token:
            ot_record = get_object_or_404(OneTimeToken, token=single_token)
            if ot_record.is_used:
                return Response(
                    {"error": "This one-time submission link has already been used.", "already_used": True},
                    status=status.HTTP_410_GONE,
                )
            if ot_record.is_expired:
                return Response(
                    {"error": "This one-time submission link has expired.", "expired": True},
                    status=status.HTTP_410_GONE,
                )
            version = ot_record.form_version
        else:
            version = get_object_or_404(FormVersion, share_token=share_token, status="published")

        if version.form.check_auto_expire() or version.form.status == "archived":
            return Response(
                {"error": "This form has expired and is no longer accepting submissions.", "expired": True},
                status=status.HTTP_410_GONE,
            )
        submission = Submission.objects.create(form_version=version, status="started")
        return Response({"session_token": str(submission.session_token), "started_at": submission.started_at}, status=status.HTTP_201_CREATED)


class SubmitFormView(APIView):
    permission_classes = [AllowAny]
    parser_classes = [JSONParser, MultiPartParser, FormParser]

    @transaction.atomic
    def post(self, request, share_token=None, single_token=None):
        ot_record = None
        if single_token:
            ot_record = get_object_or_404(
                OneTimeToken.objects.select_for_update(),
                token=single_token
            )
            if ot_record.is_used:
                return Response(
                    {"error": "This one-time submission link has already been used and cannot accept further responses.", "already_used": True},
                    status=status.HTTP_410_GONE,
                )
            if ot_record.is_expired:
                return Response(
                    {"error": "This one-time submission link has expired.", "expired": True},
                    status=status.HTTP_410_GONE,
                )
            version = ot_record.form_version
        else:
            version = get_object_or_404(
                FormVersion,
                share_token=share_token,
                status="published",
            )

        if version.form.check_auto_expire() or version.form.status == "archived":
            return Response(
                {"error": "This form has expired and is no longer accepting responses.", "expired": True},
                status=status.HTTP_410_GONE,
            )

        serializer = SubmissionSerializer(data=request.data)
        serializer.is_valid(
            raise_exception=True
        )

        fields = list(version.fields.prefetch_related("options").all())
        field_by_id = {field.id: field for field in fields}
        responses = serializer.validated_data["responses"]
        values = {}
        supplied_ids = set()
        response_by_id = {}
        for response in responses:
            field_id = response["field"]
            if field_id in supplied_ids:
                raise ValidationError({"responses": f"Field {field_id} was submitted more than once."})
            if field_id not in field_by_id:
                raise ValidationError({"responses": f"Field {field_id} is not part of this form version."})
            supplied_ids.add(field_id)
            response_by_id[field_id] = response
            values[field_id] = response["value"]

        rules = list(version.conditional_rules.select_related("trigger_field", "target_field"))
        state = evaluate_rules(fields, rules, values)
        errors = {}
        for field in fields:
            response = response_by_id.get(field.id)
            uploaded_file = request.FILES.get(f"file_{field.id}")
            supplied = response is not None or uploaded_file is not None
            value = response["value"] if response else None
            if not state[field.id]["visible"]:
                if supplied:
                    errors[str(field.id)] = "This field is currently hidden and must not be submitted."
                continue
            if state[field.id]["required"] and (not supplied or (uploaded_file is None and is_empty(value))):
                errors[str(field.id)] = "This field is required."
                continue
            if uploaded_file is not None and field.field_type != "file":
                errors[str(field.id)] = "File uploads are only allowed for file fields."
                continue
            if field.field_type == "file":
                if supplied and uploaded_file is None:
                    errors[str(field.id)] = "Submit a file attachment for this field."
                elif uploaded_file is not None:
                    try:
                        validate_value(field, value, uploaded_file)
                    except ValidationError as exc:
                        errors[str(field.id)] = exc.detail[0] if isinstance(exc.detail, list) else exc.detail
            elif supplied and not is_empty(value):
                try:
                    validate_value(field, value)
                except ValidationError as exc:
                    errors[str(field.id)] = exc.detail[0] if isinstance(exc.detail, list) else exc.detail
        if errors:
            raise ValidationError({"responses": errors})

        # Email OTP Verification Check
        verified_email = None
        verification_token = serializer.validated_data.get("verification_token")
        raw_email = serializer.validated_data.get("respondent_email")

        # Both public and single-use forms require verified email OTP
        if verification_token:
            otp_record = EmailVerificationOTP.objects.filter(
                form=version.form,
                verification_token=verification_token,
                is_verified=True,
            ).first()
            if not otp_record or otp_record.is_expired:
                raise ValidationError({"error": "Invalid or expired email verification token. Please verify your email before submitting."})
            verified_email = otp_record.email.lower()
        elif raw_email:
            verified_email = raw_email.strip().lower()
        else:
            raise ValidationError({"error": "Email verification is required before submitting this form."})

        # If accessed via Single-Use Link (or explicit 1-submission limit is enabled):
        # Enforce that this email cannot submit again
        is_single_use_mode = bool(ot_record or version.form.limit_one_submission_per_email)
        if is_single_use_mode and verified_email:
            existing = Submission.objects.filter(
                form_version__form=version.form,
                respondent_email__iexact=verified_email,
                status__in=["submitted", "archived"],
            ).first()
            if existing:
                return Response(
                    {
                        "error": f"The email '{verified_email}' has already submitted a response to this one-time link. Duplicate submissions are not permitted.",
                        "already_submitted": True,
                        "submitted_at": existing.submitted_at,
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )


        session_token = serializer.validated_data.get("session_token")
        if session_token:
            submission = get_object_or_404(Submission, session_token=session_token, form_version=version, status="started")
            submission.status = "submitted"
            submission.submitted_at = timezone.now()
            submission.respondent_email = verified_email
            submission.save(update_fields=["status", "submitted_at", "respondent_email"])
        else:
            submission = Submission.objects.create(
                form_version=version,
                submitted_by=request.user if request.user.is_authenticated else None,
                status="submitted",
                submitted_at=timezone.now(),
                respondent_email=verified_email,
            )

        uploads = []
        for field in fields:
            response = response_by_id.get(field.id)
            uploaded_file = request.FILES.get(f"file_{field.id}")
            if not response and not uploaded_file:
                continue
            stored_upload = None
            value = response["value"] if response else None
            if uploaded_file is None and is_empty(value):
                continue
            if uploaded_file:
                stored_upload = StoredUpload.objects.create(
                    file=uploaded_file, original_name=uploaded_file.name,
                    content_type=uploaded_file.content_type or "", size=uploaded_file.size,
                )
                value = {"name": stored_upload.original_name, "size": stored_upload.size}
                uploads.append(stored_upload)
            ResponseValue.objects.create(submission=submission, field=field, value=value, upload=stored_upload)

        # Mark single-use token as used atomically
        if ot_record:
            ot_record.is_used = True
            ot_record.used_at = timezone.now()
            ot_record.save(update_fields=["is_used", "used_at"])

        # Send confirmation email to respondent
        if verified_email:
            try:
                responses_summary = []
                for field in fields:
                    resp_val = ResponseValue.objects.filter(submission=submission, field=field).first()
                    if resp_val:
                        responses_summary.append({
                            "label": field.label,
                            "value": resp_val.value,
                        })
                send_submission_confirmation_email(
                    to_email=verified_email,
                    form_title=version.form.title,
                    submission_id=submission.id,
                    responses_summary=responses_summary,
                )
            except Exception as exc:
                logger.exception(f"Failed to dispatch submission confirmation email: {exc}")


        return Response(
            {
                "message": "Form submitted successfully.",
                "submission_id": submission.id,
                "confirmation_email_sent": bool(verified_email),
            },
            status=status.HTTP_201_CREATED,
        )



class SendPublicFormOTPView(APIView):
    permission_classes = [AllowAny]

    def post(self, request, share_token=None, single_token=None):
        if single_token:
            ot_record = get_object_or_404(OneTimeToken, token=single_token)
            if ot_record.is_used:
                return Response(
                    {"error": "This one-time submission link has already been used.", "already_used": True},
                    status=status.HTTP_410_GONE,
                )
            if ot_record.is_expired:
                return Response(
                    {"error": "This one-time submission link has expired.", "expired": True},
                    status=status.HTTP_410_GONE,
                )
            form = ot_record.form_version.form
        else:
            version = get_object_or_404(FormVersion, share_token=share_token, status="published")
            form = version.form

        if form.check_auto_expire() or form.status == "archived":
            return Response(
                {"error": "This form has expired and is no longer accepting submissions.", "expired": True},
                status=status.HTTP_410_GONE,
            )

        email = (request.data.get("email") or "").strip().lower()
        if not email or "@" not in email:
            raise ValidationError({"email": "Please provide a valid email address."})

        # If accessed via Single-Use Link, verify if this email has already submitted
        is_single_use_link = bool(single_token or form.limit_one_submission_per_email)
        if is_single_use_link:
            existing_submission = Submission.objects.filter(
                form_version__form=form,
                respondent_email__iexact=email,
                status__in=["submitted", "archived"],
            ).first()

            if existing_submission:
                return Response(
                    {
                        "error": f"The email '{email}' has already submitted a response to this one-time link. Duplicate submissions are not allowed.",
                        "already_submitted": True,
                        "submitted_at": existing_submission.submitted_at,
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )


        # Generate 6-digit OTP
        otp_code = generate_otp_code()
        expires_at = timezone.now() + timedelta(minutes=10)

        otp_record = EmailVerificationOTP.objects.create(
            form=form,
            email=email,
            otp_code=otp_code,
            expires_at=expires_at,
        )

        try:
            send_otp_email(to_email=email, otp_code=otp_code, form_title=form.title)
        except Exception as exc:
            return Response(
                {"error": f"Failed to send email verification code: {str(exc)}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        return Response(
            {
                "message": f"Verification code sent to {email}.",
                "email": email,
                "expires_in_minutes": 10,
            },
            status=status.HTTP_200_OK,
        )


class VerifyPublicFormOTPView(APIView):
    permission_classes = [AllowAny]

    def post(self, request, share_token=None, single_token=None):
        if single_token:
            ot_record = get_object_or_404(OneTimeToken, token=single_token)
            form = ot_record.form_version.form
        else:
            version = get_object_or_404(FormVersion, share_token=share_token, status="published")
            form = version.form

        email = (request.data.get("email") or "").strip().lower()
        otp_code = (request.data.get("otp_code") or "").strip()

        if not email or not otp_code:
            raise ValidationError({"error": "Email and 6-digit OTP code are required."})

        otp_record = EmailVerificationOTP.objects.filter(
            form=form,
            email__iexact=email,
            otp_code=otp_code,
        ).order_by("-created_at").first()

        if not otp_record:
            return Response(
                {"error": "Invalid verification code. Please check and try again."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if otp_record.is_expired:
            return Response(
                {"error": "This verification code has expired. Please request a new code."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        otp_record.is_verified = True
        otp_record.save(update_fields=["is_verified"])

        return Response(
            {
                "verified": True,
                "message": "Email verified successfully.",
                "verification_token": str(otp_record.verification_token),
                "email": email,
            },
            status=status.HTTP_200_OK,
        )



class OneTimeLinkView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, id):
        form = get_object_or_404(Form, id=id, owner=request.user)
        version = form.versions.filter(is_active=True).first() or form.versions.filter(status="published").first()
        if not version:
            return Response([], status=status.HTTP_200_OK)
        tokens = OneTimeToken.objects.filter(form_version=version)
        serializer = OneTimeTokenSerializer(tokens, many=True, context={"request": request})
        return Response(serializer.data, status=status.HTTP_200_OK)

    def post(self, request, id):
        form = get_object_or_404(Form, id=id, owner=request.user)
        version = form.versions.filter(is_active=True).first() or form.versions.filter(status="published").first()
        if not version:
            raise ValidationError("Please publish or activate a form version first before generating one-time links.")

        label = request.data.get("label", "").strip() or None
        expires_at = request.data.get("expires_at")
        count = min(max(int(request.data.get("count", 1)), 1), 50)

        created_tokens = []
        for i in range(count):
            token_label = f"{label} (#{i+1})" if label and count > 1 else label
            ot = OneTimeToken.objects.create(
                form_version=version,
                label=token_label,
                expires_at=expires_at,
            )
            created_tokens.append(ot)

        AuditLog.objects.create(
            form=form,
            actor=request.user,
            action="one_time_links_generated",
            details={"count": len(created_tokens), "label": label},
        )

        serializer = OneTimeTokenSerializer(created_tokens, many=True, context={"request": request})
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    def delete(self, request, id, token_id=None):
        form = get_object_or_404(Form, id=id, owner=request.user)
        token_uuid = request.data.get("token") or token_id
        ot = get_object_or_404(OneTimeToken, form_version__form=form, token=token_uuid)
        ot.delete()
        return Response({"message": "One-time link deleted successfully."}, status=status.HTTP_200_OK)


class AutoGenerateFormView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        prompt = (request.data.get("prompt") or request.data.get("idea") or "").strip()
        if not prompt:
            raise ValidationError({"prompt": "Please describe the idea or purpose of the form."})


        try:
            form = generate_form_from_idea(prompt, request.user)
            AuditLog.objects.create(
                form=form,
                actor=request.user,
                action="form_auto_generated",
                details={"prompt": prompt},
            )
            return Response(FormSerializer(form).data, status=status.HTTP_201_CREATED)
        except Exception as exc:
            return Response({"error": f"Failed to generate form: {str(exc)}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class FormAnalyticsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, id):
        form = get_object_or_404(Form, id=id, owner=request.user)
        archive_expired_submissions(form, request.user)
        return Response(analytics_for_form(form))


class ExportResponsesView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, id=None, *args, **kwargs):
        form_id = id or kwargs.get("id") or kwargs.get("pk")
        form = get_object_or_404(Form, id=form_id, owner=request.user)
        # Older forms can exist without a version record.  They do not have
        # response fields to export, but should still produce a valid (empty)
        # export instead of making the dashboard download fail with a 400.
        version = form.versions.filter(is_active=True).first() or form.versions.order_by("-version").first()
        fmt = request.query_params.get("export_format") or request.query_params.get("format") or "csv"
        if fmt not in ("csv", "json"):
            raise ValidationError({"format": "Use csv or json."})

        # Collect all fields in order
        fields = list(version.fields.all().order_by("display_order")) if version else []

        # Build clean unique header names for fields
        field_header_map = {}
        used_headers = set()
        for field in fields:
            label = field.label.strip() if field.label else f"Field {field.id}"
            header = label
            counter = 2
            while header in used_headers:
                header = f"{label} ({counter})"
                counter += 1
            used_headers.add(header)
            field_header_map[field.id] = header

        submissions = (
            Submission.objects.filter(form_version__form=form)
            .exclude(status="started")
            .select_related("form_version")
            .prefetch_related(
                "responses",
                "responses__upload",
                "responses__field",
                "form_version__conditional_rules",
                "form_version__fields",
            )
            .order_by("-created_at")
        )

        rows = []
        for submission in submissions:
            sub_version = submission.form_version
            sub_rules = list(sub_version.conditional_rules.all()) if sub_version else []
            sub_fields = list(sub_version.fields.all()) if sub_version else []
            response_map = {item.field_id: item for item in submission.responses.all()}
            raw_values = {item.field_id: item.value for item in submission.responses.all()}

            # Evaluate conditional visibility rules for this submission
            visibility_state = evaluate_rules(sub_fields, sub_rules, raw_values) if sub_rules else {}

            submitted_dt = submission.submitted_at or submission.created_at
            submitted_str = submitted_dt.strftime("%Y-%m-%d %H:%M:%S") if submitted_dt else ""

            duration_str = "N/A"
            if submission.started_at and submission.submitted_at:
                dur_secs = max(0, int((submission.submitted_at - submission.started_at).total_seconds()))
                if dur_secs < 60:
                    duration_str = f"{dur_secs}s"
                else:
                    duration_str = f"{dur_secs // 60}m {dur_secs % 60}s"

            row = {
                "Submission ID": submission.id,
                "Submitted At": submitted_str,
                "Status": submission.status.capitalize(),
                "Duration": duration_str,
            }

            for field in fields:
                header_name = field_header_map[field.id]
                item = response_map.get(field.id)
                if item and item.upload:
                    val = signed_upload_url(item.upload, request)
                elif item and item.value is not None and item.value != "" and item.value != []:
                    if isinstance(item.value, list):
                        val = ", ".join(str(v) for v in item.value)
                    elif isinstance(item.value, dict):
                        val = json.dumps(item.value)
                    else:
                        val = str(item.value)
                else:
                    # Field was not answered - determine if skipped by conditional logic
                    field_vis = visibility_state.get(field.id, {}).get("visible", True)
                    if not field_vis:
                        val = "N/A (Skipped by logic)"
                    else:
                        val = "N/A (Unanswered)"

                row[header_name] = val

            rows.append(row)

        if fmt == "json":
            response = HttpResponse(json.dumps(rows, default=str, indent=2), content_type="application/json")
        else:
            response = HttpResponse(content_type="text/csv; charset=utf-8")
            header_fields = ["Submission ID", "Submitted At", "Status", "Duration", *[field_header_map[f.id] for f in fields]]
            writer = csv.DictWriter(response, fieldnames=header_fields, extrasaction="ignore")
            writer.writeheader()
            writer.writerows(rows)

        clean_slug = "".join(c if c.isalnum() else "_" for c in form.title.lower()).strip("_")
        response["Content-Disposition"] = f'attachment; filename="{clean_slug}_responses.{fmt}"'
        return response



class RetentionView(APIView):
    permission_classes = [IsAuthenticated]
    def post(self, request, id):
        form = get_object_or_404(Form, id=id, owner=request.user)
        serializer = RetentionSerializer(data=request.data); serializer.is_valid(raise_exception=True)
        form.retention_days = serializer.validated_data["retention_days"]; form.save(update_fields=["retention_days"])
        archived = archive_expired_submissions(form, request.user)
        AuditLog.objects.create(form=form, actor=request.user, action="retention_policy_updated", details={"retention_days": form.retention_days})
        return Response({"retention_days": form.retention_days, "archived_now": archived})


class BulkDeleteResponsesView(APIView):
    permission_classes = [IsAuthenticated]
    @transaction.atomic
    def post(self, request, id):
        form = get_object_or_404(Form, id=id, owner=request.user)
        serializer = BulkDeleteSerializer(data=request.data); serializer.is_valid(raise_exception=True)
        submissions = Submission.objects.filter(form_version__form=form, id__in=serializer.validated_data["submission_ids"]).prefetch_related("responses__upload")
        ids = list(submissions.values_list("id", flat=True))
        for submission in submissions:
            for item in submission.responses.all():
                if item.upload:
                    item.upload.file.delete(save=False); item.upload.delete()
        submissions.delete()
        AuditLog.objects.create(form=form, actor=request.user, action="responses_bulk_deleted", details={"submission_ids": ids})
        return Response({"deleted_submissions": len(ids)})


class FormResponsesView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, id):

        form = get_object_or_404(
            Form,
            id=id,
            owner=request.user,
        )

        submissions = (
            Submission.objects
            .filter(form_version__form=form)
            .prefetch_related(
                "responses",
                "responses__field",
            )
            .order_by("-created_at")
        )
        archive_expired_submissions(form, request.user)
        status_filter = request.query_params.get("status")
        if status_filter in {"started", "submitted", "archived"}:
            submissions = submissions.filter(status=status_filter)
        else:
            # By default, only show completed submitted/archived responses (exclude empty started sessions)
            submissions = submissions.filter(status__in=["submitted", "archived"])
        if parse_date(request.query_params.get("start_date", "")):
            submissions = submissions.filter(created_at__date__gte=parse_date(request.query_params["start_date"]))
        if parse_date(request.query_params.get("end_date", "")):
            submissions = submissions.filter(created_at__date__lte=parse_date(request.query_params["end_date"]))
        field_id, field_value = request.query_params.get("field_id"), request.query_params.get("field_value")
        if field_id and field_value is not None:
            try: field_value = json.loads(field_value)
            except json.JSONDecodeError: pass
            submissions = submissions.filter(responses__field_id=field_id, responses__value=field_value)
        search = request.query_params.get("search")
        if search:
            submissions = [submission for submission in submissions if any(search.lower() in str(item.value).lower() for item in submission.responses.all())]
        page_size = min(max(int(request.query_params.get("page_size", 10)), 1), 100)
        paginator = Paginator(submissions, page_size); page = paginator.get_page(request.query_params.get("page", 1))

        serializer = SubmissionDetailSerializer(
            page.object_list,
            many=True,
            context={"request": request},
        )
        return Response({"count": paginator.count, "page": page.number, "page_size": page_size, "total_pages": paginator.num_pages, "results": serializer.data})

    @action(detail=True, methods=["post"])
    @transaction.atomic
    def duplicate(self, request, pk=None):
        source = self.get_object()
        old_version = source.versions.filter(is_active=True).first()
        if not old_version:
            raise ValidationError("No active version found.")
        copied_form = Form.objects.create(owner=request.user, title=request.data.get("title") or f"Copy of {source.title}", description=source.description, retention_days=source.retention_days)
        version = FormVersion.objects.create(form=copied_form, version=1, status="draft", is_active=True)
        field_map = {}
        for field in old_version.fields.prefetch_related("options"):
            copied = Field.objects.create(form_version=version, label=field.label, field_type=field.field_type, required=field.required, placeholder=field.placeholder, help_text=field.help_text, display_order=field.display_order, config=field.config)
            field_map[field.id] = copied
            for option in field.options.all():
                FieldOption.objects.create(field=copied, label=option.label, value=option.value, display_order=option.display_order)
        for rule in old_version.conditional_rules.all():
            ConditionalRule.objects.create(form_version=version, trigger_field=field_map[rule.trigger_field_id], target_field=field_map[rule.target_field_id], operator=rule.operator, comparison_value=rule.comparison_value, action=rule.action)
        AuditLog.objects.create(form=copied_form, actor=request.user, action="form_duplicated", details={"source_form_id": source.id})
        return Response(FormSerializer(copied_form).data, status=status.HTTP_201_CREATED)

class DownloadUploadView(APIView):
    permission_classes = [AllowAny]

    def get(self, request, token):
        try:
            upload_id = signing.loads(token, salt="form-upload", max_age=60 * 60 * 24)
            upload = StoredUpload.objects.get(pk=upload_id)
        except (signing.BadSignature, StoredUpload.DoesNotExist):
            raise Http404
        return FileResponse(upload.file.open("rb"), as_attachment=True, filename=upload.original_name)


class ConditionalRuleViewSet(viewsets.ModelViewSet):
    serializer_class = ConditionalRuleSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):

        return ConditionalRule.objects.filter(
            form_version__form__owner=self.request.user
        ).select_related(
            "form_version",
            "trigger_field",
            "target_field",
        )


class TranslateTextView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        from .sarvam_service import translate_text_with_sarvam
        text = request.data.get("text", "")
        target_lang = request.data.get("target_lang", "hi")
        source_lang = request.data.get("source_lang", "en")

        if not text:
            return Response({"translated_text": ""}, status=status.HTTP_200_OK)

        translated = translate_text_with_sarvam(text, target_lang=target_lang, source_lang=source_lang)
        return Response({
            "original_text": text,
            "translated_text": translated,
            "target_lang": target_lang,
            "source_lang": source_lang,
        }, status=status.HTTP_200_OK)
