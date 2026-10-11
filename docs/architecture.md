# SafeSheets — System Architecture

## 1. Architecture Overview

SafeSheets uses a frontend, backend, and database architecture.

- Frontend: Next.js and React
- Backend: Python and Django REST Framework
- Database: PostgreSQL
- Testing: pytest and Django testing tools
- Version control: Git and GitHub

The frontend presents information to users. The backend validates requests, enforces permissions, and implements business rules. The database stores application records.

## 2. How the System Works

Example: A safety manager creates a chemical record.

1. The user completes a form in the frontend.
2. The frontend sends the information to a backend API.
3. The backend checks authentication, permissions, and field validation.
4. The backend saves valid data in PostgreSQL.
5. The backend returns a response.
6. The frontend displays the saved record or an appropriate error.

The frontend must not be treated as the security boundary. The backend must enforce permissions even if someone bypasses the user interface.

## 3. Main Components

### Frontend

Technology: Next.js with React.

Responsibilities:

- Display the dashboard and chemical records.
- Provide search, filters, and forms.
- Display loading, success, empty, and error states.
- Send requests to the backend API.
- Present information according to the signed-in user's permissions.

The frontend must not contain database credentials or other server secrets.

### Backend

Technology: Python with Django REST Framework.

Responsibilities:

- Authenticate users.
- Enforce role-based access control.
- Validate and process API requests.
- Apply chemical record and review-date business rules.
- Read and update records in the database.
- Return consistent responses and error messages.

### Database

Technology: PostgreSQL.

Responsibilities:

- Store user and role information.
- Store chemical records and SDS metadata.
- Maintain relationships between records.
- Enforce appropriate database constraints.

## 4. Proposed Data Models

### User

Fields:

- id: unique identifier
- username or email: login identity
- password: managed securely through Django authentication
- role: employee, safety_manager, or administrator
- is_active: whether the account is enabled

Use Django's established authentication system rather than implementing password storage from scratch.

### Chemical

Fields:

- id: unique identifier
- name: required chemical or product name
- manufacturer: manufacturer name, if known
- product_identifier: product code, if known
- hazard_summary: concise informational summary
- created_at: creation timestamp
- updated_at: last update timestamp
- archived_at: optional archive timestamp

Product identifiers may require a uniqueness rule appropriate to the manufacturer and available data.

### SDSDocument

Fields:

- id: unique identifier
- chemical: relationship to a Chemical record
- title: document title
- revision_date: optional date printed on the document
- review_date: optional organizational review date
- document_reference: controlled file reference or URL
- created_at: creation timestamp

A missing revision date must not be treated as proof that a document is current.

For the MVP, document references may be stored without implementing file uploads. Actual file storage and access controls can be designed separately.

## 5. Proposed API Endpoints

Base path: /api/

### Authentication

- POST /api/auth/login/
- POST /api/auth/logout/
- GET /api/auth/me/

The final authentication mechanism will be selected before implementation.

### Chemicals

- GET /api/chemicals/
  - List permitted records.
  - Support search and review-status filters.

- POST /api/chemicals/
  - Create a chemical record.
  - Requires an authorized role.

- GET /api/chemicals/{id}/
  - Retrieve a permitted record.

- PATCH /api/chemicals/{id}/
  - Update permitted fields.
  - Requires an authorized role.

- POST /api/chemicals/{id}/archive/
  - Archive a record.
  - Requires an authorized role.

### SDS Documents

- GET /api/sds-documents/
  - List permitted document metadata.

- POST /api/sds-documents/
  - Add document metadata for a chemical.
  - Requires an authorized role.

- PATCH /api/sds-documents/{id}/
  - Update document metadata.
  - Requires an authorized role.

These are proposed endpoints. Their request formats, response schemas, filtering behavior, and permission rules must be defined during implementation.

## 6. Review-Date Rules

The application will calculate review status using the current date and the configured review policy.

Proposed statuses:

- Overdue: the review date has passed.
- Due soon: the review date falls within a configured warning period.
- Current: the review date is beyond that period.
- Unknown: no review date has been recorded.

The warning period and timezone policy must be explicitly defined before implementation.

Review status is an organizational tracking aid, not a legal compliance determination.

## 7. Security Design

- Require authentication for protected operations.
- Enforce permissions on the backend.
- Validate request data on the server.
- Use Django's password and authentication facilities.
- Keep credentials outside source control.
- Use HTTPS in production.
- Avoid exposing stack traces or secrets in API responses.
- Configure allowed hosts, CORS, and CSRF protection appropriately for deployment.
- Apply safe file-storage practices if uploads are introduced.
- Test both authorized and unauthorized access.

The MVP must not be presented as production-secure until the implementation has been reviewed and tested.

## 8. Testing Strategy

### Backend Unit Tests

Test:

- Required field validation.
- Chemical record creation and updates.
- Review-status calculations.
- Duplicate identifier handling.
- Missing and invalid dates.

### API Tests

Test:

- Successful authorized requests.
- Invalid request payloads.
- Missing authentication.
- Insufficient permissions.
- Requests for nonexistent records.
- Search and filter behavior.

### Frontend Tests

Test:

- Form validation and error display.
- Search and filtering.
- Loading and empty states.
- API failure handling.
- Important user workflows.

### Integration Tests

Verify that the frontend, backend, and database work together as intended.

Tests must be executed and their results recorded before claiming success.

## 9. Development Phases

### Phase 1: Requirements and Design

- Review requirements.
- Confirm acceptance criteria.
- Finalize the architecture and data model.

### Phase 2: Backend Foundation

- Configure Django and PostgreSQL.
- Define models and migrations.
- Implement validation and API endpoints.
- Add backend tests.

### Phase 3: Frontend Foundation

- Configure Next.js.
- Build the dashboard and forms.
- Connect the frontend to the backend.
- Handle loading, success, and failure states.

### Phase 4: Authentication and Permissions

- Configure authentication.
- Enforce role-based access control.
- Test unauthorized requests.

### Phase 5: End-to-End Validation

- Run automated tests.
- Test important user workflows.
- Fix discovered defects and rerun regression tests.

### Phase 6: Documentation and Deployment

- Complete setup instructions.
- Record actual test results and known limitations.
- Configure deployment and environment variables.
- Deploy only after the relevant checks pass.

## 10. Assumptions and Open Questions

- The MVP is developed by one person.
- The initial dataset is small and for demonstration.
- The application is not a certified compliance product.
- The authentication mechanism remains to be finalized.
- The document storage approach remains to be finalized.
- The review warning period remains to be finalized.
- Production hosting and database services remain to be selected.
- Multi-organization data isolation is not yet specified and must be addressed before supporting multiple customers.

## 11. Architecture Decision Principles

- Prefer simple, understandable solutions.
- Use established framework capabilities instead of reinventing security-sensitive features.
- Keep business rules in the backend.
- Test critical behavior and permissions.
- Record significant trade-offs and assumptions.
- Use AI-generated code only after appropriate validation.
