const RiskAnalysisServer = require('../mcp/RiskAnalysisServer');
const ChatbotMessage = require('../models/ChatbotMessage');

const RISK_COOLDOWN_MS = 24 * 60 * 60 * 1000;

/**
 * Skill: AnalyzeRiskBehavior
 * Purpose: Classifies a patient message for behavioral risk signals and returns a normalized payload.
 *          HIGH risk is surfaced immediately so the response pipeline can bypass the LLM.
 */
class AnalyzeRiskBehavior {
  /**
   * @param {string} message - Patient's raw message
   * @param {string} userId - For fetching recent context
   * @param {Object} session - IntakeSession document (mutated in place + saved)
   * @returns {Promise<Object|null>} Risk payload if HIGH risk confirmed, else null
   */
  async execute(message, userId, session) {
    if (!message || !session) return null;

    try {
      const now = Date.now();
      const lastRiskAt = session.lastRiskAt ? new Date(session.lastRiskAt).getTime() : 0;
      const riskIsStale = lastRiskAt && now - lastRiskAt >= RISK_COOLDOWN_MS;

      if (riskIsStale) {
        session.consecutiveRiskCount = 0;
        session.lastRiskCategory = null;
        session.lastRiskAt = null;
        await session.save();
      }

      const lower = String(message || '').toLowerCase();

      const explicitPhrases = [
        'i might hurt myself',
        "i'm going to hurt myself",
        'i am going to hurt myself',
        'i want to die',
        'i want to kill myself',
        'i will kill myself',
        'i will hurt myself',
        "i'm going to hurt you",
        'i am going to hurt you',
        'i will hurt you',
        'i want to hurt you',
        'i will kill you',
        'je veux mourir',
        'je veux me tuer',
        'je vais me tuer',
        "j'ai envie de mourir",
        'je vais faire du mal',
        'je veux faire du mal',
        'je vais te tuer',
        'je vais te faire du mal',
        'نحب نموت',
        'نحب نقتل روحي',
        'نضربك',
        'نقتلك',
        'إلا ما تساعدنيش',
        'إلا ما تعاوننيش'
      ];

      const isExplicit = explicitPhrases.some((phrase) => lower.includes(phrase));
      if (isExplicit) {
        const payload = this._buildImmediateHighRiskPayload(message, lower);
        session.consecutiveRiskCount = 1;
        session.lastRiskCategory = payload.category;
        session.lastRiskAt = new Date();
        await session.save();
        return payload;
      }

      // Build a short context snippet from the last 3 messages
      const cutoff = new Date(now - RISK_COOLDOWN_MS);
      const recentMessages = await ChatbotMessage.find({
        userId,
        createdAt: { $gte: cutoff }
      })
        .sort({ createdAt: -1 })
        .limit(6)
        .lean();

      const contextSnippet = recentMessages
        .reverse()
        .map(m => `${m.role === 'user' ? 'PATIENT' : 'BOT'}: ${m.content}`)
        .join('\n');

      // Run the LLM classifier
      const classification = await RiskAnalysisServer.classify(message, contextSnippet);
      const payload = this._normalizePayload(classification, message);

      session.consecutiveRiskCount = payload.risk_level === 'HIGH' ? 1 : 0;
      session.lastRiskCategory = payload.category;
      session.lastRiskAt = payload.risk_level === 'HIGH' ? new Date() : session.lastRiskAt;
      await session.save();

      return payload;
    } catch (error) {
      console.error('AnalyzeRiskBehavior - Error:', error.message);
      return null; // Never crash the pipeline
    }
  }

  _normalizePayload(classification, message) {
    const riskLevel = String(classification?.risk_level || classification?.riskLevel || 'LOW').toUpperCase();
    return {
      risk_level: ['LOW', 'MEDIUM', 'HIGH'].includes(riskLevel) ? riskLevel : 'LOW',
      category: String(classification?.category || 'crisis_escalation').toLowerCase(),
      score: Math.max(0, Math.min(100, Number(classification?.score ?? classification?.riskScore ?? 0) || 0)),
      severity: String(classification?.severity || (riskLevel === 'HIGH' ? 'critical' : riskLevel === 'MEDIUM' ? 'medium' : 'low')).toLowerCase(),
      confidence: Math.max(0, Math.min(1, Number(classification?.confidence) || 0)),
      signals_detected: Array.isArray(classification?.signals_detected) ? classification.signals_detected : [],
      urgency: classification?.urgency || (riskLevel === 'HIGH' ? 'immediate' : riskLevel === 'MEDIUM' ? 'soon' : 'none'),
      reasoning: String(classification?.reasoning || '').trim(),
      recommended_action: String(classification?.recommended_action || '').trim(),
      triggerMessage: message
    };
  }

  _buildImmediateHighRiskPayload(message, lower = '') {
    const category = this._inferImmediateCategory(lower);

    return {
      risk_level: 'HIGH',
      category,
      score: 99,
      severity: 'critical',
      confidence: 1,
      signals_detected: ['explicit_high_risk_phrase'],
      urgency: 'immediate',
      reasoning: 'An explicit self-harm or violence phrase was detected.',
      recommended_action: 'Use the safety protocol immediately and check whether the user is safe right now.',
      triggerMessage: message
    };
  }

  _inferImmediateCategory(lower) {
    const selfHarmMarkers = [
      'myself',
      'die',
      'kill myself',
      'hurt myself',
      'mourir',
      'me tuer',
      'نموت',
      'روحي'
    ];

    if (selfHarmMarkers.some((marker) => lower.includes(marker))) {
      return 'suicidal_ideation';
    }

    const abuseMarkers = ['abuse', 'assault', 'rape', 'violence', 'عنف', 'اعتداء'];
    if (abuseMarkers.some((marker) => lower.includes(marker))) {
      return 'abuse_trauma';
    }

    return 'crisis_escalation';
  }
}

module.exports = new AnalyzeRiskBehavior();
