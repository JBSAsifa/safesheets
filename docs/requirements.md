# SafeSheets — Product Requirements

## 1. Project Overview

SafeSheets is a portfolio web application for managing workplace chemical records and Safety Data Sheet (SDS) metadata.

The goal is to help workplace safety personnel organize chemical information, find relevant safety documents, and track document review dates.

This is an educational portfolio project, not a certified safety or regulatory compliance system.

## 2. Target Users

### Safety Manager

Maintains chemical records and checks whether safety documents need review.

### Workplace Employee

Searches for a chemical and accesses its available safety document information.

### Administrator

Manages user access and ensures that only authorized users can change records.

## 3. User Problems

- Chemical records may be difficult to find.
- Employees may not know whether a document needs review.
- Inconsistent or incomplete records can make information harder to manage.
- Unauthorized users should not be able to modify safety records.
- Users need clear feedback when a search or update fails.

## 4. MVP Scope

### Feature 1: Chemical Records

Users with appropriate permissions can create, view, update, and archive chemical records.

Each record includes:

- Chemical or product name
- Manufacturer
- Product identifier
- Hazard summary
- SDS document reference
- Review date
- Created and updated timestamps

### Feature 2: SDS Metadata

The application stores metadata and a reference to an SDS document.

For the initial version, document metadata may include:

- Document title
- Version or revision date, if known
- Review date
- File reference or URL
- Associated chemical record

The MVP does not claim that uploaded documents are authentic, complete, or regulator-approved.

### Feature 3: Search and Filtering

Users can search records by product name or manufacturer.

Users can filter records by review status.

Search results should communicate clearly when no matching records exist.

### Feature 4: Review-Date Tracking

The application identifies records whose review dates are approaching or have passed.

Review status is an organizational reminder only. It does not determine legal compliance.

### Feature 5: Authentication and Access Control

Users must sign in to access protected features.

- Employees can view permitted records.
- Safety managers can create and update chemical records.
- Administrators can manage authorized users.
- Unauthorized requests must be rejected by the backend.

Exact permissions will be defined during implementation.

## 5. Out of Scope for the MVP

- AI-generated safety advice
- Automated regulatory compliance certification
- Complex chemical risk calculations
- Multi-company subscription billing
- Mobile applications
- Advanced analytics
- Email notification services
- Automated extraction of information from SDS PDFs

These features may be considered in later versions.

## 6. User Stories and Acceptance Criteria

### Story 1: Find a Chemical

As an employee, I want to search for a chemical by name so that I can find its record.

Acceptance criteria:

- A matching search returns relevant records.
- A search with no matches displays an appropriate empty state.
- Search input is validated and handled safely.
- Users cannot retrieve records they are not authorized to view.

### Story 2: Create a Chemical Record

As a safety manager, I want to create a chemical record so that its information can be maintained centrally.

Acceptance criteria:

- Authorized users can submit valid records.
- Required fields are validated by the backend.
- Invalid submissions return useful error messages.
- Unauthorized users cannot create records.
- A successful creation returns the saved record.

### Story 3: Update a Record

As a safety manager, I want to update a chemical record when its information changes.

Acceptance criteria:

- Authorized users can edit permitted fields.
- Invalid values are rejected.
- Changes persist in the database.
- Unauthorized update attempts are rejected.

### Story 4: Identify Records Needing Review

As a safety manager, I want to identify records with approaching or overdue review dates.

Acceptance criteria:

- Review status is calculated consistently using a defined date rule.
- Overdue records are clearly identified.
- Missing review dates are identified as unknown rather than assumed current.
- Date calculations use a documented timezone policy.

### Story 5: Protect User Access

As an administrator, I want role-based permissions so that users can perform only authorized actions.

Acceptance criteria:

- Protected endpoints require authentication.
- Backend permissions are enforced independently of the user interface.
- Unauthorized requests do not modify data.
- Secrets and credentials are not stored in source control.

## 7. Non-Functional Requirements

### Security

- Validate input on the server.
- Use established authentication mechanisms.
- Enforce permissions on every protected endpoint.
- Keep credentials in environment variables or an appropriate secrets manager.
- Avoid exposing sensitive information in error messages or logs.

### Reliability

- Return clear errors for invalid requests.
- Handle missing records without crashing.
- Persist successful changes.
- Test critical business rules.

### Usability

- Provide clear loading, success, empty, and error states.
- Use consistent forms and navigation.
- Make review status easy to understand.

### Maintainability

- Keep frontend and backend responsibilities separate.
- Use readable code and consistent naming.
- Document setup instructions and important decisions.
- Add automated tests for critical behavior.

## 8. Edge Cases

- Duplicate product identifiers
- Missing manufacturer information
- Empty or whitespace-only names
- Invalid review dates
- Missing SDS references
- Searches with no matches
- Requests for nonexistent records
- Expired or invalid authentication
- Unauthorized record creation or modification
- Database or API failures
- Documents with broken or inaccessible links
- Timezone differences around review dates

The project must define explicit behavior for these cases during implementation.

## 9. Success Criteria

The MVP is ready for portfolio demonstration when:

- Users can search and view permitted chemical records.
- Authorized users can create and update records.
- Review status is calculated correctly.
- Authentication and backend permissions are tested.
- Important success and failure cases have automated tests.
- The application can be run using documented setup instructions.
- The README explains the architecture, features, testing, and limitations.
- The application is deployed only after the relevant security and functionality checks pass.

## 10. Assumptions

- The first version is maintained by one developer.
- The initial dataset is small and intended for demonstration.
- Real confidential workplace or chemical safety data will not be used.
- The application is a portfolio project and is not certified for workplace compliance.
- Document storage and deployment details will be finalized during architecture planning.
