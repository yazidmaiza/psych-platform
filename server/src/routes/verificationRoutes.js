const express = require('express');
const router = express.Router();
const multer = require('multer');
const { uploadDocuments, getPendingVerifications, approvePsychologist, rejectPsychologist } = require('../controllers/verificationController');
const { protect, restrictTo } = require('../middleware/authMiddleware');

const upload = multer({
    dest: 'uploads/',
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        if (file.mimetype === 'application/pdf') {
            cb(null, true);
        } else {
            cb(new Error('Only PDF files are allowed'));
        }
    }
});

router.post('/upload', protect, restrictTo('psychologist'), upload.fields([
    { name: 'cv', maxCount: 1 },
    { name: 'diploma', maxCount: 1 }
]), uploadDocuments);

router.get('/pending', protect, restrictTo('admin'), getPendingVerifications);
router.put('/:id/approve', protect, restrictTo('admin'), approvePsychologist);
router.put('/:id/reject', protect, restrictTo('admin'), rejectPsychologist);

module.exports = router;
