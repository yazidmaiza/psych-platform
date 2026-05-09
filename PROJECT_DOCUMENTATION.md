# Psych Platform - Complete Project Documentation

> **Version:** 1.0.0  
> **Last Updated:** May 3, 2026  
> **Status:** Active Development

---

## Table of Contents

1. [Project Overview](#project-overview)
2. [Technology Stack](#technology-stack)
3. [System Architecture](#system-architecture)
4. [Core Features](#core-features)
5. [Project Structure](#project-structure)
6. [Frontend (Client)](#frontend-client)
7. [Backend (Server)](#backend-server)
8. [Installation & Setup](#installation--setup)
9. [Running the Application](#running-the-application)
10. [API Architecture](#api-architecture)
11. [Security Architecture](#security-architecture)
12. [AI & ML Features](#ai--ml-features)
13. [Database Schema](#database-schema)
14. [Development Guidelines](#development-guidelines)
15. [Troubleshooting](#troubleshooting)

---

## Project Overview

**Psych Platform** is a comprehensive, AI-assisted psychological intake and therapy management platform designed to connect mental health professionals with patients. It bridges the gap between mental health services and digital accessibility by providing:

- **Secure Scheduling & Calendar Management** - For both patients and psychologists
- **Real-Time Communication** - WebSocket-based patient-therapist chat
- **AI-Powered Intake Assistant** - Darija-aware (Tunisian dialect) chatbot with RAG architecture
- **Clinical Documentation & Analytics** - Document management and therapy progress tracking
- **Multilingual Support** - English, French, and Arabic (with RTL support)
- **Enterprise-Grade Security** - HIPAA/GDPR-aligned data protection

### Target Users
- **Patients** - Mental health seekers finding therapists and managing sessions
- **Psychologists** - Licensed professionals managing patient schedules and notes
- **Administrators** - Platform oversight and verification workflows

---

## Technology Stack

### Frontend (React.js)

| Component | Technology | Version | Purpose |
|-----------|-----------|---------|---------|
| Framework | React | 19.2.4 | UI library & component system |
| Routing | React Router DOM | 7.13.1 | Client-side navigation |
| Styling | Tailwind CSS | 3.4.19 | Utility-first CSS framework |
| UI Components | React Big Calendar | 1.19.4 | Calendar scheduling interface |
| Mapping | React Leaflet | 5.0.0 | Interactive maps for finding psychologists |
| State/Fetching | Axios | 1.13.6 | HTTP client for API calls |
| Real-Time | Socket.io Client | 4.8.3 | WebSocket communication |
| i18n | i18next | 26.0.3 | Internationalization & localization |
| Markdown | react-markdown | 10.1.0 | Render markdown content |
| Testing | @testing-library/* | Latest | Unit & component testing |

### Backend (Node.js/Express)

| Component | Technology | Version | Purpose |
|-----------|-----------|---------|---------|
| Runtime | Node.js | LTS | Server runtime |
| Framework | Express.js | 5.2.1 | Web API framework |
| Database | MongoDB | Atlas | NoSQL document database |
| ODM | Mongoose | 9.2.4 | MongoDB object modeling |
| Auth | JWT + bcryptjs | 9.0.3, 2.4.3 | Authentication & encryption |
| Real-Time | Socket.io | 4.8.3 | WebSocket server |
| AI/LLM | @google/generative-ai | 0.24.1 | Google Gemini AI integration |
| AI/LLM | @langchain/* | 1.x | LangChain framework for RAG |
| Document Processing | tesseract.js | 7.0.0 | OCR for diploma/document verification |
| PDF Processing | pdf-parse, pdfkit | 1.1.4, 0.17.2 | PDF parsing & generation |
| Face Recognition | @vladmandic/face-api | 1.7.15 | Facial verification |
| Image Processing | sharp | 0.34.4 | Image optimization |
| Security | helmet, xss-clean | 8.1.0 | HTTP headers & XSS protection |
| Rate Limiting | express-rate-limit | 8.3.2 | DoS protection |
| NoSQL Injection | express-mongo-sanitize | 2.2.0 | NoSQL injection prevention |
| File Upload | multer | 2.1.1 | Multipart file handling |
| Email | nodemailer | 8.0.2 | Email service integration |
| Environment | dotenv | 16.4.5 | Environment variable management |
| Dev Server | nodemon | 3.1.14 | Development auto-reload |

---

## System Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                      CLIENT LAYER (React)                        │
├──────────────────────────────────────────────────────────────────┤
│  Auth  │  Dashboard  │  Chat  │  Calendar  │  Profile  │  Admin  │
└───────────────────────────┬──────────────────────────────────────┘
                            │
                   ┌────────▼────────┐
                   │   API Gateway   │
                   │   (Express.js)  │
                   └────────┬────────┘
                            │
        ┌───────────────────┼───────────────────┐
        │                   │                   │
    ┌───▼────┐         ┌────▼─────┐      ┌─────▼──────┐
    │  Auth  │         │ Scheduler│      │  ChatBot   │
    │ Routes │         │ Routes   │      │  Routes    │
    └────────┘         └──────────┘      └────────────┘
        │                   │                   │
        └───────────────────┼───────────────────┘
                            │
            ┌───────────────▼──────────────┐
            │    MongoDB Atlas Database    │
            │  (Vector Search Enabled)     │
            └──────────────────────────────┘
                            │
        ┌───────────────────┼───────────────────┐
        │                   │                   │
    ┌───▼─────┐        ┌────▼────┐       ┌─────▼─────┐
    │ Gemini  │        │ Groq    │       │  Socket   │
    │   API   │        │  API    │       │   Server  │
    └─────────┘        └─────────┘       └───────────┘
```

### Layered Architecture

1. **Presentation Layer (Frontend)**
   - React components organized by feature
   - Role-based UI (Patient, Psychologist, Admin)
   - Real-time updates via Socket.io

2. **API Layer (Express.js)**
   - RESTful endpoints for CRUD operations
   - WebSocket handlers for real-time chat
   - Request validation & sanitization

3. **Business Logic Layer**
   - Controllers - Handle request processing
   - Services - Encapsulate business logic
   - Middleware - Cross-cutting concerns (auth, logging)

4. **Data Access Layer**
   - Mongoose models & schemas
   - MongoDB queries
   - Vector database for RAG system

5. **External Integration Layer**
   - Google Generative AI (Gemini)
   - Groq API
   - Email service (Nodemailer)
   - Face recognition API

---

## Core Features

### 1. **User Management & Authentication**

- **Role-Based Access Control (RBAC)**
  - Patient, Psychologist, Admin roles
  - Route-level protection with JWT
  - Separate dashboards per role

- **Authentication Flow**
  - Email/password registration
  - Email verification via OTP
  - JWT token-based session management
  - Secure password hashing with bcryptjs

- **Psychologist Verification**
  - Document upload (diplomas, identity)
  - Automated OCR verification via Tesseract.js
  - Admin approval workflow

### 2. **Scheduling & Calendar Management**

- **Interactive Calendar** (React Big Calendar)
  - Psychologists set availability slots
  - Patients book appointments
  - Session confirmation & rescheduling
  - Visual conflict detection

- **Appointment States**
  - Pending, Confirmed, Completed, Cancelled
  - Automatic notifications on state changes

### 3. **Real-Time Communication**

- **WebSocket Chat** (Socket.io)
  - Patient-Psychologist messaging
  - Message history persistence
  - Typing indicators & read receipts
  - Room-based isolation per session

- **Notifications System**
  - New message alerts
  - Appointment reminders
  - System announcements
  - Push notifications ready

### 4. **AI-Powered Intake Assistant**

- **Darija-Aware Chatbot (RAG System)**
  - Understands Tunisian Darija dialect
  - Retrieval-Augmented Generation for contextual responses
  - Model Context Protocol (MCP) servers:
    - MongoDB Vector Database server
    - Gemini LLM server
  - Empathetic response generation
  - Psychological context retrieval

- **AI Skills** (Atomic operations)
  - Normalize Darija text
  - Extract vector embeddings
  - Retrieve psychological context
  - Generate empathetic responses
  - Enrich Darija vocabulary

### 5. **Document Management & Verification**

- **Upload & Processing**
  - Secure file uploads via Multer
  - OCR extraction (Tesseract.js)
  - PDF parsing (pdf-parse)
  - Document verification workflow

- **Diploma Verification**
  - Automated OCR for credentials
  - Admin review & approval
  - Secure document storage

### 6. **Analytics & Dashboard**

- **Patient Dashboard**
  - Session history with ratings
  - Emotional metrics visualization
  - Upcoming appointments
  - Progress tracking

- **Psychologist Dashboard**
  - Patient statistics
  - Session analytics
  - Revenue tracking
  - Workload overview

- **Admin Dashboard**
  - Platform statistics
  - Pending verifications
  - User management
  - Report generation

### 7. **Internationalization (i18n)**

- **Supported Languages**
  - English (en)
  - French (fr)
  - Arabic (ar) with RTL support

- **Implementation**
  - i18next for translations
  - Language detection (browser preference)
  - Dynamic language switching
  - Tailwind RTL utilities for Arabic

---

## Project Structure

```
psych-platform/
├── client/                          # React Frontend
│   ├── public/
│   │   ├── index.html
│   │   ├── manifest.json
│   │   └── robots.txt
│   ├── src/
│   │   ├── components/
│   │   │   ├── AssistantBot.jsx     # Main chatbot interface
│   │   │   ├── RiskAlertBanner.jsx  # Risk assessment display
│   │   │   ├── ProtectedRoute.jsx   # Route protection HOC
│   │   │   ├── auth/                # Auth components
│   │   │   ├── charts/              # Chart components
│   │   │   ├── dashboard/           # Dashboard components
│   │   │   ├── notifications/       # Notification components
│   │   │   ├── profile/             # Profile components
│   │   │   └── session/             # Session components
│   │   ├── pages/                   # Full page components
│   │   │   ├── HomePage.jsx         # Landing page
│   │   │   ├── Login.jsx            # Login page
│   │   │   ├── Register.jsx         # Registration page
│   │   │   ├── Dashboard.jsx        # User dashboard
│   │   │   ├── Chatbot.jsx          # Chatbot page
│   │   │   ├── Calendar.jsx         # Calendar page
│   │   │   ├── AdminPanel.jsx       # Admin interface
│   │   │   └── ... (other pages)
│   │   ├── services/
│   │   │   ├── api.js               # Axios API client
│   │   │   ├── auth.js              # Auth service
│   │   │   └── socket.js            # Socket.io setup
│   │   ├── hooks/
│   │   │   ├── useChatbotThread.js  # Chatbot state hook
│   │   │   └── usePsychologistThread.js # Psychologist state
│   │   ├── locales/
│   │   │   ├── en.json              # English translations
│   │   │   ├── fr.json              # French translations
│   │   │   └── ar.json              # Arabic translations
│   │   ├── App.js                   # Root component
│   │   ├── App.css                  # Global styles
│   │   ├── index.js                 # Entry point
│   │   ├── i18n.js                  # i18n configuration
│   │   └── index.css                # Global CSS
│   ├── package.json
│   ├── tailwind.config.js
│   ├── postcss.config.js
│   └── README.md
│
├── server/                          # Node.js/Express Backend
│   ├── src/
│   │   ├── index.js                 # Server entry point
│   │   ├── seedDataset.js           # Database seeding script
│   │   ├── seedIntakeProtocol.js    # Intake protocol seeding
│   │   ├── controllers/             # Request handlers
│   │   │   ├── authController.js
│   │   │   ├── chatbotController.js
│   │   │   ├── calendarController.js
│   │   │   ├── messageController.js
│   │   │   ├── documentController.js
│   │   │   ├── adminController.js
│   │   │   └── ... (other controllers)
│   │   ├── routes/                  # Express routes
│   │   │   ├── authRoutes.js
│   │   │   ├── chatbotRoutes.js
│   │   │   ├── calendarRoutes.js
│   │   │   ├── messageRoutes.js
│   │   │   ├── documentRoutes.js
│   │   │   ├── adminRoutes.js
│   │   │   └── ... (other routes)
│   │   ├── models/                  # Mongoose schemas
│   │   │   ├── User.js
│   │   │   ├── Appointment.js
│   │   │   ├── Message.js
│   │   │   ├── Document.js
│   │   │   ├── ChatThread.js
│   │   │   └── ... (other models)
│   │   ├── middleware/              # Express middleware
│   │   │   ├── auth.js              # JWT verification
│   │   │   ├── errorHandler.js      # Error handling
│   │   │   ├── validation.js        # Input validation
│   │   │   └── ... (other middleware)
│   │   ├── services/                # Business logic
│   │   │   ├── authService.js
│   │   │   ├── emailService.js
│   │   │   ├── documentService.js
│   │   │   └── ... (other services)
│   │   ├── mcp/                     # Model Context Protocol servers
│   │   │   ├── mongoVectorServer.js # MongoDB vector DB server
│   │   │   ├── geminiLLMServer.js   # Gemini LLM server
│   │   │   └── ... (other MCP servers)
│   │   ├── skills/                  # RAG system skills
│   │   │   ├── normalizeDarija.js
│   │   │   ├── extractEmbeddings.js
│   │   │   ├── retrieveContext.js
│   │   │   ├── generateResponse.js
│   │   │   └── ... (other skills)
│   │   ├── workflows/               # AI orchestration
│   │   │   ├── intakeWorkflow.js
│   │   │   └── ... (other workflows)
│   │   ├── utils/                   # Utility functions
│   │   │   ├── validators.js
│   │   │   ├── logger.js
│   │   │   └── ... (other utils)
│   │   ├── data/                    # Static data & seeds
│   │   │   ├── intakeProtocol.json
│   │   │   └── ... (other data)
│   │   └── knowledge_base/          # RAG knowledge base
│   ├── uploads/                     # User-uploaded files
│   ├── eng.traineddata              # Tesseract OCR model
│   ├── fra.traineddata              # French OCR model
│   ├── package.json
│   ├── test-high-risk.js            # Risk assessment test
│   └── README.md
│
├── models/                          # ML Model Files
│   ├── face_landmark_68_model-weights_manifest.json
│   ├── face_recognition_model-weights_manifest.json
│   ├── ssd_mobilenetv1_model-weights_manifest.json
│   └── ... (other models)
│
├── docs/                            # Documentation
│   ├── API.md                       # API reference
│   ├── SCHEMA.md                    # Database schema docs
│   ├── PROJECT_ARCHITECTURE.md      # Architecture guide
│   ├── CONVENTIONS.md               # Code conventions
│   ├── face-verification.md         # Face verification docs
│   ├── RELEASE_NOTES_*.md           # Release notes
│   ├── pfe/                         # PFE (Senior project) docs
│   │   ├── chapter1.md
│   │   ├── Sprint*.md
│   │   └── state_of_the_art.md
│   ├── Chapter_*.md                 # Research chapters
│   ├── Chapter_*.tex                # LaTeX versions
│   └── use_case_diagram.puml        # PlantUML diagrams
│
├── scripts/                         # Utility scripts
│   └── download-face-models.ps1     # Face model download
│
├── package.json                     # Root package.json
└── README.md                        # Project README
```

---

## Frontend (Client)

### Component Hierarchy

#### Core Pages
- **HomePage** - Landing/home screen
- **Login/Register** - Authentication pages
- **VerifyCode** - Email verification
- **Dashboard** - User-specific dashboards
- **Chatbot** - AI assistant interface
- **Calendar** - Appointment scheduling

#### Patient-Specific Pages
- **PsychologistList** - Browse therapists
- **PsychologistProfile** - View therapist details
- **CreateSession** - Book appointment
- **SessionPage** - Active session interface
- **Conversation** - Chat interface
- **MySessionHistory** - Past appointments
- **RateConsultation** - Session feedback
- **PaymentConfirm** - Payment processing
- **Notifications** - Alert center

#### Psychologist-Specific Pages
- **PsychologistSetup** - Profile setup
- **PatientDetail** - View patient info
- **PatientHistory** - Patient therapy history
- **EditProfile** - Update profile

#### Admin Pages
- **AdminPanel** - Admin dashboard

### Key Components

#### AssistantBot.jsx
- Main chatbot interface
- Message display & input
- RAG integration
- Darija dialect support

#### RiskAlertBanner.jsx
- Risk assessment display
- Warning levels (Low, Medium, High, Critical)
- Emergency contact information

#### ProtectedRoute.jsx
- Route authentication guard
- Role-based access control
- Token validation

### Hooks

#### useChatbotThread()
- Manages chatbot conversation state
- API communication
- Message persistence

#### usePsychologistThread()
- Manages psychologist-patient thread
- Real-time message sync
- Notification handling

### Services

#### api.js (Axios Instance)
```javascript
// Base configuration
- Base URL: http://localhost:5000
- Headers: Authorization token management
- Request/Response interceptors
```

#### socket.js
```javascript
// Socket.io configuration
- Server: http://localhost:5000
- Namespaces:
  - /messages - Patient-therapist chat
  - /notifications - Real-time alerts
  - /presence - User online status
```

#### auth.js
```javascript
// Auth service functions
- login(email, password)
- register(userData)
- verifyEmail(otp)
- logout()
- refreshToken()
```

---

## Backend (Server)

### Architecture Pattern

The backend follows an **MVC-inspired architecture** with clear separation of concerns:

```
Request → Middleware → Router → Controller → Service → Model → Response
```

### Controllers
Handle HTTP request/response cycle:
- Input validation
- Service invocation
- Response formatting
- Error handling

### Services
Encapsulate business logic:
- Database queries
- Third-party API calls
- Complex computations
- Data transformations

### Models
Define data schemas using Mongoose:
- User schema (roles, credentials)
- Appointment schema (scheduling)
- Message schema (chat history)
- Document schema (file management)
- ChatThread schema (intake conversations)

### Middleware Stack

1. **Security Middleware**
   - `helmet` - Secure HTTP headers
   - `xss-clean` - XSS attack prevention
   - `express-mongo-sanitize` - NoSQL injection prevention
   - CORS configuration

2. **Rate Limiting**
   - `express-rate-limit` for DoS protection
   - Per-route custom limits

3. **Authentication**
   - JWT verification middleware
   - Role-based access control

4. **Logging & Monitoring**
   - Request logging
   - Error tracking

### API Routes

| Route Group | Purpose | Protected |
|------------|---------|-----------|
| `/auth` | Authentication (login, register, verify) | No |
| `/users` | User management | Yes |
| `/calendar` | Appointment scheduling | Yes |
| `/messages` | Chat history | Yes |
| `/chatbot` | AI assistant | Yes |
| `/documents` | Document upload/verification | Yes |
| `/admin` | Administrative functions | Yes (Admin only) |

---

## Installation & Setup

### Prerequisites

- **Node.js** (v18 or higher)
- **MongoDB Atlas** account with Vector Search enabled
- **Git** for version control
- **Environment configuration** file (`.env`)

### Required Environment Variables

Create a `.env` file in the server root:

```env
# Database
MONGODB_URI=mongodb+srv://user:password@cluster.mongodb.net/psychplatform

# JWT
JWT_SECRET=your_jwt_secret_key_here
JWT_EXPIRE=7d

# Google Gemini AI
GOOGLE_API_KEY=your_google_gemini_api_key

# Groq API (alternative LLM)
GROQ_API_KEY=your_groq_api_key

# Email Service
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your_email@gmail.com
EMAIL_PASSWORD=your_app_password

# Server Configuration
PORT=5000
NODE_ENV=development
CLIENT_URL=http://localhost:3000

# Face Recognition Models Path
MODELS_PATH=./models

# File Upload Limits
MAX_FILE_SIZE=10485760
UPLOAD_DIR=./uploads

# Rate Limiting
RATE_LIMIT_WINDOW=15
RATE_LIMIT_MAX_REQUESTS=100
```

### Step-by-Step Installation

1. **Clone the Repository**
   ```bash
   git clone <repository-url>
   cd psych-platform
   ```

2. **Install Server Dependencies**
   ```bash
   cd server
   npm install
   ```

3. **Install Client Dependencies**
   ```bash
   cd ../client
   npm install
   ```

4. **Download Face Recognition Models**
   ```bash
   cd ../scripts
   .\download-face-models.ps1  # Windows
   # or
   bash download-face-models.sh  # Linux/Mac
   ```

5. **Initialize Database**
   ```bash
   cd ../server
   npm run seed  # Seed initial data
   ```

---

## Running the Application

### Development Mode

#### Terminal 1 - Start Backend Server
```bash
cd server
npm run dev
```
- Server runs on `http://localhost:5000`
- Auto-restarts on file changes (nodemon)

#### Terminal 2 - Start Frontend Server
```bash
cd client
npm start
```
- Client runs on `http://localhost:3000`
- Auto-reloads on file changes (React Scripts)

### Production Build

#### Build Frontend
```bash
cd client
npm run build
```
- Creates optimized build in `client/build/`

#### Run Production Server
```bash
cd server
NODE_ENV=production npm start
```

### Docker Setup (Optional)

```bash
# Build containers
docker-compose up --build

# Containers start on:
# Frontend: http://localhost:3000
# Backend: http://localhost:5000
```

---

## API Architecture

### Authentication Endpoints

```
POST /auth/register
- Register new user (patient/psychologist)
- Body: { email, password, role, name, phone }
- Response: { user, token }

POST /auth/login
- Authenticate user
- Body: { email, password }
- Response: { user, token }

POST /auth/verify-email
- Verify email with OTP
- Body: { email, otp }
- Response: { success, message }

POST /auth/refresh-token
- Refresh JWT token
- Response: { token }

GET /auth/profile
- Get current user profile
- Headers: { Authorization: Bearer <token> }
- Response: { user }
```

### Calendar Endpoints

```
GET /calendar/availability/:psychologistId
- Get psychologist available slots
- Query: { month, year }
- Response: [{ date, slots: [...] }]

POST /calendar/book
- Create appointment
- Body: { psychologistId, date, time, reason }
- Response: { appointment }

PUT /calendar/appointment/:appointmentId
- Update appointment status
- Body: { status }
- Response: { appointment }

GET /calendar/my-appointments
- Get user's appointments
- Response: [{ appointment }]
```

### Chatbot Endpoints

```
POST /chatbot/message
- Send message to AI chatbot
- Body: { threadId, message, userId }
- Response: { response, threadId }

GET /chatbot/thread/:threadId
- Get conversation history
- Response: [{ message, response, timestamp }]

POST /chatbot/risk-assessment
- Get risk level assessment
- Body: { threadId }
- Response: { riskLevel, recommendations }
```

### Message Endpoints

```
POST /messages/send
- Send message (WebSocket alternative)
- Body: { recipientId, message }
- Response: { messageId, timestamp }

GET /messages/conversation/:userId
- Get message history with user
- Query: { limit, skip }
- Response: [{ message }]

PUT /messages/:messageId/read
- Mark message as read
- Response: { success }
```

### Document Endpoints

```
POST /documents/upload
- Upload document (diploma, ID, etc.)
- Multipart FormData: { file, type, userId }
- Response: { document, extractedText }

GET /documents/:documentId
- Get document details
- Response: { document, ocrResult }

PUT /documents/:documentId/verify
- Verify document (admin only)
- Body: { verified, notes }
- Response: { document }
```

### WebSocket Events

#### Chat Namespace: `/messages`
```javascript
// Client → Server
socket.emit('message:send', { 
  roomId, 
  message, 
  senderId 
})

// Server → Client
socket.on('message:received', { 
  message, 
  senderId, 
  timestamp 
})
socket.on('message:typing', { 
  userId, 
  typing 
})
```

#### Notifications Namespace: `/notifications`
```javascript
socket.on('notification:new', {
  type, // 'appointment', 'message', 'system'
  data,
  timestamp
})
```

---

## Security Architecture

### Authentication & Authorization

1. **JWT Implementation**
   - Token-based stateless authentication
   - Tokens stored in secure HTTP-only cookies
   - 7-day expiration with refresh token rotation

2. **Password Security**
   - Bcryptjs hashing (salt rounds: 10)
   - Minimum 8 characters required
   - Special character validation

3. **Role-Based Access Control**
   - Middleware-level route protection
   - Three roles: patient, psychologist, admin
   - Fine-grained permission checks

### Data Protection

1. **Encryption in Transit**
   - HTTPS/TLS (enforced in production)
   - Secure WebSocket (WSS)

2. **Encryption at Rest**
   - Sensitive fields encrypted in MongoDB
   - Document files encrypted on upload

3. **Data Isolation**
   - User data strictly scoped to authenticated user ID
   - Session history isolated by threadId
   - No cross-user data leakage

### Security Middleware

```javascript
// Helmet - Secure HTTP headers
app.use(helmet());

// CORS - Cross-Origin restrictions
app.use(cors({
  origin: process.env.CLIENT_URL,
  credentials: true
}));

// Rate Limiting
app.use(rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100
}));

// NoSQL Injection Prevention
app.use(mongoSanitize());

// XSS Protection
app.use(xss());
```

### Compliance

- **HIPAA Alignment**: Secure data handling for health information
- **GDPR Compliance**: User data rights and deletion mechanisms
- **PII Protection**: Sensitive data encryption and access controls

---

## AI & ML Features

### Retrieval-Augmented Generation (RAG) System

The platform's AI assistant uses a sophisticated RAG architecture with final micro-optimizations for natural, direct, and human-like conversation:

#### Components

1. **Vector Database**
  - MongoDB with Vector Search
  - Embedding models for semantic search
  - Knowledge base: Psychological resources, Darija context

2. **Language Model**
  - Google Generative AI (Gemini)
  - Groq API as alternative
  - Fine-tuned for psychological context

3. **MCP Servers**
  - **mongoVectorServer.js** - Manages vector embeddings & retrieval
  - **geminiLLMServer.js** - Handles LLM inference

#### RAG Skills (Atomic Operations)

1. **Normalize Darija Text**
  - Convert colloquial Darija to standard form
  - Handle dialect variations
  - Maintain semantic meaning

2. **Extract Vector Embeddings**
  - Convert text to vector representations
  - Use embedding models for semantic understanding
  - Store embeddings for retrieval

3. **Retrieve Psychological Context**
  - Semantic search from knowledge base
  - Find similar past cases
  - Extract relevant therapeutic approaches

4. **Generate Empathetic, Human-Like Response**
  - Strictly mirrors user language for acknowledgment (e.g., "something’s not okay for you")
  - Short, direct questions (never multi-clause)
  - Minimal structure: 1 short acknowledgment, 1 short question
  - Avoids generic or scripted phrasing—feels like a real person listening
  - Uses LLM with psychological context
  - Maintains therapeutic and culturally sensitive tone (Darija speakers)

5. **Enrich Darija Vocabulary**
  - Expand dialect understanding
  - Learn new expressions
  - Improve response quality

### Face Recognition & Verification

- **Model**: @vladmandic/face-api
- **Purpose**: Psychologist verification, session authentication
- **Flow**:
  1. Capture face image
  2. Detect facial landmarks (68 points)
  3. Extract face embeddings
  4. Compare with stored reference
  5. Confidence threshold verification

### Document Processing

#### OCR Pipeline (Tesseract.js)
1. Image preprocessing
2. Text extraction (English & French)
3. Field detection (diploma info, ID)
4. Verification validation

#### PDF Processing
1. Parse PDF structure
2. Extract text & images
3. Generate verification documents
4. Store in secure location

---

## Database Schema

### User Model
```javascript
{
  _id: ObjectId,
  email: String (unique),
  password: String (hashed),
  role: Enum ['patient', 'psychologist', 'admin'],
  profile: {
    firstName: String,
    lastName: String,
    phone: String,
    profileImage: String (URL),
    bio: String,
    location: {
      type: Point,
      coordinates: [longitude, latitude]
    }
  },
  psychologistDetails: {
    // Only if role === 'psychologist'
    license: String,
    specialties: [String],
    experience: Number,
    hourlyRate: Number,
    verified: Boolean,
    documents: [DocumentId]
  },
  isEmailVerified: Boolean,
  createdAt: Date,
  updatedAt: Date
}
```

### Appointment Model
```javascript
{
  _id: ObjectId,
  patientId: ObjectId (ref: User),
  psychologistId: ObjectId (ref: User),
  status: Enum ['pending', 'confirmed', 'completed', 'cancelled'],
  date: Date,
  time: String,
  duration: Number (minutes),
  reason: String,
  notes: String,
  rating: Number (1-5),
  feedback: String,
  createdAt: Date,
  updatedAt: Date
}
```

### Message Model
```javascript
{
  _id: ObjectId,
  senderId: ObjectId (ref: User),
  recipientId: ObjectId (ref: User),
  appointmentId: ObjectId (ref: Appointment),
  content: String,
  attachments: [String (URLs)],
  isRead: Boolean,
  readAt: Date,
  createdAt: Date
}
```

### ChatThread Model (AI Chatbot)
```javascript
{
  _id: ObjectId,
  userId: ObjectId (ref: User),
  messages: [{
    role: Enum ['user', 'assistant'],
    content: String,
    timestamp: Date
  }],
  riskAssessment: {
    level: Enum ['low', 'medium', 'high', 'critical'],
    factors: [String],
    recommendations: [String],
    updatedAt: Date
  },
  vectorEmbeddings: [Number[]],
  createdAt: Date,
  updatedAt: Date
}
```

### Document Model
```javascript
{
  _id: ObjectId,
  userId: ObjectId (ref: User),
  type: Enum ['diploma', 'license', 'id', 'other'],
  filename: String,
  fileUrl: String,
  ocrResult: {
    rawText: String,
    extractedFields: Object,
    confidence: Number
  },
  verified: Boolean,
  verifiedBy: ObjectId (ref: User),
  verificationDate: Date,
  createdAt: Date
}
```

---

## Development Guidelines

### Code Style & Conventions

1. **Naming Conventions**
   - Components: PascalCase (e.g., `UserProfile.jsx`)
   - Functions/Variables: camelCase (e.g., `getUserData()`)
   - Constants: UPPER_SNAKE_CASE (e.g., `MAX_FILE_SIZE`)
   - Database Models: PascalCase (e.g., `User.js`)

2. **File Organization**
   - One component per file
   - Keep files under 300 lines
   - Related components in directories
   - Services exported as named exports

3. **React Best Practices**
   - Use functional components with hooks
   - Custom hooks for shared logic
   - Props validation with PropTypes or TypeScript
   - Memoization for expensive computations

4. **Express Best Practices**
   - Route handlers under 30 lines (delegate to services)
   - Consistent error handling
   - Input validation before processing
   - Async/await over callbacks

### Git Workflow

```bash
# Create feature branch
git checkout -b feature/feature-name

# Commit with meaningful messages
git commit -m "feat: Add user authentication"

# Push to remote
git push origin feature/feature-name

# Create pull request for review
```

### Testing

#### Frontend Testing
```bash
cd client
npm test  # Run test suite
npm run coverage  # Generate coverage report
```

#### Backend Testing
```bash
cd server
npm test  # Run test suite
```

### Database Migrations

For MongoDB schema updates:

1. Create migration file in `/server/migrations/`
2. Test locally with database backup
3. Document changes in release notes
4. Run migration on production

### API Documentation

When adding new endpoints:
1. Document in `/docs/API.md`
2. Include request/response examples
3. Note authentication requirements
4. List error codes and meanings

---

## Troubleshooting

### Common Issues & Solutions

#### 1. **MongoDB Connection Error**
```
Error: connect ECONNREFUSED
```
**Solution:**
- Verify MongoDB URI in `.env`
- Check MongoDB Atlas cluster is running
- Verify IP whitelist includes your IP
- Test connection: `mongosh "mongodb+srv://..."`

#### 2. **CORS Errors**
```
Access to XMLHttpRequest blocked by CORS policy
```
**Solution:**
- Verify `CLIENT_URL` in server `.env`
- Check CORS middleware configuration
- Ensure credentials flag is set correctly

#### 3. **JWT Token Invalid**
```
Error: JsonWebTokenError: invalid token
```
**Solution:**
- Verify `JWT_SECRET` matches between sessions
- Check token expiration
- Clear browser cookies and re-login
- Verify Authorization header format: `Bearer <token>`

#### 4. **File Upload Failed**
```
Error: File too large
```
**Solution:**
- Check file size limit: `MAX_FILE_SIZE`
- Verify multer configuration
- Ensure `/uploads` directory exists and has write permissions

#### 5. **Socket.io Connection Failed**
```
WebSocket is closed before the connection is established
```
**Solution:**
- Verify Socket.io server is running
- Check firewall/proxy blocking WebSockets
- Verify client socket connection URL
- Check browser console for network errors

#### 6. **Face Recognition Failing**
```
Error: Models not loaded
```
**Solution:**
- Download models: `.\scripts\download-face-models.ps1`
- Verify `MODELS_PATH` in `.env`
- Check model files exist in models directory

#### 7. **Email Verification Not Working**
```
Error: Could not send email
```
**Solution:**
- Verify email credentials in `.env`
- Enable "Less Secure Apps" in Gmail (or use App Password)
- Check email service limits (Gmail: 500/day)
- Verify SMTP configuration

### Performance Optimization Tips

1. **Frontend**
   - Enable production build: `npm run build`
   - Use React DevTools Profiler to find bottlenecks
   - Implement code splitting with React.lazy()
   - Memoize expensive components with `React.memo()`

2. **Backend**
   - Enable MongoDB indexing on frequently queried fields
   - Use pagination for large datasets
   - Implement caching for vector embeddings
   - Use connection pooling for database

3. **General**
   - Enable gzip compression
   - Use CDN for static assets
   - Monitor API response times
   - Implement request logging & analysis

---

## Resources & References

- [React Documentation](https://react.dev)
- [Express.js Guide](https://expressjs.com)
- [MongoDB Documentation](https://docs.mongodb.com)
- [Socket.io Documentation](https://socket.io/docs)
- [Tailwind CSS Docs](https://tailwindcss.com)
- [LangChain Documentation](https://python.langchain.com)
- [Google Generative AI](https://ai.google.dev)

---

## Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create a feature branch
3. Commit changes with clear messages
4. Push to the branch
5. Create a pull request with detailed description

---

## License

This project is licensed under the ISC License.

---

## Support

For issues, questions, or suggestions:

1. Check existing documentation in `/docs`
2. Review GitHub issues
3. Contact the development team

---

**Last Updated:** May 3, 2026  
**Maintained by:** Psych Platform Development Team
