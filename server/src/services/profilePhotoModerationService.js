const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const Psychologist = require('../models/Psychologist');
const ProfilePhotoModerationRequest = require('../models/ProfilePhotoModerationRequest');
const { getPublicUploadsRoot, getPrivateUploadsRoot } = require('../utils/uploadRoots');
const { notifyUser } = require('./notificationService');

const processing = new Set();

const toPosixPath = (p) => String(p || '').replace(/\\/g, '/');

const resolvePrivateUpload = (relativePosixPath) => {
  const normalized = path.posix.normalize(toPosixPath(relativePosixPath));
  if (!normalized || normalized.includes('..')) return null;
  const root = path.resolve(getPrivateUploadsRoot());
  const absolute = path.resolve(root, normalized);
  if (!absolute.startsWith(root + path.sep)) return null;
  return absolute;
};

const resolvePublicUpload = (relativePosixPath) => {
  const normalized = path.posix.normalize(toPosixPath(relativePosixPath));
  if (!normalized || normalized.includes('..')) return null;
  const root = path.resolve(getPublicUploadsRoot());
  const absolute = path.resolve(root, normalized);
  if (!absolute.startsWith(root + path.sep)) return null;
  return absolute;
};

const reject = async (reqDoc, reason) => {
  reqDoc.status = 'rejected';
  reqDoc.rejectionReason = String(reason || 'Photo rejected');
  reqDoc.moderatedAt = new Date();
  await reqDoc.save();

  await notifyUser({
    userId: reqDoc.userId,
    title: 'Profile photo rejected',
    message: reqDoc.rejectionReason,
    link: '/edit-profile',
    type: 'profile_photo'
  });
};

const approve = async (reqDoc, approvedRelativePath) => {
  reqDoc.status = 'approved';
  reqDoc.approvedFilePath = toPosixPath(approvedRelativePath);
  reqDoc.rejectionReason = '';
  reqDoc.moderatedAt = new Date();
  await reqDoc.save();

  // Public URL is exposed via /uploads/profile-photos (mapped to .../profile_photos/approved)
  const approvedUrl = '/uploads/profile-photos/' + String(reqDoc.userId) + '/profile.webp';

  await Psychologist.findOneAndUpdate(
    { userId: reqDoc.userId },
    { photo: approvedUrl },
    { returnDocument: 'after' }
  );

  await notifyUser({
    userId: reqDoc.userId,
    title: 'Profile photo approved',
    message: 'Your profile photo is now visible to patients.',
    link: '/edit-profile',
    type: 'profile_photo'
  });
};

const processRequest = async (requestId) => {
  if (!requestId) return;
  if (processing.has(String(requestId))) return;
  processing.add(String(requestId));

  try {
    const reqDoc = await ProfilePhotoModerationRequest.findById(requestId);
    if (!reqDoc) return;
    if (reqDoc.status !== 'pending') return;

    const pendingAbs = resolvePrivateUpload(reqDoc.pendingFilePath);
    if (!pendingAbs || !fs.existsSync(pendingAbs)) {
      return reject(reqDoc, 'Upload not found. Please re-upload your photo.');
    }

    const meta = await sharp(pendingAbs).metadata();
    const width = Number(meta.width || 0);
    const height = Number(meta.height || 0);
    const minSize = 300;

    if (width < minSize || height < minSize) {
      return reject(reqDoc, `Image resolution too low. Minimum is ${minSize}x${minSize}px.`);
    }

    const aspect = width > 0 && height > 0 ? width / height : 1;
    if (aspect < 0.5 || aspect > 2) {
      return reject(reqDoc, 'Image aspect ratio looks invalid. Please upload a clear portrait-style photo.');
    }

    const approvedRelative = path.posix.join('profile_photos', 'approved', String(reqDoc.userId), 'profile.webp');
    const approvedAbs = resolvePublicUpload(approvedRelative);
    if (!approvedAbs) {
      return reject(reqDoc, 'Storage error. Please try again.');
    }

    fs.mkdirSync(path.dirname(approvedAbs), { recursive: true });

    await sharp(pendingAbs)
      .rotate()
      .resize(512, 512, { fit: 'cover', position: 'centre' })
      .webp({ quality: 85 })
      .toFile(approvedAbs);

    return approve(reqDoc, approvedRelative);
  } catch (err) {
    try {
      const reqDoc = await ProfilePhotoModerationRequest.findById(requestId);
      if (reqDoc && reqDoc.status === 'pending') {
        await reject(reqDoc, err?.message || 'Moderation failed. Please try again.');
      }
    } catch {
      // ignore
    }
  } finally {
    processing.delete(String(requestId));
  }
};

exports.queueProfilePhotoModeration = async (requestId) => {
  setTimeout(() => {
    processRequest(requestId);
  }, 50);
};
