# API Contract
Psych Platform - Internal API Documentation
Last updated: March 2026

## Base URL
http://localhost:5000/api

## Authentication
All protected routes require this header:
Authorization: Bearer <token>

---

## Auth Routes (Yazid)

### Register
POST /api/auth/register
Body: { email, password, role }
role: "patient" | "psychologist"
Response: { token, user: { id, email, role } }

### Login
POST /api/auth/login
Body: { email, password }
Response: { token, user: { id, email, role } }

---

## Session Routes (Yazid)

### Create Session
POST /api/sessions
Protected: yes
Body: { psychologistId, sessionType }
sessionType: "preparation" | "followup" | "free"
Response: { sessionId, status: "pending" }

### Confirm Payment
POST /api/sessions/:id/payment
Protected: yes
Body: {}
Response: { success: true }

### Verify Session Code
POST /api/sessions/:id/verify-code
Protected: yes
Body: { code }
Response: { success: true, sessionId }

---

## Chatbot Routes (Yazid)

### Send Message to Chatbot
POST /api/sessions/:id/chatbot
Protected: yes
Body: { message }
Response: { reply: string }

### Get Chatbot Summary
GET /api/sessions/:id/summary
Protected: yes
Response: { emotionalIndicators, keyThemes, rawSummary }

---

## Psychologist Routes (Anas)

### Get All Psychologists
GET /api/psychologists
Protected: no
Query params: ?specialization=&language=&city=
Response: [{ id, firstName, lastName, photo, specializations, languages, city }]

### Get Single Psychologist
GET /api/psychologists/:id
Protected: no
Response: { id, firstName, lastName, photo, bio, specializations, languages, availability, city }

### Update Psychologist Profile
PUT /api/psychologists/:id
Protected: yes
Body: { photo, bio, specializations, languages, availability }
Response: { success: true }

---

## Messaging Routes (Anas)

### Get Messages
GET /api/sessions/:id/messages
Protected: yes
Response: [{ senderId, content, sentAt, isRead }]

### Send Message
POST /api/sessions/:id/messages
Protected: yes
Body: { content }
Response: { id, senderId, content, sentAt }

---

## Dashboard Routes (Anas)

### Get Psychologist Patients
GET /api/dashboard/patients
Protected: yes
Response: [{ patientId, firstName, lastName, lastSession, status }]

### Get Patient Detail
GET /api/dashboard/patients/:patientId
Protected: yes
Response: { patient, sessions, summaries, notes }

### Add Private Note
POST /api/dashboard/patients/:patientId/notes
Protected: yes
Body: { content }
Response: { id, content, createdAt }

---

## Credential Documents (UC-03 / UC-04)

These endpoints implement secure credential document upload, versioning, and short-lived scoped access URLs.

### Upload Credential Document (single type)
POST /api/credential-documents/upload  
Protected: yes (role: psychologist)  
Content-Type: multipart/form-data  
Fields:
- `type`: `cv | diploma | idFront | idBack | introVideo`
- `file`: the uploaded file

Validation:
- CV/Diploma: PDF, max 10MB each
- ID images: JPG/JPEG/PNG, max 5MB each
- Intro video: MP4/WEBM/MOV, max 100MB

Response: `{ message, document }`

### Generate Short-Lived Access URL
GET /api/credential-documents/:id/access-url?ttlSeconds=300  
Protected: yes (role: psychologist (own docs only) or admin (all docs))  
Response: `{ url, expiresAt }` where `url` is a short-lived download link.

### Download via Signed Token
GET /api/credential-documents/download?token=...  
Protected: no (token is the authorization)  
Response: file stream

### List My Current Credential Documents
GET /api/credential-documents/my  
Protected: yes (role: psychologist)  
Response: `CredentialDocument[]` (current versions)

### Checklist Summary
GET /api/credential-documents/checklist  
Protected: yes (role: psychologist)  
Response: `{ profileStatus, checklist, allComplete }`

---

## Verification Routes (Psychologist onboarding)

### Submit Verification Bundle (CV + Diploma + ID + Intro Video)
POST /api/verification/upload  
Protected: yes (role: psychologist)  
Content-Type: multipart/form-data  
Fields: `cv`, `diploma`, `idFront`, `idBack`, `introVideo`

Notes:
- Stores documents in private storage and persists metadata in `CredentialDocument` (with version history).
- Sets `Psychologist.profileStatus = Submitted`.

### List Pending Verifications
GET /api/verification/pending  
Protected: yes (role: admin)  
Response: Psychologist profiles with populated `credentialDocs` refs.

### Approve / Reject
PUT /api/verification/:id/approve  
PUT /api/verification/:id/reject  
Protected: yes (role: admin)

---

## Onboarding (UC-05 / UC-06)

### View My Onboarding Status
GET /api/onboarding/me  
Protected: yes (role: psychologist)  
Response: `{ profileStatus, submittedAt, rejectedAt, rejectionReason, rejectionDetails, onboardingHistory, ... }`

### Submit / Resubmit Onboarding
POST /api/onboarding/submit  
Protected: yes (role: psychologist)  
Behavior:
- If `profileStatus=Draft`, performs completeness validation and transitions to `Submitted`.
- If `profileStatus=Rejected`, performs completeness validation and transitions back to `Submitted` (resubmission), preserving history.
On failure returns `{ missingFields, missingDocuments }`.
