const mongoose = require('mongoose');

const psychologistSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true
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
  isRejected: {
    type: Boolean,
    default: false
  },
  aiVerificationSummary: {
    type: String,
    default: ''
  },
  sessionPrice: {
    type: Number,
    default: 0,
    min: 0
  }
}, { timestamps: true });

module.exports = mongoose.model('Psychologist', psychologistSchema);