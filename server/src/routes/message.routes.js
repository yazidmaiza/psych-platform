const express = require('express');
const router = express.Router();
const Message = require('../models/Message');
const User = require('../models/User');
const Session = require('../models/Session');
const { protect } = require('../middleware/authMiddleware');

const hasBookedConsultation = async ({ patientId, psychologistUserId }) => {
  return await Session.exists({
    patientId,
    psychologistId: psychologistUserId,
    status: { $in: ['requested', 'pending', 'pending_payment', 'paid', 'active', 'completed'] }
  });
};

const enforceBookingGate = async ({ requesterRole, requesterId, otherUserId }) => {
  const other = await User.findById(otherUserId).select('role');
  if (!other) return { ok: false, status: 404, message: 'User not found' };

  // Only gate patient<->psychologist messaging
  if (requesterRole === 'patient' && other.role === 'psychologist') {
    const ok = await hasBookedConsultation({ patientId: requesterId, psychologistUserId: otherUserId });
    return ok ? { ok: true } : { ok: false, status: 403, message: 'Book a consultation before messaging this psychologist.' };
  }

  if (requesterRole === 'psychologist' && other.role === 'patient') {
    const ok = await hasBookedConsultation({ patientId: otherUserId, psychologistUserId: requesterId });
    return ok ? { ok: true } : { ok: false, status: 403, message: 'You can only message patients who booked a consultation.' };
  }

  return { ok: true };
};

// US-26 - Send a message
router.post('/', protect, async (req, res) => {
  try {
    const { receiverId, receiverModel, content } = req.body;

    const gate = await enforceBookingGate({
      requesterRole: req.user.role,
      requesterId: req.user.id,
      otherUserId: receiverId
    });
    if (!gate.ok) return res.status(gate.status).json({ message: gate.message });

    const message = new Message({
      senderId: req.user.id,
      senderModel: req.user.role === 'psychologist' ? 'Psychologist' : 'User',
      receiverId,
      receiverModel,
      content
    });

    await message.save();
    res.status(201).json(message);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// US-25 - Get unread count
router.get('/unread', protect, async (req, res) => {
  try {
    const count = await Message.countDocuments({
      receiverId: req.user.id,
      isRead: false
    });
    res.json({ unreadCount: count });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// US-25 - Get conversation
router.get('/:otherUserId', protect, async (req, res) => {
  try {
    const userId = req.user.id;
    const { otherUserId } = req.params;

    const gate = await enforceBookingGate({
      requesterRole: req.user.role,
      requesterId: req.user.id,
      otherUserId
    });
    if (!gate.ok) return res.status(gate.status).json({ message: gate.message });

    const messages = await Message.find({
      $or: [
        { senderId: userId, receiverId: otherUserId },
        { senderId: otherUserId, receiverId: userId }
      ]
    }).sort({ createdAt: 1 });

    res.json(messages);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// US-28 - Mark messages as read
router.put('/read/:otherUserId', protect, async (req, res) => {
  try {
    await Message.updateMany(
      { senderId: req.params.otherUserId, receiverId: req.user.id, isRead: false },
      { isRead: true }
    );
    res.json({ message: 'Messages marked as read' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
