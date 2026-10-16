import React, { useEffect, useState } from 'react';
import {
  Boxes,
  Plus,
  Search,
  Filter,
  Download,
  Eye,
  Edit2,
  SlidersHorizontal,
  AlertTriangle,
  ArrowUpDown,
  History,
  X,
  Check,
  RefreshCw,
} from 'lucide-react';
import type { InventoryItem, Category, User } from '../types.js';
import { api } from '../services/api.js';

interface InventoryViewProps {
  currentUser: User | null;
  onNavigate: (tab: string) => void;
  externalSearchQuery?: string;
}

export const InventoryView: React.FC<InventoryViewProps> = ({ currentUser, onNavigate, externalSearchQuery = '' }) => {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters & Pagination
  const [search, setSearch] = useState(externalSearchQuery);
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [stockStatusFilter, setStockStatusFilter] = useState('all');
  const [sortBy, setSortBy] = useState('item_name');
  const [sortOrder, setSortOrder] = useState<'ASC' | 'DESC'>('ASC');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showAdjustModal, setShowAdjustModal] = useState(false);

  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [modalLoading, setModalLoading] = useState(false);
  const [modalError, setModalError] = useState('');
  const [modalSuccess, setModalSuccess] = useState('');

  // Form States
  const [addForm, setAddForm] = useState({
    item_code: '',
    item_name: '',
    description: '',
    category_id: '',
    unit_of_measure: 'pcs',
    reorder_level: 10,
    initial_stock: 0,
    unit_price: 0,
  });

  const [editForm, setEditForm] = useState({
    item_name: '',
    description: '',
    category_id: '',
    unit_of_measure: 'pcs',
    reorder_level: 10,
    unit_price: 0,
  });

  const [adjustForm, setAdjustForm] = useState({
    adjustment_type: 'increase',
    quantity: 1,
    reason: '',
  });

  const loadCategories = async () => {
    try {
      const res = await api.getCategories();
      if (res.success) setCategories(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const loadItems = async () => {
    try {
      setLoading(true);
      const res = await api.getItems({
        search,
        category_id: categoryFilter,
        stock_status: stockStatusFilter,
        sort_by: sortBy,
        sort_order: sortOrder,
        page,
        limit: 15,
      });

      if (res.success) {
        setItems(res.data);
        setTotalPages(res.pagination.totalPages);
        setTotalRecords(res.pagination.totalRecords);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCategories();
  }, []);

  useEffect(() => {
    loadItems();
  }, [search, categoryFilter, stockStatusFilter, sortBy, sortOrder, page]);

  // Sync external search from navbar
  useEffect(() => {
    if (externalSearchQuery !== undefined) {
      setSearch(externalSearchQuery);
      setPage(1);
    }
  }, [externalSearchQuery]);

  const handleSort = (column: string) => {
    if (sortBy === column) {
      setSortOrder(prev => (prev === 'ASC' ? 'DESC' : 'ASC'));
    } else {
      setSortBy(column);
      setSortOrder('ASC');
    }
    setPage(1);
  };

  // Add Item Action
  const handleAddItemSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalError('');
    setModalSuccess('');
    try {
      setModalLoading(true);
      const res = await api.createItem({
        ...addForm,
        category_id: Number(addForm.category_id),
      });

      if (res.success) {
        setModalSuccess('Item registered successfully!');
        setTimeout(() => {
          setShowAddModal(false);
          setModalSuccess('');
          setAddForm({
            item_code: '',
            item_name: '',
            description: '',
            category_id: categories[0]?.category_id.toString() || '',
            unit_of_measure: 'pcs',
            reorder_level: 10,
            initial_stock: 0,
            unit_price: 0,
          });
          loadItems();
        }, 1000);
      }
    } catch (err: any) {
      setModalError(err.message || 'Failed to register item');
    } finally {
      setModalLoading(false);
    }
  };

  // Edit Item Action
  const handleEditItemSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalError('');
    setModalSuccess('');
    try {
      setModalLoading(true);
      const res = await api.updateItem(selectedItem.item_id, {
        ...editForm,
        category_id: Number(editForm.category_id),
      });

      if (res.success) {
        setModalSuccess('Item details updated successfully!');
        setTimeout(() => {
          setShowEditModal(false);
          setModalSuccess('');
          loadItems();
        }, 1000);
      }
    } catch (err: any) {
      setModalError(err.message || 'Failed to update item');
    } finally {
      setModalLoading(false);
    }
  };

  // Adjust Stock Action
  const handleAdjustSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalError('');
    setModalSuccess('');
    try {
      setModalLoading(true);
      const res = await api.adjustStock({
        item_id: selectedItem.item_id,
        adjustment_type: adjustForm.adjustment_type,
        quantity: Number(adjustForm.quantity),
        reason: adjustForm.reason,
      });

      if (res.success) {
        setModalSuccess(res.message);
        setTimeout(() => {
          setShowAdjustModal(false);
          setModalSuccess('');
          setAdjustForm({ adjustment_type: 'increase', quantity: 1, reason: '' });
          loadItems();
        }, 1200);
      }
    } catch (err: any) {
      setModalError(err.message || 'Stock adjustment failed');
    } finally {
      setModalLoading(false);
    }
  };

  // Open Details Modal
  const openViewModal = async (item: InventoryItem) => {
    setModalLoading(true);
    setShowViewModal(true);
    try {
      const res = await api.getItem(item.item_id);
      if (res.success) {
        setSelectedItem(res.data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setModalLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'In Stock':
        return <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-[10px] font-bold text-emerald-800 border border-emerald-200">IN STOCK</span>;
      case 'Low Stock':
        return <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-[10px] font-bold text-amber-800 border border-amber-200">LOW STOCK</span>;
      case 'Out of Stock':
        return <span className="rounded-full bg-red-100 px-2.5 py-0.5 text-[10px] font-bold text-red-800 border border-red-200">OUT OF STOCK</span>;
      default:
        return <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[10px] font-bold text-slate-700 border border-slate-200">INACTIVE</span>;
    }
  };

  const canModify = currentUser?.role === 'admin' || currentUser?.role === 'inventory_staff';

  return (
    <div className="space-y-5">
      {/* Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">Inventory Catalog</h2>
          <p className="text-xs text-slate-500">
            Total of {totalRecords} items cataloged with automated stock ledger monitoring.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* CSV Export */}
          <a
            href={api.getReportDownloadUrl('inventory', { category_id: categoryFilter })}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 transition-colors"
            download
          >
            <Download className="h-3.5 w-3.5" />
            <span>Export CSV</span>
          </a>

          {/* Add Item Button */}
          {canModify && (
            <button
              type="button"
              onClick={() => {
                setAddForm(prev => ({
                  ...prev,
                  category_id: categories[0]?.category_id.toString() || '',
                }));
                setShowAddModal(true);
              }}
              className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-blue-700 transition-colors"
            >
              <Plus className="h-4 w-4" />
              <span>Register Item</span>
            </button>
          )}
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-3.5 shadow-2xs">
        <div className="flex flex-1 flex-wrap items-center gap-3">
          {/* Search box */}
          <div className="relative min-w-56 flex-1">
            <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={e => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Search code, item name, description..."
              className="w-full rounded-lg border border-slate-200 bg-slate-50 py-1.5 pl-8 pr-3 text-xs text-slate-900 focus:border-blue-500 focus:bg-white focus:outline-hidden"
            />
          </div>

          {/* Category filter */}
          <div className="flex items-center gap-1.5">
            <Filter className="h-3.5 w-3.5 text-slate-400" />
            <select
              value={categoryFilter}
              onChange={e => {
                setCategoryFilter(e.target.value);
                setPage(1);
              }}
              className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs text-slate-700 focus:border-blue-500 focus:outline-hidden"
            >
              <option value="all">All Categories</option>
              {categories.map(c => (
                <option key={c.category_id} value={c.category_id}>
                  {c.category_name}
                </option>
              ))}
            </select>
          </div>

          {/* Stock Status filter */}
          <div className="flex items-center gap-1.5">
            <select
              value={stockStatusFilter}
              onChange={e => {
                setStockStatusFilter(e.target.value);
                setPage(1);
              }}
              className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs text-slate-700 focus:border-blue-500 focus:outline-hidden"
            >
              <option value="all">All Stock Statuses</option>
              <option value="in">In Stock Only</option>
              <option value="low">Low Stock (Alerts)</option>
              <option value="out">Out of Stock</option>
            </select>
          </div>
        </div>

        <button
          type="button"
          onClick={() => {
            setSearch('');
            setCategoryFilter('all');
            setStockStatusFilter('all');
            setPage(1);
          }}
          className="text-xs text-slate-500 hover:text-slate-800 underline"
        >
          Reset Filters
        </button>
      </div>

      {/* Main Inventory Table */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-600">
            <thead className="border-b border-slate-200 bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-600">
              <tr>
                <th
                  onClick={() => handleSort('item_code')}
                  className="cursor-pointer py-3.5 px-4 hover:bg-slate-100"
                >
                  <div className="flex items-center gap-1">
                    <span>Item Code</span>
                    <ArrowUpDown className="h-3 w-3 text-slate-400" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort('item_name')}
                  className="cursor-pointer py-3.5 px-4 hover:bg-slate-100"
                >
                  <div className="flex items-center gap-1">
                    <span>Item Description</span>
                    <ArrowUpDown className="h-3 w-3 text-slate-400" />
                  </div>
                </th>
                <th className="py-3.5 px-4">Category</th>
                <th className="py-3.5 px-4 text-center">Unit</th>
                <th
                  onClick={() => handleSort('current_stock')}
                  className="cursor-pointer py-3.5 px-4 text-right hover:bg-slate-100"
                >
                  <div className="flex items-center justify-end gap-1">
                    <span>Stock</span>
                    <ArrowUpDown className="h-3 w-3 text-slate-400" />
                  </div>
                </th>
                <th className="py-3.5 px-4 text-right">Reorder Point</th>
                <th className="py-3.5 px-4 text-center">Status</th>
                <th
                  onClick={() => handleSort('unit_price')}
                  className="cursor-pointer py-3.5 px-4 text-right hover:bg-slate-100"
                >
                  <div className="flex items-center justify-end gap-1">
                    <span>Unit Price</span>
                    <ArrowUpDown className="h-3 w-3 text-slate-400" />
                  </div>
                </th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400">
                    <RefreshCw className="mx-auto h-5 w-5 animate-spin text-blue-600 mb-2" />
                    Fetching inventory items from PostgreSQL...
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-500">
                    No inventory items matched your search criteria.
                  </td>
                </tr>
              ) : (
                items.map(item => (
                  <tr key={item.item_id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-4 font-mono font-bold text-slate-900">{item.item_code}</td>
                    <td className="py-3 px-4">
                      <div className="font-semibold text-slate-900">{item.item_name}</div>
                      <div className="text-[11px] text-slate-400 truncate max-w-xs">{item.description}</div>
                    </td>
                    <td className="py-3 px-4">
                      <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] text-slate-700">
                        {item.category_name}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center font-medium text-slate-600 uppercase">
                      {item.unit_of_measure}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <span
                        className={`text-sm font-bold ${
                          item.current_stock <= 0
                            ? 'text-red-600'
                            : item.current_stock <= item.reorder_level
                            ? 'text-amber-600'
                            : 'text-slate-900'
                        }`}
                      >
                        {item.current_stock}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right font-medium text-slate-500">{item.reorder_level}</td>
                    <td className="py-3 px-4 text-center">
                      {getStatusBadge(item.computed_stock_status || 'In Stock')}
                    </td>
                    <td className="py-3 px-4 text-right font-semibold text-slate-900">
                      PHP {Number(item.unit_price).toFixed(2)}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => openViewModal(item)}
                          className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                          title="View Details & Ledger History"
                        >
                          <Eye className="h-4 w-4" />
                        </button>

                        {canModify && (
                          <>
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedItem(item);
                                setEditForm({
                                  item_name: item.item_name,
                                  description: item.description || '',
                                  category_id: String(item.category_id),
                                  unit_of_measure: item.unit_of_measure,
                                  reorder_level: item.reorder_level,
                                  unit_price: Number(item.unit_price),
                                });
                                setShowEditModal(true);
                              }}
                              className="rounded-lg p-1.5 text-slate-400 hover:bg-blue-50 hover:text-blue-600"
                              title="Edit Item Details"
                            >
                              <Edit2 className="h-4 w-4" />
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                setSelectedItem(item);
                                setAdjustForm({
                                  adjustment_type: 'increase',
                                  quantity: 1,
                                  reason: '',
                                });
                                setShowAdjustModal(true);
                              }}
                              className="rounded-lg p-1.5 text-slate-400 hover:bg-amber-50 hover:text-amber-600"
                              title="Adjust Stock Ledger"
                            >
                              <SlidersHorizontal className="h-4 w-4" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-600">
          <div>
            Showing Page <span className="font-semibold text-slate-900">{page}</span> of{' '}
            <span className="font-semibold text-slate-900">{totalPages || 1}</span> ({totalRecords} items)
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

      {/* MODAL 1: REGISTER NEW ITEM */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 px-6 py-4">
              <h3 className="text-sm font-bold text-slate-900">Register New Inventory Item</h3>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleAddItemSubmit} className="p-6 space-y-4">
              {modalError && (
                <div className="rounded-lg bg-red-50 p-3 text-xs text-red-700 border border-red-200">
                  {modalError}
                </div>
              )}
              {modalSuccess && (
                <div className="rounded-lg bg-emerald-50 p-3 text-xs text-emerald-700 border border-emerald-200">
                  {modalSuccess}
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700">Item Code *</label>
                  <input
                    type="text"
                    required
                    value={addForm.item_code}
                    onChange={e => setAddForm({ ...addForm, item_code: e.target.value.toUpperCase() })}
                    placeholder="e.g. ITM-PAP-A4"
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-1.5 text-xs text-slate-900 uppercase font-mono focus:border-blue-500 focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700">Category *</label>
                  <select
                    required
                    value={addForm.category_id}
                    onChange={e => setAddForm({ ...addForm, category_id: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-1.5 text-xs text-slate-900 focus:border-blue-500 focus:outline-hidden"
                  >
                    {categories.map(c => (
                      <option key={c.category_id} value={c.category_id}>
                        {c.category_name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700">Item Name *</label>
                <input
                  type="text"
                  required
                  value={addForm.item_name}
                  onChange={e => setAddForm({ ...addForm, item_name: e.target.value })}
                  placeholder="e.g. Copy Paper A4 80gsm (500 Sheets/Ream)"
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-1.5 text-xs text-slate-900 focus:border-blue-500 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700">Description</label>
                <textarea
                  rows={2}
                  value={addForm.description}
                  onChange={e => setAddForm({ ...addForm, description: e.target.value })}
                  placeholder="Detailed specifications or package details..."
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-1.5 text-xs text-slate-900 focus:border-blue-500 focus:outline-hidden"
                />
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700">Unit of Measure *</label>
                  <input
                    type="text"
                    required
                    value={addForm.unit_of_measure}
                    onChange={e => setAddForm({ ...addForm, unit_of_measure: e.target.value })}
                    placeholder="pcs / box / ream"
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-1.5 text-xs text-slate-900 focus:border-blue-500 focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700">Reorder Level *</label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={addForm.reorder_level}
                    onChange={e => setAddForm({ ...addForm, reorder_level: Number(e.target.value) })}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-1.5 text-xs text-slate-900 focus:border-blue-500 focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700">Initial Stock</label>
                  <input
                    type="number"
                    min="0"
                    value={addForm.initial_stock}
                    onChange={e => setAddForm({ ...addForm, initial_stock: Number(e.target.value) })}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-1.5 text-xs text-slate-900 focus:border-blue-500 focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700">Unit Price (₱)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={addForm.unit_price}
                    onChange={e => setAddForm({ ...addForm, unit_price: Number(e.target.value) })}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-1.5 text-xs text-slate-900 focus:border-blue-500 focus:outline-hidden"
                  />
                </div>
              </div>

              <div className="rounded-lg bg-blue-50/70 p-3 text-[11px] text-blue-700">
                Notice: Setting an initial stock creates an authorized opening balance transaction in the immutable ledger.
              </div>

              <div className="mt-5 flex justify-end gap-2 border-t border-slate-100 pt-4">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={modalLoading}
                  className="rounded-lg bg-blue-600 px-5 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {modalLoading ? 'Registering...' : 'Save Item'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: EDIT ITEM */}
      {showEditModal && selectedItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 px-6 py-4">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Edit Item Details</h3>
                <span className="font-mono text-xs text-slate-500">{selectedItem.item_code}</span>
              </div>
              <button
                type="button"
                onClick={() => setShowEditModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleEditItemSubmit} className="p-6 space-y-4">
              {modalError && (
                <div className="rounded-lg bg-red-50 p-3 text-xs text-red-700 border border-red-200">
                  {modalError}
                </div>
              )}
              {modalSuccess && (
                <div className="rounded-lg bg-emerald-50 p-3 text-xs text-emerald-700 border border-emerald-200">
                  {modalSuccess}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700">Item Name *</label>
                <input
                  type="text"
                  required
                  value={editForm.item_name}
                  onChange={e => setEditForm({ ...editForm, item_name: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-1.5 text-xs text-slate-900 focus:border-blue-500 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700">Category *</label>
                <select
                  required
                  value={editForm.category_id}
                  onChange={e => setEditForm({ ...editForm, category_id: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-1.5 text-xs text-slate-900 focus:border-blue-500 focus:outline-hidden"
                >
                  {categories.map(c => (
                    <option key={c.category_id} value={c.category_id}>
                      {c.category_name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700">Description</label>
                <textarea
                  rows={2}
                  value={editForm.description}
                  onChange={e => setEditForm({ ...editForm, description: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-1.5 text-xs text-slate-900 focus:border-blue-500 focus:outline-hidden"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700">Unit of Measure</label>
                  <input
                    type="text"
                    required
                    value={editForm.unit_of_measure}
                    onChange={e => setEditForm({ ...editForm, unit_of_measure: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-1.5 text-xs text-slate-900 focus:border-blue-500 focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700">Reorder Level</label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={editForm.reorder_level}
                    onChange={e => setEditForm({ ...editForm, reorder_level: Number(e.target.value) })}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-1.5 text-xs text-slate-900 focus:border-blue-500 focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700">Unit Price (₱)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={editForm.unit_price}
                    onChange={e => setEditForm({ ...editForm, unit_price: Number(e.target.value) })}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-1.5 text-xs text-slate-900 focus:border-blue-500 focus:outline-hidden"
                  />
                </div>
              </div>

              <div className="mt-5 flex justify-end gap-2 border-t border-slate-100 pt-4">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={modalLoading}
                  className="rounded-lg bg-blue-600 px-5 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {modalLoading ? 'Saving...' : 'Update Details'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: ADJUST STOCK (MANUAL ADJUSTMENT WITH REASON & AUDIT ENTRY) */}
      {showAdjustModal && selectedItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 px-6 py-4">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Authorize Stock Adjustment</h3>
                <span className="text-xs text-slate-500">{selectedItem.item_name}</span>
              </div>
              <button
                type="button"
                onClick={() => setShowAdjustModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleAdjustSubmit} className="p-6 space-y-4">
              {modalError && (
                <div className="rounded-lg bg-red-50 p-3 text-xs text-red-700 border border-red-200">
                  {modalError}
                </div>
              )}
              {modalSuccess && (
                <div className="rounded-lg bg-emerald-50 p-3 text-xs text-emerald-700 border border-emerald-200">
                  {modalSuccess}
                </div>
              )}

              <div className="rounded-xl bg-slate-50 p-3.5 border border-slate-200/80 flex items-center justify-between text-xs">
                <div>
                  <span className="text-slate-500">Current Stock:</span>
                  <span className="ml-2 font-bold text-slate-900">
                    {selectedItem.current_stock} {selectedItem.unit_of_measure}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500">Reorder Threshold:</span>
                  <span className="ml-2 font-semibold text-amber-600">{selectedItem.reorder_level}</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700">Adjustment Type *</label>
                <div className="mt-1.5 grid grid-cols-2 gap-3">
                  <label
                    className={`flex cursor-pointer items-center justify-center gap-2 rounded-lg border p-2.5 text-xs font-semibold transition-all ${
                      adjustForm.adjustment_type === 'increase'
                        ? 'border-emerald-500 bg-emerald-50 text-emerald-800'
                        : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <input
                      type="radio"
                      name="adjustment_type"
                      checked={adjustForm.adjustment_type === 'increase'}
                      onChange={() => setAdjustForm({ ...adjustForm, adjustment_type: 'increase' })}
                      className="hidden"
                    />
                    <span>+ Increase Stock</span>
                  </label>

                  <label
                    className={`flex cursor-pointer items-center justify-center gap-2 rounded-lg border p-2.5 text-xs font-semibold transition-all ${
                      adjustForm.adjustment_type === 'decrease'
                        ? 'border-red-500 bg-red-50 text-red-800'
                        : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <input
                      type="radio"
                      name="adjustment_type"
                      checked={adjustForm.adjustment_type === 'decrease'}
                      onChange={() => setAdjustForm({ ...adjustForm, adjustment_type: 'decrease' })}
                      className="hidden"
                    />
                    <span>- Decrease Stock</span>
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700">Adjustment Quantity *</label>
                <input
                  type="number"
                  min="1"
                  required
                  value={adjustForm.quantity}
                  onChange={e => setAdjustForm({ ...adjustForm, quantity: Math.max(1, Number(e.target.value)) })}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-1.5 text-xs text-slate-900 focus:border-blue-500 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700">Mandatory Justification / Reason *</label>
                <textarea
                  rows={2}
                  required
                  value={adjustForm.reason}
                  onChange={e => setAdjustForm({ ...adjustForm, reason: e.target.value })}
                  placeholder="e.g. Annual physical count audit discrepancy; damaged units discarded..."
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-1.5 text-xs text-slate-900 focus:border-blue-500 focus:outline-hidden"
                />
              </div>

              <div className="mt-5 flex justify-end gap-2 border-t border-slate-100 pt-4">
                <button
                  type="button"
                  onClick={() => setShowAdjustModal(false)}
                  className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={modalLoading}
                  className="rounded-lg bg-amber-600 px-5 py-2 text-xs font-semibold text-white hover:bg-amber-700 disabled:opacity-50"
                >
                  {modalLoading ? 'Committing...' : 'Commit Adjustment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 4: VIEW ITEM DETAILS & IMMUTABLE LEDGER */}
      {showViewModal && selectedItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-2xl rounded-2xl border border-slate-200 bg-white shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 px-6 py-4">
              <div>
                <h3 className="text-sm font-bold text-slate-900">{selectedItem.item_name}</h3>
                <span className="font-mono text-xs text-slate-500">{selectedItem.item_code}</span>
              </div>
              <button
                type="button"
                onClick={() => setShowViewModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-5">
              {/* Summary Specs */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs">
                  <span className="text-slate-500">Current Stock</span>
                  <div className="text-lg font-bold text-slate-900">
                    {selectedItem.current_stock} {selectedItem.unit_of_measure}
                  </div>
                </div>

                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs">
                  <span className="text-slate-500">Reorder Level</span>
                  <div className="text-lg font-bold text-slate-900">{selectedItem.reorder_level}</div>
                </div>

                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs">
                  <span className="text-slate-500">Unit Price</span>
                  <div className="text-lg font-bold text-slate-900">PHP {Number(selectedItem.unit_price).toFixed(2)}</div>
                </div>

                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs">
                  <span className="text-slate-500">Status</span>
                  <div className="mt-1">{getStatusBadge(selectedItem.computed_stock_status)}</div>
                </div>
              </div>

              {selectedItem.description && (
                <div className="rounded-xl border border-slate-200 p-3.5 text-xs text-slate-700 bg-slate-50/50">
                  <span className="font-semibold text-slate-900 block mb-1">Specifications:</span>
                  {selectedItem.description}
                </div>
              )}

              {/* Transaction Ledger for this item */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <History className="h-4 w-4 text-blue-600" />
                    <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                      Item Stock Ledger History
                    </h4>
                  </div>
                  <span className="text-[11px] text-slate-400">
                    {selectedItem.transactions?.length || 0} ledger transactions
                  </span>
                </div>

                <div className="rounded-xl border border-slate-200 overflow-hidden">
                  <table className="w-full text-left text-xs text-slate-600">
                    <thead className="bg-slate-50 border-b border-slate-200 text-[10px] uppercase font-bold text-slate-500">
                      <tr>
                        <th className="py-2.5 px-3">Date</th>
                        <th className="py-2.5 px-3">Type</th>
                        <th className="py-2.5 px-3 text-right">Delta</th>
                        <th className="py-2.5 px-3 text-right">Balance</th>
                        <th className="py-2.5 px-3">User / Ref</th>
                        <th className="py-2.5 px-3">Remarks</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {selectedItem.transactions && selectedItem.transactions.length > 0 ? (
                        selectedItem.transactions.map((tx: any) => (
                          <tr key={tx.transaction_id} className="hover:bg-slate-50/70">
                            <td className="py-2 px-3 text-[11px] text-slate-500 whitespace-nowrap">
                              {new Date(tx.transaction_date).toLocaleDateString()}
                            </td>
                            <td className="py-2 px-3 font-semibold text-slate-800 capitalize text-[11px]">
                              {tx.transaction_type.replace('_', ' ')}
                            </td>
                            <td
                              className={`py-2 px-3 text-right font-mono font-bold text-[11px] ${
                                tx.quantity > 0 ? 'text-emerald-600' : 'text-red-600'
                              }`}
                            >
                              {tx.quantity > 0 ? `+${tx.quantity}` : tx.quantity}
                            </td>
                            <td className="py-2 px-3 text-right font-mono font-bold text-[11px] text-slate-900">
                              {tx.new_stock}
                            </td>
                            <td className="py-2 px-3 text-[11px] text-slate-600">
                              @{tx.username} ({tx.reference_type || 'N/A'})
                            </td>
                            <td className="py-2 px-3 text-[11px] text-slate-500 truncate max-w-xs">{tx.remarks}</td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={6} className="py-6 text-center text-xs text-slate-400">
                            No transactions recorded for this item yet.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            <div className="flex justify-end border-t border-slate-100 bg-slate-50 px-6 py-3">
              <button
                type="button"
                onClick={() => setShowViewModal(false)}
                className="rounded-lg bg-slate-800 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-900"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
