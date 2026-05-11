const mongoose = require('mongoose');

const psychologistSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true
  },
  profileStatus: {
    type: String,
    enum: ['Draft', 'Submitted', 'Approved', 'Rejected'],
    default: 'Draft'
  },
  submittedAt: { type: Date, default: null },
  lastResubmittedAt: { type: Date, default: null },
  rejectionReason: { type: String, default: '' },
  rejectedAt: { type: Date, default: null },
  rejectedByUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  rejectionDetails: {
    fields: { type: [String], default: [] },
    documents: { type: [String], default: [] }
  },
  onboardingHistory: {
    type: [
      {
        status: { type: String, enum: ['Draft', 'Submitted', 'Approved', 'Rejected'], required: true },
        at: { type: Date, required: true },
        byUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
        reason: { type: String, default: '' },
        details: { type: mongoose.Schema.Types.Mixed, default: {} }
      }
    ],
    default: []
  },
  firstName: {
    type: String,
    required: true,
    trim: true
  },
  lastName: {
    type: String,
    required: true,
    trim: true
  },
  photo: {
    type: String,
    default: ''
  },
  bio: {
    type: String,
    default: ''
  },
  specializations: {
    type: [String],
    default: []
  },
  languages: {
    type: [String],
    default: []
  },
  city: {
    type: String,
    default: ''
  },
  location: {
    type: {
      type: String,
      enum: ['Point'],
      required: false
    },
    coordinates: {
      type: [Number],
      required: false
    }
  },
  averageRating: {
    type: Number,
    default: 0,
    min: 0,
    max: 5
  },
  totalRatings: {
    type: Number,
    default: 0
  },
  availability: {
    type: String,
    default: ''
  },
  isApproved: {
    type: Boolean,
    default: false
  },
  cvUrl: {
    type: String,
    default: ''
  },
  diplomaUrl: {
    type: String,
    default: ''
  },
  idCard: {
    front: {
      type: String,
      default: ''
    },
    back: {
      type: String,
      default: ''
    }
  },
  credentialDocs: {
    cv: { type: mongoose.Schema.Types.ObjectId, ref: 'CredentialDocument' },
    diploma: { type: mongoose.Schema.Types.ObjectId, ref: 'CredentialDocument' },
    idFront: { type: mongoose.Schema.Types.ObjectId, ref: 'CredentialDocument' },
    idBack: { type: mongoose.Schema.Types.ObjectId, ref: 'CredentialDocument' },
    introVideo: { type: mongoose.Schema.Types.ObjectId, ref: 'CredentialDocument' }
  },
  isRejected: {
    type: Boolean,
    default: false
  },
  aiVerificationSummary: {
    type: String,
    default: ''
  },
  introVideo: {
    type: String,
    required: function () {
      // Intro video is required as part of verification submission,
      // but profile creation happens before any documents are uploaded.
      return Boolean(
        (this.cvUrl && this.cvUrl.length) ||
        (this.diplomaUrl && this.diplomaUrl.length) ||
        (this.idCard && ((this.idCard.front && this.idCard.front.length) || (this.idCard.back && this.idCard.back.length)))
      );
    }
  },
  sessionPrice: {
    type: Number,
    default: 0,
    min: 0
  }
}, { timestamps: true });

psychologistSchema.index({ location: '2dsphere' });
// Review queue indexes (UC-08)
psychologistSchema.index({ profileStatus: 1, submittedAt: -1 });
psychologistSchema.index({ profileStatus: 1, createdAt: -1 });
psychologistSchema.index({ isRejected: 1, rejectedAt: -1 });

module.exports = mongoose.model('Psychologist', psychologistSchema);
