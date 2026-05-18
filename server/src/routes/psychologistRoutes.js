const express = require('express');
const router = express.Router();
const { getAllPsychologists, getNearbyPsychologists, getPsychologist, getPsychologistByUserId, getMyPsychologist, updatePsychologist, createProfile, searchPsychologists } = require('../controllers/psychologistController');
const { protect, restrictTo } = require('../middleware/authMiddleware');

router.post('/profile', protect, restrictTo('psychologist'), createProfile);
router.get('/me', protect, restrictTo('psychologist'), getMyPsychologist);
router.get('/search', searchPsychologists);
router.get('/', getAllPsychologists);
router.get('/nearby', getNearbyPsychologists);
router.get('/by-user/:userId', getPsychologistByUserId);
router.get('/:id', getPsychologist);
router.put('/:id', protect, restrictTo('psychologist'), updatePsychologist);
router.put('/me', protect, restrictTo('psychologist'), updatePsychologist);
module.exports = router;
