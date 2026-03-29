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
    enum: ['requested', 'pending', 'pending_payment', 'paid', 'active', 'completed', 'canceled'],
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
