const express = require('express');
const router = express.Router();

const { protect } = require('../middleware/authMiddleware');
const { speak, download } = require('../controllers/ttsController');

router.post('/speak', protect, speak);
router.get('/download', download);

module.exports = router;

