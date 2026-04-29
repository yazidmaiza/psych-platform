const IntakeProtocolServer = require('../mcp/IntakeProtocolServer');
const IntakeSession = require('../models/IntakeSession');

/**
 * Skill: AdvanceIntakeStage
 * Purpose: Checks whether the current stage has reached its maxTurns limit.
 *          If so, advances the session to the next stage (or marks it complete).
 *          Runs BEFORE response generation so the reply comes from the correct stage.
 */
class AdvanceIntakeStage {
  /**
   * @param {Object} session - IntakeSession mongoose document
   * @param {Object} stageConfig - Current stage config from IntakeProtocolServer
   * @returns {Promise<{ session: Object, stageConfig: Object, stageAdvanced: boolean }>}
   */
  async execute(session, stageConfig) {
    if (!session || !stageConfig) {
      throw new Error('AdvanceIntakeStage requires session and stageConfig.');
    }

    const currentStageKey = String(session.currentStage);
    const currentTurns = session.stageTurnCounts.get(currentStageKey) || 0;

    // Check if stage maxTurns has been reached
    if (currentTurns >= stageConfig.maxTurns) {
      const nextStage = session.currentStage + 1;

      if (nextStage > 5) {
        // All stages complete — mark the session as definitively ended
        session.isComplete = true;
        session.completedAt = new Date();
        await session.save();

        return { session, stageConfig, stageAdvanced: false };
      }

      // Advance to next stage
      session.currentStage = nextStage;
      await session.save();

      const newStageConfig = await IntakeProtocolServer.getStageConfig(nextStage);

      return { session, stageConfig: newStageConfig, stageAdvanced: true };
    }

    return { session, stageConfig, stageAdvanced: false };
  }
}

module.exports = new AdvanceIntakeStage();
