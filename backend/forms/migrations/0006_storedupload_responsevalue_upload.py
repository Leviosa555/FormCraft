# Generated manually for Milestone 2 file uploads.
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    dependencies = [("forms", "0005_remove_conditionalrule_rule_conditionalrule_action_and_more")]

    operations = [
        migrations.CreateModel(
            name="StoredUpload",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("file", models.FileField(upload_to="form_uploads/%Y/%m/%d/")),
                ("original_name", models.CharField(max_length=255)),
                ("content_type", models.CharField(blank=True, max_length=255)),
                ("size", models.PositiveBigIntegerField()),
                ("created_at", models.DateTimeField(auto_now_add=True)),
            ],
        ),
        migrations.AddField(
            model_name="responsevalue",
            name="upload",
            field=models.OneToOneField(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="response_value", to="forms.storedupload"),
        ),
    ]
