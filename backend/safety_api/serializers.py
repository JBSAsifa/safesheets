
from rest_framework import serializers
from .models import Chemical, SDSDocument


class SDSDocumentSerializer(serializers.ModelSerializer):
    review_status = serializers.ReadOnlyField()

    class Meta:
        model = SDSDocument
        fields = [
            "id",
            "chemical",
            "title",
            "revision_date",
            "next_review_date",
            "review_status",
            "file_reference",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "review_status",
            "created_at",
            "updated_at",
        ]


class ChemicalSerializer(serializers.ModelSerializer):
    sds_documents = SDSDocumentSerializer(many=True, read_only=True)

    class Meta:
        model = Chemical
        fields = [
            "id",
            "name",
            "manufacturer",
            "location",
            "notes",
            "sds_documents",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]
