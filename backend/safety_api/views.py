
from django.http import JsonResponse
from rest_framework import generics
from rest_framework.permissions import IsAuthenticatedOrReadOnly

from .models import Chemical, SDSDocument
from .serializers import ChemicalSerializer, SDSDocumentSerializer


def health_check(request):
    return JsonResponse({
        "status": "ok",
        "app": "SafeSheets API",
        "message": "The backend is running.",
    })


class ChemicalListCreateView(generics.ListCreateAPIView):
    queryset = Chemical.objects.prefetch_related("sds_documents").all()
    serializer_class = ChemicalSerializer
    permission_classes = [IsAuthenticatedOrReadOnly]


class ChemicalDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = Chemical.objects.prefetch_related("sds_documents").all()
    serializer_class = ChemicalSerializer
    permission_classes = [IsAuthenticatedOrReadOnly]


class SDSDocumentListCreateView(generics.ListCreateAPIView):
    queryset = SDSDocument.objects.select_related("chemical").all()
    serializer_class = SDSDocumentSerializer
    permission_classes = [IsAuthenticatedOrReadOnly]
