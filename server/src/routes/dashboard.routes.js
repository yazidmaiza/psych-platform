const express = require('express');
const router = express.Router();
const Message = require('../models/Message');
const PrivateNote = require('../models/PrivateNote');
const SessionRequest = require('../models/SessionRequest');

// US-31 — Get chronological list of patients for a psychologist
router.get('/patients/:psychologistId', async (req, res) => {
    try {
        const requests = await SessionRequest.find({
            psychologistId: req.params.psychologistId
        }).sort({ createdAt: -1 });

        res.json(requests);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// US-32 — Get detailed patient view
router.get('/patient/:psychologistId/:patientId', async (req, res) => {
    try {
        const { psychologistId, patientId } = req.params;

        // Get conversation messages
        const messages = await Message.find({
            $or: [
                { senderId: patientId, receiverId: psychologistId },
                { senderId: psychologistId, receiverId: patientId }
            ]
        }).sort({ createdAt: 1 });

        // Get private notes
        const notes = await PrivateNote.find({
            psychologistId,
            patientId
        }).sort({ createdAt: -1 });

        res.json({ messages, notes });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// US-27 — Add a private note
router.post('/notes', async (req, res) => {
    try {
        const { psychologistId, patientId, content } = req.body;

        const note = new PrivateNote({ psychologistId, patientId, content });
        await note.save();

        res.status(201).json(note);
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
});

// US-27 — Get all private notes for a patient
router.get('/notes/:psychologistId/:patientId', async (req, res) => {
    try {
        const notes = await PrivateNote.find({
            psychologistId: req.params.psychologistId,
            patientId: req.params.patientId
        }).sort({ createdAt: -1 });

        res.json(notes);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

module.exports = router;