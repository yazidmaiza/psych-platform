const RiskAnalysisServer = require('../mcp/RiskAnalysisServer');
const ChatbotMessage = require('../models/ChatbotMessage');

/**
 * Skill: AnalyzeRiskBehavior
 * Purpose: Classifies a patient message for behavioral risk signals using the LLM classifier.
 *          Enforces a 2-consecutive-signal threshold before returning a risk result.
 *          Updates the IntakeSession's consecutiveRiskCount accordingly.
 *
 * Risk category score thresholds:
 *   self_harm        >= 60
 *   suicidal_ideation >= 50
 *   abuse_trauma     >= 55
 *   crisis_escalation >= 65
 */

const THRESHOLDS = {
  self_harm: 60,
  suicidal_ideation: 50,
  abuse_trauma: 55,
  crisis_escalation: 65
};

const SEVERITY_MAP = (score) => {
  if (score >= 85) return 'critical';
  if (score >= 70) return 'high';
  if (score >= 55) return 'medium';
  return 'low';
};

class AnalyzeRiskBehavior {
  /**
   * @param {string} message - Patient's raw message
   * @param {string} userId - For fetching recent context
   * @param {Object} session - IntakeSession document (mutated in place + saved)
   * @returns {Promise<Object|null>} Risk payload if threshold crossed, else null
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
      const { category, score, reasoning } = classification;

      // Not a risk category or below threshold → reset counter
      if (category === 'safe' || !THRESHOLDS[category] || score < THRESHOLDS[category]) {
        session.consecutiveRiskCount = 0;
        session.lastRiskCategory = null;
        await session.save();
        return null;
      }

      // Risk detected above threshold — increment consecutive counter
      session.consecutiveRiskCount = (session.consecutiveRiskCount || 0) + 1;
      session.lastRiskCategory = category;
      await session.save();

      // Only trigger an alert after 2 consecutive flagged messages
      if (session.consecutiveRiskCount < 2) {
        console.log(`[AnalyzeRiskBehavior] Risk signal #${session.consecutiveRiskCount} for ${category} — waiting for confirmation.`);
        return null;
      }

      // Reset counter after alert is triggered
      session.consecutiveRiskCount = 0;
      await session.save();

      return {
        category,
        score,
        reasoning,
        severity: SEVERITY_MAP(score),
        triggerMessage: message
      };
    } catch (error) {
      console.error('AnalyzeRiskBehavior - Error:', error.message);
      return null; // Never crash the pipeline
    }
  }
}

module.exports = new AnalyzeRiskBehavior();
