const express = require('express');
const router = express.Router();
const SessionRequest = require('../models/SessionRequest');
const Psychologist = require('../models/Psychologist');

// US-11 — Get list of psychologists with filters
router.get('/', async (req, res) => {
    try {
        const { specialization, language, city } = req.query;

        let filter = {};
        if (specialization) filter.specializations = { $in: [specialization] };
        if (language) filter.languages = { $in: [language] };
        if (city) filter.city = city;

        const psychologists = await Psychologist.find(filter)
            .select('-password');

        res.json(psychologists);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// US-12 — Get single psychologist profile
router.get('/:id', async (req, res) => {
    try {
        const psychologist = await Psychologist.findById(req.params.id)
            .select('-password');

        if (!psychologist) {
            return res.status(404).json({ message: 'Psychologist not found' });
        }

        res.json(psychologist);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// US-13 — Create a psychologist (temporary, for testing)
router.post('/', async (req, res) => {
    try {
        const psychologist = new Psychologist(req.body);
        await psychologist.save();
        res.status(201).json(psychologist);
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
});

// US-13 — Request a session
router.post('/:id/request-session', async (req, res) => {
    try {
        const { patientId } = req.body;

        const sessionRequest = new SessionRequest({
            patientId,
            psychologistId: req.params.id,
        });

        await sessionRequest.save();
        res.status(201).json({ message: 'Session request sent!', sessionRequest });
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
});

module.exports = router;