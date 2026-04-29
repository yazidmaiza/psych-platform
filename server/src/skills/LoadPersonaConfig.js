const Session = require('../models/Session');
const Psychologist = require('../models/Psychologist');
const PersonaConfig = require('../models/PersonaConfig');

/**
 * Skill: LoadPersonaConfig
 * Purpose: Resolves the assigned psychologist for a patient and loads their PersonaConfig.
 *          Looks up the most recent active/paid session to find the psychologist.
 *          Returns null gracefully if no psychologist or config is found — chatbot uses defaults.
 */
class LoadPersonaConfig {
  /**
   * @param {string} userId - Patient's user ID
   * @returns {Promise<Object|null>} PersonaConfig doc or null
   */
  async execute(userId) {
    if (!userId) return null;

    try {
      // Find the most recent active or paid session to resolve the psychologist
      const session = await Session.findOne({
        patientId: userId,
        status: { $in: ['active', 'paid', 'verified', 'completed'] }
      })
        .sort({ updatedAt: -1 })
        .lean();

      if (!session?.psychologistId) {
        console.log('[LoadPersonaConfig] No assigned psychologist found — using default persona.');
        return null;
      }

      // Resolve Psychologist document from User ID
      const psychologist = await Psychologist.findOne({ userId: session.psychologistId }).lean();
      if (!psychologist) return null;

      // Load persona config
      const persona = await PersonaConfig.findOne({ psychologistId: psychologist._id }).lean();
      return persona || null;
    } catch (error) {
      console.error('[LoadPersonaConfig] Error:', error.message);
      return null; // Never crash the pipeline
    }
  }
}

module.exports = new LoadPersonaConfig();
