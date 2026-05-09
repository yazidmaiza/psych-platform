const mongoose = require('mongoose');

const availabilityExceptionSchema = new mongoose.Schema(
  {
    psychologistId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    date: {
      type: String,
      required: true
    },
    startTime: {
      type: String,
      default: null
    },
    endTime: {
      type: String,
      default: null
    },
    isAvailable: {
      type: Boolean,
      default: false
    },
    reason: {
      type: String,
      default: ''
    }
  },
  { timestamps: true }
);

availabilityExceptionSchema.index({ psychologistId: 1, date: 1 });

module.exports = mongoose.model('AvailabilityException', availabilityExceptionSchema);
