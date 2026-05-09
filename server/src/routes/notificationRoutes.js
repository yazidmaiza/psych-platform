const express = require('express');
const router = express.Router();
const Notification = require('../models/Notification');
const NotificationPreference = require('../models/NotificationPreference');
const { protect } = require('../middleware/authMiddleware');

// Get my notifications
router.get('/', protect, async (req, res) => {
  try {
    const notifications = await Notification.find({ userId: req.user.id })
      .sort({ createdAt: -1 })
      .limit(100);
    res.status(200).json(notifications);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// Get unread count
router.get('/unread-count', protect, async (req, res) => {
  try {
    const count = await Notification.countDocuments({ userId: req.user.id, isRead: false });
    res.status(200).json({ count });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// Mark one notification as read
router.put('/:id/read', protect, async (req, res) => {
  try {
    const notif = await Notification.findById(req.params.id);
    if (!notif) return res.status(404).json({ message: 'Notification not found' });
    if (notif.userId.toString() !== req.user.id) return res.status(403).json({ message: 'Access denied' });

    notif.isRead = true;
    notif.readAt = new Date();
    await notif.save();
    res.status(200).json(notif);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// Mark all as read
router.put('/read/all', protect, async (req, res) => {
  try {
    await Notification.updateMany(
      { userId: req.user.id, isRead: false },
      { isRead: true, readAt: new Date() }
    );
    res.status(200).json({ success: true });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// Get notification preferences
router.get('/preferences', protect, async (req, res) => {
  try {
    let pref = await NotificationPreference.findOne({ userId: req.user.id });
    if (!pref) {
      pref = await NotificationPreference.create({ userId: req.user.id });
    }
    res.status(200).json(pref);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// Update notification preferences
router.put('/preferences', protect, async (req, res) => {
  try {
    const { inAppEnabled, emailEnabled, pushEnabled, mutedTypes, quietHours } = req.body;

    const update = { userId: req.user.id };
    if (typeof inAppEnabled === 'boolean') update.inAppEnabled = inAppEnabled;
    if (typeof emailEnabled === 'boolean') update.emailEnabled = emailEnabled;
    if (typeof pushEnabled === 'boolean') update.pushEnabled = pushEnabled;
    if (Array.isArray(mutedTypes)) update.mutedTypes = mutedTypes;
    if (quietHours) update.quietHours = quietHours;

    const pref = await NotificationPreference.findOneAndUpdate(
      { userId: req.user.id },
      update,
      { upsert: true, new: true }
    );

    res.status(200).json(pref);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

module.exports = router;
