const express = require('express');
const router = express.Router();
const { sendMessage, endSession, getSummary, getMessages, generateLogoutSummaries } = require('../controllers/chatbotController');
const { protect } = require('../middleware/authMiddleware');

router.post('/:id/chatbot', protect, sendMessage);
router.post('/:id/chatbot/end', protect, endSession);
router.get('/:id/messages', protect, getMessages);
router.get('/:id/summary', protect, getSummary);
router.post('/logout-summary', protect, generateLogoutSummaries);

module.exports = router;
