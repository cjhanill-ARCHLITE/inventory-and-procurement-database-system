import React, { useEffect, useState } from 'react';
import { History, Search, Filter, Download, ArrowUpRight, ArrowDownRight, RefreshCw, Calendar } from 'lucide-react';
import type { StockTransaction, User } from '../types.js';
import { api } from '../services/api.js';

interface StockTransactionsViewProps {
  currentUser: User | null;
  onNavigate: (tab: string) => void;
}

export const StockTransactionsView: React.FC<StockTransactionsViewProps> = ({ currentUser, onNavigate }) => {
  const [transactions, setTransactions] = useState<StockTransaction[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters & Pagination
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);

  const loadTransactions = async () => {
    try {
      setLoading(true);
      const res = await api.getStockTransactions({
        search,
        type: typeFilter,
        start_date: startDate || undefined,
        end_date: endDate || undefined,
        page,
        limit: 20,
      });

      if (res.success) {
        setTransactions(res.data);
        setTotalPages(res.pagination.totalPages);
        setTotalRecords(res.pagination.totalRecords);
      }
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTransactions();
  }, [search, typeFilter, startDate, endDate, page]);

  const getTypeBadge = (type: string) => {
    switch (type) {
      case 'purchase_receipt':
        return <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-[10px] font-bold text-emerald-800 border border-emerald-200">PURCHASE RECEIPT</span>;
      case 'opening_balance':
        return <span className="rounded-full bg-blue-100 px-2.5 py-0.5 text-[10px] font-bold text-blue-800 border border-blue-200">OPENING BALANCE</span>;
      case 'adjustment':
        return <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-[10px] font-bold text-amber-800 border border-amber-200">STOCK ADJUSTMENT</span>;
      case 'stock_out':
        return <span className="rounded-full bg-purple-100 px-2.5 py-0.5 text-[10px] font-bold text-purple-800 border border-purple-200">STOCK OUT</span>;
      case 'return':
        return <span className="rounded-full bg-cyan-100 px-2.5 py-0.5 text-[10px] font-bold text-cyan-800 border border-cyan-200">RETURN / RESTOCK</span>;
      default:
        return <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[10px] font-bold text-slate-700 border border-slate-200">{type}</span>;
    }
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">Stock Movement Ledger</h2>
          <p className="text-xs text-slate-500">
            Immutable transactional journal recording every stock-in, delivery receipt, and authorized inventory adjustment.
          </p>
        </div>

        <a
          href={api.getReportDownloadUrl('stock-movements', { start_date: startDate, end_date: endDate })}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 transition-colors"
          download
        >
          <Download className="h-3.5 w-3.5" />
          <span>Export Ledger CSV</span>
        </a>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-3.5 shadow-2xs">
        <div className="flex flex-1 flex-wrap items-center gap-3">
          <div className="relative min-w-56 flex-1">
            <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={e => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Search tx number, item name, code, or remarks..."
              className="w-full rounded-lg border border-slate-200 bg-slate-50 py-1.5 pl-8 pr-3 text-xs text-slate-900 focus:border-blue-500 focus:bg-white focus:outline-hidden"
            />
          </div>

          <select
            value={typeFilter}
            onChange={e => {
              setTypeFilter(e.target.value);
              setPage(1);
            }}
            className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs text-slate-700 focus:border-blue-500 focus:outline-hidden"
          >
            <option value="all">All Transaction Types</option>
            <option value="purchase_receipt">Purchase Receipts (Deliveries)</option>
            <option value="adjustment">Manual Adjustments</option>
            <option value="opening_balance">Opening Balance</option>
            <option value="stock_out">Stock Out (Releases)</option>
          </select>

          <div className="flex items-center gap-1.5 text-xs text-slate-500">
            <Calendar className="h-3.5 w-3.5 text-slate-400" />
            <input
              type="date"
              value={startDate}
              onChange={e => {
                setStartDate(e.target.value);
                setPage(1);
              }}
              className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-xs text-slate-700 focus:border-blue-500 focus:outline-hidden"
            />
            <span>to</span>
            <input
              type="date"
              value={endDate}
              onChange={e => {
                setEndDate(e.target.value);
                setPage(1);
              }}
              className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-xs text-slate-700 focus:border-blue-500 focus:outline-hidden"
            />
          </div>
        </div>

        <button
          type="button"
          onClick={() => {
            setSearch('');
            setTypeFilter('all');
            setStartDate('');
            setEndDate('');
            setPage(1);
          }}
          className="text-xs text-slate-500 hover:text-slate-800 underline"
        >
          Reset Filters
        </button>
      </div>

      {/* Ledger Table */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-600">
            <thead className="border-b border-slate-200 bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-600">
              <tr>
                <th className="py-3 px-4">Tx Number</th>
                <th className="py-3 px-4">Timestamp</th>
                <th className="py-3 px-4">Item Details</th>
                <th className="py-3 px-4">Category</th>
                <th className="py-3 px-4 text-center">Type</th>
                <th className="py-3 px-4 text-right">Delta Qty</th>
                <th className="py-3 px-4 text-right">Prev Stock</th>
                <th className="py-3 px-4 text-right">New Stock</th>
                <th className="py-3 px-4">Authorized User / Ref</th>
                <th className="py-3 px-4">Remarks</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-slate-400">
                    <RefreshCw className="mx-auto h-5 w-5 animate-spin text-blue-600 mb-2" />
                    Fetching stock ledger from database...
                  </td>
                </tr>
              ) : transactions.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-slate-500">
                    No stock transactions found for this query.
                  </td>
                </tr>
              ) : (
                transactions.map(tx => (
                  <tr key={tx.transaction_id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-4 font-mono font-bold text-slate-800">{tx.transaction_number}</td>
                    <td className="py-3 px-4 whitespace-nowrap text-slate-500">
                      {new Date(tx.transaction_date).toLocaleString([], {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-semibold text-slate-900">{tx.item_name}</div>
                      <div className="font-mono text-[11px] text-slate-400">{tx.item_code}</div>
                    </td>
                    <td className="py-3 px-4 text-slate-600">{tx.category_name}</td>
                    <td className="py-3 px-4 text-center">{getTypeBadge(tx.transaction_type)}</td>
                    <td className="py-3 px-4 text-right font-mono font-bold">
                      <span
                        className={`inline-flex items-center gap-0.5 ${
                          tx.quantity > 0 ? 'text-emerald-600' : 'text-red-600'
                        }`}
                      >
                        {tx.quantity > 0 ? (
                          <ArrowUpRight className="h-3.5 w-3.5" />
                        ) : (
                          <ArrowDownRight className="h-3.5 w-3.5" />
                        )}
                        {tx.quantity > 0 ? `+${tx.quantity}` : tx.quantity} {tx.unit_of_measure}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-slate-500">{tx.previous_stock}</td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-slate-900">{tx.new_stock}</td>
                    <td className="py-3 px-4 text-slate-700">
                      <div className="font-semibold text-slate-800">@{tx.username}</div>
                      <div className="font-mono text-[10px] text-slate-400 truncate max-w-28">
                        {tx.reference_type} ({tx.reference_id || 'N/A'})
                      </div>
                    </td>
                    <td className="py-3 px-4 text-slate-600 truncate max-w-xs">{tx.remarks || '-'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-600">
          <div>
            Page <span className="font-semibold text-slate-900">{page}</span> of{' '}
            <span className="font-semibold text-slate-900">{totalPages || 1}</span> ({totalRecords} ledger entries)
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage(p => Math.max(1, p - 1))}
              className="rounded-md border border-slate-200 bg-white px-2.5 py-1 text-slate-700 hover:bg-slate-100 disabled:opacity-40"
            >
              Previous
            </button>
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => setPage(p => p + 1)}
              className="rounded-md border border-slate-200 bg-white px-2.5 py-1 text-slate-700 hover:bg-slate-100 disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
