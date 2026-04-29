const RiskAlert = require('../models/RiskAlert');
const Notification = require('../models/Notification');
const Session = require('../models/Session');

// Lazy-load io to avoid circular dependency at startup
const getIo = () => require('../index').io;

/**
 * Service: RiskAlertService
 * Purpose: Orchestrates everything when a confirmed risk is detected:
 *   1. Finds the patient's assigned psychologist from the most recent Session
 *   2. Creates a RiskAlert document in MongoDB
 *   3. Creates a Notification for the psychologist
 *   4. Emits a 'risk_alert' Socket.IO event to the psychologist's named room
 */
class RiskAlertService {
  /**
   * @param {Object} params
   * @param {string} params.patientId
   * @param {string} params.intakeSessionId
   * @param {Object} params.risk - { category, score, severity, reasoning, triggerMessage }
   * @returns {Promise<Object|null>} Created RiskAlert or null on failure
   */
  async trigger({ patientId, intakeSessionId, risk }) {
    try {
      // Find the psychologist linked to this patient via the most recent session
      const linkedSession = await Session.findOne({ patientId })
        .sort({ createdAt: -1 })
        .lean();

      if (!linkedSession || !linkedSession.psychologistId) {
        console.warn(`[RiskAlertService] No linked psychologist for patient ${patientId}. Alert saved to DB only.`);
        return null;
      }

      const psychologistId = linkedSession.psychologistId;

      // 1. Create the RiskAlert document
      const alert = await RiskAlert.create({
        patientId,
        psychologistId,
        intakeSessionId,
        triggerMessage: risk.triggerMessage,
        riskCategory: risk.category,
        riskScore: risk.score,
        llmReasoning: risk.reasoning,
        severity: risk.severity
      });

      // 2. Create a persistent Notification for the psychologist
      await Notification.create({
        userId: psychologistId,
        title: `⚠️ Risk Alert — ${risk.severity.toUpperCase()}`,
        message: `A patient has shown signs of ${risk.category.replace(/_/g, ' ')}. Score: ${risk.score}/100.`,
        link: `/patient/${patientId}`,
        type: 'risk_alert'
      });

      // 3. Emit real-time Socket.IO event to the psychologist's room
      try {
        const io = getIo();
        if (io) {
          io.to(`psychologist_${psychologistId}`).emit('risk_alert', {
            alertId: alert._id,
            patientId: patientId.toString(),
            riskCategory: risk.category,
            riskScore: risk.score,
            severity: risk.severity,
            triggerMessage: risk.triggerMessage,
            llmReasoning: risk.reasoning,
            timestamp: new Date().toISOString()
          });
        }
      } catch (socketErr) {
        console.error('[RiskAlertService] Socket.IO emit failed:', socketErr.message);
        // Non-fatal — alert is already saved to DB
      }

      console.log(`[RiskAlertService] Alert triggered: ${risk.category} (${risk.severity}) for patient ${patientId}`);
      return alert;
    } catch (error) {
      console.error('[RiskAlertService] trigger Error:', error.message);
      return null;
    }
  }
}

module.exports = new RiskAlertService();
