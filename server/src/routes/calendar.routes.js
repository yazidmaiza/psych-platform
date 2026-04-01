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

// Psychologist adds a slot (minimum 1 hour)
router.post('/slots', protect, async (req, res) => {
    try {
        if (req.user.role !== 'psychologist') return res.status(403).json({ message: 'Access denied' });

        const { start, end } = req.body;
        const startDate = new Date(start);
        const endDate = new Date(end);

        if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
            return res.status(400).json({ message: 'Invalid start or end date.' });
        }

        const durationMinutes = (endDate - startDate) / 60000;
        if (durationMinutes < 60) {
            return res.status(400).json({ message: 'Availability slots must be at least 1 hour long.' });
        }

        const slot = new CalendarSlot({
            psychologistId: req.user.id,
            start: startDate,
            end: endDate
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
// Accepts optional `chosenStart` ISO string to book a 1-hour window within the slot
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

        // Determine the chosen session window within the slot
        // chosenStart: ISO string, chosenDuration: 60 or 90 (minutes)
        let scheduledStart = slot.start;
        let scheduledEnd = slot.end;

        if (req.body.chosenStart) {
            const chosen = new Date(req.body.chosenStart);

            // Duration must be 60 or 90 minutes (default 60)
            const durationMinutes = req.body.chosenDuration === 90 ? 90 : 60;
            const durationMs = durationMinutes * 60 * 1000;
            const chosenEnd = new Date(chosen.getTime() + durationMs);

            // Validate: chosen window must fit inside the availability slot
            if (chosen < slot.start || chosenEnd > slot.end) {
                return res.status(400).json({ message: 'Chosen time window falls outside the available slot.' });
            }

            scheduledStart = chosen;
            scheduledEnd = chosenEnd;
        }

        const session = await Session.create({
            patientId: req.user.id,
            psychologistId: slot.psychologistId,
            status: 'requested',
            sessionType,
            calendarSlotId: slot._id,
            scheduledStart,
            scheduledEnd
        });

        slot.pendingPatientId = req.user.id;
        slot.pendingSessionId = session._id;
        slot.pendingAt = new Date();
        await slot.save();

        await Notification.create({
            userId: slot.psychologistId,
            title: 'New booking request',
            message: 'A patient requested a session on ' + new Date(scheduledStart).toLocaleString(),
            link: '/calendar',
            type: 'booking_request'
        });

        res.status(201).json({ slot, sessionId: session._id });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});


// Psychologist confirms a requested slot — splits the availability block
router.post('/slots/:id/confirm', protect, async (req, res) => {
    try {
        if (req.user.role !== 'psychologist') return res.status(403).json({ message: 'Access denied' });

        const slot = await CalendarSlot.findById(req.params.id);
        if (!slot) return res.status(404).json({ message: 'Slot not found' });
        if (slot.psychologistId.toString() !== req.user.id) return res.status(403).json({ message: 'Access denied' });
        if (!slot.pendingSessionId || !slot.pendingPatientId) return res.status(400).json({ message: 'No pending request for this slot' });

        const session = await Session.findById(slot.pendingSessionId);
        if (!session) return res.status(404).json({ message: 'Session not found' });

        // Use the session's chosen window (scheduledStart/End),
        // falling back to the full slot if the patient didn't pick a sub-window
        const bookedStart = session.scheduledStart || slot.start;
        const bookedEnd   = session.scheduledEnd   || slot.end;

        const MIN_SLOT_MS = 60 * 60 * 1000; // 1 hour minimum for remaining sub-slots

        // 1 — Create the booked sub-slot (patient's chosen window)
        const bookedSlot = await CalendarSlot.create({
            psychologistId: slot.psychologistId,
            patientId: slot.pendingPatientId,
            start: bookedStart,
            end: bookedEnd,
            isBooked: true
        });

        // 2 — Update the session to point to the new booked sub-slot
        session.calendarSlotId = bookedSlot._id;
        session.status = 'pending_payment';
        session.paymentDueAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
        session.confirmedAt = new Date();
        await session.save();

        // 3 — Create available sub-slots for remaining time (if >= 1 hour)
        const beforeMs = new Date(bookedStart) - new Date(slot.start);
        const afterMs  = new Date(slot.end) - new Date(bookedEnd);

        if (beforeMs >= MIN_SLOT_MS) {
            await CalendarSlot.create({
                psychologistId: slot.psychologistId,
                start: slot.start,
                end: bookedStart,
                isBooked: false
            });
        }

        if (afterMs >= MIN_SLOT_MS) {
            await CalendarSlot.create({
                psychologistId: slot.psychologistId,
                start: bookedEnd,
                end: slot.end,
                isBooked: false
            });
        }

        // 4 — Delete the original parent slot
        await CalendarSlot.findByIdAndDelete(slot._id);

        await Notification.create({
            userId: session.patientId,
            title: 'Booking confirmed',
            message: 'Your psychologist confirmed your booking. Please complete payment within 24 hours.',
            link: '/payment/' + session._id,
            type: 'booking_confirmed'
        });

        res.status(200).json({ slot: bookedSlot, sessionId: session._id });
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
