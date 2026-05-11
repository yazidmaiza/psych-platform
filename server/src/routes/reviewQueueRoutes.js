const express = require('express');
const router = express.Router();

const { protect, restrictTo } = require('../middleware/authMiddleware');
const { requireAdminPermission } = require('../middleware/permissionMiddleware');
const { listApplications, getApplication } = require('../controllers/reviewQueueController');

// Admin review queue (UC-08)
router.get('/applications', protect, restrictTo('admin'), requireAdminPermission('ONBOARDING_REVIEW'), listApplications);
router.get('/applications/:id', protect, restrictTo('admin'), requireAdminPermission('ONBOARDING_REVIEW'), getApplication);

module.exports = router;

