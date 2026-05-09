const express = require('express');
const router = express.Router();

const { protect, restrictTo } = require('../middleware/authMiddleware');
const { requireAdminPermission } = require('../middleware/permissionMiddleware');
const { listAuditEvents, getAuditEvent } = require('../controllers/auditEventController');

router.get('/', protect, restrictTo('admin'), requireAdminPermission('AUDIT_VIEW'), listAuditEvents);
router.get('/:id', protect, restrictTo('admin'), requireAdminPermission('AUDIT_VIEW'), getAuditEvent);

module.exports = router;

