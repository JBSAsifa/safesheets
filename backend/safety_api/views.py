
import os

from django.contrib.auth import authenticate, login, logout
from django.core.files.storage import default_storage
from django.db import transaction
from django.http import FileResponse, JsonResponse
from django.shortcuts import get_object_or_404
from django.views.decorators.csrf import csrf_protect
from django.views.decorators.csrf import ensure_csrf_cookie
from rest_framework import generics, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.exceptions import ValidationError
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response

from .models import Chemical, SDSDocument
from .serializers import ChemicalSerializer, SDSDocumentSerializer

def health_check(request):
    return JsonResponse({
        "status": "ok",
        "app": "SafeSheets API",
        "message": "The backend is running.",
    })


@ensure_csrf_cookie
@api_view(["GET"])
@permission_classes([AllowAny])
def csrf_token(request):
    return Response({"detail": "CSRF cookie set."})


@api_view(["POST"])
@permission_classes([AllowAny])
@csrf_protect
def login_view(request):
    username = request.data.get("username", "")
    password = request.data.get("password", "")

    if not isinstance(username, str) or not isinstance(password, str):
        return Response(
            {"detail": "Username and password must be strings."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    user = authenticate(
        request,
        username=username.strip(),
        password=password,
    )

    if user is None:
        return Response(
            {"detail": "Invalid username or password."},
            status=status.HTTP_401_UNAUTHORIZED,
        )

    login(request, user)

    return Response({
        "detail": "Login successful.",
        "username": user.get_username(),
    })


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def logout_view(request):
    logout(request)
    return Response({"detail": "Logout successful."})


@api_view(["GET"])
@permission_classes([AllowAny])
def session_view(request):
    if not request.user.is_authenticated:
        return Response({"authenticated": False})

    return Response({
        "authenticated": True,
        "username": request.user.get_username(),
    })


class ChemicalListCreateView(generics.ListCreateAPIView):
    queryset = Chemical.objects.prefetch_related("sds_documents").all()
    serializer_class = ChemicalSerializer
    permission_classes = [IsAuthenticated]

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)


class ChemicalDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = Chemical.objects.prefetch_related("sds_documents").all()
    serializer_class = ChemicalSerializer
    permission_classes = [IsAuthenticated]

    def perform_destroy(self, instance):
        # Delete linked rows and PDFs together as the documented cascade policy.
        file_names = list(
            instance.sds_documents.exclude(sds_file="").values_list(
                "sds_file", flat=True
            )
        )
        with transaction.atomic():
            instance.delete()
            transaction.on_commit(
                lambda: [default_storage.delete(name) for name in file_names]
            )


class SDSDocumentListCreateView(generics.ListCreateAPIView):
    queryset = SDSDocument.objects.select_related("chemical").order_by(
        "-created_at"
    )
    serializer_class = SDSDocumentSerializer
    permission_classes = [IsAuthenticated]

    parser_classes = [
        MultiPartParser,
        FormParser,
        JSONParser,
    ]

    def get_queryset(self):
        queryset = super().get_queryset()
        review_status = self.request.query_params.get("review_status")

        allowed_statuses = {
            SDSDocument.ReviewStatus.CURRENT,
            SDSDocument.ReviewStatus.DUE_SOON,
            SDSDocument.ReviewStatus.OVERDUE,
            SDSDocument.ReviewStatus.UNKNOWN,
        }

        if review_status is None:
            return queryset

        if review_status not in allowed_statuses:
            raise ValidationError({
                "review_status": (
                    "Invalid status. Choose current, due_soon, "
                    "overdue, or unknown."
                )
            })

        return [
            document
            for document in queryset
            if document.review_status == review_status
        ]


class SDSDocumentDetailView(generics.RetrieveUpdateAPIView):
    queryset = SDSDocument.objects.select_related("chemical").all()
    serializer_class = SDSDocumentSerializer
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def perform_update(self, serializer):
        old_file_name = serializer.instance.sds_file.name
        document = serializer.save()
        new_file_name = document.sds_file.name
        if old_file_name and old_file_name != new_file_name:
            transaction.on_commit(lambda: default_storage.delete(old_file_name))

@api_view(["GET"])
@permission_classes([IsAuthenticated])
def sds_document_file(request, pk):
    document = get_object_or_404(SDSDocument, pk=pk)

    if not document.sds_file:
        return Response(
            {"detail": "No PDF is attached to this SDS document."},
            status=status.HTTP_404_NOT_FOUND,
        )

    try:
        file_handle = document.sds_file.open("rb")
    except (FileNotFoundError, OSError):
        return Response(
            {"detail": "The uploaded PDF could not be found."},
            status=status.HTTP_404_NOT_FOUND,
        )

    return FileResponse(
        file_handle,
        content_type="application/pdf",
        as_attachment=False,
        filename=os.path.basename(document.sds_file.name),
    )
