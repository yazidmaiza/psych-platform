const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const AuthSession = require('../models/AuthSession');
const EmailVerificationToken = require('../models/EmailVerificationToken');
const PasswordResetToken = require('../models/PasswordResetToken');
const AuditLog = require('../models/AuditLog');

const ACCESS_TOKEN_TTL = process.env.ACCESS_TOKEN_TTL || '15m';
const REFRESH_TOKEN_TTL_DAYS = Number(process.env.REFRESH_TOKEN_TTL_DAYS || 30);
const PASSWORD_RESET_TTL_MINUTES = Number(process.env.PASSWORD_RESET_TTL_MINUTES || 30);
const EMAIL_VERIFY_TTL_HOURS = Number(process.env.EMAIL_VERIFY_TTL_HOURS || 24);

const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex');

const generateRawToken = () => crypto.randomBytes(32).toString('hex');

const createAccessToken = ({ userId, role, sessionId }) => {
  return jwt.sign(
    { id: userId, role, sid: sessionId },
    process.env.JWT_SECRET,
    { expiresIn: ACCESS_TOKEN_TTL }
  );
};

const createRefreshSession = async ({ userId, ipAddress, userAgent, deviceId }) => {
  const refreshToken = generateRawToken();
  const refreshTokenHash = hashToken(refreshToken);
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000);

  const session = await AuthSession.create({
    userId,
    refreshTokenHash,
    ipAddress: ipAddress || '',
    userAgent: userAgent || '',
    deviceId: deviceId || '',
    lastUsedAt: new Date(),
    expiresAt
  });

  return { refreshToken, session };
};

const rotateRefreshToken = async ({ refreshToken, ipAddress, userAgent, deviceId }) => {
  const refreshTokenHash = hashToken(refreshToken);
  const session = await AuthSession.findOne({ refreshTokenHash });

  if (!session) {
    return { error: 'invalid' };
  }

  if (session.revokedAt) {
    await AuthSession.updateMany(
      { userId: session.userId, revokedAt: null },
      { revokedAt: new Date() }
    );
    return { error: 'reuse' };
  }

  if (session.expiresAt < new Date()) {
    session.revokedAt = new Date();
    await session.save();
    return { error: 'expired' };
  }

  const newSessionResult = await createRefreshSession({
    userId: session.userId,
    ipAddress: ipAddress || session.ipAddress,
    userAgent: userAgent || session.userAgent,
    deviceId: deviceId || session.deviceId
  });

  session.revokedAt = new Date();
  session.replacedBySessionId = newSessionResult.session._id;
  session.lastUsedAt = new Date();
  await session.save();

  return {
    session,
    newSession: newSessionResult.session,
    refreshToken: newSessionResult.refreshToken
  };
};

const revokeSession = async ({ sessionId, reason }) => {
  if (!sessionId) return null;
  const update = { revokedAt: new Date() };
  if (reason) update.revokeReason = reason;
  return AuthSession.findByIdAndUpdate(sessionId, update, { new: true });
};

const revokeAllSessionsForUser = async (userId) => {
  return AuthSession.updateMany(
    { userId, revokedAt: null },
    { revokedAt: new Date() }
  );
};

const createEmailVerificationToken = async (userId) => {
  const rawToken = generateRawToken();
  const tokenHash = hashToken(rawToken);
  const expiresAt = new Date(Date.now() + EMAIL_VERIFY_TTL_HOURS * 60 * 60 * 1000);

  await EmailVerificationToken.create({
    userId,
    tokenHash,
    expiresAt
  });

  return rawToken;
};

const createPasswordResetToken = async (userId) => {
  const rawToken = generateRawToken();
  const tokenHash = hashToken(rawToken);
  const expiresAt = new Date(Date.now() + PASSWORD_RESET_TTL_MINUTES * 60 * 1000);

  await PasswordResetToken.create({
    userId,
    tokenHash,
    expiresAt
  });

  return rawToken;
};

const logAuditEvent = async ({ userId, action, ipAddress, userAgent, metadata }) => {
  try {
    await AuditLog.create({
      userId: userId || null,
      action,
      ipAddress: ipAddress || '',
      userAgent: userAgent || '',
      metadata: metadata || null
    });
  } catch (err) {
    // Avoid blocking auth flows if audit logging fails
  }
};

module.exports = {
  ACCESS_TOKEN_TTL,
  REFRESH_TOKEN_TTL_DAYS,
  PASSWORD_RESET_TTL_MINUTES,
  EMAIL_VERIFY_TTL_HOURS,
  hashToken,
  createAccessToken,
  createRefreshSession,
  rotateRefreshToken,
  revokeSession,
  revokeAllSessionsForUser,
  createEmailVerificationToken,
  createPasswordResetToken,
  logAuditEvent
};
