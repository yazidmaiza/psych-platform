const mongoose = require('mongoose');

const credentialDocumentSchema = new mongoose.Schema(
  {
    ownerUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    psychologistId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Psychologist',
      required: true,
      index: true
    },
    type: {
      type: String,
      enum: ['cv', 'diploma', 'idFront', 'idBack', 'introVideo'],
      required: true,
      index: true
    },
    version: {
      type: Number,
      required: true,
      min: 1
    },
    isCurrent: {
      type: Boolean,
      default: true,
      index: true
    },
    replacedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'CredentialDocument',
      default: null
    },
    storagePath: {
      type: String,
      required: true
    },
    originalName: { type: String, default: '' },
    mimeType: { type: String, required: true },
    sizeBytes: { type: Number, required: true },
    checksumSha256: { type: String, required: true },
    uploadedByUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    }
  },
  { timestamps: true }
);

credentialDocumentSchema.index(
  { ownerUserId: 1, type: 1, version: -1 },
  { unique: true }
);

module.exports = mongoose.model('CredentialDocument', credentialDocumentSchema);

