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
    // Keep legacy status values (e.g. "verified") for backward compatibility
    enum: ['requested', 'pending', 'pending_payment', 'paid', 'verified', 'active', 'completed', 'canceled'],
    default: 'pending'
  },
  sessionType: {
    type: String,
    enum: ['preparation', 'followup', 'free'],
    required: true
  },
  calendarSlotId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'CalendarSlot',
    default: null
  },
  scheduledStart: {
    type: Date,
    default: null
  },
  scheduledEnd: {
    type: Date,
    default: null
  },
  paymentConfirmed: {
    type: Boolean,
    default: false
  },
  // Legacy convenience flag (UI can still derive this from Rating collection)
  isRated: {
    type: Boolean,
    default: false
  },
  paymentDueAt: {
    type: Date,
    default: null
  },
  confirmedAt: {
    type: Date,
    default: null
  },
  canceledAt: {
    type: Date,
    default: null
  }
}, { timestamps: true });

module.exports = mongoose.model('Session', sessionSchema);
