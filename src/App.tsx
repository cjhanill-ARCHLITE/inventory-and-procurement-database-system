import React, { useState, useEffect } from 'react';
import { api, setToken, getToken } from './services/api.js';
import type { User, UserRole } from './types.js';

import { Navbar } from './components/Navbar.js';
import { Sidebar } from './components/Sidebar.js';
import { LoginView } from './components/LoginView.js';
import { DashboardView } from './components/DashboardView.js';
import { InventoryView } from './components/InventoryView.js';
import { CategoriesView } from './components/CategoriesView.js';
import { SuppliersView } from './components/SuppliersView.js';
import { PurchaseRequestsView } from './components/PurchaseRequestsView.js';
import { PurchaseOrdersView } from './components/PurchaseOrdersView.js';
import { ReceivingView } from './components/ReceivingView.js';
import { StockTransactionsView } from './components/StockTransactionsView.js';
import { ReportsView } from './components/ReportsView.js';
import { UsersView } from './components/UsersView.js';
import { AuditView } from './components/AuditView.js';
import { SettingsView } from './components/SettingsView.js';

export function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [initialLoading, setInitialLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [sidebarOpenMobile, setSidebarOpenMobile] = useState<boolean>(false);
  const [globalSearch, setGlobalSearch] = useState<string>('');

  // Counters for badges
  const [pendingPrCount, setPendingPrCount] = useState(0);
  const [lowStockCount, setLowStockCount] = useState(0);

  // Cross-module action state (e.g. from Dashboard or Inventory to PR)
  const [preselectedPrItem, setPreselectedPrItem] = useState<any>(null);

  const fetchSession = async () => {
    try {
      const res = await api.getMe();
      if (res.success && res.user) {
        setCurrentUser(res.user);
        loadBadges();
      } else {
        setCurrentUser(null);
      }
    } catch {
      setCurrentUser(null);
    } finally {
      setInitialLoading(false);
    }
  };

  const loadBadges = async () => {
    try {
      const res = await api.getDashboardSummary();
      if (res.success && res.data) {
        setPendingPrCount(res.data.pendingPurchaseRequests || 0);
        setLowStockCount((res.data.lowStockItems || 0) + (res.data.outOfStockItems || 0));
      }
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    fetchSession();

    const handleUnauthorized = () => {
      setCurrentUser(null);
    };
    window.addEventListener('ipds:unauthorized', handleUnauthorized);
    return () => window.removeEventListener('ipds:unauthorized', handleUnauthorized);
  }, []);

  const handleLogout = async () => {
    try {
      await api.logout();
    } catch {
      // ignore
    } finally {
      setToken(null);
      setCurrentUser(null);
      setActiveTab('dashboard');
    }
  };

  const handleRoleSwitch = async (role: UserRole) => {
    try {
      const res = await api.switchDemoRole(role);
      if (res.success && res.user) {
        setToken(res.token);
        setCurrentUser(res.user);
        loadBadges();
      }
    } catch (err: any) {
      alert(`Role switch error: ${err.message}`);
    }
  };

  const handleInitiatePrForItem = (item: any) => {
    setPreselectedPrItem(item);
    setActiveTab('purchase-requests');
  };

  if (initialLoading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-slate-900 text-slate-100">
        <div className="text-center">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-blue-500 border-t-transparent mx-auto mb-4"></div>
          <p className="text-sm font-semibold tracking-wide text-slate-300">
            Connecting to Inventory Procurement Database...
          </p>
        </div>
      </div>
    );
  }

  // If user is not authenticated, render LoginView
  if (!currentUser) {
    return (
      <LoginView
        onLoginSuccess={user => {
          setCurrentUser(user);
          loadBadges();
        }}
      />
    );
  }

  return (
    <div className="flex h-screen w-full overflow-hidden bg-slate-100 font-sans text-slate-900">
      {/* Sidebar Navigation */}
      <Sidebar
        activeTab={activeTab}
        onNavigate={tab => {
          setActiveTab(tab);
          setPreselectedPrItem(null);
        }}
        currentUser={currentUser}
        isOpenMobile={sidebarOpenMobile}
        onCloseMobile={() => setSidebarOpenMobile(false)}
        onLogout={handleLogout}
        pendingPrCount={pendingPrCount}
        lowStockCount={lowStockCount}
      />

      {/* Main Content Area */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Top Navbar */}
        <Navbar
          currentUser={currentUser}
          activeTab={activeTab}
          onNavigate={setActiveTab}
          onLogout={handleLogout}
          onRoleSwitch={handleRoleSwitch}
          onToggleSidebar={() => setSidebarOpenMobile(!sidebarOpenMobile)}
          searchQuery={globalSearch}
          onSearchChange={setGlobalSearch}
        />

        {/* Viewport Content */}
        <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">
          <div className="mx-auto max-w-7xl">
            {activeTab === 'dashboard' && (
              <DashboardView
                onNavigate={setActiveTab}
                onInitiatePrForItem={handleInitiatePrForItem}
              />
            )}

            {activeTab === 'inventory' && (
              <InventoryView
                currentUser={currentUser}
                onNavigate={setActiveTab}
                externalSearchQuery={globalSearch}
              />
            )}

            {activeTab === 'categories' && (
              <CategoriesView
                currentUser={currentUser}
                onNavigate={setActiveTab}
              />
            )}

            {activeTab === 'suppliers' && (
              <SuppliersView
                currentUser={currentUser}
                onNavigate={setActiveTab}
              />
            )}

            {activeTab === 'purchase-requests' && (
              <PurchaseRequestsView
                currentUser={currentUser}
                onNavigate={setActiveTab}
                preselectedItem={preselectedPrItem}
              />
            )}

            {activeTab === 'purchase-orders' && (
              <PurchaseOrdersView
                currentUser={currentUser}
                onNavigate={setActiveTab}
              />
            )}

            {activeTab === 'receiving' && (
              <ReceivingView
                currentUser={currentUser}
                onNavigate={setActiveTab}
              />
            )}

            {activeTab === 'stock-transactions' && (
              <StockTransactionsView
                currentUser={currentUser}
                onNavigate={setActiveTab}
              />
            )}

            {activeTab === 'reports' && (
              <ReportsView
                currentUser={currentUser}
                onNavigate={setActiveTab}
              />
            )}

            {activeTab === 'users' && (
              <UsersView
                currentUser={currentUser}
                onNavigate={setActiveTab}
              />
            )}

            {activeTab === 'audit' && (
              <AuditView
                currentUser={currentUser}
                onNavigate={setActiveTab}
              />
            )}

            {activeTab === 'settings' && (
              <SettingsView
                currentUser={currentUser}
                onNavigate={setActiveTab}
              />
            )}
          </div>
        </main>
      </div>
    </div>
  );
}

export default App;
