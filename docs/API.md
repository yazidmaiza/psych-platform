# API Contract
Psych Platform — Internal API Documentation
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