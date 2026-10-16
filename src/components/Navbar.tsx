import React, { useState, useEffect } from 'react';
import {
  Bell,
  Search,
  Menu,
  User as UserIcon,
  LogOut,
  ShieldCheck,
  CheckCircle,
  AlertTriangle,
  RefreshCw,
} from 'lucide-react';
import type { User, UserRole, NotificationItem } from '../types.js';
import { api } from '../services/api.js';

interface NavbarProps {
  currentUser: User | null;
  activeTab: string;
  onNavigate: (tab: string) => void;
  onLogout: () => void;
  onRoleSwitch: (role: UserRole) => void;
  onToggleSidebar: () => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentUser,
  activeTab,
  onNavigate,
  onLogout,
  onRoleSwitch,
  onToggleSidebar,
  searchQuery,
  onSearchChange,
}) => {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showNotifDropdown, setShowNotifDropdown] = useState(false);
  const [showRoleDropdown, setShowRoleDropdown] = useState(false);
  const [loadingNotifs, setLoadingNotifs] = useState(false);

  const fetchNotifications = async () => {
    try {
      setLoadingNotifs(true);
      const res = await api.getNotifications();
      if (res.success) {
        setNotifications(res.data);
        setUnreadCount(res.unreadCount);
      }
    } catch {
      // ignore
    } finally {
      setLoadingNotifs(false);
    }
  };

  useEffect(() => {
    if (currentUser) {
      fetchNotifications();
      const interval = setInterval(fetchNotifications, 30000);
      return () => clearInterval(interval);
    }
  }, [currentUser]);

  const handleMarkAllRead = async () => {
    try {
      await api.markAllNotificationsRead();
      setUnreadCount(0);
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    } catch (err) {
      console.error(err);
    }
  };

  const roleLabels: Record<UserRole, { label: string; badgeColor: string }> = {
    admin: { label: 'Administrator', badgeColor: 'bg-purple-100 text-purple-800 border-purple-200' },
    inventory_staff: { label: 'Inventory Staff', badgeColor: 'bg-blue-100 text-blue-800 border-blue-200' },
    procurement_officer: { label: 'Procurement Officer', badgeColor: 'bg-cyan-100 text-cyan-800 border-cyan-200' },
    approving_officer: { label: 'Approving Officer', badgeColor: 'bg-amber-100 text-amber-800 border-amber-200' },
    receiving_staff: { label: 'Receiving Staff', badgeColor: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
    management: { label: 'Management (Exec)', badgeColor: 'bg-slate-100 text-slate-800 border-slate-200' },
  };

  const pageTitles: Record<string, string> = {
    dashboard: 'Operational Dashboard',
    inventory: 'Inventory Catalog & Stock Control',
    categories: 'Item Categories',
    suppliers: 'Supplier Directory',
    'purchase-requests': 'Purchase Requests & Approvals',
    'purchase-orders': 'Purchase Orders (Procurement)',
    receiving: 'Goods Receiving & Inspection',
    'stock-transactions': 'Stock Movement Ledger',
    reports: 'Enterprise Reports & Analytics',
    users: 'User Account Management',
    audit: 'System Audit Logs',
    settings: 'System Diagnostics & Backup',
  };

  return (
    <header className="sticky top-0 z-30 flex h-16 w-full items-center justify-between border-b border-slate-200 bg-white px-4 shadow-xs md:px-6">
      {/* Left: Mobile Toggle & Page Title */}
      <div className="flex items-center gap-2.5 min-w-0">
        <button
          type="button"
          onClick={onToggleSidebar}
          className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 lg:hidden shrink-0"
          aria-label="Toggle navigation menu"
        >
          <Menu className="h-5 w-5" />
        </button>

        <div className="min-w-0">
          <div className="hidden sm:flex items-center gap-1.5 text-[11px] font-medium text-slate-500">
            <span>IPDS Central</span>
            <span>/</span>
            <span className="capitalize">{activeTab.replace('-', ' ')}</span>
          </div>
          <h1 className="text-sm sm:text-base font-bold text-slate-900 leading-tight truncate max-w-[140px] xs:max-w-[180px] sm:max-w-xs md:max-w-none">
            {pageTitles[activeTab] || 'Inventory Procurement'}
          </h1>
        </div>
      </div>

      {/* Center: Search */}
      <div className="hidden max-w-xs flex-1 items-center px-4 md:flex">
        <div className="relative w-full">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => onSearchChange(e.target.value)}
            placeholder="Global search items, PRs, POs, vendors..."
            className="w-full rounded-lg border border-slate-300 bg-slate-50 py-1.5 pl-9 pr-3 text-xs text-slate-900 transition-colors focus:border-blue-600 focus:bg-white focus:outline-hidden"
          />
        </div>
      </div>

      {/* Right: Role Switcher Tool, Notifications, Profile */}
      <div className="flex items-center gap-3">
        {/* Role Quick Switcher for Evaluators */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowRoleDropdown(!showRoleDropdown)}
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100 transition-colors"
            title="Switch demo user role for testing"
          >
            <ShieldCheck className="h-4 w-4 text-blue-600 shrink-0" />
            <span className="hidden md:inline">Role:</span>
            <span className="font-semibold text-slate-900 truncate max-w-[75px] sm:max-w-none">
              {currentUser ? roleLabels[currentUser.role]?.label : 'Select Role'}
            </span>
          </button>

          {showRoleDropdown && (
            <div className="absolute right-0 mt-2 w-64 rounded-xl border border-slate-200 bg-white p-2 shadow-xl z-50">
              <div className="border-b border-slate-100 pb-2 px-2 text-xs font-semibold text-slate-500">
                Switch Demo User Role
              </div>
              <div className="mt-1 space-y-1">
                {(Object.keys(roleLabels) as UserRole[]).map(r => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => {
                      onRoleSwitch(r);
                      setShowRoleDropdown(false);
                    }}
                    className={`flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-left text-xs transition-colors ${
                      currentUser?.role === r
                        ? 'bg-blue-50 font-semibold text-blue-700'
                        : 'text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <span>{roleLabels[r].label}</span>
                    {currentUser?.role === r && <CheckCircle className="h-4 w-4 text-blue-600" />}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Notifications Bell */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowNotifDropdown(!showNotifDropdown)}
            className="relative rounded-lg p-2 text-slate-600 hover:bg-slate-100 transition-colors"
            aria-label="View notifications"
          >
            <Bell className="h-5 w-5" />
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-600 text-[10px] font-bold text-white">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>

          {showNotifDropdown && (
            <div className="absolute right-0 mt-2 w-80 rounded-xl border border-slate-200 bg-white shadow-2xl z-50">
              <div className="flex items-center justify-between border-b border-slate-100 p-3">
                <span className="font-semibold text-sm text-slate-900">System Notifications</span>
                <button
                  type="button"
                  onClick={handleMarkAllRead}
                  className="text-xs text-blue-600 hover:underline"
                >
                  Mark all as read
                </button>
              </div>

              <div className="max-h-80 overflow-y-auto divide-y divide-slate-100">
                {loadingNotifs ? (
                  <div className="p-4 text-center text-xs text-slate-500">Loading alerts...</div>
                ) : notifications.length === 0 ? (
                  <div className="p-4 text-center text-xs text-slate-500">No active alerts.</div>
                ) : (
                  notifications.map(n => (
                    <div
                      key={n.notification_id}
                      className={`p-3 text-xs transition-colors ${
                        n.is_read ? 'bg-white' : 'bg-blue-50/50'
                      }`}
                    >
                      <div className="flex items-center justify-between font-medium text-slate-900">
                        <span className="flex items-center gap-1.5">
                          {n.type === 'low_stock' && <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />}
                          {n.title}
                        </span>
                        <span className="text-[10px] text-slate-400">
                          {new Date(n.created_at).toLocaleDateString()}
                        </span>
                      </div>
                      <p className="mt-1 text-slate-600 leading-relaxed">{n.message}</p>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* Current User Pill */}
        <div className="flex items-center gap-2 pl-2 border-l border-slate-200">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-900 text-xs font-bold text-white shadow-xs">
            {currentUser?.fullName?.charAt(0) || 'U'}
          </div>
          <div className="hidden text-left xl:block">
            <div className="text-xs font-semibold text-slate-800 leading-none">
              {currentUser?.fullName || 'User'}
            </div>
            <div className="mt-0.5 text-[10px] text-slate-500 leading-none">
              @{currentUser?.username || 'user'}
            </div>
          </div>

          <button
            type="button"
            onClick={onLogout}
            className="ml-1 rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 transition-colors"
            title="Log out"
            aria-label="Log out"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </header>
  );
};
