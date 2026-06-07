import React, { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { Calendar, momentLocalizer } from 'react-big-calendar';
import moment from 'moment';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { api } from '../services/api';
import { getUser } from '../services/auth';
import { socket } from '../services/socket';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import { useTheme } from '../context/ThemeContext';

const localizer = momentLocalizer(moment);

const statusMeta = {
  available: { label: 'Available', dot: 'bg-sky-400', color: '#2563eb', soft: 'rgba(37,99,235,.16)' },
  requested: { label: 'Pending', dot: 'bg-amber-400', color: '#f59e0b', soft: 'rgba(245,158,11,.18)' },
  pending_payment: { label: 'Confirmed', dot: 'bg-emerald-400', color: '#10b981', soft: 'rgba(16,185,129,.18)' },
  paid: { label: 'Confirmed', dot: 'bg-emerald-400', color: '#10b981', soft: 'rgba(16,185,129,.18)' },
  verified: { label: 'Confirmed', dot: 'bg-emerald-400', color: '#10b981', soft: 'rgba(16,185,129,.18)' },
  active: { label: 'Confirmed', dot: 'bg-emerald-400', color: '#10b981', soft: 'rgba(16,185,129,.18)' },
  unavailable: { label: 'Unavailable', dot: 'bg-slate-400', color: '#64748b', soft: 'rgba(100,116,139,.18)' },
  canceled: { label: 'Cancelled', dot: 'bg-rose-400', color: '#ef4444', soft: 'rgba(239,68,68,.16)' },
  completed: { label: 'Completed', dot: 'bg-blue-400', color: '#3b82f6', soft: 'rgba(59,130,246,.18)' }
};

const getSessionTypeLabel = (type) => ({
  preparation: 'Preparation',
  followup: 'Follow-up',
  free: 'Free expression'
}[type] || 'Consultation');

const getEventStatus = (event) => {
  if (event.status) return event.status;
  if (event.isPending) return 'requested';
  if (event.isBooked) return 'paid';
  return 'available';
};

const formatTimeRange = (start, end) => `${moment(start).format('h:mm A')} – ${moment(end).format('h:mm A')}`;

const Glass = ({ children, className = '' }) => (
  <div className={`rounded-3xl border border-[color:var(--panel-border)] bg-[color:var(--panel-bg)]/80 shadow-sm backdrop-blur-xl ${className}`}>
    {children}
  </div>
);

const CalendarSkeleton = () => (
  <div className="calendar-skeleton grid gap-3 p-4 sm:grid-cols-7" aria-label="Loading appointments">
    {Array.from({ length: 21 }).map((_, index) => (
      <div key={index} className="h-20 rounded-2xl bg-white/10" />
    ))}
  </div>
);

const EmptyState = ({ mode }) => (
  <div className="absolute inset-x-4 top-28 z-10 flex justify-center pointer-events-none">
    <div className="pointer-events-auto max-w-md rounded-3xl border border-[color:var(--panel-border)] bg-[color:var(--app-bg-85)] p-6 text-center shadow-xl backdrop-blur-xl">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-500/15 text-indigo-200">
        <span className="material-symbols-outlined">event_available</span>
      </div>
      <h3 className="mt-3 text-base font-semibold text-[color:var(--app-fg)]">No appointments yet</h3>
      <p className="mt-1 text-sm text-[color:var(--muted)]">
        {mode === 'psychologist'
          ? 'Pending requests and confirmed sessions will appear here.'
          : 'Booking activity will show up here as soon as a slot is requested.'}
      </p>
    </div>
  </div>
);

const AppointmentEvent = memo(({ event }) => {
  const status = getEventStatus(event);
  const meta = statusMeta[status] || statusMeta.available;

  return (
    <div
      className="calendar-event-card group"
      data-calendar-event-id={event.id}
      data-calendar-session-id={event.sessionId || ''}
      aria-label={`${event.title}, ${formatTimeRange(event.start, event.end)}, ${meta.label}`}
    >
      <div className="flex items-center gap-1.5 truncate">
        <span className={`h-2 w-2 shrink-0 rounded-full ${meta.dot}`} />
        <span className="truncate font-semibold">{event.title}</span>
      </div>
      <div className="truncate text-[10px] opacity-85">{formatTimeRange(event.start, event.end)}</div>
      <div className="calendar-event-preview pointer-events-none absolute left-2 top-full z-50 mt-2 hidden w-64 rounded-2xl border p-3 text-left shadow-2xl backdrop-blur-xl group-hover:block">
        <div className="calendar-event-preview-kicker text-xs font-semibold uppercase tracking-wide">Quick preview</div>
        <div className="calendar-event-preview-title mt-2 text-sm font-semibold">{event.patientName || 'Patient details pending'}</div>
        <div className="calendar-event-preview-meta mt-1 text-xs">{getSessionTypeLabel(event.sessionType)} • {formatTimeRange(event.start, event.end)}</div>
        <div className="mt-2 inline-flex rounded-full px-2 py-1 text-[11px] font-semibold" style={{ background: meta.soft, color: meta.color }}>
          {meta.label}
        </div>
        <div className="calendar-event-preview-notes mt-2 text-xs">{event.notes || 'Open for actions, notes, and booking details.'}</div>
      </div>
    </div>
  );
});

export default function CalendarPage() {
  const { theme } = useTheme();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { role, userId } = getUser();
  const { psychologistId } = useParams();

  const isPatientOwnCalendar = role === 'patient' && !psychologistId;
  const isPatientViewingPsychologist = role === 'patient' && !!psychologistId;
  const isPsychologistOwnCalendar = role === 'psychologist' && !psychologistId;
  const targetId = psychologistId || userId || '';
  const storageKey = `calendar:state:${role || 'unknown'}:${targetId || 'unknown'}`;

  const urlDate = searchParams.get('date');
  const urlEventId = searchParams.get('eventId');
  const urlSessionId = searchParams.get('sessionId');
  const shouldAutoOpen = searchParams.get('open') === '1';

  const [events, setEvents] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [sessionDetails, setSessionDetails] = useState(null);
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [calendarDate, setCalendarDate] = useState(() => {
    const dateFromUrl = urlDate ? new Date(urlDate) : null;
    if (dateFromUrl && !Number.isNaN(dateFromUrl.getTime())) return dateFromUrl;
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey) || '{}');
      const savedDate = saved.date ? new Date(saved.date) : null;
      if (savedDate && !Number.isNaN(savedDate.getTime())) return savedDate;
    } catch {}
    return new Date();
  });
  const [calendarView, setCalendarView] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(storageKey) || '{}').view || 'week';
    } catch {
      return 'week';
    }
  });
  const [error, setError] = useState('');
  const [repeatWeekly, setRepeatWeekly] = useState(false);
  const [repeatUntil, setRepeatUntil] = useState('');
  const [highlightedId, setHighlightedId] = useState(urlEventId || urlSessionId || '');
  const [rescheduleOpen, setRescheduleOpen] = useState(false);
  const [rescheduleForm, setRescheduleForm] = useState({ start: '', end: '' });

  const normalizeSlot = useCallback((slot) => {
    if (!slot) return slot;
    return {
      ...slot,
      start: slot.start instanceof Date ? slot.start : new Date(slot.start),
      end: slot.end instanceof Date ? slot.end : new Date(slot.end)
    };
  }, []);

  const persistCalendarState = useCallback((date, view = calendarView) => {
    try {
      localStorage.setItem(storageKey, JSON.stringify({ date: date.toISOString(), view }));
    } catch {}
  }, [calendarView, storageKey]);

  const mapSlotToEvent = useCallback((slot) => {
    const isPending = !!slot.pendingSessionId;
    const isMyPending = role === 'patient' && String(slot.pendingPatientId) === String(userId);
    const sessionStatus = slot.session?.status || (isPending ? 'requested' : slot.isBooked ? (role === 'patient' ? 'unavailable' : 'paid') : 'available');
    const patientName = slot.patient?.fullName || (isMyPending ? 'You' : '');
    const title = slot.isBooked
      ? (role === 'patient' ? 'Unavailable' : patientName || 'Confirmed session')
      : isPending
        ? (isMyPending ? 'Your pending request' : patientName ? `${patientName} requested` : 'Pending request')
        : 'Available slot';

    return {
      id: slot._id,
      title,
      start: new Date(slot.session?.scheduledStart || slot.start),
      end: new Date(slot.session?.scheduledEnd || slot.end),
      isBooked: slot.isBooked,
      isPending,
      isMyPending,
      status: sessionStatus,
      patientName,
      sessionType: slot.session?.sessionType,
      sessionId: slot.session?._id || slot.pendingSessionId || null,
      notes: slot.isBooked ? 'Confirmed session' : isPending ? 'Awaiting confirmation' : 'Open availability',
      resource: slot
    };
  }, [role, userId]);

  const mapSessionToEvent = useCallback((session) => {
    const status = String(session.status || '');
    const meta = statusMeta[status] || statusMeta.available;
    return {
      id: session.calendarSlotId || session._id,
      sessionId: session._id,
      title: meta.label === 'Confirmed' ? 'Confirmed session' : meta.label,
      start: new Date(session.scheduledStart),
      end: new Date(session.scheduledEnd),
      status,
      patientName: 'You',
      sessionType: session.sessionType,
      notes: status === 'pending_payment' ? 'Payment required within the confirmation window.' : 'Open for booking details.',
      resource: session
    };
  }, []);

  const fetchSlots = useCallback(async ({ quiet = false } = {}) => {
    if (!targetId) return;
    if (!quiet) setInitialLoading(true);
    setError('');
    try {
      const data = await api.get(`/api/calendar/slots/${targetId}`);
      const mapped = (Array.isArray(data) ? data : []).map(mapSlotToEvent);
      const visible = mapped;
      setEvents(visible);
      if (!urlDate && !localStorage.getItem(storageKey) && visible.length > 0) {
        setCalendarDate(new Date(visible[0].start));
      }
    } catch (e) {
      setEvents([]);
      setError(e.message || 'Failed to load slots');
    } finally {
      setInitialLoading(false);
    }
  }, [mapSlotToEvent, storageKey, targetId, urlDate]);

  const fetchMyBookings = useCallback(async ({ quiet = false } = {}) => {
    if (!userId) return;
    if (!quiet) setInitialLoading(true);
    setError('');
    try {
      const data = await api.get('/api/sessions/patient/' + userId);
      const mapped = (Array.isArray(data) ? data : [])
        .filter((session) => session.scheduledStart && session.scheduledEnd)
        .map(mapSessionToEvent)
        .sort((a, b) => a.start.getTime() - b.start.getTime());
      setEvents(mapped);
      if (!urlDate && !localStorage.getItem(storageKey) && mapped.length > 0) {
        setCalendarDate(new Date(mapped[0].start));
      }
    } catch (e) {
      setEvents([]);
      setError(e.message || 'Failed to load bookings');
    } finally {
      setInitialLoading(false);
    }
  }, [mapSessionToEvent, storageKey, urlDate, userId]);

  const refreshCalendar = useCallback((options) => {
    if (isPatientOwnCalendar) return fetchMyBookings(options);
    return fetchSlots(options);
  }, [fetchMyBookings, fetchSlots, isPatientOwnCalendar]);

  useEffect(() => {
    refreshCalendar();
  }, [refreshCalendar]);

  useEffect(() => {
    const refresh = () => refreshCalendar({ quiet: true });
    socket.on('notification:new', refresh);
    return () => socket.off('notification:new', refresh);
  }, [refreshCalendar]);

  useEffect(() => {
    if (!urlDate) return;
    const parsed = new Date(urlDate);
    if (!Number.isNaN(parsed.getTime())) {
      setCalendarDate(parsed);
      setCalendarView('day');
      persistCalendarState(parsed, 'day');
    }
  }, [persistCalendarState, urlDate]);

  useEffect(() => {
    const target = urlEventId || urlSessionId;
    if (!target || events.length === 0) return;
    const event = events.find((item) => String(item.id) === target || String(item.sessionId) === target);
    if (!event) return;

    setHighlightedId(String(event.id));
    setCalendarDate(new Date(event.start));
    setCalendarView('day');
    persistCalendarState(new Date(event.start), 'day');

    window.setTimeout(() => {
      const node = document.querySelector(`[data-calendar-event-id="${event.id}"], [data-calendar-session-id="${event.sessionId || ''}"]`);
      node?.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
      node?.closest('.rbc-event')?.classList.add('calendar-event-glow');
    }, 250);

    if (shouldAutoOpen) {
      if (isPatientOwnCalendar) {
        setSelectedBooking(event.resource);
        setSelectedSlot(null);
        setSessionDetails(null);
      } else if (isPatientViewingPsychologist) {
        setSelectedSlot(normalizeSlot(event.resource));
        setSelectedBooking(null);
        setSessionDetails(null);
      } else if (isPsychologistOwnCalendar) {
        setSelectedSlot(normalizeSlot(event.resource));
        setSelectedBooking(event);
        setSessionDetails(event.resource?.session || null);
        const sessionId = event.resource?.pendingSessionId || event.sessionId;
        if (sessionId) {
          api.get('/api/sessions/' + sessionId)
            .then((session) => setSessionDetails(session))
            .catch(() => setSessionDetails(event.resource?.session || null));
        }
      }
      setShowModal(true);
    }
    const timer = window.setTimeout(() => setHighlightedId(''), 3200);
    return () => window.clearTimeout(timer);
  }, [events, isPatientOwnCalendar, isPatientViewingPsychologist, isPsychologistOwnCalendar, normalizeSlot, persistCalendarState, shouldAutoOpen, urlEventId, urlSessionId]);

  useEffect(() => {
    if (!selectedSlot?.start) return;
    const startDate = selectedSlot.start instanceof Date ? selectedSlot.start : new Date(selectedSlot.start);
    if (Number.isNaN(startDate.getTime())) return;
    setRepeatUntil(new Date(startDate.getTime() + 28 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10));
  }, [selectedSlot]);

  const handleNavigate = (date) => {
    setCalendarDate(date);
    persistCalendarState(date);
  };

  const handleView = (view) => {
    setCalendarView(view);
    persistCalendarState(calendarDate, view);
  };

  const handleSelectSlot = ({ start, end }) => {
    if (role !== 'psychologist' || psychologistId) return;
    const minEnd = new Date(start.getTime() + 60 * 60 * 1000);
    setSelectedSlot({ start, end: end < minEnd ? minEnd : end });
    setSelectedBooking(null);
    setSessionDetails(null);
    setShowModal(true);
  };

  const handleSelectEvent = (event) => {
    if (isPatientOwnCalendar) {
      setSelectedBooking(event.resource);
      setSelectedSlot(null);
      setSessionDetails(null);
      setShowModal(true);
      return;
    }

    if (isPatientViewingPsychologist) {
      if (event.isBooked || (event.isPending && !event.isMyPending)) return;
      setSelectedSlot(normalizeSlot(event.resource));
      setSelectedBooking(null);
      setSessionDetails(null);
      setShowModal(true);
      return;
    }

    if (isPsychologistOwnCalendar) {
      setSelectedSlot(normalizeSlot(event.resource));
      setSelectedBooking(event);
      setSessionDetails(event.resource?.session || null);
      setShowModal(true);
      const sessionId = event.resource?.pendingSessionId || event.sessionId;
      if (sessionId) {
        api.get('/api/sessions/' + sessionId)
          .then((session) => setSessionDetails(session))
          .catch(() => setSessionDetails(event.resource?.session || null));
      }
    }
  };

  const closeModal = () => {
    setShowModal(false);
    setSelectedSlot(null);
    setSessionDetails(null);
    setSelectedBooking(null);
    setRepeatWeekly(false);
    setRepeatUntil('');
    setRescheduleOpen(false);
    if (searchParams.get('open')) {
      const next = new URLSearchParams(searchParams);
      next.delete('open');
      setSearchParams(next, { replace: true });
    }
  };

  const addAvailability = async () => {
    if (!selectedSlot) return;
    setLoading(true);
    try {
      const startDate = new Date(selectedSlot.start);
      const endDate = new Date(selectedSlot.end);

      if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
        throw new Error('Please select a valid calendar time.');
      }

      if (endDate.getTime() - startDate.getTime() < 60 * 60 * 1000) {
        throw new Error('Availability slots must be at least 1 hour long.');
      }

      if (repeatWeekly) {
        await api.post('/api/calendar/recurring/rules', {
          dayOfWeek: startDate.getDay(),
          startTime: moment(startDate).format('HH:mm'),
          endTime: moment(endDate).format('HH:mm'),
          tzOffsetMinutes: new Date().getTimezoneOffset(),
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
        });
        if (repeatUntil) {
          await api.post('/api/calendar/recurring/generate', {
            rangeStart: startDate.toISOString(),
            rangeEnd: new Date(`${repeatUntil}T23:59:00`).toISOString()
          });
        }
      } else {
        await api.post('/api/calendar/slots', {
          start: startDate.toISOString(),
          end: endDate.toISOString()
        });
      }
      closeModal();
      refreshCalendar({ quiet: true });
    } catch (e) {
      alert(e.message || 'Failed to add slot');
    } finally {
      setLoading(false);
    }
  };

  const requestSlot = async () => {
    if (!selectedSlot?._id) return;
    setLoading(true);
    const optimisticId = `optimistic-${selectedSlot._id}`;
    setEvents((prev) => prev.map((event) => event.id === selectedSlot._id ? { ...event, id: optimisticId, isPending: true, isMyPending: true, status: 'requested', title: 'Your pending request' } : event));
    try {
      await api.post(`/api/calendar/slots/${selectedSlot._id}/request`, {});
      closeModal();
      navigate('/patient/dashboard');
    } catch (e) {
      refreshCalendar({ quiet: true });
      alert(e.message || 'Failed to request slot.');
    } finally {
      setLoading(false);
    }
  };

  const cancelBooking = async (sessionId) => {
    if (!sessionId) return;
    if (!window.confirm('Cancel this booking? This will notify the other party.')) return;
    setLoading(true);
    const previous = events;
    setEvents((prev) => prev.map((event) => event.sessionId === sessionId ? { ...event, status: 'canceled', title: 'Cancelled' } : event));
    try {
      await api.post('/api/sessions/' + sessionId + '/cancel', {});
      closeModal();
      refreshCalendar({ quiet: true });
    } catch (e) {
      setEvents(previous);
      alert(e.message || 'Failed to cancel booking.');
    } finally {
      setLoading(false);
    }
  };

  const cancelPsychologistBooking = async () => {
    if (!selectedSlot?._id) return;
    if (!window.confirm('Cancel this confirmed session? The patient will be notified.')) return;
    setLoading(true);
    const previous = events;
    setEvents((prev) => prev.filter((event) => event.id !== selectedSlot._id));
    try {
      await api.post(`/api/calendar/slots/${selectedSlot._id}/cancel`, {});
      closeModal();
      refreshCalendar({ quiet: true });
    } catch (e) {
      setEvents(previous);
      alert(e.message || 'Failed to cancel session.');
    } finally {
      setLoading(false);
    }
  };

  const cancelMyRequest = async () => {
    const pendingSessionId = selectedSlot?.pendingSessionId;
    if (!pendingSessionId) return;
    if (!window.confirm('Cancel this booking request?')) return;
    setLoading(true);
    try {
      await api.post('/api/sessions/' + pendingSessionId + '/cancel', {});
      closeModal();
      refreshCalendar({ quiet: true });
    } catch (e) {
      alert(e.message || 'Failed to cancel booking.');
    } finally {
      setLoading(false);
    }
  };

  const confirmRequest = async () => {
    if (!selectedSlot?._id) return;
    setLoading(true);
    const previous = events;
    setEvents((prev) => prev.map((event) => event.id === selectedSlot._id ? { ...event, isPending: false, isBooked: true, status: 'pending_payment', title: event.patientName || 'Confirmed session' } : event));
    try {
      const result = await api.post(`/api/calendar/slots/${selectedSlot._id}/confirm`, {});
      closeModal();
      refreshCalendar({ quiet: true });
      const bookedId = result?.slot?._id;
      if (bookedId) {
        setHighlightedId(String(bookedId));
        navigate(`/calendar?date=${encodeURIComponent(new Date(result.slot.start).toISOString())}&eventId=${bookedId}&sessionId=${result.sessionId || ''}`, { replace: true });
      }
    } catch (e) {
      setEvents(previous);
      alert(e.message || 'Failed to confirm.');
    } finally {
      setLoading(false);
    }
  };

  const rejectRequest = async () => {
    if (!selectedSlot?._id) return;
    if (!window.confirm('Reject this booking request?')) return;
    setLoading(true);
    try {
      await api.post(`/api/calendar/slots/${selectedSlot._id}/reject`, {});
      closeModal();
      refreshCalendar({ quiet: true });
    } catch (e) {
      alert(e.message || 'Failed to reject.');
    } finally {
      setLoading(false);
    }
  };

  const deleteAvailability = async () => {
    if (!selectedSlot?._id) return;
    if (!window.confirm('Remove this available slot?')) return;
    setLoading(true);
    try {
      await api.del(`/api/calendar/slots/${selectedSlot._id}`);
      closeModal();
      refreshCalendar({ quiet: true });
    } catch (e) {
      alert(e.message || 'Failed to remove availability.');
    } finally {
      setLoading(false);
    }
  };

  const openReschedule = () => {
    const start = selectedBooking?.start || selectedSlot?.start;
    const end = selectedBooking?.end || selectedSlot?.end;
    setRescheduleForm({
      start: moment(start).format('YYYY-MM-DDTHH:mm'),
      end: moment(end).format('YYYY-MM-DDTHH:mm')
    });
    setRescheduleOpen(true);
  };

  const rescheduleBooking = async () => {
    if (!selectedSlot?._id) return;
    if (!window.confirm('Reschedule this session? The patient will be notified.')) return;
    setLoading(true);
    try {
      await api.put(`/api/calendar/slots/${selectedSlot._id}/reschedule`, {
        start: new Date(rescheduleForm.start).toISOString(),
        end: new Date(rescheduleForm.end).toISOString()
      });
      closeModal();
      refreshCalendar({ quiet: true });
    } catch (e) {
      alert(e.message || 'Failed to reschedule.');
    } finally {
      setLoading(false);
    }
  };

  const eventStyleGetter = (event) => {
    const status = getEventStatus(event);
    const meta = statusMeta[status] || statusMeta.available;
    const isHighlighted = highlightedId && (String(event.id) === String(highlightedId) || String(event.sessionId) === String(highlightedId));
    return {
      className: isHighlighted ? 'calendar-event-glow' : '',
      style: {
        background: `linear-gradient(135deg, ${meta.color}, ${meta.color}cc)`,
        borderRadius: '14px',
        border: '1px solid rgba(255,255,255,0.20)',
        boxShadow: `0 10px 26px ${meta.soft}`,
        color: 'white',
        padding: 0
      }
    };
  };

  const dayPropGetter = (date) => {
    if (moment(date).isSame(new Date(), 'day')) {
      return { className: 'calendar-today-cell' };
    }
    return {};
  };

  const eventCounts = useMemo(() => ({
    pending: events.filter((event) => getEventStatus(event) === 'requested').length,
    confirmed: events.filter((event) => ['pending_payment', 'paid', 'verified', 'active'].includes(getEventStatus(event))).length,
    completed: events.filter((event) => getEventStatus(event) === 'completed').length
  }), [events]);

  const headerHint = useMemo(() => {
    if (isPatientOwnCalendar) return 'Track booking status, payment, and upcoming sessions in one place.';
    if (isPsychologistOwnCalendar) return 'Review pending requests, reschedule confirmed sessions, and start sessions faster.';
    return 'Pick an available time and send a booking request in one click.';
  }, [isPatientOwnCalendar, isPsychologistOwnCalendar]);

  const legendItems = [
    ['requested', 'Pending bookings'],
    ['paid', 'Confirmed sessions'],
    ['canceled', 'Cancelled sessions'],
    ['completed', 'Completed sessions']
  ];

  const modalTitle = isPatientOwnCalendar
    ? 'Booking details'
    : isPsychologistOwnCalendar
      ? selectedSlot?.pendingSessionId ? 'Pending booking request' : selectedSlot?.isBooked ? 'Confirmed session' : selectedSlot?._id ? 'Available slot' : 'Add availability'
      : selectedSlot?.pendingSessionId ? 'Booking request' : 'Request booking';

  const sessionForActions = sessionDetails || selectedSlot?.session || selectedBooking?.resource;
  const canStartSession = isPsychologistOwnCalendar && ['paid', 'verified', 'active'].includes(String(sessionForActions?.status || ''));

  return (
    <div className="min-h-screen bg-[var(--app-bg)] text-[var(--app-fg)]">
      <style>{`
        .calendar-shell .rbc-calendar { border-radius: 28px; overflow: hidden; background: color-mix(in srgb, var(--panel-bg) 82%, transparent); border: 1px solid var(--panel-border); min-height: 620px; }
        .calendar-shell .rbc-toolbar { gap: .75rem; padding: 1rem; margin: 0; border-bottom: 1px solid var(--panel-border); }
        .calendar-shell .rbc-toolbar button { border: 1px solid var(--panel-border); border-radius: 999px; background: color-mix(in srgb, var(--panel-bg) 88%, transparent); color: var(--app-fg); padding: .5rem .85rem; transition: transform .18s ease, filter .18s ease, background .18s ease; }
        .calendar-shell .rbc-toolbar button:hover, .calendar-shell .rbc-toolbar button.rbc-active { filter: brightness(1.12); transform: translateY(-1px); background: rgba(99,102,241,.18); }
        .calendar-shell .rbc-header, .calendar-shell .rbc-time-header, .calendar-shell .rbc-month-view, .calendar-shell .rbc-time-view, .calendar-shell .rbc-day-bg, .calendar-shell .rbc-time-content, .calendar-shell .rbc-timeslot-group { border-color: var(--panel-border); }
        .calendar-shell .rbc-off-range-bg { background: rgba(148,163,184,.08); }
        .calendar-shell .rbc-today, .calendar-today-cell { background: linear-gradient(180deg, rgba(99,102,241,.16), rgba(99,102,241,.05)); }
        .calendar-shell .rbc-event { transition: transform .18s ease, box-shadow .18s ease, filter .18s ease; overflow: visible; }
        .calendar-shell .rbc-event:hover { transform: translateY(-1px) scale(1.01); filter: saturate(1.12); z-index: 40; }
        .calendar-event-card { position: relative; height: 100%; min-height: 24px; padding: 4px 7px; line-height: 1.15; }
        .calendar-event-preview { background: color-mix(in srgb, var(--panel-bg) 96%, var(--app-bg)); border-color: var(--panel-border); color: var(--app-fg); box-shadow: 0 24px 60px rgba(15,23,42,.28); }
        .calendar-event-preview::before { content: ""; position: absolute; left: 18px; top: -7px; width: 12px; height: 12px; transform: rotate(45deg); background: inherit; border-left: 1px solid var(--panel-border); border-top: 1px solid var(--panel-border); }
        .calendar-event-preview-kicker { color: var(--muted); }
        .calendar-event-preview-title { color: var(--app-fg); }
        .calendar-event-preview-meta, .calendar-event-preview-notes { color: var(--muted); }
        .calendar-modal { background: color-mix(in srgb, var(--panel-bg) 94%, var(--app-bg)); color: var(--app-fg); border-color: var(--panel-border); }
        .calendar-modal-muted { color: var(--muted); }
        .calendar-modal-panel { background: color-mix(in srgb, var(--panel-bg) 82%, transparent); border-color: var(--panel-border); }
        .calendar-modal-soft { background: color-mix(in srgb, var(--app-fg) 6%, transparent); color: var(--muted); }
        .calendar-modal-input { background: color-mix(in srgb, var(--panel-bg) 92%, var(--app-bg)); border-color: var(--panel-border); color: var(--app-fg); color-scheme: ${theme === 'light' ? 'light' : 'dark'}; }
        .calendar-secondary-action { border-color: var(--panel-border); background: color-mix(in srgb, var(--panel-bg) 88%, transparent); color: var(--app-fg); }
        .calendar-secondary-action:hover { filter: brightness(1.08); }
        .calendar-event-glow { animation: calendarGlow 2.8s ease both; }
        .calendar-skeleton > div { animation: calendarPulse 1.2s ease-in-out infinite; }
        @keyframes calendarGlow { 0%,100% { box-shadow: 0 0 0 rgba(251,191,36,0); } 15%,70% { box-shadow: 0 0 0 4px rgba(251,191,36,.38), 0 0 34px rgba(251,191,36,.75); } }
        @keyframes calendarPulse { 0%,100% { opacity: .45; } 50% { opacity: .9; } }
        @media (max-width: 720px) {
          .calendar-shell .rbc-toolbar { align-items: stretch; flex-direction: column; }
          .calendar-shell .rbc-toolbar-label { font-size: 1rem; font-weight: 700; padding: .25rem 0; }
          .calendar-shell .rbc-calendar { min-height: 560px; }
          .calendar-event-preview { display: none !important; }
        }
      `}</style>

      <div className="pointer-events-none fixed inset-0">
        <div className="absolute -top-24 left-1/2 h-72 w-[540px] -translate-x-1/2 rounded-full bg-indigo-500/20 blur-3xl" />
        <div className="absolute -bottom-24 right-[-120px] h-80 w-80 rounded-full bg-fuchsia-500/15 blur-3xl" />
        <div className="absolute inset-0 bg-[var(--app-bg)]" />
      </div>

      <div className="relative">
        <div className="sticky top-0 z-40 border-b border-[color:var(--panel-border)] bg-[color:var(--app-bg-70)] backdrop-blur-xl">
          <div className="mx-auto w-full max-w-7xl px-4 py-4 sm:px-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="min-w-0">
                <div className="text-xs font-semibold uppercase tracking-[.2em] text-indigo-300">Smart scheduling</div>
                <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">Calendar</h1>
                <p className="mt-1 max-w-2xl text-sm text-[color:var(--muted)]">{headerHint}</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button type="button" onClick={() => setCalendarDate(new Date())} className="rounded-2xl border border-[color:var(--panel-border)] bg-[color:var(--panel-bg)] px-4 py-2 text-sm font-semibold hover:brightness-110 transition">
                  Today
                </button>
                <button type="button" onClick={() => refreshCalendar({ quiet: true })} className="rounded-2xl border border-[color:var(--panel-border)] bg-[color:var(--panel-bg)] px-4 py-2 text-sm font-semibold hover:brightness-110 transition">
                  Refresh
                </button>
                <button type="button" onClick={() => navigate(-1)} className="rounded-2xl bg-indigo-500/90 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 transition">
                  Back
                </button>
              </div>
            </div>
          </div>
        </div>

        <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6">
          <Glass className="p-4 sm:p-5">
            <div className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-center">
              <div className="flex flex-wrap items-center gap-3">
                {legendItems.map(([key, label]) => (
                  <div key={key} className="flex items-center gap-2 rounded-full border border-[color:var(--panel-border)] bg-white/5 px-3 py-2 text-xs text-[color:var(--muted)]">
                    <span className={`h-2.5 w-2.5 rounded-full ${statusMeta[key].dot}`} />
                    <span>{label}</span>
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-3 gap-2 text-center text-xs">
                <div className="rounded-2xl bg-amber-500/10 px-3 py-2 text-amber-200"><b>{eventCounts.pending}</b><br />Pending</div>
                <div className="rounded-2xl bg-emerald-500/10 px-3 py-2 text-emerald-200"><b>{eventCounts.confirmed}</b><br />Confirmed</div>
                <div className="rounded-2xl bg-blue-500/10 px-3 py-2 text-blue-200"><b>{eventCounts.completed}</b><br />Done</div>
              </div>
            </div>

            {error && (
              <div className="mt-4 rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-50">
                {error}
                <button type="button" onClick={() => refreshCalendar({ quiet: true })} className="ml-3 rounded-xl bg-white/10 px-3 py-1 text-xs font-semibold text-white hover:bg-white/15 transition">
                  Retry
                </button>
              </div>
            )}
          </Glass>

          <div className={`calendar-shell relative mt-4 ${theme === 'light' ? 'rbc-light' : 'rbc-dark'}`}>
            {initialLoading ? (
              <Glass><CalendarSkeleton /></Glass>
            ) : (
              <>
                {events.length === 0 && <EmptyState mode={isPsychologistOwnCalendar ? 'psychologist' : 'patient'} />}
                <Calendar
                  localizer={localizer}
                  events={events}
                  startAccessor="start"
                  endAccessor="end"
                  date={calendarDate}
                  view={calendarView}
                  onView={handleView}
                  onNavigate={handleNavigate}
                  selectable={isPsychologistOwnCalendar}
                  onSelectSlot={handleSelectSlot}
                  onSelectEvent={handleSelectEvent}
                  eventPropGetter={eventStyleGetter}
                  dayPropGetter={dayPropGetter}
                  components={{ event: AppointmentEvent }}
                  views={['day', 'week', 'month']}
                  popup
                  longPressThreshold={200}
                  style={{ height: 720 }}
                />
              </>
            )}
          </div>
        </main>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4" role="dialog" aria-modal="true" aria-label={modalTitle}>
          <button type="button" aria-label="Close modal" className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={closeModal} />

          <div className="calendar-modal relative max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-3xl border p-6 shadow-2xl backdrop-blur-xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold">{modalTitle}</h2>
                <p className="calendar-modal-muted mt-1 text-sm">
                  {selectedBooking?.patientName || selectedSlot?.patient?.fullName || selectedBooking?.patientName || 'Review schedule details and quick actions.'}
                </p>
              </div>
              <button type="button" onClick={closeModal} className="calendar-secondary-action rounded-2xl border px-3 py-2 text-sm font-semibold transition">
                Close
              </button>
            </div>

            <div className="calendar-modal-panel mt-5 rounded-2xl border p-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <div className="calendar-modal-muted text-xs uppercase tracking-wide">Date</div>
                  <div className="mt-1 text-sm font-semibold">{moment(selectedBooking?.start || selectedBooking?.scheduledStart || selectedSlot?.start).format('MMMM Do YYYY')}</div>
                </div>
                <div>
                  <div className="calendar-modal-muted text-xs uppercase tracking-wide">Time</div>
                  <div className="mt-1 text-sm font-semibold">
                    {formatTimeRange(
                      selectedBooking?.start || selectedBooking?.scheduledStart || selectedSlot?.start,
                      selectedBooking?.end || selectedBooking?.scheduledEnd || selectedSlot?.end
                    )}
                  </div>
                </div>
                <div>
                  <div className="calendar-modal-muted text-xs uppercase tracking-wide">Session type</div>
                  <div className="mt-1 text-sm font-semibold">{getSessionTypeLabel(sessionForActions?.sessionType || selectedSlot?.session?.sessionType)}</div>
                </div>
                <div>
                  <div className="calendar-modal-muted text-xs uppercase tracking-wide">Status</div>
                  <div className="mt-1 text-sm font-semibold">{(statusMeta[sessionForActions?.status || selectedBooking?.status || (selectedSlot?.pendingSessionId ? 'requested' : selectedSlot?.isBooked ? 'paid' : 'available')] || statusMeta.available).label}</div>
                </div>
              </div>
              <div className="calendar-modal-soft mt-4 rounded-xl p-3 text-xs">
                Notes: {selectedBooking?.notes || selectedSlot?.session?.notes || 'No clinical notes attached to this calendar item.'}
              </div>
            </div>

            {rescheduleOpen && (
              <div className="mt-4 rounded-2xl border border-indigo-400/20 bg-indigo-500/10 p-4">
                <div className="text-sm font-semibold text-indigo-100">Reschedule session</div>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <label className="calendar-modal-muted text-xs">
                    Start
                    <input type="datetime-local" value={rescheduleForm.start} onChange={(e) => setRescheduleForm((prev) => ({ ...prev, start: e.target.value }))} className="calendar-modal-input mt-1 h-10 w-full rounded-xl border px-3 text-sm" />
                  </label>
                  <label className="calendar-modal-muted text-xs">
                    End
                    <input type="datetime-local" value={rescheduleForm.end} onChange={(e) => setRescheduleForm((prev) => ({ ...prev, end: e.target.value }))} className="calendar-modal-input mt-1 h-10 w-full rounded-xl border px-3 text-sm" />
                  </label>
                </div>
                <button type="button" onClick={rescheduleBooking} disabled={loading} className="mt-3 w-full rounded-2xl bg-indigo-500/90 py-3 text-sm font-semibold text-white hover:bg-indigo-500 transition disabled:opacity-50">
                  {loading ? 'Rescheduling...' : 'Confirm reschedule'}
                </button>
              </div>
            )}

            {isPsychologistOwnCalendar && selectedSlot?.pendingSessionId ? (
              <div className="mt-6 grid gap-3 sm:grid-cols-3">
                <button type="button" onClick={rejectRequest} disabled={loading} className="rounded-2xl bg-rose-500/90 py-3 text-sm font-semibold text-white hover:bg-rose-500 transition disabled:opacity-50">
                  Reject
                </button>
                <button type="button" onClick={confirmRequest} disabled={loading} className="rounded-2xl bg-emerald-500/90 py-3 text-sm font-semibold text-white hover:bg-emerald-500 transition disabled:opacity-50">
                  {loading ? 'Working...' : 'Confirm'}
                </button>
                <button type="button" onClick={openReschedule} className="calendar-secondary-action rounded-2xl border py-3 text-sm font-semibold transition">
                  Adjust time
                </button>
              </div>
            ) : isPsychologistOwnCalendar && selectedSlot?.isBooked ? (
              <div className="mt-6 grid gap-3 sm:grid-cols-3">
                <button type="button" onClick={openReschedule} className="rounded-2xl bg-indigo-500/90 py-3 text-sm font-semibold text-white hover:bg-indigo-500 transition">
                  Reschedule
                </button>
                <button type="button" onClick={cancelPsychologistBooking} disabled={loading} className="rounded-2xl bg-rose-500/90 py-3 text-sm font-semibold text-white hover:bg-rose-500 transition disabled:opacity-50">
                  Cancel
                </button>
                <button type="button" onClick={() => navigate('/conversation/' + sessionForActions?.patientId)} disabled={!canStartSession || !sessionForActions?.patientId} className="rounded-2xl bg-emerald-500/90 py-3 text-sm font-semibold text-white hover:bg-emerald-500 transition disabled:opacity-50">
                  Start session
                </button>
              </div>
            ) : isPsychologistOwnCalendar ? (
              <>
                <div className="calendar-modal-panel mt-4 rounded-2xl border p-4">
                  <label className="calendar-modal-muted flex items-center gap-3 text-sm">
                    <input id="repeat-weekly" type="checkbox" checked={repeatWeekly} onChange={(e) => setRepeatWeekly(e.target.checked)} className="h-4 w-4 accent-indigo-500" />
                    Repeat weekly
                  </label>
                  {repeatWeekly && (
                    <label className="calendar-modal-muted mt-3 block text-xs" htmlFor="repeat-until">
                      Repeat until
                      <input id="repeat-until" type="date" value={repeatUntil} onChange={(e) => setRepeatUntil(e.target.value)} className="calendar-modal-input mt-1 h-10 w-full rounded-xl border px-3 text-sm" />
                    </label>
                  )}
                </div>
                <div className="mt-6 flex gap-3">
                  <button type="button" onClick={closeModal} className="calendar-secondary-action flex-1 rounded-2xl border py-3 text-sm font-semibold transition">
                    Cancel
                  </button>
                  {selectedSlot?._id ? (
                    <button type="button" onClick={deleteAvailability} disabled={loading} className="flex-1 rounded-2xl bg-rose-500/90 py-3 text-sm font-semibold text-white hover:bg-rose-500 transition disabled:opacity-50">
                      {loading ? 'Removing...' : 'Remove slot'}
                    </button>
                  ) : (
                    <button type="button" onClick={addAvailability} disabled={loading} className="flex-1 rounded-2xl bg-indigo-500/90 py-3 text-sm font-semibold text-white hover:bg-indigo-500 transition disabled:opacity-50">
                      {loading ? 'Adding...' : 'Add slot'}
                    </button>
                  )}
                </div>
              </>
            ) : isPatientOwnCalendar ? (
              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                {selectedBooking?.status === 'pending_payment' && (
                  <button type="button" onClick={() => navigate('/payment/' + selectedBooking._id)} className="rounded-2xl bg-indigo-500/90 py-3 text-sm font-semibold text-white hover:bg-indigo-500 transition">
                    Go to payment
                  </button>
                )}
                {selectedBooking?.status !== 'completed' && selectedBooking?.status !== 'canceled' && selectedBooking?.status !== 'active' && (
                  <button type="button" onClick={() => cancelBooking(selectedBooking?._id)} disabled={loading} className="rounded-2xl bg-rose-500/90 py-3 text-sm font-semibold text-white hover:bg-rose-500 transition disabled:opacity-50">
                    {loading ? 'Canceling...' : 'Cancel booking'}
                  </button>
                )}
              </div>
            ) : (
              <div className="mt-6 flex gap-3">
                {selectedSlot?.pendingSessionId ? (
                  <button type="button" onClick={cancelMyRequest} disabled={loading} className="flex-1 rounded-2xl bg-rose-500/90 py-3 text-sm font-semibold text-white hover:bg-rose-500 transition disabled:opacity-50">
                    {loading ? 'Canceling...' : 'Cancel request'}
                  </button>
                ) : (
                  <button type="button" onClick={requestSlot} disabled={loading || !isPatientViewingPsychologist} className="flex-1 rounded-2xl bg-emerald-500/90 py-3 text-sm font-semibold text-white hover:bg-emerald-500 transition disabled:opacity-50">
                    {loading ? 'Sending...' : 'Send request'}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
