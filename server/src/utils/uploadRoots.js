const path = require('path');

const resolveFromServerRoot = (...segments) => path.resolve(__dirname, '..', '..', ...segments);

const getPublicUploadsRoot = () => {
  const configured = process.env.UPLOADS_DIR;
  return configured ? path.resolve(configured) : resolveFromServerRoot('uploads');
};

const getPrivateUploadsRoot = () => {
  const configured = process.env.PRIVATE_UPLOADS_DIR;
  return configured ? path.resolve(configured) : resolveFromServerRoot('private_uploads');
};

module.exports = {
  getPublicUploadsRoot,
  getPrivateUploadsRoot
};
