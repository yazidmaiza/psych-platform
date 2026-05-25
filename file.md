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

### 10. Chatbot Technical Deep Dive (PFE Focus)

10.1 Overview and Design Objectives

The chatbot subsystem is engineered as an assistive clinical intelligence layer that supports intake, longitudinal monitoring, and clinician briefing. It is explicitly designed to augment the clinician workflow (not to replace professional judgment) and prioritizes safety, transparency, and auditability. Primary goals:
- Collect structured clinical intake data through a stage-oriented conversational protocol.
- Provide empathetic, culturally-aware responses (Darija/Arabic/French/English) while enforcing safety constraints.
- Detect and escalate risk (self-harm, abuse, acute distress) using a hybrid rule + ML pipeline.
- Produce concise, explainable session summaries and emotional timelines to support clinician decision-making.

10.2 System Architecture and Runtime Pipeline

The chatbot is implemented as a set of modular microservices within the backend monorepo: a lightweight HTTP turn API, dedicated worker processes for heavy tasks (embedding, OCR, PDF parsing, summarization), an embedding/indexing service, and a policy & risk service. The runtime turn pipeline executed by `server/src/workflows/chatRoute.js` follows these stages:
1. Authentication & authorization: validate user identity and session permissions.
2. Session/load context: load `IntakeSession`, recent `ChatbotMessage` history, localized preferences, and active intake protocol.
3. Pre-processing: language & dialect normalization (Darija mapping), token-cleaning, and short-cache lookups.
4. Retrieval: query dialect lexicon and document RAG indices to assemble a bounded context (top-k chunks with provenance metadata).
5. Safety checks: run deterministic phrase detectors and an LLM-based risk classifier; short-circuit or escalate if immediate harm is detected.
6. Prompt construction: build a staged, persona-aware prompt that composes retrieved passages, recent turns, and constrained instructions.
7. Generation & post-filtering: execute LLM call(s) through a guarded service, post-process outputs, and apply policy filters.
8. Persistence & side-effects: store the turn (`ChatbotMessage`), update `IntakeSession` state, enqueue summarization/compression jobs if needed, and emit notifications/events.

Decoupling heavy tasks into workers (embedding, OCR, PDF ingestion, summarization) keeps the turn API low-latency and horizontally scalable.

10.3 Stage-Oriented Intake Protocol

Intake is modeled as a finite-state, stage-based protocol captured in `intake_protocol` documents. Each `IntakeSession` records `currentStage`, per-stage counters, soft timeouts, and risk counters. Transitions are implemented as soft policies that warn the user before moving stages, allow manual clinician overrides, and preserve partial responses as draft data. This design balances structured data capture with conversational naturalness.

10.4 Hybrid RAG and Dialect Adaptation

The retrieval layer combines two orthogonal channels:
- Dialect lexicon channel (Darija): a curated, growing vectorized lexicon for Tunisian dialect and Arabizi transliterations. Inputs are normalized using deterministic mapping rules before embedding. The lexicon supports fast lookups for cultural idioms and mapped clinical expressions.
- Document RAG channel: domain knowledge and patient documents (PDFs) are chunked, embedded, and stored in an index (Atlas Vector Search or FAISS/Milvus in production). Each chunk stores provenance metadata (source id, page, offset) to enable explicit citations in generated responses.

Retrieval is permission-aware: patient-specific documents are filtered by ownership and session-level consent before being included in the prompt.

10.5 Embeddings, Chunking and Indexing

- Chunking: PDFs and long texts are split using configurable chunk sizes (e.g., 700–1200 chars with overlaps) to balance context and retrieval precision.
- Embeddings: a stable embeddings model is used (provider-backed or open-source) and stored alongside chunk metadata. The system records model version and parameters for each embedding to support reproducibility and audits.
- Indexing: vector indices are periodically compacted and backed up. A text-index fallback is implemented for resilience (when vector services are offline).

10.6 Prompt Engineering, Persona and Explainability

Prompt templates are hierarchical and stage-aware. Templates explicitly require the model to cite sources and to mark any low-confidence claims. Personality/persona settings (tone, directiveness) are applied as surface-level modifiers; safety and escalation constraints are supremely prioritized and cannot be overridden by persona settings.

Explainability measures include:
- Returning the list of retrieved chunks used as context (with source references).
- Attaching a `confidence` field and note when the model's answer relied on low-confidence extractions.

10.7 Context Compression and Long-Horizon Memory

To support long conversations while bounding token usage, the system employs a two-tier memory strategy:
- Short-term memory: recent N turns preserved verbatim for immediate context (configurable N, default 8).
- Long-term memory: older turns are summarized via an LLM compression job into a structured `contextSummary` that preserves clinically salient facts, sentiment/emotion markers, and unresolved action items. Compression jobs are asynchronous and versioned.

10.8 Safety, Risk Detection and Escalation

Risk detection is hybrid:
- Deterministic detectors (regex, phrase lists) capture high-precision suicidal ideation or violent intent indicators for immediate escalation.
- An LLM-based classifier provides contextual risk scoring (LOW/MEDIUM/HIGH) with category labels and confidence. Classifier outputs are audited and versioned.

Escalation policy:
- Immediate termination + clinician notification for high-certainty crisis indicators.
- Escalation events create `risk_alert` notifications, persist an `AuditEvent`, and, when configured, surface a clinician-facing summary with timestamps and evidence snippets.

10.9 Emotional Analysis and Longitudinal Tracking

Emotional indicators are computed per turn using a combination of lexical sentiment analysis, prosodic signals (if voice is available), and LLM-derived emotion vectors. These are normalized into an `EmotionalIndicator` vector stored per turn and aggregated into a session-level emotional timeline used in clinician briefings and analytics.

10.10 Human-in-the-Loop Workflows and Active Learning

Summaries and emotion inferences are surfaced to clinicians with an explicit feedback mechanism. Psychologists can annotate summaries, correct emotion labels, and mark hallucinations. Corrections feed an active learning pipeline that:
- logs corrections as labeled examples,
- triggers periodic model re-indexing or calibration (manual review required),
- records provenance so that retraining or model updates remain auditable.

10.11 Data Models and API Contracts

Key models (abbreviated):
- `ChatbotMessage` {id, sessionId, role, content, lang, tokens, emotionalVector, createdAt}
- `IntakeSession` {id, userId, currentStage, riskCounters, contextSummary, status}
- `ChatbotSummary` {sessionId, summaryText, themes, dominantEmotion, confidence, createdAt}
- `PatientDocumentChunk` {docId, chunkText, embeddingRef, sourceMeta, createdAt}
- `AuditEvent` {actorId, action, targetRef, payloadSnapshot, createdAt}

API contracts expose typed JSON DTOs and always include minimal provenance metadata (model versions, retrieval ids, confidence scores). Endpoints include `/api/chatbot/turn`, `/api/chatbot/summary`, `/api/chatbot/feedback`, and document ingestion/query endpoints under `/api/documents`.

10.12 Evaluation, Metrics and Research Rigor

Evaluation is multi-dimensional:
- Retrieval metrics: Hit@k, MRR for RAG retrievals against a curated validation set.
- Generation groundedness: fraction of answers with correct citations and a hallucination score (manual or automated evaluation).
- Safety metrics: false negatives/false positives on crisis detection using a labeled safety test set.
- Usability metrics: completion rates across intake stages, drop-off points, and average time-to-complete.
- Clinical relevance: psychometric evaluation via clinician-rated summary quality (blind review) and inter-rater agreement.

Recommended experimental protocol for the PFE:
1. Construct held-out test sets for retrieval (document-query pairs) and safety (annotated crisis/non-crisis messages).
2. Report embedding model version, retrieval hyperparameters (k, similarity metric), and prompt templates.
3. Present ablation studies: with/without dialect lexicon, with/without compression, and different persona templates.

10.13 Deployment, Scaling and Observability

Deployment recommendations:
- Host turn API behind an autoscaling group with low-latency routing; use workers (queue consumers) for embedding, OCR and summarization.
- Use Redis-backed queues (BullMQ) and monitor queue depth, worker error rates, and task latencies.
- Scale vector index with a managed vector DB (Milvus/FAISS/Atlas Vector Search); shard or replicate as necessary.

Observability:
- Instrument latency per pipeline stage, LLM call durations, retrieval hit rates, and safety classifier metrics.
- Audit logs must be write-once and include model versions, decisions, and minimal contextual data necessary for post-hoc review.

10.14 Security, Privacy, and Compliance

- Consent: explicit user consent is recorded prior to ingesting clinical documents into RAG indices; consent status is checked at retrieval time.
- Data minimization: retain only necessary context for clinical utility; store PHI in encrypted storage and reduce prompt retention in logs.
- Access control: RBAC enforced for all endpoints; admin-level operations are logged and require justifications.
- Key management: secrets and model API keys are stored in a secrets manager; workers obtain short-lived credentials.

10.15 Ethical AI, Governance and Clinical Integration

The platform treats AI outputs as assistive. Governance measures:
- Model registry: record model/artifact id and version for every embedding/generation call.
- Human oversight: clinician validation required for any automated clinical decisioning; AI-only flags are advisory.
- Transparency: UI displays provenance and confidence, and provides an easy path for patients/clinicians to contest or correct outputs.

10.16 Limitations, Reproducibility and Future Work

Known limitations include dependency on embedding coverage, variable PDF extraction quality, and the need for larger, annotated datasets for safety evaluation. For reproducibility, the PFE should include:
- A snapshot of the evaluation dataset(s), retrieval queries, and scoring scripts.
- A versioned prompt and model registry entry describing exact prompts and model parameters used in experiments.

Future research directions:
- Formal evaluation of dialect handling (Darija) and cross-lingual retrieval effectiveness.
- Integrating lightweight on-device preprocessing for privacy-sensitive scenarios.
- Developing continuous evaluation pipelines to detect drift in retrieval and generation quality.

10.17 Practical Recommendations for the PFE Submission

- Include a compact experimental appendix with dataset descriptions, evaluation metrics, and selected prompts used in the defense.
- Provide exemplar anonymized transcripts showing intake progression, retrieved citations, and the final clinician-facing summary.
- Emphasize the human-in-the-loop design and ethical safeguards in both written chapters and the oral defense.

