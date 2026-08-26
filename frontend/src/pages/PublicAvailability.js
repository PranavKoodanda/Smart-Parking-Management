import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { Car, Truck, Bus, ArrowRight } from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

export default function PublicAvailability() {
  const [availability, setAvailability] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    fetchAvailability();
  }, []);

  const fetchAvailability = async () => {
    try {
      const { data } = await axios.get(`${BACKEND_URL}/api/public/availability`);
      setAvailability(data);
    } catch (error) {
      console.error('Failed to fetch availability:', error);
    } finally {
      setLoading(false);
    }
  };

  const getVehicleIcon = (type) => {
    if (type === '2-Wheeler') return <Car className="w-12 h-12" strokeWidth={1.5} />;
    if (type === '4-Wheeler') return <Truck className="w-12 h-12" strokeWidth={1.5} />;
    return <Bus className="w-12 h-12" strokeWidth={1.5} />;
  };

  return (
    <div className="min-h-screen bg-white">
      <div
        className="relative min-h-screen flex items-center justify-center"
        style={{
          backgroundImage: 'url(https://images.pexels.com/photos/29561794/pexels-photo-29561794.jpeg)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      >
        <div className="absolute inset-0 bg-white/70"></div>

        <div className="relative z-10 w-full max-w-7xl mx-auto px-6 py-12">
          <div className="text-center mb-16">
            <h1 className="text-4xl sm:text-5xl lg:text-6xl tracking-tighter font-black text-zinc-950 mb-4" style={{ fontFamily: 'IBM Plex Sans, sans-serif' }}>
              Smart Parking
            </h1>
            <p className="text-base leading-relaxed text-zinc-800 max-w-2xl mx-auto">
              Real-time parking availability. Secure your spot in seconds.
            </p>
          </div>

          {loading ? (
            <div className="text-center">
              <div className="w-16 h-16 border-4 border-zinc-900 border-t-transparent rounded-none animate-spin mx-auto"></div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
              {availability.map((item) => (
                <div key={item.vehicle_type} className="bg-white border border-zinc-200 p-8 hover:bg-zinc-50 transition-all duration-150">
                  <div className="flex flex-col items-center text-center">
                    <div className="text-zinc-900 mb-4">{getVehicleIcon(item.vehicle_type)}</div>
                    <h3 className="text-xl sm:text-2xl tracking-tight font-semibold text-zinc-950 mb-2" style={{ fontFamily: 'IBM Plex Sans, sans-serif' }}>
                      {item.vehicle_type}
                    </h3>
                    <div className="text-xs tracking-[0.2em] uppercase font-mono text-zinc-500 mb-4">AVAILABILITY</div>
                    <div className="text-5xl font-black tracking-tight mb-2" style={{ fontFamily: 'IBM Plex Mono, monospace', color: item.slots_available > 0 ? '#10b981' : '#ef4444' }}>
                      {item.slots_available}
                    </div>
                    <p className="text-sm text-zinc-600 mb-4">of {item.slots_total} slots</p>
                    <div className="w-full h-px bg-zinc-200 my-4"></div>
                    <div className="text-xs tracking-[0.2em] uppercase font-mono text-zinc-500 mb-2">RATE</div>
                    <div className="text-3xl font-bold tracking-tight text-zinc-900" style={{ fontFamily: 'IBM Plex Mono, monospace' }}>
                      ₹{item.price_per_hour} <span className="text-sm text-zinc-600">/hr</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <button onClick={() => navigate('/login')} className="bg-zinc-900 text-white px-8 py-4 font-medium tracking-wide hover:-translate-y-0.5 transition-transform duration-150 flex items-center gap-2 rounded-none">
              Book Now <ArrowRight className="w-5 h-5" strokeWidth={1.5} />
            </button>
            <button onClick={() => navigate('/register')} className="border border-zinc-900 text-zinc-900 px-8 py-4 font-medium tracking-wide hover:bg-zinc-100 transition-all duration-150 rounded-none">
              Create Account
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}