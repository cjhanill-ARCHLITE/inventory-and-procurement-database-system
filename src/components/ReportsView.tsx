import React, { useEffect, useState } from 'react';
import {
  BarChart3,
  Download,
  Printer,
  Calendar,
  Filter,
  RefreshCw,
  FileSpreadsheet,
  CheckCircle2,
  Building2,
} from 'lucide-react';
import type { Category, Supplier, User } from '../types.js';
import { api } from '../services/api.js';

interface ReportsViewProps {
  currentUser: User | null;
  onNavigate: (tab: string) => void;
}

export const ReportsView: React.FC<ReportsViewProps> = ({ currentUser, onNavigate }) => {
  const [selectedReport, setSelectedReport] = useState('inventory');
  const [reportTitle, setReportTitle] = useState('Current Inventory Valuation Report');
  const [reportData, setReportData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  // Filters
  const [categories, setCategories] = useState<Category[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [supplierFilter, setSupplierFilter] = useState('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const reportList = [
    { id: 'inventory', name: '1. Current Inventory Valuation Report', desc: 'Item quantities, unit prices, and total valuation' },
    { id: 'low-stock', name: '2. Low-Stock Replenishment Report', desc: 'Items at or below reorder levels with restock recommendations' },
    { id: 'out-of-stock', name: '3. Out-of-Stock Depletion Report', desc: 'Completely exhausted items requiring urgent requisition' },
    { id: 'stock-movements', name: '4. Stock Movement Ledger Report', desc: 'Complete transactional journal of all additions, releases, adjustments' },
    { id: 'purchase-requests', name: '5. Purchase Request Requisition Report', desc: 'History of departmental requisitions, approvals, and estimated spending' },
    { id: 'purchase-orders', name: '6. Purchase Order Tracking Report', desc: 'Committed commercial orders, delivery schedules, and statuses' },
    { id: 'suppliers', name: '7. Supplier Directory & Performance Report', desc: 'Vendor order volumes, contact details, and historical spend' },
    { id: 'receiving', name: '8. Goods Receiving & Acceptance Report', desc: 'Verified deliveries, accepted quantities, and rejection audit logs' },
    { id: 'procurement-spending', name: '9. Procurement Spending Analysis Report', desc: 'Expenditure breakdown across approved commercial suppliers' },
    { id: 'audit', name: '10. System User Activity & Audit Trail Report', desc: 'Operational accountability, administrative actions, and security audit' },
  ];

  const loadDependencies = async () => {
    try {
      const [cRes, sRes] = await Promise.all([api.getCategories(), api.getSuppliers()]);
      if (cRes.success) setCategories(cRes.data);
      if (sRes.success) setSuppliers(sRes.data);
    } catch (err) {
      console.error(err);
    }
  };

  const loadReport = async () => {
    try {
      setLoading(true);
      const res = await api.getReport(selectedReport, {
        category_id: categoryFilter,
        supplier_id: supplierFilter,
        start_date: startDate || undefined,
        end_date: endDate || undefined,
      });

      if (res.success) {
        setReportData(res.data);
        setReportTitle(res.title);
      }
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDependencies();
  }, []);

  useEffect(() => {
    loadReport();
  }, [selectedReport, categoryFilter, supplierFilter, startDate, endDate]);

  const headers = reportData.length > 0 ? Object.keys(reportData[0]) : [];

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">Enterprise Reporting & Analytics</h2>
          <p className="text-xs text-slate-500">
            Generate authoritative operational reports from live relational database records for audit and decision-making.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Print */}
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 transition-colors"
          >
            <Printer className="h-3.5 w-3.5" />
            <span>Print Report</span>
          </button>

          {/* Export CSV */}
          <a
            href={api.getReportDownloadUrl(selectedReport, {
              category_id: categoryFilter,
              supplier_id: supplierFilter,
              start_date: startDate,
              end_date: endDate,
            })}
            download
            className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-blue-700 transition-colors"
          >
            <Download className="h-3.5 w-3.5" />
            <span>Download CSV</span>
          </a>
        </div>
      </div>

      {/* Report Selection & Filter Controls */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Report Type Selector */}
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs lg:col-span-1">
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-900 mb-2">
            Select Report Type
          </label>
          <div className="space-y-1 max-h-72 overflow-y-auto pr-1">
            {reportList.map(rep => (
              <button
                key={rep.id}
                type="button"
                onClick={() => setSelectedReport(rep.id)}
                className={`w-full text-left rounded-lg p-2.5 text-xs transition-colors ${
                  selectedReport === rep.id
                    ? 'bg-blue-600 text-white font-semibold shadow-xs'
                    : 'text-slate-700 hover:bg-slate-100'
                }`}
              >
                <div className="truncate">{rep.name}</div>
                <div className={`text-[10px] truncate ${selectedReport === rep.id ? 'text-blue-100' : 'text-slate-400'}`}>
                  {rep.desc}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Filter Parameters */}
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs lg:col-span-2 flex flex-col justify-between">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-900 mb-3">
              Report Parameters & Filters
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              {['inventory', 'low-stock'].includes(selectedReport) && (
                <div>
                  <label className="block text-slate-600 mb-1 font-medium">Filter Category</label>
                  <select
                    value={categoryFilter}
                    onChange={e => setCategoryFilter(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 bg-slate-50 p-2 text-xs text-slate-900 focus:border-blue-500 focus:outline-hidden"
                  >
                    <option value="all">All Categories</option>
                    {categories.map(c => (
                      <option key={c.category_id} value={c.category_id}>
                        {c.category_name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {['purchase-orders', 'procurement-spending'].includes(selectedReport) && (
                <div>
                  <label className="block text-slate-600 mb-1 font-medium">Filter Supplier</label>
                  <select
                    value={supplierFilter}
                    onChange={e => setSupplierFilter(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 bg-slate-50 p-2 text-xs text-slate-900 focus:border-blue-500 focus:outline-hidden"
                  >
                    <option value="all">All Suppliers</option>
                    {suppliers.map(s => (
                      <option key={s.supplier_id} value={s.supplier_id}>
                        {s.supplier_name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {['stock-movements', 'purchase-requests', 'purchase-orders'].includes(selectedReport) && (
                <>
                  <div>
                    <label className="block text-slate-600 mb-1 font-medium">Start Date</label>
                    <input
                      type="date"
                      value={startDate}
                      onChange={e => setStartDate(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 bg-slate-50 p-2 text-xs text-slate-900 focus:border-blue-500 focus:outline-hidden"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-600 mb-1 font-medium">End Date</label>
                    <input
                      type="date"
                      value={endDate}
                      onChange={e => setEndDate(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 bg-slate-50 p-2 text-xs text-slate-900 focus:border-blue-500 focus:outline-hidden"
                    />
                  </div>
                </>
              )}
            </div>
          </div>

          <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3 text-xs text-slate-500">
            <div>
              Generated on: <strong className="text-slate-800">{new Date().toLocaleDateString()}</strong> by{' '}
              <strong className="text-slate-800">{currentUser?.username}</strong>
            </div>
            <button
              type="button"
              onClick={loadReport}
              className="inline-flex items-center gap-1 text-blue-600 hover:underline font-semibold"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              <span>Refresh Report</span>
            </button>
          </div>
        </div>
      </div>

      {/* Printable Report Output Card */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white p-6 shadow-2xs print:border-none print:shadow-none">
        {/* Printable Letterhead */}
        <div className="border-b-2 border-slate-900 pb-4 mb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-900 text-white font-bold">
                <Building2 className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-base font-extrabold text-slate-900">INVENTORY PROCUREMENT DATABASE SYSTEM (IPDS)</h3>
                <p className="text-xs text-slate-500">Enterprise Asset & Requisition Accounting Ledger</p>
              </div>
            </div>
            <div className="text-right">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-900 block">{reportTitle}</span>
              <span className="text-[11px] text-slate-500">Total Records: {reportData.length}</span>
            </div>
          </div>
        </div>

        {/* Data Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-700">
            <thead className="border-b border-slate-300 bg-slate-50 text-[10px] font-bold uppercase tracking-wider text-slate-600">
              <tr>
                {headers.map(h => (
                  <th key={h} className="py-2.5 px-3 whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={headers.length || 1} className="py-12 text-center text-slate-400">
                    <RefreshCw className="mx-auto h-5 w-5 animate-spin text-blue-600 mb-2" />
                    Querying database...
                  </td>
                </tr>
              ) : reportData.length === 0 ? (
                <tr>
                  <td colSpan={headers.length || 1} className="py-12 text-center text-slate-500">
                    No data records found for the selected parameters.
                  </td>
                </tr>
              ) : (
                reportData.map((row, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/80">
                    {headers.map(h => {
                      const val = row[h];
                      const isNumeric = typeof val === 'number' || (typeof val === 'string' && val.includes('₱'));
                      return (
                        <td
                          key={h}
                          className={`py-2 px-3 whitespace-nowrap ${
                            isNumeric ? 'text-right font-mono font-medium' : ''
                          }`}
                        >
                          {val !== null && val !== undefined ? String(val) : '-'}
                        </td>
                      );
                    })}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
