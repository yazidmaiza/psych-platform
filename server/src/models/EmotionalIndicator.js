const mongoose = require('mongoose');

const emotionalIndicatorSchema = new mongoose.Schema({
    patientId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    psychologistId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User', // Changed from 'Psychologist' to 'User'
        required: true
    },
    sessionId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Session',
        required: true
    },
    scores: {
        anxiety: { type: Number, default: 0, min: 0, max: 100 },
        sadness: { type: Number, default: 0, min: 0, max: 100 },
        anger: { type: Number, default: 0, min: 0, max: 100 },
        positivity: { type: Number, default: 0, min: 0, max: 100 },
    },
    sessionDate: {
        type: Date,
        default: Date.now
    }
}, { timestamps: true });

module.exports = mongoose.model('EmotionalIndicator', emotionalIndicatorSchema);