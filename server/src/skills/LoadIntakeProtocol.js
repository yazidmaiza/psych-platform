const IntakeProtocolServer = require('../mcp/IntakeProtocolServer');
const IntakeSession = require('../models/IntakeSession');

/**
 * Skill: LoadIntakeProtocol
 * Purpose: Finds or creates the patient's IntakeSession, then fetches the current
 *          stage configuration from the IntakeProtocolServer MCP.
 *          If the session was previously completed, resets it for a fresh intake.
 */
class LoadIntakeProtocol {
  /**
   * @param {string} userId - The patient's ObjectId string
   * @returns {Promise<{ session: Object, stageConfig: Object }>}
   */
  async execute(userId) {
    if (!userId) {
      throw new Error('LoadIntakeProtocol requires a userId.');
    }

    try {
      let session = await IntakeSession.findOne({ userId });

      // Auto-reset: if the previous session was definitively ended, start fresh
      if (session && session.isComplete) {
        session.currentStage = 1;
        session.stageTurnCounts = new Map([['1', 0], ['2', 0], ['3', 0], ['4', 0], ['5', 0]]);
        session.isComplete = false;
        session.consecutiveRiskCount = 0;
        session.lastRiskCategory = null;
        session.startedAt = new Date();
        session.completedAt = null;
        await session.save();
      }

      // Create if it doesn't exist yet
      if (!session) {
        session = await IntakeSession.create({ userId });
      }

      const stageConfig = await IntakeProtocolServer.getStageConfig(session.currentStage);

      return { session, stageConfig };
    } catch (error) {
      console.error('LoadIntakeProtocol - Error:', error.message);
      throw error;
    }
  }
}

module.exports = new LoadIntakeProtocol();
