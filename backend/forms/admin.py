from django.contrib import admin
from .models import AuditLog, Form, FormVersion, StoredUpload, Submission

admin.site.register(Form)
admin.site.register(FormVersion)
admin.site.register(Submission)
admin.site.register(StoredUpload)
admin.site.register(AuditLog)
