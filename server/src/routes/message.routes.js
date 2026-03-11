const express = require('express');
const router = express.Router();
const Message = require('../models/Message');
const { protect } = require('../middleware/authMiddleware');

// US-26 — Send a message
router.post('/', protect, async (req, res) => {
    try {
        const { receiverId, receiverModel, content } = req.body;

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

// US-25 — Get conversation between two users
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

// US-25 — Get conversation
router.get('/:otherUserId', protect, async (req, res) => {
    try {
        const userId = req.user.id;
        const { otherUserId } = req.params;

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

// US-28 — Mark messages as read
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