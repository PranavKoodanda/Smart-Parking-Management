import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { LogOut, Clock, Car, Calendar, Plus, X, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

function CountdownTimer({ exitTime, onExpired }) {
  const [timeLeft, setTimeLeft] = useState('');
  const [isExpiring, setIsExpiring] = useState(false);

  useEffect(() => {
    // Append 'Z' if it's missing so the browser knows it's UTC time!
    const formattedExitTime = exitTime.endsWith('Z') ? exitTime : `${exitTime}Z`;
    const interval = setInterval(() => {
      const now = new Date();
      const exit = new Date(formattedExitTime);
      const diff = exit - now;

      if (diff <= 0) {
        setTimeLeft('EXPIRED');
        setIsExpiring(true);
        onExpired && onExpired();
      } else {
        const hours = Math.floor(diff / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((diff % (1000 * 60)) / 1000);
        setTimeLeft(`${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`);
        setIsExpiring(diff < 15 * 60 * 1000);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [exitTime, onExpired]);

  return (
    <div
      className={`text-5xl sm:text-6xl font-black tracking-tight tabular-nums ${isExpiring ? 'text-red-500' : 'text-emerald-500'}`}
      style={{ fontFamily: 'IBM Plex Mono, monospace' }}
    >
      {timeLeft}
    </div>
  );
}

export default function UserDashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [activeBooking, setActiveBooking] = useState(null);
  const [bookingHistory, setBookingHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showBookingForm, setShowBookingForm] = useState(false);
  const [availability, setAvailability] = useState([]);

  // Booking form state
  const [vehicleNumber, setVehicleNumber] = useState('');
  const [vehicleType, setVehicleType] = useState('');
  const [duration, setDuration] = useState(1);
  const [bookingType, setBookingType] = useState('online');
  const [bookingLoading, setBookingLoading] = useState(false);
  
  // Extend form state
  const [showExtendForm, setShowExtendForm] = useState(false);
  const [extendHours, setExtendHours] = useState(1);

  useEffect(() => {
    if (user && user.role === 'admin') {
      navigate('/admin');
    } else {
      fetchBookings();
      fetchAvailability();
    }
  }, [user, navigate]);

  const fetchAvailability = async () => {
    try {
      const { data } = await axios.get(`${BACKEND_URL}/api/public/availability`);
      setAvailability(data);
    } catch (error) {
      console.error('Failed to fetch availability:', error);
    }
  };

  const fetchBookings = async () => {
    try {
      const { data } = await axios.get(`${BACKEND_URL}/api/bookings/my`, {
        withCredentials: true,
      });
      const active = data.find((b) => b.status === 'active');
      const history = data.filter((b) => b.status !== 'active');
      setActiveBooking(active || null);
      setBookingHistory(history);
    } catch (error) {
      console.error('Failed to fetch bookings:', error);
      toast.error('Failed to load bookings');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateBooking = async (e) => {
    e.preventDefault();
    setBookingLoading(true);
    try {
      navigate('/payment', {
        state: {
          bookingDraft: {
            vehicle_number: vehicleNumber,
            vehicle_type: vehicleType,
            duration_hours: parseFloat(duration),
            booking_type: bookingType,
          },
        },
      });
      setShowBookingForm(false);
      setVehicleNumber('');
      setVehicleType('');
      setDuration(1);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to initiate payment');
    } finally {
      setBookingLoading(false);
    }
  };

  const handleExtend = async () => {
    try {
      const { data } = await axios.post(
        `${BACKEND_URL}/api/bookings/${activeBooking.id}/extend`,
        { additional_hours: parseFloat(extendHours) },
        { withCredentials: true }
      );
      toast.success(`Booking extended. Additional: ₹${data.additional_amount}`);
      setShowExtendForm(false);
      setExtendHours(1);
      fetchBookings();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to extend booking');
    }
  };

  const handleCancel = async () => {
    if (!window.confirm('Are you sure you want to cancel this booking?')) return;
    try {
      const { data } = await axios.post(
        `${BACKEND_URL}/api/bookings/${activeBooking.id}/cancel`,
        {},
        { withCredentials: true }
      );
      toast.success(`Booking cancelled. Fee: ₹${data.cancellation_fee}`);
      fetchBookings();
      fetchAvailability();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to cancel booking');
    }
  };

  const handleComplete = async () => {
    try {
      await axios.post(
        `${BACKEND_URL}/api/bookings/${activeBooking.id}/complete`,
        {},
        { withCredentials: true }
      );
      toast.success('Booking completed successfully');
      fetchBookings();
      fetchAvailability();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to complete booking');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-zinc-900 border-t-transparent rounded-none animate-spin mx-auto mb-4"></div>
          <p className="text-zinc-600 font-mono text-sm tracking-wide">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50">
      <header className="bg-white border-b border-zinc-200">
        <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
          <h1 className="text-2xl sm:text-3xl tracking-tight font-bold text-zinc-950" style={{ fontFamily: 'IBM Plex Sans, sans-serif' }}>
            My Parking
          </h1>
          <div className="flex items-center gap-4">
            <span className="text-sm text-zinc-600">{user?.name}</span>
            <button onClick={logout} className="flex items-center gap-2 px-4 py-2 border border-zinc-200 text-zinc-900 hover:bg-zinc-100 transition-all duration-150 rounded-none">
              <LogOut className="w-4 h-4" strokeWidth={1.5} />
              Logout
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        {activeBooking ? (
          <div className="bg-white border border-zinc-200 p-8 mb-8">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl sm:text-2xl tracking-tight font-semibold text-zinc-950" style={{ fontFamily: 'IBM Plex Sans, sans-serif' }}>
                Active Booking
              </h2>
              <span className="bg-emerald-500 text-white px-4 py-1 text-xs font-mono tracking-wide">ACTIVE</span>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div className="flex flex-col justify-center items-center border border-zinc-200 p-8">
                <div className="text-xs tracking-[0.2em] uppercase font-mono text-zinc-500 mb-4">Time Remaining</div>
                <CountdownTimer exitTime={activeBooking.exit_time} />
                <p className="text-sm text-zinc-600 mt-4">Exit by: {new Date(activeBooking.exit_time.endsWith('Z') ? activeBooking.exit_time : `${activeBooking.exit_time}Z`).toLocaleString()}</p>
              </div>

              <div className="space-y-4">
                <div>
                  <div className="text-xs tracking-[0.2em] uppercase font-mono text-zinc-500 mb-1">Vehicle</div>
                  <div className="text-lg font-semibold text-zinc-950">{activeBooking.vehicle_number}</div>
                </div>
                <div>
                  <div className="text-xs tracking-[0.2em] uppercase font-mono text-zinc-500 mb-1">Slot</div>
                  <div className="text-lg font-semibold text-zinc-950">{activeBooking.slot_number}</div>
                </div>
                <div>
                  <div className="text-xs tracking-[0.2em] uppercase font-mono text-zinc-500 mb-1">Type</div>
                  <div className="text-lg font-semibold text-zinc-950">{activeBooking.vehicle_type}</div>
                </div>
                <div>
                  <div className="text-xs tracking-[0.2em] uppercase font-mono text-zinc-500 mb-1">Amount</div>
                  <div className="text-2xl font-bold text-zinc-950" style={{ fontFamily: 'IBM Plex Mono, monospace' }}>₹{activeBooking.amount}</div>
                </div>

                <div className="flex gap-3 mt-6">
                  <button onClick={() => setShowExtendForm(true)} className="flex-1 bg-blue-600 text-white px-4 py-3 font-medium hover:-translate-y-0.5 transition-transform duration-150 rounded-none">Extend Time</button>
                  <button onClick={handleComplete} className="flex-1 bg-emerald-600 text-white px-4 py-3 font-medium hover:-translate-y-0.5 transition-transform duration-150 rounded-none">Complete</button>
                  <button onClick={handleCancel} className="flex-1 bg-red-500 text-white px-4 py-3 font-medium hover:-translate-y-0.5 transition-transform duration-150 rounded-none">Cancel</button>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-white border border-zinc-200 p-8 mb-8 text-center">
            <AlertCircle className="w-12 h-12 text-zinc-400 mx-auto mb-4" strokeWidth={1.5} />
            <p className="text-zinc-600 mb-4">No active booking</p>
            <button onClick={() => setShowBookingForm(true)} className="bg-zinc-900 text-white px-6 py-3 font-medium hover:-translate-y-0.5 transition-transform duration-150 rounded-none inline-flex items-center gap-2">
              <Plus className="w-5 h-5" strokeWidth={1.5} /> Create Booking
            </button>
          </div>
        )}

        <div className="bg-white border border-zinc-200 p-8">
          <h2 className="text-xl sm:text-2xl tracking-tight font-semibold text-zinc-950 mb-6" style={{ fontFamily: 'IBM Plex Sans, sans-serif' }}>
            Booking History
          </h2>
          {bookingHistory.length === 0 ? (
            <p className="text-zinc-600 text-center py-8">No booking history yet</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b border-zinc-200">
                    <th className="text-left py-3 px-4 text-xs tracking-[0.2em] uppercase font-mono text-zinc-500">Vehicle</th>
                    <th className="text-left py-3 px-4 text-xs tracking-[0.2em] uppercase font-mono text-zinc-500">Type</th>
                    <th className="text-left py-3 px-4 text-xs tracking-[0.2em] uppercase font-mono text-zinc-500">Slot</th>
                    <th className="text-left py-3 px-4 text-xs tracking-[0.2em] uppercase font-mono text-zinc-500">Date</th>
                    <th className="text-left py-3 px-4 text-xs tracking-[0.2em] uppercase font-mono text-zinc-500">Duration</th>
                    <th className="text-left py-3 px-4 text-xs tracking-[0.2em] uppercase font-mono text-zinc-500">Amount</th>
                    <th className="text-left py-3 px-4 text-xs tracking-[0.2em] uppercase font-mono text-zinc-500">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {bookingHistory.map((booking) => (
                    <tr key={booking.id} className="border-b border-zinc-200 hover:bg-zinc-50">
                      <td className="py-3 px-4 font-semibold text-zinc-950">{booking.vehicle_number}</td>
                      <td className="py-3 px-4 text-zinc-700">{booking.vehicle_type}</td>
                      <td className="py-3 px-4 font-mono text-zinc-700">{booking.slot_number}</td>
                      <td className="py-3 px-4 text-zinc-700">{new Date(booking.created_at).toLocaleDateString()}</td>
                      <td className="py-3 px-4 font-mono text-zinc-700">{booking.duration_hours}h</td>
                      <td className="py-3 px-4 font-mono text-zinc-950">₹{booking.amount}</td>
                      <td className="py-3 px-4">
                        <span className={`px-3 py-1 text-xs font-mono ${booking.status === 'completed' ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'}`}>
                          {booking.status.toUpperCase()}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>

      {showBookingForm && (
        <div className="fixed inset-0 bg-zinc-900/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white w-full max-w-2xl border border-zinc-200">
            <div className="flex justify-between items-center p-6 border-b border-zinc-200">
              <h3 className="text-xl font-semibold text-zinc-950">New Booking</h3>
              <button onClick={() => setShowBookingForm(false)}>
                <X className="w-6 h-6 text-zinc-600" strokeWidth={1.5} />
              </button>
            </div>
            <form onSubmit={handleCreateBooking} className="p-6 space-y-6">
              <div>
                <label className="text-xs tracking-[0.2em] uppercase font-mono text-zinc-500 block mb-2">Vehicle Number</label>
                <input type="text" value={vehicleNumber} onChange={(e) => setVehicleNumber(e.target.value)} className="w-full px-4 py-3 border border-zinc-200 bg-white text-zinc-950 focus:outline-none focus:ring-2 focus:ring-zinc-900 rounded-none uppercase" placeholder="MH01AB1234" required />
              </div>
              <div>
                <label className="text-xs tracking-[0.2em] uppercase font-mono text-zinc-500 block mb-2">Vehicle Type</label>
                <select value={vehicleType} onChange={(e) => setVehicleType(e.target.value)} className="w-full px-4 py-3 border border-zinc-200 bg-white text-zinc-950 focus:outline-none focus:ring-2 focus:ring-zinc-900 rounded-none" required>
                  <option value="">Select Type</option>
                  {availability.map((item) => (
                    <option key={item.vehicle_type} value={item.vehicle_type} disabled={item.slots_available === 0}>
                      {item.vehicle_type} - {item.slots_available} slots available (₹{item.price_per_hour}/hr)
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs tracking-[0.2em] uppercase font-mono text-zinc-500 block mb-2">Duration (hours)</label>
                <input type="number" value={duration} onChange={(e) => setDuration(e.target.value)} className="w-full px-4 py-3 border border-zinc-200 bg-white text-zinc-950 focus:outline-none focus:ring-2 focus:ring-zinc-900 rounded-none" min="0.5" step="0.5" required />
              </div>
              <div>
                <label className="text-xs tracking-[0.2em] uppercase font-mono text-zinc-500 block mb-2">Booking Type</label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2">
                    <input type="radio" value="online" checked={bookingType === 'online'} onChange={(e) => setBookingType(e.target.value)} />
                    <span className="text-zinc-950">Online Pre-Booking</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input type="radio" value="on-spot" checked={bookingType === 'on-spot'} onChange={(e) => setBookingType(e.target.value)} />
                    <span className="text-zinc-950">On-Spot Booking</span>
                  </label>
                </div>
              </div>
              <button type="submit" disabled={bookingLoading} className="w-full bg-zinc-900 text-white px-8 py-4 font-medium hover:-translate-y-0.5 transition-transform duration-150 disabled:opacity-50 rounded-none">
                {bookingLoading ? 'Creating...' : 'Create Booking'}
              </button>
            </form>
          </div>
        </div>
      )}

      {showExtendForm && (
        <div className="fixed inset-0 bg-zinc-900/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white w-full max-w-md border border-zinc-200">
            <div className="flex justify-between items-center p-6 border-b border-zinc-200">
              <h3 className="text-xl font-semibold text-zinc-950">Extend Booking</h3>
              <button onClick={() => setShowExtendForm(false)}>
                <X className="w-6 h-6 text-zinc-600" strokeWidth={1.5} />
              </button>
            </div>
            <div className="p-6 space-y-6">
              <div>
                <label className="text-xs tracking-[0.2em] uppercase font-mono text-zinc-500 block mb-2">Additional Hours</label>
                <input type="number" value={extendHours} onChange={(e) => setExtendHours(e.target.value)} className="w-full px-4 py-3 border border-zinc-200 bg-white text-zinc-950 focus:outline-none focus:ring-2 focus:ring-zinc-900 rounded-none" min="0.5" step="0.5" />
              </div>
              <button onClick={handleExtend} className="w-full bg-zinc-900 text-white px-8 py-4 font-medium hover:-translate-y-0.5 transition-transform duration-150 rounded-none">
                Extend Booking
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
