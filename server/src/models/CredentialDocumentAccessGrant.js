const mongoose = require('mongoose');

const credentialDocumentAccessGrantSchema = new mongoose.Schema(
  {
    tokenHash: { type: String, required: true, unique: true, index: true },
    credentialDocumentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'CredentialDocument',
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
    expiresAt: { type: Date, required: true, index: true },
    usedAt: { type: Date, default: null },
    requestIp: { type: String, default: '' },
    requestUserAgent: { type: String, default: '' }
  },
  { timestamps: true }
);

// TTL cleanup for expired grants (Mongo TTL index)
credentialDocumentAccessGrantSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('CredentialDocumentAccessGrant', credentialDocumentAccessGrantSchema);

