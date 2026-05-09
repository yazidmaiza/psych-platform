const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { getPrivateUploadsRoot } = require('../utils/uploadRoots');

const sha256File = (absolutePath) => {
  const hash = crypto.createHash('sha256');
  const data = fs.readFileSync(absolutePath);
  hash.update(data);
  return hash.digest('hex');
};

const safeBasename = (name) => {
  const base = path.basename(String(name || 'file'));
  // Keep to a safe-ish charset to avoid weird headers/filesystem issues.
  return base.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 200) || 'file';
};

const buildStorageRelativePath = ({ ownerUserId, type, version, originalName }) => {
  const filename = safeBasename(originalName);
  // Use posix for DB portability; resolve to absolute with path.resolve for FS ops.
  return path.posix.join('credential_documents', String(ownerUserId), type, `v${version}`, filename);
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
  sha256File,
  buildStorageRelativePath,
  resolvePrivatePath,
  persistUploadedTempFile
};

