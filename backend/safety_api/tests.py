
from datetime import date, timedelta
from unittest.mock import patch

from django.test import TestCase
from rest_framework.test import APIClient

from .models import Chemical, SDSDocument


class SDSReviewStatusTests(TestCase):
    def setUp(self):
        self.chemical = Chemical.objects.create(
            name="Test Chemical",
            manufacturer="Test Manufacturer",
            location="Test Storage",
        )

    def create_document(self, next_review_date=None):
        return SDSDocument.objects.create(
            chemical=self.chemical,
            title="Test SDS",
            next_review_date=next_review_date,
        )

    @patch("safety_api.models.timezone.localdate")
    def test_missing_date_is_unknown(self, mock_today):
        mock_today.return_value = date(2026, 10, 11)
        document = self.create_document()

        self.assertEqual(
            document.review_status,
            SDSDocument.ReviewStatus.UNKNOWN,
        )

    @patch("safety_api.models.timezone.localdate")
    def test_yesterday_is_overdue(self, mock_today):
        today = date(2026, 10, 11)
        mock_today.return_value = today
        document = self.create_document(today - timedelta(days=1))

        self.assertEqual(
            document.review_status,
            SDSDocument.ReviewStatus.OVERDUE,
        )

    @patch("safety_api.models.timezone.localdate")
    def test_today_is_due_soon(self, mock_today):
        today = date(2026, 10, 11)
        mock_today.return_value = today
        document = self.create_document(today)

        self.assertEqual(
            document.review_status,
            SDSDocument.ReviewStatus.DUE_SOON,
        )

    @patch("safety_api.models.timezone.localdate")
    def test_thirty_days_ahead_is_due_soon(self, mock_today):
        today = date(2026, 10, 11)
        mock_today.return_value = today
        document = self.create_document(today + timedelta(days=30))

        self.assertEqual(
            document.review_status,
            SDSDocument.ReviewStatus.DUE_SOON,
        )

    @patch("safety_api.models.timezone.localdate")
    def test_thirty_one_days_ahead_is_current(self, mock_today):
        today = date(2026, 10, 11)
        mock_today.return_value = today
        document = self.create_document(today + timedelta(days=31))

        self.assertEqual(
            document.review_status,
            SDSDocument.ReviewStatus.CURRENT,
        )

    @patch("safety_api.models.timezone.localdate")
    def test_api_includes_calculated_review_status(self, mock_today):
        today = date(2026, 10, 11)
        mock_today.return_value = today
        document = self.create_document(today + timedelta(days=30))

        response = APIClient().get("/api/sds-documents/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            response.data[0]["id"],
            document.id,
        )
        self.assertEqual(
            response.data[0]["review_status"],
            "due_soon",
        )

class SDSReviewStatusFilterTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.chemical = Chemical.objects.create(name="Filter Test Chemical")
        today = date(2026, 10, 11)

        with patch("safety_api.models.timezone.localdate", return_value=today):
            self.overdue = SDSDocument.objects.create(
                chemical=self.chemical,
                title="Overdue SDS",
                next_review_date=today - timedelta(days=1),
            )
            self.due_soon = SDSDocument.objects.create(
                chemical=self.chemical,
                title="Due Soon SDS",
                next_review_date=today + timedelta(days=10),
            )
            self.current = SDSDocument.objects.create(
                chemical=self.chemical,
                title="Current SDS",
                next_review_date=today + timedelta(days=31),
            )
            self.unknown = SDSDocument.objects.create(
                chemical=self.chemical,
                title="Unknown SDS",
                next_review_date=None,
            )

    @patch("safety_api.models.timezone.localdate", return_value=date(2026, 10, 11))
    def test_filter_overdue(self, mock_today):
        response = self.client.get(
            "/api/sds-documents/?review_status=overdue"
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            [item["id"] for item in response.data],
            [self.overdue.id],
        )

    @patch("safety_api.models.timezone.localdate", return_value=date(2026, 10, 11))
    def test_filter_due_soon(self, mock_today):
        response = self.client.get(
            "/api/sds-documents/?review_status=due_soon"
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            [item["id"] for item in response.data],
            [self.due_soon.id],
        )

    def test_invalid_status_returns_400(self):
        response = self.client.get(
            "/api/sds-documents/?review_status=invalid"
        )
        self.assertEqual(response.status_code, 400)

    def test_no_filter_returns_all_documents(self):
        response = self.client.get("/api/sds-documents/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data), 4)
