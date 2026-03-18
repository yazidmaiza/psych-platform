const mongoose = require('mongoose');

const ratingSchema = new mongoose.Schema({
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
    answers: {
        type: [Number],
        required: true,
        validate: {
            validator: function (arr) {
                return arr.length === 10 && arr.every(n => n >= 1 && n <= 5);
            },
            message: 'Answers must be 10 numbers between 1 and 5'
        }
    },
    score: {
        type: Number,
        min: 10,
        max: 50
    },
    comment: {
        type: String,
        default: ''
    }
}, { timestamps: true });

// One rating per patient-psychologist pair
ratingSchema.index({ patientId: 1, psychologistId: 1 }, { unique: true });

module.exports = mongoose.model('Rating', ratingSchema);