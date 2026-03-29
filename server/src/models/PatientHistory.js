const mongoose = require('mongoose');

const patientHistorySchema = new mongoose.Schema({
  patientId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  psychologistId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Psychologist',
    required: true
  },
  sessionType: {
    type: String,
    enum: ['Preparation consultation', 'Follow-up between sessions', 'Free expression'],
    required: true
  },
  summary: {
    type: String,
    default: ''
  },
  emotionalScores: {
    anxiety: { type: Number, default: 0 },
    sadness: { type: Number, default: 0 },
    anger: { type: Number, default: 0 },
    positivity: { type: Number, default: 0 }
  },
  sessionDate: {
    type: Date,
    default: Date.now
  }
}, { timestamps: true });

module.exports = mongoose.model('PatientHistory', patientHistorySchema);

