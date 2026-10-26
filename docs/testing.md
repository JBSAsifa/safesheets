# SafeSheets Testing Guide

## Backend

Use the repository virtual environment and a disposable test-only secret value:

```sh
export DJANGO_SECRET_KEY='local-test-key'
python backend/manage.py check
python backend/manage.py test safety_api
pytest
```

Django creates a temporary test database and removes it after the run. Tests cover authentication, chemical create/update/delete behavior, cascade file cleanup, SDS upload signature and size validation, authenticated file access, metadata updates, and review-date boundaries.

## Frontend

Run from `frontend/`:

```sh
npm run lint
npx tsc --noEmit
npm run format:check
npm run build
```

The repository does not currently include a frontend unit-test or browser automation framework. The checks above validate lint rules, TypeScript types, and formatting; they do not simulate a user’s browser workflow.

## Manual demonstration checklist

1. Sign in, refresh the page, and confirm the dashboard remains authenticated; log out and confirm the login page appears.
2. Create a chemical. Search by name, manufacturer, and storage location.
3. Open its details, edit it, cancel once, then save a change. Confirm the list reflects the update and the record count does not increase.
4. Add an SDS using a valid PDF; try a renamed non-PDF and a file larger than 10 MiB to confirm server validation.
5. Open the SDS PDF while signed in. Confirm the private file endpoint rejects an anonymous request.
6. Edit SDS title/revision/review date; confirm the status and dashboard counts refresh.
7. Confirm each review boundary: missing, yesterday, today, 30 days ahead, and 31 days ahead.
8. Check the chemicals-without-SDS section and Add SDS shortcut.
9. Delete a test chemical through the confirmation dialog. Confirm the app explains that its SDS records and PDFs will also be deleted.

Manual browser steps should only be reported as verified after actually completing them.
