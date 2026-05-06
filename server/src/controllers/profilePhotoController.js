const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const multer = require('multer');
const sharp = require('sharp');
const Psychologist = require('../models/Psychologist');
const ProfilePhotoModerationRequest = require('../models/ProfilePhotoModerationRequest');
const { getPrivateUploadsRoot } = require('../utils/uploadRoots');
const { queueProfilePhotoModeration } = require('../services/profilePhotoModerationService');
const { notifyUser } = require('../services/notificationService');

const ALLOWED_MIMES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const MAX_BYTES = 5 * 1024 * 1024;
const MIN_SIZE = 300;

const toPosixPath = (p) => String(p || '').replace(/\\/g, '/');

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    try {
      const userId = req.user?.id;
      if (!userId) return cb(new Error('Unauthorized'), null);
      const dir = path.join(getPrivateUploadsRoot(), 'profile_photos', 'pending', String(userId));
      fs.mkdirSync(dir, { recursive: true });
      return cb(null, dir);
    } catch (err) {
      return cb(err, null);
    }
  },
  filename: (req, file, cb) => {
    const randomName = crypto.randomBytes(16).toString('hex');
    const ext = file.mimetype === 'image/png'
      ? '.png'
      : file.mimetype === 'image/webp'
        ? '.webp'
        : '.jpg';
    cb(null, randomName + ext);
  }
});

exports.profilePhotoUploadMiddleware = multer({
  storage,
  limits: { fileSize: MAX_BYTES },
  fileFilter: (req, file, cb) => {
    if (!ALLOWED_MIMES.has(file.mimetype)) {
      return cb(new Error('Only JPG, PNG, and WEBP images are allowed.'));
    }
    return cb(null, true);
  }
}).single('photo');

exports.getMyProfilePhotoModeration = async (req, res) => {
  try {
    const latest = await ProfilePhotoModerationRequest.findOne({ userId: req.user.id })
      .sort({ createdAt: -1 });

    let approvedPhotoUrl = '';
    if (latest && latest.status === 'approved') {
      approvedPhotoUrl = '/uploads/profile-photos/' + String(req.user.id) + '/profile.webp';
    } else {
      const psychologist = await Psychologist.findOne({ userId: req.user.id }).select('photo');
      approvedPhotoUrl = psychologist?.photo || '';
    }

    return res.status(200).json({
      status: latest?.status || null,
      rejectionReason: latest?.rejectionReason || '',
      createdAt: latest?.createdAt || null,
      moderatedAt: latest?.moderatedAt || null,
      approvedPhotoUrl
    });
  } catch (err) {
    return res.status(500).json({ message: 'Server error', error: err.message });
  }
};

exports.uploadMyProfilePhoto = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'photo file is required' });

    const psychologist = await Psychologist.findOne({ userId: req.user.id });
    if (!psychologist) return res.status(404).json({ message: 'Psychologist profile not found' });

    const pendingRelativePath = path.posix.join(
      'profile_photos',
      'pending',
      String(req.user.id),
      path.basename(req.file.path)
    );

    const meta = await sharp(req.file.path).metadata();
    const width = Number(meta.width || 0);
    const height = Number(meta.height || 0);
    if (width < MIN_SIZE || height < MIN_SIZE) {
      try { fs.unlinkSync(req.file.path); } catch {}
      return res.status(400).json({ message: `Minimum resolution is ${MIN_SIZE}x${MIN_SIZE}px.` });
    }

    const moderationRequest = new ProfilePhotoModerationRequest({
      userId: req.user.id,
      psychologistId: psychologist._id,
      status: 'pending',
      pendingFilePath: toPosixPath(pendingRelativePath),
      mimeType: req.file.mimetype,
      sizeBytes: Number(req.file.size || 0),
      width,
      height
    });
    await moderationRequest.save();

    await notifyUser({
      userId: req.user.id,
      title: 'Profile photo uploaded',
      message: 'Your photo was uploaded successfully and is pending moderation.',
      link: '/edit-profile',
      type: 'profile_photo'
    });

    await queueProfilePhotoModeration(moderationRequest._id);

    return res.status(201).json({
      status: moderationRequest.status,
      rejectionReason: moderationRequest.rejectionReason,
      createdAt: moderationRequest.createdAt,
      moderatedAt: moderationRequest.moderatedAt,
      approvedPhotoUrl: ''
    });
  } catch (err) {
    const msg = err?.message || 'Upload failed';
    if (msg.toLowerCase().includes('file too large')) {
      return res.status(400).json({ message: 'Max file size is 5MB.' });
    }
    return res.status(400).json({ message: msg });
  }
};
