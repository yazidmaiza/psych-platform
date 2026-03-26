const mongoose = require('mongoose');

const sessionSchema = new mongoose.Schema({
  patientId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  psychologistId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'paid', 'verified', 'active', 'completed'],
    default: 'pending'
  },
  sessionType: {
    type: String,
    enum: ['preparation', 'followup', 'free'],
    required: true
  },
  paymentConfirmed: {
    type: Boolean,
    default: false
  },
  isRated: {
    type: Boolean,
    default: false
  }
}, { timestamps: true });

module.exports = mongoose.model('Session', sessionSchema);