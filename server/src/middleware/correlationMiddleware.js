const crypto = require('crypto');

const makeCorrelationId = () => {
  try {
    return crypto.randomUUID();
  } catch (e) {
    return crypto.randomBytes(16).toString('hex');
  }
};

/**
 * Adds `req.correlationId` and mirrors it in response headers.
 * Accepts inbound `x-correlation-id` if present (sanitized/truncated).
 */
const correlationMiddleware = (req, res, next) => {
  const inbound = String(req.headers['x-correlation-id'] || '').trim();
  const correlationId = (inbound && inbound.length <= 120) ? inbound : makeCorrelationId();
  req.correlationId = correlationId;
  res.setHeader('x-correlation-id', correlationId);
  next();
};

module.exports = { correlationMiddleware };

