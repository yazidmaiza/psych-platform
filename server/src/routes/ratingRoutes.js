const express = require('express');
const router = express.Router();
const { submitRating, getPsychologistRating, checkRating } = require('../controllers/ratingController');
const { protect, restrictTo } = require('../middleware/authMiddleware');
const { validateRating } = require('../middleware/validateMiddleware');

router.post('/', protect, restrictTo('patient'), validateRating, submitRating);
router.get('/psychologist/:psychologistId', getPsychologistRating);
router.get('/check/:psychologistId', protect, restrictTo('patient'), checkRating);

module.exports = router;