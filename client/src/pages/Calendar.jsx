import React, { useState, useEffect } from 'react';
import { Calendar, momentLocalizer } from 'react-big-calendar';
import moment from 'moment';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import { getUser } from '../services/auth';
import 'react-big-calendar/lib/css/react-big-calendar.css';

const localizer = momentLocalizer(moment);

function CalendarPage() {
    const [events, setEvents] = useState([]);
    const [slots, setSlots] = useState([]);
    const [showModal, setShowModal] = useState(false);
    const [selectedSlot, setSelectedSlot] = useState(null);
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();
    const { role, userId } = getUser();

    useEffect(() => {
        fetchSlots();
    }, []);

    const fetchSlots = async () => {
        try {
            const data = await api.get(`/api/calendar/slots/${userId}`);
            const mapped = (Array.isArray(data) ? data : []).map(slot => ({
                id: slot._id,
                title: slot.isBooked ? '🔒 Booked' : '✅ Available',
                start: new Date(slot.start),
                end: new Date(slot.end),
                isBooked: slot.isBooked,
                resource: slot
            }));
            setSlots(data);
            setEvents(mapped);
        } catch (err) {
            console.error(err);
        }
    };

    // Psychologist selects a time slot to add availability
    const handleSelectSlot = ({ start, end }) => {
        if (role !== 'psychologist') return;
        setSelectedSlot({ start, end });
        setShowModal(true);
    };

    // Patient clicks an available slot to book it
    const handleSelectEvent = (event) => {
        if (role === 'patient' && !event.isBooked) {
            setSelectedSlot(event.resource);
            setShowModal(true);
        }
    };

    const addAvailability = async () => {
        if (!selectedSlot) return;
        setLoading(true);
        try {
            await api.post('/api/calendar/slots', {
                start: selectedSlot.start,
                end: selectedSlot.end
            });
            setShowModal(false);
            fetchSlots();
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const bookSlot = async () => {
        if (!selectedSlot) return;
        setLoading(true);
        try {
            await api.post(`/api/calendar/slots/${selectedSlot._id}/book`, {});
            setShowModal(false);
            fetchSlots();
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const eventStyleGetter = (event) => ({
        style: {
            backgroundColor: event.isBooked ? '#EF4444' : '#2563EB',
            borderRadius: '8px',
            border: 'none',
            color: 'white',
            fontSize: '12px',
            padding: '2px 6px'
        }
    });

    return (
        <div className="min-h-screen bg-gray-50">
            <div className="bg-white shadow-sm">
                <div className="max-w-6xl mx-auto px-6 py-5 flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-bold text-blue-700">📅 Calendar</h1>
                        <p className="text-gray-500 text-sm mt-1">
                            {role === 'psychologist'
                                ? 'Click on any time slot to add your availability'
                                : 'Click on a blue slot to book an appointment'}
                        </p>
                    </div>
                    <button
                        onClick={() => navigate(-1)}
                        className="text-blue-600 text-sm font-semibold hover:underline"
                    >
                        ← Back
                    </button>
                </div>
            </div>

            <div className="max-w-6xl mx-auto px-6 py-8">
                {/* Legend */}
                <div className="flex gap-4 mb-6">
                    <div className="flex items-center gap-2">
                        <div className="w-4 h-4 rounded bg-blue-600" />
                        <span className="text-sm text-gray-600">Available</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-4 h-4 rounded bg-red-500" />
                        <span className="text-sm text-gray-600">Booked</span>
                    </div>
                </div>

                <div className="bg-white rounded-2xl shadow p-6">
                    <Calendar
                        localizer={localizer}
                        events={events}
                        startAccessor="start"
                        endAccessor="end"
                        style={{ height: 600 }}
                        selectable={role === 'psychologist'}
                        onSelectSlot={handleSelectSlot}
                        onSelectEvent={handleSelectEvent}
                        eventPropGetter={eventStyleGetter}
                        defaultView="week"
                        views={['month', 'week', 'day']}
                    />
                </div>
            </div>

            {/* Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
                    <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-md mx-4">
                        {role === 'psychologist' ? (
                            <>
                                <h2 className="text-xl font-bold text-gray-800 mb-2">Add Availability</h2>
                                <p className="text-gray-500 text-sm mb-6">
                                    Add this time slot as available for patients to book:
                                </p>
                                <div className="bg-gray-50 rounded-xl p-4 mb-6">
                                    <p className="text-sm text-gray-700">
                                        <span className="font-semibold">From:</span>{' '}
                                        {moment(selectedSlot?.start).format('MMMM Do YYYY, h:mm a')}
                                    </p>
                                    <p className="text-sm text-gray-700 mt-1">
                                        <span className="font-semibold">To:</span>{' '}
                                        {moment(selectedSlot?.end).format('MMMM Do YYYY, h:mm a')}
                                    </p>
                                </div>
                                <div className="flex gap-3">
                                    <button
                                        onClick={() => setShowModal(false)}
                                        className="flex-1 border border-gray-200 text-gray-600 py-3 rounded-xl font-semibold hover:bg-gray-50 transition"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={addAvailability}
                                        disabled={loading}
                                        className="flex-1 bg-blue-600 text-white py-3 rounded-xl font-semibold hover:bg-blue-700 transition disabled:opacity-50"
                                    >
                                        {loading ? 'Adding...' : '✅ Add Slot'}
                                    </button>
                                </div>
                            </>
                        ) : (
                            <>
                                <h2 className="text-xl font-bold text-gray-800 mb-2">Book Appointment</h2>
                                <p className="text-gray-500 text-sm mb-6">
                                    Confirm your appointment for this time slot:
                                </p>
                                <div className="bg-blue-50 rounded-xl p-4 mb-6">
                                    <p className="text-sm text-gray-700">
                                        <span className="font-semibold">From:</span>{' '}
                                        {moment(selectedSlot?.start).format('MMMM Do YYYY, h:mm a')}
                                    </p>
                                    <p className="text-sm text-gray-700 mt-1">
                                        <span className="font-semibold">To:</span>{' '}
                                        {moment(selectedSlot?.end).format('MMMM Do YYYY, h:mm a')}
                                    </p>
                                </div>
                                <div className="flex gap-3">
                                    <button
                                        onClick={() => setShowModal(false)}
                                        className="flex-1 border border-gray-200 text-gray-600 py-3 rounded-xl font-semibold hover:bg-gray-50 transition"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={bookSlot}
                                        disabled={loading}
                                        className="flex-1 bg-green-500 text-white py-3 rounded-xl font-semibold hover:bg-green-600 transition disabled:opacity-50"
                                    >
                                        {loading ? 'Booking...' : '📅 Confirm Booking'}
                                    </button>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

export default CalendarPage;