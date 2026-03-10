const express = require('express');
const router = express.Router();
const {
  createSession,
  confirmPayment,
  verifyCode
} = require('../controllers/sessionController');
const { protect } = require('../middleware/authMiddleware');

router.post('/', protect, createSession);
router.post('/:id/payment', protect, confirmPayment);
router.post('/:id/verify-code', protect, verifyCode);

module.exports = router;