const express = require('express');
const router = express.Router();
const { generatePDF } = require('../controllers/reportController');
const { protect, restrictTo } = require('../middleware/authMiddleware');

router.get('/:id/report/pdf', protect, restrictTo('psychologist', 'admin'), generatePDF);

module.exports = router;