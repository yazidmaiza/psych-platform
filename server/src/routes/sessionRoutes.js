const express = require('express');
const router = express.Router();
const {
  createSession,
  confirmPayment,
  verifyCode,
  getPatientSessions
} = require('../controllers/sessionController');
const { protect } = require('../middleware/authMiddleware');

router.post('/', protect, createSession);
router.post('/:id/payment', protect, confirmPayment);
router.post('/:id/verify-code', protect, verifyCode);
router.get('/patient/:patientId', protect, getPatientSessions);

module.exports = router;