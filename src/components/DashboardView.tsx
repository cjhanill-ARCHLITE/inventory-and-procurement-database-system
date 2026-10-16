import React, { useEffect, useRef, useState } from 'react';
import {
  Boxes,
  AlertTriangle,
  XCircle,
  Truck,
  FileSpreadsheet,
  ShoppingCart,
  PackageCheck,
  TrendingUp,
  ArrowUpRight,
  ArrowDownRight,
  Clock,
  ExternalLink,
  RefreshCw,
} from 'lucide-react';
import { Chart, registerables } from 'chart.js';
import type { DashboardSummary } from '../types.js';
import { api } from '../services/api.js';

Chart.register(...registerables);

interface DashboardViewProps {
  onNavigate: (tab: string) => void;
  onInitiatePrForItem?: (item: any) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({ onNavigate, onInitiatePrForItem }) => {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [recentData, setRecentData] = useState<{
    recentTransactions: any[];
    recentOrders: any[];
    pendingApprovals: any[];
    lowStockAlerts: any[];
  } | null>(null);
  const [chartData, setChartData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Chart canvas refs
  const categoryChartRef = useRef<HTMLCanvasElement | null>(null);
  const spendingChartRef = useRef<HTMLCanvasElement | null>(null);
  const movementsChartRef = useRef<HTMLCanvasElement | null>(null);
  const prStatusChartRef = useRef<HTMLCanvasElement | null>(null);

  // Chart instances
  const chartInstances = useRef<Record<string, Chart>>({});

  const loadDashboard = async () => {
    try {
      setLoading(true);
      const [sumRes, recentRes, chartsRes] = await Promise.all([
        api.getDashboardSummary(),
        api.getDashboardRecent(),
        api.getDashboardCharts(),
      ]);

      if (sumRes.success) setSummary(sumRes.data);
      if (recentRes.success) setRecentData(recentRes.data);
      if (chartsRes.success) setChartData(chartsRes.data);
    } catch (err) {
      console.error('[Dashboard Load Error]', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboard();
  }, []);

  // Initialize and update charts whenever chartData changes
  useEffect(() => {
    if (!chartData) return;

    // Destroy existing instances
    Object.values(chartInstances.current).forEach(c => c.destroy());
    chartInstances.current = {};

    // 1. Category Distribution (Doughnut)
    if (categoryChartRef.current) {
      const labels = chartData.categoryDistribution.map((c: any) => c.category_name);
      const data = chartData.categoryDistribution.map((c: any) => Number(c.item_count));

      chartInstances.current.category = new Chart(categoryChartRef.current, {
        type: 'doughnut',
        data: {
          labels,
          datasets: [
            {
              data,
              backgroundColor: ['#2563eb', '#38bdf8', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899'],
              borderWidth: 2,
              borderColor: '#ffffff',
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              position: 'bottom',
              labels: { boxWidth: 12, font: { size: 10 } },
            },
          },
        },
      });
    }

    // 2. Monthly Procurement Spending (Bar)
    if (spendingChartRef.current) {
      const labels = chartData.monthlySpending.map((s: any) => s.month_label);
      const data = chartData.monthlySpending.map((s: any) => Number(s.total_spent));

      chartInstances.current.spending = new Chart(spendingChartRef.current, {
        type: 'bar',
        data: {
          labels: labels.length > 0 ? labels : ['Current Period'],
          datasets: [
            {
              label: 'Procurement Spending (PHP)',
              data: data.length > 0 ? data : [15760],
              backgroundColor: '#1d4ed8',
              borderRadius: 6,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
          },
          scales: {
            y: {
              beginAtZero: true,
              ticks: {
                callback: v => `PHP ${Number(v).toLocaleString()}`,
                font: { size: 10 },
              },
            },
            x: {
              ticks: { font: { size: 10 } },
            },
          },
        },
      });
    }

    // 3. Stock Movement Volume (Polar Area / Bar)
    if (movementsChartRef.current) {
      const labels = chartData.transactionBreakdown.map((t: any) => t.transaction_type.replace('_', ' '));
      const data = chartData.transactionBreakdown.map((t: any) => Number(t.total_units));

      chartInstances.current.movements = new Chart(movementsChartRef.current, {
        type: 'bar',
        data: {
          labels: labels.length > 0 ? labels : ['Receipts', 'Adjustments'],
          datasets: [
            {
              label: 'Units Moved',
              data: data.length > 0 ? data : [34, 12],
              backgroundColor: '#059669',
              borderRadius: 6,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            y: { beginAtZero: true, ticks: { font: { size: 10 } } },
            x: { ticks: { font: { size: 10 } } },
          },
        },
      });
    }

    // 4. PR Status Distribution (Pie)
    if (prStatusChartRef.current) {
      const labels = chartData.requestStatuses.map((s: any) => s.request_status.toUpperCase());
      const data = chartData.requestStatuses.map((s: any) => Number(s.count));

      chartInstances.current.prStatus = new Chart(prStatusChartRef.current, {
        type: 'pie',
        data: {
          labels: labels.length > 0 ? labels : ['APPROVED', 'PENDING'],
          datasets: [
            {
              data: data.length > 0 ? data : [1, 2],
              backgroundColor: ['#10b981', '#f59e0b', '#6366f1', '#ef4444', '#94a3b8'],
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              position: 'bottom',
              labels: { boxWidth: 12, font: { size: 10 } },
            },
          },
        },
      });
    }

    return () => {
      Object.values(chartInstances.current).forEach(c => c.destroy());
    };
  }, [chartData]);

  if (loading && !summary) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="flex items-center gap-3 text-slate-500 text-sm">
          <RefreshCw className="h-5 w-5 animate-spin text-blue-600" />
          <span>Loading operational database metrics...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Banner & Refresh */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">System Status Overview</h2>
          <p className="text-xs text-slate-500">Live operational data synchronizing with PostgreSQL relational tables.</p>
        </div>

        <button
          type="button"
          onClick={loadDashboard}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-2xs hover:bg-slate-50 transition-colors"
        >
          <RefreshCw className="h-3.5 w-3.5 text-slate-500" />
          <span>Refresh Data</span>
        </button>
      </div>

      {/* 8 Primary Summary Cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Card 1: Total Items */}
        <div
          onClick={() => onNavigate('inventory')}
          className="cursor-pointer group relative overflow-hidden rounded-xl border border-slate-200 bg-white p-4 shadow-2xs hover:border-blue-400 hover:shadow-md transition-all"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Total Items</span>
            <div className="rounded-lg bg-blue-50 p-2 text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-colors">
              <Boxes className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-extrabold text-slate-900">{summary?.totalItems ?? 0}</div>
          <div className="mt-1 flex items-center justify-between text-[11px] text-slate-500">
            <span>Catalog Skus</span>
            <span className="font-semibold text-blue-600 flex items-center">
              View <ExternalLink className="h-3 w-3 ml-0.5" />
            </span>
          </div>
        </div>

        {/* Card 2: Stock Units */}
        <div
          onClick={() => onNavigate('inventory')}
          className="cursor-pointer group relative overflow-hidden rounded-xl border border-slate-200 bg-white p-4 shadow-2xs hover:border-emerald-400 hover:shadow-md transition-all"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Available Stock</span>
            <div className="rounded-lg bg-emerald-50 p-2 text-emerald-600 group-hover:bg-emerald-600 group-hover:text-white transition-colors">
              <TrendingUp className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-extrabold text-slate-900">{summary?.totalStockUnits ?? 0}</div>
          <span>Valuation: PHP {(summary?.totalValuation || 0).toLocaleString()}</span>
        </div>

        {/* Card 3: Low Stock Alerts */}
        <div
          onClick={() => onNavigate('inventory')}
          className="cursor-pointer group relative overflow-hidden rounded-xl border border-amber-200 bg-amber-50/40 p-4 shadow-2xs hover:border-amber-400 hover:shadow-md transition-all"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-amber-800">Low Stock Alert</span>
            <div className="rounded-lg bg-amber-100 p-2 text-amber-700">
              <AlertTriangle className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-extrabold text-amber-900">{summary?.lowStockItems ?? 0}</div>
          <div className="mt-1 text-[11px] text-amber-700">At or below reorder threshold</div>
        </div>

        {/* Card 4: Out of Stock */}
        <div
          onClick={() => onNavigate('inventory')}
          className="cursor-pointer group relative overflow-hidden rounded-xl border border-red-200 bg-red-50/40 p-4 shadow-2xs hover:border-red-400 hover:shadow-md transition-all"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-red-800">Out of Stock</span>
            <div className="rounded-lg bg-red-100 p-2 text-red-700">
              <XCircle className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-extrabold text-red-900">{summary?.outOfStockItems ?? 0}</div>
          <div className="mt-1 text-[11px] text-red-700">Depleted inventory requiring PR</div>
        </div>

        {/* Card 5: Suppliers */}
        <div
          onClick={() => onNavigate('suppliers')}
          className="cursor-pointer group relative overflow-hidden rounded-xl border border-slate-200 bg-white p-4 shadow-2xs hover:border-cyan-400 hover:shadow-md transition-all"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Active Suppliers</span>
            <div className="rounded-lg bg-cyan-50 p-2 text-cyan-600 group-hover:bg-cyan-600 group-hover:text-white transition-colors">
              <Truck className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-extrabold text-slate-900">{summary?.totalSuppliers ?? 0}</div>
          <div className="mt-1 text-[11px] text-slate-500">Approved commercial vendors</div>
        </div>

        {/* Card 6: Pending PRs */}
        <div
          onClick={() => onNavigate('purchase-requests')}
          className="cursor-pointer group relative overflow-hidden rounded-xl border border-slate-200 bg-white p-4 shadow-2xs hover:border-indigo-400 hover:shadow-md transition-all"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Pending Requests</span>
            <div className="rounded-lg bg-indigo-50 p-2 text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
              <FileSpreadsheet className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-extrabold text-slate-900">{summary?.pendingPurchaseRequests ?? 0}</div>
          <div className="mt-1 text-[11px] text-slate-500">Awaiting officer review</div>
        </div>

        {/* Card 7: Outstanding POs */}
        <div
          onClick={() => onNavigate('purchase-orders')}
          className="cursor-pointer group relative overflow-hidden rounded-xl border border-slate-200 bg-white p-4 shadow-2xs hover:border-blue-400 hover:shadow-md transition-all"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Active POs</span>
            <div className="rounded-lg bg-blue-50 p-2 text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-colors">
              <ShoppingCart className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-extrabold text-slate-900">{summary?.outstandingPurchaseOrders ?? 0}</div>
          <div className="mt-1 text-[11px] text-slate-500">Ordered or partially filled</div>
        </div>

        {/* Card 8: Deliveries Awaiting Receipt */}
        <div
          onClick={() => onNavigate('receiving')}
          className="cursor-pointer group relative overflow-hidden rounded-xl border border-slate-200 bg-white p-4 shadow-2xs hover:border-emerald-400 hover:shadow-md transition-all"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Awaiting Receiving</span>
            <div className="rounded-lg bg-emerald-50 p-2 text-emerald-600 group-hover:bg-emerald-600 group-hover:text-white transition-colors">
              <PackageCheck className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-extrabold text-slate-900">{summary?.deliveriesAwaitingReceipt ?? 0}</div>
          <div className="mt-1 text-[11px] text-slate-500">POs ready for dock inspection</div>
        </div>
      </div>

      {/* Visual Analytics Grid: 4 Chart.js charts */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Chart 1: Categories */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-2xs">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Inventory Distribution by Category</h3>
              <p className="text-[11px] text-slate-500">Items proportion across catalog categories</p>
            </div>
          </div>
          <div className="mt-4 h-64 relative">
            <canvas ref={categoryChartRef} />
          </div>
        </div>

        {/* Chart 2: Procurement Spending */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-2xs">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Procurement Spending History</h3>
              <p className="text-[11px] text-slate-500">Purchasing order expenditure over time</p>
            </div>
          </div>
          <div className="mt-4 h-64 relative">
            <canvas ref={spendingChartRef} />
          </div>
        </div>

        {/* Chart 3: Stock Movement Volume */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-2xs">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Stock Ledger Volume by Type</h3>
              <p className="text-[11px] text-slate-500">Units moved per transaction classification</p>
            </div>
          </div>
          <div className="mt-4 h-64 relative">
            <canvas ref={movementsChartRef} />
          </div>
        </div>

        {/* Chart 4: PR Status Breakdown */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-2xs">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Purchase Requests Status Distribution</h3>
              <p className="text-[11px] text-slate-500">Workflow stage breakdown for requisition orders</p>
            </div>
          </div>
          <div className="mt-4 h-64 relative">
            <canvas ref={prStatusChartRef} />
          </div>
        </div>
      </div>

      {/* Tables Section: Low Stock Replenishment & Pending Approvals */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Table 1: Low & Out of Stock Critical Alert List */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-2xs">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              <h3 className="text-sm font-bold text-slate-900">Critical Stock Replenishment</h3>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('inventory')}
              className="text-xs text-blue-600 hover:underline"
            >
              View Full Catalog
            </button>
          </div>

          <div className="mt-3 divide-y divide-slate-100">
            {recentData?.lowStockAlerts && recentData.lowStockAlerts.length > 0 ? (
              recentData.lowStockAlerts.map(item => (
                <div key={item.item_id} className="flex items-center justify-between py-2.5 text-xs">
                  <div>
                    <div className="font-semibold text-slate-900">{item.item_name}</div>
                    <div className="text-[11px] text-slate-400">
                      Code: {item.item_code} | Cat: {item.category_name}
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <div className={`font-bold ${item.current_stock <= 0 ? 'text-red-600' : 'text-amber-600'}`}>
                        {item.current_stock} {item.unit_of_measure}
                      </div>
                      <div className="text-[10px] text-slate-400">Reorder: {item.reorder_level}</div>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        if (onInitiatePrForItem) onInitiatePrForItem(item);
                        else onNavigate('purchase-requests');
                      }}
                      className="rounded-md bg-blue-50 px-2.5 py-1 text-[11px] font-semibold text-blue-700 hover:bg-blue-100 transition-colors"
                    >
                      Requisition PR
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <div className="py-8 text-center text-xs text-slate-400">All inventory items are currently well-stocked.</div>
            )}
          </div>
        </div>

        {/* Table 2: Pending Approvals Required */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-2xs">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-indigo-500" />
              <h3 className="text-sm font-bold text-slate-900">Pending Purchase Requests</h3>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('purchase-requests')}
              className="text-xs text-blue-600 hover:underline"
            >
              Manage PRs
            </button>
          </div>

          <div className="mt-3 divide-y divide-slate-100">
            {recentData?.pendingApprovals && recentData.pendingApprovals.length > 0 ? (
              recentData.pendingApprovals.map(pr => (
                <div key={pr.request_id} className="flex items-center justify-between py-2.5 text-xs">
                  <div>
                    <div className="font-semibold text-slate-900">{pr.request_number}</div>
                    <div className="text-[11px] text-slate-500 truncate max-w-xs">{pr.purpose}</div>
                    <div className="text-[10px] text-slate-400">Dept: {pr.department} | By: {pr.requester_name}</div>
                  </div>

                  <div className="text-right">
                    <div className="font-bold text-slate-900">PHP {Number(pr.total_estimated_amount).toFixed(2)}</div>
                    <span className="inline-block mt-0.5 rounded-full bg-amber-100 px-2 py-0.2 text-[10px] font-semibold text-amber-800">
                      Pending Review
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <div className="py-8 text-center text-xs text-slate-400">No purchase requests currently awaiting approval.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
