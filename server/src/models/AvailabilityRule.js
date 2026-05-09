const mongoose = require('mongoose');

const availabilityRuleSchema = new mongoose.Schema(
  {
    psychologistId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    dayOfWeek: {
      type: Number,
      min: 0,
      max: 6,
      required: true
    },
    startTime: {
      type: String,
      required: true
    },
    endTime: {
      type: String,
      required: true
    },
    timezone: {
      type: String,
      default: 'UTC'
    },
    tzOffsetMinutes: {
      type: Number,
      default: 0
    },
    isActive: {
      type: Boolean,
      default: true
    }
  },
  { timestamps: true }
);

availabilityRuleSchema.index({ psychologistId: 1, dayOfWeek: 1, startTime: 1, endTime: 1 }, { unique: true });

module.exports = mongoose.model('AvailabilityRule', availabilityRuleSchema);
