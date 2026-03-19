const express = require('express');
const router = express.Router();
const CalendarSlot = require('../models/CalendarSlot');
const { protect } = require('../middleware/authMiddleware');

// Get all slots for a psychologist
router.get('/slots/:psychologistId', protect, async (req, res) => {
    try {
        const slots = await CalendarSlot.find({
            psychologistId: req.params.psychologistId
        }).sort({ start: 1 });
        res.json(slots);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// Psychologist adds a slot
router.post('/slots', protect, async (req, res) => {
    try {
        const { start, end } = req.body;
        const slot = new CalendarSlot({
            psychologistId: req.user.id,
            start,
            end
        });
        await slot.save();
        res.status(201).json(slot);
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
});

// Patient books a slot
router.post('/slots/:id/book', protect, async (req, res) => {
    try {
        const slot = await CalendarSlot.findById(req.params.id);
        if (!slot) return res.status(404).json({ message: 'Slot not found' });
        if (slot.isBooked) return res.status(400).json({ message: 'Slot already booked' });
        slot.isBooked = true;
        slot.patientId = req.user.id;
        await slot.save();
        res.json(slot);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// Delete a slot (psychologist only)
router.delete('/slots/:id', protect, async (req, res) => {
    try {
        await CalendarSlot.findByIdAndDelete(req.params.id);
        res.json({ message: 'Slot deleted' });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

module.exports = router;