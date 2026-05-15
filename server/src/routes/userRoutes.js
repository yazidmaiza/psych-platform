const express = require('express');
const router = express.Router();

const { protect, restrictTo } = require('../middleware/authMiddleware');
const {
  getMe,
  updateMe,
  uploadMyPhoto,
  patientPhotoUploadMiddleware
} = require('../controllers/userController');

router.get('/me', protect, getMe);
router.put('/me', protect, restrictTo('patient'), updateMe);
router.post('/me/photo', protect, restrictTo('patient'), patientPhotoUploadMiddleware, uploadMyPhoto);

module.exports = router;

