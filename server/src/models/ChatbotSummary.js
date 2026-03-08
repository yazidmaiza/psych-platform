const mongoose = require('mongoose');

const chatbotSummarySchema = new mongoose.Schema({
  sessionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Session',
    required: true
  },
  patientId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
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
  }
}, { timestamps: true });

module.exports = mongoose.model('ChatbotSummary', chatbotSummarySchema);