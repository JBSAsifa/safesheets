
from datetime import date, datetime, timedelta, timezone as datetime_timezone
import os
import tempfile
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.core.files.base import ContentFile
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient

from .models import MAX_SDS_FILE_SIZE, Chemical, SDSDocument


class SDSReviewStatusTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = get_user_model().objects.create_user(
            username="reviewtest",
            password="Test-Password-482!",
        )
        self.client.force_authenticate(user=self.user)

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

    def test_review_status_uses_the_active_timezone_for_today(self):
        document = self.create_document(date(2026, 10, 26))
        instant = datetime(
            2026, 10, 26, 18, 30, tzinfo=datetime_timezone.utc
        )

        with timezone.override("Asia/Dhaka"), patch(
            "safety_api.models.timezone.now", return_value=instant
        ):
            self.assertEqual(
                document.review_status,
                SDSDocument.ReviewStatus.OVERDUE,
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

        response = self.client.get("/api/sds-documents/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data[0]["id"], document.id)
        self.assertEqual(response.data[0]["review_status"], "due_soon")


class SDSReviewStatusFilterTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = get_user_model().objects.create_user(
            username="filtertest",
            password="Test-Password-482!",
        )
        self.client.force_authenticate(user=self.user)

        self.chemical = Chemical.objects.create(
            name="Filter Test Chemical"
        )
        today = date(2026, 10, 11)

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

    @patch(
        "safety_api.models.timezone.localdate",
        return_value=date(2026, 10, 11),
    )
    def test_filter_overdue(self, mock_today):
        response = self.client.get(
            "/api/sds-documents/?review_status=overdue"
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(
            [item["id"] for item in response.data],
            [self.overdue.id],
        )

    @patch(
        "safety_api.models.timezone.localdate",
        return_value=date(2026, 10, 11),
    )
    def test_filter_due_soon(self, mock_today):
        response = self.client.get(
            "/api/sds-documents/?review_status=due_soon"
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(
            [item["id"] for item in response.data],
            [self.due_soon.id],
        )

    @patch(
        "safety_api.models.timezone.localdate",
        return_value=date(2026, 10, 11),
    )
    def test_filter_current(self, mock_today):
        response = self.client.get(
            "/api/sds-documents/?review_status=current"
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual([item["id"] for item in response.data], [self.current.id])

    @patch(
        "safety_api.models.timezone.localdate",
        return_value=date(2026, 10, 11),
    )
    def test_filter_unknown(self, mock_today):
        response = self.client.get(
            "/api/sds-documents/?review_status=unknown"
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual([item["id"] for item in response.data], [self.unknown.id])

    def test_invalid_status_returns_400(self):
        response = self.client.get(
            "/api/sds-documents/?review_status=invalid"
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_400_BAD_REQUEST,
        )

    def test_no_filter_returns_all_documents(self):
        response = self.client.get("/api/sds-documents/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 4)


class SDSAuthenticationTests(TestCase):
    def test_anonymous_user_cannot_list_sds_documents(self):
        client = APIClient()

        response = client.get("/api/sds-documents/")

        self.assertEqual(
            response.status_code,
            status.HTTP_403_FORBIDDEN,
        )


class ChemicalWorkflowTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = get_user_model().objects.create_user(
            username="chemicalworkflow",
            password="Test-Password-482!",
        )
        self.client.force_authenticate(user=self.user)

    def test_create_and_update_keeps_the_same_record(self):
        created = self.client.post(
            "/api/chemicals/",
            {
                "name": "  Acetone  ",
                "manufacturer": "Maker",
                "location": "Cabinet A",
                "notes": "Initial note",
            },
            format="json",
        )

        self.assertEqual(created.status_code, status.HTTP_201_CREATED)
        chemical_id = created.data["id"]
        self.assertEqual(created.data["name"], "Acetone")
        self.assertEqual(
            Chemical.objects.get(pk=chemical_id).created_by_id,
            self.user.pk,
        )

        retrieved = self.client.get(f"/api/chemicals/{chemical_id}/")

        self.assertEqual(retrieved.status_code, status.HTTP_200_OK)
        self.assertEqual(retrieved.data["id"], chemical_id)
        self.assertEqual(retrieved.data["name"], "Acetone")

        updated = self.client.patch(
            f"/api/chemicals/{chemical_id}/",
            {"location": "Cabinet B"},
            format="json",
        )

        self.assertEqual(updated.status_code, status.HTTP_200_OK)
        self.assertEqual(updated.data["id"], chemical_id)
        self.assertEqual(updated.data["location"], "Cabinet B")
        self.assertEqual(Chemical.objects.count(), 1)

    def test_blank_name_is_rejected(self):
        response = self.client.post(
            "/api/chemicals/",
            {"name": "   "},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(Chemical.objects.count(), 0)

    def test_anonymous_user_cannot_update_chemical(self):
        chemical = Chemical.objects.create(name="Protected")
        anonymous_client = APIClient()

        response = anonymous_client.patch(
            f"/api/chemicals/{chemical.id}/",
            {"name": "Changed"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        chemical.refresh_from_db()
        self.assertEqual(chemical.name, "Protected")

    def test_session_authenticated_chemical_write_requires_csrf(self):
        client = APIClient(enforce_csrf_checks=True)
        client.force_login(self.user)

        rejected = client.post(
            "/api/chemicals/",
            {"name": "CSRF protected"},
            format="json",
        )
        self.assertEqual(rejected.status_code, status.HTTP_403_FORBIDDEN)

        client.get("/api/csrf-token/")
        csrf_token = client.cookies["csrftoken"].value
        accepted = client.post(
            "/api/chemicals/",
            {"name": "CSRF protected"},
            format="json",
            HTTP_X_CSRFTOKEN=csrf_token,
        )
        self.assertEqual(accepted.status_code, status.HTTP_201_CREATED)

    def test_delete_removes_chemical_sds_record_and_stored_file(self):
        with tempfile.TemporaryDirectory() as media_directory:
            with override_settings(MEDIA_ROOT=media_directory):
                chemical = Chemical.objects.create(name="Remove with documents")
                document = SDSDocument.objects.create(
                    chemical=chemical,
                    title="Attached PDF",
                )
                document.sds_file.save(
                    "attached.pdf",
                    ContentFile(b"%PDF-1.4\nfixture"),
                    save=True,
                )
                stored_path = document.sds_file.path

                with self.captureOnCommitCallbacks(execute=True):
                    response = self.client.delete(
                        f"/api/chemicals/{chemical.id}/"
                    )

                self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
                self.assertFalse(Chemical.objects.filter(pk=chemical.id).exists())
                self.assertFalse(SDSDocument.objects.filter(pk=document.id).exists())
                self.assertFalse(os.path.exists(stored_path))

    @patch(
        "safety_api.views.default_storage.delete",
        side_effect=OSError("disk unavailable"),
    )
    def test_file_cleanup_failure_does_not_report_committed_delete_as_failure(
        self, mock_delete
    ):
        chemical = Chemical.objects.create(name="Cleanup failure chemical")
        document = SDSDocument.objects.create(
            chemical=chemical,
            title="Stored document",
            sds_file="sds_documents/unavailable.pdf",
        )

        with self.assertLogs("safety_api.views", level="ERROR"):
            with self.captureOnCommitCallbacks(execute=True):
                response = self.client.delete(f"/api/chemicals/{chemical.id}/")

        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(Chemical.objects.filter(pk=chemical.id).exists())
        self.assertFalse(SDSDocument.objects.filter(pk=document.id).exists())
        mock_delete.assert_called_once_with("sds_documents/unavailable.pdf")

    def test_anonymous_user_cannot_delete_chemical(self):
        chemical = Chemical.objects.create(name="Protected delete")
        response = APIClient().delete(f"/api/chemicals/{chemical.id}/")

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertTrue(Chemical.objects.filter(pk=chemical.id).exists())


class SDSFileWorkflowTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = get_user_model().objects.create_user(
            username="sdsfileworkflow",
            password="Test-Password-482!",
        )
        self.chemical = Chemical.objects.create(name="File test chemical")

    def test_missing_stored_file_returns_not_found_without_path(self):
        self.client.force_authenticate(user=self.user)
        document = SDSDocument.objects.create(
            chemical=self.chemical,
            title="Missing file",
            sds_file="sds_documents/does-not-exist.pdf",
        )

        response = self.client.get(
            f"/api/sds-documents/{document.id}/file/"
        )

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
        self.assertNotIn("does-not-exist", response.data["detail"])

    def test_rejects_non_pdf_content_with_pdf_extension(self):
        self.client.force_authenticate(user=self.user)
        response = self.client.post(
            "/api/sds-documents/",
            {
                "chemical": self.chemical.id,
                "title": "Invalid PDF",
                "sds_file": SimpleUploadedFile(
                    "not-a-pdf.pdf",
                    b"plain text, not a PDF",
                    content_type="application/pdf",
                ),
            },
            format="multipart",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(SDSDocument.objects.count(), 0)

    def test_rejects_pdf_larger_than_ten_mib(self):
        self.client.force_authenticate(user=self.user)
        response = self.client.post(
            "/api/sds-documents/",
            {
                "chemical": self.chemical.id,
                "title": "Too large",
                "sds_file": SimpleUploadedFile(
                    "large.pdf",
                    b"%PDF-" + (b"0" * MAX_SDS_FILE_SIZE),
                    content_type="application/pdf",
                ),
            },
            format="multipart",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(SDSDocument.objects.count(), 0)

    def test_uploaded_pdf_requires_authentication_to_open(self):
        self.client.force_authenticate(user=self.user)

        with tempfile.TemporaryDirectory() as media_directory:
            with override_settings(MEDIA_ROOT=media_directory):
                created = self.client.post(
                    "/api/sds-documents/",
                    {
                        "chemical": self.chemical.id,
                        "title": "Valid PDF",
                        "sds_file": SimpleUploadedFile(
                            "sample.pdf",
                            b"%PDF-1.4\nSafeSheets test fixture",
                            content_type="application/pdf",
                        ),
                    },
                    format="multipart",
                )

                self.assertEqual(created.status_code, status.HTTP_201_CREATED)
                self.assertTrue(created.data["sds_file"])
                document_id = created.data["id"]
                self.client.force_authenticate(user=None)

                denied = self.client.get(
                    f"/api/sds-documents/{document_id}/file/"
                )

                self.assertEqual(denied.status_code, status.HTTP_403_FORBIDDEN)
                self.client.force_authenticate(user=self.user)
                allowed = self.client.get(
                    f"/api/sds-documents/{document_id}/file/"
                )
                self.assertEqual(allowed.status_code, status.HTTP_200_OK)
                self.assertEqual(allowed["Content-Type"], "application/pdf")

    def test_replacing_pdf_removes_the_previous_local_file(self):
        self.client.force_authenticate(user=self.user)
        with tempfile.TemporaryDirectory() as media_directory:
            with override_settings(MEDIA_ROOT=media_directory):
                document = SDSDocument.objects.create(
                    chemical=self.chemical,
                    title="Replace PDF",
                )
                document.sds_file.save(
                    "old.pdf",
                    ContentFile(b"%PDF-1.4\nold"),
                    save=True,
                )
                old_path = document.sds_file.path

                with self.captureOnCommitCallbacks(execute=True):
                    response = self.client.patch(
                        f"/api/sds-documents/{document.id}/",
                        {
                            "sds_file": SimpleUploadedFile(
                                "new.pdf",
                                b"%PDF-1.4\nnew",
                                content_type="application/pdf",
                            )
                        },
                        format="multipart",
                    )

                self.assertEqual(response.status_code, status.HTTP_200_OK)
                self.assertTrue(response.data["sds_file"])
                self.assertFalse(os.path.exists(old_path))

    def test_metadata_can_be_updated_without_creating_a_duplicate(self):
        self.client.force_authenticate(user=self.user)
        document = SDSDocument.objects.create(
            chemical=self.chemical,
            title="Before update",
        )

        response = self.client.patch(
            f"/api/sds-documents/{document.id}/",
            {"title": "After update", "file_reference": "REF-22"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["id"], document.id)
        self.assertEqual(response.data["title"], "After update")
        self.assertEqual(SDSDocument.objects.count(), 1)

    def test_multipart_upload_accepts_empty_optional_dates(self):
        self.client.force_authenticate(user=self.user)
        with tempfile.TemporaryDirectory() as media_directory:
            with override_settings(MEDIA_ROOT=media_directory):
                response = self.client.post(
                    "/api/sds-documents/",
                    {
                        "chemical": self.chemical.id,
                        "title": "No dates yet",
                        "revision_date": "",
                        "next_review_date": "",
                        "file_reference": "",
                        "sds_file": SimpleUploadedFile(
                            "no-dates.pdf",
                            b"%PDF-1.4\nfixture",
                            content_type="application/pdf",
                        ),
                    },
                    format="multipart",
                )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertIsNone(response.data["revision_date"])
        self.assertIsNone(response.data["next_review_date"])
        self.assertEqual(response.data["review_status"], "unknown")

    def test_empty_optional_dates_clear_existing_values(self):
        self.client.force_authenticate(user=self.user)
        document = SDSDocument.objects.create(
            chemical=self.chemical,
            title="Dated document",
            revision_date=date(2026, 1, 1),
            next_review_date=date(2026, 12, 1),
        )

        response = self.client.patch(
            f"/api/sds-documents/{document.id}/",
            {"revision_date": "", "next_review_date": ""},
            format="multipart",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIsNone(response.data["revision_date"])
        self.assertIsNone(response.data["next_review_date"])

    def test_anonymous_user_cannot_update_sds_metadata(self):
        document = SDSDocument.objects.create(
            chemical=self.chemical,
            title="Protected SDS",
        )
        response = APIClient().patch(
            f"/api/sds-documents/{document.id}/",
            {"title": "Changed"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        document.refresh_from_db()
        self.assertEqual(document.title, "Protected SDS")


class AuthenticationEndpointTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.username = "testuser"
        self.password = "Test-Password-482!"

        self.user = get_user_model().objects.create_user(
            username=self.username,
            password=self.password,
        )

    def test_login_with_valid_credentials(self):
        response = self.client.post(
            "/api/auth/login/",
            {
                "username": self.username,
                "password": self.password,
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["username"], self.username)

        session_response = self.client.get("/api/auth/session/")

        self.assertEqual(
            session_response.data,
            {
                "authenticated": True,
                "username": self.username,
            },
        )

    def test_login_with_invalid_credentials(self):
        response = self.client.post(
            "/api/auth/login/",
            {
                "username": self.username,
                "password": "wrong-password",
            },
            format="json",
        )

        self.assertEqual(
            response.status_code,
            status.HTTP_401_UNAUTHORIZED,
        )

    @override_settings(LOGIN_RATE_LIMIT="2/min")
    def test_login_attempts_are_rate_limited(self):
        cache.clear()
        self.addCleanup(cache.clear)
        for _ in range(2):
            response = self.client.post(
                "/api/auth/login/",
                {"username": self.username, "password": "wrong-password"},
                format="json",
            )
            self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

        limited = self.client.post(
            "/api/auth/login/",
            {"username": self.username, "password": "wrong-password"},
            format="json",
        )

        self.assertEqual(limited.status_code, status.HTTP_429_TOO_MANY_REQUESTS)

    def test_login_enforces_csrf_for_anonymous_requests(self):
        client = APIClient(enforce_csrf_checks=True)
        response = client.post(
            "/api/auth/login/",
            {"username": self.username, "password": self.password},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_session_for_anonymous_user(self):
        response = self.client.get("/api/auth/session/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(
            response.data,
            {"authenticated": False},
        )

    def test_logout_requires_authentication(self):
        response = self.client.post("/api/auth/logout/")

        self.assertEqual(
            response.status_code,
            status.HTTP_403_FORBIDDEN,
        )

    def test_logout_ends_authenticated_session(self):
        self.client.force_login(self.user)

        logout_response = self.client.post("/api/auth/logout/")

        self.assertEqual(
            logout_response.status_code,
            status.HTTP_200_OK,
        )

        session_response = self.client.get("/api/auth/session/")

        self.assertEqual(
            session_response.data,
            {"authenticated": False},
        )
