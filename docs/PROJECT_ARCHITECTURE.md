# PsychPlatform - System Architecture & Requirements

This document provides a comprehensive overview of the PsychPlatform's structural architecture, functional capabilities, and non-functional requirements. It is designed to serve as a high-level reference for developers, architects, and new team members joining the project.

---

## 1. System Overview
PsychPlatform is an AI-assisted psychological intake platform connecting patients with verified psychologists. The application is built on the MERN stack (MongoDB, Express.js, React.js, Node.js) and integrates modern web technologies for real-time communication, AI-driven mental health chatbots, geospatial mapping, and multilingual support.

### 1.1 High-Level Tech Stack
- **Frontend Layer:** React.js (v19), React Router DOM, Tailwind CSS.
- **Backend Layer:** Node.js, Express.js.
- **Database Layer:** MongoDB Atlas (Mongoose ODM).
- **Real-time Layer:** Socket.io (for chat and notifications).
- **Intelligence Layer:** Google Generative AI / Groq API (Chatbot, summarization, conversational history).
- **Document Processing Pipeline:** Tesseract.js (OCR), PDF-Parse, PDF-Poppler, PDFKit (for diploma/CV verification and parsing).

---

## 2. Functional Requirements
The platform exposes several modules tailored to Patients, Psychologists, and Administrators.

### 2.1 Core User Management & Authentication
- **Role-Based Access Control (RBAC):** Distinct interfaces and permissions for `patient`, `psychologist`, and `admin`.
- **JWT Authentication:** Secure token-based access with encrypted passwords (bcryptjs).
- **Psychologist Onboarding Pipeline:** Verification workflow requiring professionals to submit identity and educational documents. Includes automated OCR checks and administrative approval processes.

### 2.2 Patient Capabilities
- **Geospatial Search:** Interactive map mapping (via `react-leaflet`) allowing patients to discover psychologists by location.
- **Appointment Scheduling:** Integration with `react-big-calendar` to book sessions, create session tickets, and handle confirmation states.
- **Secure Sessions:** Patients use an isolated Chatbot environment (scoping history strictly to the authenticated user ID) to perform pre-intake assessments.
- **Multi-language Support:** i18n (`react-i18next`) supporting English, French, and Arabic (with RTL responsiveness).
- **Session Ratings & History:** Tracking of past consultations and ability to leave post-session reviews.

### 2.3 Psychologist Capabilities
- **Professional Dashboard:** Statistical overviews of patient sessions, upcoming appointments, and financial/rating summaries.
- **Patient Detail Management:** View patient histories, AI chatbot summaries, and clinical notes.
- **Calendar Management:** Set availability and confirm/reschedule incoming patient requests.

### 2.4 Communication & Real-time Features
- **Real-time Chatting:** Peer-to-peer texting via Socket.io channels for live patient-psychologist interaction.
- **Voice Capabilities:** Text-to-speech and Speech-to-text endpoints available within chat/bot interactions.
- **Notifications Engine:** Websocket-driven alert system for appointment updates, new messages, and administrative actions.

---

## 3. Non-Functional Requirements (NFR)

### 3.1 Security & Data Privacy
- **HIPAA/GDPR alignment (Targeted):**
  - All textual history (Chatbot arrays, conversation strings) isolated strictly by user context in API scopes.
  - Express security middle-wares deployed:
    - **Helmet:** Sets secure HTTP headers.
    - **Express-Mongo-Sanitize:** Prevent NoSQL injection attacks.
    - **XSS-Clean:** Guards against cross-site scripting (XSS).
    - **Express-Rate-Limit:** Prevents DoS/DDoS attacks by limiting incoming request frequency.
- **Secure Environment Variables:** Critical secrets (JWT signs, API keys, DB URIs) stored off-repository in `.env`.

### 3.2 Scalability & Performance
- **Microservice-Ready Architecture:** The backend features highly modularized routes (`auth`, `calendar`, `message`, `voice`, `verification`, etc.), facilitating easier refactoring into independent microservices if traffic demands it.
- **Stateless APIs:** JWT implementations keep the backend functionally stateless, allowing easier horizontal scaling of Node instances.
- **Asynchronous Operations:** Non-blocking IO for heavy processes like OCR data extraction and generative AI network requests.

### 3.3 Internationalization (i18n) & Accessibility
- **Full Localization:** Frontend UI is fully tokenized using translation JSONs for seamless transitions across languages without hard reloads.
- **RTL Standards:** Right-to-Left styling dynamically triggered via Tailwind direction utilities when Arabic is selected.

### 3.4 Maintainability
- **Standardized Folder Structures:** Enforced separation of concerns (Controllers, Models, Routes, Middlewares).
- **Code Quality Guardrails:** ESLint and standardized PostCSS configurations.

---

## 4. Logical Workflow Example (Patient Intake)
1. **Discovery:** Patient logs in, searches for a nearby psychologist via the Leaflet-powered directory filter.
2. **AI Screening:** Prior to requesting the session, the user speaks to the integrated AssistantBot to log symptoms in a private, sandboxed context.
3. **Drafting Request:** Patient sends the session request to the targeted psychologist.
4. **Acceptance:** Psychologist receives a real-time web-socket notification, reviews the AI-generated sentiment summary of the patient, and confirms the calendar event.
5. **Execution:** Patient executes payment/verify loops and attends the session via the internal real-time communication modules.

---

*This document is iterative and should be updated whenever significant macro-architectural changes are made to the codebase infrastructure or business logic flow.*
