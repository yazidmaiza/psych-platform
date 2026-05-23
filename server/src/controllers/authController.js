const User = require('../models/User');
const Psychologist = require('../models/Psychologist');
const EmailVerificationToken = require('../models/EmailVerificationToken');
const PasswordResetToken = require('../models/PasswordResetToken');
const sendEmail = require('../utils/sendEmail');
const {
  hashToken,
  createAccessToken,
  createRefreshSession,
  rotateRefreshToken,
  revokeSession,
  revokeAllSessionsForUser,
  createEmailVerificationToken,
  createPasswordResetToken,
  logAuditEvent
} = require('../services/authService');

const getRequestContext = (req) => ({
  ipAddress: req.headers['x-forwarded-for']?.toString().split(',')[0]?.trim() || req.ip || '',
  userAgent: req.get('user-agent') || '',
  deviceId: req.body.deviceId || req.headers['x-device-id'] || ''
});

const buildAuthResponse = ({ user, accessToken, refreshToken, sessionId }) => ({
  token: accessToken,
  accessToken,
  refreshToken,
  sessionId,
  requiresEmailVerification: !user.isVerified,
  user: {
    id: user._id,
    email: user.email,
    firstName: user.firstName || '',
    lastName: user.lastName || '',
    fullName: user.fullName || '',
    telephone: user.telephone || '',
    birthDate: user.birthDate || '',
    photo: user.photo || '',
    role: user.role,
    isVerified: user.isVerified
  }
});

// @POST /api/auth/register
exports.register = async (req, res) => {
  try {
    const { email, password, role, fullName, telephone, birthDate } = req.body;

    const existing = await User.findOne({ email });
    if (existing) {
      return res.status(400).json({ message: 'Email already in use' });
    }

    const user = new User({
      email,
      password,
      role,
      fullName: fullName ? String(fullName).trim() : '',
      telephone: telephone ? String(telephone).trim() : '',
      birthDate: birthDate ? String(birthDate).trim() : ''
    });
    await user.save();

    // Ensure psychologists have a draft onboarding record to attach credential documents to.
    if (user.role === 'psychologist') {
      const existingPsychologist = await Psychologist.findOne({ userId: user._id }).select('_id');
      if (!existingPsychologist) {
        await Psychologist.create({
          userId: user._id,
          profileStatus: 'Draft',
          isApproved: false,
          isRejected: false,
          firstName: '',
          lastName: '',
          city: ''
        });
      }
    }

    const { ipAddress, userAgent, deviceId } = getRequestContext(req);
    const sessionResult = await createRefreshSession({
      userId: user._id,
      ipAddress,
      userAgent,
      deviceId
    });
    const accessToken = createAccessToken({
      userId: user._id,
      role: user.role,
      sessionId: sessionResult.session._id
    });

    const verificationToken = await createEmailVerificationToken(user._id);
    await sendEmail({
      to: user.email,
      subject: 'Your verification code',
      html: `<p>Welcome to Psych Platform.</p><p>Your verification code is:</p><p style="font-size:20px"><b>${verificationToken}</b></p><p>This code expires soon. If you didn't request it, you can ignore this email.</p>`
    });

    await logAuditEvent({
      userId: user._id,
      action: 'auth.register',
      ipAddress,
      userAgent,
      metadata: { role: user.role }
    });

    res.status(201).json(buildAuthResponse({
      user,
      accessToken,
      refreshToken: sessionResult.refreshToken,
      sessionId: sessionResult.session._id
    }));

  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// @POST /api/auth/login
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    if (user.lockUntil && user.lockUntil > new Date()) {
      return res.status(429).json({ message: 'Account temporarily locked. Please try again later.' });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      user.failedLoginAttempts = (user.failedLoginAttempts || 0) + 1;
      if (user.failedLoginAttempts >= 5) {
        user.lockUntil = new Date(Date.now() + 15 * 60 * 1000);
      }
      await user.save();
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    user.failedLoginAttempts = 0;
    user.lockUntil = null;
    user.lastLoginAt = new Date();
    await user.save();

    const { ipAddress, userAgent, deviceId } = getRequestContext(req);
    const sessionResult = await createRefreshSession({
      userId: user._id,
      ipAddress,
      userAgent,
      deviceId
    });
    const accessToken = createAccessToken({
      userId: user._id,
      role: user.role,
      sessionId: sessionResult.session._id
    });

    await logAuditEvent({
      userId: user._id,
      action: 'auth.login',
      ipAddress,
      userAgent
    });

    res.status(200).json(buildAuthResponse({
      user,
      accessToken,
      refreshToken: sessionResult.refreshToken,
      sessionId: sessionResult.session._id
    }));

  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// @GET /api/auth/me
exports.getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    res.status(200).json(user);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// @POST /api/auth/refresh
exports.refreshToken = async (req, res) => {
  try {
    const refreshToken = req.body.refreshToken || req.headers['x-refresh-token'];
    if (!refreshToken) {
      return res.status(400).json({ message: 'Refresh token is required' });
    }

    const { ipAddress, userAgent, deviceId } = getRequestContext(req);
    const rotateResult = await rotateRefreshToken({ refreshToken, ipAddress, userAgent, deviceId });

    if (rotateResult.error === 'reuse') {
      return res.status(401).json({ message: 'Refresh token reuse detected. Please log in again.' });
    }

    if (rotateResult.error) {
      return res.status(401).json({ message: 'Invalid or expired refresh token' });
    }

    const user = await User.findById(rotateResult.session.userId);
    if (!user) {
      return res.status(401).json({ message: 'Invalid session' });
    }

    const accessToken = createAccessToken({
      userId: user._id,
      role: user.role,
      sessionId: rotateResult.newSession._id
    });

    await logAuditEvent({
      userId: user._id,
      action: 'auth.refresh',
      ipAddress,
      userAgent
    });

    res.status(200).json(buildAuthResponse({
      user,
      accessToken,
      refreshToken: rotateResult.refreshToken,
      sessionId: rotateResult.newSession._id
    }));
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// @POST /api/auth/logout
exports.logout = async (req, res) => {
  try {
    if (req.user.sessionId) {
      await revokeSession({ sessionId: req.user.sessionId, reason: 'logout' });
    }

    await logAuditEvent({
      userId: req.user.id,
      action: 'auth.logout',
      ipAddress: req.ip,
      userAgent: req.get('user-agent')
    });

    res.status(200).json({ message: 'Logged out' });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// @POST /api/auth/logout-all
exports.logoutAll = async (req, res) => {
  try {
    await revokeAllSessionsForUser(req.user.id);

    await logAuditEvent({
      userId: req.user.id,
      action: 'auth.logout_all',
      ipAddress: req.ip,
      userAgent: req.get('user-agent')
    });

    res.status(200).json({ message: 'All sessions revoked' });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// @GET /api/auth/sessions
exports.listSessions = async (req, res) => {
  try {
    const sessions = await require('../models/AuthSession')
      .find({ userId: req.user.id })
      .sort({ createdAt: -1 })
      .lean();

    res.json(sessions.map((s) => ({
      id: s._id,
      createdAt: s.createdAt,
      lastUsedAt: s.lastUsedAt,
      ipAddress: s.ipAddress,
      userAgent: s.userAgent,
      deviceId: s.deviceId,
      revokedAt: s.revokedAt,
      current: req.user.sessionId && String(req.user.sessionId) === String(s._id)
    })));
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// @POST /api/auth/sessions/:id/revoke
exports.revokeSessionById = async (req, res) => {
  try {
    const sessionId = req.params.id;
    const session = await require('../models/AuthSession').findOne({
      _id: sessionId,
      userId: req.user.id
    });

    if (!session) return res.status(404).json({ message: 'Session not found' });

    await revokeSession({ sessionId, reason: 'user_revoke' });
    res.json({ message: 'Session revoked' });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// @POST /api/auth/password/forgot
exports.requestPasswordReset = async (req, res) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email });

    if (user) {
      const rawToken = await createPasswordResetToken(user._id);
      await sendEmail({
        to: user.email,
        subject: 'Your password reset code',
        text: `You requested a password reset.\n\nYour password reset code is: ${rawToken}\n\nThis code expires soon. If you didn't request it, you can ignore this email.`,
        html: `<p>You requested a password reset.</p><p>Your password reset code is:</p><p style="font-size:20px"><b>${rawToken}</b></p><p>Enter this code on the reset password page.</p><p>This code expires soon. If you didn't request it, you can ignore this email.</p>`
      });

      await logAuditEvent({
        userId: user._id,
        action: 'auth.password_reset_requested',
        ipAddress: req.ip,
        userAgent: req.get('user-agent')
      });
    }

    res.status(200).json({ message: 'If the email exists, a reset code has been sent.' });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// @POST /api/auth/password/reset
exports.resetPassword = async (req, res) => {
  try {
    const { email, password } = req.body;
    const code = req.body.code || req.body.otp || req.body.token;

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: 'Invalid or expired reset code' });
    }

    const tokenHash = hashToken(code);
    const resetToken = await PasswordResetToken.findOne({ userId: user._id, tokenHash });

    if (!resetToken || resetToken.usedAt || resetToken.expiresAt < new Date()) {
      return res.status(400).json({ message: 'Invalid or expired reset code' });
    }

    user.password = password;
    await user.save();

    resetToken.usedAt = new Date();
    await resetToken.save();

    await revokeAllSessionsForUser(user._id);

    await logAuditEvent({
      userId: user._id,
      action: 'auth.password_reset_completed',
      ipAddress: req.ip,
      userAgent: req.get('user-agent')
    });

    res.status(200).json({ message: 'Password updated successfully' });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// @POST /api/auth/verify-email
exports.verifyEmail = async (req, res) => {
  try {
    const { email } = req.body;
    const code = req.body.code || req.body.otp;
    if (!email || !code) {
      return res.status(400).json({ message: 'Email and code are required' });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: 'Invalid or expired verification code' });
    }

    const tokenHash = hashToken(code);
    const verification = await EmailVerificationToken.findOne({ userId: user._id, tokenHash });

    if (!verification || verification.usedAt || verification.expiresAt < new Date()) {
      return res.status(400).json({ message: 'Invalid or expired verification code' });
    }

    user.isVerified = true;
    await user.save();

    verification.usedAt = new Date();
    await verification.save();

    await logAuditEvent({
      userId: user._id,
      action: 'auth.email_verified',
      ipAddress: req.ip,
      userAgent: req.get('user-agent')
    });

    res.json({ message: 'Email verified successfully.' });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// @POST /api/auth/verify-email/resend
exports.resendVerification = async (req, res) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email });

    if (!user) {
      return res.status(200).json({ message: 'If the email exists, a verification link has been sent.' });
    }

    if (user.isVerified) {
      return res.status(200).json({ message: 'Email already verified.' });
    }

    const verificationToken = await createEmailVerificationToken(user._id);
    await sendEmail({
      to: user.email,
      subject: 'Your verification code',
      html: `<p>Your verification code is:</p><p style="font-size:20px"><b>${verificationToken}</b></p><p>This code expires soon. If you didn't request it, you can ignore this email.</p>`
    });

    res.json({ message: 'Verification email sent.' });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};
