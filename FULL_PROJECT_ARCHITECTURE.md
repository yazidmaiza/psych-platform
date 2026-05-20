# Full Project Architecture

This document provides a comprehensive overview of the project's file hierarchy.

## Directory Structure

```text
psych-platform/
├── client/                     # React Frontend
│   ├── public/                 # Static assets for the web app
│   ├── src/                    # Source code
│   │   ├── assets/             # Images and static media
│   │   ├── components/         # Reusable UI components
│   │   │   ├── auth/           # Authentication UI (Login, Register shells)
│   │   │   ├── branding/       # Logo and theme components
│   │   │   ├── charts/         # Data visualization (AreaLineChart, StackedBar)
│   │   │   ├── conversation/   # Chat/Conversation components
│   │   │   ├── dashboard/      # Layout components for dashboards
│   │   │   ├── notifications/  # Notification handling UI
│   │   │   ├── profile/        # Psychologist profile editing/viewing
│   │   │   ├── session/        # Active session components (ChatBox, MessageBubble, TtsPlayer)
│   │   │   ├── AssistantBot.jsx
│   │   │   ├── ProtectedRoute.jsx
│   │   │   └── RiskAlertBanner.jsx
│   │   ├── context/            # React Contexts (ThemeContext)
│   │   ├── hooks/              # Custom React hooks (useChatbotThread, usePsychologistThread)
│   │   ├── locales/            # Internationalization (ar.json, en.json, fr.json)
│   │   ├── pages/              # Application pages/views
│   │   ├── services/           # Frontend services (api, auth, socket)
│   │   ├── App.js              # Root application component
│   │   ├── i18n.js             # i18next configuration
│   │   ├── index.js            # Entry point
│   │   └── ...
│   ├── package.json
│   ├── tailwind.config.js
│   └── README.md
├── server/                     # Node.js Backend
│   ├── knowledge_base/         # RAG source documents (PDFs on mental health)
│   ├── scripts/                # Backend maintenance scripts
│   ├── src/                    # Source code
│   │   ├── controllers/        # Request handlers (auth, chatbot, session, etc.)
│   │   ├── data/               # Static datasets (conversation examples)
│   │   ├── mcp/                # Model Context Protocol servers (LLM, VectorDB, RiskAnalysis)
│   │   ├── middleware/         # Express middleware (auth, validation, correlation)
│   │   ├── models/             # Mongoose models (User, Session, RiskAlert, etc.)
│   │   ├── routes/             # API route definitions
│   │   ├── services/           # Business logic (audit, face verification, notification)
│   │   ├── skills/             # Atomic agentic skills (AdvanceIntakeStage, AnalyzeRiskBehavior)
│   │   ├── utils/              # Helper functions (email, uploads)
│   │   ├── workflows/          # Orchestrated logic (chatRoute, ingestKnowledge)
│   │   └── index.js            # Entry point
│   ├── uploads/                # Dynamic file uploads
│   ├── .env                    # Environment variables (Sensitive)
│   ├── package.json
│   └── ...
├── docs/                       # Project Documentation
│   ├── latex/                  # LaTeX source for formal documentation
│   ├── pfe/                    # PFE (Projet de Fin d'Études) specific documents
│   ├── API.md                  # API reference
│   ├── PROJECT_ARCHITECTURE.md # High-level architecture overview
│   └── ...
├── models/                     # Pre-trained models (Face recognition/landmarks)
├── scripts/                    # General utility scripts
├── FULL_PROJECT_ARCHITECTURE.md# (This file)
├── PROJECT_DOCUMENTATION.md    # Master documentation
├── README.md                   # Quick start and project overview
└── package.json                # Root package configuration
```

## Directory Structure related to chatbot and intake system

psych-platform/
├── client/src/
│   ├── pages/
│   │   └── Chatbot.jsx                 # Main Chatbot interface page
│   ├── components/
│   │   ├── AssistantBot.jsx            # Floating/Integrated AI assistant component
│   │   ├── RiskAlertBanner.jsx         # UI for displaying real-time risk warnings
│   │   └── session/
│   │       ├── ChatBox.jsx             # Core messaging interface
│   │       ├── MessageBubble.jsx       # Chat message styling
│   │       └── TypingIndicator.jsx     # AI status feedback
│   └── hooks/
│       └── useChatbotThread.js         # Logic for managing chatbot state/history
│
├── server/src/
│   ├── controllers/
│   │   └── chatbotController.js        # Logic for chatbot API requests
│   ├── routes/
│   │   └── chatbotRoutes.js            # Chatbot API endpoints
│   ├── models/                         # Chatbot-specific data schemas
│   │   ├── ChatbotMessage.js           # Message history storage
│   │   ├── ChatbotReport.js            # Analysis reports from sessions
│   │   ├── ChatbotSummary.js           # Conversation summaries
│   │   ├── IntakeSession.js            # Tracking 5-stage intake protocol state
│   │   ├── PersonaConfig.js            # AI personality settings
│   │   ├── RiskAlert.js                # High-risk signal storage
│   │   └── EmotionalIndicator.js       # Behavioral analysis markers
│   │
│   ├── mcp/                            # Model Context Protocol Servers
│   │   ├── GeminiLLMServer.js          # Google Gemini integration
│   │   ├── IntakeProtocolServer.js     # Protocol enforcement logic
│   │   ├── ManipulationAnalysisServer.js # Detecting user manipulation
│   │   ├── MongoVectorDBServer.js      # Vector search for RAG
│   │   └── RiskAnalysisServer.js       # Psychological risk scoring
│   │
│   ├── skills/                         # Atomic AI Skills (Intake/AOS)
│   │   ├── AdvanceIntakeStage.js       # Protocol stage management
│   │   ├── AnalyzeRiskBehavior.js      # Risk detection logic
│   │   ├── EnrichDarijaVocabulary.js   # Dialect learning
│   │   ├── GenerateEmpatheticResponse.js# NLP Response generation
│   │   ├── NormalizeDarijaText.js      # Tunisian Darija preprocessing
│   │   ├── RetrieveKnowledgeChunks.js  # RAG retrieval logic
│   │   └── ... (and others)
│   │
│   └── workflows/                       # Orchestrated AI Logic
│       ├── chatRoute.js                # Main "Intake Agent" execution pipeline
│       └── ingestKnowledge.js          # RAG indexing workflow
│
└── server/knowledge_base/               # Source Material for RAG
    └── *.pdf                           # Clinical PDFs used by the chatbot


## Key Modules

### Frontend (client)
- **State Management**: Uses React Context and custom hooks for real-time chat and theme.
- **Styling**: Tailwind CSS for responsive and modern UI.
- **Real-time**: Socket.IO for live messaging and status updates.

### Backend (server)
- **Agentic AOS**: Built with an "Agent Operating System" architecture featuring:
  - **MCP Servers**: Interface with external systems (Gemini, MongoDB).
  - **Skills**: Atomic execution units for specific tasks (e.g., `NormalizeDarijaText`).
  - **Workflows**: Complex logic sequences (e.g., `chatRoute`).
- **Security**: Includes face verification, input sanitization, and audit logging.
- **RAG**: Retrieval-Augmented Generation using PDFs in `knowledge_base` and MongoDB Vector Search.

### Documentation (docs)
- Comprehensive documentation covering API specs, schema designs, and sprint progress.
