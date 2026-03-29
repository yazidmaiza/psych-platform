import React, { useEffect, useCallback, useMemo, useState } from 'react';
import { Calendar, momentLocalizer } from 'react-big-calendar';
import moment from 'moment';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../services/api';
import { getUser } from '../services/auth';
import 'react-big-calendar/lib/css/react-big-calendar.css';

const localizer = momentLocalizer(moment);

const Glass = ({ children, className = '' }) => (
  <div className={`rounded-3xl border border-white/10 bg-white/5 backdrop-blur-xl shadow-sm ${className}`}>
    {children}
  </div>
);

export default function CalendarPage() {
  const [events, setEvents] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [loading, setLoading] = useState(false);
  const [calendarDate, setCalendarDate] = useState(() => new Date());
  const [error, setError] = useState('');

  const navigate = useNavigate();
  const { role, userId } = getUser();
  const { psychologistId } = useParams();

  const targetId = psychologistId || userId || '';
  const storageKey = `calendar:lastDate:${role || 'unknown'}:${targetId || 'unknown'}`;

  useEffect(() => {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return;
    const d = new Date(raw);
    if (!Number.isNaN(d.getTime())) setCalendarDate(d);
  }, [storageKey]);

  const fetchSlots = useCallback(async () => {
    setError('');
    try {
      const data = await api.get(`/api/calendar/slots/${targetId}`);
      const mapped = (Array.isArray(data) ? data : []).map((slot) => {
        const isPending = !!slot.pendingSessionId;
        const isMyPending = role === 'patient' && String(slot.pendingPatientId) === String(userId);
        const title = slot.isBooked
          ? 'Booked'
          : isPending
            ? (isMyPending ? 'Pending confirmation' : 'Pending')
            : 'Available';

        return {
          id: slot._id,
          title,
          start: new Date(slot.start),
          end: new Date(slot.end),
          isBooked: slot.isBooked,
          isPending,
          isMyPending,
          resource: slot
        };
      });

      setEvents(mapped);

      // If calendar resets after logout/login, keep the user anchored near their slots
      if (!localStorage.getItem(storageKey) && mapped.length > 0) {
        setCalendarDate(new Date(mapped[0].start));
      }
    } catch (e) {
      setEvents([]);
      setError(e.message || 'Failed to load slots');
    }
  }, [role, storageKey, targetId, userId]);

  useEffect(() => {
    fetchSlots();
  }, [fetchSlots]);

  const handleNavigate = (date) => {
    setCalendarDate(date);
    try {
      localStorage.setItem(storageKey, date.toISOString());
    } catch {}
  };

  const handleSelectSlot = ({ start, end }) => {
    if (role !== 'psychologist' || psychologistId) return;
    setSelectedSlot({ start, end });
    setShowModal(true);
  };

  const handleSelectEvent = (event) => {
    if (role === 'patient' && psychologistId) {
      if (event.isBooked) return;
      if (event.isPending && !event.isMyPending) return;
      setSelectedSlot(event.resource);
      setShowModal(true);
      return;
    }

    if (role === 'psychologist' && !psychologistId) {
      if (!event.resource?.pendingSessionId) return;
      setSelectedSlot(event.resource);
      setShowModal(true);
    }
  };

  const closeModal = () => {
    setShowModal(false);
    setSelectedSlot(null);
  };

  const addAvailability = async () => {
    if (!selectedSlot) return;
    setLoading(true);
    try {
      await api.post('/api/calendar/slots', {
        start: selectedSlot.start,
        end: selectedSlot.end
      });
      closeModal();
      fetchSlots();
    } catch (e) {
      alert(e.message || 'Failed to add slot');
    } finally {
      setLoading(false);
    }
  };

  const requestSlot = async () => {
    if (!selectedSlot?._id) return;
    setLoading(true);
    try {
      await api.post(`/api/calendar/slots/${selectedSlot._id}/request`, {});
      closeModal();
      fetchSlots();
      alert('A booking request was sent to the psychologist. You will be notified once it is confirmed.');
    } catch (e) {
      alert(e.message || 'Failed to request slot.');
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
      fetchSlots();
      alert('Booking request canceled.');
    } catch (e) {
      alert(e.message || 'Failed to cancel booking.');
    } finally {
      setLoading(false);
    }
  };

  const confirmRequest = async () => {
    if (!selectedSlot?._id) return;
    setLoading(true);
    try {
      await api.post(`/api/calendar/slots/${selectedSlot._id}/confirm`, {});
      closeModal();
      fetchSlots();
      alert('Confirmed. The patient has been notified and can now proceed to payment.');
    } catch (e) {
      alert(e.message || 'Failed to confirm.');
    } finally {
      setLoading(false);
    }
  };

  const rejectRequest = async () => {
    if (!selectedSlot?._id) return;
    setLoading(true);
    try {
      await api.post(`/api/calendar/slots/${selectedSlot._id}/reject`, {});
      closeModal();
      fetchSlots();
      alert('Rejected. The patient has been notified.');
    } catch (e) {
      alert(e.message || 'Failed to reject.');
    } finally {
      setLoading(false);
    }
  };

  const eventStyleGetter = (event) => {
    let backgroundColor = '#3B82F6'; // blue
    if (event.isBooked) backgroundColor = '#F43F5E'; // rose
    else if (event.isPending) backgroundColor = '#F59E0B'; // amber

    return {
      style: {
        backgroundColor,
        borderRadius: '10px',
        border: '1px solid rgba(255,255,255,0.08)',
        color: 'white',
        fontSize: '12px',
        padding: '2px 6px'
      }
    };
  };

  const headerHint = useMemo(() => {
    if (role === 'psychologist' && !psychologistId) {
      return 'Select a time range to add availability. Click pending slots to confirm or reject.';
    }
    return 'Click an available slot to request a booking. Click your pending slot to cancel it.';
  }, [psychologistId, role]);

  const isPatientViewingPsychologist = role === 'patient' && !!psychologistId;
  const isPsychologistOwnCalendar = role === 'psychologist' && !psychologistId;

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute -top-24 left-1/2 h-72 w-[540px] -translate-x-1/2 rounded-full bg-indigo-500/20 blur-3xl" />
        <div className="absolute -bottom-24 right-[-120px] h-80 w-80 rounded-full bg-fuchsia-500/15 blur-3xl" />
        <div className="absolute inset-0 bg-gradient-to-b from-slate-950 via-slate-950 to-slate-900" />
      </div>

      <div className="relative">
        <div className="sticky top-0 z-40 border-b border-white/10 bg-slate-950/40 backdrop-blur-xl">
          <div className="mx-auto w-full max-w-6xl px-4 py-4 sm:px-6">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <h1 className="text-xl sm:text-2xl font-semibold tracking-tight">Calendar</h1>
                <p className="mt-1 text-sm text-white/60">{headerHint}</p>
              </div>
              <button
                type="button"
                onClick={() => navigate(-1)}
                className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm font-semibold text-white/80 hover:bg-white/10 transition"
              >
                Back
              </button>
            </div>
          </div>
        </div>

        <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6">
          <Glass className="p-4 sm:p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="text-sm font-semibold text-white">Legend</div>
                <div className="mt-1 text-xs text-white/60">
                  {isPsychologistOwnCalendar
                    ? 'Your availability is shown in blue. Pending requests appear in amber.'
                    : 'Available times are shown in blue. Your pending request is amber.'}
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-4 text-xs text-white/70">
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-blue-500" />
                  <span>Available</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
                  <span>Pending</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-rose-500" />
                  <span>Booked</span>
                </div>
              </div>
            </div>

            {error && (
              <div className="mt-4 rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-50">
                {error}
                <button
                  type="button"
                  onClick={fetchSlots}
                  className="ml-3 rounded-xl bg-white/10 px-3 py-1 text-xs font-semibold text-white hover:bg-white/15 transition"
                >
                  Retry
                </button>
              </div>
            )}
          </Glass>

          <div className="mt-4 rbc-dark">
            <Calendar
              localizer={localizer}
              events={events}
              startAccessor="start"
              endAccessor="end"
              date={calendarDate}
              onNavigate={handleNavigate}
              selectable={isPsychologistOwnCalendar}
              onSelectSlot={handleSelectSlot}
              onSelectEvent={handleSelectEvent}
              style={{ height: 700 }}
              eventPropGetter={eventStyleGetter}
              defaultView="week"
              views={['month', 'week', 'day']}
            />
          </div>
        </main>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <button
            type="button"
            aria-label="Close modal"
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={closeModal}
          />

          <div className="relative w-full max-w-md rounded-3xl border border-white/10 bg-slate-950/70 p-6 shadow-2xl backdrop-blur-xl">
            {isPsychologistOwnCalendar ? (
              selectedSlot?.pendingSessionId ? (
                <>
                  <h2 className="text-lg font-semibold text-white">Pending booking request</h2>
                  <p className="mt-1 text-sm text-white/60">Confirm or reject this request.</p>

                  <div className="mt-5 rounded-2xl border border-white/10 bg-white/5 p-4">
                    <div className="text-sm text-white/80">
                      <span className="font-semibold text-white">From:</span>{' '}
                      {moment(selectedSlot?.start).format('MMMM Do YYYY, h:mm a')}
                    </div>
                    <div className="mt-1 text-sm text-white/80">
                      <span className="font-semibold text-white">To:</span>{' '}
                      {moment(selectedSlot?.end).format('MMMM Do YYYY, h:mm a')}
                    </div>
                  </div>

                  <div className="mt-6 flex gap-3">
                    <button
                      type="button"
                      onClick={closeModal}
                      className="flex-1 rounded-2xl border border-white/10 bg-white/5 py-3 text-sm font-semibold text-white/80 hover:bg-white/10 transition"
                    >
                      Close
                    </button>
                    <button
                      type="button"
                      onClick={rejectRequest}
                      disabled={loading}
                      className="flex-1 rounded-2xl bg-rose-500/90 py-3 text-sm font-semibold text-white hover:bg-rose-500 transition disabled:opacity-50"
                    >
                      {loading ? 'Working...' : 'Reject'}
                    </button>
                    <button
                      type="button"
                      onClick={confirmRequest}
                      disabled={loading}
                      className="flex-1 rounded-2xl bg-emerald-500/90 py-3 text-sm font-semibold text-white hover:bg-emerald-500 transition disabled:opacity-50"
                    >
                      {loading ? 'Working...' : 'Confirm'}
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <h2 className="text-lg font-semibold text-white">Add availability</h2>
                  <p className="mt-1 text-sm text-white/60">Add this time slot as available for patients.</p>

                  <div className="mt-5 rounded-2xl border border-white/10 bg-white/5 p-4">
                    <div className="text-sm text-white/80">
                      <span className="font-semibold text-white">From:</span>{' '}
                      {moment(selectedSlot?.start).format('MMMM Do YYYY, h:mm a')}
                    </div>
                    <div className="mt-1 text-sm text-white/80">
                      <span className="font-semibold text-white">To:</span>{' '}
                      {moment(selectedSlot?.end).format('MMMM Do YYYY, h:mm a')}
                    </div>
                  </div>

                  <div className="mt-6 flex gap-3">
                    <button
                      type="button"
                      onClick={closeModal}
                      className="flex-1 rounded-2xl border border-white/10 bg-white/5 py-3 text-sm font-semibold text-white/80 hover:bg-white/10 transition"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={addAvailability}
                      disabled={loading}
                      className="flex-1 rounded-2xl bg-indigo-500/90 py-3 text-sm font-semibold text-white hover:bg-indigo-500 transition disabled:opacity-50"
                    >
                      {loading ? 'Adding...' : 'Add slot'}
                    </button>
                  </div>
                </>
              )
            ) : (
              <>
                <h2 className="text-lg font-semibold text-white">
                  {selectedSlot?.pendingSessionId ? 'Booking request' : 'Request booking'}
                </h2>
                <p className="mt-1 text-sm text-white/60">
                  Your first chatbot session is pre-consultation. Future sessions automatically switch to follow-up after your first session is completed.
                </p>

                <div className="mt-5 rounded-2xl border border-white/10 bg-white/5 p-4">
                  <div className="text-sm text-white/80">
                    <span className="font-semibold text-white">From:</span>{' '}
                    {moment(selectedSlot?.start).format('MMMM Do YYYY, h:mm a')}
                  </div>
                  <div className="mt-1 text-sm text-white/80">
                    <span className="font-semibold text-white">To:</span>{' '}
                    {moment(selectedSlot?.end).format('MMMM Do YYYY, h:mm a')}
                  </div>
                  {selectedSlot?.pendingSessionId && (
                    <div className="mt-3 text-xs text-white/60">
                      This request is pending confirmation. You can cancel it anytime.
                    </div>
                  )}
                </div>

                <div className="mt-6 flex gap-3">
                  <button
                    type="button"
                    onClick={closeModal}
                    className="flex-1 rounded-2xl border border-white/10 bg-white/5 py-3 text-sm font-semibold text-white/80 hover:bg-white/10 transition"
                  >
                    Close
                  </button>

                  {selectedSlot?.pendingSessionId ? (
                    <button
                      type="button"
                      onClick={cancelMyRequest}
                      disabled={loading}
                      className="flex-1 rounded-2xl bg-rose-500/90 py-3 text-sm font-semibold text-white hover:bg-rose-500 transition disabled:opacity-50"
                    >
                      {loading ? 'Canceling...' : 'Cancel request'}
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={requestSlot}
                      disabled={loading || !isPatientViewingPsychologist}
                      className="flex-1 rounded-2xl bg-emerald-500/90 py-3 text-sm font-semibold text-white hover:bg-emerald-500 transition disabled:opacity-50"
                    >
                      {loading ? 'Sending...' : 'Send request'}
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

