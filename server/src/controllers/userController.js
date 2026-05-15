const fs = require('fs');
const path = require('path');
const multer = require('multer');
const sharp = require('sharp');

const User = require('../models/User');
const { getPublicUploadsRoot } = require('../utils/uploadRoots');

const ALLOWED_MIMES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const MAX_BYTES = 5 * 1024 * 1024;
const MIN_SIZE = 200;

const ensureDir = (dir) => {
  fs.mkdirSync(dir, { recursive: true });
};

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    try {
      const userId = req.user?.id;
      if (!userId) return cb(new Error('Unauthorized'), null);
      const dir = path.join(getPublicUploadsRoot(), 'patient_photos', String(userId));
      ensureDir(dir);
      return cb(null, dir);
    } catch (err) {
      return cb(err, null);
    }
  },
  filename: (req, file, cb) => {
    cb(null, 'upload_' + Date.now() + path.extname(file.originalname || '.jpg'));
  }
});

exports.patientPhotoUploadMiddleware = multer({
  storage,
  limits: { fileSize: MAX_BYTES },
  fileFilter: (req, file, cb) => {
    if (!ALLOWED_MIMES.has(file.mimetype)) {
      return cb(new Error('Only JPG, PNG, and WEBP images are allowed.'));
    }
    return cb(null, true);
  }
}).single('photo');

const buildFullName = (firstName, lastName, fallback) => {
  const first = String(firstName || '').trim();
  const last = String(lastName || '').trim();
  const combined = `${first} ${last}`.trim();
  if (combined) return combined;
  return String(fallback || '').trim();
};

exports.getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('email firstName lastName fullName photo role');
    if (!user) return res.status(404).json({ message: 'User not found' });
    return res.status(200).json({
      id: user._id,
      email: user.email,
      firstName: user.firstName || '',
      lastName: user.lastName || '',
      fullName: user.fullName || '',
      photo: user.photo || '',
      role: user.role
    });
  } catch (err) {
    return res.status(500).json({ message: 'Server error', error: err.message });
  }
};

exports.updateMe = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    const firstName = req.body?.firstName;
    const lastName = req.body?.lastName;

    if (typeof firstName !== 'undefined') user.firstName = String(firstName || '').trim();
    if (typeof lastName !== 'undefined') user.lastName = String(lastName || '').trim();

    user.fullName = buildFullName(user.firstName, user.lastName, user.fullName);
    await user.save();

    return res.status(200).json({
      id: user._id,
      email: user.email,
      firstName: user.firstName || '',
      lastName: user.lastName || '',
      fullName: user.fullName || '',
      photo: user.photo || '',
      role: user.role
    });
  } catch (err) {
    return res.status(500).json({ message: 'Server error', error: err.message });
  }
};

exports.uploadMyPhoto = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'photo file is required' });

    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: 'User not found' });
    if (user.role !== 'patient') return res.status(403).json({ message: 'Access denied' });

    const meta = await sharp(req.file.path).metadata();
    const width = Number(meta.width || 0);
    const height = Number(meta.height || 0);
    if (width < MIN_SIZE || height < MIN_SIZE) {
      try { fs.unlinkSync(req.file.path); } catch {}
      return res.status(400).json({ message: `Minimum resolution is ${MIN_SIZE}x${MIN_SIZE}px.` });
    }

    const outDir = path.join(getPublicUploadsRoot(), 'patient_photos', String(req.user.id));
    ensureDir(outDir);
    const outPath = path.join(outDir, 'profile.webp');

    await sharp(req.file.path)
      .rotate()
      .resize(512, 512, { fit: 'cover' })
      .webp({ quality: 88 })
      .toFile(outPath);

    try { fs.unlinkSync(req.file.path); } catch {}

    const publicUrl = '/uploads/patient-photos/' + String(req.user.id) + '/profile.webp';
    user.photo = publicUrl;
    await user.save();

    return res.status(201).json({ photo: publicUrl });
  } catch (err) {
    const msg = err?.message || 'Upload failed';
    if (msg.toLowerCase().includes('file too large')) {
      return res.status(400).json({ message: 'Max file size is 5MB.' });
    }
    return res.status(400).json({ message: msg });
  }
};

