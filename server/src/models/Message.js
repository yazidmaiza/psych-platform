const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  sessionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Session',
    required: false
  },
  senderId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    refPath: 'senderModel'
  },
  senderModel: {
    type: String,
    required: true,
    enum: ['User', 'Psychologist']
  },
  receiverId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    refPath: 'receiverModel'
  },
  receiverModel: {
    type: String,
    required: true,
    enum: ['User', 'Psychologist']
  },
  kind: {
    type: String,
    enum: ['text', 'voice'],
    default: 'text',
    index: true
  },
  content: {
    type: String,
    required: function () {
      return String(this.kind || 'text') === 'text';
    },
    default: ''
  },
  voice: {
    storagePath: { type: String, default: '' }, // private storage relative path; never expose to clients
    mimeType: { type: String, default: '' },
    sizeBytes: { type: Number, default: 0 },
    durationMs: { type: Number, default: 0 },
    transcription: {
      status: { type: String, enum: ['none', 'pending', 'ready', 'error'], default: 'none' },
      text: { type: String, default: '' },
      error: { type: String, default: '' },
      updatedAt: { type: Date, default: null }
    }
  },
  isRead: {
    type: Boolean,
    default: false
  }
}, { timestamps: true });

messageSchema.index({ sessionId: 1, createdAt: 1 });
messageSchema.index({ senderId: 1, receiverId: 1, createdAt: 1 });

module.exports = mongoose.model('Message', messageSchema);
