const AuditEvent = require('../models/AuditEvent');
const { audit } = require('../services/auditService');

const clampInt = (value, { min, max, fallback }) => {
  const n = Number.parseInt(String(value), 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
};

const parseDate = (value) => {
  if (!value) return null;
  const d = new Date(String(value));
  if (Number.isNaN(d.getTime())) return null;
  return d;
};

const allowedOutcome = new Set(['success', 'failure']);
const allowedSeverity = new Set(['debug', 'info', 'warn', 'error', 'security']);

const escapeRegex = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// @GET /api/audit-events
exports.listAuditEvents = async (req, res) => {
  try {
    const page = clampInt(req.query.page, { min: 1, max: 100000, fallback: 1 });
    const limit = clampInt(req.query.limit, { min: 1, max: 100, fallback: 50 });

    const dateFrom = parseDate(req.query.dateFrom);
    const dateTo = parseDate(req.query.dateTo);
    if (req.query.dateFrom && !dateFrom) return res.status(400).json({ message: 'Invalid dateFrom' });
    if (req.query.dateTo && !dateTo) return res.status(400).json({ message: 'Invalid dateTo' });

    const action = String(req.query.action || '').trim();
    const outcome = String(req.query.outcome || '').trim();
    const severity = String(req.query.severity || '').trim();
    const actorUserId = String(req.query.actorUserId || '').trim();
    const targetType = String(req.query.targetType || '').trim();
    const targetId = String(req.query.targetId || '').trim();
    const correlationId = String(req.query.correlationId || '').trim();
    const search = String(req.query.search || '').trim();

    if (outcome && !allowedOutcome.has(outcome)) return res.status(400).json({ message: 'Invalid outcome' });
    if (severity && !allowedSeverity.has(severity)) return res.status(400).json({ message: 'Invalid severity' });
    if (action && action.length > 80) return res.status(400).json({ message: 'Invalid action' });
    if (search.length > 200) return res.status(400).json({ message: 'Search is too long' });
    if (correlationId.length > 120) return res.status(400).json({ message: 'Invalid correlationId' });
    if (targetType.length > 80) return res.status(400).json({ message: 'Invalid targetType' });
    if (targetId.length > 200) return res.status(400).json({ message: 'Invalid targetId' });

    const filter = {};
    if (dateFrom || dateTo) {
      filter.createdAt = {};
      if (dateFrom) filter.createdAt.$gte = dateFrom;
      if (dateTo) filter.createdAt.$lte = dateTo;
    }
    if (action) filter.action = action.toUpperCase();
    if (outcome) filter.outcome = outcome;
    if (severity) filter.severity = severity;
    if (actorUserId) filter.actorUserId = actorUserId;
    if (targetType) filter.targetType = targetType;
    if (targetId) filter.targetId = targetId;
    if (correlationId) filter.correlationId = correlationId;
    if (search) {
      const rx = new RegExp(escapeRegex(search), 'i');
      filter.$or = [{ message: rx }, { requestPath: rx }, { action: rx }, { targetId: rx }];
    }

    const skip = (page - 1) * limit;
    const [total, items] = await Promise.all([
      AuditEvent.countDocuments(filter),
      AuditEvent.find(filter)
        .sort({ createdAt: -1, _id: -1 })
        .skip(skip)
        .limit(limit)
        .select('actorUserId actorRole action targetType targetId outcome severity message requestIp requestUserAgent correlationId requestMethod requestPath createdAt')
        .lean()
    ]);

    await audit(req, {
      action: 'AUDIT_LOG_LIST',
      targetType: 'AuditEvent',
      targetId: '',
      outcome: 'success',
      severity: 'security',
      metadata: {
        page,
        limit,
        action: action || null,
        outcome: outcome || null,
        severity: severity || null,
        actorUserId: actorUserId || null,
        targetType: targetType || null,
        targetId: targetId || null,
        correlationId: correlationId || null,
        dateFrom: dateFrom ? dateFrom.toISOString() : null,
        dateTo: dateTo ? dateTo.toISOString() : null,
        search: search || null
      }
    });

    return res.status(200).json({ page, limit, total, items });
  } catch (err) {
    return res.status(500).json({ message: 'Server error' });
  }
};

// @GET /api/audit-events/:id
exports.getAuditEvent = async (req, res) => {
  try {
    const id = String(req.params.id || '');
    if (!id) return res.status(400).json({ message: 'Missing id' });

    const event = await AuditEvent.findById(id).lean();
    if (!event) return res.status(404).json({ message: 'Not found' });

    await audit(req, {
      action: 'AUDIT_LOG_VIEW',
      targetType: 'AuditEvent',
      targetId: id,
      outcome: 'success',
      severity: 'security'
    });

    return res.status(200).json(event);
  } catch (err) {
    return res.status(500).json({ message: 'Server error' });
  }
};

