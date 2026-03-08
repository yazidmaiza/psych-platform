const mongoose = require('mongoose');

const sessionRequestSchema = new mongoose.Schema({
    patientId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    psychologistId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Psychologist',
        required: true
    },
    status: {
        type: String,
        enum: ['pending', 'accepted', 'rejected'],
        default: 'pending'
    },
}, { timestamps: true });

module.exports = mongoose.model('SessionRequest', sessionRequestSchema);