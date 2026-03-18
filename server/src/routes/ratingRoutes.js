const express = require('express');
const router = express.Router();
const { submitRating, getPsychologistRating, checkRating } = require('../controllers/ratingController');
const { protect, restrictTo } = require('../middleware/authMiddleware');

router.post('/', protect, restrictTo('patient'), submitRating);
router.get('/psychologist/:psychologistId', getPsychologistRating);
router.get('/check/:psychologistId', protect, restrictTo('patient'), checkRating);

module.exports = router;