const express = require('express');
const router = express.Router();

const { protectAllowUnverified, restrictTo } = require('../middleware/authMiddleware');
const { getMyOnboarding, submitOnboarding } = require('../controllers/onboardingController');

router.get('/me', protectAllowUnverified, restrictTo('psychologist'), getMyOnboarding);
router.post('/submit', protectAllowUnverified, restrictTo('psychologist'), submitOnboarding);

module.exports = router;
