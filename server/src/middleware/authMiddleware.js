const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { audit } = require('../services/auditService');

const protect = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      audit(req, {
        action: 'AUTH_MISSING_TOKEN',
        targetType: 'Auth',
        targetId: '',
        outcome: 'failure',
        severity: 'security',
        message: 'Missing bearer token'
      });
      return res.status(401).json({ message: 'No token provided' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    // Normalize common JWT payload shapes across the codebase.
    const id = decoded?.id || decoded?._id || decoded?.userId || decoded?.sub;
    if (!id) {
      audit(req, {
        action: 'AUTH_INVALID_TOKEN',
        targetType: 'Auth',
        targetId: '',
        outcome: 'failure',
        severity: 'security',
        message: 'Token payload missing user id'
      });
      return res.status(401).json({ message: 'Invalid or expired token' });
    }

    // Load current user record (role/permissions) to avoid trusting stale JWT role claims.
    // Keep this lightweight: select only what we need for authorization decisions.
    User.findById(id)
      .select('role adminPermissions')
      .then((user) => {
        if (!user) {
          audit(req, {
            action: 'AUTH_INVALID_TOKEN',
            targetType: 'Auth',
            targetId: '',
            outcome: 'failure',
            severity: 'security',
            message: 'User not found for token'
          });
          return res.status(401).json({ message: 'Invalid or expired token' });
        }
        req.user = {
          ...decoded,
          id: String(user._id),
          role: user.role,
          adminPermissions: Array.isArray(user.adminPermissions) ? user.adminPermissions : []
        };
        next();
      })
      .catch(() => {
        audit(req, {
          action: 'AUTH_INVALID_TOKEN',
          targetType: 'Auth',
          targetId: '',
          outcome: 'failure',
          severity: 'security',
          message: 'Failed to load user for token'
        });
        return res.status(401).json({ message: 'Invalid or expired token' });
      });

  } catch (err) {
    audit(req, {
      action: 'AUTH_INVALID_TOKEN',
      targetType: 'Auth',
      targetId: '',
      outcome: 'failure',
      severity: 'security',
      message: 'JWT verification failed'
    });
    return res.status(401).json({ message: 'Invalid or expired token' });
  }
};

const restrictTo = (...roles) => {
  return (req, res, next) => {
    if (!req.user || !req.user.role) {
      audit(req, {
        action: 'AUTHZ_DENIED',
        targetType: 'Auth',
        targetId: '',
        outcome: 'failure',
        severity: 'security',
        message: 'Missing authenticated user in request'
      });
      return res.status(401).json({ message: 'Not authenticated' });
    }
    if (!roles.includes(req.user.role)) {
      audit(req, {
        action: 'AUTHZ_DENIED',
        targetType: 'Auth',
        targetId: '',
        outcome: 'failure',
        severity: 'security',
        message: `Role not permitted: ${String(req.user.role || '')}`,
        metadata: { allowedRoles: roles }
      });
      return res.status(403).json({ message: 'Access denied' });
    }
    next();
  };
};

module.exports = { protect, restrictTo };
