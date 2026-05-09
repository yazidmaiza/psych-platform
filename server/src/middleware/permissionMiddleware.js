/**
 * Permission middleware (RBAC add-on)
 *
 * Current roles: patient, psychologist, admin
 * Optional fine-grained permissions for admins via User.adminPermissions[].
 *
 * Backward-compatible behavior:
 * - If adminPermissions is unset/empty for an admin user, allow access.
 *   This prevents breaking existing deployments where admins were role-only.
 */

const { audit } = require('../services/auditService');

const requireAdminPermission = (permission) => (req, res, next) => {
  const user = req.user;
  if (!user || user.role !== 'admin') {
    audit(req, {
      action: 'AUTHZ_DENIED',
      targetType: 'Auth',
      targetId: '',
      outcome: 'failure',
      severity: 'security',
      message: 'Admin permission required',
      metadata: { permission }
    });
    return res.status(403).json({ message: 'Access denied' });
  }

  const perms = Array.isArray(user.adminPermissions) ? user.adminPermissions : [];
  if (perms.length === 0) return next();

  if (!perms.includes(permission)) {
    audit(req, {
      action: 'AUTHZ_DENIED',
      targetType: 'Auth',
      targetId: '',
      outcome: 'failure',
      severity: 'security',
      message: 'Insufficient admin privileges',
      metadata: { permission }
    });
    return res.status(403).json({ message: 'Insufficient privileges' });
  }
  return next();
};

module.exports = { requireAdminPermission };
