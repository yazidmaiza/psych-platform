const express = require('express');
const router = express.Router();
const multer = require('multer');
const { uploadDocuments, getPendingVerifications, approvePsychologist, rejectPsychologist } = require('../controllers/verificationController');
const { protect, restrictTo } = require('../middleware/authMiddleware');
const { verifyFaceMatch, getFaceCheckDiagnostics } = require('../services/faceVerificationService');

const IMAGE_MIMES = new Set(['image/jpeg', 'image/png']);
const VIDEO_MIMES = new Set(['video/mp4', 'video/webm', 'video/quicktime']);

const upload = multer({
    dest: 'uploads/', // temp; moved to private storage in controller
    // Must allow introVideo up to 100MB; size limits for other fields are enforced in controller.
    limits: { fileSize: 100 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        if (file.fieldname === 'cv' || file.fieldname === 'diploma') {
            if (file.mimetype === 'application/pdf') return cb(null, true);
            return cb(new Error('Only PDF files are allowed for CV and diploma'));
        }

        if (file.fieldname === 'idFront' || file.fieldname === 'idBack') {
            if (IMAGE_MIMES.has(file.mimetype)) return cb(null, true);
            return cb(new Error('Only JPG/JPEG/PNG files are allowed for ID card images'));
        }

        if (file.fieldname === 'introVideo') {
            if (VIDEO_MIMES.has(file.mimetype)) return cb(null, true);
            return cb(new Error('Only MP4/MOV/WEBM files are allowed for introduction video'));
        }

        return cb(new Error('Unexpected file field'));
    }
});

router.post('/upload', protect, restrictTo('psychologist'), upload.fields([
    { name: 'cv', maxCount: 1 },
    { name: 'diploma', maxCount: 1 },
    { name: 'idFront', maxCount: 1 },
    { name: 'idBack', maxCount: 1 },
    { name: 'introVideo', maxCount: 1 }
]), uploadDocuments);

router.get('/pending', protect, restrictTo('admin'), getPendingVerifications);
router.put('/:id/approve', protect, restrictTo('admin'), approvePsychologist);
router.put('/:id/reject', protect, restrictTo('admin'), rejectPsychologist);

router.get('/face-check/:userId', protect, restrictTo('admin'), async (req, res) => {
    try {
        const result = await verifyFaceMatch(req.params.userId);
        return res.status(200).json(result);
    } catch (err) {
        return res.status(200).json({
            match: false,
            confidence: 0,
            error: err?.message || 'Face check failed'
        });
    }
});

router.get('/face-check-diagnostics', protect, restrictTo('admin'), (req, res) => {
    try {
        return res.status(200).json(getFaceCheckDiagnostics());
    } catch (err) {
        return res.status(200).json({ error: err?.message || 'Diagnostics failed' });
    }
});

module.exports = router;
