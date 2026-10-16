import React from 'react';
import {
  LayoutDashboard,
  Boxes,
  Tags,
  Truck,
  FileSpreadsheet,
  ShoppingCart,
  PackageCheck,
  History,
  BarChart3,
  Users,
  ShieldAlert,
  Settings,
  LogOut,
  Building2,
  X,
} from 'lucide-react';
import type { User, UserRole } from '../types.js';

interface SidebarProps {
  activeTab: string;
  onNavigate: (tab: string) => void;
  currentUser: User | null;
  isOpenMobile: boolean;
  onCloseMobile: () => void;
  onLogout: () => void;
  pendingPrCount?: number;
  lowStockCount?: number;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onNavigate,
  currentUser,
  isOpenMobile,
  onCloseMobile,
  onLogout,
  pendingPrCount = 0,
  lowStockCount = 0,
}) => {
  const userRole = currentUser?.role || 'management';

  const menuItems = [
    {
      id: 'dashboard',
      label: 'Dashboard',
      icon: LayoutDashboard,
      roles: ['admin', 'inventory_staff', 'procurement_officer', 'approving_officer', 'receiving_staff', 'management'],
    },
    {
      id: 'inventory',
      label: 'Inventory Items',
      icon: Boxes,
      badge: lowStockCount > 0 ? `${lowStockCount} alert` : undefined,
      badgeColor: 'bg-amber-100 text-amber-800',
      roles: ['admin', 'inventory_staff', 'procurement_officer', 'approving_officer', 'receiving_staff', 'management'],
    },
    {
      id: 'categories',
      label: 'Categories',
      icon: Tags,
      roles: ['admin', 'inventory_staff', 'management'],
    },
    {
      id: 'suppliers',
      label: 'Suppliers',
      icon: Truck,
      roles: ['admin', 'procurement_officer', 'management'],
    },
    {
      id: 'purchase-requests',
      label: 'Purchase Requests',
      icon: FileSpreadsheet,
      badge: pendingPrCount > 0 ? `${pendingPrCount} pending` : undefined,
      badgeColor: 'bg-blue-100 text-blue-800',
      roles: ['admin', 'inventory_staff', 'procurement_officer', 'approving_officer', 'management'],
    },
    {
      id: 'purchase-orders',
      label: 'Purchase Orders',
      icon: ShoppingCart,
      roles: ['admin', 'procurement_officer', 'approving_officer', 'receiving_staff', 'management'],
    },
    {
      id: 'receiving',
      label: 'Receiving (Deliveries)',
      icon: PackageCheck,
      roles: ['admin', 'receiving_staff', 'inventory_staff', 'management'],
    },
    {
      id: 'stock-transactions',
      label: 'Stock Ledger',
      icon: History,
      roles: ['admin', 'inventory_staff', 'receiving_staff', 'management'],
    },
    {
      id: 'reports',
      label: 'Reports & Export',
      icon: BarChart3,
      roles: ['admin', 'inventory_staff', 'procurement_officer', 'approving_officer', 'receiving_staff', 'management'],
    },
    {
      id: 'users',
      label: 'User Management',
      icon: Users,
      roles: ['admin'],
    },
    {
      id: 'audit',
      label: 'Audit Trail',
      icon: ShieldAlert,
      roles: ['admin', 'management'],
    },
    {
      id: 'settings',
      label: 'Database & Backup',
      icon: Settings,
      roles: ['admin'],
    },
  ];

  const visibleItems = menuItems.filter(item => item.roles.includes(userRole));

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpenMobile && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/50 backdrop-blur-xs lg:hidden"
          onClick={onCloseMobile}
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={`fixed top-0 bottom-0 left-0 z-50 flex w-64 flex-col border-r border-slate-800 bg-slate-950 text-slate-300 transition-transform duration-200 ease-in-out lg:static lg:translate-x-0 ${
          isOpenMobile ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Brand Header */}
        <div className="flex h-16 items-center justify-between border-b border-slate-800 px-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-white shadow-md shadow-blue-900/40">
              <Building2 className="h-6 w-6" />
            </div>
            <div>
              <div className="text-sm font-extrabold tracking-wider text-white">IPDS PORTAL</div>
              <div className="text-[10px] text-blue-400 font-medium">Enterprise Central DB</div>
            </div>
          </div>

          <button
            type="button"
            onClick={onCloseMobile}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 lg:hidden"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Navigation list */}
        <div className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
          <div className="px-3 pb-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">
            System Modules
          </div>

          {visibleItems.map(item => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  onNavigate(item.id);
                  onCloseMobile();
                }}
                className={`group flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-xs font-medium transition-all ${
                  isActive
                    ? 'bg-blue-600 text-white font-semibold shadow-xs shadow-blue-500/20'
                    : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon
                    className={`h-4 w-4 transition-colors ${
                      isActive ? 'text-white' : 'text-slate-400 group-hover:text-blue-400'
                    }`}
                  />
                  <span>{item.label}</span>
                </div>

                {item.badge && (
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                      isActive ? 'bg-blue-800 text-blue-100' : item.badgeColor
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Current user & footer */}
        <div className="border-t border-slate-800 p-3">
          <div className="rounded-xl bg-slate-900/80 p-3 border border-slate-800/60">
            <div className="flex items-center justify-between">
              <div className="text-xs font-semibold text-white truncate">
                {currentUser?.fullName}
              </div>
              <span className="rounded-md bg-blue-900/60 px-1.5 py-0.5 text-[10px] font-mono text-blue-300 border border-blue-700/50">
                {currentUser?.role}
              </span>
            </div>
            <div className="text-[11px] text-slate-400 truncate mt-0.5">
              {currentUser?.email}
            </div>

            <button
              type="button"
              onClick={onLogout}
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg border border-slate-700/70 bg-slate-800/60 py-1.5 text-xs text-slate-300 hover:bg-red-950/40 hover:text-red-400 hover:border-red-900/60 transition-colors"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      </aside>
    </>
  );
};
