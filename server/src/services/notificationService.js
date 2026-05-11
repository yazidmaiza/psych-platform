const Notification = require('../models/Notification');
const NotificationPreference = require('../models/NotificationPreference');
const NotificationDelivery = require('../models/NotificationDelivery');
const User = require('../models/User');
const sendEmail = require('../utils/sendEmail');

const getIo = () => require('../index').io;

const normalizeChannels = (channels) => {
  if (!channels || !channels.length) return ['in_app'];

  const allowed = new Set(['in_app', 'email', 'push']);

  return channels.filter((c) => allowed.has(c));
};

const getPreferences = async (userId) => {
  let pref = await NotificationPreference.findOne({ userId });

  if (!pref) {
    pref = await NotificationPreference.create({ userId });
  }

  return pref;
};

const isMuted = (pref, type) => {
  if (!type) return false;

  return (pref.mutedTypes || []).includes(type);
};

const shouldSendEmail = (pref) =>
  Boolean(pref.emailEnabled);

const renderEmail = ({ title, message, link }) => {
  const safeTitle = title || 'Notification';
  const safeMessage = message || '';

  const safeLink = link
    ? `<p><a href="${link}">Open in Psych Platform</a></p>`
    : '';

  return `
    <p><strong>${safeTitle}</strong></p>
    <p>${safeMessage}</p>
    ${safeLink}
  `;
};

const createNotification = async ({
  userId,
  title,
  message,
  link,
  type,
  channels,
  data,
  priority
}) => {
  if (!userId) return null;

  const pref = await getPreferences(userId);

  if (isMuted(pref, type)) return null;

  const channelList = normalizeChannels(channels);

  const notification = await Notification.create({
    userId,
    title: title || '',
    message: message || '',
    link: link || '',
    type: type || 'generic',
    channels: channelList,
    data: data || null,
    priority: priority || 'normal'
  });

  // Real-time in-app notification
  if (
    channelList.includes('in_app') &&
    pref.inAppEnabled
  ) {
    try {
      const io = getIo();

      if (io) {
        io.to(`user_${userId}`).emit(
          'notification:new',
          notification
        );
      }
    } catch {}
  }

  // Queue email delivery
  if (
    channelList.includes('email') &&
    shouldSendEmail(pref)
  ) {
    await NotificationDelivery.create({
      notificationId: notification._id,
      userId,
      channel: 'email',
      status: 'pending',
      nextAttemptAt: new Date(),
      attempts: 0
    });
  }

  return notification;
};

// Backward compatibility helper
const notifyUser = async ({
  userId,
  title,
  message,
  link = '',
  type = 'generic'
}) => {
  return createNotification({
    userId,
    title,
    message,
    link,
    type,
    channels: ['in_app']
  });
};

const processPendingEmailDeliveries = async ({
  limit = 20
} = {}) => {
  const now = new Date();

  const deliveries = await NotificationDelivery.find({
    channel: 'email',
    status: { $in: ['pending', 'retry'] },
    nextAttemptAt: { $lte: now }
  })
    .sort({ nextAttemptAt: 1 })
    .limit(limit);

  for (const delivery of deliveries) {
    delivery.status = 'processing';
    delivery.attempts += 1;

    await delivery.save();

    try {
      const notification =
        await Notification.findById(
          delivery.notificationId
        );

      if (!notification) {
        delivery.status = 'failed';
        delivery.lastError = 'Notification not found';

        await delivery.save();
        continue;
      }

      const user = await User.findById(
        delivery.userId
      );

      if (!user) {
        delivery.status = 'failed';
        delivery.lastError = 'User not found';

        await delivery.save();
        continue;
      }

      await sendEmail({
        to: user.email,
        subject:
          notification.title || 'Notification',
        html: renderEmail({
          title: notification.title,
          message: notification.message,
          link: notification.link
        })
      });

      delivery.status = 'sent';
      delivery.sentAt = new Date();

      await delivery.save();
    } catch (err) {
      const backoffMinutes = [2, 5, 15, 60];

      const attemptIndex = Math.min(
        delivery.attempts - 1,
        backoffMinutes.length - 1
      );

      delivery.status =
        delivery.attempts >= 5
          ? 'failed'
          : 'retry';

      delivery.lastError =
        err.message || 'Delivery failed';

      delivery.nextAttemptAt = new Date(
        Date.now() +
          backoffMinutes[attemptIndex] *
            60 *
            1000
      );

      await delivery.save();
    }
  }

  return deliveries.length;
};

module.exports = {
  createNotification,
  notifyUser,
  getPreferences,
  processPendingEmailDeliveries
};