const mongoose = require('mongoose');

const psychologistSchema = new mongoose.Schema({
    firstName: { type: String, required: true },
    lastName: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    photo: { type: String, default: '' },
    bio: { type: String, default: '' },
    specializations: { type: [String], default: [] },
    languages: { type: [String], default: [] },
    city: { type: String, default: '' },
    sessionPrice: { type: Number, default: 0 },
    availability: { type: [String], default: [] },
}, { timestamps: true });

module.exports = mongoose.model('Psychologist', psychologistSchema);