const mongoose = require('mongoose');

const chatbotReportSchema = new mongoose.Schema(
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
    sessionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Session',
      required: true,
      index: true
    },
    storagePath: {
      type: String,
      required: true
    },
    mimeType: {
      type: String,
      default: 'application/pdf'
    },
    sizeBytes: {
      type: Number,
      default: 0
    }
  },
  { timestamps: true }
);

chatbotReportSchema.index({ patientId: 1, sessionId: 1, createdAt: -1 });

module.exports = mongoose.model('ChatbotReport', chatbotReportSchema);

