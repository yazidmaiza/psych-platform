const express = require('express');
const router = express.Router();
const { getAllPsychologists, getPsychologist, updatePsychologist } = require('../controllers/psychologistController');
const { protect, restrictTo } = require('../middleware/authMiddleware');

router.get('/', getAllPsychologists);
router.get('/:id', getPsychologist);
router.put('/:id', protect, restrictTo('psychologist'), updatePsychologist);

module.exports = router;
