
from django.urls import path

from .views import (
    ChemicalDetailView,
    ChemicalListCreateView,
    SDSDocumentListCreateView,
    health_check,
)

urlpatterns = [
    path("health/", health_check, name="health_check"),
    path("chemicals/", ChemicalListCreateView.as_view(), name="chemical-list"),
    path(
        "chemicals/<int:pk>/",
        ChemicalDetailView.as_view(),
        name="chemical-detail",
    ),
    path(
        "sds-documents/",
        SDSDocumentListCreateView.as_view(),
        name="sds-document-list",
    ),
]
