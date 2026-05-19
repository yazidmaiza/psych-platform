/**
 * Controller: dataRightsController
 *
 * GDPR-compliant patient data rights endpoints (Articles 15, 17, 20).
 *
 *   GET  /api/chatbot/data/export  — Art. 15/20: data access & portability
 *   DELETE /api/chatbot/data       — Art. 17: right to erasure
 *
 * Both endpoints are patient-only. Psychologists and admins access patient
 * data through their own dashboards and cannot invoke erasure on behalf of
 * a patient (it must be a self-service action).
 *
 * Erasure policy:
 *   - Messages: hard-deleted immediately
 *   - IntakeSession: reset (fields zeroed, not deleted — preserves FK integrity)
 *   - ChatbotSummary: hard-deleted immediately
 *   - ChatbotSummaryArchive: hard-deleted immediately
 *   All deletions are irreversible. A 30-day soft-delete grace period can be
 *   added in a future iteration by checking a `deletedAt` field before queries.
 */

const ChatbotMessage          = require('../models/ChatbotMessage');
const ChatbotSummary          = require('../models/ChatbotSummary');
const ChatbotSummaryArchive   = require('../models/ChatbotSummaryArchive');
const IntakeSession           = require('../models/IntakeSession');
const { audit }               = require('../services/auditService');

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/chatbot/data/export
// ─────────────────────────────────────────────────────────────────────────────

exports.exportData = async (req, res) => {
  try {
    if (req.user.role !== 'patient') {
      return res.status(403).json({ message: 'Access denied' });
    }

    const patientId = req.user.id;

    const [messages, summary, session, archives] = await Promise.all([
      ChatbotMessage.find({ userId: patientId })
        .sort({ createdAt: 1 })
        .select('role content createdAt')
        .lean(),
      ChatbotSummary.findOne({ patientId })
        .select('-__v')
        .lean(),
      IntakeSession.findOne({ userId: patientId })
        .select('currentStage isComplete crisisHold startedAt completedAt contextSummary')
        .lean(),
      ChatbotSummaryArchive.find({ patientId })
        .sort({ archivedAt: -1 })
        .select('archivedAt resetReason snapshot')
        .lean()
    ]);

    // Audit the export request (GDPR Art. 15 — access log required)
    audit(req, {
      action: 'DATA_EXPORT',
      targetType: 'Patient',
      targetId: String(patientId),
      outcome: 'success',
      severity: 'info',
      message: `Patient ${patientId} exported their chatbot data.`,
      metadata: {
        messageCount: messages.length,
        hasSummary: !!summary,
        archiveCount: archives.length
      }
    }).catch(() => {});

    return res.status(200).json({
      exportedAt: new Date().toISOString(),
      patientId: String(patientId),
      messages,
      summary: summary || null,
      intakeSession: session || null,
      summaryArchives: archives
    });
  } catch (err) {
    console.error('[DataRights] exportData error:', err.message);
    return res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /api/chatbot/data
// ─────────────────────────────────────────────────────────────────────────────

exports.deleteData = async (req, res) => {
  try {
    if (req.user.role !== 'patient') {
      return res.status(403).json({ message: 'Access denied' });
    }

    const patientId = req.user.id;

    // Audit BEFORE deletion so we have a record even if deletion partially fails
    await audit(req, {
      action: 'DATA_DELETE_REQUESTED',
      targetType: 'Patient',
      targetId: String(patientId),
      outcome: 'success',
      severity: 'warn',
      message: `Patient ${patientId} requested erasure of all chatbot data (GDPR Art. 17).`,
      metadata: { patientId: String(patientId) }
    }).catch(() => {});

    await Promise.all([
      // Delete all messages
      ChatbotMessage.deleteMany({ userId: patientId }),
      // Delete current summary and all archives
      ChatbotSummary.deleteOne({ patientId }),
      ChatbotSummaryArchive.deleteMany({ patientId }),
      // Reset intake session state — don't delete the document to preserve FK integrity.
      // Fields that contain patient-generated content are cleared.
      IntakeSession.findOneAndUpdate(
        { userId: patientId },
        {
          $set: {
            currentStage: 1,
            stageTurnCounts: new Map([['1', 0], ['2', 0], ['3', 0], ['4', 0], ['5', 0]]),
            isComplete: false,
            crisisHold: false,
            consecutiveRiskCount: 0,
            lastRiskCategory: null,
            lastRiskAt: null,
            contextSummary: null,
            contextSummaryUpdatedAt: null,
            startedAt: new Date(),
            completedAt: null
          }
        },
        { upsert: false }
      )
    ]);

    return res.status(200).json({
      message: 'All chatbot data has been permanently deleted.',
      deletedAt: new Date().toISOString()
    });
  } catch (err) {
    console.error('[DataRights] deleteData error:', err.message);
    return res.status(500).json({ message: 'Server error', error: err.message });
  }
};
