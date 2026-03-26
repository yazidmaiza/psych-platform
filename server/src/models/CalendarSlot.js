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
    }
}, { timestamps: true });

module.exports = mongoose.model('CalendarSlot', calendarSlotSchema);