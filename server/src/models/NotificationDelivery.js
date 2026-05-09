const mongoose = require('mongoose');

const notificationDeliverySchema = new mongoose.Schema(
  {
    notificationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Notification',
      required: true,
      index: true
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    channel: {
      type: String,
      enum: ['email', 'push'],
      required: true
    },
    status: {
      type: String,
      enum: ['pending', 'processing', 'sent', 'retry', 'failed'],
      default: 'pending'
    },
    attempts: {
      type: Number,
      default: 0
    },
    nextAttemptAt: {
      type: Date,
      default: null
    },
    lastError: {
      type: String,
      default: ''
    },
    providerMessageId: {
      type: String,
      default: ''
    },
    sentAt: {
      type: Date,
      default: null
    }
  },
  { timestamps: true }
);

notificationDeliverySchema.index({ status: 1, nextAttemptAt: 1 });

module.exports = mongoose.model('NotificationDelivery', notificationDeliverySchema);
