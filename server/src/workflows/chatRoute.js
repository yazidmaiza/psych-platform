const express = require('express');
const router  = express.Router();
const { protect } = require('../middleware/authMiddleware');
const Groq    = require('groq-sdk');
const { GoogleGenerativeAI } = require('@google/generative-ai');

// Shared retry utility (DRY — was duplicated here and in GenerateEmpatheticResponse.js)
const { withRetry, isTransientError } = require('../utils/withRetry');

// Audit logging
const auditService = require('../services/auditService');

// Skills
const NormalizeDarijaText          = require('../skills/NormalizeDarijaText');
const ExtractVectorEmbedding       = require('../skills/ExtractVectorEmbedding');
const RetrievePsychologicalContext = require('../skills/RetrievePsychologicalContext');
const EnrichDarijaVocabulary       = require('../skills/EnrichDarijaVocabulary');
const RetrieveKnowledgeChunks      = require('../skills/RetrieveKnowledgeChunks');
const LoadIntakeProtocol           = require('../skills/LoadIntakeProtocol');
const AdvanceIntakeStage           = require('../skills/AdvanceIntakeStage');
const GenerateIntakeResponse       = require('../skills/GenerateEmpatheticResponse');
const PersistIntakeTurn            = require('../skills/PersistIntakeTurn');
const AnalyzeRiskBehavior          = require('../skills/AnalyzeRiskBehavior');
const AnalyzeManipulation          = require('../skills/AnalyzeManipulation');
const LoadPersonaConfig            = require('../skills/LoadPersonaConfig');
const BuildPersonaInstructions     = require('../skills/BuildPersonaInstructions');
const GenerateHighRiskResponse     = require('../skills/GenerateHighRiskResponse');

// Services
const RiskAlertService = require('../services/RiskAlertService');

// Models
const ChatbotMessage = require('../models/ChatbotMessage');
const IntakeSession  = require('../models/IntakeSession');

// ─────────────────────────────────────────────────────────────────────────────
// Rolling Context Window
// ─────────────────────────────────────────────────────────────────────────────
const RECENT_TURN_LIMIT = 8;

async function compressWithGroq(compressionPrompt) {
  // [DATA: PHI — clinical intake context (may include mental health disclosures,
  // suicidal ideation, trauma). Sent to Groq Cloud API for compression.
  // Ensure a valid Groq Data Processing Agreement (DPA) is in place before
  // production use. See: https://groq.com/privacy-policy]
  if (!process.env.GROQ_API_KEY) throw new Error('GROQ_API_KEY not set');
  const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
  return withRetry(
    async () => {
      const completion = await groq.chat.completions.create({
        model: 'llama-3.3-70b-versatile',
        messages: [{ role: 'user', content: compressionPrompt }],
        max_tokens: 300,
        temperature: 0.2
      });
      const text = completion.choices?.[0]?.message?.content?.trim();
      if (!text) throw new Error('Groq returned empty compression response');
      return text;
    },
    { maxAttempts: 3, baseDelayMs: 1000, factor: 2 },
    'compressWithGroq'
  );
}

async function compressWithGemini(compressionPrompt) {
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (!apiKey) throw new Error('No Gemini API key available');
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: 'gemini-1.5-flash',
    generationConfig: { temperature: 0.2, maxOutputTokens: 300 }
  });
  return withRetry(
    async () => {
      const result = await model.generateContent(compressionPrompt);
      const text   = result.response?.text()?.trim();
      if (!text) throw new Error('Gemini returned empty compression response');
      return text;
    },
    { maxAttempts: 3, baseDelayMs: 1000, factor: 2 },
    'compressWithGemini'
  );
}

async function compressEarlyContext(userId, session) {
  try {
    const totalMessages = await ChatbotMessage.countDocuments({ userId });
    if (totalMessages <= RECENT_TURN_LIMIT) return;

    const olderTurns = await ChatbotMessage.find({ userId })
      .sort({ createdAt: 1 })
      .limit(totalMessages - RECENT_TURN_LIMIT)
      .lean();

    if (!olderTurns.length) return;

    const transcript = olderTurns
      .map(m => `${m.role === 'user' ? 'Patient' : 'Assistant'}: ${m.content}`)
      .join('\n');

    const compressionPrompt = `You are a clinical assistant summarizing an intake conversation.
Produce a concise clinical summary (4-6 sentences) of the following earlier exchanges.
Preserve ALL clinically significant disclosures: emotional state, risk indicators,
trauma history, relationship issues, substance use, any mention of self-harm or
suicidal ideation, and key themes raised by the patient.
Write in third person ("The patient reported…"). Be factual, not interpretive.

Earlier conversation:
${transcript}

Clinical summary:`;

    let summary = null;
    try {
      summary = await compressWithGroq(compressionPrompt);
      console.log(`[ContextWindow] Groq compressed ${olderTurns.length} older turns for user ${userId}`);
    } catch (groqErr) {
      console.warn('[ContextWindow] Groq failed, trying Gemini fallback:', groqErr.message);
      try {
        summary = await compressWithGemini(compressionPrompt);
        console.log(`[ContextWindow] Gemini compressed ${olderTurns.length} older turns for user ${userId}`);
      } catch (geminiErr) {
        console.error('[ContextWindow] Both providers failed (non-fatal):', geminiErr.message);
        return;
      }
    }

    if (!summary) return;

    await IntakeSession.findByIdAndUpdate(session._id, {
      contextSummary: summary,
      contextSummaryUpdatedAt: new Date()
    });
  } catch (err) {
    console.error('[ContextWindow] Unexpected compression error (non-fatal):', err.message);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Crisis Hold Threshold
// ─────────────────────────────────────────────────────────────────────────────
const CRISIS_HOLD_THRESHOLD = 2;

// ─────────────────────────────────────────────────────────────────────────────
// Main Chat Turn
// ─────────────────────────────────────────────────────────────────────────────

async function runChatTurn({ userId, message }) {
  if (!userId) throw new Error('runChatTurn requires a userId.');
  if (!message || !String(message).trim()) throw new Error('Message is required');

  // ── Step 1: Load Intake Protocol & Session State ─────────────────────
  const { session, stageConfig } = await LoadIntakeProtocol.execute(userId);

  // ── Step 1b: Respect existing crisis hold ────────────────────────────
  if (session.crisisHold) {
    const holdReply = await GenerateHighRiskResponse.executeEscalation(message);
    await PersistIntakeTurn.execute({
      userId,
      userMessage: message,
      assistantReply: holdReply,
      intakeStage: session.currentStage,
      session,
      skipStageCount: true
    });
    return {
      reply: holdReply,
      stage: session.currentStage,
      stageName: stageConfig?.nameEn || '',
      isComplete: session.isComplete,
      crisisHold: true
    };
  }

  // ── Step 2: Risk analysis ─────────────────────────────────────────────
  const preMutationRiskCount = session.consecutiveRiskCount || 0;
  const riskPayload = await AnalyzeRiskBehavior.execute(message, userId, session);

  if (riskPayload && riskPayload.risk_level === 'HIGH') {
    const prevCount      = preMutationRiskCount;
    const newCount       = prevCount + 1;
    const shouldEscalate = newCount >= CRISIS_HOLD_THRESHOLD;

    await IntakeSession.findByIdAndUpdate(session._id, {
      consecutiveRiskCount: newCount,
      lastRiskCategory: riskPayload.risk_category || 'HIGH',
      lastRiskAt: new Date(),
      ...(shouldEscalate && { crisisHold: true })
    });

    if (shouldEscalate) {
      // Non-blocking audit log — crisis hold activation
      auditService.audit(null, {
        action: 'CRISIS_HOLD_ACTIVATED',
        targetType: 'IntakeSession',
        targetId: String(session._id),
        outcome: 'success',
        severity: 'warn',
        message: `Crisis hold activated for user ${userId} after ${newCount} consecutive HIGH risk messages.`,
        metadata: { userId, consecutiveRiskCount: newCount, riskCategory: riskPayload.risk_category }
      }).catch(() => {});
    }

    let highRiskReply;
    if (shouldEscalate) {
      highRiskReply = await GenerateHighRiskResponse.executeEscalation(message);
      console.warn(`[CrisisHold] User ${userId} placed on crisis hold after ${newCount} consecutive HIGH risk messages.`);
    } else {
      highRiskReply = await GenerateHighRiskResponse.execute(message);
    }

    await RiskAlertService.trigger({
      patientId: userId,
      intakeSessionId: session._id,
      risk: riskPayload,
      ...(shouldEscalate && { urgency: 'CRITICAL' })
    });

    await PersistIntakeTurn.execute({
      userId,
      userMessage: message,
      assistantReply: highRiskReply,
      intakeStage: session.currentStage,
      session,
      skipStageCount: true
    });

    compressEarlyContext(userId, session).catch(() => {});

    return {
      reply: highRiskReply,
      stage: session.currentStage,
      stageName: stageConfig?.nameEn || '',
      isComplete: session.isComplete,
      crisisHold: shouldEscalate,
      alertTriggered: true
    };
  }

  // ── Non-HIGH turn: reset consecutive risk counter ─────────────────────
  if ((session.consecutiveRiskCount || 0) > 0) {
    await IntakeSession.findByIdAndUpdate(session._id, { consecutiveRiskCount: 0 });
  }

  // ── Step 3: Persona + manipulation analysis (parallel) ───────────────
  const [manipulationPayload, personaConfig] = await Promise.all([
    AnalyzeManipulation.execute(message, userId),
    LoadPersonaConfig.execute(userId)
  ]);

  const conversationCount   = await ChatbotMessage.countDocuments({ userId });
  const isFirstTurn         = conversationCount === 0;
  const personaInstructions = BuildPersonaInstructions.execute(personaConfig, isFirstTurn);

  // ── Step 4: Soft Stage Transition ────────────────────────────────────
  //
  // AdvanceIntakeStage now returns a two-phase soft transition:
  //
  //   shouldWarn       → patient is 1 turn away from stage end.
  //                      warningMessage is prepended to the LLM reply.
  //                      Stage does NOT advance yet.
  //
  //   shouldTransition → patient has hit the turn limit.
  //                      transitionMessage is prepended to the LLM reply.
  //                      Stage advances AFTER this message is delivered —
  //                      the patient finishes their current thought first.
  //
  // Both flags are mutually exclusive. Neither interrupts mid-thought:
  // the LLM still generates a contextual reply to the current message,
  // and the transition note is woven in as a natural prefix.
  //
  const {
    session:        updatedSession,
    stageConfig:    activeStageConfig,
    shouldWarn,
    shouldTransition,
    warningMessage,
    transitionMessage
  } = await AdvanceIntakeStage.execute(session, stageConfig);

  // ── Step 5: RAG Context ───────────────────────────────────────────────
  const normalizedMessage = NormalizeDarijaText.execute(message);
  const vector            = await ExtractVectorEmbedding.execute(normalizedMessage);

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
${manipulationPayload
    ? 'Note: User may be testing boundaries or using emotional coercion. Maintain a firm, neutral, and highly professional therapeutic boundary.'
    : 'None'}
  `.trim();

  // ── Step 6: Fetch Recent Conversation History (rolling window) ────────
  const recentHistory = await ChatbotMessage.find({ userId })
    .sort({ createdAt: -1 })
    .limit(RECENT_TURN_LIMIT)
    .lean();
  recentHistory.reverse();

  const contextSummary = updatedSession.contextSummary || null;

  // ── Step 7: Generate Stage-Aware Intake Response ─────────────────────
  const currentRiskLevel = riskPayload?.risk_level || 'LOW';
  const sessionContext = { usedIds: new Set(updatedSession.usedExampleIds || []) };
  let reply = await GenerateIntakeResponse.execute(
    message,
    combinedContext,
    activeStageConfig,
    recentHistory,
    currentRiskLevel,
    personaInstructions,
    contextSummary,
    sessionContext
  );

  // Persist the used example IDs back to the session
  updatedSession.usedExampleIds = Array.from(sessionContext.usedIds);
  await updatedSession.save();

  // ── Step 7b: Prepend soft transition note if needed ──────────────────
  //
  // The transition/warning message is prepended to (not replacing) the
  // LLM reply so the patient gets both:
  //   - Acknowledgment that they're moving on (natural, warm)
  //   - A proper response to what they just said
  //
  // A blank line separates the two so they read as one flowing message,
  // not two abrupt paragraphs.
  //
  if (shouldTransition && transitionMessage) {
    reply = `${transitionMessage}\n\n${reply}`;
  } else if (shouldWarn && warningMessage) {
    reply = `${warningMessage}\n\n${reply}`;
  }

  // ── Step 8: Persist Turn ──────────────────────────────────────────────
  await PersistIntakeTurn.execute({
    userId,
    userMessage: message,
    assistantReply: reply,
    intakeStage: updatedSession.currentStage,
    session: updatedSession
  });

  // ── Step 9: Compress Early Context (non-blocking) ─────────────────────
  compressEarlyContext(userId, updatedSession).catch(() => {});

  return {
    reply,
    stage:           updatedSession.currentStage,
    stageName:       activeStageConfig?.nameEn || '',
    stageSubtitle:   activeStageConfig?.subtitleEn || '',   // ← for progress indicator
    isComplete:      updatedSession.isComplete,
    crisisHold:      false,
    stageTransition: shouldTransition || false              // ← Chatbot.jsx animates on true
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Routes
// ─────────────────────────────────────────────────────────────────────────────

router.post('/', protect, async (req, res) => {
  try {
    const result = await runChatTurn({ userId: req.user.id, message: req.body.message });
    res.json(result);
  } catch (error) {
    console.error('[Chat Workflow] Error:', error.message);
    if (error.statusCode) {
      return res.status(error.statusCode).json({ status: 'error', message: error.message });
    }
    if (error.message === 'Message is required') {
      return res.status(400).json({ status: 'error', message: error.message });
    }
    res.status(500).json({ status: 'error', message: 'An internal AI processing error occurred.' });
  }
});

router.get('/init', protect, async (req, res) => {
  try {
    const userId = req.user.id;
    const { session, stageConfig } = await LoadIntakeProtocol.execute(userId);

    // Audit: patient loaded/resumed their intake session
    auditService.audit(req, {
      action: 'SESSION_START',
      targetType: 'IntakeSession',
      targetId: String(session._id),
      outcome: 'success',
      severity: 'info',
      message: `Patient ${userId} loaded intake session at stage ${session.currentStage}.`,
      metadata: { stage: session.currentStage, crisisHold: session.crisisHold || false }
    }).catch(() => {});

    res.json({
      stage:           session.currentStage,
      stageName:       stageConfig?.nameEn || '',
      stageSubtitle:   stageConfig?.subtitleEn || '',       // ← for progress indicator
      isComplete:      session.isComplete,
      crisisHold:      session.crisisHold || false,
      openingQuestion:   stageConfig?.openingQuestionEn || "Tell me what's on your mind today.",
      openingQuestionAr: stageConfig?.openingQuestionAr || '',
      openingQuestionFr: stageConfig?.openingQuestionFr || ''
    });
  } catch (error) {
    console.error('[Chat Init] Error:', error.message);
    if (error.statusCode) {
      return res.status(error.statusCode).json({ status: 'error', message: error.message });
    }
    res.status(500).json({ status: 'error', message: 'Failed to load intake protocol.' });
  }
});

module.exports = router;
module.exports.runChatTurn = runChatTurn;