from django.core.management.base import BaseCommand
from forms.models import Form
from forms.services import archive_expired_submissions


class Command(BaseCommand):
    help = "Archive submitted responses that exceed each form's retention period."

    def handle(self, *args, **options):
        archived = sum(archive_expired_submissions(form) for form in Form.objects.exclude(retention_days__isnull=True))
        self.stdout.write(self.style.SUCCESS(f"Archived {archived} submission(s)."))
