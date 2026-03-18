
const Session = require('../models/Session');
const SessionCode = require('../models/SessionCode');
const User = require('../models/User');
const sendEmail = require('../utils/sendEmail');
const crypto = require('crypto');

exports.createSession = async (req, res) => {
  try {
    const { psychologistId, sessionType } = req.body;
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
    session.paymentConfirmed = true;
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
    const sessions = await Session.find({ patientId: req.params.patientId })
      .sort({ createdAt: -1 });
    res.status(200).json(sessions);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};
