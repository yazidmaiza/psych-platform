const mongoose = require('mongoose');
const privateNoteSchema = new mongoose.Schema({
  psychologistId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  patientId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  sessionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Session',
    required: true
  },
  content: {
    type: String,
    required: true
  }
}, { timestamps: true });
module.exports = mongoose.model('PrivateNote', privateNoteSchema);