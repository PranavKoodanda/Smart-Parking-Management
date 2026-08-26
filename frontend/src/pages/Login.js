import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { toast } from 'sonner';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    const result = await login(email, password);
    setLoading(false);
    if (result.success) {
      toast.success('Login successful');
      window.location.href = '/dashboard';
    } else {
      toast.error(result.error);
    }
  };

  return (
    <div className="min-h-screen bg-white flex">
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          <h1 className="text-4xl sm:text-5xl tracking-tighter font-black text-zinc-950 mb-2" style={{ fontFamily: 'IBM Plex Sans, sans-serif' }}>Welcome Back</h1>
          <p className="text-base text-zinc-600 mb-8">Sign in to your parking account</p>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="text-xs tracking-[0.2em] uppercase font-mono text-zinc-500 block mb-2">Email</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full px-4 py-3 border border-zinc-200 bg-white text-zinc-950 focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:ring-offset-2 rounded-none" placeholder="you@example.com" required />
            </div>
            <div>
              <label className="text-xs tracking-[0.2em] uppercase font-mono text-zinc-500 block mb-2">Password</label>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full px-4 py-3 border border-zinc-200 bg-white text-zinc-950 focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:ring-offset-2 rounded-none" placeholder="••••••••" required />
            </div>
            <button type="submit" disabled={loading} className="w-full bg-zinc-900 text-white px-8 py-4 font-medium tracking-wide hover:-translate-y-0.5 transition-transform duration-150 disabled:opacity-50 disabled:cursor-not-allowed rounded-none">
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>

          <p className="text-sm text-zinc-600 mt-6 text-center">
            Don't have an account? <Link to="/register" className="text-zinc-900 font-semibold hover:underline">Create one</Link>
          </p>
          <p className="text-sm text-zinc-600 mt-4 text-center">
            <Link to="/" className="text-zinc-900 hover:underline">← Back to Home</Link>
          </p>
        </div>
      </div>
      <div className="hidden lg:block lg:w-1/2 bg-zinc-50 relative" style={{ backgroundImage: 'url(https://images.unsplash.com/photo-1761491713025-a7e66bf9427e)', backgroundSize: 'cover', backgroundPosition: 'center', opacity: 0.1 }}>
        <div className="absolute inset-0 bg-gradient-to-br from-zinc-900/50 to-zinc-900/20"></div>
      </div>
    </div>
  );
}