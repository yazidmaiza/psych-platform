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
    required: true
  }
}, { timestamps: true });

module.exports = mongoose.model('PatientDocument', patientDocumentSchema);