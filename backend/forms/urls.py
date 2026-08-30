from django.urls import path
from rest_framework.routers import DefaultRouter

from .views import (
    FormViewSet,
    PublicFormView,
    StartFormResponseView,
    SubmitFormView,
    FormResponsesView,
    FormAnalyticsView,
    ExportResponsesView,
    RetentionView,
    BulkDeleteResponsesView,
    ConditionalRuleViewSet,
    DownloadUploadView,
    OneTimeLinkView,
    AutoGenerateFormView,
    SendPublicFormOTPView,
    VerifyPublicFormOTPView,
    TranslateTextView,
)


router = DefaultRouter()

router.register(
    r"forms",
    FormViewSet,
    basename="forms",
)

router.register(
    r"conditional-rules",
    ConditionalRuleViewSet,
    basename="conditional-rules",
)

urlpatterns = [
    # AI / Automated Form Creation
    path("forms/auto-generate/", AutoGenerateFormView.as_view(), name="auto-generate-form"),

    # One-Time Links Management
    path("forms/<int:id>/one-time-links/", OneTimeLinkView.as_view(), name="one-time-links"),
    path("forms/<int:id>/one-time-links/<uuid:token_id>/", OneTimeLinkView.as_view(), name="one-time-link-delete"),

    # Standard Public Form
    path("forms/share/<uuid:share_token>/", PublicFormView.as_view(), name="public-form"),
    path("forms/share/<uuid:share_token>/start/", StartFormResponseView.as_view(), name="start-form-response"),
    path("forms/share/<uuid:share_token>/submit/", SubmitFormView.as_view(), name="submit-form"),
    path("forms/share/<uuid:share_token>/send-otp/", SendPublicFormOTPView.as_view(), name="public-form-send-otp"),
    path("forms/share/<uuid:share_token>/verify-otp/", VerifyPublicFormOTPView.as_view(), name="public-form-verify-otp"),

    # One-Time Single-Use Public Form
    path("forms/single/<uuid:single_token>/", PublicFormView.as_view(), name="public-form-single"),
    path("forms/single/<uuid:single_token>/start/", StartFormResponseView.as_view(), name="start-form-response-single"),
    path("forms/single/<uuid:single_token>/submit/", SubmitFormView.as_view(), name="submit-form-single"),
    path("forms/single/<uuid:single_token>/send-otp/", SendPublicFormOTPView.as_view(), name="single-form-send-otp"),
    path("forms/single/<uuid:single_token>/verify-otp/", VerifyPublicFormOTPView.as_view(), name="single-form-verify-otp"),

    path("forms/<int:id>/responses/", FormResponsesView.as_view(), name="form-responses"),
    path("uploads/<str:token>/", DownloadUploadView.as_view(), name="download-upload"),
    path("forms/<int:id>/analytics/", FormAnalyticsView.as_view(), name="form-analytics"),
    path("forms/<int:id>/export/", ExportResponsesView.as_view(), name="form-export"),
    path("forms/<int:id>/retention/", RetentionView.as_view(), name="form-retention"),
    path("forms/<int:id>/responses/bulk-delete/", BulkDeleteResponsesView.as_view(), name="bulk-delete-responses"),
    path("translate/", TranslateTextView.as_view(), name="translate-text"),
]


urlpatterns += router.urls
