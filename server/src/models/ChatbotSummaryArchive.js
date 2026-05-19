const mongoose = require('mongoose');

/**
 * Model: ChatbotSummaryArchive
 *
 * Stores a copy of a ChatbotSummary document before it is overwritten or
 * deleted. Created whenever a patient resets their conversation, ensuring
 * psychologists retain a record of previously reviewed summaries.
 *
 * Each archive document contains:
 *   - patientId       — whose session this was
 *   - archivedAt      — when the archive was created
 *   - resetReason     — why it was archived (e.g. 'patient_reset')
 *   - snapshot        — the full ChatbotSummary document at time of archiving
 */
const chatbotSummaryArchiveSchema = new mongoose.Schema(
  {
    patientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    // ISO timestamp of when the archive was created (redundant with createdAt
    // but explicit for readability in psychologist dashboard queries)
    archivedAt: {
      type: Date,
      default: Date.now
    },
    // Why the summary was archived. Extend with additional reasons as needed.
    resetReason: {
      type: String,
      enum: ['patient_reset', 'admin_clear', 'session_end_overwrite'],
      default: 'patient_reset'
    },
    // Full snapshot of the ChatbotSummary document at the time of archiving.
    // Stored as Mixed so schema changes to ChatbotSummary don't break archives.
    snapshot: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model('ChatbotSummaryArchive', chatbotSummaryArchiveSchema);
