const mongoose = require('mongoose');

/**
 * Model: IntakeSession
 * Tracks the state of a patient's psychological intake session with the chatbot.
 * One active IntakeSession per patient at a time — resets when definitively ended.
 */
const intakeSessionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    currentStage: {
      type: Number,
      default: 1,
      min: 1,
      max: 5
    },
    stageTurnCounts: {
      type: Map,
      of: Number,
      default: () => new Map([['1', 0], ['2', 0], ['3', 0], ['4', 0], ['5', 0]])
    },
    isComplete: {
      type: Boolean,
      default: false
    },
    // Risk tracking: consecutive flagged messages before triggering an alert
    consecutiveRiskCount: {
      type: Number,
      default: 0
    },
    lastRiskCategory: {
      type: String,
      default: null
    },
    startedAt: {
      type: Date,
      default: Date.now
    },
    completedAt: {
      type: Date,
      default: null
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model('IntakeSession', intakeSessionSchema);
