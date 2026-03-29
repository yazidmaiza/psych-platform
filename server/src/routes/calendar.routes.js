const express = require('express');
const router = express.Router();
const CalendarSlot = require('../models/CalendarSlot');
const Session = require('../models/Session');
const Notification = require('../models/Notification');
const { protect } = require('../middleware/authMiddleware');

const cancelSessionAndFreeSlot = async (session, reason) => {
    if (!session) return;
    if (session.status === 'canceled' || session.status === 'completed') return;

    session.status = 'canceled';
    session.canceledAt = new Date();
    await session.save();

    if (session.calendarSlotId) {
        await CalendarSlot.findByIdAndUpdate(session.calendarSlotId, {
            isBooked: false,
            patientId: null,
            pendingPatientId: null,
            pendingSessionId: null,
            pendingAt: null
        });
    }

    try {
        await Notification.create({
            userId: session.patientId,
            title: 'Booking canceled',
            message: reason || 'Your booking was canceled.',
            link: '/patient/dashboard',
            type: 'booking_canceled'
        });
    } catch {}
};

const patientHasOpenSessionWithPsychologist = async ({ patientId, psychologistId }) => {
    return await Session.exists({
        patientId,
        psychologistId,
        status: { $nin: ['completed', 'canceled'] }
    });
};

const getDefaultSessionTypeForPatient = async (patientId) => {
    const hasCompleted = await Session.exists({ patientId, status: 'completed' });
    return hasCompleted ? 'followup' : 'preparation';
};

const expireOverduePayments = async (psychologistId) => {
    const now = new Date();
    const query = {
        status: 'pending_payment',
        paymentConfirmed: false,
        paymentDueAt: { $ne: null, $lt: now }
    };
    if (psychologistId) query.psychologistId = psychologistId;

    const overdue = await Session.find(query).limit(50);
    for (const s of overdue) {
        await cancelSessionAndFreeSlot(s, 'Booking canceled because payment was not completed within 24 hours.');
    }
};

// Get all slots for a psychologist
router.get('/slots/:psychologistId', protect, async (req, res) => {
    try {
        await expireOverduePayments(req.params.psychologistId);

        const baseQuery = { psychologistId: req.params.psychologistId };

        // Patients should not see slots that are pending for another patient
        let query = baseQuery;
        if (req.user.role === 'patient') {
            query = {
                ...baseQuery,
                $or: [
                    { isBooked: false, pendingSessionId: null },
                    { pendingPatientId: req.user.id }
                ]
            };
        }

        const slots = await CalendarSlot.find(query).sort({ start: 1 });
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
        if (req.user.role !== 'patient') return res.status(403).json({ message: 'Access denied' });

        const slot = await CalendarSlot.findById(req.params.id);
        if (!slot) return res.status(404).json({ message: 'Slot not found' });
        if (slot.isBooked) return res.status(400).json({ message: 'Slot already booked' });
        if (slot.pendingSessionId) return res.status(400).json({ message: 'Slot already requested' });

        // Backwards-compatible alias: treat "book" as a booking request
        const sessionType = await getDefaultSessionTypeForPatient(req.user.id);

        const hasOpen = await patientHasOpenSessionWithPsychologist({ patientId: req.user.id, psychologistId: slot.psychologistId });
        if (hasOpen) return res.status(400).json({ message: 'You already have an open session with this psychologist.' });

        const session = await Session.create({
            patientId: req.user.id,
            psychologistId: slot.psychologistId,
            status: 'requested',
            sessionType,
            calendarSlotId: slot._id,
            scheduledStart: slot.start,
            scheduledEnd: slot.end
        });

        slot.pendingPatientId = req.user.id;
        slot.pendingSessionId = session._id;
        slot.pendingAt = new Date();
        await slot.save();

        await Notification.create({
            userId: slot.psychologistId,
            title: 'New booking request',
            message: 'A patient requested a session on ' + new Date(slot.start).toLocaleString(),
            link: '/calendar',
            type: 'booking_request'
        });

        res.json({ slot, sessionId: session._id });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// Patient requests a slot (preferred endpoint)
router.post('/slots/:id/request', protect, async (req, res) => {
    try {
        if (req.user.role !== 'patient') return res.status(403).json({ message: 'Access denied' });

        const slot = await CalendarSlot.findById(req.params.id);
        if (!slot) return res.status(404).json({ message: 'Slot not found' });
        if (slot.isBooked) return res.status(400).json({ message: 'Slot already booked' });
        if (slot.pendingSessionId) return res.status(400).json({ message: 'Slot already requested' });

        const sessionType = await getDefaultSessionTypeForPatient(req.user.id);

        const hasOpen = await patientHasOpenSessionWithPsychologist({ patientId: req.user.id, psychologistId: slot.psychologistId });
        if (hasOpen) return res.status(400).json({ message: 'You already have an open session with this psychologist.' });

        const session = await Session.create({
            patientId: req.user.id,
            psychologistId: slot.psychologistId,
            status: 'requested',
            sessionType,
            calendarSlotId: slot._id,
            scheduledStart: slot.start,
            scheduledEnd: slot.end
        });

        slot.pendingPatientId = req.user.id;
        slot.pendingSessionId = session._id;
        slot.pendingAt = new Date();
        await slot.save();

        await Notification.create({
            userId: slot.psychologistId,
            title: 'New booking request',
            message: 'A patient requested a session on ' + new Date(slot.start).toLocaleString(),
            link: '/calendar',
            type: 'booking_request'
        });

        res.status(201).json({ slot, sessionId: session._id });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// Psychologist confirms a requested slot
router.post('/slots/:id/confirm', protect, async (req, res) => {
    try {
        if (req.user.role !== 'psychologist') return res.status(403).json({ message: 'Access denied' });

        const slot = await CalendarSlot.findById(req.params.id);
        if (!slot) return res.status(404).json({ message: 'Slot not found' });
        if (slot.psychologistId.toString() !== req.user.id) return res.status(403).json({ message: 'Access denied' });
        if (!slot.pendingSessionId || !slot.pendingPatientId) return res.status(400).json({ message: 'No pending request for this slot' });

        const session = await Session.findById(slot.pendingSessionId);
        if (!session) return res.status(404).json({ message: 'Session not found' });

        session.status = 'pending_payment';
        session.paymentDueAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
        session.confirmedAt = new Date();
        await session.save();

        slot.isBooked = true;
        slot.patientId = slot.pendingPatientId;
        slot.pendingPatientId = null;
        slot.pendingSessionId = null;
        slot.pendingAt = null;
        await slot.save();

        await Notification.create({
            userId: session.patientId,
            title: 'Booking confirmed',
            message: 'Your psychologist confirmed your booking. Please complete payment within 24 hours.',
            link: '/payment/' + session._id,
            type: 'booking_confirmed'
        });

        res.status(200).json({ slot, sessionId: session._id });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// Psychologist rejects a requested slot
router.post('/slots/:id/reject', protect, async (req, res) => {
    try {
        if (req.user.role !== 'psychologist') return res.status(403).json({ message: 'Access denied' });

        const slot = await CalendarSlot.findById(req.params.id);
        if (!slot) return res.status(404).json({ message: 'Slot not found' });
        if (slot.psychologistId.toString() !== req.user.id) return res.status(403).json({ message: 'Access denied' });
        if (!slot.pendingSessionId || !slot.pendingPatientId) return res.status(400).json({ message: 'No pending request for this slot' });

        const session = await Session.findById(slot.pendingSessionId);
        if (session) {
            session.status = 'canceled';
            session.canceledAt = new Date();
            await session.save();

            await Notification.create({
                userId: session.patientId,
                title: 'Booking rejected',
                message: 'Your booking request was rejected. Please choose another time slot.',
                link: '/calendar/' + slot.psychologistId,
                type: 'booking_rejected'
            });
        }

        slot.pendingPatientId = null;
        slot.pendingSessionId = null;
        slot.pendingAt = null;
        await slot.save();

        res.status(200).json({ success: true });
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
