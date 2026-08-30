from django.db import models


class Field(models.Model):

    FIELD_TYPES = [
        ("text", "Text"),
        ("number", "Number"),
        ("email", "Email"),
        ("dropdown", "Dropdown"),
        ("checkbox", "Checkbox"),
        ("date", "Date"),
        ("file", "File"),
        ("rating", "Rating"),
    ]

    form_version = models.ForeignKey(
        "forms.FormVersion",
        on_delete=models.CASCADE,
        related_name="fields"
    )

    label = models.CharField(max_length=255)

    field_type = models.CharField(
        max_length=20,
        choices=FIELD_TYPES
    )

    required = models.BooleanField(default=False)

    placeholder = models.CharField(
        max_length=255,
        blank=True,
        null=True
    )

    help_text = models.TextField(
        blank=True,
        null=True
    )

    display_order = models.PositiveIntegerField(default=1)

    config = models.JSONField(default=dict)

    created_at = models.DateTimeField(auto_now_add=True)

    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["display_order"]

    def __str__(self):
        return self.label

class FieldOption(models.Model):
    field = models.ForeignKey(
        Field,
        on_delete=models.CASCADE,
        related_name="options"
    )

    label = models.CharField(max_length=255)

    value = models.CharField(max_length=255)

    display_order = models.PositiveIntegerField(default=1)

    class Meta:
        ordering = ["display_order"]

    def __str__(self):
        return f"{self.field.label} - {self.label}"