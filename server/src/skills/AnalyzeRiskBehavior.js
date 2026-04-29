const RiskAnalysisServer = require('../mcp/RiskAnalysisServer');
const ChatbotMessage = require('../models/ChatbotMessage');

/**
 * Skill: AnalyzeRiskBehavior
 * Purpose: Classifies a patient message for behavioral risk signals using the LLM classifier.
 *          Enforces a 2-consecutive-signal threshold for HIGH risk before returning a payload.
 *          Updates the IntakeSession's consecutiveRiskCount accordingly.
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
      // Build a short context snippet from the last 3 messages
      const recentMessages = await ChatbotMessage.find({ userId })
        .sort({ createdAt: -1 })
        .limit(6)
        .lean();

      const contextSnippet = recentMessages
        .reverse()
        .map(m => `${m.role === 'user' ? 'PATIENT' : 'BOT'}: ${m.content}`)
        .join('\n');

      // Run the LLM classifier
      const classification = await RiskAnalysisServer.classify(message, contextSnippet);
      const { risk_level, confidence, signals_detected, urgency, recommended_action } = classification;

      // Not high risk → reset counter
      if (risk_level !== 'HIGH') {
        session.consecutiveRiskCount = 0;
        await session.save();
        return null;
      }

      // HIGH risk detected — increment consecutive counter
      session.consecutiveRiskCount = (session.consecutiveRiskCount || 0) + 1;
      await session.save();

      // Only trigger an alert after 2 consecutive flagged messages
      if (session.consecutiveRiskCount < 2) {
        console.log(`[AnalyzeRiskBehavior] HIGH Risk signal #${session.consecutiveRiskCount} — waiting for confirmation.`);
        return null;
      }

      // Reset counter after alert is triggered
      session.consecutiveRiskCount = 0;
      await session.save();

      return {
        risk_level,
        confidence,
        signals_detected,
        urgency,
        recommended_action,
        triggerMessage: message
      };
    } catch (error) {
      console.error('AnalyzeRiskBehavior - Error:', error.message);
      return null; // Never crash the pipeline
    }
  }
}

module.exports = new AnalyzeRiskBehavior();
