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
const GenerateHighRiskResponse = require('../skills/GenerateHighRiskResponse');

// Services
const RiskAlertService = require('../services/RiskAlertService');

// Models
const ChatbotMessage = require('../models/ChatbotMessage');
const IntakeSession = require('../models/IntakeSession');

async function runChatTurn({ userId, message }) {
  if (!userId) {
    throw new Error('runChatTurn requires a userId.');
  }

  if (!message || !String(message).trim()) {
    throw new Error('Message is required');
  }

  // ── Step 1: Load Intake Protocol & Session State ─────────────────────
  const { session, stageConfig } = await LoadIntakeProtocol.execute(userId);

  // ── Step 2: Risk analysis happens before any prompt work ─────────────
  const riskPayload = await AnalyzeRiskBehavior.execute(message, userId, session);

  if (riskPayload && riskPayload.risk_level === 'HIGH') {
    const alertTriggered = await RiskAlertService.trigger({
      patientId: userId,
      intakeSessionId: session._id,
      risk: riskPayload
    });

    const highRiskReply = await GenerateHighRiskResponse.execute(message);

    await PersistIntakeTurn.execute({
      userId,
      userMessage: message,
      assistantReply: highRiskReply,
      intakeStage: session.currentStage,
      session
    });

    return {
      reply: highRiskReply,
      stage: session.currentStage,
      stageName: stageConfig?.nameEn || '',
      isComplete: session.isComplete,
      ...(alertTriggered && { alertTriggered: true })
    };
  }

  // ── Step 3: Load persona and manipulation context only for non-high turns ──
  const [manipulationPayload, personaConfig] = await Promise.all([
    AnalyzeManipulation.execute(message, userId),
    LoadPersonaConfig.execute(userId)
  ]);

  const conversationCount = await ChatbotMessage.countDocuments({ userId });
  const isFirstTurn = conversationCount === 0;
  const personaInstructions = BuildPersonaInstructions.execute(personaConfig, isFirstTurn);

  // ── Step 4: Advance Stage if Turn Limit Reached ──────────────────────
  const { session: updatedSession, stageConfig: activeStageConfig } =
    await AdvanceIntakeStage.execute(session, stageConfig);

  // ── Step 5: Retrieve RAG Context ─────────────────────────────────────
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

  return {
    reply,
    stage: updatedSession.currentStage,
    stageName: activeStageConfig?.nameEn || '',
    isComplete: updatedSession.isComplete
  };
}

/**
 * Workflow Route: RAG-Powered Intake Chat Pipeline
 * Endpoint: POST /api/chat
 */
router.post('/', protect, async (req, res) => {
  try {
    const result = await runChatTurn({ userId: req.user.id, message: req.body.message });
    res.json(result);

  } catch (error) {
    console.error('[Chat Workflow] Error:', error.message);
    if (error.message === 'Message is required') {
      return res.status(400).json({ status: 'error', message: error.message });
    }
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
module.exports.runChatTurn = runChatTurn;
