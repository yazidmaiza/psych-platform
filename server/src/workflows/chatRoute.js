const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');

// MCP Servers
const MongoVectorDBServer = require('../mcp/MongoVectorDBServer');

// Skills
const NormalizeDarijaText = require('../skills/NormalizeDarijaText');
const ExtractVectorEmbedding = require('../skills/ExtractVectorEmbedding');
const RetrievePsychologicalContext = require('../skills/RetrievePsychologicalContext');
const EnrichDarijaVocabulary = require('../skills/EnrichDarijaVocabulary');
const LoadIntakeProtocol = require('../skills/LoadIntakeProtocol');
const AdvanceIntakeStage = require('../skills/AdvanceIntakeStage');
const GenerateIntakeResponse = require('../skills/GenerateEmpatheticResponse');
const PersistIntakeTurn = require('../skills/PersistIntakeTurn');
const AnalyzeRiskBehavior = require('../skills/AnalyzeRiskBehavior');

// Services
const RiskAlertService = require('../services/RiskAlertService');

// Models
const ChatbotMessage = require('../models/ChatbotMessage');

/**
 * Workflow Route: RAG-Powered Intake Chat Pipeline
 * Endpoint: POST /api/chat
 * Auth: Required (protect middleware)
 */
router.post('/', protect, async (req, res) => {
  try {
    const { message } = req.body;
    const userId = req.user.id;

    if (!message) {
      return res.status(400).json({ status: 'error', message: 'Message is required' });
    }

    // ── Step 1: Normalize Input ──────────────────────────────────────────
    const normalizedMessage = NormalizeDarijaText.execute(message);

    // ── Step 2: Generate Vector Embedding ────────────────────────────────
    const vector = await ExtractVectorEmbedding.execute(normalizedMessage);

    // ── Step 3: Retrieve Darija Context from Vector DB ───────────────────
    let context = await RetrievePsychologicalContext.execute(vector);

    // Dynamic Enrichment: learn unknown dialect expressions
    if (!context) {
      console.log('[Chat Workflow] Unknown context — triggering Dynamic Enrichment...');
      context = await EnrichDarijaVocabulary.execute(normalizedMessage);
    }

    // ── Step 4: Load Intake Protocol & Session State ─────────────────────
    const { session, stageConfig } = await LoadIntakeProtocol.execute(userId);

    // ── Step 5: Advance Stage if Turn Limit Reached ──────────────────────
    const { session: updatedSession, stageConfig: activeStageConfig } =
      await AdvanceIntakeStage.execute(session, stageConfig);

    // ── Step 6: Fetch Recent Conversation History (last 8 turns) ─────────
    const conversationHistory = await ChatbotMessage.find({ userId })
      .sort({ createdAt: -1 })
      .limit(8)
      .lean();
    conversationHistory.reverse();

    // ── Step 7: Generate Stage-Aware Intake Response ─────────────────────
    const reply = await GenerateIntakeResponse.execute(
      message,
      context,
      activeStageConfig,
      conversationHistory
    );

    // ── Step 8: Persist Turn & Update Stage Turn Count ────────────────────
    await PersistIntakeTurn.execute({
      userId,
      userMessage: message,
      assistantReply: reply,
      intakeStage: updatedSession.currentStage,
      session: updatedSession
    });

    // ── Step 9: Send Reply to Client Immediately ──────────────────────────
    res.json({
      reply,
      stage: updatedSession.currentStage,
      stageName: activeStageConfig?.nameEn || '',
      isComplete: updatedSession.isComplete
    });

    // ── Step 10: Risk Analysis (async, non-blocking — zero latency impact) ─
    setImmediate(async () => {
      try {
        // Re-fetch session to get latest state (step 8 may have mutated it)
        const freshSession = await require('../models/IntakeSession').findById(updatedSession._id);
        if (!freshSession) return;

        const riskPayload = await AnalyzeRiskBehavior.execute(message, userId, freshSession);

        if (riskPayload) {
          await RiskAlertService.trigger({
            patientId: userId,
            intakeSessionId: updatedSession._id,
            risk: riskPayload
          });
        }
      } catch (riskErr) {
        console.error('[Chat Workflow] Risk analysis error (non-fatal):', riskErr.message);
      }
    });

  } catch (error) {
    console.error('[Chat Workflow] Error:', error.message);
    res.status(500).json({ status: 'error', message: 'An internal AI processing error occurred.' });
  }
});

/**
 * GET /api/chat/init
 * Returns the opening question for Stage 1 (used to prime the chatbot UI on load).
 */
router.get('/init', protect, async (req, res) => {
  try {
    const userId = req.user.id;
    const { session, stageConfig } = await LoadIntakeProtocol.execute(userId);

    res.json({
      stage: session.currentStage,
      stageName: stageConfig?.nameEn || '',
      isComplete: session.isComplete,
      openingQuestion: stageConfig?.openingQuestionEn || "Tell me what's on your mind today.",
      openingQuestionAr: stageConfig?.openingQuestionAr || '',
      openingQuestionFr: stageConfig?.openingQuestionFr || ''
    });
  } catch (error) {
    console.error('[Chat Init] Error:', error.message);
    res.status(500).json({ status: 'error', message: 'Failed to load intake protocol.' });
  }
});

module.exports = router;
