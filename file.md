# Psych Platform - Project Overview

## 1. Project Purpose
Psych Platform is a full-stack digital mental health platform that connects patients and psychologists in a secure, multilingual environment. It combines appointment workflows, real-time communication, AI-assisted support, and clinical tooling into one integrated system.

The platform aims to:
- simplify psychologist discovery and booking,
- support secure and structured therapy interactions,
- assist professionals with summaries, insights, and clinical context,
- provide role-based experiences for patients, psychologists, and administrators.

## 2. Core Product Capabilities
### Patient-facing capabilities
- Search and discover psychologists with live backend data.
- Filter professionals by specialty, session fee, and distance.
- View public psychologist profiles with ratings, availability, and location map.
- Request and manage therapy sessions.
- Access session history and post-session rating flows.
- Receive notifications and participate in conversation threads.

### Psychologist-facing capabilities
- Dashboard for daily workflow and patient activity.
- Profile setup and profile editing.
- Calendar-based session management.
- Patient detail views with contextual insights.
- AI chatbot summary and feedback loops (including psychologist feedback fields).

### Admin-facing capabilities
- Administrative panel for operational oversight.
- Audit logs for traceability and governance.

## 3. Architecture Overview
The repository is structured as a mono-repo style workspace with separate frontend and backend applications.

### Frontend (`client/`)
- React single-page application.
- Role-aware routing using protected routes.
- Tailwind-style utility classes and custom CSS variables for unified theming.
- Internationalization support (English, French, Arabic).
- Interactive maps and geolocation experiences.

### Backend (`server/`)
- Node.js and Express API services.
- Controller/service architecture with route modules.
- Authentication, verification, and session-related business logic.
- Specialized modules for chatbot, notifications, and clinical workflow support.

### Shared operational assets
- `docs/` for architecture, release notes, API references, and project chapters.
- `models/` for face/vision model manifests.
- `scripts/` for setup and migration tasks.

## 4. Technologies Used
## Frontend stack
- React (component-based UI, hooks, routing).
- React Router (`react-router-dom`) for client-side navigation.
- React i18next (`react-i18next`) for multilingual UI text.
- React Leaflet (`react-leaflet`) + Leaflet for maps and location markers.
- CSS variable design system (defined in `client/src/index.css`).
- Glassmorphism-inspired reusable components (`GlassPanel`, themed controls).

## Backend stack
- Node.js runtime.
- Express.js for REST API endpoints.
- Modular controller/service patterns.
- Authentication and role-based access control flows.
- Logging and audit-oriented endpoints.

## Data and AI-adjacent components
- Chatbot summary generation and psychologist feedback submission flow.
- RAG and testing scripts in backend (`test-rag.js`, model listing scripts).
- Face-related model artifacts in `models/` and supporting scripts.

## Dev and tooling ecosystem
- npm workspaces by folder (`client/package.json`, `server/package.json`).
- PostCSS and Tailwind configuration in frontend.
- CRA-style frontend bootstrap conventions.
- Documentation set for architecture and release management.

## 5. Security and Access Model
The platform enforces role-based access boundaries:
- Public routes for discovery and profile viewing.
- Protected patient routes for booking/session workflows.
- Protected psychologist routes for clinical operations and patient management.
- Protected admin routes for governance and auditing.

Authentication state is handled on the client via token storage and guarded routes, while the backend validates roles for sensitive actions.

## 6. User Experience and Design Direction
The UI system emphasizes:
- clear readability with modern contrast and spacing,
- professional medical-adjacent visual tone,
- reusable visual primitives (cards, panels, badges, controls),
- responsive behavior across desktop and mobile,
- coherent interactions between list, profile, session, and dashboard surfaces.

## 7. Project Documentation Coverage
This repository includes extensive project documentation in `docs/`, including:
- API references,
- architecture descriptions,
- sprint notes and release reports,
- audit and workflow artifacts,
- academic/project report content.

## 8. Current Technical Direction
From the current implementation and project structure, the technical direction is focused on:
- replacing mock UI states with live backend integrations,
- improving UX quality and consistency across pages,
- strengthening clinician feedback loops for AI-supported features,
- preserving traceability and structured release documentation.

## 9. Summary
Psych Platform is a production-oriented mental health platform that unifies patient discovery, booking, psychologist operations, and AI-assisted clinical support in a role-secure, multilingual React + Node.js architecture.

## 10. Chatbot Technical Deep Dive (PFE Focus)

### 10.1 Design Goals
The chatbot is not a generic Q&A bot. It is designed as a structured pre-session intake assistant with four technical goals:
- collect clinically useful context through staged conversation,
- maintain empathetic and professional communication quality,
- detect risk early and escalate safely,
- generate structured summaries for psychologist review.

### 10.2 High-Level Runtime Architecture
The chat pipeline is implemented as an orchestrated workflow in `server/src/workflows/chatRoute.js`, where each turn passes through modular skills.

Pipeline overview for one user turn:
1. Validate access and load intake stage/session state.
2. Run risk analysis (rule-based + LLM classification).
3. Run manipulation analysis and persona resolution.
4. Compute stage warning/transition logic.
5. Build RAG context from two sources:
	 - Darija psychological lexicon vector retrieval.
	 - PDF knowledge retrieval from vector chunks.
6. Generate response with prompt hierarchy and guardrails.
7. Persist turn and update stage counters.
8. Compress older context asynchronously for long conversations.

### 10.3 Session and Stage-Oriented Intake Strategy
The chatbot uses a stage-based protocol (5 stages) stored in MongoDB (`intake_protocol` collection) and loaded through `IntakeProtocolServer`.

Key mechanism:
- `IntakeSession` tracks `currentStage`, per-stage turn counts, completion status, risk counters, and rolling context summary.
- `AdvanceIntakeStage` implements soft transitions:
	- warning one turn before stage limit,
	- transition when the limit is reached,
	- progression to the next stage without abruptly interrupting the patient.

This creates controlled data collection quality while preserving conversational naturalness.

### 10.4 Hybrid RAG Strategy
The chatbot uses a hybrid retrieval strategy composed of two distinct knowledge channels.

#### A) Darija semantic knowledge retrieval
Purpose: improve interpretation of Tunisian dialect and Arabizi expressions.

Technical flow:
1. Normalize message (`NormalizeDarijaText`) by mapping Arabizi patterns (for example `7 -> ح`, `9 -> ق`, `3 -> ع`).
2. Generate embedding with `ExtractVectorEmbedding` using `GeminiLLMServer.embedContent`.
3. Query MongoDB Atlas Vector Search (`darija_vector_index`, collection `darija_knowledge`).
4. Retrieve top candidates and convert them into structured context text.
5. If no relevant match is found, trigger auto-enrichment (`EnrichDarijaVocabulary`) to infer meaning and insert a new vectorized entry.

Important implementation detail:
- The darija retrieval path is optimized for lexical and dialect understanding, not only general clinical PDFs.

#### B) Document/PDF RAG retrieval
Purpose: inject evidence from curated clinical documents.

Ingestion and storage:
- `ingestKnowledge.js` ingests PDFs from `server/knowledge_base/`.
- Files are split with `RecursiveCharacterTextSplitter`.
- Chunks are embedded with Google Gemini embeddings (`text-embedding-004`).
- Stored in MongoDB collection `rag_chunks` using Atlas Vector Search index `vector_index`.

Query-time retrieval:
- `RetrieveKnowledgeChunks` runs similarity search with top-k retrieval (k=4).
- Retrieved chunks are injected into prompt context with source metadata.

### 10.5 Additional Document RAG Subsystem (Psychologist Uploads)
In parallel to global knowledge RAG, the platform includes patient-specific document RAG:
- upload endpoint accepts PDF files,
- text extraction via `pdf-parse`,
- chunking (default `DOC_CHUNK_SIZE=800`, overlap `DOC_CHUNK_OVERLAP=100`),
- embeddings with `text-embedding-004`,
- storage in `patient_doc_chunks`.

Retrieval strategy is resilient by design:
1. vector search if embeddings/index are available,
2. text-index search fallback,
3. regex fallback.

This guarantees graceful degradation even when vector infrastructure is missing.

### 10.6 Prompt Engineering Techniques
The response generator (`GenerateEmpatheticResponse.js`) applies multiple prompt-engineering techniques:

1. Hierarchical instruction design:
- strict response rules,
- safety and risk behavior constraints,
- persona style constraints,
- example-guided style adaptation.

2. Stage-aware prompting:
- stage name, goal, and probe suggestions are injected at each turn.

3. Retrieval-grounded context composition:
- darija context,
- PDF clinical context,
- manipulation flag notes,
- recent chat history,
- compressed early-session summary.

4. Active disclosure linking:
- when old context is compressed, stage-specific linking instructions force the model to connect earlier disclosures with current messages instead of re-asking.
erflow, the system uses a rolling context window:
- recent turns are kept verbatim (limit=8),
- older turns are compressed into a clinical summary (`contextSummary`) via LLM,
- compressed summary is reinjected in later prompts.

Fallback strategy:
- primary compression provider: Groq,
- fallback: Gemini,
- failure is non-fatal (chat still continues).

### 10.8 Safety, Risk, and Escalation Design
Risk analysis is implemented as a multi-layer defense:

1. Immediate phrase detector:
- direct self-harm / harm-to-others / coercion patterns trigger instant high-risk payload.

2. LLM risk classifier:
- `RiskAnalysisServer` classifies into LOW/MEDIUM/HIGH + category + confidence + urgency.

3. Stateful escalation policy:
- consecutive HIGH messages are tracked.
- when threshold is reached (`CRISIS_HOLD_THRESHOLD=2`), session enters `crisisHold`.

4. Operational escalation:
- generates risk alerts,
- creates notifications for psychologists,
- emits Socket.IO events (`risk_alert`, `crisis_alert`),
- supports urgent dashboard behavior.

This architecture couples AI classification with deterministic safety controls.

### 10.9 Manipulation and Boundary-Testing Detection
Separate analysis detects emotional coercion/boundary testing:
- classifier returns `is_manipulative`, type, confidence, and reasoning,
- if flagged, prompt context instructs the assistant to keep firm professional boundaries.

This prevents compliance with unsafe coercive language while preserving empathetic communication.

### 10.10 Persona-Conditioned Response Layer
The platform personalizes response style according to psychologist persona configuration:
- tone,
- reflection level,
- question style,
- directiveness,
- verbosity,
- pacing,
- preferred language,
- optional first-turn greeting.

Critical safety rule:
- persona controls style only,
- safety and risk protocols always override persona settings.

### 10.11 Reliability and Fault Tolerance
Reliability techniques implemented in code:
- shared exponential backoff retry utility (`withRetry`),
- transient error detection (429, 5xx, network timeouts),
- provider fallback chains (Gemini <-> Groq in specific steps),
- non-fatal handling for optional enrichment/critique paths.

The system is engineered to degrade gracefully rather than fail hard.

### 10.12 Human-in-the-Loop Quality Control
Summary generation is not fully autonomous. It includes review loops:

1. Primary summary pass:
- outputs dominant emotion, urgency score, sentiment trend, key themes, and raw summary.

2. Secondary critique pass:
- returns `confidenceScore` (1-5) and critique note.
- low-confidence summaries are flagged for psychologist verification.

3. Psychologist feedback loop:
- psychologists can submit rating, accuracy flag, corrected emotion/themes, and notes.

4. Knowledge gap analytics:
- repeated corrected emotions (>=3) trigger gap detection.
- auto-reseed updates embeddings for matching knowledge items.

This is a practical active-learning pattern for continuous improvement.

### 10.13 Data Models Used by Chatbot Stack
Main chatbot-related data structures:
- `ChatbotMessage`: role, content, intake stage, timestamps.
- `IntakeSession`: stage state, risk counters, crisis hold, context summary.
- `ChatbotSummary`: structured summary, recommendations, confidence, psychologist feedback.
- `ChatbotSummaryArchive`: preserves snapshots when conversation is reset.
- `EmotionalIndicator`: computed emotional score vectors per patient/session.
- `ChatbotReport`: generated PDF summary metadata and storage path.

RAG-related models:
- `PatientDocument`,
- `PatientDocumentChunk` (with optional embeddings and text index fallback support).

### 10.14 Chatbot and RAG Endpoints (Practical View)
Operational routes include:
- `/api/chatbot/chatbot` (main turn endpoint),
- `/api/chatbot/reset`, `/api/chatbot/chatbot/end`,
- `/api/chatbot/messages`, `/api/chatbot/summary`,
- summary feedback routes for psychologist/admin,
- knowledge gap analytics and manual reseed endpoints,
- patient data export/delete routes for rights handling.

Document RAG routes:
- `/api/documents/upload/:patientId`,
- `/api/documents/patient/:patientId`,
- `/api/documents/query/:id`.

### 10.15 Techniques You Can Explicitly Mention in PFE Defense
For your oral defense/report, you can frame the implementation as the combination of these techniques:
- Retrieval-Augmented Generation (hybrid dual-RAG: dialect knowledge + PDF knowledge).
- Semantic vector search with Atlas Vector Search.
- Dynamic prompt orchestration with stage-aware control.
- Context window compression for long-horizon conversational memory.
- Rule + LLM hybrid risk classification.
- Crisis-state machine with deterministic escalation threshold.
- Persona-conditioned generation under safety constraints.
- Human-in-the-loop correction and active knowledge refinement.

### 10.16 Current Limitations and Improvement Opportunities
Current constraints:
- retrieval quality depends on embedding coverage and index quality,
- PDF parsing robustness can vary by document type,
- retrieval currently has limited explicit citation ranking calibration,
- no formal offline benchmark metrics are yet documented.

Recommended PFE next steps:
1. Add offline RAG evaluation metrics (Hit@k, MRR, groundedness).
2. Add hallucination scoring and automated red-team tests.
3. Add multilingual retrieval evaluation for Darija/French/English mixtures.
4. Add per-stage quality KPIs (completion quality, drop-off, escalation precision).
5. Add continuous prompt/version registry for reproducibility.
5. Few-shot style guidance:
- dynamic examples are selected to guide tone and response structure.

### 10.7 Context Compression and Long-Conversation Memory
To avoid context loss and token ov
