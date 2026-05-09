const mongoose = require('mongoose');

const authSessionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    refreshTokenHash: {
      type: String,
      required: true,
      index: true
    },
    userAgent: {
      type: String,
      default: ''
    },
    ipAddress: {
      type: String,
      default: ''
    },
    deviceId: {
      type: String,
      default: ''
    },
    lastUsedAt: {
      type: Date,
      default: null
    },
    revokedAt: {
      type: Date,
      default: null
    },
    revokeReason: {
      type: String,
      default: null
    },
    replacedBySessionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'AuthSession',
      default: null
    },
    expiresAt: {
      type: Date,
      required: true,
      index: true
    }
  },
  { timestamps: true }
);

authSessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('AuthSession', authSessionSchema);
