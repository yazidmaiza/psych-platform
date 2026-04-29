const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');

// Skills
const NormalizeDarijaText = require('../skills/NormalizeDarijaText');
const ExtractVectorEmbedding = require('../skills/ExtractVectorEmbedding');
const RetrievePsychologicalContext = require('../skills/RetrievePsychologicalContext');
const EnrichDarijaVocabulary = require('../skills/EnrichDarijaVocabulary');
const RetrieveKnowledgeChunks = require('../skills/RetrieveKnowledgeChunks');
const LoadIntakeProtocol = require('../skills/LoadIntakeProtocol');
const AdvanceIntakeStage = require('../skills/AdvanceIntakeStage');
const GenerateIntakeResponse = require('../skills/GenerateEmpatheticResponse');
const PersistIntakeTurn = require('../skills/PersistIntakeTurn');
const AnalyzeRiskBehavior = require('../skills/AnalyzeRiskBehavior');
const AnalyzeManipulation = require('../skills/AnalyzeManipulation');
const LoadPersonaConfig = require('../skills/LoadPersonaConfig');
const BuildPersonaInstructions = require('../skills/BuildPersonaInstructions');

// Services
const RiskAlertService = require('../services/RiskAlertService');

// Models
const ChatbotMessage = require('../models/ChatbotMessage');
const IntakeSession = require('../models/IntakeSession');

/**
 * Workflow Route: RAG-Powered Intake Chat Pipeline
 * Endpoint: POST /api/chat
 */
router.post('/', protect, async (req, res) => {
  try {
    const { message } = req.body;
    const userId = req.user.id;

    if (!message) {
      return res.status(400).json({ status: 'error', message: 'Message is required' });
    }

    // ── Step 1: Load Intake Protocol & Session State ─────────────────────
    const { session, stageConfig } = await LoadIntakeProtocol.execute(userId);

    // ── Step 2, 3 & Persona: Risk, Manipulation and Persona load (parallel) ──
    const [riskPayload, manipulationPayload, personaConfig] = await Promise.all([
      AnalyzeRiskBehavior.execute(message, userId, session),
      AnalyzeManipulation.execute(message, userId),
      LoadPersonaConfig.execute(userId)
    ]);

    // Build persona instruction string (safe default if none configured)
    // isFirstTurn = true when the patient has no prior messages in this session
    const conversationCount = await ChatbotMessage.countDocuments({ userId });
    const isFirstTurn = conversationCount === 0;
    const personaInstructions = BuildPersonaInstructions.execute(personaConfig, isFirstTurn);

    let alertTriggered = false;
    // Override Flow if HIGH RISK (Trigger alert but let LLM generate the dynamic safety response)
    if (riskPayload && riskPayload.risk_level === 'HIGH') {
      await RiskAlertService.trigger({
        patientId: userId,
        intakeSessionId: session._id,
        risk: riskPayload
      });
      alertTriggered = true;
    }

    // ── Step 4: Advance Stage if Turn Limit Reached ──────────────────────
    const { session: updatedSession, stageConfig: activeStageConfig } =
      await AdvanceIntakeStage.execute(session, stageConfig);

    // ── Step 5: Retrieve RAG Context (Darija + LangChain PDF Chunks) ─────
    const normalizedMessage = NormalizeDarijaText.execute(message);
    const vector = await ExtractVectorEmbedding.execute(normalizedMessage);
    
    let darijaContext = await RetrievePsychologicalContext.execute(vector);
    if (!darijaContext) {
      darijaContext = await EnrichDarijaVocabulary.execute(normalizedMessage);
    }

    const pdfKnowledgeContext = await RetrieveKnowledgeChunks.execute(message);

    const combinedContext = `
=== DARIJA DIALECT CONTEXT ===
${darijaContext || 'None'}

=== CLINICAL KNOWLEDGE BASE (PDFs) ===
${pdfKnowledgeContext || 'None'}

=== MANIPULATION FLAG ===
${manipulationPayload ? 'Note: User may be testing boundaries or using emotional coercion. Maintain a firm, neutral, and highly professional therapeutic boundary.' : 'None'}
    `.trim();

    // ── Step 6: Fetch Recent Conversation History ────────────────────────
    const conversationHistory = await ChatbotMessage.find({ userId })
      .sort({ createdAt: -1 })
      .limit(8)
      .lean();
    conversationHistory.reverse();

    // ── Step 7: Generate Stage-Aware Intake Response ─────────────────────
    const currentRiskLevel = riskPayload?.risk_level || 'LOW';
    const reply = await GenerateIntakeResponse.execute(
      message,
      combinedContext,
      activeStageConfig,
      conversationHistory,
      currentRiskLevel,
      personaInstructions
    );

    // ── Step 8: Persist Turn & Store Response ─────────────────────────────
    await PersistIntakeTurn.execute({
      userId,
      userMessage: message,
      assistantReply: reply,
      intakeStage: updatedSession.currentStage,
      session: updatedSession
    });

    res.json({
      reply,
      stage: updatedSession.currentStage,
      stageName: activeStageConfig?.nameEn || '',
      isComplete: updatedSession.isComplete,
      ...(alertTriggered && { alertTriggered: true })
    });

  } catch (error) {
    console.error('[Chat Workflow] Error:', error.message);
    res.status(500).json({ status: 'error', message: 'An internal AI processing error occurred.' });
  }
});

/**
 * GET /api/chat/init
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
