const mongoose = require('mongoose');

const notificationPreferenceSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
      index: true
    },
    inAppEnabled: {
      type: Boolean,
      default: true
    },
    emailEnabled: {
      type: Boolean,
      default: true
    },
    pushEnabled: {
      type: Boolean,
      default: false
    },
    mutedTypes: {
      type: [String],
      default: []
    },
    quietHours: {
      start: {
        type: String,
        default: ''
      },
      end: {
        type: String,
        default: ''
      },
      timezone: {
        type: String,
        default: 'UTC'
      }
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model('NotificationPreference', notificationPreferenceSchema);
