const Session = require('../models/Session');
const CalendarSlot = require('../models/CalendarSlot');
const { createNotification } = require('./notificationService');

const DEFAULT_INTERVAL_MS = 5 * 60 * 1000;

const cancelSessionAndFreeSlot = async (session, reason) => {
  if (!session) return;
  if (session.status === 'canceled' || session.status === 'completed') return;

  const now = new Date();

  const updatedSession = await Session.findOneAndUpdate(
    {
      _id: session._id,
      status: 'pending_payment',
      paymentConfirmed: false,
      paymentDueAt: { $ne: null, $lt: now }
    },
    { $set: { status: 'canceled', canceledAt: now } },
    { new: true }
  );

  if (!updatedSession) return;

  if (updatedSession.calendarSlotId) {
    await CalendarSlot.findByIdAndUpdate(updatedSession.calendarSlotId, {
      isBooked: false,
      patientId: null,
      pendingPatientId: null,
      pendingSessionId: null,
      pendingAt: null
    });
  }

  // No notification on auto-expiry to avoid confusing cancellations during booking flows.
};

const expireOverduePaymentsBatch = async ({ limit = 50 } = {}) => {
  const now = new Date();

  const overdue = await Session.find({
    status: 'pending_payment',
    paymentConfirmed: false,
    paymentDueAt: { $ne: null, $lt: now }
  })
    .sort({ paymentDueAt: 1 })
    .limit(limit);

  for (const session of overdue) {
    await cancelSessionAndFreeSlot(session, 'Booking canceled because payment was not completed within 24 hours.');
  }
};

const startBookingExpiryWorker = () => {
  const enabled = process.env.ENABLE_BOOKING_EXPIRY_WORKER !== 'false';
  if (!enabled) return null;

  const intervalMs = Number(process.env.BOOKING_EXPIRY_WORKER_INTERVAL_MS || DEFAULT_INTERVAL_MS);

  const interval = setInterval(async () => {
    try {
      await expireOverduePaymentsBatch({ limit: 50 });
    } catch (err) {
      // keep worker alive
    }
  }, intervalMs);

  return interval;
};

module.exports = { startBookingExpiryWorker, expireOverduePaymentsBatch };
