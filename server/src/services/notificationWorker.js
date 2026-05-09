const { processPendingEmailDeliveries } = require('./notificationService');

const DEFAULT_INTERVAL_MS = 15000;

const startNotificationWorker = () => {
  const enabled = process.env.ENABLE_NOTIFICATION_WORKER !== 'false';
  if (!enabled) return null;

  const intervalMs = Number(process.env.NOTIFICATION_WORKER_INTERVAL_MS || DEFAULT_INTERVAL_MS);

  const interval = setInterval(async () => {
    try {
      await processPendingEmailDeliveries({ limit: 25 });
    } catch (err) {
      // Keep worker alive even if a batch fails
    }
  }, intervalMs);

  return interval;
};

module.exports = { startNotificationWorker };
