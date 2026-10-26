# SafeSheets Security Notes

## Current protections

- Django’s built-in authentication stores password hashes and issues a session cookie.
- Chemical and SDS API views require an authenticated user. Session-authenticated unsafe requests retain Django REST Framework’s CSRF checks.
- The login UI obtains a CSRF cookie before submitting credentials; create, update, delete, and logout requests send the CSRF token.
- SDS PDFs are not intentionally served through Django’s static media URL. The file endpoint requires authentication and streams the requested document.
- Server-side upload validation checks the `.pdf` extension, `%PDF-` header, and a maximum of 10 MiB.
- API serialization returns only a boolean for file availability; callers use the authenticated endpoint instead of receiving a local media path.
- The chemical delete policy requires confirmation in the UI and removes its linked SDS database records and uploaded files after the database transaction commits.
- Secret key, debug mode, allowed hosts, CORS origins, and CSRF origins are environment-configurable. Local env files, SQLite data, and media files are Git-ignored.

## Known limitations

- This app is currently a single shared workspace. All authenticated users can access and modify the same inventory. There are no tenant boundaries or role rules, so this is not appropriate for multiple customer organizations or confidential production data.
- PDF signature checking is a lightweight sanity check; it does not scan for malware or verify document authenticity. Production should add content scanning, private object storage, quotas, backup, retention, and operational monitoring.
- Local storage cleanup is scheduled after database commit. A storage error at that moment can leave an orphaned PDF; periodic orphan cleanup is not implemented.
- Default local settings are for local development. Before deployment set a private `DJANGO_SECRET_KEY`, `DJANGO_DEBUG=false`, restrictive `DJANGO_ALLOWED_HOSTS`, matching CORS/CSRF origins, HTTPS, secure cookies, `SECURE_SSL_REDIRECT=true`, a considered HSTS duration, and a production database/storage policy.
- No professional security audit has been performed.

## File deletion policy

Deleting a chemical intentionally cascades to its SDS metadata and stored PDF files. The confirmation message states that all associated records and files are permanently removed. This behavior is covered by backend tests. There is no recycle bin or recovery workflow; keep external backups for any data that matters.

## Security review before production

Define organization membership and roles, test cross-organization access denial, use HTTPS and secure cookie settings, configure rate limiting for login, review CORS and allowed hosts, add malware scanning and private object storage, define retention/backups, and review the deployment with a qualified security professional.
