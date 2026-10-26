
from django.urls import path

from .views import (
    ChemicalDetailView,
    ChemicalListCreateView,
    SDSDocumentDetailView,
    SDSDocumentListCreateView,
    csrf_token,
    health_check,
    login_view,
    logout_view,
    session_view,
    sds_document_file,
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
    path(
        "sds-documents/<int:pk>/",
        SDSDocumentDetailView.as_view(),
        name="sds-document-detail",
    ),
    path(
        "sds-documents/<int:pk>/file/",
        sds_document_file,
        name="sds-document-file",
    ),
    path("csrf-token/", csrf_token, name="csrf_token"),
    path("auth/login/", login_view, name="login"),
    path("auth/logout/", logout_view, name="logout"),
    path("auth/session/", session_view, name="session"),
]
