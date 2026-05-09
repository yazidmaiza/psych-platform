const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  title: {
    type: String,
    default: ''
  },
  message: {
    type: String,
    default: ''
  },
  link: {
    type: String,
    default: ''
  },
  type: {
    type: String,
    default: 'generic'
  },
  channels: {
    type: [String],
    default: ['in_app']
  },
  priority: {
    type: String,
    enum: ['low', 'normal', 'high'],
    default: 'normal'
  },
  data: {
    type: Object,
    default: null
  },
  isRead: {
    type: Boolean,
    default: false
  },
  readAt: {
    type: Date,
    default: null
  }
}, { timestamps: true });

module.exports = mongoose.model('Notification', notificationSchema);
