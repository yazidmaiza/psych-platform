# Psych Platform
> An Advanced AI-Assisted Psychological Intake & Therapy Platform

The Psych Platform is a comprehensive web application designed to bridge the gap between mental health professionals and patients. It provides secure scheduling, real-time communication, clinical management, and features a state-of-the-art **Darija-Aware AI Assistant** built on a Retrieval-Augmented Generation (RAG) architecture.

## 🚀 Key Features

### 👥 User Roles & Portals
- **Patients**: Find therapists, book sessions, upload intake documents, view session history, and track emotional indicators.
- **Psychologists**: Manage availability via an intuitive calendar, track patient histories, write private clinical notes, and review statistics.
- **Administrators**: Dedicated admin panel for platform oversight.

### 📅 Advanced Scheduling & Calendar
- Psychologists can configure and set their available time slots.
- Patients can dynamically book and split sessions.
- Interactive calendar interface integrated via `react-big-calendar`.

### 💬 Real-Time Communication
- Secure, real-time patient-therapist chat using WebSockets (`socket.io`).
- Notifications on new messages and upcoming appointments.

### 🤖 Darija-Aware AI Assistant (RAG System)
A sophisticated Agent Operating System designed to understand context and Tunisian Darija dialects.
- **Model Context Protocol (MCP)**: Custom MCP servers for MongoDB Vector Database and Gemini LLM.
- **Agent Skills**: Features atomic units of execution such as *Normalize Darija Text*, *Extract Vector Embeddings*, *Retrieve Psychological Context*, *Generate Empathetic Responses*, and *Enrich Darija Vocabulary*.
- **AI Chatbot**: Acts as a psychological intake assistant that provides culturally resonant and empathetic support.

### 📄 Clinical Documentation & Analytics
- **Document Management**: Secure patient document uploading with text extraction via `pdf-parse` and `tesseract.js`.
- **Dashboards**: Visualize emotional metrics, session statistics, and customized progress charts.

### 🛡️ Enterprise-Grade Security
Built with modern security best practices:
- **Authentication**: JWT-based auth with robust email verification flows.
- **Protection Measures**: HTTP headers (`helmet`), Rate Limiting (`express-rate-limit`), NoSQL injection protection (`express-mongo-sanitize`), and XSS cleaning (`xss-clean`).
- **Private verification uploads**: Psychologist ID card images and intro videos are stored under `server/private_uploads/` by default (override with `PRIVATE_UPLOADS_DIR`) and are only served via authenticated admin endpoints.

---

## 💻 Technology Stack

### Frontend (Client)
- **Framework**: React.js (v19)
- **Styling**: Tailwind CSS & Vanilla CSS
- **Routing**: React Router DOM
- **Internationalization**: `i18next`
- **Mapping**: React Leaflet
- **Data Fetching**: Axios

### Backend (Server)
- **Runtime**: Node.js
- **Framework**: Express.js
- **Database**: MongoDB Atlas (with Vector Search enabled)
- **AI/LLM**: Google Generative AI (Gemini) & Groq API
- **WebSockets**: Socket.io
- **Security**: bcryptjs, jsonwebtoken, cors, helmet

---

## 📂 Project Structure

- `/client` - Contains the React frontend application, components, pages, and hooks.
- `/server/src`
  - `/controllers` - API request handlers.
  - `/routes` - Express routing for API endpoints.
  - `/models` - Mongoose database schemas.
  - `/middleware` - Custom auth and security middlewares.
  - `/mcp` - Model Context Protocol servers.
  - `/skills` - Atomic RAG capabilities (Text normalization, Context retrieval, etc.).
  - `/workflows` - AI orchestration logic.
- `/docs` - Schema documentation, API contracts, and conventions.

---

## 🏃 Getting Started

### Prerequisites
- Node.js installed
- MongoDB URI
- Relevant API Keys (Gemini, Groq, etc.)

### Installation
1. Clone the repository.
2. Install server dependencies:
   ```bash
   cd server
   npm install
   ```
3. Install client dependencies:
   ```bash
   cd client
   npm install
   ```

### Running Locally
To spin up both the client and server environments simultaneously:

**Start Server:**
```bash
cd server
npm run dev
```

**Start Client:**
```bash
cd client
npm start
```
