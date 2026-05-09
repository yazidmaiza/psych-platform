const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { getPrivateUploadsRoot } = require('../utils/uploadRoots');

const safeExtFromMime = (mime) => {
  const m = String(mime || '').toLowerCase();
  if (m === 'audio/webm') return '.webm';
  if (m === 'audio/ogg') return '.ogg';
  if (m === 'audio/mpeg' || m === 'audio/mp3') return '.mp3';
  if (m === 'audio/wav') return '.wav';
  if (m === 'audio/mp4') return '.m4a';
  return '';
};

const buildVoiceStorageRelativePath = ({ sessionId, mimeType }) => {
  const ext = safeExtFromMime(mimeType) || '.bin';
  const id = crypto.randomUUID ? crypto.randomUUID() : crypto.randomBytes(16).toString('hex');
  return path.posix.join('voice_messages', String(sessionId), `${id}${ext}`);
};

const resolvePrivatePath = (storagePath) => {
  const root = getPrivateUploadsRoot();
  const normalized = path.posix.normalize(String(storagePath || '').replace(/\\/g, '/'));
  if (normalized.includes('..')) throw new Error('Invalid storage path');
  const absolute = path.resolve(root, normalized);
  const resolvedRoot = path.resolve(root);
  if (!absolute.startsWith(resolvedRoot + path.sep)) throw new Error('Invalid storage path');
  return { root: resolvedRoot, absolute, normalized };
};

const persistUploadedTempFile = ({ tempFilePath, storagePath }) => {
  const { absolute } = resolvePrivatePath(storagePath);
  fs.mkdirSync(path.dirname(absolute), { recursive: true });
  fs.renameSync(tempFilePath, absolute);
  return absolute;
};

module.exports = {
  buildVoiceStorageRelativePath,
  resolvePrivatePath,
  persistUploadedTempFile
};

