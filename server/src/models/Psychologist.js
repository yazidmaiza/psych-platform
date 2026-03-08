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
  availability: {
    type: String,
    default: ''
  },
  isApproved: {
    type: Boolean,
    default: true
  }
}, { timestamps: true });

module.exports = mongoose.model('Psychologist', psychologistSchema);
