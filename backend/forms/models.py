from django.db import models
from django.contrib.auth.models import User
import uuid


class Form(models.Model):
    STATUS_CHOICES = [
        ("draft", "Draft"),
        ("published", "Published"),
        ("archived", "Archived"),
    ]

    title = models.CharField(max_length=255)
    description = models.TextField(blank=True, null=True)

    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default="draft"
    )

    owner = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="forms"
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    retention_days = models.PositiveIntegerField(null=True, blank=True)
    expires_at = models.DateTimeField(null=True, blank=True)
    require_email_verification = models.BooleanField(default=False)
    limit_one_submission_per_email = models.BooleanField(default=False)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return self.title

    def check_auto_expire(self):
        from django.utils import timezone
        # Only published forms should auto-expire and archive when their public submission deadline passes
        if self.status == "published" and self.expires_at and timezone.now() >= self.expires_at:
            self.status = "archived"
            self.save(update_fields=["status"])
            self.versions.filter(status="published").update(status="archived")
            return True
        return False


class FormVersion(models.Model):
    STATUS_CHOICES = [
        ("draft", "Draft"),
        ("published", "Published"),
        ("archived", "Archived"),
    ]

    form = models.ForeignKey(
        Form,
        on_delete=models.CASCADE,
        related_name="versions"
    )

    version = models.PositiveIntegerField()

    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default="draft",
    )

    is_active = models.BooleanField(default=False)

    share_token = models.UUIDField(
        default=uuid.uuid4,
        unique=True,
        editable=False,
    )

    published_at = models.DateTimeField(
        blank=True,
        null=True,
    )

    created_at = models.DateTimeField(
        auto_now_add=True,
    )

    class Meta:
        ordering = ["-version"]
        unique_together = ("form", "version")

    def __str__(self):
        return f"{self.form.title} - Version {self.version}"


class ConditionalRule(models.Model):
    form_version = models.ForeignKey(
        FormVersion,
        on_delete=models.CASCADE,
        related_name="conditional_rules",
    )

    trigger_field = models.ForeignKey(
        "fields.Field",
        on_delete=models.CASCADE,
        related_name="trigger_rules",
        null=True,
        blank=True,
    )

    target_field = models.ForeignKey(
        "fields.Field",
        on_delete=models.CASCADE,
        related_name="target_rules",
        null=True,
        blank=True,
    )

    operator = models.CharField(
        max_length=30,
        choices=[
            ("equals", "Equals"),
            ("not_equals", "Not Equals"),
            ("contains", "Contains"),
            ("greater_than", "Greater Than"),
            ("is_empty", "Is Empty"),
        ],
        default="equals",
    )

    comparison_value = models.JSONField(
        blank=True,
        null=True,
    )

    action = models.CharField(
        max_length=20,
        choices=[
            ("show", "Show"),
            ("hide", "Hide"),
            ("require", "Require"),
        ],
        default="show",
    )

    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        trigger = self.trigger_field.label if self.trigger_field else "None"
        target = self.target_field.label if self.target_field else "None"

        return (
            f"{trigger} "
            f"{self.operator} "
            f"{self.comparison_value} -> "
            f"{self.action} {target}"
        )


class Submission(models.Model):
    STATUS_CHOICES = [("started", "Started"), ("submitted", "Submitted"), ("archived", "Archived")]
    form_version = models.ForeignKey(
        FormVersion,
        on_delete=models.CASCADE,
        related_name="submissions"
    )

    submitted_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True
    )

    created_at = models.DateTimeField(auto_now_add=True)
    session_token = models.UUIDField(default=uuid.uuid4, unique=True, editable=False)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="submitted")
    respondent_email = models.EmailField(blank=True, null=True, db_index=True)
    started_at = models.DateTimeField(auto_now_add=True)
    submitted_at = models.DateTimeField(null=True, blank=True)

    def __str__(self):
        return f"Submission {self.id} ({self.respondent_email or 'Anonymous'})"


class ResponseValue(models.Model):
    submission = models.ForeignKey(
        Submission,
        on_delete=models.CASCADE,
        related_name="responses"
    )

    field = models.ForeignKey(
        "fields.Field",
        on_delete=models.CASCADE
    )

    upload = models.OneToOneField(
        "StoredUpload",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="response_value",
    )

    value = models.JSONField(default=dict)

    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.field.label}: {self.value}"


class StoredUpload(models.Model):
    file = models.FileField(upload_to="form_uploads/%Y/%m/%d/")
    original_name = models.CharField(max_length=255)
    content_type = models.CharField(max_length=255, blank=True)
    size = models.PositiveBigIntegerField()
    created_at = models.DateTimeField(auto_now_add=True)


class AuditLog(models.Model):
    form = models.ForeignKey(Form, on_delete=models.SET_NULL, null=True, related_name="audit_logs")
    actor = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)
    action = models.CharField(max_length=100)
    details = models.JSONField(default=dict)
    created_at = models.DateTimeField(auto_now_add=True)


class OneTimeToken(models.Model):
    token = models.UUIDField(default=uuid.uuid4, unique=True, editable=False, db_index=True)
    form_version = models.ForeignKey(
        FormVersion,
        on_delete=models.CASCADE,
        related_name="one_time_tokens"
    )
    label = models.CharField(max_length=255, blank=True, null=True)
    is_used = models.BooleanField(default=False)
    used_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        status = "Used" if self.is_used else "Active"
        return f"OneTimeToken ({self.label or self.token}) - {status}"

    @property
    def is_expired(self):
        from django.utils import timezone
        if self.expires_at and timezone.now() >= self.expires_at:
            return True
        return False


class EmailVerificationOTP(models.Model):
    form = models.ForeignKey(
        Form,
        on_delete=models.CASCADE,
        related_name="otp_verifications"
    )
    email = models.EmailField(db_index=True)
    otp_code = models.CharField(max_length=6)
    verification_token = models.UUIDField(default=uuid.uuid4, unique=True, db_index=True)
    is_verified = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField()

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"OTP for {self.email} on Form {self.form_id} (Verified: {self.is_verified})"

    @property
    def is_expired(self):
        from django.utils import timezone
        return timezone.now() >= self.expires_at


