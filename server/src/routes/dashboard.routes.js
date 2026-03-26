const express = require('express');
const router = express.Router();
const Message = require('../models/Message');
const PrivateNote = require('../models/PrivateNote');
const SessionRequest = require('../models/Session');
const EmotionalIndicator = require('../models/EmotionalIndicator');
const PatientHistory = require('../models/PatientHistory');
const { protect } = require('../middleware/authMiddleware');

// US-31 — Get chronological list of patients for a psychologist
router.get('/patients', protect, async (req, res) => {
    try {
        const sessions = await SessionRequest.find({
            psychologistId: req.user.id
        }).sort({ createdAt: -1 });

        // Get unique patient IDs
        const User = require('../models/User');
        const uniquePatientIds = [...new Set(sessions.map(s => s.patientId.toString()))];
        const patients = await User.find({ _id: { $in: uniquePatientIds } }).select('-password');

        // Merge session info with patient info
        const result = uniquePatientIds.map(patientId => {
            const patientSessions = sessions.filter(s => s.patientId.toString() === patientId);
            const patient = patients.find(p => p._id.toString() === patientId);
            return {
                _id: patientSessions[0]._id,
                patientId,
                email: patient?.email || 'Unknown',
                sessionCount: patientSessions.length,
                lastSession: patientSessions[0].createdAt,
                status: patientSessions[0].status
            };
        });

        res.json(result);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// US-32 — Get detailed patient view
router.get('/patient/:patientId', protect, async (req, res) => {
    try {
        const psychologistId = req.user.id;
        const { patientId } = req.params;

        const messages = await Message.find({
            $or: [
                { senderId: patientId, receiverId: psychologistId },
                { senderId: psychologistId, receiverId: patientId }
            ]
        }).sort({ createdAt: 1 });

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
router.post('/notes', protect, async (req, res) => {
    try {
        const { patientId, content } = req.body;

        const note = new PrivateNote({
            psychologistId: req.user.id,
            patientId,
            content
        });

        await note.save();
        res.status(201).json(note);
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
});

// US-27 — Get all private notes for a patient
router.get('/notes/:patientId', protect, async (req, res) => {
    try {
        const notes = await PrivateNote.find({
            psychologistId: req.user.id,
            patientId: req.params.patientId
        }).sort({ createdAt: -1 });

        res.json(notes);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// US-33 — Add emotional indicators
// US-33 — Add emotional indicators
router.post('/emotions', protect, async (req, res) => {
    try {
        const { patientId, sessionId, scores } = req.body;

        // Validate required fields
        if (!patientId || !sessionId || !scores) {
            return res.status(400).json({ 
                message: 'Missing required fields: patientId, sessionId, and scores are required' 
            });
        }

        // Validate user role (only psychologists can add emotional indicators)
        if (req.user.role !== 'psychologist') {
            return res.status(403).json({ message: 'Access denied. Only psychologists can add emotional indicators.' });
        }

        // Validate scores structure
        const validScores = ['anxiety', 'sadness', 'anger', 'positivity'];
        const scoreKeys = Object.keys(scores);
        
        if (scoreKeys.length === 0) {
            return res.status(400).json({ message: 'Scores object cannot be empty' });
        }

        // Validate score values are within range (0-100)
        for (const key of scoreKeys) {
            if (typeof scores[key] !== 'number' || scores[key] < 0 || scores[key] > 100) {
                return res.status(400).json({ 
                    message: `Invalid score value for ${key}. Must be a number between 0 and 100.` 
                });
            }
        }

        const indicator = new EmotionalIndicator({
            patientId,
            sessionId,
            psychologistId: req.user.id,
            scores
        });

        await indicator.save();
        res.status(201).json(indicator);
    } catch (err) {
        console.error('Error creating emotional indicator:', err);
        if (err.name === 'ValidationError') {
            return res.status(400).json({ message: err.message });
        }
        if (err.name === 'CastError') {
            return res.status(400).json({ message: 'Invalid ID format provided' });
        }
        res.status(500).json({ message: 'Server error while creating emotional indicator' });
    }
});

// US-33 — Get emotional indicators for a patient
router.get('/emotions/:patientId', protect, async (req, res) => {
    try {
        const indicators = await EmotionalIndicator.find({
            psychologistId: req.user.id,
            patientId: req.params.patientId
        }).sort({ createdAt: -1 });

        res.json(indicators);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// US-34 — Add a session to patient history
router.post('/history', protect, async (req, res) => {
    try {
        const { patientId, sessionType, summary, emotionalScores } = req.body;

        const history = new PatientHistory({
            patientId,
            psychologistId: req.user.id,
            sessionType,
            summary,
            emotionalScores
        });

        await history.save();
        res.status(201).json(history);
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
});

// US-34 — Get patient history
router.get('/history/:patientId', protect, async (req, res) => {
    try {
        const history = await PatientHistory.find({
            patientId: req.params.patientId
        }).sort({ sessionDate: -1 });

        res.json(history);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

module.exports = router;