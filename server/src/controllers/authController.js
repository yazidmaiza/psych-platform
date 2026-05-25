const User = require('../models/User');
const Psychologist = require('../models/Psychologist');
const PendingRegistration = require('../models/PendingRegistration');
const LoginOtpToken = require('../models/LoginOtpToken');
const EmailVerificationToken = require('../models/EmailVerificationToken');
const PasswordResetToken = require('../models/PasswordResetToken');
const sendEmail = require('../utils/sendEmail');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');
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
const CredentialDocument = require('../models/CredentialDocument');
const { getPrivateUploadsRoot } = require('../utils/uploadRoots');
const { sha256File, buildStorageRelativePath, resolvePrivatePath } = require('../services/credentialDocumentStorage');

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

const generateNumericCode = (length = 6) => {
  const n = Number(length);
  if (!Number.isFinite(n) || n < 4 || n > 10) {
    throw new Error('Invalid code length');
  }
  const max = 10 ** n;
  return crypto.randomInt(0, max).toString().padStart(n, '0');
};

const safeBasename = (name) => {
  const base = path.basename(String(name || 'file'));
  return base.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 200) || 'file';
};

const persistPendingUpload = ({ pendingId, type, multerFile }) => {
  const filename = safeBasename(multerFile.originalname);
  const rel = path.posix.join('pending_registrations', String(pendingId), String(type), filename);
  const root = getPrivateUploadsRoot();
  const normalized = path.posix.normalize(rel);
  const absolute = path.resolve(root, normalized);
  fs.mkdirSync(path.dirname(absolute), { recursive: true });
  fs.renameSync(multerFile.path, absolute);
  const checksumSha256 = sha256File(absolute);
  return {
    storagePath: normalized,
    originalName: multerFile.originalname,
    mimeType: multerFile.mimetype,
    sizeBytes: multerFile.size,
    checksumSha256
  };
};

const movePendingToCredentialStorage = ({ ownerUserId, type, version, pendingStoragePath, originalName }) => {
  const { absolute: pendingAbs, root: pendingRoot } = (() => {
    const root = getPrivateUploadsRoot();
    const normalized = path.posix.normalize(String(pendingStoragePath || '').replace(/\\/g, '/'));
    if (normalized.includes('..')) throw new Error('Invalid storage path');
    const absolute = path.resolve(root, normalized);
    const resolvedRoot = path.resolve(root);
    if (!absolute.startsWith(resolvedRoot + path.sep)) throw new Error('Invalid storage path');
    return { absolute, root: resolvedRoot, normalized };
  })();

  if (!fs.existsSync(pendingAbs)) throw new Error('Pending file missing');

  const destStoragePath = buildStorageRelativePath({ ownerUserId, type, version, originalName });
  const { absolute: destAbs } = resolvePrivatePath(destStoragePath);
  fs.mkdirSync(path.dirname(destAbs), { recursive: true });
  fs.renameSync(pendingAbs, destAbs);
  const checksumSha256 = sha256File(destAbs);

  // Best-effort cleanup of empty pending folders.
  try {
    const dir = path.dirname(pendingAbs);
    if (dir.startsWith(pendingRoot) && fs.existsSync(dir) && fs.readdirSync(dir).length === 0) {
      fs.rmdirSync(dir, { recursive: true });
    }
  } catch {}

  return { storagePath: destStoragePath, absolutePath: destAbs, checksumSha256 };
};

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

// @POST /api/auth/register/start
exports.startRegistration = async (req, res) => {
  try {
    const { email, password, role, fullName, telephone, birthDate } = req.body;

    const existing = await User.findOne({ email });
    if (existing) return res.status(400).json({ message: 'Email already in use' });

    // Store raw password only for short-lived pending registrations.
    const rawPassword = String(password || '');
    const code = generateNumericCode(6);
    const codeHash = hashToken(code);
    const codeExpiresAt = new Date(Date.now() + 15 * 60 * 1000);

    const pending = await PendingRegistration.create({
      email: String(email || '').trim().toLowerCase(),
      role,
      passwordHash: rawPassword,
      fullName: fullName ? String(fullName).trim() : '',
      telephone: telephone ? String(telephone).trim() : '',
      birthDate: birthDate ? String(birthDate).trim() : '',
      psychologistProfile: role === 'psychologist' ? {
        firstName: req.body.firstName ? String(req.body.firstName).trim() : '',
        lastName: req.body.lastName ? String(req.body.lastName).trim() : '',
        bio: req.body.bio ? String(req.body.bio).trim() : '',
        city: req.body.city ? String(req.body.city).trim() : '',
        country: req.body.country ? String(req.body.country).trim() : '',
        sessionPrice: Number(req.body.sessionPrice || 0) || 0,
        specializations: Array.isArray(req.body.specializations) ? req.body.specializations.map(String) : [],
        languages: Array.isArray(req.body.languages) ? req.body.languages.map(String) : []
      } : undefined,
      documents: {},
      codeHash,
      codeExpiresAt,
      createdIp: req.ip || '',
      createdUserAgent: req.get('user-agent') || ''
    });

    await sendEmail({
      to: pending.email,
      subject: 'Your verification code',
      html: `<p>Your verification code is:</p><p style="font-size:20px"><b>${code}</b></p><p>This code expires soon.</p>`
    });

    return res.status(201).json({
      message: 'Verification code sent',
      pendingId: pending._id,
      email: pending.email,
      role: pending.role,
      expiresAt: codeExpiresAt.toISOString()
    });
  } catch (err) {
    return res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// @POST /api/auth/register/confirm
exports.confirmRegistration = async (req, res) => {
  try {
    const pendingId = req.body.pendingId || req.body.id;
    const email = String(req.body.email || '').trim().toLowerCase();
    const code = String(req.body.code || req.body.otp || '').trim();

    if (!pendingId || !email || !code) {
      return res.status(400).json({ message: 'pendingId, email and code are required' });
    }

    const pending = await PendingRegistration.findById(pendingId);
    if (!pending || String(pending.email) !== email) {
      return res.status(400).json({ message: 'Invalid or expired verification code' });
    }
    if (pending.codeUsedAt || pending.codeExpiresAt < new Date()) {
      return res.status(400).json({ message: 'Invalid or expired verification code' });
    }

    const codeHash = hashToken(code);
    if (codeHash !== pending.codeHash) {
      return res.status(400).json({ message: 'Invalid or expired verification code' });
    }

    const existing = await User.findOne({ email: pending.email });
    if (existing) return res.status(400).json({ message: 'Email already in use' });

    const user = await User.create({
      email: pending.email,
      password: pending.passwordHash,
      role: pending.role,
      fullName: pending.fullName || '',
      telephone: pending.telephone || '',
      birthDate: pending.birthDate || '',
      isVerified: true
    });

    // Ensure psychologists have a draft onboarding record and persist profile fields.
    let psychologist = null;
    if (user.role === 'psychologist') {
      psychologist = await Psychologist.findOne({ userId: user._id });
      if (!psychologist) {
        psychologist = await Psychologist.create({
          userId: user._id,
          profileStatus: 'Draft',
          isApproved: false,
          isRejected: false,
          firstName: pending.psychologistProfile?.firstName || '',
          lastName: pending.psychologistProfile?.lastName || '',
          bio: pending.psychologistProfile?.bio || '',
          city: pending.psychologistProfile?.city || '',
          country: pending.psychologistProfile?.country || '',
          sessionPrice: Number(pending.psychologistProfile?.sessionPrice || 0) || 0,
          specializations: pending.psychologistProfile?.specializations || [],
          languages: pending.psychologistProfile?.languages || []
        });
      } else {
        await Psychologist.updateOne(
          { _id: psychologist._id },
          {
            $set: {
              firstName: pending.psychologistProfile?.firstName || '',
              lastName: pending.psychologistProfile?.lastName || '',
              bio: pending.psychologistProfile?.bio || '',
              city: pending.psychologistProfile?.city || '',
              country: pending.psychologistProfile?.country || '',
              sessionPrice: Number(pending.psychologistProfile?.sessionPrice || 0) || 0,
              specializations: pending.psychologistProfile?.specializations || [],
              languages: pending.psychologistProfile?.languages || []
            }
          }
        );
      }

      // Attach uploaded pending docs as CredentialDocuments (v1) and link to psychologist.
      const docTypes = ['cv', 'diploma', 'idFront', 'idBack', 'introVideo'];
      const credentialDocIds = {};
      for (const type of docTypes) {
        const meta = pending.documents?.[type];
        if (!meta?.storagePath) continue;
        const moved = movePendingToCredentialStorage({
          ownerUserId: user._id,
          type,
          version: 1,
          pendingStoragePath: meta.storagePath,
          originalName: meta.originalName || 'file'
        });
        const doc = await CredentialDocument.create({
          ownerUserId: user._id,
          psychologistId: psychologist?._id,
          type,
          version: 1,
          isCurrent: true,
          replacedBy: null,
          storagePath: moved.storagePath,
          originalName: meta.originalName || '',
          mimeType: meta.mimeType,
          sizeBytes: meta.sizeBytes,
          checksumSha256: moved.checksumSha256,
          uploadedByUserId: user._id
        });
        credentialDocIds[type] = doc._id;
      }

      if (psychologist && Object.keys(credentialDocIds).length > 0) {
        await Psychologist.updateOne(
          { _id: psychologist._id },
          {
            $set: Object.fromEntries(Object.entries(credentialDocIds).map(([k, v]) => [`credentialDocs.${k}`, v]))
          }
        );
      }
    }

    pending.codeUsedAt = new Date();
    await pending.save();

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

    return res.status(201).json(buildAuthResponse({
      user,
      accessToken,
      refreshToken: sessionResult.refreshToken,
      sessionId: sessionResult.session._id
    }));
  } catch (err) {
    return res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// @POST /api/auth/register/pending/:id/documents
exports.uploadPendingRegistrationDocuments = async (req, res) => {
  try {
    const pendingId = String(req.params.id || '');
    if (!pendingId) return res.status(400).json({ message: 'Missing pending id' });

    const pending = await PendingRegistration.findById(pendingId);
    if (!pending) return res.status(404).json({ message: 'Pending registration not found' });
    if (pending.codeUsedAt || pending.codeExpiresAt < new Date()) {
      // Cleanup any uploaded files to avoid orphaned uploads.
      Object.values(req.files || {}).flat().forEach((f) => {
        try { if (f?.path && fs.existsSync(f.path)) fs.unlinkSync(f.path); } catch {}
      });
      return res.status(400).json({ message: 'Pending registration expired' });
    }
    if (pending.role !== 'psychologist') {
      return res.status(400).json({ message: 'Documents are only accepted for psychologist registrations' });
    }

    const nextDocs = { ...(pending.documents || {}) };
    for (const type of ['cv', 'diploma', 'idFront', 'idBack', 'introVideo']) {
      const file = (req.files?.[type] || [])[0] || null;
      if (!file) continue;
      nextDocs[type] = persistPendingUpload({ pendingId, type, multerFile: file });
    }

    pending.documents = nextDocs;
    await pending.save();

    return res.status(200).json({ message: 'Documents uploaded', documents: Object.keys(nextDocs) });
  } catch (err) {
    return res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// @POST /api/auth/register/pending/:id/resend
exports.resendPendingRegistrationCode = async (req, res) => {
  try {
    const pendingId = String(req.params.id || '');
    if (!pendingId) return res.status(400).json({ message: 'Missing pending id' });

    const pending = await PendingRegistration.findById(pendingId);
    if (!pending || pending.codeUsedAt) {
      return res.status(200).json({ message: 'If the email exists, a verification code has been sent.' });
    }

    if (pending.codeExpiresAt < new Date()) {
      // expired pending: do not keep resending indefinitely
      return res.status(400).json({ message: 'Pending registration expired. Please register again.' });
    }

    const code = generateNumericCode(6);
    pending.codeHash = hashToken(code);
    pending.codeExpiresAt = new Date(Date.now() + 15 * 60 * 1000);
    await pending.save();

    await sendEmail({
      to: pending.email,
      subject: 'Your verification code',
      html: `<p>Your verification code is:</p><p style="font-size:20px"><b>${code}</b></p><p>This code expires soon.</p>`
    });

    return res.status(200).json({ message: 'Verification code sent.' });
  } catch (err) {
    return res.status(500).json({ message: 'Server error', error: err.message });
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

    // 2FA for all non-admin users: send a login code and require verification before issuing tokens.
    if (user.role !== 'admin') {
      const code = generateNumericCode(6);
      const tokenHash = hashToken(code);
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

      await LoginOtpToken.create({
        userId: user._id,
        tokenHash,
        expiresAt,
        usedAt: null,
        createdIp: req.ip || '',
        createdUserAgent: req.get('user-agent') || ''
      });

      await sendEmail({
        to: user.email,
        subject: 'Your login code',
        html: `<p>Your login code is:</p><p style="font-size:20px"><b>${code}</b></p><p>This code expires soon.</p>`
      });

      return res.status(200).json({
        requires2fa: true,
        message: 'Login code sent',
        email: user.email
      });
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

// @POST /api/auth/login/verify
exports.verifyLogin2fa = async (req, res) => {
  try {
    const email = String(req.body.email || '').trim().toLowerCase();
    const code = String(req.body.code || req.body.otp || '').trim();
    if (!email || !code) {
      return res.status(400).json({ message: 'Email and code are required' });
    }

    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ message: 'Invalid code' });
    if (user.role === 'admin') return res.status(400).json({ message: 'Admin does not require 2FA verification' });

    const tokenHash = hashToken(code);
    const token = await LoginOtpToken.findOne({ userId: user._id, tokenHash }).sort({ createdAt: -1 });
    if (!token || token.usedAt || token.expiresAt < new Date()) {
      return res.status(400).json({ message: 'Invalid or expired code' });
    }

    token.usedAt = new Date();
    await token.save();

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

    return res.status(200).json(buildAuthResponse({
      user,
      accessToken,
      refreshToken: sessionResult.refreshToken,
      sessionId: sessionResult.session._id
    }));
  } catch (err) {
    return res.status(500).json({ message: 'Server error', error: err.message });
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
