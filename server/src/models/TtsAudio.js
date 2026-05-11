const mongoose = require('mongoose');

const ttsAudioSchema = new mongoose.Schema(
  {
    cacheKey: { type: String, required: true, unique: true, index: true },
    provider: { type: String, enum: ['openai'], default: 'openai', index: true },
    model: { type: String, default: 'gpt-4o-mini-tts' },
    voice: { type: String, default: 'marin' },
    language: { type: String, default: 'auto' }, // e.g. en, ar, auto
    speed: { type: Number, default: 1.0, min: 0.25, max: 4.0 },
    responseFormat: { type: String, default: 'mp3' },
    mimeType: { type: String, default: 'audio/mpeg' },
    sizeBytes: { type: Number, default: 0 },
    durationMs: { type: Number, default: 0 },
    storagePath: { type: String, required: true }, // private storage relative path
    createdByUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true }
  },
  { timestamps: true }
);

ttsAudioSchema.index({ createdAt: -1 });
ttsAudioSchema.index({ createdByUserId: 1, createdAt: -1 });

module.exports = mongoose.model('TtsAudio', ttsAudioSchema);

