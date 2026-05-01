# Introduction
This Chapter presents a general overview of the software engineering project **PsychPlatform**, a digital psychology platform designed to improve access to mental health support through secure patient–psychologist interaction, AI-assisted support, and a controlled onboarding and verification process for psychologists.

**Document date:** 01/05/2026

# Project Presentation
PsychPlatform is a web-based platform that connects patients with licensed psychologists while providing supportive AI features (e.g., chatbot assistance) and operational workflows (e.g., onboarding, credential verification, and administrative approval). The platform aims to provide a safe, structured, and trustworthy environment for mental health engagement.

# Context and Problem Statement
Mental health services often suffer from limited accessibility, long waiting times, and fragmented follow-up. In addition, patients may struggle to find qualified professionals they can trust, while service providers need reliable workflows for credential verification and platform governance.

The main problems addressed by PsychPlatform are:
- **Access:** difficulty reaching qualified psychologists in a timely manner.
- **Trust and safety:** need for verifiable psychologist credentials and governance controls.
- **Continuity of care:** need for secure communication, organized sessions, and patient history continuity.
- **Support outside sessions:** need for immediate, low-risk guidance (without replacing professional care).

# Main Objectives
- Provide a secure space for **patient–psychologist interaction** (messaging, appointments/session tracking where applicable).
- Integrate **AI chatbot support** for guidance, triage-oriented assistance, and user navigation (with safety boundaries).
- Implement **psychologist onboarding and verification** including profile creation, credential upload, AI-assisted verification, and admin approval.
- Ensure **confidentiality, integrity, availability**, and traceability suitable for sensitive health-related workflows.

# Target Audience
- **Patients:** individuals seeking mental health support, guidance, and professional consultation.
- **Psychologists:** licensed professionals who provide therapy and counseling services through the platform.
- **Administrators/Moderators:** responsible for verification, approvals, compliance monitoring, and incident handling.
- **Project stakeholders:** academic supervisors, evaluators (PFE), and potential future operators.

# Requirements Specification
This section summarizes the main requirements derived from the problem statement and objectives.

## Functional Requirements
Patient-side:
- Account registration and authentication.
- Browse/search psychologists (based on availability, specialization, language, etc.).
- Initiate and manage interactions (e.g., messaging, appointment requests).
- Access AI chatbot for general support and guidance (with safety disclaimers).
- View personal history and relevant conversation/session summaries (where permitted).

Psychologist-side:
- Create and update professional profile.
- Upload credential documents (license, degree, ID).
- Submit onboarding for verification and track onboarding status.
- Interact with patients after approval (messaging and service workflows).

Admin-side:
- Review psychologist onboarding submissions in a queue.
- Access uploaded credentials securely and view AI verification summaries.
- Approve or reject submissions with reasons and audit logging.
- Monitor user reports and platform safety events (baseline requirement).

AI features:
- Chatbot support for patient guidance and platform navigation.
- AI-assisted credential verification support for onboarding (risk scoring and flags).

## Non-Functional Requirements
Security and privacy:
- Strong authentication and role-based access control (Patient/Psychologist/Admin).
- Secure storage and access for credential documents (encryption at rest and in transit; signed URLs).
- Audit trails for onboarding decisions, sensitive access, and status changes.

Quality attributes:
- Reliability: retry mechanisms for AI jobs and uploads; graceful error handling.
- Performance: responsive UI; non-blocking AI processing via asynchronous jobs.
- Usability: simple flows and clear status visibility for onboarding and interactions.
- Maintainability: modular architecture, clear interfaces, and automated tests.
- Scalability: ability to support growth in users, documents, and AI workloads.

# SCRUM Development Methodology
SCRUM is an agile framework that structures development into short, iterative cycles called **sprints**. Each sprint produces an increment of the product that can be reviewed and improved. SCRUM emphasizes transparency, inspection, and adaptation, making it suitable for projects where requirements evolve through stakeholder feedback.

## Justification for Choosing SCRUM
SCRUM is chosen because PsychPlatform:
- Contains multiple interacting modules (patient features, onboarding, AI components) that benefit from iterative integration.
- Requires continuous feedback for UX refinement and safety policies.
- Benefits from early delivery of usable increments (e.g., onboarding before advanced AI features).
- Requires risk management (security, privacy, AI reliability) through incremental validation.

## SCRUM Roles
- **Product Owner (PO):** defines priorities, maintains the Product Backlog, and clarifies acceptance criteria.
- **Scrum Master:** facilitates SCRUM events, removes impediments, and ensures the process is followed effectively.
- **Development Team:** designs, implements, tests, and delivers increments (frontend, backend, QA, and DevOps practices as needed).
Optional supporting roles (contextual):
- **Domain advisor (psychology):** validates domain language, safety boundaries, and ethical constraints.
- **Admin representative:** validates onboarding and governance workflow expectations.

# Product Backlog
The Product Backlog is a prioritized list of features expressed as user stories and technical tasks. A simplified backlog for PsychPlatform includes:
- Authentication and user profiles (Patient/Psychologist/Admin).
- Patient–psychologist discovery and interaction features.
- Psychologist onboarding: profile, credential upload, AI verification, admin approval.
- AI chatbot support with safety constraints and escalation guidance.
- Admin dashboards (onboarding queue, moderation tools).
- Logging, auditing, and monitoring.

# User Story Acceptance Criteria
Sample user stories (illustrative) with acceptance criteria:

1. **US-1: Patient initiates chat with psychologist**
   - Acceptance criteria:
     - Patient can select a psychologist and send an initial message.
     - Conversation is visible to both parties.
     - Unauthorized users cannot access the conversation.

2. **US-2: Psychologist submits onboarding for approval**
   - Acceptance criteria:
     - Submission is blocked if required profile fields or documents are missing.
     - Status changes to Submitted/Pending Review.
     - The system records a submission timestamp and audit log entry.

3. **US-3: Admin approves or rejects onboarding**
   - Acceptance criteria:
     - Admin can view profile, documents, and AI verification summary.
     - Approve activates psychologist account; Reject requires a reason.
     - Decision is recorded with admin identity and timestamp.

# Sprint Planning
Sprint Planning defines the sprint goal and selects backlog items that can be delivered within the sprint timebox.

## General Planning
General planning principles for PsychPlatform:
- Prioritize foundational features early: authentication, RBAC, secure storage, auditing.
- Deliver onboarding and verification before enabling broad patient discovery features.
- Integrate AI incrementally, starting with safe and easily testable components.
- Maintain a Definition of Done including tests, review, and deployable increments.

# Class Diagram
Textual description of a global class model:
- **User** (abstract/base): id, email, passwordHash, role, status
  - Specializations: **Patient**, **Psychologist**, **Admin**
- **PsychologistProfile**: psychologistId, specialization, bio, languages, experienceYears
- **OnboardingApplication**: psychologistId, status, submittedAt, aiVerificationId, adminDecisionId
- **CredentialDocument**: psychologistId, type, storageKey, checksum, uploadedAt
- **Conversation**: id, patientId, psychologistId, createdAt, status
- **Message**: conversationId, senderId, content, createdAt
- **Appointment/Session** (optional depending on scope): patientId, psychologistId, scheduledAt, status
- **AIChatSession**: userId, messages, riskFlags, createdAt
- **AuditLogEntry**: actorId, action, entityRef, payloadSnapshot, createdAt

Key associations (summary):
- Psychologist 1..1 PsychologistProfile
- Psychologist 1..1 OnboardingApplication
- Psychologist 1..* CredentialDocument
- Patient 1..* Conversation; Psychologist 1..* Conversation
- Conversation 1..* Message
- AuditLogEntry references sensitive actions across modules

# Global Use Case Diagram
Actors (textual):
- Patient
- Psychologist
- Admin
- AI Services (chatbot + verification)

Main use cases (textual):
- Patient: Register/Login, Search Psychologists, Start Conversation, Use AI Chatbot, Manage Profile
- Psychologist: Register/Login, Create Profile, Upload Credentials, Submit for Verification, Communicate with Patients
- Admin: Review Onboarding Queue, Approve/Reject Psychologists, Monitor Safety/Audit Logs
- AI Services: Provide Chatbot Responses, Verify Credentials (OCR/extraction/risk scoring)

# Gantt Chart
Textual Gantt representation (high-level phases and dependencies):
- **Phase 1: Foundations (Weeks 1–2)**
  - Authentication, RBAC, base entities, initial UI scaffolding
- **Phase 2: Onboarding & Verification (Weeks 3–4)**
  - Psychologist profile, credential upload, AI verification pipeline, admin approval dashboard
- **Phase 3: Patient–Psychologist Interaction (Weeks 5–6)**
  - Conversations/messages, access rules, basic session workflows (if included)
- **Phase 4: AI Chatbot Support (Weeks 7–8)**
  - Chatbot UI, safety constraints, logging, fallback guidance
- **Phase 5: Hardening & Delivery (Weeks 9–10)**
  - Testing, security review, performance tuning, documentation, deployment readiness

Dependencies (summary):
- RBAC and audit logging must precede onboarding approval.
- Secure storage must precede credential upload.
- Conversation access rules must precede patient–psychologist messaging.

# Development Tools and Environment
This section describes the resources required to develop, test, and deploy PsychPlatform.

## Hardware Environment
Minimum recommended development environment:
- CPU: 4 cores (or more)
- RAM: 8–16 GB
- Storage: 20+ GB available (for dependencies, logs, and test artifacts)
- Stable internet connection for package retrieval and AI service integration (if remote)

## Technical Stack
Indicative technical stack (adaptable to project constraints):
- Frontend: modern web framework (SPA) with component-based UI
- Backend: RESTful API server with modular services
- Database: relational database for core data (users, onboarding, conversations)
- Object storage: secure document storage for credentials
- AI integration:
  - Chatbot service for user support with safety constraints
  - Verification service for OCR/entity extraction/risk scoring
- DevOps: CI pipeline for tests and staged deployments; environment-based configuration

# General Application Architecture
The architecture follows a modular approach where core services are separated by responsibilities, and AI components are integrated through well-defined interfaces.

## Architectural Choice
**Rationale:** A layered, service-oriented backend with a clear boundary between UI, API, data storage, and AI integrations.
- Presentation layer: Web UI for Patient/Psychologist/Admin.
- Application layer: API endpoints and business logic.
- Domain/data layer: persistence models, transactions, audit logs.
- Integration layer: storage adapters and AI service clients.

## Architecture Diagram
Textual architecture diagram (components and interactions):
- **Web Client (Patient/Psychologist/Admin UI)**
  - communicates with →
- **Backend API**
  - uses →
  - **Database** (users, profiles, onboarding status, conversations, audit logs)
  - **Object Storage** (credential documents)
  - **AI Services**
    - Chatbot (patient support)
    - Verification (credential analysis)
  - emits events/jobs to →
  - **Background Worker/Queue** (AI verification jobs, notifications)

Security boundary notes:
- Only the Backend API issues signed URLs for credential documents.
- Admin-only endpoints restrict access to onboarding and sensitive documents.

## Key Data Flow Narratives
1. **Psychologist Onboarding Flow**
   - Psychologist creates profile → uploads credentials to secure storage → submits onboarding → backend triggers AI verification job → admin reviews evidence → approve/reject → platform updates account status and logs decision.

2. **Patient–Psychologist Interaction Flow**
   - Patient searches/selects psychologist → initiates conversation → messages are stored with strict access control → audit logs capture sensitive events (e.g., report/flag if included).

3. **AI Chatbot Support Flow**
   - Patient sends prompt → backend forwards to chatbot service with safety constraints → response returned with disclaimers → logs store minimal necessary metadata for monitoring and improvement.

# Conclusion
This Chapter defined the project context, problems, objectives, target audience, and a structured requirements specification for PsychPlatform. It also presented the SCRUM methodology as the selected development approach, with a backlog-oriented planning model and a high-level architecture suitable for secure, scalable, and auditable mental health workflows. The following chapters can build upon this foundation by detailing analysis, design models, implementation choices, and validation results.

