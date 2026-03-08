const express = require('express');
const router = express.Router();
const Message = require('../models/Message');

// US-26 — Send a message
router.post('/', async (req, res) => {
    try {
        const { senderId, senderModel, receiverId, receiverModel, content } = req.body;
        const message = new Message({ senderId, senderModel, receiverId, receiverModel, content });
        await message.save();
        res.status(201).json(message);
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
});

// US-28 — Get unread message count
router.get('/unread/:userId', async (req, res) => {
    try {
        const count = await Message.countDocuments({
            receiverId: req.params.userId,
            isRead: false
        });
        res.json({ unreadCount: count });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// US-25 — Get conversation between two users
router.get('/:userId/:otherUserId', async (req, res) => {
    try {
        const { userId, otherUserId } = req.params;
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
router.put('/read/:userId/:otherUserId', async (req, res) => {
    try {
        await Message.updateMany(
            { senderId: req.params.otherUserId, receiverId: req.params.userId, isRead: false },
            { isRead: true }
        );
        res.json({ message: 'Messages marked as read' });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

module.exports = router;