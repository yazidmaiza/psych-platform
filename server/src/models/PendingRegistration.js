const mongoose = require('mongoose');

const pendingRegistrationSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, index: true },
    role: { type: String, enum: ['patient', 'psychologist'], required: true },

    // Raw password stored temporarily until registration is confirmed.
    passwordHash: { type: String, required: true },

    fullName: { type: String, default: '' },
    telephone: { type: String, default: '' },
    birthDate: { type: String, default: '' },

    psychologistProfile: {
      firstName: { type: String, default: '' },
      lastName: { type: String, default: '' },
      bio: { type: String, default: '' },
      city: { type: String, default: '' },
      country: { type: String, default: '' },
      sessionPrice: { type: Number, default: 0 },
      specializations: { type: [String], default: [] },
      languages: { type: [String], default: [] }
    },

    documents: {
      cv: { storagePath: String, originalName: String, mimeType: String, sizeBytes: Number, checksumSha256: String },
      diploma: { storagePath: String, originalName: String, mimeType: String, sizeBytes: Number, checksumSha256: String },
      idFront: { storagePath: String, originalName: String, mimeType: String, sizeBytes: Number, checksumSha256: String },
      idBack: { storagePath: String, originalName: String, mimeType: String, sizeBytes: Number, checksumSha256: String },
      introVideo: { storagePath: String, originalName: String, mimeType: String, sizeBytes: Number, checksumSha256: String }
    },

    codeHash: { type: String, required: true },
    codeExpiresAt: { type: Date, required: true },
    codeUsedAt: { type: Date, default: null },

    createdIp: { type: String, default: '' },
    createdUserAgent: { type: String, default: '' }
  },
  { timestamps: true }
);

pendingRegistrationSchema.index({ email: 1, createdAt: -1 });
pendingRegistrationSchema.index({ codeExpiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('PendingRegistration', pendingRegistrationSchema);
