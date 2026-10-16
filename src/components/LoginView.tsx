import React, { useState } from 'react';
import { Building2, Eye, EyeOff, Lock, User as UserIcon, ShieldCheck, ArrowRight, RefreshCw } from 'lucide-react';
import { api, setToken } from '../services/api.js';
import type { User } from '../types.js';

interface LoginViewProps {
  onLoginSuccess: (user: User) => void;
}

export const LoginView: React.FC<LoginViewProps> = ({ onLoginSuccess }) => {
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('admin123');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const demoAccounts = [
    { role: 'Administrator', user: 'admin', pass: 'admin123', desc: 'Full system control, users & settings' },
    { role: 'Inventory Staff', user: 'inventory', pass: 'staff123', desc: 'Catalog items & stock adjustments' },
    { role: 'Procurement Officer', user: 'procurement', pass: 'procure123', desc: 'Vendors, PR requisitions & POs' },
    { role: 'Approving Officer', user: 'approver', pass: 'approve123', desc: 'PR & PO approval authorizations' },
    { role: 'Receiving Staff', user: 'receiving', pass: 'receive123', desc: 'Goods inspection & delivery receipts' },
    { role: 'Management', user: 'manager', pass: 'manage123', desc: 'Executive dashboard & analytics' },
  ];

  const handleLogin = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setError('');
    try {
      setLoading(true);
      const res = await api.login({ username, password });
      if (res.success) {
        setToken(res.token);
        onLoginSuccess(res.user);
      }
    } catch (err: any) {
      setError(err.message || 'Invalid username or password.');
    } finally {
      setLoading(false);
    }
  };

  const handleDemoSelect = (u: string, p: string) => {
    setUsername(u);
    setPassword(p);
    setError('');
  };

  return (
    <div className="flex min-h-screen bg-slate-900 text-slate-100 items-center justify-center p-4">
      <div className="w-full max-w-4xl overflow-hidden rounded-2xl border border-slate-800 bg-slate-950 shadow-2xl grid grid-cols-1 md:grid-cols-2">
        {/* Left Side: Brand & Project Description */}
        <div className="bg-gradient-to-br from-blue-900 via-slate-900 to-slate-950 p-8 flex flex-col justify-between border-b md:border-b-0 md:border-r border-slate-800">
          <div>
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-lg shadow-blue-500/30">
                <Building2 className="h-7 w-7" />
              </div>
              <div>
                <h1 className="text-xl font-extrabold tracking-tight text-white">IPDS PORTAL</h1>
                <p className="text-xs font-semibold text-blue-400">Inventory Procurement Database System</p>
              </div>
            </div>

            <div className="mt-8 space-y-4 text-xs text-slate-300 leading-relaxed">
              <p>
                An enterprise centralized management application for inventory stock control, vendor directory, multi-tier purchase requisition workflows, binding purchase orders, and goods receipt inspection with atomic ledger updates.
              </p>

              <div className="space-y-2 pt-2 border-t border-slate-800/80">
                <div className="flex items-center gap-2 text-slate-400">
                  <div className="h-1.5 w-1.5 rounded-full bg-emerald-400"></div>
                  <span>PostgreSQL Relational Storage & Transactions</span>
                </div>
                <div className="flex items-center gap-2 text-slate-400">
                  <div className="h-1.5 w-1.5 rounded-full bg-emerald-400"></div>
                  <span>Separation of Duties & Role-Based Access Control</span>
                </div>
                <div className="flex items-center gap-2 text-slate-400">
                  <div className="h-1.5 w-1.5 rounded-full bg-emerald-400"></div>
                  <span>Real-Time Low Stock & Depletion Alerts</span>
                </div>
                <div className="flex items-center gap-2 text-slate-400">
                  <div className="h-1.5 w-1.5 rounded-full bg-emerald-400"></div>
                  <span>Immutable Stock Journal & Audit Trail</span>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-8 pt-4 border-t border-slate-800 text-[11px] text-slate-500">
            Version 1.0.0 Production Release &bull; Academic IT Capstone Architecture
          </div>
        </div>

        {/* Right Side: Login Form & Demo Selector */}
        <div className="p-8 flex flex-col justify-between bg-slate-900/60">
          <div>
            <div className="border-b border-slate-800 pb-4 mb-6">
              <h2 className="text-lg font-bold text-white">System Authentication</h2>
              <p className="text-xs text-slate-400">Enter your credentials or choose a demonstration role below.</p>
            </div>

            {error && (
              <div className="mb-4 rounded-xl bg-red-950/60 border border-red-800/60 p-3 text-xs text-red-300">
                {error}
              </div>
            )}

            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Username or Work Email</label>
                <div className="relative">
                  <UserIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                  <input
                    type="text"
                    required
                    value={username}
                    onChange={e => setUsername(e.target.value)}
                    placeholder="Enter username"
                    className="w-full rounded-xl border border-slate-700 bg-slate-800/80 py-2 pl-9 pr-3 text-xs text-white placeholder-slate-500 focus:border-blue-500 focus:bg-slate-800 focus:outline-hidden"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Account Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="Enter password"
                    className="w-full rounded-xl border border-slate-700 bg-slate-800/80 py-2 pl-9 pr-10 text-xs text-white placeholder-slate-500 focus:border-blue-500 focus:bg-slate-800 focus:outline-hidden"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-blue-600 py-2.5 text-xs font-bold text-white shadow-lg shadow-blue-600/30 hover:bg-blue-500 active:scale-98 transition-all disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    <span>Authenticating...</span>
                  </>
                ) : (
                  <>
                    <span>Authenticate & Access Database</span>
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Quick Demo Credentials Selector */}
          <div className="mt-6 pt-4 border-t border-slate-800">
            <div className="text-[11px] font-semibold text-slate-400 mb-2 flex items-center gap-1.5">
              <ShieldCheck className="h-3.5 w-3.5 text-blue-400" />
              <span>Select Demonstration Role Account:</span>
            </div>

            <div className="grid grid-cols-2 gap-1.5">
              {demoAccounts.map(demo => (
                <button
                  key={demo.user}
                  type="button"
                  onClick={() => handleDemoSelect(demo.user, demo.pass)}
                  className={`rounded-lg border p-1.5 text-left text-[11px] transition-all ${
                    username === demo.user
                      ? 'border-blue-500 bg-blue-900/40 text-blue-200'
                      : 'border-slate-800 bg-slate-800/40 text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                  }`}
                >
                  <div className="font-semibold text-slate-200">{demo.role}</div>
                  <div className="text-[10px] text-slate-500 font-mono">
                    {demo.user} / {demo.pass}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
