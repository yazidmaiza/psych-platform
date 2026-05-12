const express = require('express');
const router = express.Router();
const {
  sendMessage,
  resetConversation,
  endSession,
  getSummary,
  getMessages,
  generateLogoutSummaries,
  downloadReportPdf
} = require('../controllers/chatbotController');
const { protect, restrictTo } = require('../middleware/authMiddleware');

router.post('/chatbot', protect, sendMessage);
router.post('/reset', protect, resetConversation);
router.post('/chatbot/end', protect, endSession);
router.get('/messages', protect, getMessages);
router.get('/summary', protect, getSummary);
router.post('/logout-summary', protect, generateLogoutSummaries);
router.get('/reports/:id/pdf', protect, restrictTo('psychologist', 'patient', 'admin'), downloadReportPdf);

module.exports = router;
