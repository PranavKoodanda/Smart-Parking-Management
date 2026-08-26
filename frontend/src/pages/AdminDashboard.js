import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { LogOut, Settings, Edit } from 'lucide-react';
import { toast } from 'sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

export default function AdminDashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [parkingConfigs, setParkingConfigs] = useState([]);
  const [allBookings, setAllBookings] = useState([]);
  const [settings, setSettings] = useState({ cancellation_type: 'fixed', cancellation_value: 50 });
  const [loading, setLoading] = useState(true);
  const [showConfigEdit, setShowConfigEdit] = useState(false);
  const [showSettingsEdit, setShowSettingsEdit] = useState(false);
  const [editingConfig, setEditingConfig] = useState(null);

  useEffect(() => {
    if (user && user.role !== 'admin') {
      navigate('/dashboard');
    } else {
      fetchData();
    }
  }, [user, navigate]);

  const fetchData = async () => {
    try {
      const [statsRes, configsRes, bookingsRes, settingsRes] = await Promise.all([
        axios.get(`${BACKEND_URL}/api/admin/stats`, { withCredentials: true }),
        axios.get(`${BACKEND_URL}/api/parking-config`, { withCredentials: true }),
        axios.get(`${BACKEND_URL}/api/bookings/all`, { withCredentials: true }),
        axios.get(`${BACKEND_URL}/api/settings`, { withCredentials: true }),
      ]);
      setStats(statsRes.data);
      setParkingConfigs(configsRes.data);
      setAllBookings(bookingsRes.data);
      setSettings(settingsRes.data);
    } catch (error) {
      console.error('Failed to fetch admin data:', error);
      toast.error('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateConfig = async (e) => {
    e.preventDefault();
    try {
      await axios.put(
        `${BACKEND_URL}/api/parking-config/${editingConfig.vehicle_type}`,
        {
          vehicle_type: editingConfig.vehicle_type,
          slots_total: parseInt(editingConfig.slots_total),
          price_per_hour: parseFloat(editingConfig.price_per_hour),
        },
        { withCredentials: true }
      );
      toast.success('Configuration updated successfully');
      setShowConfigEdit(false);
      setEditingConfig(null);
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to update configuration');
    }
  };

  const handleUpdateSettings = async (e) => {
    e.preventDefault();
    try {
      await axios.put(
        `${BACKEND_URL}/api/settings`,
        {
          cancellation_type: settings.cancellation_type,
          cancellation_value: parseFloat(settings.cancellation_value),
        },
        { withCredentials: true }
      );
      toast.success('Settings updated successfully');
      setShowSettingsEdit(false);
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to update settings');
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
      <header className="bg-zinc-900 text-white border-b border-zinc-700">
        <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
          <div>
            <h1 className="text-2xl sm:text-3xl tracking-tight font-bold" style={{ fontFamily: 'IBM Plex Sans, sans-serif' }}>
              Admin Control Panel
            </h1>
            <p className="text-xs tracking-[0.2em] uppercase font-mono text-zinc-400 mt-1">Command Center</p>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-zinc-300">{user?.name}</span>
            <button onClick={logout} className="flex items-center gap-2 px-4 py-2 border border-zinc-700 text-white hover:bg-zinc-800 transition-all duration-150 rounded-none">
              <LogOut className="w-4 h-4" strokeWidth={1.5} /> Logout
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-white border border-zinc-200 p-6">
            <div className="text-xs tracking-[0.2em] uppercase font-mono text-zinc-500 mb-2">Total Slots</div>
            <div className="text-4xl font-black tracking-tight text-zinc-950" style={{ fontFamily: 'IBM Plex Mono, monospace' }}>{stats?.total_slots || 0}</div>
            <div className="text-sm text-zinc-600 mt-2">Available: {stats?.available_slots || 0} | Occupied: {stats?.occupied_slots || 0}</div>
          </div>
          <div className="bg-white border border-zinc-200 p-6">
            <div className="text-xs tracking-[0.2em] uppercase font-mono text-zinc-500 mb-2">Active Bookings</div>
            <div className="text-4xl font-black tracking-tight text-emerald-600" style={{ fontFamily: 'IBM Plex Mono, monospace' }}>{stats?.active_bookings || 0}</div>
            <div className="text-sm text-zinc-600 mt-2">Currently parked vehicles</div>
          </div>
          <div className="bg-white border border-zinc-200 p-6">
            <div className="text-xs tracking-[0.2em] uppercase font-mono text-zinc-500 mb-2">Total Bookings</div>
            <div className="text-4xl font-black tracking-tight text-blue-600" style={{ fontFamily: 'IBM Plex Mono, monospace' }}>{stats?.total_bookings || 0}</div>
            <div className="text-sm text-zinc-600 mt-2">All-time bookings</div>
          </div>
          <div className="bg-white border border-zinc-200 p-6">
            <div className="text-xs tracking-[0.2em] uppercase font-mono text-zinc-500 mb-2">Total Revenue</div>
            <div className="text-4xl font-black tracking-tight text-zinc-950" style={{ fontFamily: 'IBM Plex Mono, monospace' }}>₹{stats?.total_revenue || 0}</div>
            <div className="text-sm text-zinc-600 mt-2">Total earnings</div>
          </div>
        </div>

        <div className="bg-white border border-zinc-200 p-8 mb-8">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl sm:text-2xl tracking-tight font-semibold text-zinc-950" style={{ fontFamily: 'IBM Plex Sans, sans-serif' }}>Parking Configuration</h2>
            <button onClick={() => setShowSettingsEdit(true)} className="flex items-center gap-2 px-4 py-2 border border-zinc-200 text-zinc-900 hover:bg-zinc-100 transition-all duration-150 rounded-none">
              <Settings className="w-4 h-4" strokeWidth={1.5} /> Settings
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {parkingConfigs.map((config) => (
              <div key={config.id} className="border border-zinc-200 p-6">
                <div className="flex justify-between items-start mb-4">
                  <h3 className="text-lg font-semibold text-zinc-950">{config.vehicle_type}</h3>
                  <button onClick={() => { setEditingConfig(config); setShowConfigEdit(true); }} className="text-zinc-600 hover:text-zinc-900">
                    <Edit className="w-4 h-4" strokeWidth={1.5} />
                  </button>
                </div>
                <div className="space-y-3">
                  <div>
                    <div className="text-xs tracking-[0.2em] uppercase font-mono text-zinc-500">Total Slots</div>
                    <div className="text-2xl font-bold text-zinc-950" style={{ fontFamily: 'IBM Plex Mono, monospace' }}>{config.slots_total}</div>
                  </div>
                  <div>
                    <div className="text-xs tracking-[0.2em] uppercase font-mono text-zinc-500">Available</div>
                    <div className="text-2xl font-bold" style={{ fontFamily: 'IBM Plex Mono, monospace', color: config.slots_available > 0 ? '#10b981' : '#ef4444' }}>{config.slots_available}</div>
                  </div>
                  <div>
                    <div className="text-xs tracking-[0.2em] uppercase font-mono text-zinc-500">Price/Hour</div>
                    <div className="text-2xl font-bold text-zinc-950" style={{ fontFamily: 'IBM Plex Mono, monospace' }}>₹{config.price_per_hour}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-6 p-4 bg-zinc-50 border border-zinc-200">
            <div className="text-xs tracking-[0.2em] uppercase font-mono text-zinc-500 mb-2">Cancellation Policy</div>
            <div className="text-lg font-semibold text-zinc-950">
              {settings.cancellation_type === 'fixed' ? `Fixed Fee: ₹${settings.cancellation_value}` : `Percentage: ${settings.cancellation_value}%`}
            </div>
          </div>
        </div>

        <div className="bg-white border border-zinc-200 p-8">
          <h2 className="text-xl sm:text-2xl tracking-tight font-semibold text-zinc-950 mb-6" style={{ fontFamily: 'IBM Plex Sans, sans-serif' }}>All Bookings</h2>
          {allBookings.length === 0 ? (
            <p className="text-zinc-600 text-center py-8">No bookings yet</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b border-zinc-200">
                    <th className="text-left py-3 px-4 text-xs tracking-[0.2em] uppercase font-mono text-zinc-500">User</th>
                    <th className="text-left py-3 px-4 text-xs tracking-[0.2em] uppercase font-mono text-zinc-500">Vehicle</th>
                    <th className="text-left py-3 px-4 text-xs tracking-[0.2em] uppercase font-mono text-zinc-500">Type</th>
                    <th className="text-left py-3 px-4 text-xs tracking-[0.2em] uppercase font-mono text-zinc-500">Slot</th>
                    <th className="text-left py-3 px-4 text-xs tracking-[0.2em] uppercase font-mono text-zinc-500">Entry</th>
                    <th className="text-left py-3 px-4 text-xs tracking-[0.2em] uppercase font-mono text-zinc-500">Exit</th>
                    <th className="text-left py-3 px-4 text-xs tracking-[0.2em] uppercase font-mono text-zinc-500">Amount</th>
                    <th className="text-left py-3 px-4 text-xs tracking-[0.2em] uppercase font-mono text-zinc-500">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {allBookings.map((booking) => (
                    <tr key={booking.id} className="border-b border-zinc-200 hover:bg-zinc-50">
                      <td className="py-3 px-4 text-sm text-zinc-700">{booking.user_email}</td>
                      <td className="py-3 px-4 font-semibold text-zinc-950">{booking.vehicle_number}</td>
                      <td className="py-3 px-4 text-zinc-700">{booking.vehicle_type}</td>
                      <td className="py-3 px-4 font-mono text-zinc-700">{booking.slot_number}</td>
                      <td className="py-3 px-4 text-sm text-zinc-700">{new Date(booking.entry_time).toLocaleString()}</td>
                      <td className="py-3 px-4 text-sm text-zinc-700">{new Date(booking.exit_time).toLocaleString()}</td>
                      <td className="py-3 px-4 font-mono text-zinc-950">₹{booking.amount}</td>
                      <td className="py-3 px-4">
                        <span className={`px-3 py-1 text-xs font-mono ${booking.status === 'active' ? 'bg-emerald-500 text-white' : booking.status === 'completed' ? 'bg-blue-100 text-blue-800' : 'bg-red-100 text-red-800'}`}>
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

      {showConfigEdit && editingConfig && (
        <div className="fixed inset-0 bg-zinc-900/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white w-full max-w-md border border-zinc-200">
            <div className="p-6 border-b border-zinc-200">
              <h3 className="text-xl font-semibold text-zinc-950">Edit {editingConfig.vehicle_type} Configuration</h3>
            </div>
            <form onSubmit={handleUpdateConfig} className="p-6 space-y-6">
              <div>
                <label className="text-xs tracking-[0.2em] uppercase font-mono text-zinc-500 block mb-2">Total Slots</label>
                <input type="number" value={editingConfig.slots_total} onChange={(e) => setEditingConfig({ ...editingConfig, slots_total: e.target.value })} className="w-full px-4 py-3 border border-zinc-200 bg-white text-zinc-950 focus:outline-none focus:ring-2 focus:ring-zinc-900 rounded-none" min="1" required />
              </div>
              <div>
                <label className="text-xs tracking-[0.2em] uppercase font-mono text-zinc-500 block mb-2">Price Per Hour (₹)</label>
                <input type="number" value={editingConfig.price_per_hour} onChange={(e) => setEditingConfig({ ...editingConfig, price_per_hour: e.target.value })} className="w-full px-4 py-3 border border-zinc-200 bg-white text-zinc-950 focus:outline-none focus:ring-2 focus:ring-zinc-900 rounded-none" min="1" step="0.5" required />
              </div>
              <div className="flex gap-3">
                <button type="submit" className="flex-1 bg-zinc-900 text-white px-8 py-4 font-medium hover:-translate-y-0.5 transition-transform duration-150 rounded-none">Save Changes</button>
                <button type="button" onClick={() => { setShowConfigEdit(false); setEditingConfig(null); }} className="flex-1 border border-zinc-200 text-zinc-900 px-8 py-4 font-medium hover:bg-zinc-100 transition-all duration-150 rounded-none">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showSettingsEdit && (
        <div className="fixed inset-0 bg-zinc-900/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white w-full max-w-md border border-zinc-200">
            <div className="p-6 border-b border-zinc-200">
              <h3 className="text-xl font-semibold text-zinc-950">Cancellation Policy</h3>
            </div>
            <form onSubmit={handleUpdateSettings} className="p-6 space-y-6">
              <div>
                <label className="text-xs tracking-[0.2em] uppercase font-mono text-zinc-500 block mb-2">Policy Type</label>
                <select value={settings.cancellation_type} onChange={(e) => setSettings({ ...settings, cancellation_type: e.target.value })} className="w-full px-4 py-3 border border-zinc-200 bg-white text-zinc-950 focus:outline-none focus:ring-2 focus:ring-zinc-900 rounded-none">
                  <option value="fixed">Fixed Amount</option>
                  <option value="percentage">Percentage</option>
                </select>
              </div>
              <div>
                <label className="text-xs tracking-[0.2em] uppercase font-mono text-zinc-500 block mb-2">
                  {settings.cancellation_type === 'fixed' ? 'Amount (₹)' : 'Percentage (%)'}
                </label>
                <input type="number" value={settings.cancellation_value} onChange={(e) => setSettings({ ...settings, cancellation_value: e.target.value })} className="w-full px-4 py-3 border border-zinc-200 bg-white text-zinc-950 focus:outline-none focus:ring-2 focus:ring-zinc-900 rounded-none" min="1" step="0.5" required />
              </div>
              <div className="flex gap-3">
                <button type="submit" className="flex-1 bg-zinc-900 text-white px-8 py-4 font-medium hover:-translate-y-0.5 transition-transform duration-150 rounded-none">Save Changes</button>
                <button type="button" onClick={() => setShowSettingsEdit(false)} className="flex-1 border border-zinc-200 text-zinc-900 px-8 py-4 font-medium hover:bg-zinc-100 transition-all duration-150 rounded-none">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}