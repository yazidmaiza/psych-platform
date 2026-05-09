const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { getPrivateUploadsRoot } = require('../utils/uploadRoots');

const sha256 = (value) => crypto.createHash('sha256').update(String(value)).digest('hex');

const buildTtsStorageRelativePath = ({ cacheKey, responseFormat }) => {
  const ext = responseFormat === 'wav' ? '.wav' : responseFormat === 'opus' ? '.opus' : responseFormat === 'aac' ? '.aac' : '.mp3';
  return path.posix.join('tts_cache', cacheKey.slice(0, 2), `${cacheKey}${ext}`);
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

const writeFileAtomic = ({ absolutePath, bytes }) => {
  const dir = path.dirname(absolutePath);
  fs.mkdirSync(dir, { recursive: true });
  const tmp = absolutePath + '.tmp_' + crypto.randomBytes(6).toString('hex');
  fs.writeFileSync(tmp, bytes);
  fs.renameSync(tmp, absolutePath);
};

module.exports = { sha256, buildTtsStorageRelativePath, resolvePrivatePath, writeFileAtomic };

