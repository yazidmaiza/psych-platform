const express = require('express');
const router = express.Router();
const multer = require('multer');
const { uploadDocuments, getPendingVerifications, approvePsychologist, rejectPsychologist } = require('../controllers/verificationController');
const { protect, restrictTo } = require('../middleware/authMiddleware');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { verifyFaceMatch, getFaceCheckDiagnostics } = require('../services/faceVerificationService');
const { getPublicUploadsRoot, getPrivateUploadsRoot } = require('../utils/uploadRoots');

const IMAGE_MIMES = new Set(['image/jpeg', 'image/png']);
const VIDEO_MIMES = new Set(['video/mp4', 'video/webm', 'video/quicktime']);

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        try {
            if (file.fieldname === 'idFront' || file.fieldname === 'idBack') {
                const userId = req.user?.id;
                if (!userId) return cb(new Error('Unauthorized'), null);
                const dir = path.join(getPrivateUploadsRoot(), 'verification', String(userId), 'id');
                fs.mkdirSync(dir, { recursive: true });
                return cb(null, dir);
            }

            if (file.fieldname === 'introVideo') {
                const userId = req.user?.id;
                if (!userId) return cb(new Error('Unauthorized'), null);
                const dir = path.join(getPrivateUploadsRoot(), 'verification', String(userId), 'video');
                fs.mkdirSync(dir, { recursive: true });
                return cb(null, dir);
            }

            // Keep existing behavior for CV/Diploma (stored in uploads/ with random filenames)
            const dir = path.join(getPublicUploadsRoot());
            fs.mkdirSync(dir, { recursive: true });
            return cb(null, dir);
        } catch (err) {
            return cb(err, null);
        }
    },
    filename: (req, file, cb) => {
        if (file.fieldname === 'idFront' || file.fieldname === 'idBack') {
            const base = file.fieldname === 'idFront' ? 'front' : 'back';
            return cb(null, base + '.jpg');
        }

        if (file.fieldname === 'introVideo') {
            let ext = 'mp4';
            if (file.mimetype === 'video/webm') ext = 'webm';
            if (file.mimetype === 'video/quicktime') ext = 'mov';
            return cb(null, 'intro.' + ext);
        }

        const randomName = crypto.randomBytes(16).toString('hex');
        return cb(null, randomName);
    }
});

const upload = multer({
    storage,
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

router.get('/file/:filename', protect, restrictTo('admin'), (req, res) => {
    const filePath = path.join(getPublicUploadsRoot(), req.params.filename);
    if (!fs.existsSync(filePath)) {
        return res.status(404).json({ message: 'File not found' });
    }
    res.sendFile(filePath);
});

router.get('/asset', protect, restrictTo('admin'), (req, res) => {
    const relativePath = String(req.query.path || '');
    if (!relativePath) return res.status(400).json({ message: 'path query param is required' });

    // Only allow reading from verification/... to avoid leaking other files.
    const normalized = path.posix.normalize(relativePath.replace(/\\/g, '/'));
    if (!normalized.startsWith('verification/')) {
        return res.status(400).json({ message: 'Invalid asset path' });
    }
    if (normalized.includes('..')) {
        return res.status(400).json({ message: 'Invalid asset path' });
    }

    const roots = [getPrivateUploadsRoot(), getPublicUploadsRoot()];

    for (const root of roots) {
        const resolvedRoot = path.resolve(root);
        const absolutePath = path.resolve(resolvedRoot, normalized);
        if (!absolutePath.startsWith(resolvedRoot + path.sep)) continue;
        if (!fs.existsSync(absolutePath)) continue;
        return res.sendFile(absolutePath);
    }

    return res.status(404).json({ message: 'File not found' });
});

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
