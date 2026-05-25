const mongoose = require('mongoose');

const loginOtpTokenSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    tokenHash: { type: String, required: true, index: true },
    expiresAt: { type: Date, required: true },
    usedAt: { type: Date, default: null },
    createdIp: { type: String, default: '' },
    createdUserAgent: { type: String, default: '' }
  },
  { timestamps: true }
);

loginOtpTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('LoginOtpToken', loginOtpTokenSchema);

