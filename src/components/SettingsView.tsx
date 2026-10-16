import React, { useEffect, useState } from 'react';
import { Database, Download, RotateCcw, CheckCircle, ShieldCheck, HardDrive, Server, RefreshCw } from 'lucide-react';
import type { User } from '../types.js';
import { api } from '../services/api.js';

interface SettingsViewProps {
  currentUser: User | null;
  onNavigate: (tab: string) => void;
}

export const SettingsView: React.FC<SettingsViewProps> = () => {
  const [statusData, setStatusData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [resetting, setResetting] = useState(false);
  const [notice, setNotice] = useState('');

  const loadStatus = async () => {
    try {
      setLoading(true);
      const res = await api.getSystemStatus();
      if (res.success) setStatusData(res.data);
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStatus();
  }, []);

  const handleResetDemo = async () => {
    if (!confirm('Are you sure you want to restore the database to the initial demonstration seed dataset? All temporary test transactions will be reseeded.')) {
      return;
    }

    try {
      setResetting(true);
      const res = await api.resetDemoDatabase();
      if (res.success) {
        setNotice('Database has been successfully reseeded with the initial demonstration dataset!');
        loadStatus();
        setTimeout(() => setNotice(''), 6000);
      }
    } catch (err: any) {
      alert(err.message);
    } finally {
      setResetting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-slate-900 tracking-tight">Database & Disaster Recovery</h2>
        <p className="text-xs text-slate-500">
          Relational database storage engine management, automated backup export, and initial data seeding.
        </p>
      </div>

      {notice && (
        <div className="flex items-center gap-2 rounded-xl bg-emerald-50 p-4 text-xs font-semibold text-emerald-800 border border-emerald-200">
          <CheckCircle className="h-5 w-5 text-emerald-600 shrink-0" />
          <span>{notice}</span>
        </div>
      )}

      {/* Database Diagnostic Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-2xs">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-blue-50 p-2.5 text-blue-600">
              <Database className="h-6 w-6" />
            </div>
            <div>
              <div className="text-xs text-slate-400 font-semibold uppercase">Engine</div>
              <div className="text-sm font-bold text-slate-900">{statusData?.database || 'PostgreSQL'}</div>
            </div>
          </div>
          <div className="mt-4 flex items-center justify-between text-xs text-slate-500 border-t border-slate-100 pt-3">
            <span>Storage Layer</span>
            <span className="font-semibold text-emerald-600">Relational & ACID Compliant</span>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-2xs">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-emerald-50 p-2.5 text-emerald-600">
              <Server className="h-6 w-6" />
            </div>
            <div>
              <div className="text-xs text-slate-400 font-semibold uppercase">Status</div>
              <div className="text-sm font-bold text-slate-900">Operational & Synchronized</div>
            </div>
          </div>
          <div className="mt-4 flex items-center justify-between text-xs text-slate-500 border-t border-slate-100 pt-3">
            <span>Server Time</span>
            <span className="font-mono text-slate-700">{statusData ? new Date(statusData.serverTime).toLocaleTimeString() : 'Online'}</span>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-2xs">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-purple-50 p-2.5 text-purple-600">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <div>
              <div className="text-xs text-slate-400 font-semibold uppercase">Ledger Journal</div>
              <div className="text-sm font-bold text-slate-900">Immutable Audit Logs</div>
            </div>
          </div>
          <div className="mt-4 flex items-center justify-between text-xs text-slate-500 border-t border-slate-100 pt-3">
            <span>Integrity Checks</span>
            <span className="font-semibold text-purple-700">Enforced Foreign Keys</span>
          </div>
        </div>
      </div>

      {/* Table Statistics Grid */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-2xs">
        <h3 className="text-sm font-bold text-slate-900 mb-4">Database Table Records Summary</h3>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
          <div className="rounded-lg bg-slate-50 p-3 border border-slate-200">
            <span className="text-slate-400 block">Inventory Items</span>
            <span className="text-lg font-bold text-slate-900">{statusData?.stats?.items || 0}</span>
          </div>

          <div className="rounded-lg bg-slate-50 p-3 border border-slate-200">
            <span className="text-slate-400 block">Item Categories</span>
            <span className="text-lg font-bold text-slate-900">{statusData?.stats?.categories || 0}</span>
          </div>

          <div className="rounded-lg bg-slate-50 p-3 border border-slate-200">
            <span className="text-slate-400 block">Active Suppliers</span>
            <span className="text-lg font-bold text-slate-900">{statusData?.stats?.suppliers || 0}</span>
          </div>

          <div className="rounded-lg bg-slate-50 p-3 border border-slate-200">
            <span className="text-slate-400 block">Purchase Requests</span>
            <span className="text-lg font-bold text-slate-900">{statusData?.stats?.purchase_requests || 0}</span>
          </div>

          <div className="rounded-lg bg-slate-50 p-3 border border-slate-200">
            <span className="text-slate-400 block">Purchase Orders</span>
            <span className="text-lg font-bold text-slate-900">{statusData?.stats?.purchase_orders || 0}</span>
          </div>

          <div className="rounded-lg bg-slate-50 p-3 border border-slate-200">
            <span className="text-slate-400 block">Receiving Receipts</span>
            <span className="text-lg font-bold text-slate-900">{statusData?.stats?.receiving_records || 0}</span>
          </div>

          <div className="rounded-lg bg-slate-50 p-3 border border-slate-200">
            <span className="text-slate-400 block">Stock Transactions</span>
            <span className="text-lg font-bold text-slate-900">{statusData?.stats?.stock_transactions || 0}</span>
          </div>

          <div className="rounded-lg bg-slate-50 p-3 border border-slate-200">
            <span className="text-slate-400 block">User Accounts</span>
            <span className="text-lg font-bold text-slate-900">{statusData?.stats?.users || 0}</span>
          </div>
        </div>
      </div>

      {/* Backup & Recovery Actions */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        {/* Backup Card */}
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-2xs flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 text-sm font-bold text-slate-900">
              <Download className="h-4 w-4 text-blue-600" />
              <span>Full Database JSON Backup</span>
            </div>
            <p className="mt-2 text-xs text-slate-600 leading-relaxed">
              Export an authoritative, point-in-time JSON backup file containing all database tables, users, catalog items, suppliers, purchase requests, purchase orders, receiving slips, and the immutable stock movement journal.
            </p>
          </div>

          <div className="mt-6">
            <a
              href={api.getBackupUrl()}
              download
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-blue-700 transition-colors"
            >
              <Download className="h-4 w-4" />
              <span>Export Full Database Backup</span>
            </a>
          </div>
        </div>

        {/* Reseed Card */}
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-2xs flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 text-sm font-bold text-slate-900">
              <RotateCcw className="h-4 w-4 text-amber-600" />
              <span>Restore Demonstration Seed Data</span>
            </div>
            <p className="mt-2 text-xs text-slate-600 leading-relaxed">
              Reset all tables back to the clean demonstration seed state with all default items, sample suppliers, pending requisitions, and balanced stock quantities. Useful for evaluating the application and repeating test workflows.
            </p>
          </div>

          <div className="mt-6">
            <button
              type="button"
              disabled={resetting}
              onClick={handleResetDemo}
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-amber-300 bg-amber-50 px-4 py-2 text-xs font-semibold text-amber-800 hover:bg-amber-100 disabled:opacity-50 transition-colors"
            >
              <RotateCcw className={`h-4 w-4 ${resetting ? 'animate-spin' : ''}`} />
              <span>{resetting ? 'Restoring Seed Dataset...' : 'Restore Demo Seed Dataset'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
