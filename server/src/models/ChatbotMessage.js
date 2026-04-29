const mongoose = require('mongoose');

const chatbotMessageSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  role: {
    type: String,
    enum: ['user', 'assistant'],
    required: true
  },
  content: {
    type: String,
    required: true
  },
  // Which intake stage this message belongs to (1–5)
  intakeStage: {
    type: Number,
    min: 1,
    max: 5,
    default: null
  }
}, { timestamps: true });

module.exports = mongoose.model('ChatbotMessage', chatbotMessageSchema);