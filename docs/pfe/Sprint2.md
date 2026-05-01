# Introduction
Sprint 2 focuses on psychologist onboarding as a controlled, auditable process. The scope covers profile creation, credential upload, AI-assisted verification, and an admin approval workflow that determines whether a psychologist can be activated on the platform.

This document presents objectives, planning, backlog, execution approach, analysis, UML-oriented design descriptions, testing, deployment, and the sprint review/retrospective elements in a format suitable for a project report (PFE).

# Sprint2Objective
The objective of Sprint 2 is to implement an end-to-end onboarding pipeline for psychologists that:

- Collects complete professional profile data.
- Supports secure upload of credential documents (license, degree, ID, etc.).
- Performs AI-assisted verification to pre-screen authenticity and completeness.
- Provides an admin review and approval/rejection flow with traceability.
- Enables only approved psychologists to become “Active” and visible/assignable in the system.

Success criteria:
- A psychologist can complete onboarding without admin intervention until the final approval step.
- Admins can review, decide, and record reasons for decisions.
- The system maintains a clear state machine for onboarding status and a full audit trail.

# SprintPlanning2
Sprint planning assumptions:
- Sprint duration: 2 weeks (adjustable to the project calendar).
- Team roles: Product Owner, Backend Developer(s), Frontend Developer(s), QA, Admin representative.
- Constraints: privacy requirements for document storage and strict role-based access control (RBAC).

Planned deliverables:
- Onboarding UI for profile creation and credential upload.
- Backend APIs for onboarding, document management, and status transitions.
- AI verification service integration (synchronous or asynchronous job-based).
- Admin review dashboard and decision endpoints.
- Automated tests and a deployment path for continuous review.

# SprintBacklog2
## User Stories (Onboarding Flow)
1. **US-2.1: Profile Creation**
   - As a psychologist, I want to create my professional profile so that the platform has my identity and practice details.
   - Acceptance criteria:
     - Required fields are validated (e.g., full name, email/phone, country, specialization, experience).
     - Profile can be saved as a draft before submission.

2. **US-2.2: Credential Upload**
   - As a psychologist, I want to upload credential documents so that my professional status can be verified.
   - Acceptance criteria:
     - Supported file formats and size limits are enforced.
     - Each document type is labeled (e.g., license, degree, ID).
     - Upload progress and successful storage confirmation are shown.

3. **US-2.3: Submit for Verification**
   - As a psychologist, I want to submit my profile and credentials for verification so that my onboarding can be reviewed and approved.
   - Acceptance criteria:
     - Submission is blocked if required fields or documents are missing.
     - The system assigns an onboarding status and a submission timestamp.

4. **US-2.4: View Onboarding Status**
   - As a psychologist, I want to view the status of my onboarding so that I understand what is pending and what actions I must take.
   - Acceptance criteria:
     - Status values are displayed clearly (e.g., Draft, Submitted, AI Flagged, Pending Admin Review, Approved, Rejected).
     - If rejected, the rejection reason is visible.

## User Stories (AI Verification and Admin Workflow)
5. **US-2.5: AI Pre-Screen Verification**
   - As the platform, I want to automatically pre-screen uploaded credentials so that obvious fraud or incompleteness is flagged before admin review.
   - Acceptance criteria:
     - AI verification produces a structured result (risk score, extracted fields, flags).
     - Results are attached to the onboarding record and are auditable.

6. **US-2.6: Admin Review Queue**
   - As an admin, I want to see onboarding submissions in a queue so that I can review them efficiently.
   - Acceptance criteria:
     - Queue supports filtering by status and date.
     - Admin can open a submission and view profile + documents + AI results.

7. **US-2.7: Admin Approve / Reject**
   - As an admin, I want to approve or reject onboarding submissions so that only verified psychologists become active.
   - Acceptance criteria:
     - Approve transitions status to Approved (and activates the account).
     - Reject transitions status to Rejected and requires a rejection reason.
     - All decisions are logged with admin identity and timestamp.

## Sprint Tasks (Engineering)
- Define onboarding status model and transition rules.
- Implement document storage strategy (secure bucket, encrypted at rest, signed URLs).
- Implement AI verification integration (job creation, polling/webhook, persistence).
- Build admin dashboard and moderation endpoints.
- Add unit + integration tests for critical paths.

# SprintExecution
Execution approach:
- **Incremental delivery:** start with profile + upload, then submission/status, then AI verification, then admin approval UI.
- **Risk-driven development:** prioritize security/RBAC, storage, and audit logging early.
- **Definition of Done (DoD):**
  - Feature complete per acceptance criteria.
  - Code reviewed and tested.
  - Logs and error handling included for failure states.
  - Deployed to a review environment for stakeholder validation.

# Analysis
This section decomposes the sprint requirements into functional and non-functional needs, highlights key integration points, and sets the basis for the design artifacts.

## UserStoryDeconstructionandRequirementsElicitation
### Functional Requirements
**Profile management**
- Create/edit profile fields (personal identification, contact, specialization, professional experience).
- Draft save and final submission.

**Credential document handling**
- Upload multiple documents with type metadata.
- Validate file types, sizes, and completeness.
- Retrieve documents for admin review with strict access control.

**AI verification**
- Run automated checks after submission (or after each upload, depending on design).
- Store AI outputs (risk score, extracted fields, mismatch indicators).
- Surface AI warnings to admins, not as final decisions.

**Admin approval**
- Admin queue of pending submissions.
- View: profile + documents + AI results + submission history.
- Decision: approve/reject with mandatory reason for rejection.
- State transition and notifications (e.g., email/in-app).

### Non-Functional Requirements
- **Security:** RBAC, least privilege access, signed URLs for downloads, secure secret management.
- **Privacy:** document encryption at rest and in transit, retention policy, restricted admin access.
- **Auditability:** immutable logs for submission, AI verification results, admin decisions.
- **Reliability:** retryable AI calls, idempotent submission endpoints, clear error messages.
- **Performance:** responsive uploads; async AI verification for large files.
- **Compliance readiness:** ability to produce verification history if required.

### Data Requirements (High-Level)
- Psychologist profile entity (identity and professional fields).
- Document entity (type, storage key, checksum/hash, upload timestamp, owner).
- Onboarding record (status, timestamps, AI summary, admin decision metadata).
- Audit log entity (actor, action, payload snapshot, time).

## TechnologyStackandIntegrationHighlights
The onboarding flow typically requires coordinated frontend, backend, storage, and AI services.

Key integration highlights:
- **Frontend ↔ Backend:** REST/GraphQL endpoints for profile CRUD, upload initiation, submission, status queries, and admin decisions.
- **Backend ↔ Storage:** secure object storage (e.g., S3-compatible) with pre-signed upload/download URLs and server-side encryption.
- **Backend ↔ AI Service:** document analysis pipeline (OCR + classification + entity extraction) to provide risk scoring and flags.
- **Async processing:** queue/worker or background jobs for AI verification to avoid blocking user requests.
- **Authentication/RBAC:** psychologist role for onboarding actions; admin role for review and decisions.

## AnalysisConclusion
Sprint 2 requires a controlled state-based onboarding pipeline that balances automation (AI pre-screening) with human oversight (admin approval). The analysis motivates a design centered on:

- A clear onboarding state machine.
- Secure, auditable document handling.
- AI verification as advisory evidence, not an automatic gate without review.
- Admin decision-making with traceable accountability.

# Design (UML diagrams)
This section provides textual descriptions of UML diagrams to support documentation where graphical diagrams are not embedded.

## OverallUseCaseDiagramforSprint2
Actors:
- **Psychologist**
- **Admin**
- **AI Verification Service (external system)**

Main use cases:
- Psychologist:
  - Create/Edit Profile
  - Upload Credentials
  - Submit for Verification
  - View Onboarding Status
- Admin:
  - View Review Queue
  - View Submission Details
  - Approve Onboarding
  - Reject Onboarding
- AI Verification Service:
  - Verify Credentials (triggered by backend)
  - Return Verification Result (callback/polling)

Relationships (textual):
- “Submit for Verification” includes “Validate Completeness”.
- “Approve/Reject Onboarding” extends “View Submission Details”.
- “Verify Credentials” is invoked after “Submit for Verification”.

## DetailedUseCaseSpecifications
### Use Case: Create/Edit Profile
- **Primary actor:** Psychologist
- **Preconditions:** Psychologist account exists and is authenticated
- **Main flow:**
  1. Psychologist opens onboarding profile form.
  2. Enters required details and optional fields.
  3. Saves as Draft or continues editing.
  4. System validates fields and persists the profile.
- **Alternate flows:**
  - Validation errors: system highlights missing/invalid fields and blocks save/submit.
- **Postconditions:** Profile stored with last-updated timestamp.

### Use Case: Upload Credentials
- **Primary actor:** Psychologist
- **Preconditions:** Authenticated; profile exists (at least draft)
- **Main flow:**
  1. Psychologist selects document type (license/degree/ID/etc.).
  2. System provides an upload mechanism (direct upload or pre-signed URL).
  3. File is uploaded and stored securely.
  4. System records document metadata and links it to onboarding.
- **Alternate flows:**
  - Unsupported format/size: upload is rejected with an error message.
  - Network failure: user can retry without duplicating document records (idempotency).
- **Postconditions:** Credential record is created and visible in onboarding checklist.

### Use Case: Submit for Verification
- **Primary actor:** Psychologist
- **Preconditions:** Required profile fields completed; required documents uploaded
- **Main flow:**
  1. Psychologist clicks “Submit”.
  2. System runs completeness validation.
  3. System sets onboarding status to Submitted and locks critical fields (optional policy).
  4. System triggers AI verification job and stores a job reference.
  5. System shows updated status to the psychologist.
- **Alternate flows:**
  - Missing requirements: system blocks submission and lists missing items.
  - Duplicate submission: system returns existing status without creating duplicates.
- **Postconditions:** Onboarding is in Submitted (or Pending AI) state and queued for verification.

### Use Case: AI Credential Verification
- **Primary actor:** AI Verification Service (external), initiated by backend
- **Preconditions:** Submission exists with stored documents
- **Main flow:**
  1. Backend prepares inputs (document URLs or binaries, minimal profile fields).
  2. AI service performs OCR and document classification.
  3. AI service extracts key entities (name, license number, issuing body, dates).
  4. AI service compares extracted entities to profile data (consistency checks).
  5. AI service computes a risk score and flags (e.g., mismatch, tampering suspicion).
  6. Result is returned (webhook) or fetched (polling) and persisted.
  7. System transitions onboarding to Pending Admin Review, possibly with AI Flagged marker.
- **Alternate flows:**
  - AI unavailable: job is retried and status indicates “Verification Delayed”.
  - Low confidence OCR: system flags “Manual Review Required”.
- **Postconditions:** AI result is stored and visible to admins; audit log records verification event.

### Use Case: Admin Approve / Reject
- **Primary actor:** Admin
- **Preconditions:** Onboarding is Pending Admin Review; admin is authenticated with privileges
- **Main flow:**
  1. Admin opens the review queue and selects a submission.
  2. Admin reviews profile data, documents, and AI verification summary.
  3. Admin chooses Approve or Reject.
  4. System records the decision, reason (mandatory for rejection), timestamp, and admin ID.
  5. System updates onboarding status and triggers notification to psychologist.
- **Alternate flows:**
  - Missing document view permissions: system denies access and logs the attempt.
  - Approve blocked: if policy requires certain AI checks, system enforces constraints.
- **Postconditions:**
  - Approved: psychologist account becomes Active.
  - Rejected: psychologist sees rejection reason and may be allowed to resubmit.

## ClassDiagram
Classes (textual) and responsibilities:
- **Psychologist**
  - Attributes: id, name, email, phone, role, isActive
  - Responsibilities: owns profile and onboarding record

- **PsychologistProfile**
  - Attributes: psychologistId, specialization, yearsExperience, country, bio, languages
  - Responsibilities: stores professional profile details

- **CredentialDocument**
  - Attributes: id, psychologistId, type, storageKey, mimeType, size, checksum, uploadedAt
  - Responsibilities: represents an uploaded credential and its storage reference

- **OnboardingApplication**
  - Attributes: id, psychologistId, status, submittedAt, lastStatusAt, aiVerificationId, adminDecisionId
  - Responsibilities: central state machine for onboarding

- **AIVerificationResult**
  - Attributes: id, onboardingId, riskScore, extractedFields, flags, providerMeta, verifiedAt
  - Responsibilities: stores AI outputs and evidence summary

- **AdminDecision**
  - Attributes: id, onboardingId, adminId, decision (APPROVE/REJECT), reason, decidedAt
  - Responsibilities: stores final human decision and justification

- **AuditLogEntry**
  - Attributes: id, actorId, actorRole, action, entityRef, payloadSnapshot, createdAt
  - Responsibilities: provides traceability for compliance and debugging

Key associations (textual):
- Psychologist 1..1 PsychologistProfile
- Psychologist 1..* CredentialDocument
- Psychologist 1..1 OnboardingApplication
- OnboardingApplication 0..1 AIVerificationResult
- OnboardingApplication 0..1 AdminDecision
- AuditLogEntry links to actions across entities (many-to-one via entityRef)

## SequenceDiagrams
### Sequence: Profile Creation and Draft Save
Participants: Psychologist UI → Backend API → Database
1. UI sends `POST/PUT Profile` request.
2. Backend validates fields and authenticates actor.
3. Backend saves profile data and returns success + profile snapshot.
4. UI shows “Draft saved”.

### Sequence: Credential Upload (Pre-Signed URL Variant)
Participants: Psychologist UI → Backend API → Object Storage → Database
1. UI requests upload URL for a given document type.
2. Backend authorizes request and returns a pre-signed upload URL + storage key.
3. UI uploads file directly to storage.
4. UI notifies backend of upload completion (metadata).
5. Backend persists CredentialDocument record and returns updated checklist.

### Sequence: Submit + AI Verification (Async Job)
Participants: Psychologist UI → Backend API → Database → Queue/Worker → AI Service
1. UI calls `POST SubmitOnboarding`.
2. Backend validates completeness and transitions status to Submitted.
3. Backend enqueues AI verification job referencing onboarding and document keys.
4. Worker fetches documents (or signed URLs) and calls AI service.
5. AI service returns results (polling or webhook).
6. Backend persists AIVerificationResult and sets status to Pending Admin Review (or AI Flagged + Pending Admin Review).
7. UI shows updated status when queried/refreshed.

### Sequence: Admin Decision
Participants: Admin UI → Backend API → Database → Notification Service (optional)
1. Admin requests list of pending reviews.
2. Backend returns queue items with summary and AI indicators.
3. Admin fetches submission details including document access links.
4. Admin submits approve/reject decision with reason (if reject).
5. Backend validates transition, persists AdminDecision, updates onboarding status, and logs action.
6. Notification is sent to the psychologist (email/in-app).

# TestsandDeployment
This section defines a practical strategy to ensure correctness and continuous stakeholder review during Sprint 2.

## UnitTestingStrategyandScope
Unit test scope:
- Field validation rules for profile completeness.
- Onboarding status transition logic (state machine guards).
- Document metadata validation (type, size, mime).
- AI verification result parsing and risk scoring aggregation logic.
- Permission checks for psychologist/admin actions.

Unit tests should be deterministic and mock external systems (storage and AI provider).

## IntegrationTestingAcrossComponents
Integration tests focus on:
- API contracts from frontend to backend (profile, upload initiation, submission, status).
- Storage integration (pre-signed URL issuance and metadata confirmation).
- AI verification pipeline:
  - job creation and persistence,
  - worker execution behavior,
  - webhook/polling response handling,
  - status transitions after AI results.
- Admin review endpoints and audit logging.

## ManualEnd-to-EndScenarioValidation
Manual validation scenarios (checklist):
1. Psychologist creates a draft profile and edits it later.
2. Psychologist uploads required credentials and sees checklist completion.
3. Psychologist submits; status changes and becomes visible in admin queue.
4. AI verification runs; admin can view AI summary and flags.
5. Admin approves; psychologist becomes Active and can access restricted features.
6. Admin rejects; psychologist sees clear reason and can correct/resubmit if allowed.
7. Access control check: another psychologist cannot access someone else’s documents.

## DeploymentforContinuousReview
Deployment approach:
- Deploy to a staging/review environment at least once per sprint week.
- Enable feature flags for onboarding modules if the platform is already in active use.
- Monitor:
  - upload failures and AI job failures,
  - admin decision latency,
  - security logs (unauthorized document access attempts).
- Provide a review URL and test accounts for stakeholders (admin and psychologist).

# SprintReviewandRetrospective
Sprint Review focus:
- Demonstrate onboarding from profile creation to admin decision.
- Show AI verification evidence and how it assists admin review.
- Validate that status transitions and audit logs are correctly recorded.

Retrospective prompts:
- What slowed onboarding delivery (storage, AI, or admin UI)?
- Were acceptance criteria sufficiently precise (especially for “AI flagged”)?
- Did the team balance automation vs. human control effectively?
- What can be improved for Sprint 3 (e.g., resubmission flow, notifications, analytics)?

# Conclusion
Sprint 2 delivers a complete onboarding pipeline for psychologists, combining secure credential handling, AI-assisted verification, and a robust admin approval workflow. The outcome is a controlled activation mechanism that improves trust, reduces fraud risk, and provides traceability suitable for production governance and academic reporting.

