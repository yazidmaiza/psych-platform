const express = require('express');
const router = express.Router();

const { protect, restrictTo } = require('../middleware/authMiddleware');
const { getMyOnboarding, submitOnboarding } = require('../controllers/onboardingController');

router.get('/me', protect, restrictTo('psychologist'), getMyOnboarding);
router.post('/submit', protect, restrictTo('psychologist'), submitOnboarding);

module.exports = router;

