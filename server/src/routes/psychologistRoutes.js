const express = require('express');
const router = express.Router();
const { getAllPsychologists, getPsychologist, updatePsychologist } = require('../controllers/psychologistController');
const { protect, restrictTo } = require('../middleware/authMiddleware');
const Psychologist = require('../models/Psychologist');

router.post('/', async (req, res) => {
    try {
        const psy = new Psychologist(req.body);
        await psy.save();
        res.status(201).json(psy);
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
});
router.get('/', getAllPsychologists);
router.get('/:id', getPsychologist);
router.put('/:id', protect, restrictTo('psychologist'), updatePsychologist);

module.exports = router;