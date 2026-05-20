const mongoose = require('mongoose');

const chatbotSummarySchema = new mongoose.Schema({
  patientId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true
  },
  emotionalIndicators: {
    dominantEmotion: { type: String, default: '' },
    urgencyScore: { type: Number, min: 1, max: 5, default: 1 },
    sentimentTrend: { type: String, enum: ['improving', 'stable', 'declining'], default: 'stable' }
  },
  keyThemes: {
    type: [String],
    default: []
  },
  rawSummary: {
    type: String,
    default: ''
  },
  recommendations: {
    type: [String],
    default: []
  },

  // ── Two-pass quality fields (Q3) ─────────────────────────────────────────
  // Set by critiqueSummary() in chatbotController.js after the primary
  // summary generation. lowConfidence: true means the second LLM pass rated
  // confidence ≤ 2 out of 5 — psychologist should verify rather than rely on it.
  lowConfidence: {
    type: Boolean,
    default: false
  },
  // One-sentence critique note from the second pass, e.g.
  // "Summary may be speculative — patient gave short answers."
  critiqueNote: {
    type: String,
    default: ''
  }
}, { timestamps: true });

module.exports = mongoose.model('ChatbotSummary', chatbotSummarySchema);