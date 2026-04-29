const ManipulationAnalysisServer = require('../mcp/ManipulationAnalysisServer');
const ChatbotMessage = require('../models/ChatbotMessage');
const IntakeSession = require('../models/IntakeSession'); // Assumed path

/**
 * Skill: AnalyzeManipulation
 * Purpose: Analyzes user input for manipulation/coercion.
 *          If detected, logs it internally and returns a flag to adjust chatbot tone.
 */
class AnalyzeManipulation {
  /**
   * @param {string} message - Patient's raw message
   * @param {string} userId - User ID
   * @returns {Promise<Object|null>} Payload if manipulative, else null
   */
  async execute(message, userId) {
    if (!message) return null;

    try {
      const recentMessages = await ChatbotMessage.find({ userId })
        .sort({ createdAt: -1 })
        .limit(6)
        .lean();

      const contextSnippet = recentMessages
        .reverse()
        .map(m => `${m.role === 'user' ? 'PATIENT' : 'BOT'}: ${m.content}`)
        .join('\n');

      const classification = await ManipulationAnalysisServer.classify(message, contextSnippet);

      if (!classification.is_manipulative) {
        return null;
      }

      console.log(`[AnalyzeManipulation] Manipulation detected (${classification.type}) for user ${userId}.`);

      // Log the event to a risk_logs collection or the session
      // Assuming a generic RiskLog model or updating the session
      
      return classification;
    } catch (error) {
      console.error('AnalyzeManipulation - Error:', error.message);
      return null;
    }
  }
}

module.exports = new AnalyzeManipulation();
