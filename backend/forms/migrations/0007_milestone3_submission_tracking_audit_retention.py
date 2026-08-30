from django.db import migrations, models
import django.db.models.deletion
import uuid


def backfill_session_tokens(apps, schema_editor):
    Submission = apps.get_model("forms", "Submission")
    for submission in Submission.objects.filter(session_token__isnull=True).iterator():
        submission.session_token = uuid.uuid4()
        submission.save(update_fields=["session_token"])


class Migration(migrations.Migration):
    dependencies = [("forms", "0006_storedupload_responsevalue_upload")]
    operations = [
        migrations.AddField(model_name="form", name="retention_days", field=models.PositiveIntegerField(blank=True, null=True)),
        migrations.AddField(model_name="submission", name="session_token", field=models.UUIDField(blank=True, editable=False, null=True)),
        migrations.RunPython(backfill_session_tokens, migrations.RunPython.noop),
        migrations.AlterField(model_name="submission", name="session_token", field=models.UUIDField(default=uuid.uuid4, editable=False, unique=True)),
        migrations.AddField(model_name="submission", name="status", field=models.CharField(choices=[("started", "Started"), ("submitted", "Submitted"), ("archived", "Archived")], default="submitted", max_length=20)),
        migrations.AddField(model_name="submission", name="started_at", field=models.DateTimeField(auto_now_add=True)),
        migrations.AddField(model_name="submission", name="submitted_at", field=models.DateTimeField(blank=True, null=True)),
        migrations.CreateModel(name="AuditLog", fields=[
            ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
            ("action", models.CharField(max_length=100)), ("details", models.JSONField(default=dict)), ("created_at", models.DateTimeField(auto_now_add=True)),
            ("actor", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, to="auth.user")),
            ("form", models.ForeignKey(null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="audit_logs", to="forms.form")),
        ]),
    ]
