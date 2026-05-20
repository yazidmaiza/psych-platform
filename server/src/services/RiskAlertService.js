const RiskAlert = require('../models/RiskAlert');
const { createNotification } = require('../services/notificationService');
const Session = require('../models/Session');

// Lazy-load io to avoid circular dependency at startup
const getIo = () => require('../index').io;

/**
 * Service: RiskAlertService
 * Purpose: Orchestrates everything when a confirmed risk is detected:
 *   1. Finds the patient's assigned psychologist from the most recent Session
 *   2. Creates a RiskAlert document in MongoDB
 *   3. Creates a Notification for the psychologist
 *   4. Emits a Socket.IO event to the psychologist's named room
 *
 * Urgency levels:
 *   'HIGH'     — first HIGH risk message. Standard alert flow.
 *                Emits 'risk_alert' event. Notification priority: 'high'.
 *
 *   'CRITICAL' — second consecutive HIGH risk message. Crisis escalation.
 *                Emits 'crisis_alert' event (separate listener on dashboard).
 *                Notification priority: 'critical'. Cannot be auto-dismissed
 *                by RiskAlertBanner. Title prefix changes to 🚨 CRISIS ALERT.
 */
class RiskAlertService {
  /**
   * @param {Object} params
   * @param {string} params.patientId
   * @param {string} params.intakeSessionId
   * @param {Object} params.risk        - { category, score, severity, reasoning, triggerMessage }
   * @param {string} params.urgency     - 'HIGH' | 'CRITICAL' (default: 'HIGH')
   * @returns {Promise<Object|null>}    - Created RiskAlert or null on failure
   */
  async trigger({ patientId, intakeSessionId, risk, urgency = 'HIGH' }) {
    try {
      const isCritical = urgency === 'CRITICAL';

      // ── 1. Resolve linked psychologist ──────────────────────────────
      // Only look at active/paid/verified sessions — a cancelled session's
      // psychologist is no longer responsible for this patient.
      const linkedSession = await Session.findOne({
        patientId,
        status: { $in: ['active', 'paid', 'verified', 'completed'] }
      })
        .sort({ createdAt: -1 })
        .lean();

      if (!linkedSession || !linkedSession.psychologistId) {
        // Patients can only access the chatbot after booking a session, so this
        // should not happen in practice. Log loudly but still persist the alert
        // so the event is never silently dropped.
        console.error(
          `[RiskAlertService] ⚠️  No active-session psychologist found for patient ${patientId}. ` +
          `Alert will be saved without notification. Review patient booking state.`
        );
        const orphanAlert = await RiskAlert.create({
          patientId,
          psychologistId: null,
          intakeSessionId,
          triggerMessage: risk.triggerMessage,
          riskCategory:  risk.category,
          riskScore:     risk.score,
          llmReasoning:  risk.reasoning,
          severity:      risk.severity,
          urgency
        }).catch(e => {
          console.error('[RiskAlertService] Could not save orphan alert:', e.message);
          return null;
        });
        return orphanAlert;
      }

      const psychologistId = linkedSession.psychologistId;

      // ── 2. Create RiskAlert document ─────────────────────────────────
      // urgency is stored so the psychologist dashboard can filter/sort
      // by escalation level independently of the risk severity score.
      const alert = await RiskAlert.create({
        patientId,
        psychologistId,
        intakeSessionId,
        triggerMessage: risk.triggerMessage,
        riskCategory:  risk.category,
        riskScore:     risk.score,
        llmReasoning:  risk.reasoning,
        severity:      risk.severity,
        urgency                          // ← NEW: 'HIGH' | 'CRITICAL'
      });

      // ── 3. Create persistent Notification ───────────────────────────
      // Title and priority escalate for CRITICAL so the psychologist's
      // notification centre surfaces it above standard alerts.
      const notificationTitle = isCritical
        ? `🚨 CRISIS ALERT — Patient Needs Immediate Attention`
        : `⚠️ Risk Alert — ${risk.severity.toUpperCase()}`;

      const notificationMessage = isCritical
        ? `A patient has triggered a crisis escalation (${risk.category.replace(/_/g, ' ')}). ` +
          `Their session has been paused. Immediate follow-up required. Score: ${risk.score}/100.`
        : `A patient has shown signs of ${risk.category.replace(/_/g, ' ')}. Score: ${risk.score}/100.`;

      await createNotification({
        userId:    psychologistId,
        title:     notificationTitle,
        message:   notificationMessage,
        link:      `/patient/${patientId}`,
        type:      isCritical ? 'crisis_alert' : 'risk_alert',
        channels:  ['in_app', 'email'],
        priority:  isCritical ? 'critical' : 'high'  // ← escalated priority
      });

      // ── 4. Emit real-time Socket.IO event ────────────────────────────
      //
      // Standard HIGH risk  → 'risk_alert'   event
      // CRITICAL escalation → 'crisis_alert' event
      //
      // Using separate event names means the psychologist dashboard can
      // attach different handlers:
      //   - 'risk_alert'   → standard RiskAlertBanner toast (auto-dismisses after 30s)
      //   - 'crisis_alert' → persistent crisis banner that cannot be auto-dismissed,
      //                      plays an audible alert, and locks to the top of the UI
      //
      const eventName = isCritical ? 'crisis_alert' : 'risk_alert';

      try {
        const io = getIo();
        if (io) {
          io.to(`psychologist_${psychologistId}`).emit(eventName, {
            alertId:       alert._id,
            patientId:     patientId.toString(),
            riskCategory:  risk.category,
            riskScore:     risk.score,
            severity:      risk.severity,
            urgency,                              // ← included so frontend can read it directly
            triggerMessage: risk.triggerMessage,
            llmReasoning:  risk.reasoning,
            timestamp:     new Date().toISOString(),
            ...(isCritical && {
              sessionPaused: true,               // ← tells dashboard the patient's session is locked
              requiresAck:   true                // ← tells RiskAlertBanner not to auto-dismiss
            })
          });
        }
      } catch (socketErr) {
        // Non-fatal — alert is already saved to DB and notification created
        console.error('[RiskAlertService] Socket.IO emit failed:', socketErr.message);
      }

      if (isCritical) {
        console.error(
          `[RiskAlertService] 🚨 CRISIS ESCALATION: ${risk.category} for patient ${patientId}. ` +
          `Session paused. Psychologist ${psychologistId} notified via crisis_alert event.`
        );
      } else {
        console.log(
          `[RiskAlertService] Alert triggered: ${risk.category} (${risk.severity}) for patient ${patientId}.`
        );
      }

      return alert;
    } catch (error) {
      console.error('[RiskAlertService] trigger Error:', error.message);
      return null;
    }
  }
}

module.exports = new RiskAlertService();