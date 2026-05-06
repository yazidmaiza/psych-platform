const Notification = require('../models/Notification');

exports.notifyUser = async ({ userId, title, message, link = '', type = 'generic' }) => {
  if (!userId) return null;
  const n = new Notification({
    userId,
    title: title || '',
    message: message || '',
    link: link || '',
    type: type || 'generic'
  });
  await n.save();
  return n;
};

