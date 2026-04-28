# Chapter 1: General Project Framework

---

## General Introduction

The digital transformation of healthcare services has opened unprecedented opportunities for the fields of psychology and mental health. In an era defined by the pervasiveness of artificial intelligence, the globalisation of information systems, and the growing recognition of mental well-being as a critical societal priority, the development of intelligent, accessible, and personalized psychological platforms has become not only feasible but necessary.

This chapter establishes the foundational framework of the project. It begins by contextualizing the problem that motivates the system's development and outlining the primary objectives pursued. It subsequently details the target audience, the functional and non-functional requirements derived from analysis, the agile development methodology adopted (SCRUM), the product backlog and sprint execution plan, and the general planning artifacts including UML diagrams and a Gantt chart. Finally, it surveys the development environment, the technical stack employed, and concludes with a formal presentation of the system's global architecture.

---

## 1.1 Project Presentation

### 1.1.1 Context and Problem Statement

The global prevalence of mental health disorders has reached alarming levels. According to the World Health Organization (WHO), approximately one in four people in the world will be affected by a mental or neurological disorder at some point in their lives, yet nearly two thirds of those with a known disorder never seek professional help. Key barriers identified in the literature include the stigma associated with mental health services, geographic and economic inaccessibility, long wait times for consultations, and the often impersonal and bureaucratic nature of traditional intake processes.

While the emergence of telehealth and digital mental health platforms has partially addressed accessibility barriers, significant gaps persist. Existing systems generally fall into one of two categories: standalone AI chatbots that provide generic wellness content without human clinical involvement, or tele-psychology booking platforms that rely on static, impersonal questionnaires as their sole intake mechanism. Neither paradigm offers a cohesive, intelligent pipeline that guides a patient through a meaningful conversational intake and subsequently prepares a licensed psychologist with structured, clinical-grade context.

Furthermore, the global nature of mental distress demands multilingual solutions. The majority of existing telepsychology platforms are exclusively designed for English-speaking audiences, systematically excluding vast demographic groups whose native languages—such as Arabic, requiring right-to-left layout rendering—are not supported.

This project responds directly to this gap: it proposes a full-stack, MERN-based intelligent psychological consultation platform that bridges AI-driven conversational intake with verified human psychologist oversight, in a secure, multilingual, and accessible environment.

### 1.1.2 Main Objectives

The main objectives of the PsychPlatform project are as follows:

1. **Intelligent Conversational Intake:** To design and implement an AI-powered chatbot capable of conducting dynamic, adaptive psychological pre-session screening using Large Language Models (LLMs), replacing cold static questionnaires with a natural conversational interface.

2. **Automated Clinical Summarization:** To process the patient's conversational history into a structured clinical summary—including dominant emotional indicators, urgency scores (on a scale of 1–5), sentiment trends, and key themes—automatically made available to the assigned psychologist before the consultation begins.

3. **Psychologist Verification Workflow:** To implement a rigorous, AI-assisted credential verification pipeline in which psychologists upload their CV and diploma documents, which are automatically parsed using OCR and AI summarization. An administrator then reviews and approves or rejects the application.

4. **End-to-End Session Management:** To provide a complete lifecycle for psychological consultations, encompassing booking requests via a shared calendar, payment confirmation, session code verification, real-time messaging (text and voice), session completion, and post-session rating.

5. **Multilingual Accessibility:** To engineer the platform with full internationalization (i18n) support for English, French, and Arabic, including dynamic RTL layout rendering for Arabic to ensure cultural and linguistic inclusivity.

6. **Role-Based Access Control and Security:** To enforce strict, multi-tiered access control across three roles (Patient, Psychologist, Admin), protecting sensitive patient data and ensuring regulatory alignment with ethical clinical governance standards.

### 1.1.3 Target Audience

The platform is designed to serve three distinct user personas:

| Persona | Description |
|---|---|
| **Patient** | Individuals seeking psychological support, who may navigate the platform to find a psychologist, use the AI chatbot for pre-session screening, book appointments, make payments, participate in messaging, and rate their experience. |
| **Psychologist** | Licensed mental health professionals who register on the platform, submit credentials for verification, manage their availability calendar, conduct sessions with patients, access AI-generated patient summaries, and maintain private clinical notes. |
| **Administrator** | Platform governance actors who review psychologist applications, manage user accounts, control user roles, and monitor global platform statistics to ensure operational integrity. |

---

## 1.2 Requirements Specification

### 1.2.1 Functional Requirements

The functional requirements are organized by module:

**Authentication & Account Management**
- FR-01: Users shall be able to register an account with a specified role (patient or psychologist).
- FR-02: Users shall be able to log in securely using email and password with JWT-based authentication.
- FR-03: Users shall be able to view and update their profile information.

**Psychologist Profile & Verification**
- FR-04: Psychologists shall be able to create and update their professional profile, including specializations, languages, city, bio, and session price.
- FR-05: Psychologists shall be able to upload their CV and diploma documents via a multi-step setup wizard.
- FR-06: The system shall automatically extract text from uploaded documents using OCR (Tesseract.js) and AI-summarize the content via an LLM for administrator review.
- FR-07: The administrator shall be able to review pending verifications and approve or reject psychologist accounts.

**Search & Discovery**
- FR-08: Patients shall be able to browse the list of approved psychologists with filtering capabilities.
- FR-09: Patients shall be able to search for nearby psychologists using geospatial queries based on their current location.
- FR-10: Patients shall be able to view a psychologist's full public profile, including ratings and reviews.

**Calendar & Booking**
- FR-11: Psychologists shall be able to add, view, and delete availability time slots via an interactive calendar.
- FR-12: Patients shall be able to view available slots for a specific psychologist and submit a booking request.
- FR-13: Psychologists shall be able to confirm or reject booking requests from patients.

**Session Management**
- FR-14: Upon booking confirmation, a patient shall be able to initiate the session lifecycle by selecting a session type (preparation, follow-up, or free expression).
- FR-15: The system shall generate a unique 6-digit session code upon payment confirmation and deliver it to the patient via email.
- FR-16: The patient shall enter the code to activate the session, which then grants access to the shared messaging interface.
- FR-17: The psychologist shall be able to end an active session and generate a downloadable PDF session report.
- FR-18: Both parties shall be able to view their complete session history.
- FR-19: Patients shall be able to rate their consultation experience upon session completion using a 10-question assessment.

**AI Chatbot**
- FR-20: Patients shall have access to an AI-powered chatbot running on LLaMA 3.3 via the Groq Cloud API.
- FR-21: The chatbot shall maintain a persistent, user-scoped conversation history stored in the database.
- FR-22: Upon explicit user request or session logout, the system shall generate and persist a ChatbotSummary document with emotional indicators, urgency score, sentiment trend, key themes, and recommendations.

**Messaging**
- FR-23: Patients and psychologists engaged in an active session shall be able to exchange real-time text messages via a WebSocket-based interface (Socket.IO).
- FR-24: Users shall be able to record and send voice messages through the integrated microphone interface.
- FR-25: The system shall track unread message counts and provide a mechanism to mark messages as read.

**Patient Dashboard (Psychologist-facing)**
- FR-26: Psychologists shall be able to view a list of their patients with associated session histories and AI chatbot summaries.
- FR-27: Psychologists shall be able to add and retrieve private clinical notes per patient.
- FR-28: Psychologists shall be able to add and view emotional indicators per patient session.
- FR-29: Psychologists shall be able to upload patient documents (PDFs), which are parsed and made queryable via AI.

**Admin Panel**
- FR-30: Administrators shall be able to view, modify roles of, and delete all user accounts.
- FR-31: Administrators shall be able to access aggregated statistics on platform usage.

**Platform Assistant**
- FR-32: All users shall have access to a floating navigation assistant powered by an LLM that answers questions about platform functionality and guides navigation.

**Notifications**
- FR-33: Users shall receive in-app notifications for relevant events (e.g., booking confirmations, session updates).
- FR-34: Users shall be able to mark individual and all notifications as read.

### 1.2.2 Non-Functional Requirements

| ID | Category | Requirement |
|---|---|---|
| NFR-01 | **Security** | All passwords shall be hashed using bcryptjs with a work factor of 10 before storage. |
| NFR-02 | **Security** | All API routes shall be protected by JWT authentication middleware; role-based access control shall be enforced at every route level. |
| NFR-03 | **Security** | Rate limiting shall be applied globally: authentication endpoints (10 req/15 min), API routes (100 req/hr), and chatbot (50 messages/hr). |
| NFR-04 | **Performance** | The backend shall use Node.js's non-blocking I/O model to handle concurrent session and messaging requests without degradation. |
| NFR-05 | **Scalability** | The system shall use MongoDB Atlas (cloud-hosted) as its database to support horizontal scaling and geographic redundancy. |
| NFR-06 | **Availability** | The platform shall provide a health-check endpoint and be capable of graceful shutdown on database connection failure. |
| NFR-07 | **Usability** | The user interface shall be responsive and compatible with modern browsers, built using React 19 with TailwindCSS for adaptive styling. |
| NFR-08 | **Localization** | The platform shall support dynamic language switching between English (LTR), French (LTR), and Arabic (RTL) without page reload. |
| NFR-09 | **Data Integrity** | All Mongoose schemas shall enforce strict type validation, uniqueness constraints, and referential integrity via ObjectId references. |
| NFR-10 | **Compliance** | The platform shall not store raw credentials or sensitive clinical identifiers in plaintext. All uploaded files shall be stored server-side with unique identifiers. |

---

## 1.3 SCRUM Development Methodology

### 1.3.1 Justification for Choosing SCRUM

The development of this platform was conducted using the SCRUM agile framework. This methodological choice is justified by the following considerations:

- **Evolving Requirements:** The nature of a telepsychology platform combining AI and human clinical workflows involves requirements that evolved significantly as the project progressed through discovery and testing. SCRUM's iterating sprint cycles allow requirements to be progressively refined without invalidating prior work.
- **Incremental Value Delivery:** Rather than attempting a comprehensive "big-bang" release, SCRUM enabled the delivery of a working, testable product at the end of each sprint, allowing early feedback and rapid course correction.
- **Risk Mitigation:** By integrating core technical risks (e.g., the LLM integration, real-time messaging, geospatial search) into dedicated early sprints, SCRUM ensured that high-uncertainty components were resolved before lower-risk features were built upon them.
- **Team Transparency:** Daily stand-ups and sprint reviews enforced continuous visibility of project status, facilitating coordination between development roles.

### 1.3.2 SCRUM Roles

| Role | Responsibilities in this Project |
|---|---|
| **Product Owner** | Defines and prioritizes the Product Backlog, articulates acceptance criteria, and validates delivered features against the project vision. For an academic project, this role encompasses the supervisor and project initiator. |
| **SCRUM Master** | Facilitates sprint ceremonies, removes impediments, enforces SCRUM process adherence, and protects the development team from scope creep during active sprints. |
| **Development Team** | A cross-functional team responsible for all design, development, AI integration, testing, and documentation activities. In this academic context, the development team is the project authors, handling both frontend and backend responsibilities across each sprint. |

---

## 1.4 Product Backlog

The Product Backlog represents the complete, prioritized list of features and technical tasks identified for the platform. Items are organized by functional epic and ordered by business value and technical dependency.

| ID | Epic | User Story | Priority | Estimated Effort |
|---|---|---|---|---|
| PB-01 | Authentication | As a user, I want to register and log in securely so that my account is protected. | High | 3 SP |
| PB-02 | Auth | As a user, I want JWT-based session management so that I remain authenticated across page navigations. | High | 2 SP |
| PB-03 | Psychologist Profile | As a psychologist, I want to create a detailed professional profile so that patients can find and assess my credentials. | High | 5 SP |
| PB-04 | Verification | As a psychologist, I want to upload my CV and diploma for AI-assisted verification so that I can be approved by the administrator. | High | 8 SP |
| PB-05 | Verification | As an administrator, I want to review AI-generated summaries of psychologist documents so that I can approve or reject applications efficiently. | High | 3 SP |
| PB-06 | Search | As a patient, I want to browse and filter the list of approved psychologists so that I can find one that matches my needs. | High | 5 SP |
| PB-07 | Search | As a patient, I want to search for psychologists near my location so that I can prioritize geographical convenience. | Medium | 5 SP |
| PB-08 | Calendar | As a psychologist, I want to manage my availability calendar so that patients can book appropriate time slots. | High | 8 SP |
| PB-09 | Calendar | As a patient, I want to request a booking for an available time slot with a psychologist. | High | 5 SP |
| PB-10 | Session | As a patient, I want to confirm my payment and receive a session access code via email to activate my consultation. | High | 8 SP |
| PB-11 | Session | As a psychologist, I want to end a session and generate a PDF report for clinical record-keeping. | Medium | 5 SP |
| PB-12 | Messaging | As a session participant, I want to exchange real-time text messages within the shared session interface. | High | 8 SP |
| PB-13 | Messaging | As a session participant, I want to send voice messages using my microphone within the conversation interface. | Medium | 5 SP |
| PB-14 | AI Chatbot | As a patient, I want to interact with an AI chatbot to express my mental state before a session so that my psychologist is better prepared. | High | 8 SP |
| PB-15 | AI Chatbot | As the system, I want to generate a structured clinical summary from a patient's chatbot history so that it is ready for the psychologist's review. | High | 8 SP |
| PB-16 | Dashboard | As a psychologist, I want to access a dashboard showing my patients, their AI summaries, and private clinical notes. | High | 8 SP |
| PB-17 | Documents | As a psychologist, I want to upload and AI-query patient documents so that I can enrich my clinical records. | Medium | 5 SP |
| PB-18 | Rating | As a patient, I want to submit a 10-question rating after a session so that the platform can maintain quality standards. | Medium | 3 SP |
| PB-19 | Admin | As an administrator, I want to manage all user accounts, roles, and view platform statistics. | Medium | 5 SP |
| PB-20 | i18n | As a user, I want the platform to support English, French, and Arabic with full RTL layout support so that I can use it in my native language. | Medium | 8 SP |
| PB-21 | Assistant | As a user, I want access to a floating platform navigation assistant powered by AI. | Low | 3 SP |
| PB-22 | Notifications | As a user, I want to receive and manage in-app notifications for key system events. | Low | 3 SP |

> **SP = Story Points** | Scale: 1 (trivial) → 8 (complex with uncertainty)

---

## 1.5 User Story Acceptance Criteria

The following table presents the acceptance criteria for the most critical user stories:

**PB-04 — Psychologist Credential Upload & AI Verification**

| Criterion | Condition |
|---|---|
| AC-1 | The upload form shall accept PDF files for both CV and diploma. |
| AC-2 | Upon submission, Multer shall save files and Tesseract.js (or pdf-parse) shall extract text automatically. |
| AC-3 | The Groq LLM shall generate a structured AI summary of the extracted text within 10 seconds. |
| AC-4 | The administrator's panel shall display the AI summary alongside the uploaded document links. |
| AC-5 | Pending psychologists shall be blocked from patient-facing features until approved. |

**PB-14 / PB-15 — AI Chatbot + Summary Generation**

| Criterion | Condition |
|---|---|
| AC-1 | The chatbot shall maintain a full, user-scoped conversation history persisted in MongoDB. |
| AC-2 | System prompts shall enforce empathetic tone and prevent the AI from making clinical diagnoses. |
| AC-3 | Upon session end trigger, the system shall generate a ChatbotSummary with: `dominantEmotion`, `urgencyScore` (1–5), `sentimentTrend` (improving/stable/declining), `keyThemes[]`, `rawSummary`, and `recommendations[]`. |
| AC-4 | The summary shall be available to the assigned psychologist from the patient dashboard view. |
| AC-5 | If the LLM returns malformed JSON, a safe fallback parser shall extract the valid structure. |

**PB-10 — Session Payment & Code Verification**

| Criterion | Condition |
|---|---|
| AC-1 | A unique 6-digit code shall be generated and stored upon payment confirmation. |
| AC-2 | The code shall be delivered to the patient's registered email via Nodemailer. |
| AC-3 | The patient shall enter the code on the VerifyCode page to advance the session status to `verified`. |
| AC-4 | The code shall expire after a configurable duration and become invalid thereafter. |
| AC-5 | Re-entry of an incorrect code shall not deduct from a retry counter but shall display a clear error. |

---

## 1.6 Sprint Planning

The project was organized into five focused sprints, each with a defined goal, a set of backlog items, and a clear definition of done.

| Sprint | Duration | Goal | Backlog Items |
|---|---|---|---|
| **Sprint 1** | 2 weeks | Core infrastructure: authentication, role system, and base MERN architecture. | PB-01, PB-02 |
| **Sprint 2** | 2 weeks | Psychologist onboarding: profile creation, credential upload & AI verification, admin approval flow. | PB-03, PB-04, PB-05 |
| **Sprint 3** | 2 weeks | Patient engagement: search & discovery, geospatial search, calendar management, and full booking lifecycle. | PB-06, PB-07, PB-08, PB-09 |
| **Sprint 4** | 3 weeks | Core consultation engine: session payment & code system, real-time messaging (Socket.IO), voice messages, session lifecycle & PDF report generation, AI chatbot integration & clinical summary generation. | PB-10, PB-11, PB-12, PB-13, PB-14, PB-15 |
| **Sprint 5** | 2 weeks | Platform enrichment: psychologist dashboard, document management & AI querying, ratings, admin panel, i18n (EN/FR/AR + RTL), platform assistant, and notifications. | PB-16, PB-17, PB-18, PB-19, PB-20, PB-21, PB-22 |

**Definition of Done (DoD):** A backlog item is considered "Done" when:
- All acceptance criteria are met and verified.
- The feature is integrated into the main branch without breaking existing functionality.
- The relevant API endpoint is tested and returns the expected HTTP status codes.
- The UI component renders correctly on desktop and mobile viewports.

---

## 1.7 General Planning

### 1.7.1 Class Diagram

The following class diagram represents the core data model entities and their relationships within the platform's MongoDB database.

```
┌──────────────────────────────┐
│            User              │
├──────────────────────────────┤
│ - _id: ObjectId              │
│ - email: String              │
│ - password: String (hashed)  │
│ - role: Enum[patient,        │
│           psychologist,admin]│
│ - isVerified: Boolean        │
│ - createdAt: Date            │
│ - updatedAt: Date            │
└──────────────┬───────────────┘
               │ 1
               │ has profile if role = psychologist
               │ 0..1
┌──────────────▼───────────────┐
│         Psychologist         │
├──────────────────────────────┤
│ - _id: ObjectId              │
│ - userId: ObjectId → User    │
│ - firstName: String          │
│ - lastName: String           │
│ - photo: String              │
│ - bio: String                │
│ - specializations: [String]  │
│ - languages: [String]        │
│ - city: String               │
│ - location: GeoJSON Point    │
│ - averageRating: Number      │
│ - totalRatings: Number       │
│ - availability: String       │
│ - isApproved: Boolean        │
│ - isRejected: Boolean        │
│ - cvUrl: String              │
│ - diplomaUrl: String         │
│ - aiVerificationSummary: Str │
│ - sessionPrice: Number       │
└──────────────────────────────┘

┌──────────────────────────────┐
│           Session            │
├──────────────────────────────┤
│ - _id: ObjectId              │
│ - patientId: ObjectId → User │
│ - psychologistId: ObjId→User │
│ - status: Enum[requested,    │
│   pending, pending_payment,  │
│   paid, verified, active,    │
│   completed, canceled]       │
│ - sessionType: Enum[         │
│   preparation, followup,free]│
│ - calendarSlotId: ObjectId   │
│ - scheduledStart: Date       │
│ - scheduledEnd: Date         │
│ - paymentConfirmed: Boolean  │
│ - paymentDueAt: Date         │
│ - confirmedAt: Date          │
│ - canceledAt: Date           │
│ - isRated: Boolean           │
└──────────────────────────────┘

┌──────────────────────────────┐
│       ChatbotMessage         │
├──────────────────────────────┤
│ - _id: ObjectId              │
│ - userId: ObjectId → User    │
│ - role: Enum[user,assistant] │
│ - content: String            │
│ - createdAt: Date            │
└──────────────────────────────┘

┌──────────────────────────────┐
│       ChatbotSummary         │
├──────────────────────────────┤
│ - _id: ObjectId              │
│ - patientId: ObjectId→User   │
│ - emotionalIndicators:       │
│     dominantEmotion: String  │
│     urgencyScore: 1–5        │
│     sentimentTrend: Enum     │
│ - keyThemes: [String]        │
│ - rawSummary: String         │
│ - recommendations: [String]  │
└──────────────────────────────┘

┌──────────────────────────────┐
│           Message            │
│    (Real-time Messaging)     │
├──────────────────────────────┤
│ - _id: ObjectId              │
│ - sessionId: ObjectId        │
│ - senderId: ObjectId →User   │
│ - recipientId: ObjectId→User │
│ - content: String            │
│ - type: Enum[text, voice]    │
│ - isRead: Boolean            │
│ - createdAt: Date            │
└──────────────────────────────┘

┌──────────────────────────────┐
│         CalendarSlot         │
├──────────────────────────────┤
│ - _id: ObjectId              │
│ - psychologistId: ObjectId   │
│ - startTime: Date            │
│ - endTime: Date              │
│ - isBooked: Boolean          │
└──────────────────────────────┘

┌──────────────────────────────┐
│       PatientDocument        │
├──────────────────────────────┤
│ - _id: ObjectId              │
│ - psychologistId: ObjectId   │
│ - patientId: ObjectId        │
│ - filename: String           │
│ - originalName: String       │
│ - extractedText: String      │
└──────────────────────────────┘

┌──────────────────────────────┐
│           Rating             │
├──────────────────────────────┤
│ - _id: ObjectId              │
│ - patientId: ObjectId →User  │
│ - psychologistId: ObjId→PSY  │
│ - answers: [Number] (10 Qs)  │
│ - score: Number (10–50)      │
│ - comment: String            │
│ (Unique per patient-psy pair)│
└──────────────────────────────┘

Other Entities:
• PrivateNote      — psychologistId, patientId, content
• EmotionalIndicator — sessionId, patientId, indicators
• PatientHistory   — psychologistId, patientId, entries
• Notification     — userId, type, message, isRead
• SessionCode      — sessionId, code, expiresAt
```

### 1.7.2 Global Use Case Diagram

The system identifies four primary actors and twelve functional domains, as captured in the PlantUML use case diagram (`use_case_diagram.puml`). The actor-domain associations are summarized below:

**Actors:**
- 🔵 **Patient** — The primary end-user seeking psychological support.
- 🟢 **Psychologist** — The licensed clinician providing consultation services.
- 🔴 **Admin** — The platform governance actor responsible for verification and management.
- 🟣 **System / AI** — The automated intelligence layer (LLM + integrations) that operates on behalf of the system.

**Functional Domains and Actor Participation:**

| Domain | Patient | Psychologist | Admin | System/AI |
|---|:---:|:---:|:---:|:---:|
| Authentication & Account | ✓ | ✓ | ✓ | |
| Psychologist Profile & Verification | | ✓ | ✓ | ✓ |
| Browse & Search | ✓ | | | |
| Calendar & Booking | ✓ | ✓ | | |
| Session Management | ✓ | ✓ | ✓ | |
| Messaging | ✓ | ✓ | | |
| AI Chatbot | ✓ | | | ✓ |
| Ratings & Reviews | ✓ | | | |
| Psychologist Dashboard | | ✓ | | |
| Document Management | | ✓ | | ✓ |
| Admin Panel | | | ✓ | |
| Platform Assistant | ✓ | ✓ | | ✓ |
| Notifications | ✓ | ✓ | | |

> The complete, formal PlantUML source for this diagram is available in `use_case_diagram.puml` at the project root.

### 1.7.3 Gantt Chart

The following Gantt chart outlines the project timeline across the five SCRUM sprints, encompassing approximately 11 weeks of active development.

```
Week:       W1    W2    W3    W4    W5    W6    W7    W8    W9   W10   W11
            ━━━━━ ━━━━━ ━━━━━ ━━━━━ ━━━━━ ━━━━━ ━━━━━ ━━━━━ ━━━━━ ━━━━━ ━━━━━

Sprint 1    █████ █████
  Auth & Base Stack

Sprint 2          ░░░░░ █████ █████
  Psychologist Onboarding & Verification

Sprint 3                      ░░░░░ █████ █████
  Search, Calendar & Booking

Sprint 4                                  ░░░░░ █████ █████ █████
  Session Engine, Messaging & AI Chatbot

Sprint 5                                              ░░░░░ █████ █████ █████
  Dashboard, i18n, Admin, Ratings & Notifs

Docs/Review                                                             ░░░░░ █████

Legend: █ Active Sprint | ░ Planning/Review
```

---

## 1.8 Development Tools and Environment

### 1.8.1 Hardware Environment

| Component | Specification |
|---|---|
| **Development Machine** | Windows 10/11 PC (x86-64 architecture) |
| **Processor** | Intel Core i-series / AMD Ryzen (modern multi-core) |
| **RAM** | Minimum 8 GB (16 GB recommended for concurrent frontend/backend development servers) |
| **Storage** | SSD-based storage for fast read/write during development and OCR (Tesseract) processing |
| **Network** | Stable broadband connection required for MongoDB Atlas connectivity, Groq API calls, and Google Generative AI API access |
| **Browser** | Google Chrome (latest), Mozilla Firefox (latest) for frontend development and testing |

### 1.8.2 Technical Stack / Software Environment

**Backend Technologies**

| Technology | Version | Role |
|---|---|---|
| **Node.js** | 18+ | JavaScript runtime for the server-side application |
| **Express.js** | ^5.2.1 | Web framework for RESTful API and middleware orchestration |
| **MongoDB Atlas** | Cloud-hosted | NoSQL document database for all persistent data storage |
| **Mongoose** | ^9.2.4 | ODM (Object-Document Mapper) with schema validation and query building |
| **Socket.IO** | ^4.8.3 | WebSocket library for bidirectional real-time messaging |
| **Groq Cloud API** | — | LLM inference API running LLaMA 3.3-70B-Versatile for chatbot and assistant |
| **Google Generative AI** | ^0.24.1 | AI SDK for supplementary generative features |
| **jsonwebtoken** | ^9.0.3 | JWT generation and verification for authentication |
| **bcryptjs** | ^2.4.3 | Password hashing with salt rounds |
| **Multer** | ^2.1.1 | Multipart form data handling for file uploads |
| **Tesseract.js** | ^7.0.0 | OCR engine for extracting text from scanned credential documents |
| **pdf-parse** | ^1.1.1 | Text extraction from native PDF documents |
| **pdfkit** | ^0.17.2 | Programmatic PDF generation for session reports |
| **Nodemailer** | ^8.0.2 | Email delivery for session codes and notifications |
| **express-rate-limit** | ^8.3.2 | Rate limiting middleware for API protection |
| **express-validator** | ^7.3.1 | Request body validation and sanitization |
| **dotenv** | ^17.3.1 | Environment variable management |
| **Nodemon** | ^3.1.14 | Development auto-restart utility |

**Frontend Technologies**

| Technology | Version | Role |
|---|---|---|
| **React.js** | ^19.2.4 | Component-based UI framework |
| **React Router DOM** | ^7.13.1 | Client-side routing and navigation |
| **Axios** | ^1.13.6 | HTTP client for API communication |
| **Socket.IO Client** | ^4.8.3 | WebSocket client for real-time messaging |
| **TailwindCSS** | ^3.4.19 | Utility-first CSS framework for responsive styling |
| **i18next** | ^26.0.3 | Internationalization framework (EN/FR/AR) |
| **react-i18next** | ^17.0.2 | React bindings for i18next |
| **i18next-browser-languagedetector** | ^8.2.1 | Automatic browser language detection |
| **Leaflet / React-Leaflet** | ^1.9.4 | Interactive map rendering for geospatial psychologist search |
| **react-big-calendar** | ^1.19.4 | Feature-rich calendar component for availability management |
| **react-markdown** | ^10.1.0 | Markdown rendering for chatbot and AI responses |
| **moment.js** | ^2.30.1 | Date/time parsing and formatting |

**Development & DevOps Tools**

| Tool | Purpose |
|---|---|
| **Visual Studio Code** | Primary IDE for full-stack development |
| **Git / GitHub** | Version control and remote repository management |
| **Postman** | REST API testing and endpoint documentation |
| **MongoDB Compass** | GUI for MongoDB database inspection and query building |
| **PlantUML** | UML diagram generation (Use Case, Class, Sequence diagrams) |

---

## 1.9 General Application Architecture

### 1.9.1 Architectural Choice

The platform adopts the **MERN stack** (MongoDB, Express.js, React.js, Node.js) as its foundational architecture, implemented as a **layered RESTful API** with a **WebSocket real-time layer** for messaging. This choice is motivated by:

- **Unified JavaScript Ecosystem:** Using JavaScript/Node.js throughout the stack (frontend and backend) eliminates context switching and enables shared validation logic, streamlining development.
- **MongoDB's Document Model:** The schema-flexible, document-oriented nature of MongoDB is well-suited to storing heterogeneous psychological data—conversation histories, clinical summaries, patient profiles—where schema rigidity would be a constraint.
- **React's Component Model:** React's declarative, component-based approach enables the construction of complex, role-specific UIs (Patient, Psychologist, Admin) without code duplication, leveraging shared components and a centralized Context API for global state.
- **Real-time Capability via Socket.IO:** The WebSocket layer is integrated into the existing HTTP server using Socket.IO, enabling seamless bidirectional communication for the session messaging feature without architectural overhead.
- **API-First Design:** The clean separation between the React frontend (client, port 3000) and the Express backend (server, port 5000) enables independent scalability and testing of each tier.

The system does **not** use a monolithic or microservice architecture. It follows a **Modular Monolith** pattern on the backend, where each functional domain (authentication, chat, sessions, verification, etc.) is encapsulated in its own route/controller/model module, communicating through a shared Express application instance.

### 1.9.2 Architecture Workflow / Operation

The overall system operation follows the pattern described below:

```
┌─────────────────────────────────────────────────────────────────────┐
│                        CLIENT LAYER                                  │
│   React.js SPA (Port 3000) + TailwindCSS + i18n (EN/FR/AR + RTL)   │
│   Pages: HomePage, PsychologistList, Calendar, Chatbot, Dashboard… │
│   State: React Context API (Auth) + Component-level State           │
│   Routing: React Router DOM v7 (Protected & Public Routes)          │
└───────────────┬──────────────────────────────┬──────────────────────┘
                │ REST (HTTP/HTTPS)             │ WebSocket (Socket.IO)
                │ Axios                         │ socket.io-client
                ▼                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│                        SERVER LAYER                                  │
│            Express.js API Server (Port 5000)                        │
├──────────────────────────────────────────────────────────────────-──┤
│  Middleware Stack:                                                    │
│  ① CORS          ② JSON Parser      ③ Rate Limiters                 │
│  ④ JWT Auth      ⑤ Role Guards      ⑥ express-validator             │
│  ⑦ Multer (file uploads)  ⑧ Static file serving (/uploads)         │
├──────────────────────────────────────────────────────────────────-──┤
│  Route Modules:                                                       │
│  /api/auth         /api/chatbot       /api/psychologists              │
│  /api/sessions     /api/messages      /api/dashboard                 │
│  /api/admin        /api/ratings       /api/verification               │
│  /api/documents    /api/calendar      /api/notifications              │
│  /api/assistant    (inline)                                           │
├──────────────────────────────────────────────────────────────────-──┤
│  Controller Layer:                                                    │
│  authController    chatbotController  psychologistController          │
│  sessionController verificationCtrl   documentController              │
│  adminController   ratingController   reportController                │
│  voiceController                                                      │
└───────────────┬─────────────────────────────┬────────────────────────┘
                │ Mongoose ODM                │ External API Calls (Axios)
                ▼                             ▼
┌───────────────────────┐     ┌───────────────────────────────────────┐
│    DATABASE LAYER     │     │        EXTERNAL SERVICES              │
│  MongoDB Atlas        │     │                                        │
│  (Cloud NoSQL)        │     │  ┌─────────────────────────────────┐  │
│                       │     │  │ Groq Cloud API                  │  │
│  Collections:         │     │  │  LLaMA 3.3-70B-Versatile        │  │
│  • users              │     │  │  • AI Chatbot Inference          │  │
│  • psychologists      │     │  │  • Platform Assistant            │  │
│  • sessions           │     │  │  • Chatbot Summary Generation   │  │
│  • chatbotmessages    │     │  └─────────────────────────────────┘  │
│  • chatbotsummaries   │     │  ┌─────────────────────────────────┐  │
│  • messages           │     │  │ Google Generative AI            │  │
│  • calendarslots      │     │  │  Supplementary AI Features      │  │
│  • patientdocuments   │     │  └─────────────────────────────────┘  │
│  • ratings            │     │  ┌─────────────────────────────────┐  │
│  • privatenotes       │     │  │ Nodemailer (SMTP)               │  │
│  • emotionalindicators│     │  │  Session Code Email Delivery    │  │
│  • patienthistories   │     │  └─────────────────────────────────┘  │
│  • notifications      │     │  ┌─────────────────────────────────┐  │
│  • sessioncodes       │     │  │ Tesseract.js / pdf-parse        │  │
└───────────────────────┘     │  │  Credential OCR & Text Extract  │  │
                              │  └─────────────────────────────────┘  │
                              └───────────────────────────────────────┘
```

**Key Data Flow Narratives:**

1. **Patient Onboarding via AI Chatbot:**
   The patient navigates to the Chatbot page → React sends messages via Axios to `POST /api/chatbot/message` → The Express controller appends the new message to `ChatbotMessage` collection → Constructs a full conversation history → Sends a prompt to the Groq Cloud API → Returns the LLM response to the client → Displayed via `react-markdown`. On session logout, a summary is auto-generated via `POST /api/chatbot/summary` and persisted as a `ChatbotSummary` document.

2. **Session Lifecycle:**
   Patient selects an available slot → `POST /api/sessions/request` → Psychologist confirms via `PUT /api/sessions/:id/confirm` → Patient selects session type and pays → System generates a 6-digit code, stores in `SessionCode`, sends via Nodemailer → Patient enters code at `VerifyCode` page → Session status advances to `active` → WebSocket room is created; messages flow in real time via `socket.io` → Psychologist ends session → PDF report generated via PDFKit → Session marked `completed`.

3. **Psychologist Verification:**
   Psychologist submits CV/Diploma via multi-step form → Multer saves files to `/uploads` → `verificationController` invokes Tesseract.js or pdf-parse → Extracted text is sent to Groq API for summarization → `aiVerificationSummary` stored in `Psychologist` document → Admin reviews summary and approves/rejects → `isApproved` flag updated accordingly.

---

## Conclusion

This chapter has established the comprehensive foundational framework for the PsychPlatform project. Beginning with a rigorous contextualization of the problem in the digital mental health landscape, the chapter has progressively built up the project's identity: its core objectives, its target user personas, its functional and non-functional requirements, and the SCRUM agile methodology chosen to manage its iterative development.

The Product Backlog and sprint planning demonstrate a structured, priority-driven approach to development, ensuring that critical infrastructure (authentication, AI integration, session management) was delivered before secondary enrichment features (i18n, notifications, ratings). The planning artifacts—class diagram, global use case diagram, and Gantt chart—provide the visual scaffolding necessary to comprehend the system's scope and data relationships.

Finally, the comprehensive survey of the development environment and the global architecture walkthrough reveal a coherent, layered, and extensible system design. The MERN stack, augmented by Socket.IO for real-time communication and the Groq Cloud API for large language model inference, forms a technically sound and modern foundation upon which the subsequent chapters will detail the implementation and validation of each functional domain.
