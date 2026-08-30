from django.db import transaction
from django.shortcuts import get_object_or_404

from rest_framework import status, viewsets
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.exceptions import ValidationError

from forms.models import Form

from .models import Field
from .serializers import (
    FieldSerializer,
    ReorderFieldsSerializer,
)


class FieldViewSet(viewsets.ModelViewSet):
    serializer_class = FieldSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        queryset = (
            Field.objects.select_related("form_version")
            .prefetch_related("options")
            .order_by("display_order")
        )

        form_id = self.kwargs.get("form_id")

        # List endpoint
        if form_id is not None:
            queryset = queryset.filter(
                form_version__form_id=form_id,
                form_version__is_active=True,
                form_version__form__owner=self.request.user,
            )

        # Detail endpoint
        else:
            queryset = queryset.filter(
                form_version__form__owner=self.request.user,
            )

        return queryset

    def get_object(self):
        return get_object_or_404(
            self.get_queryset(),
            pk=self.kwargs["pk"],
        )

    def create(self, request, *args, **kwargs):
        form_id = self.kwargs.get("form_id")

        try:
            form = Form.objects.get(
                id=form_id,
                owner=request.user,
            )
        except Form.DoesNotExist:
            raise ValidationError("Form not found.")

        active_version = form.versions.filter(
            is_active=True
        ).first()

        if not active_version:
            raise ValidationError(
                "No active version found."
            )

        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        serializer.save(
            form_version=active_version
        )

        return Response(
            serializer.data,
            status=status.HTTP_201_CREATED,
        )

    def reorder(self, request, form_id=None):
        serializer = ReorderFieldsSerializer(
            data=request.data
        )

        serializer.is_valid(raise_exception=True)

        field_order = serializer.validated_data["field_order"]

        if not field_order:
            raise ValidationError(
                "field_order cannot be empty."
            )

        field_ids = [
            item["id"]
            for item in field_order
        ]

        if len(field_ids) != len(set(field_ids)):
            raise ValidationError(
                "Duplicate field IDs are not allowed."
            )

        display_orders = [
            item["display_order"]
            for item in field_order
        ]

        if len(display_orders) != len(set(display_orders)):
            raise ValidationError(
                "Duplicate display_order values are not allowed."
            )

        try:
            form = Form.objects.get(
                id=form_id,
                owner=request.user,
            )
        except Form.DoesNotExist:
            raise ValidationError("Form not found.")

        active_version = form.versions.filter(
            is_active=True
        ).first()

        if not active_version:
            raise ValidationError(
                "No active version found."
            )

        fields = {
            field.id: field
            for field in Field.objects.filter(
                form_version=active_version
            )
        }

        submitted_ids = {
            item["id"]
            for item in field_order
        }

        actual_ids = set(fields.keys())

        if submitted_ids != actual_ids:
            raise ValidationError(
                "All fields must be included exactly once."
            )

        with transaction.atomic():
            for item in field_order:
                field = fields[item["id"]]
                field.display_order = item["display_order"]
                field.save(update_fields=["display_order"])

        return Response(
            {
                "message": "Field order updated successfully."
            },
            status=status.HTTP_200_OK,
        )