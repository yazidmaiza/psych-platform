const express = require('express');
const router = express.Router();
const multer = require('multer');
const { transcribeVoice } = require('../controllers/voiceController');
const { protect } = require('../middleware/authMiddleware');

const upload = multer({
  dest: 'uploads/',
  limits: { fileSize: 25 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['audio/webm', 'audio/wav', 'audio/mp3', 'audio/mpeg', 'audio/ogg', 'audio/mp4'];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid audio format'));
    }
  }
});

router.post('/:id/voice', protect, upload.single('audio'), transcribeVoice);

module.exports = router;