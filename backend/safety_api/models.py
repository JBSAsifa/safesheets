
from datetime import timedelta

from django.conf import settings
from django.core.exceptions import ValidationError
from django.core.validators import FileExtensionValidator
from django.db import models
from django.utils import timezone


MAX_SDS_FILE_SIZE = 10 * 1024 * 1024  # 10 MB


def validate_sds_file(file):
    """Validate the size and basic PDF file signature."""
    if file.size > MAX_SDS_FILE_SIZE:
        raise ValidationError("The SDS PDF must be 10 MB or smaller.")

    current_position = file.tell()
    try:
        file.seek(0)
        header = file.read(5)
    finally:
        file.seek(current_position)

    if header != b"%PDF-":
        raise ValidationError("The uploaded file does not appear to be a valid PDF.")


class Chemical(models.Model):
    name = models.CharField(max_length=200)
    manufacturer = models.CharField(max_length=200, blank=True)
    location = models.CharField(max_length=200, blank=True)
    notes = models.TextField(blank=True)

    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="chemicals",
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["name"]

    def __str__(self):
        return self.name


class SDSDocument(models.Model):
    class ReviewStatus(models.TextChoices):
        CURRENT = "current", "Current"
        DUE_SOON = "due_soon", "Due soon"
        OVERDUE = "overdue", "Overdue"
        UNKNOWN = "unknown", "Unknown"

    chemical = models.ForeignKey(
        Chemical,
        on_delete=models.CASCADE,
        related_name="sds_documents",
    )

    title = models.CharField(max_length=200)
    revision_date = models.DateField(null=True, blank=True)
    next_review_date = models.DateField(null=True, blank=True)

    # Retained for compatibility with existing records and references.
    file_reference = models.CharField(max_length=500, blank=True)

    # Actual uploaded SDS PDF. Optional so existing records remain valid.
    sds_file = models.FileField(
        upload_to="sds_documents/",
        blank=True,
        null=True,
        validators=[
            FileExtensionValidator(allowed_extensions=["pdf"]),
            validate_sds_file,
        ],
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["title"]

    @property
    def review_status(self):
        if self.next_review_date is None:
            return self.ReviewStatus.UNKNOWN

        today = timezone.localdate()

        if self.next_review_date < today:
            return self.ReviewStatus.OVERDUE

        if self.next_review_date <= today + timedelta(days=30):
            return self.ReviewStatus.DUE_SOON

        return self.ReviewStatus.CURRENT

    def __str__(self):
        return self.title
