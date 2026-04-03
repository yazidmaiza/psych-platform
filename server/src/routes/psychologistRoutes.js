const express = require('express');
const router = express.Router();
const { getAllPsychologists, getNearbyPsychologists, getPsychologist, getPsychologistByUserId, updatePsychologist, createProfile } = require('../controllers/psychologistController');
const { protect, restrictTo } = require('../middleware/authMiddleware');

router.post('/profile', protect, restrictTo('psychologist'), createProfile);
router.get('/', getAllPsychologists);
router.get('/nearby', getNearbyPsychologists);
router.get('/by-user/:userId', getPsychologistByUserId);
router.get('/:id', getPsychologist);
router.put('/:id', protect, restrictTo('psychologist'), updatePsychologist);
router.put('/me', protect, restrictTo('psychologist'), updatePsychologist);
module.exports = router;
