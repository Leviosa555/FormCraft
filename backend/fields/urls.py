from django.urls import path

from .views import FieldViewSet

field_list = FieldViewSet.as_view({
    "get": "list",
    "post": "create",
})

field_detail = FieldViewSet.as_view({
    "put": "update",
    "patch": "partial_update",
    "delete": "destroy",
})

field_reorder = FieldViewSet.as_view({
    "patch": "reorder",
})

urlpatterns = [
    path(
        "forms/<int:form_id>/fields/",
        field_list,
        name="field-list",
    ),
    path(
        "forms/<int:form_id>/fields/reorder/",
        field_reorder,
        name="field-reorder",
    ),
    path(
        "fields/<int:pk>/",
        field_detail,
        name="field-detail",
    ),
]