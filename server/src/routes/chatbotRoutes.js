const express = require('express');
const router = express.Router();
const {
  sendMessage,
  resetConversation,
  endSession,
  getSummary,
  getMessages,
  generateLogoutSummaries,
  downloadReportPdf,
  submitSummaryFeedback,
  getSummaryFeedback,
  getFeedbackAnalytics,
  detectKnowledgeGaps,
  triggerKnowledgeReseed
} = require('../controllers/chatbotController');
const { exportData, deleteData } = require('../controllers/dataRightsController');
const { protect, restrictTo } = require('../middleware/authMiddleware');

router.post('/chatbot', protect, sendMessage);
router.post('/reset', protect, resetConversation);
router.post('/chatbot/end', protect, endSession);
router.get('/messages', protect, getMessages);
router.get('/summary', protect, getSummary);
router.get('/analytics/feedback', protect, restrictTo('admin'), getFeedbackAnalytics);
router.get('/analytics/knowledge-gaps', protect, restrictTo('admin'), detectKnowledgeGaps);
router.post('/analytics/knowledge-gaps/reseed', protect, restrictTo('admin'), triggerKnowledgeReseed);
router.get('/summary/:patientId/feedback', protect, restrictTo('psychologist', 'admin'), getSummaryFeedback);
router.post('/summary/:patientId/feedback', protect, restrictTo('psychologist', 'admin'), submitSummaryFeedback);
router.post('/logout-summary', protect, generateLogoutSummaries);
router.get('/reports/:id/pdf', protect, restrictTo('psychologist', 'patient', 'admin'), downloadReportPdf);

// GDPR patient data rights (Art. 15, 17, 20)
router.get('/data/export', protect, restrictTo('patient'), exportData);
router.delete('/data', protect, restrictTo('patient'), deleteData);

module.exports = router;

