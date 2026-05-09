const mongoose = require('mongoose');

const ttsAccessGrantSchema = new mongoose.Schema(
  {
    tokenHash: { type: String, required: true, unique: true, index: true },
    ttsAudioId: { type: mongoose.Schema.Types.ObjectId, ref: 'TtsAudio', required: true, index: true },
    requestedByUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    requestedByRole: { type: String, enum: ['patient', 'psychologist', 'admin'], required: true },
    expiresAt: { type: Date, required: true, index: true },
    usedAt: { type: Date, default: null },
    requestIp: { type: String, default: '' },
    requestUserAgent: { type: String, default: '' }
  },
  { timestamps: true }
);

ttsAccessGrantSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('TtsAccessGrant', ttsAccessGrantSchema);

