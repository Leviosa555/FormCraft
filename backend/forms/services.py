from datetime import timedelta
from django.core import signing
from django.utils import timezone

from .models import AuditLog, Submission


def signed_upload_url(upload, request):
    return request.build_absolute_uri(f"/api/uploads/{signing.dumps(upload.pk, salt='form-upload')}/")


def archive_expired_submissions(form, actor=None):
    if not form.retention_days:
        return 0
    cutoff = timezone.now() - timedelta(days=form.retention_days)
    count = Submission.objects.filter(
        form_version__form=form, status="submitted", submitted_at__lt=cutoff
    ).update(status="archived")
    if count:
        AuditLog.objects.create(
            form=form,
            actor=actor,
            action="submissions_auto_archived",
            details={"count": count, "retention_days": form.retention_days},
        )
    return count


def analytics_for_form(form):
    all_items = Submission.objects.filter(form_version__form=form)
    submitted = all_items.filter(status="submitted")
    archived = all_items.filter(status="archived")
    completed = all_items.filter(status__in=["submitted", "archived"])

    durations = [
        max(0, (item.submitted_at - item.started_at).total_seconds())
        for item in completed.exclude(submitted_at__isnull=True).exclude(started_at__isnull=True)
    ]

    # Duration buckets for response duration graph
    bucket_counts = {
        "< 15s": 0,
        "15-30s": 0,
        "30-60s": 0,
        "1-2m": 0,
        "2m+": 0,
    }
    for d in durations:
        if d < 15:
            bucket_counts["< 15s"] += 1
        elif d < 30:
            bucket_counts["15-30s"] += 1
        elif d < 60:
            bucket_counts["30-60s"] += 1
        elif d < 120:
            bucket_counts["1-2m"] += 1
        else:
            bucket_counts["2m+"] += 1

    duration_distribution = [
        {"value": label, "count": count} for label, count in bucket_counts.items()
    ]

    total_started = all_items.count()
    total_submitted = submitted.count()
    total_archived = archived.count()
    total_completed = completed.count()
    in_progress = max(0, total_started - total_completed)

    # Response status distribution for Pie/Donut charts
    status_distribution = [
        {"name": "Submitted", "value": total_submitted, "color": "#10b981"},
        {"name": "In-Progress", "value": in_progress, "color": "#f59e0b"},
        {"name": "Archived", "value": total_archived, "color": "#64748b"},
    ]

    # Submissions timeline distribution (all completed)
    timeline_map = {}
    for item in completed.filter(submitted_at__isnull=False).order_by("submitted_at"):
        day_key = item.submitted_at.strftime("%b %d")
        timeline_map[day_key] = timeline_map.get(day_key, 0) + 1

    timeline_distribution = [
        {"date": date_str, "submissions": count}
        for date_str, count in timeline_map.items()
    ]

    # Field answers distribution (all completed)
    version = form.versions.filter(is_active=True).first() or form.versions.order_by("-version").first()
    field_distributions = []
    if version:
        supported_types = ["dropdown", "rating", "radio", "checkbox", "select", "boolean", "scale", "number"]
        for field in version.fields.filter(field_type__in=supported_types):
            values = completed.filter(responses__field=field).values_list("responses__value", flat=True)
            counts = {}
            for value in values:
                if isinstance(value, list):
                    for v in value:
                        if v not in (None, ""):
                            counts[str(v)] = counts.get(str(v), 0) + 1
                elif value not in (None, ""):
                    counts[str(value)] = counts.get(str(value), 0) + 1
            if counts:
                field_distributions.append({
                    "field_id": field.id,
                    "label": field.label,
                    "field_type": field.field_type,
                    "distribution": [{"value": key, "count": value} for key, value in counts.items()],
                })

    completion_rate = round(total_completed * 100 / total_started, 1) if total_started else 0
    avg_sec = round(sum(durations) / len(durations), 1) if durations else 0

    return {
        "total_submissions": total_completed,
        "active_submissions": total_submitted,
        "archived_submissions": total_archived,
        "started_responses": total_started,
        "completion_rate": completion_rate,
        "average_completion_seconds": avg_sec,
        "status_distribution": status_distribution,
        "timeline_distribution": timeline_distribution,
        "duration_distribution": duration_distribution,
        "field_distributions": field_distributions,
    }

