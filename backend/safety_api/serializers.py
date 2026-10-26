
from rest_framework import serializers
from django.core.validators import FileExtensionValidator

from .models import Chemical, SDSDocument, validate_sds_file


class SDSFileField(serializers.FileField):
    """Accept a validated upload but expose only whether one is attached."""

    def to_representation(self, value):
        return bool(value)


class OptionalDateField(serializers.DateField):
    """Treat empty multipart date controls as a null date value."""

    def to_internal_value(self, value):
        if value == "":
            return None
        return super().to_internal_value(value)


class SDSDocumentSerializer(serializers.ModelSerializer):
    review_status = serializers.ReadOnlyField()
    revision_date = OptionalDateField(required=False, allow_null=True)
    next_review_date = OptionalDateField(required=False, allow_null=True)
    sds_file = SDSFileField(
        required=False,
        allow_null=True,
        validators=[
            FileExtensionValidator(allowed_extensions=["pdf"]),
            validate_sds_file,
        ],
    )

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
            "sds_file",
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
        read_only_fields = [
            "id",
            "created_at",
            "updated_at",
        ]
