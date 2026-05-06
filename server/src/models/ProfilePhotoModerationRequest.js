const mongoose = require('mongoose');

const profilePhotoModerationRequestSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  psychologistId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Psychologist',
    required: false,
    index: true
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending',
    index: true
  },
  pendingFilePath: {
    type: String,
    required: true
  },
  approvedFilePath: {
    type: String,
    default: ''
  },
  mimeType: {
    type: String,
    default: ''
  },
  sizeBytes: {
    type: Number,
    default: 0
  },
  width: {
    type: Number,
    default: 0
  },
  height: {
    type: Number,
    default: 0
  },
  rejectionReason: {
    type: String,
    default: ''
  },
  moderatedAt: {
    type: Date,
    default: null
  }
}, { timestamps: true });

profilePhotoModerationRequestSchema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.model('ProfilePhotoModerationRequest', profilePhotoModerationRequestSchema);

