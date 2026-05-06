const express = require('express');
const router = express.Router();

const { protect, restrictTo } = require('../middleware/authMiddleware');
const {
  profilePhotoUploadMiddleware,
  uploadMyProfilePhoto,
  getMyProfilePhotoModeration
} = require('../controllers/profilePhotoController');

router.get('/me', protect, restrictTo('psychologist'), getMyProfilePhotoModeration);
router.post('/upload', protect, restrictTo('psychologist'), profilePhotoUploadMiddleware, uploadMyProfilePhoto);

module.exports = router;

