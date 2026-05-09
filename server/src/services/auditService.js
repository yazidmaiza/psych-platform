const AuditEvent = require('../models/AuditEvent');

const getReqIp = (req) => {
  // Trust proxy is not configured; keep this conservative.
  return String(req.ip || req.connection?.remoteAddress || '');
};

const getReqUserAgent = (req) => String(req.headers['user-agent'] || '');

const sanitizeText = (value, maxLen) => {
  const s = String(value || '');
  // Prevent log injection / unbounded growth
  const compact = s.replace(/\u0000/g, '').slice(0, maxLen);
  return compact;
};

const sanitizeAction = (value) => {
  const s = sanitizeText(value, 80).toUpperCase();
  // Keep action to a conservative charset.
  return s.replace(/[^A-Z0-9_:-]/g, '_');
};

const audit = async (req, { action, targetType = '', targetId = '', outcome, severity = 'info', message = '', metadata = {} }) => {
  try {
    await AuditEvent.create({
      actorUserId: req?.user?.id || null,
      actorRole: req?.user?.role || '',
      action: sanitizeAction(action),
      targetType,
      targetId: String(targetId || ''),
      outcome,
      severity: sanitizeText(severity, 20),
      message: sanitizeText(message, 2000),
      requestIp: getReqIp(req),
      requestUserAgent: getReqUserAgent(req),
      correlationId: sanitizeText(req?.correlationId || req?.headers?.['x-correlation-id'] || '', 120),
      requestMethod: sanitizeText(req?.method || '', 16),
      requestPath: sanitizeText(req?.originalUrl || req?.url || '', 500),
      metadata
    });
  } catch (err) {
    // Never block request handling on audit logging.
  }
};

module.exports = { audit };
