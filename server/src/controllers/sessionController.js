
const Session = require('../models/Session');
const SessionCode = require('../models/SessionCode');
const User = require('../models/User');
const sendEmail = require('../utils/sendEmail');
const crypto = require('crypto');
const CalendarSlot = require('../models/CalendarSlot');
const Notification = require('../models/Notification');

const getDefaultSessionTypeForPatient = async (patientId) => {
  const hasCompleted = await Session.exists({
    patientId,
    status: 'completed'
  });
  return hasCompleted ? 'followup' : 'preparation';
};

const cancelSessionAndFreeSlot = async (session, reason) => {
  if (!session) return;
  if (session.status === 'canceled' || session.status === 'completed') return;

  session.status = 'canceled';
  session.canceledAt = new Date();
  await session.save();

  if (session.calendarSlotId) {
    await CalendarSlot.findByIdAndUpdate(session.calendarSlotId, {
      isBooked: false,
      patientId: null,
      pendingPatientId: null,
      pendingSessionId: null,
      pendingAt: null
    });
  }

  try {
    await Notification.create({
      userId: session.patientId,
      title: 'Booking canceled',
      message: reason || 'Your booking was canceled.',
      link: '/patient/dashboard',
      type: 'booking_canceled'
    });
  } catch {}
};

const expireOverduePaymentsForPatient = async (patientId) => {
  const now = new Date();
  const overdue = await Session.find({
    patientId,
    status: 'pending_payment',
    paymentConfirmed: false,
    paymentDueAt: { $ne: null, $lt: now }
  }).limit(50);

  for (const s of overdue) {
    await cancelSessionAndFreeSlot(s, 'Booking canceled because payment was not completed within 24 hours.');
  }
};

exports.createSession = async (req, res) => {
  try {
    const { psychologistId } = req.body;
    const sessionType = await getDefaultSessionTypeForPatient(req.user.id);
    const session = new Session({
      patientId: req.user.id,
      psychologistId,
      sessionType,
      status: 'pending'
    });
    await session.save();
    res.status(201).json({ sessionId: session._id, status: session.status });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

exports.confirmPayment = async (req, res) => {
  try {
    console.log('confirmPayment called');
    const session = await Session.findById(req.params.id);
    if (!session) return res.status(404).json({ message: 'Session not found' });
    if (session.patientId.toString() !== req.user.id) return res.status(403).json({ message: 'Access denied' });

    if (session.status === 'pending_payment' && session.paymentDueAt && session.paymentDueAt < new Date() && !session.paymentConfirmed) {
      await cancelSessionAndFreeSlot(session, 'Booking canceled because payment was not completed within 24 hours.');
      return res.status(400).json({ message: 'Booking expired (payment window exceeded).' });
    }

    session.paymentConfirmed = true;
    session.status = 'paid';
    await session.save();
    const code = crypto.randomInt(100000, 999999).toString();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const sessionCode = new SessionCode({ sessionId: session._id, code, expiresAt });
    await sessionCode.save();
    const patient = await User.findById(req.user.id);


    await sendEmail({
      to: patient.email,
      subject: 'Session Code',
      html: `<p>Your payment is confirmed. Your session code is: <b>${code}</b></p>`
    });

    res.status(200).json({ message: 'Payment confirmed. Code sent to your email.' });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

exports.verifyCode = async (req, res) => {
  try {
    const { code } = req.body;
    const sessionCode = await SessionCode.findOne({ sessionId: req.params.id, code, used: false });
    if (!sessionCode) return res.status(400).json({ message: 'Invalid or expired code' });
    if (sessionCode.expiresAt < new Date()) return res.status(400).json({ message: 'Code has expired' });

    const session = await Session.findById(req.params.id);
    if (!session) return res.status(404).json({ message: 'Session not found' });
    if (session.patientId.toString() !== req.user.id) return res.status(403).json({ message: 'Access denied' });
    if (session.status !== 'paid' && !session.paymentConfirmed) {
      return res.status(400).json({ message: 'Payment must be confirmed before starting the session.' });
    }

    sessionCode.used = true;
    await sessionCode.save();
    await Session.findByIdAndUpdate(req.params.id, { status: 'active' });
    res.status(200).json({ success: true, sessionId: req.params.id });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};
// @GET /api/sessions/patient/:patientId
exports.getPatientSessions = async (req, res) => {
  try {
    if (req.user.role === 'patient' && req.user.id !== req.params.patientId) {
      return res.status(403).json({ message: 'Access denied' });
    }

    await expireOverduePaymentsForPatient(req.params.patientId);

    const sessions = await Session.find({ patientId: req.params.patientId })
      .sort({ createdAt: -1 });
    res.status(200).json(sessions);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// @POST /api/sessions/:id/cancel
exports.cancelSession = async (req, res) => {
  try {
    const session = await Session.findById(req.params.id);
    if (!session) return res.status(404).json({ message: 'Session not found' });

    if (req.user.role !== 'patient' || session.patientId.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Access denied' });
    }

    if (['completed', 'canceled'].includes(session.status)) {
      return res.status(400).json({ message: 'This session cannot be canceled.' });
    }

    if (session.status === 'active') {
      return res.status(400).json({ message: 'You cannot cancel an active session. Please end the session instead.' });
    }

    await cancelSessionAndFreeSlot(session, 'Canceled by patient.');

    try {
      await Notification.create({
        userId: session.psychologistId,
        title: 'Booking canceled',
        message: 'A patient canceled their booking.',
        link: '/calendar',
        type: 'booking_canceled'
      });
    } catch {}

    res.status(200).json({ success: true });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// @GET /api/sessions/:id
exports.getSessionById = async (req, res) => {
  try {
    const session = await Session.findById(req.params.id);
    if (!session) return res.status(404).json({ message: 'Session not found' });

    const userId = req.user.id;
    const isParticipant =
      session.patientId.toString() === userId ||
      session.psychologistId.toString() === userId ||
      req.user.role === 'admin';

    if (!isParticipant) return res.status(403).json({ message: 'Access denied' });

    res.status(200).json(session);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};
