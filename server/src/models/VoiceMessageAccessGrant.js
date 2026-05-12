const mongoose = require('mongoose');

const voiceMessageAccessGrantSchema = new mongoose.Schema(
  {
    tokenHash: { type: String, required: true, unique: true, index: true },
    messageId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Message',
      required: true,
      index: true
    },
    requestedByUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    requestedByRole: {
      type: String,
      enum: ['patient', 'psychologist', 'admin'],
      required: true
    },
    expiresAt: { type: Date, required: true },
    usedAt: { type: Date, default: null },
    requestIp: { type: String, default: '' },
    requestUserAgent: { type: String, default: '' }
  },
  { timestamps: true }
);

voiceMessageAccessGrantSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('VoiceMessageAccessGrant', voiceMessageAccessGrantSchema);

