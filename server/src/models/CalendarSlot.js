const mongoose = require('mongoose');

const calendarSlotSchema = new mongoose.Schema({
    psychologistId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    patientId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null
    },
    start: {
        type: Date,
        required: true
    },
    end: {
        type: Date,
        required: true
    },
    isBooked: {
        type: Boolean,
        default: false
    },
    pendingPatientId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null
    },
    pendingSessionId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Session',
        default: null
    },
    pendingAt: {
        type: Date,
        default: null
    }
}, { timestamps: true });

module.exports = mongoose.model('CalendarSlot', calendarSlotSchema);
