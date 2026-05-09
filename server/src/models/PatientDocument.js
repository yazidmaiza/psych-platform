const mongoose = require('mongoose');

const patientDocumentSchema = new mongoose.Schema({
  psychologistId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  patientId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  filename: {
    type: String,
    required: true
  },
  originalName: {
    type: String,
    required: true
  },
  extractedText: {
    type: String,
    required: false,
    default: ''
  },
  textPreview: {
    type: String,
    default: ''
  },
  textLength: {
    type: Number,
    default: 0
  },
  chunkCount: {
    type: Number,
    default: 0
  },
  embeddingStatus: {
    type: String,
    enum: ['pending', 'ready', 'skipped', 'failed'],
    default: 'pending'
  }
}, { timestamps: true });

module.exports = mongoose.model('PatientDocument', patientDocumentSchema);