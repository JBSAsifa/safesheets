# SafeSheets Product Requirements

## Purpose and scope

SafeSheets is a single-workspace portfolio application for organizing chemical inventory records and their Safety Data Sheet (SDS) metadata and PDFs. It helps staff find a record and see whether its next review date is missing, approaching, or past. It is an organizational reminder, not a regulatory compliance tool or a source of safety advice.

The current project is a local-development MVP maintained by one developer. The repository currently uses Django REST Framework, Next.js/React/TypeScript, SQLite, Django session authentication, and local media storage. These requirements describe product behavior; implementation status is called out separately below.

## Users and needs

| User | Need | MVP access |
|---|---|---|
| Safety coordinator | Maintain chemical records and keep SDS files and review dates findable | Signed-in user can currently create, update, and delete records |
| Workplace employee | Find a chemical, its storage location, and related SDS information | The current API requires sign-in; all signed-in users share the same workspace data |
| Local administrator/developer | Create accounts and operate the demo | Uses Django’s built-in user/admin facilities; self-service account creation is not in scope |

**Access assumption:** the current data model has no organization or per-record ownership boundary. Authentication protects the API, but any authenticated account can currently see and modify the same records. Do not use this build for multiple customers or confidential production inventory until tenant isolation and role permissions are designed and tested.

## User problems

- Chemical details and storage locations are hard to find when records are scattered.
- Staff cannot quickly tell which SDS documents are missing a review date or need attention.
- A file reference alone may not make a document accessible at the point of need.
- Users need clear feedback when a save, upload, search, or file open fails.
- Chemical and document records should be protected from anonymous access.

## MVP capabilities

1. **Sign in and session access:** sign in, check the current session, and sign out using Django sessions and CSRF protection.
2. **Chemical inventory:** list, search by name/manufacturer/location, create, inspect details, and update a chemical. Editing must update the selected record using its ID.
3. **SDS metadata and PDF:** attach a titled SDS record to an existing chemical, record optional revision and next review dates, upload a PDF up to 10 MiB, and open it through an authenticated endpoint.
4. **Review tracking:** show `unknown` when the next review date is absent, `overdue` before today, `due_soon` from today through 30 days ahead inclusive, and `current` after that. Django’s configured local date is authoritative.
5. **Inventory status filter and dashboard counts:** filter chemicals based on associated SDS status and summarize actual loaded records.
6. **Feedback:** show loading, empty, error, and saving states; prevent repeated form submission while a save is pending.

### Not in MVP

SDS deletion, role-based write restrictions, multi-company tenancy, notifications, bulk import/export, OCR or AI safety interpretation, compliance certification, and production object storage are future work.

**Chemical deletion policy:** after explicit confirmation, permanently delete the chemical, associated SDS metadata, and stored SDS PDF files. This is the local MVP’s deliberate cascade behavior. There is no restore workflow.

## User stories and measurable acceptance criteria

### Find inventory

As an employee, I want to search chemicals by name, manufacturer, or storage location and narrow results by SDS status.

- The search matches each of those three fields without case sensitivity.
- The status selector includes all, overdue, due soon, current, and unknown.
- An empty result set explains that no records match; loading and API failure are distinct states.
- A chemical row shows its associated SDS count and a readable status label.

### Create and update a chemical

As a safety coordinator, I want to add a chemical and correct its details later.

- A blank/whitespace-only name is rejected by both client and server; valid names are limited to 200 characters.
- Create submits once and refreshes the list after a successful response.
- Edit prefills the selected record’s current values and sends `PATCH /api/chemicals/{id}/`.
- After update, the selected record retains its original ID and changed values appear without a page reload.
- Cancel closes the form without sending a request and discards unsaved edits.
- While a request is pending, the submit control is disabled. API validation or expired-session errors are visible.

### Add and open an SDS

As a safety coordinator, I want to associate a PDF and its review dates with a chemical.

- An SDS requires an existing chemical and non-empty title; date values must parse as dates.
- The server accepts only a `.pdf` upload with a PDF signature and size no greater than 10 MiB.
- Invalid or oversized uploads return a field-level API error and create no usable document.
- Signed-in users can open an attached PDF through the API; anonymous users cannot.
- Missing attachments and missing stored files return a not-found response without exposing a filesystem path.

### Understand review timing

As a safety coordinator, I want review labels to match the date rule.

- With a fixed local date `D`, absent date => unknown; `D - 1 day` => overdue; `D` and `D + 30 days` => due soon; `D + 31 days` => current.
- The API supplies the status used by the frontend; the frontend does not independently recompute it.
- Text accompanies status colors. No label is represented as a compliance determination.

### Protect records

As a user, I want the API to require an authenticated session for inventory and document operations.

- Anonymous requests to list, create, retrieve, update, delete, or open files are rejected.
- State-changing browser requests use CSRF protection.
- User input and uploaded files are validated server-side.
- No secret value, private database, or uploaded document is committed to source control.

## Important edge cases

- Empty inventory, no search matches, chemical with no SDS, and SDS with no review date.
- Whitespace names, maximum-length strings, malformed dates, invalid chemical IDs, and nonexistent records.
- Review dates exactly today, at the 30-day edge, and one day beyond it.
- Expired session, CSRF rejection, backend unavailable, failed refresh after a successful mutation.
- Wrong extension, non-PDF content named `.pdf`, zero-byte file, file over 10 MiB, missing stored file, and popup blocked by the browser.
- Multiple authenticated users currently share data; this behavior must be disclosed until isolation is implemented.
- Chemical deletion requires confirmation and removes the chemical, linked SDS metadata, and stored files under the documented cascade policy.

## Quality and security requirements

- Backend permissions are the security boundary; hiding a button does not grant or deny API access.
- Preserve Django session authentication and CSRF checks. Do not make record or file endpoints public to simplify browser access.
- Apply serializer/model validation and return useful 4xx responses for bad input and missing records.
- Keep secrets in environment configuration; never commit `.env`, credentials, local database data, or uploaded PDFs.
- In production, configure secure cookies, HTTPS, allowed hosts, CORS/CSRF origins, secret management, backups, and managed file storage before use.
- Use keyboard-operable controls, explicit form labels, visible focus, responsive layouts, and text labels in status badges.
- Keep review logic on the server and cover boundary dates with automated tests.
- Do not claim the application verifies SDS authenticity, completeness, hazards, or regulatory compliance.

## Current status (repository audit)

The existing working tree includes user changes for session login/logout, authenticated inventory APIs, PDF upload/view, review status, tests, and a dashboard. This improvement pass adds chemical editing and confirmed cascade deletion, SDS metadata editing, a configurable API origin, and security/testing documentation. Role policy and tenant isolation remain future work.

The requirements are a target contract, not a claim that all listed behavior has passed verification. See the repository README for commands actually run and known limitations.
