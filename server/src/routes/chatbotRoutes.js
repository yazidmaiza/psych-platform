const express = require('express');
const router = express.Router();
const { sendMessage, resetConversation, endSession, getSummary, getMessages, generateLogoutSummaries } = require('../controllers/chatbotController');
const { protect } = require('../middleware/authMiddleware');

router.post('/chatbot', protect, sendMessage);
router.post('/reset', protect, resetConversation);
router.post('/chatbot/end', protect, endSession);
router.get('/messages', protect, getMessages);
router.get('/summary', protect, getSummary);
router.post('/logout-summary', protect, generateLogoutSummaries);

module.exports = router;
