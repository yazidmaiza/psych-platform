const mongoose = require('mongoose');

/**
 * Model: RiskAlert
 * Stores every detected behavioral risk event during chatbot intake sessions.
 * Written when AnalyzeRiskBehavior detects >= 2 consecutive risk signals.
 */
const riskAlertSchema = new mongoose.Schema(
  {
    patientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    psychologistId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    intakeSessionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'IntakeSession',
      required: true
    },
    // The exact patient message that crossed the threshold
    triggerMessage: {
      type: String,
      required: true
    },
    riskCategory: {
      type: String,
      enum: ['self_harm', 'suicidal_ideation', 'abuse_trauma', 'crisis_escalation'],
      required: true
    },
    // 0–100 score from the LLM classifier
    riskScore: {
      type: Number,
      required: true,
      min: 0,
      max: 100
    },
    // One-sentence explanation from the classifier
    llmReasoning: {
      type: String,
      default: ''
    },
    // Derived from riskScore: low / medium / high / critical
    severity: {
      type: String,
      enum: ['low', 'medium', 'high', 'critical'],
      required: true
    },
    isAcknowledged: {
      type: Boolean,
      default: false
    },
    acknowledgedAt: {
      type: Date,
      default: null
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model('RiskAlert', riskAlertSchema);
