# SafeSheets

SafeSheets is a portfolio project for keeping workplace chemical inventory details and associated Safety Data Sheet (SDS) documents together. Users can search chemicals, see their storage location, upload a PDF, and track whether its next review date is unknown, due soon, overdue, or current.

SafeSheets is an educational record-management demo. It does not validate SDS correctness or provide safety advice, and it is not a regulatory compliance system.

## Features in this working tree

- Django session login, session check, and logout with CSRF-protected writes
- Chemical inventory with search, status filtering, details, and add/edit forms
- Confirmed chemical deletion that also removes linked SDS records and local files
- SDS metadata linked to a chemical, PDF upload, and authenticated PDF viewing
- SDS metadata editing and optional PDF replacement
- Server-calculated review status and dashboard counts
- A live list of chemicals without an SDS record
- PDF extension, signature, and 10 MiB size validation

See [requirements](docs/requirements.md), [architecture](docs/architecture.md), [security notes](docs/security.md), and [testing guide](docs/testing.md) for scope, setup, and limitations.

## Technology

- Frontend: Next.js 16.4.0, React 19.3.0, TypeScript 5, Tailwind CSS 4 with existing project CSS
- Backend: Python, Django, Django REST Framework
- Local database: SQLite
- Authentication: Django sessions and CSRF protection
- Local document storage: Django media directory
- Tests/checks: Django test tools, ESLint, TypeScript compiler

## Architecture overview

The browser displays the Next.js interface and sends requests to the configured Django API origin (default `http://localhost:8001/api`). Django validates input, checks the signed-in session, applies review status rules, and reads/writes SQLite. SDS files are delivered through a signed-in API endpoint rather than a public media URL.

## Local setup

Prerequisites: Python 3.11 and Node.js/npm compatible with the versions in `frontend/package.json`.

1. If `.venv` does not exist, create it and install the backend dependencies:

   ```sh
   python3 -m venv .venv
   source .venv/bin/activate
   pip install -r backend/requirements.txt
   ```

   For an existing `.venv`, activate it:

   ```sh
   source .venv/bin/activate
   ```

2. Set a stable development-only Django key in your shell. Use your own random value and do not commit or share it:

   ```sh
   export DJANGO_SECRET_KEY='replace-with-a-stable-local-only-secret'
   ```

   `backend/.env.example` lists the supported backend variables, but Django settings do not automatically load that file. Export any overrides in your shell. Do not use a development key in production.

3. Apply any migrations that have not yet been applied, then optionally create a local login user:

   ```sh
   python backend/manage.py migrate
   python backend/manage.py createsuperuser
   ```

   `migrate` applies schema changes and preserves existing rows; never delete the local database to resolve migration issues.

4. Start the API from the repository root:

   ```sh
   python backend/manage.py runserver 8001
   ```

5. In a second terminal, install frontend dependencies on a fresh checkout and start Next.js:

   ```sh
   cd frontend
   npm ci
   npm run dev
   ```

6. Visit `http://localhost:3000/login`. The existing SQLite database and media files are local data; do not delete/reset them to set up the demo.

## Environment configuration

| Variable | Required | Purpose |
|---|---:|---|
| `DJANGO_SECRET_KEY` | Yes | Stable Django signing key; keep it private |
| `DJANGO_DEBUG` | No | Defaults to `true` for local use; set `false` in production |
| `DJANGO_TIME_ZONE` | No | Time zone used for review-date boundaries; defaults to `UTC` (for example, `Asia/Dhaka`) |
| `DJANGO_ALLOWED_HOSTS` | No | Comma-separated hostnames; local defaults are `localhost,127.0.0.1` |
| `CORS_ALLOWED_ORIGINS` | No | Comma-separated browser origins |
| `CSRF_TRUSTED_ORIGINS` | No | Comma-separated origins trusted for CSRF |
| `LOGIN_RATE_LIMIT` | No | Anonymous login request limit; defaults to `10/hour` |
| `NEXT_PUBLIC_API_URL` | No | Browser API base URL; defaults to `http://localhost:8001/api` |
| `SECURE_SSL_REDIRECT` | No | Defaults to enabled when `DJANGO_DEBUG=false`; use HTTPS in production |
| `SECURE_HSTS_SECONDS` | No | Defaults to `0`; set only after validating HTTPS and domain policy |

The frontend API origin is read from `NEXT_PUBLIC_API_URL` (default `http://localhost:8001/api`). Copy `frontend/.env.example` to `frontend/.env.local` to override it. Next.js includes this public value in the browser bundle at build time. Production also needs HTTPS, secure session cookies, correct allowed hosts and CORS/CSRF origins, and a managed secret.

## Tests and checks

Run from the project root with a development/test key available:

```sh
python backend/manage.py check
python backend/manage.py test safety_api
pytest
```

Run frontend checks:

```sh
cd frontend
npm run lint
npx tsc --noEmit
npm run format:check
npm run build
```

The project currently has Django API tests. No frontend unit or browser automation test framework is included. See [testing.md](docs/testing.md) for coverage and a manual walkthrough.

## API overview

All API routes are under `/api/`. Key routes:

- `POST /auth/login/`, `GET /auth/session/`, `POST /auth/logout/`
- `GET, POST /chemicals/`, `GET, PATCH, DELETE /chemicals/{id}/`
- `GET, POST /sds-documents/` and `GET, PATCH /sds-documents/{id}/` (optional `review_status` filter)
- `GET /sds-documents/{id}/file/`

Inventory and file routes require a signed-in session. Obtain the CSRF cookie from `GET /csrf-token/` before browser writes. The complete route and access table is in [architecture.md](docs/architecture.md).

## Known limitations

- All authenticated users currently share one dataset; no roles or organization-level isolation are implemented.
- Local SQLite and local file storage are for a single-developer demo, not production scale or resilience.
- Chemical deletion requires confirmation, permanently removes linked SDS records, and attempts to delete their PDFs. There is no restore workflow; a storage failure can leave an orphan file.
- SDS deletion, notifications, pagination, API-level chemical search, production deployment configuration, and frontend automated tests are not included.
- Review status is an organizational date reminder only.

## Screenshots

No screenshots are included yet. Add screenshots here after a verified local walkthrough.

<!-- Screenshot placeholder: add a real dashboard screenshot after a verified walkthrough. -->

## Troubleshooting

- **Django refuses to start:** set `DJANGO_SECRET_KEY` in the same terminal before starting the backend. The example file documents variables; Django does not load it automatically.
- **The dashboard says the API is unavailable:** start Django on port `8001` and confirm `NEXT_PUBLIC_API_URL` points to `http://localhost:8001/api`.
- **Login or writes fail with a CSRF message:** use the same hostname consistently (`localhost` or `127.0.0.1`) in the browser and API URL. Confirm that hostname’s frontend origin is listed in the backend CORS and CSRF trusted origins.
- **A PDF is rejected:** upload a `.pdf` file no larger than 10 MiB. The server checks its extension and PDF header; this does not certify the document as safe or authentic.
- **An older database has unapplied schema changes:** run `python backend/manage.py migrate`. This applies migrations while preserving existing records; never delete the SQLite file as a workaround.

## Portfolio status

This README describes the local application; it does not claim production deployment or a professional security review. The docs describe known implementation gaps and verification commands. No deployment is configured.
