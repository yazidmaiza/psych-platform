const jwt = require('jsonwebtoken');
const User = require('../models/User');
const AuthSession = require('../models/AuthSession');

const protect = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'No token provided' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id).select('role isVerified passwordChangedAt');

    if (!user) {
      return res.status(401).json({ message: 'Invalid or expired token' });
    }

    if (user.passwordChangedAt && decoded.iat * 1000 < user.passwordChangedAt.getTime()) {
      return res.status(401).json({ message: 'Token expired. Please log in again.' });
    }

    if (decoded.sid) {
      const session = await AuthSession.findById(decoded.sid);
      if (!session || session.revokedAt || session.expiresAt < new Date()) {
        return res.status(401).json({ message: 'Session revoked. Please log in again.' });
      }
      req.authSession = session;
    }

    const allowUnverified = process.env.AUTH_ALLOW_UNVERIFIED === 'true';
    if (!user.isVerified && !allowUnverified) {
      return res.status(403).json({
        message: 'Email verification required',
        requiresEmailVerification: true
      });
    }

    req.user = {
      id: user._id.toString(),
      role: user.role,
      isVerified: user.isVerified,
      sessionId: decoded.sid || null
    };
    next();

  } catch (err) {
    return res.status(401).json({ message: 'Invalid or expired token' });
  }
};

const restrictTo = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ message: 'Access denied' });
    }
    next();
  };
};

module.exports = { protect, restrictTo };
