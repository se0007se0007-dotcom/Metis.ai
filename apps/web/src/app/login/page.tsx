'use client';

import { useState } from 'react';
import { api, setToken } from '@/lib/api-client';

interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    email: string;
    role: string;
    tenantId: string;
  };
}

export default function LoginPage() {
  const [email, setEmail] = useState('admin@metis.ai');
  const [password, setPassword] = useState('metis1234');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await api.post<LoginResponse>('/auth/login', { email, password });
      setToken(res.accessToken);
      if (typeof window !== 'undefined') {
        localStorage.setItem('metis_refresh_token', res.refreshToken);
      }
      window.location.href = '/workbench';
    } catch (err: any) {
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0F1A2E]">
      <div className="w-full max-w-md p-8 rounded-2xl bg-[#1A2744] border border-[#2A3A5C] shadow-2xl">
        {/* Logo */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white tracking-tight">
            Metis<span className="text-[#00B4D8]">.AI</span>
          </h1>
          <p className="text-sm text-gray-400 mt-2">AgentOps Governance Platform</p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-2.5 rounded-lg bg-[#0F1A2E] border border-[#2A3A5C] text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#00B4D8] focus:border-transparent transition"
              placeholder="admin@metis.ai"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-2.5 rounded-lg bg-[#0F1A2E] border border-[#2A3A5C] text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#00B4D8] focus:border-transparent transition"
              placeholder="Password"
              required
            />
          </div>

          {error && (
            <div className="px-4 py-2.5 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 rounded-lg bg-[#00B4D8] hover:bg-[#00A0C0] text-white font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        {/* Dev credentials hint */}
        <div className="mt-6 p-3 rounded-lg bg-[#0F1A2E]/50 border border-[#2A3A5C]/50">
          <p className="text-xs text-gray-500 text-center">
            Dev: admin@metis.ai / metis1234
          </p>
        </div>
      </div>
    </div>
  );
}
