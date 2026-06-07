const express = require('express');
const router = express.Router();
const CalendarSlot = require('../models/CalendarSlot');
const Session = require('../models/Session');
const User = require('../models/User');
const { createNotification } = require('../services/notificationService');
const AvailabilityRule = require('../models/AvailabilityRule');
const AvailabilityException = require('../models/AvailabilityException');
const { generateRecurringSlots } = require('../services/availabilityService');
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

    const when = session.scheduledStart ? new Date(session.scheduledStart).toLocaleString() : '';
    const safeReason = reason || 'Your booking was canceled.';
    const patientMessage = when ? `${safeReason} (Session: ${when})` : safeReason;

    // Intentionally no notification for auto-cancel/free-slot helper.
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

const hasOverlap = async ({ psychologistId, start, end }) => {
    return CalendarSlot.exists({
        psychologistId,
        isBooked: true,
        start: { $lt: end },
        end: { $gt: start }
    });
};

const hasOverlapExcept = async ({ psychologistId, start, end, exceptSlotId }) => {
    return CalendarSlot.exists({
        _id: { $ne: exceptSlotId },
        psychologistId,
        isBooked: true,
        start: { $lt: end },
        end: { $gt: start }
    });
};

const calendarLink = ({ date, eventId, sessionId, open = true, psychologistId = '' } = {}) => {
    const params = new URLSearchParams();
    if (date) params.set('date', new Date(date).toISOString());
    if (eventId) params.set('eventId', String(eventId));
    if (sessionId) params.set('sessionId', String(sessionId));
    if (open) params.set('open', '1');
    const base = psychologistId ? `/calendar/${psychologistId}` : '/calendar';
    const query = params.toString();
    return query ? `${base}?${query}` : base;
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

// Psychologist recurring rules
router.get('/recurring/rules', protect, async (req, res) => {
    try {
        if (req.user.role !== 'psychologist') return res.status(403).json({ message: 'Access denied' });
        const rules = await AvailabilityRule.find({ psychologistId: req.user.id, isActive: true }).sort({ dayOfWeek: 1, startTime: 1 });
        res.json(rules);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

router.post('/recurring/rules', protect, async (req, res) => {
    try {
        if (req.user.role !== 'psychologist') return res.status(403).json({ message: 'Access denied' });
        const { dayOfWeek, startTime, endTime, timezone, tzOffsetMinutes } = req.body;
        if (dayOfWeek === undefined || !startTime || !endTime) {
            return res.status(400).json({ message: 'dayOfWeek, startTime, and endTime are required' });
        }

        const rule = await AvailabilityRule.findOneAndUpdate(
            { psychologistId: req.user.id, dayOfWeek, startTime, endTime },
            {
                psychologistId: req.user.id,
                dayOfWeek,
                startTime,
                endTime,
                timezone: timezone || 'UTC',
                tzOffsetMinutes: Number(tzOffsetMinutes || 0),
                isActive: true
            },
            { upsert: true, new: true }
        );

        res.status(201).json(rule);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

router.delete('/recurring/rules/:id', protect, async (req, res) => {
    try {
        if (req.user.role !== 'psychologist') return res.status(403).json({ message: 'Access denied' });
        await AvailabilityRule.deleteOne({ _id: req.params.id, psychologistId: req.user.id });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

router.post('/recurring/exceptions', protect, async (req, res) => {
    try {
        if (req.user.role !== 'psychologist') return res.status(403).json({ message: 'Access denied' });
        const { date, startTime, endTime, isAvailable, reason } = req.body;
        if (!date) return res.status(400).json({ message: 'date is required' });

        const exception = await AvailabilityException.create({
            psychologistId: req.user.id,
            date,
            startTime: startTime || null,
            endTime: endTime || null,
            isAvailable: Boolean(isAvailable),
            reason: reason || ''
        });

        res.status(201).json(exception);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

router.post('/recurring/generate', protect, async (req, res) => {
    try {
        if (req.user.role !== 'psychologist') return res.status(403).json({ message: 'Access denied' });
        const { rangeStart, rangeEnd } = req.body;
        if (!rangeStart || !rangeEnd) return res.status(400).json({ message: 'rangeStart and rangeEnd are required' });

        const result = await generateRecurringSlots({
            psychologistId: req.user.id,
            rangeStart: new Date(rangeStart),
            rangeEnd: new Date(rangeEnd)
        });

        res.json(result);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// Get all slots for a psychologist
router.get('/slots/:psychologistId', protect, async (req, res) => {
    try {
        const now = new Date();
        const horizon = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
        await generateRecurringSlots({
            psychologistId: req.params.psychologistId,
            rangeStart: now,
            rangeEnd: horizon
        });

        await expireOverduePayments(req.params.psychologistId);

        const baseQuery = { psychologistId: req.params.psychologistId };

        // Patients should not see slots that are pending for another patient
        let query = baseQuery;
        if (req.user.role === 'patient') {
            query = {
                ...baseQuery,
                $or: [
                    { isBooked: true },
                    { isBooked: false, pendingSessionId: null },
                    { pendingPatientId: req.user.id }
                ]
            };
        }

        const slots = await CalendarSlot.find(query).sort({ start: 1 }).lean();
        const slotIds = slots.map((slot) => slot._id);
        const patientIds = slots
            .flatMap((slot) => {
                const canSeeBookedPatient = req.user.role !== 'patient' || String(slot.patientId || '') === String(req.user.id);
                return [canSeeBookedPatient ? slot.patientId : null, slot.pendingPatientId];
            })
            .filter(Boolean);

        const [sessions, patients] = await Promise.all([
            Session.find({
                calendarSlotId: { $in: slotIds },
                status: { $ne: 'canceled' }
            }).lean(),
            User.find({ _id: { $in: patientIds } })
                .select('firstName lastName fullName email')
                .lean()
        ]);

        const sessionBySlot = new Map(sessions.map((session) => [String(session.calendarSlotId), session]));
        const patientById = new Map(patients.map((patient) => [String(patient._id), patient]));
        const summarizePatient = (patient) => patient ? ({
            _id: patient._id,
            fullName: patient.fullName || [patient.firstName, patient.lastName].filter(Boolean).join(' ') || patient.email || 'Patient',
            email: patient.email
        }) : null;

        res.json(slots.map((slot) => {
            const session = slot.pendingSessionId
                ? sessions.find((item) => String(item._id) === String(slot.pendingSessionId))
                : sessionBySlot.get(String(slot._id));
            const canSeeBookedPatient = req.user.role !== 'patient' || String(slot.patientId || '') === String(req.user.id);
            const patientId = (canSeeBookedPatient ? slot.patientId : null) || slot.pendingPatientId || session?.patientId;
            return {
                ...slot,
                patient: summarizePatient(patientById.get(String(patientId))),
                session: session ? {
                    _id: session._id,
                    patientId: session.patientId,
                    psychologistId: session.psychologistId,
                    status: session.status,
                    sessionType: session.sessionType,
                    scheduledStart: session.scheduledStart,
                    scheduledEnd: session.scheduledEnd,
                    paymentDueAt: session.paymentDueAt
                } : null
            };
        }));
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
            end: endDate,
            source: 'manual'
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

        const updated = await CalendarSlot.findOneAndUpdate(
            { _id: slot._id, isBooked: false, pendingSessionId: null },
            {
                pendingPatientId: req.user.id,
                pendingSessionId: session._id,
                pendingAt: new Date()
            },
            { new: true }
        );

        if (!updated) {
            await Session.findByIdAndDelete(session._id);
            return res.status(409).json({ message: 'Slot is no longer available' });
        }

        await createNotification({
            userId: slot.psychologistId,
            title: 'New booking request',
            message: 'A patient requested a session on ' + new Date(slot.start).toLocaleString(),
            link: calendarLink({ date: slot.start, eventId: updated._id, sessionId: session._id }),
            type: 'booking_request',
            channels: ['in_app'],
            data: {
                calendarDate: slot.start,
                calendarEventId: updated._id,
                sessionId: session._id,
                psychologistId: slot.psychologistId,
                patientId: req.user.id
            }
        });

        res.json({ slot: updated, sessionId: session._id });
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

        const updated = await CalendarSlot.findOneAndUpdate(
            { _id: slot._id, isBooked: false, pendingSessionId: null },
            {
                pendingPatientId: req.user.id,
                pendingSessionId: session._id,
                pendingAt: new Date()
            },
            { new: true }
        );

        if (!updated) {
            await Session.findByIdAndDelete(session._id);
            return res.status(409).json({ message: 'Slot is no longer available' });
        }

        await createNotification({
            userId: slot.psychologistId,
            title: 'New booking request',
            message: 'A patient requested a session on ' + new Date(scheduledStart).toLocaleString(),
            link: calendarLink({ date: scheduledStart, eventId: updated._id, sessionId: session._id }),
            type: 'booking_request',
            channels: ['in_app'],
            data: {
                calendarDate: scheduledStart,
                calendarEventId: updated._id,
                sessionId: session._id,
                psychologistId: slot.psychologistId,
                patientId: req.user.id
            }
        });

        res.status(201).json({ slot: updated, sessionId: session._id });
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

        const overlap = await hasOverlap({ psychologistId: slot.psychologistId, start: bookedStart, end: bookedEnd });
        if (overlap) {
            return res.status(409).json({ message: 'This time overlaps another confirmed booking.' });
        }

        const MIN_SLOT_MS = 60 * 60 * 1000; // 1 hour minimum for remaining sub-slots

        // 1 — Create the booked sub-slot (patient's chosen window)
        const bookedSlot = await CalendarSlot.create({
            psychologistId: slot.psychologistId,
            patientId: slot.pendingPatientId,
            start: bookedStart,
            end: bookedEnd,
            isBooked: true,
            source: 'booking'
        });

        // 2 — Update the session to point to the new booked sub-slot
        session.calendarSlotId = bookedSlot._id;
        session.status = 'pending_payment';
        // Guard against server clock skew causing immediate expiry
        const nowMs = Date.now();
        session.paymentDueAt = new Date(nowMs + 24 * 60 * 60 * 1000);
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

        await createNotification({
            userId: session.patientId,
            title: 'Booking confirmed',
            message: 'Your psychologist confirmed your booking. Please complete payment within 24 hours.',
            link: calendarLink({ date: bookedStart, eventId: bookedSlot._id, sessionId: session._id }),
            type: 'booking_confirmed',
            channels: ['in_app', 'email'],
            data: {
                calendarDate: bookedStart,
                calendarEventId: bookedSlot._id,
                sessionId: session._id,
                psychologistId: session.psychologistId,
                paymentLink: '/payment/' + session._id
            }
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

            await createNotification({
                userId: session.patientId,
                title: 'Booking rejected',
                message: 'Your booking request was rejected. Please choose another time slot.',
                link: calendarLink({ date: slot.start, psychologistId: slot.psychologistId, open: false }),
                type: 'booking_rejected',
                channels: ['in_app', 'email'],
                data: {
                    calendarDate: slot.start,
                    psychologistId: slot.psychologistId,
                    sessionId: session._id
                }
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

// Psychologist reschedules a confirmed booked slot
router.put('/slots/:id/reschedule', protect, async (req, res) => {
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
            return res.status(400).json({ message: 'Sessions must be at least 1 hour long.' });
        }

        const slot = await CalendarSlot.findById(req.params.id);
        if (!slot) return res.status(404).json({ message: 'Slot not found' });
        if (slot.psychologistId.toString() !== req.user.id) return res.status(403).json({ message: 'Access denied' });
        if (!slot.isBooked) return res.status(400).json({ message: 'Only confirmed sessions can be rescheduled.' });

        const overlap = await hasOverlapExcept({
            psychologistId: slot.psychologistId,
            start: startDate,
            end: endDate,
            exceptSlotId: slot._id
        });
        if (overlap) return res.status(409).json({ message: 'This time overlaps another confirmed booking.' });

        slot.start = startDate;
        slot.end = endDate;
        await slot.save();

        const session = await Session.findOneAndUpdate(
            { calendarSlotId: slot._id, status: { $nin: ['completed', 'canceled'] } },
            { scheduledStart: startDate, scheduledEnd: endDate },
            { new: true }
        );

        if (session) {
            await createNotification({
                userId: session.patientId,
                title: 'Booking rescheduled',
                message: 'Your psychologist rescheduled your session to ' + startDate.toLocaleString(),
                link: calendarLink({ date: startDate, eventId: slot._id, sessionId: session._id }),
                type: 'booking_rescheduled',
                channels: ['in_app', 'email'],
                data: {
                    calendarDate: startDate,
                    calendarEventId: slot._id,
                    sessionId: session._id,
                    psychologistId: slot.psychologistId
                }
            });
        }

        res.json({ slot, sessionId: session?._id || null });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// Psychologist cancels a confirmed booked slot
router.post('/slots/:id/cancel', protect, async (req, res) => {
    try {
        if (req.user.role !== 'psychologist') return res.status(403).json({ message: 'Access denied' });

        const slot = await CalendarSlot.findById(req.params.id);
        if (!slot) return res.status(404).json({ message: 'Slot not found' });
        if (slot.psychologistId.toString() !== req.user.id) return res.status(403).json({ message: 'Access denied' });
        if (!slot.isBooked) return res.status(400).json({ message: 'Only confirmed sessions can be canceled here.' });

        const session = await Session.findOne({
            calendarSlotId: slot._id,
            status: { $nin: ['completed', 'canceled'] }
        });

        if (session) {
            session.status = 'canceled';
            session.canceledAt = new Date();
            await session.save();

            await createNotification({
                userId: session.patientId,
                title: 'Booking canceled',
                message: 'Your psychologist canceled the session scheduled for ' + new Date(slot.start).toLocaleString(),
                link: calendarLink({ date: slot.start, eventId: slot._id, sessionId: session._id, open: false }),
                type: 'booking_canceled',
                channels: ['in_app', 'email'],
                data: {
                    calendarDate: slot.start,
                    calendarEventId: slot._id,
                    sessionId: session._id,
                    psychologistId: slot.psychologistId
                }
            });
        }

        slot.isBooked = false;
        slot.patientId = null;
        slot.source = 'manual';
        await slot.save();

        res.json({ success: true, slot, sessionId: session?._id || null });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// Delete a slot (psychologist only)
router.delete('/slots/:id', protect, async (req, res) => {
    try {
        if (req.user.role !== 'psychologist') return res.status(403).json({ message: 'Access denied' });

        const slot = await CalendarSlot.findById(req.params.id);
        if (!slot) return res.status(404).json({ message: 'Slot not found' });
        if (slot.psychologistId.toString() !== req.user.id) return res.status(403).json({ message: 'Access denied' });
        if (slot.isBooked || slot.pendingSessionId) {
            return res.status(400).json({ message: 'Booked or pending slots cannot be deleted here.' });
        }

        await CalendarSlot.findByIdAndDelete(req.params.id);
        res.json({ message: 'Slot deleted' });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

module.exports = router;
