# Introduction

Sprint 4 consolidates the core operational loop of the platform: patients can activate sessions after payment, patients and psychologists can communicate in real time (text and voice), and the platform provides AI-assisted pre-session analysis to support clinical preparation. This sprint is intentionally designed as an integration sprint: its backlog items span multiple subsystems (payments, email, sessions, WebSocket messaging, media upload, PDF generation, and AI pipelines) and therefore requires strict adherence to the MERN-stack layering principles already used in the project (React UI → Express routes/controllers → service layer → MongoDB models).

The scope described in this document is limited to Sprint 4 deliverables and associated engineering tasks required to ensure the features operate safely and consistently within the existing architecture.

# Sprint Objectives and Scope

Sprint 4 has three primary objectives:

1. **Session activation after payment (PB-10):** enable a patient-facing flow where payment confirmation triggers an email containing an access code that is later used to activate/enter the session. This objective establishes transactional integrity, auditability (code issuance), and minimal operational friction for patients.
2. **Clinical session closure and reporting (PB-11):** allow psychologists to terminate a session and generate a PDF report that can be archived for clinical record-keeping. This objective focuses on correctness, traceability, and document integrity.
3. **Real-time communication and AI-assisted preparation (PB-12 to PB-15):** deliver real-time text chat, voice messaging, patient chatbot interaction, and system-generated clinical summaries based on chatbot history. This objective focuses on latency, reliability, privacy boundaries, and deterministic data handling.

**In scope** for Sprint 4:

- Payment confirmation and access code issuance by email (including code persistence and validation).
- Session activation using the code (authorization and session state transitions).
- Session termination by the psychologist and PDF report generation.
- Real-time text messaging within a shared interface (WebSocket-based).
- Voice message capture in the UI and upload/playback in the session interface.
- Patient AI chatbot interaction prior to the session.
- Clinical summary generation from chatbot history (system-driven pipeline).

**Out of scope** (explicitly deferred):

- Complex payment provider integrations beyond the minimal confirmation flow described here (e.g., full card processing, refunds, chargebacks).
- Human moderation workflows for clinical summaries (summaries are system-generated and can be revised in later sprints).
- Long-term media CDN integration (audio storage is handled within the server-managed upload strategy for now).

# Sprint Planning

Sprint 4 is planned as a multi-track sprint with synchronized integration checkpoints:

- **Track A — Session/Payment:** implement code generation, email delivery, and activation state machine updates.
- **Track B — Communication:** implement/validate WebSocket event contracts, persistence of chat messages, and UI binding.
- **Track C — AI Pipeline:** implement chatbot interaction endpoints, safe history persistence, and clinical summarization pipeline.
- **Track D — Reporting & Compliance:** implement session termination semantics, PDF generation, and artifact access control.

Given the cross-cutting nature of these changes, the sprint plan emphasizes:

- shared API contracts between frontend and backend,
- explicit state transitions (session status, payment status, message status),
- deterministic persistence behavior in MongoDB,
- and strict authorization checks at all sensitive endpoints.

# Assumptions

Sprint 4 is based on the following assumptions:

1. **MERN stack baseline is available:** MongoDB Atlas is configured, Express APIs are accessible at `http://localhost:5000`, and the React client runs at `http://localhost:3000`.
2. **Role-based access control is enforced:** JWT authentication and role restrictions (`patient`, `psychologist`, `admin`) are already implemented and applied consistently through middleware.
3. **Email delivery is available:** the server is configured with an email provider (e.g., Nodemailer with SMTP credentials in `.env`) capable of sending transactional messages (access codes).
4. **WebSocket infrastructure exists:** Socket.io is configured on the backend and the frontend can connect to it; rooms can be used to scope real-time events to a session or a conversation.
5. **PDF generation dependencies exist:** PDF generation libraries (e.g., PDFKit) are available server-side; PDF artifacts can be stored and retrieved securely.
6. **AI provider connectivity is available:** the platform has credentials and network access to an AI provider (e.g., Groq / Google Generative AI) and can tolerate transient failures using timeouts/retries/fallback messaging.

# Deliverables

Sprint 4 deliverables include:

- Patient payment confirmation workflow and access code delivery by email (PB-10).
- Session activation endpoints and client UI flows (PB-10).
- Psychologist session termination and PDF report generation (PB-11).
- Real-time text messaging (PB-12) and message persistence.
- Voice message recording/uploading/playback within the session interface (PB-13).
- Patient AI chatbot interaction UI and backend endpoints (PB-14).
- System-generated structured clinical summary from chatbot history (PB-15).
- Documentation updates and validation strategy for integrated features.

# Stakeholders and Roles

| Stakeholder / Role | Responsibility | Interests |
|---|---|---|
| Patient | Confirms payment, activates session, exchanges messages, uses AI chatbot | Rapid activation, privacy, usability |
| Psychologist | Conducts session, sends/receives messages, ends session, generates report | Reliable comms, clinical context, record integrity |
| System (Backend Services) | Enforces business rules, state transitions, persistence, notifications | Security, correctness, auditability |
| AI Service | Generates chatbot responses and clinical summaries | Safe prompting, bounded inputs, consistent outputs |
| Admin (Operational) | Monitoring, dispute handling, compliance | Traceability, access control, observability |

# Sprint Backlog

The following table summarizes the sprint backlog in terms of product backlog items and their primary implementation scope.

| ID | Title | User Story Summary | Priority | Story Points | Primary Components |
|---|---|---|---:|---:|---|
| PB-10 | Session Payment Confirmation & Access Code | Patient confirms payment and receives an email access code to activate session | High | 8 | React UI, Express routes, Email service, Session model |
| PB-11 | Session Termination & PDF Report | Psychologist ends a session and generates a PDF report for clinical records | Medium | 5 | Express routes, PDF generation service, Storage, Authorization |
| PB-12 | Real-Time Text Messaging | Session participants exchange real-time text messages in the shared interface | High | 8 | Socket.io, Message model, React chat UI |
| PB-13 | Voice Messaging | Participants send voice messages using a microphone interface | Medium | 5 | Media capture UI, Upload endpoint, Audio storage, Playback |
| PB-14 | AI Chatbot Interaction | Patient interacts with AI chatbot to express mental state before session | High | 8 | React chatbot UI, Chatbot routes, AI provider integration |
| PB-15 | Clinical Summary Generation | System generates structured clinical summary from chatbot history | High | 8 | Summarization service, Prompt templates, Storage, Retrieval |

## Sprint Backlog

### User Stories (Session Flow)

Sprint 4 introduces an explicit session lifecycle with **payment confirmation**, **code issuance**, **session activation**, and **session termination**. The session lifecycle is treated as a state machine to prevent ambiguous transitions (e.g., activating a session without a valid code, or generating a report without a completed session).

### Messaging System

Real-time messaging is treated as a first-class capability of the platform, with the following non-negotiable properties:

- messages are scoped to a session/conversation channel,
- messages are persisted for auditability and continuity,
- WebSocket events are acknowledgable (client can reconcile with server persistence),
- and access control is enforced at both the API and socket layer.

### AI Chatbot Workflow

The AI chatbot is a pre-session intake mechanism. It must ensure:

- a clean separation between the chatbot history and session chat,
- storage of conversational turns as structured data,
- bounded prompt sizes to avoid provider payload limits,
- and deterministic clinical summary generation in a structured format.

### Technical Tasks

Sprint 4 includes supporting engineering tasks necessary for reliability:

- defining stable event contracts for Socket.io,
- creating a consistent media upload strategy for voice messages,
- implementing safe file storage boundaries for generated PDF reports,
- and adding observability hooks (logs and error reporting) for AI and messaging pipelines.

# Functional Specification

## Session Activation and Payment

### Use Case Diagram — Session Activation

**Figure 1 — Use Case Diagram: Session Activation**  
_Placeholder: diagram showing Patient ↔ System with “Confirm Payment”, “Issue Access Code”, “Email Access Code”, “Activate Session (with code)”, “Validate Code”._

### Use Case Descriptions — Session Activation

| Field | UC-10 — Confirm Payment & Receive Access Code |
|---|---|
| Primary Actor | Patient |
| Supporting Actors | System (Payment/Session Service), Email Service |
| Goal | Confirm payment, generate an access code, and deliver it to patient by email |
| Preconditions | Patient is authenticated; session request exists; session is in `pending_payment` state |
| Trigger | Patient clicks “Confirm Payment” in the UI |
| Main Success Scenario | (1) Patient submits confirmation → (2) System validates session eligibility → (3) System generates access code → (4) System persists code with TTL/expiry → (5) System sends code via email → (6) UI displays “Code sent” state |
| Extensions / Alternate Flows | A1: Email service failure → system retains code and retries; UI displays a recoverable error. A2: Session not eligible → UI displays reason and prevents confirmation |
| Postconditions | Access code exists and is associated with the session; patient is notified; session remains inactive until code is validated |
| Non-Functional Notes | Code must be unpredictable (cryptographically random); logs must not store the full code; rate-limit confirmation to prevent abuse |

| Field | UC-10b — Activate Session Using Access Code |
|---|---|
| Primary Actor | Patient |
| Supporting Actors | System (Session Service) |
| Goal | Validate access code and transition session to active state |
| Preconditions | Patient is authenticated; patient possesses the code; session is `pending_activation` or `pending_payment_confirmed` |
| Trigger | Patient submits the code in the activation UI |
| Main Success Scenario | (1) Patient submits code → (2) System validates code, expiry, and session association → (3) System transitions session to `active` → (4) System grants access to session interface |
| Extensions / Alternate Flows | A1: Invalid/expired code → UI shows error and allows retry; rate-limited. A2: Session already active/completed → UI shows status and redirects appropriately |
| Postconditions | Session becomes active; session participants can exchange messages |
| Non-Functional Notes | Prevent brute force via rate limiting and attempt counters; store hashed code if required by compliance policy |

## Session Management and Reporting

### Use Case Diagram — Session Termination & Report Generation

**Figure 2 — Use Case Diagram: Session Termination & Report Generation**  
_Placeholder: diagram showing Psychologist ↔ System with “End Session”, “Generate PDF Report”, “Store Report”, “Download/View Report”._

### Use Case Descriptions — Session Termination & Report Generation

| Field | UC-11 — End Session & Generate PDF Report |
|---|---|
| Primary Actor | Psychologist |
| Supporting Actors | System (Session Service), PDF Generation Service |
| Goal | Close a session and generate a clinical PDF report |
| Preconditions | Psychologist is authenticated; session is `active`; psychologist is assigned to the session |
| Trigger | Psychologist clicks “End Session” in the session interface |
| Main Success Scenario | (1) Psychologist ends session → (2) System validates permissions → (3) System transitions session to `completed` → (4) System generates PDF report (metadata + structured content) → (5) System stores report artifact securely → (6) UI provides link/download |
| Extensions / Alternate Flows | A1: PDF generation failure → session still completes, report generation can be retried. A2: Unauthorized attempt → 403 and audit log |
| Postconditions | Session is completed; report artifact is available to authorized users (psychologist/admin) |
| Non-Functional Notes | PDF must not leak sensitive data to public endpoints; store with access control and predictable retention |

## Real-Time Messaging System

### Use Case Diagram — Messaging

**Figure 3 — Use Case Diagram: Real-Time Messaging**  
_Placeholder: diagram showing Patient and Psychologist interacting with System via “Send Message”, “Receive Message”, “Persist Message”, “Load History”._

### Use Case Descriptions — Messaging

| Field | UC-12 — Real-Time Chat |
|---|---|
| Primary Actors | Patient, Psychologist |
| Supporting Actors | System (Socket Service, Message Persistence Service) |
| Goal | Exchange real-time text messages within a session |
| Preconditions | Participants are authenticated; session is active; both users are authorized for the session room |
| Trigger | User types a message and presses “Send” |
| Main Success Scenario | (1) Client emits `send_message` → (2) Server validates membership → (3) Server persists message to MongoDB → (4) Server broadcasts `receive_message` to room → (5) Clients render message and update unread indicators |
| Extensions / Alternate Flows | A1: Temporary disconnect → client queues message and retries; server idempotently handles duplicates. A2: Session not active → server rejects event |
| Postconditions | Message is persisted and visible to both participants |
| Non-Functional Notes | Low latency; ordering preserved per room; enforce payload size limits; sanitize content to prevent XSS |

## Voice Messaging

### Use Case Diagram — Voice Messaging

**Figure 4 — Use Case Diagram: Voice Messaging**  
_Placeholder: diagram showing Participant ↔ System with “Record Audio”, “Upload Audio”, “Persist Metadata”, “Playback Audio”._

### Use Case Descriptions — Voice Messaging

| Field | UC-13 — Voice Messaging |
|---|---|
| Primary Actors | Patient, Psychologist |
| Supporting Actors | System (Upload Service, Message Service) |
| Goal | Record and exchange short voice messages during an active session |
| Preconditions | Browser supports microphone access; participant is authenticated and authorized; session is active |
| Trigger | User presses microphone button and confirms upload |
| Main Success Scenario | (1) Client records audio → (2) Client uploads audio blob to backend → (3) Backend validates mime/size, stores audio file → (4) Backend creates a message record of type `voice` → (5) Backend broadcasts message event → (6) Recipients can play audio in UI |
| Extensions / Alternate Flows | A1: Microphone denied → UI provides guidance and fallback. A2: Upload too large → UI requests shorter recording |
| Postconditions | Voice message is stored and playable by authorized participants |
| Non-Functional Notes | Enforce strict size limits; do not expose private storage paths; prefer streaming-safe formats |

## AI Chatbot Interaction

### Use Case Diagram — AI Chatbot

**Figure 5 — Use Case Diagram: AI Chatbot Interaction**  
_Placeholder: diagram showing Patient ↔ System ↔ AI Service with “Send Prompt”, “Receive Response”, “Store Turn”, “Retrieve History”._

### Use Case Descriptions — AI Chatbot

| Field | UC-14 — Patient Chatbot Interaction |
|---|---|
| Primary Actor | Patient |
| Supporting Actors | System (Chatbot Service), AI Service |
| Goal | Allow patient to express mental state before a session through a guided chatbot |
| Preconditions | Patient is authenticated; chatbot module is available; user consent to use AI features is acknowledged (policy-dependent) |
| Trigger | Patient opens chatbot UI and submits a message |
| Main Success Scenario | (1) Patient sends message → (2) System appends to history → (3) System calls AI provider with bounded context → (4) System stores response → (5) UI renders response and updates history |
| Extensions / Alternate Flows | A1: AI provider error/timeout → UI shows “temporary unavailable” and retains patient message. A2: Content policy violation → response is refused and user guided |
| Postconditions | Chatbot history is persisted as structured turns for later analysis |
| Non-Functional Notes | Strict prompt size bounding; do not log sensitive content; enforce per-user isolation |

## Clinical Summary Generation

### Use Case Diagram — Clinical Summary

**Figure 6 — Use Case Diagram: Clinical Summary Generation**  
_Placeholder: diagram showing System ↔ AI Service with “Fetch History”, “Generate Summary”, “Store Summary”, “Expose to Psychologist”._

### Use Case Descriptions — Clinical Summary

| Field | UC-15 — Clinical Summary Generation |
|---|---|
| Primary Actor | System |
| Supporting Actors | AI Service, Psychologist (consumer) |
| Goal | Generate a structured clinical summary from patient chatbot history |
| Preconditions | Patient chatbot history exists; system is authorized to process it; session context exists or is linkable |
| Trigger | Automatic job at session creation/activation, or explicit “Generate Summary” action (implementation-dependent) |
| Main Success Scenario | (1) System fetches recent chatbot turns → (2) System normalizes/filters content → (3) System calls AI provider with summary prompt → (4) System validates output structure → (5) System stores summary in MongoDB → (6) Psychologist can view summary in patient/session UI |
| Extensions / Alternate Flows | A1: Token/payload overflow → system truncates and retries. A2: AI returns malformed output → system stores safe fallback and flags for regeneration |
| Postconditions | Structured clinical summary is available to authorized psychologists |
| Non-Functional Notes | Output must be clearly labeled as AI-generated; adopt defensive parsing; store versioned prompt metadata for traceability |

# System Design

This sprint follows a modular MERN architecture with explicit layers:

- **React Client:** UI state, microphone capture, WebSocket client, form validation, and view rendering.
- **Express Backend:** API endpoints, authorization middleware, file upload handling, and route grouping.
- **Services Layer:** payment code issuance, email delivery, WebSocket event validation, AI prompts and summarization, PDF generation.
- **MongoDB Models:** sessions, messages, notifications, chatbot history, clinical summaries, reports.

## Class Diagram

**Figure 7 — Class Diagram (Domain Model)**  
_Placeholder: include Session, User, Psychologist, Message, VoiceAsset, ChatbotTurn, ClinicalSummary, ReportArtifact._

Recommended domain entities (conceptual):

- `Session`: `patientId`, `psychologistId`, `status`, `accessCode`, `accessCodeExpiresAt`, timestamps
- `Message`: `sessionId`, `senderId`, `type` (`text|voice`), `content`, `assetPath`, timestamps
- `ChatbotTurn`: `userId`, `role` (`user|assistant`), `content`, timestamps
- `ClinicalSummary`: `userId`, `sessionId`, `summaryJson`, `model`, `promptVersion`, timestamps
- `ReportArtifact`: `sessionId`, `createdBy`, `pdfPath`, `hash`, timestamps

## Sequence Diagram

**Figure 8 — Sequence Diagram: “Activate Session and Start Messaging”**  
_Placeholder: Patient → API: confirm payment → Email service; Patient → API: activate with code; Client → Socket.io: join room; send/receive messages._

# Testing and Validation Strategy

Sprint 4 introduces stateful and real-time behavior, therefore validation must cover both synchronous API calls and asynchronous event flows.

## Unit Testing

Unit tests focus on deterministic business logic in isolation:

- Access code generation: entropy, format validation, expiry handling.
- Session state transitions: allowed transitions only, invalid transition rejection.
- AI prompt bounding: truncation logic and structural validation for summary outputs.
- PDF generation: deterministic rendering for minimal input; hash computation validation.

## Integration Testing

Integration tests validate communication across modules:

- API + MongoDB: persistence of sessions, codes, messages, chatbot turns, summaries, and reports.
- Email service integration: use a test SMTP server or provider sandbox; assert message is queued and contains expected placeholders (without logging sensitive codes).
- Upload pipeline: voice message upload endpoint validates mime/size and produces a message event.

## End-to-End Testing

E2E tests validate full user journeys:

- Patient confirms payment → receives code (mock email) → activates session → sends a message → psychologist receives it.
- Psychologist ends session → PDF report is generated → report can be downloaded/viewed with proper authorization.
- Patient interacts with chatbot → system generates summary → psychologist can view summary.

## Test Environment

Recommended test environment configuration:

- **MongoDB:** dedicated test database (separate connection string).
- **Email:** sandbox SMTP (e.g., MailHog) or provider sandbox credentials.
- **AI Provider:** mock responses for determinism in CI; live provider only in staging.
- **WebSocket:** local server with Socket.io; tests must validate join/leave logic and room scoping.
- **Storage:** local filesystem storage for media/PDF artifacts with test cleanup.

# Sprint Review and Retrospective

Sprint 4 success is evaluated according to:

- **Functional completeness:** all PB-10 to PB-15 flows are demonstrable in an integrated environment.
- **Reliability and correctness:** no session activation without a valid code; no messaging without authorization; report generation occurs only when session is completed.
- **Performance:** real-time messaging latency is acceptable for clinical interaction; AI interactions are bounded and do not block the UI indefinitely.
- **Security and privacy:** media/PDF endpoints enforce access control; logs do not expose sensitive content; AI processing respects isolation boundaries.

Retrospective focus areas:

- whether WebSocket contracts were stable and well-documented,
- whether AI prompt bounding strategy avoided provider errors,
- and whether report generation/storage is maintainable for future compliance needs.

# UI Demonstration

This section enumerates the primary UI demonstrations expected in Sprint 4. Screenshots can be inserted once the UI is finalized.

## Session Interfaces

### UC-10 — Confirm Payment & Receive Access Code

_Demonstration checklist:_

1. Patient opens session payment screen and confirms payment.
2. UI displays success state: “Access code sent by email”.
3. Patient enters code in activation screen.
4. Session becomes active and session interface is accessible.

### UC-11 — End Session & Generate PDF Report

_Demonstration checklist:_

1. Psychologist opens an active session.
2. Psychologist clicks “End session”.
3. UI confirms session completion and provides “Generate/Download report”.
4. PDF report is generated and can be downloaded/viewed.

## Messaging Interfaces

### UC-12 — Real-Time Chat

_Demonstration checklist:_

1. Patient and psychologist open the shared session interface.
2. Messages sent by one participant appear in real time for the other.
3. Chat history persists across refresh (reloaded from MongoDB).

### UC-13 — Voice Messaging

_Demonstration checklist:_

1. User records voice message via microphone UI.
2. User uploads the recording.
3. Recipient sees voice message and can play it inline.

## AI Interfaces

### UC-14 — Patient Chatbot Interaction

_Demonstration checklist:_

1. Patient opens chatbot page.
2. Patient interacts with AI assistant and receives responses.
3. Chatbot history is persisted and viewable across refresh.

### UC-15 — Clinical Summary Generation

_Demonstration checklist:_

1. System generates clinical summary from chatbot history (automatic or manual trigger).
2. Psychologist views structured summary prior to the session.
3. Summary is clearly labeled as AI-generated and stored for traceability.

# Conclusion

Sprint 4 establishes the platform’s operational readiness for real clinical interaction by implementing the session activation lifecycle, real-time communication (text and voice), and AI-assisted pre-session analysis. The sprint’s design treats the **System** and **AI Service** as explicit actors responsible for deterministic and auditable processing, while preserving strict authorization boundaries for sensitive operations such as session activation, media exchange, and PDF report generation.

The documented architecture is consistent with a MERN stack implementation and emphasizes separation of concerns, state machine rigor, and secure handling of communications and artifacts. Subsequent sprints can build upon this foundation to enhance payment provider integrations, improve media scaling (e.g., CDN), and enrich clinical workflows (e.g., clinician annotations over AI summaries).

