const express = require('express');
const router = express.Router();
const {
  createSession,
  confirmPayment,
  verifyCode,
  getPatientSessions,
  cancelSession,
  getSessionById,
  endSession
} = require('../controllers/sessionController');
const { protect, restrictTo } = require('../middleware/authMiddleware');
const { validateSession } = require('../middleware/validateMiddleware');

router.post('/', protect, validateSession, createSession);
router.post('/:id/payment', protect, confirmPayment);
router.post('/:id/verify-code', protect, verifyCode);
router.get('/patient/:patientId', protect, getPatientSessions);

router.post('/:id/cancel', protect, cancelSession);
router.get('/:id', protect, getSessionById);
router.put('/:id/end', protect, restrictTo('psychologist'), endSession);

module.exports = router;

