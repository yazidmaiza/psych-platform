const express = require('express');
const router = express.Router();
const { sendMessage, endSession, getSummary } = require('../controllers/chatbotController');
const { protect } = require('../middleware/authMiddleware');

router.post('/:id/chatbot', protect, sendMessage);
router.post('/:id/chatbot/end', protect, endSession);
router.get('/:id/summary', protect, getSummary);

module.exports = router;
