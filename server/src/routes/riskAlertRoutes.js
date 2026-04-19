const express = require('express');
const router = express.Router();
const RiskAlert = require('../models/RiskAlert');
const { protect, restrictTo } = require('../middleware/authMiddleware');

/**
 * GET /api/risk-alerts
 * Returns all unacknowledged risk alerts for patients linked to the requesting psychologist.
 */
router.get('/', protect, restrictTo('psychologist', 'admin'), async (req, res) => {
  try {
    const alerts = await RiskAlert.find({
      psychologistId: req.user.id,
      isAcknowledged: false
    })
      .populate('patientId', 'name email')
      .sort({ createdAt: -1 })
      .limit(100);

    res.status(200).json(alerts);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

/**
 * GET /api/risk-alerts/all
 * Returns ALL alerts (acknowledged + not) for the psychologist — for history view.
 */
router.get('/all', protect, restrictTo('psychologist', 'admin'), async (req, res) => {
  try {
    const alerts = await RiskAlert.find({ psychologistId: req.user.id })
      .populate('patientId', 'name email')
      .sort({ createdAt: -1 })
      .limit(200);

    res.status(200).json(alerts);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

/**
 * GET /api/risk-alerts/patient/:patientId
 * Returns all risk alerts for a specific patient (for PatientDetail page).
 */
router.get('/patient/:patientId', protect, restrictTo('psychologist', 'admin'), async (req, res) => {
  try {
    const alerts = await RiskAlert.find({
      patientId: req.params.patientId,
      psychologistId: req.user.id
    })
      .sort({ createdAt: -1 })
      .limit(50);

    res.status(200).json(alerts);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

/**
 * PUT /api/risk-alerts/:id/acknowledge
 * Marks a risk alert as acknowledged by the psychologist.
 */
router.put('/:id/acknowledge', protect, restrictTo('psychologist', 'admin'), async (req, res) => {
  try {
    const alert = await RiskAlert.findById(req.params.id);
    if (!alert) return res.status(404).json({ message: 'Alert not found' });

    if (alert.psychologistId.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Access denied' });
    }

    alert.isAcknowledged = true;
    alert.acknowledgedAt = new Date();
    await alert.save();

    res.status(200).json(alert);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

module.exports = router;
