const ChatbotMessage = require('../models/ChatbotMessage');
const IntakeSession = require('../models/IntakeSession');

/**
 * Skill: PersistIntakeTurn
 * Purpose: Saves the user message and AI reply to ChatbotMessage,
 *          then increments the stage turn counter in IntakeSession.
 */
class PersistIntakeTurn {
  /**
   * @param {Object} params
   * @param {string} params.userId
   * @param {string} params.userMessage - Raw patient message
   * @param {string} params.assistantReply - Generated AI response
   * @param {number} params.intakeStage - Current stage number (1–5)
   * @param {Object} params.session - IntakeSession mongoose document
   * @returns {Promise<void>}
   */
  async execute({ userId, userMessage, assistantReply, intakeStage, session }) {
    if (!userId || !userMessage || !assistantReply || !session) {
      throw new Error('PersistIntakeTurn requires userId, userMessage, assistantReply, and session.');
    }

    try {
      // Save both turns to ChatbotMessage
      await ChatbotMessage.insertMany([
        { userId, role: 'user', content: userMessage, intakeStage },
        { userId, role: 'assistant', content: assistantReply, intakeStage }
      ]);

      // Increment turn count for the current stage
      const stageKey = String(intakeStage);
      const currentCount = session.stageTurnCounts.get(stageKey) || 0;
      session.stageTurnCounts.set(stageKey, currentCount + 1);
      await session.save();
    } catch (error) {
      console.error('PersistIntakeTurn - Error:', error.message);
      throw error;
    }
  }
}

module.exports = new PersistIntakeTurn();
