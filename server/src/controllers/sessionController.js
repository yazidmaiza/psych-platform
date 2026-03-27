
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
// @PUT /api/sessions/:id/end
exports.endSession = async (req, res) => {
  try {
    const session = await Session.findById(req.params.id);
    if (!session) return res.status(404).json({ message: 'Session not found' });
    
    if (session.psychologistId.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Access denied' });
    }

    await Session.findByIdAndUpdate(req.params.id, { status: 'completed' });
    
    // Get patient details for notification
    const patient = await User.findById(session.patientId);
    const psychologist = await User.findById(session.psychologistId);
    
    // Send Socket.io notification to patient
    req.app.get('io').emit(`session_ended_${session.patientId}`, {
      sessionId: session._id,
      psychologistName: `${psychologist.firstName} ${psychologist.lastName}`,
      message: 'Your session has ended. Please rate your consultation.',
      ratingUrl: `${process.env.CLIENT_URL || 'http://localhost:3000'}/rate/${session.psychologistId}`
    });
    
    // Send email notification
    try {
      await sendEmail({
        to: patient.email,
        subject: 'Session Completed - Please Rate Your Consultation',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #2563eb;">Session Completed</h2>
            <p>Hello ${patient.email},</p>
            <p>Your consultation with <strong>${psychologist.firstName} ${psychologist.lastName}</strong> has been completed.</p>
            <p>Please take a moment to rate your experience to help us improve our service.</p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${process.env.CLIENT_URL || 'http://localhost:3000'}/rate/${session.psychologistId}" 
                 style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
                Rate Your Consultation
              </a>
            </div>
            <p style="color: #6b7280; font-size: 14px;">This link will remain active for 7 days.</p>
          </div>
        `
      });
      console.log('Session end notification email sent to:', patient.email);
    } catch (emailErr) {
      console.error('Failed to send session end email:', emailErr);
      // Continue even if email fails
    }
    
    res.status(200).json({ 
      message: 'Session ended',
      sessionId: req.params.id,
      patientId: session.patientId,
      psychologistId: session.psychologistId,
      notificationSent: true
    });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};