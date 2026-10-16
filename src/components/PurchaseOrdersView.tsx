import React, { useEffect, useState } from 'react';
import {
  ShoppingCart,
  Plus,
  Search,
  Filter,
  Eye,
  Printer,
  XCircle,
  Clock,
  CheckCircle2,
  Package,
  Building2,
  X,
  RefreshCw,
  Trash2,
} from 'lucide-react';
import type { PurchaseOrder, InventoryItem, Supplier, User } from '../types.js';
import { api } from '../services/api.js';

interface PurchaseOrdersViewProps {
  currentUser: User | null;
  onNavigate: (tab: string) => void;
}

export const PurchaseOrdersView: React.FC<PurchaseOrdersViewProps> = ({ currentUser, onNavigate }) => {
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [itemsList, setItemsList] = useState<InventoryItem[]>([]);
  const [suppliersList, setSuppliersList] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);

  const [selectedPO, setSelectedPO] = useState<any>(null);
  const [cancelReason, setCancelReason] = useState('');

  // Create PO Form State
  const [poForm, setPoForm] = useState({
    supplier_id: '',
    expected_delivery_date: new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString().split('T')[0],
    remarks: '',
    items: [
      {
        item_id: '',
        quantity: 1,
        unit_cost: 0,
      },
    ],
  });

  const [modalLoading, setModalLoading] = useState(false);
  const [modalError, setModalError] = useState('');

  const loadOrders = async () => {
    try {
      setLoading(true);
      const res = await api.getPurchaseOrders({ search, status: statusFilter });
      if (res.success) setOrders(res.data);
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const loadDependencies = async () => {
    try {
      const [itRes, suppRes] = await Promise.all([
        api.getItems({ limit: 100 }),
        api.getSuppliers({ status: 'active' }),
      ]);
      if (itRes.success) setItemsList(itRes.data);
      if (suppRes.success) setSuppliersList(suppRes.data);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    loadDependencies();
  }, []);

  useEffect(() => {
    loadOrders();
  }, [search, statusFilter]);

  // Open Details Modal
  const openDetail = async (po: PurchaseOrder, isPrint: boolean = false) => {
    setModalLoading(true);
    if (isPrint) setShowPrintModal(true);
    else setShowDetailModal(true);

    try {
      const res = await api.getPurchaseOrder(po.purchase_order_id);
      if (res.success) setSelectedPO(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setModalLoading(false);
    }
  };

  // Add Item Row
  const handleAddItemRow = () => {
    const first = itemsList[0];
    setPoForm({
      ...poForm,
      items: [
        ...poForm.items,
        {
          item_id: first ? String(first.item_id) : '',
          quantity: 1,
          unit_cost: first ? Number(first.unit_price) : 0,
        },
      ],
    });
  };

  const handleRemoveItemRow = (idx: number) => {
    if (poForm.items.length <= 1) return;
    setPoForm({
      ...poForm,
      items: poForm.items.filter((_, i) => i !== idx),
    });
  };

  const handleItemChange = (idx: number, field: string, val: any) => {
    const updated = [...poForm.items];
    (updated[idx] as any)[field] = val;

    if (field === 'item_id') {
      const selected = itemsList.find(it => String(it.item_id) === String(val));
      if (selected) {
        updated[idx].unit_cost = Number(selected.unit_price) || 0;
      }
    }

    setPoForm({ ...poForm, items: updated });
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalError('');

    for (const it of poForm.items) {
      if (!it.item_id) {
        setModalError('Please pick an item for all line rows.');
        return;
      }
    }

    try {
      setModalLoading(true);
      const res = await api.createPurchaseOrder({
        supplier_id: Number(poForm.supplier_id),
        expected_delivery_date: poForm.expected_delivery_date,
        remarks: poForm.remarks,
        items: poForm.items.map(it => ({
          item_id: Number(it.item_id),
          quantity: Number(it.quantity),
          unit_cost: Number(it.unit_cost),
        })),
      });

      if (res.success) {
        setShowCreateModal(false);
        loadOrders();
      }
    } catch (err: any) {
      setModalError(err.message || 'Failed to issue purchase order');
    } finally {
      setModalLoading(false);
    }
  };

  const handleCancelSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPO) return;
    try {
      setModalLoading(true);
      const res = await api.cancelPurchaseOrder(selectedPO.purchase_order_id, cancelReason);
      if (res.success) {
        setShowCancelModal(false);
        setCancelReason('');
        loadOrders();
      }
    } catch (err: any) {
      alert(err.message);
    } finally {
      setModalLoading(false);
    }
  };

  const getOrderStatusBadge = (status: string) => {
    switch (status) {
      case 'fully_received':
        return <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-[10px] font-bold text-emerald-800 border border-emerald-200">FULLY RECEIVED</span>;
      case 'partially_received':
        return <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-[10px] font-bold text-amber-800 border border-amber-200">PARTIAL RECEIPT</span>;
      case 'ordered':
      case 'approved':
        return <span className="rounded-full bg-blue-100 px-2.5 py-0.5 text-[10px] font-bold text-blue-800 border border-blue-200">ORDERED / ACTIVE</span>;
      case 'cancelled':
        return <span className="rounded-full bg-red-100 px-2.5 py-0.5 text-[10px] font-bold text-red-800 border border-red-200">CANCELLED</span>;
      default:
        return <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[10px] font-bold text-slate-700 border border-slate-200">PENDING</span>;
    }
  };

  const canCreate = currentUser?.role === 'admin' || currentUser?.role === 'procurement_officer';

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">Purchase Orders</h2>
          <p className="text-xs text-slate-500">
            Binding supplier purchase contracts, delivery scheduling, and fulfillment tracking.
          </p>
        </div>

        {canCreate && (
          <button
            type="button"
            onClick={() => {
              const firstIt = itemsList[0];
              setPoForm({
                supplier_id: suppliersList[0]?.supplier_id.toString() || '',
                expected_delivery_date: new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString().split('T')[0],
                remarks: '',
                items: [
                  {
                    item_id: firstIt ? String(firstIt.item_id) : '',
                    quantity: 1,
                    unit_cost: firstIt ? Number(firstIt.unit_price) : 0,
                  },
                ],
              });
              setShowCreateModal(true);
            }}
            className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-blue-700 transition-colors"
          >
            <Plus className="h-4 w-4" />
            <span>Issue Direct PO</span>
          </button>
        )}
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-3.5 shadow-2xs">
        <div className="flex flex-1 flex-wrap items-center gap-3">
          <div className="relative min-w-56 flex-1">
            <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search PO number, supplier, notes..."
              className="w-full rounded-lg border border-slate-200 bg-slate-50 py-1.5 pl-8 pr-3 text-xs text-slate-900 focus:border-blue-500 focus:bg-white focus:outline-hidden"
            />
          </div>

          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs text-slate-700 focus:border-blue-500 focus:outline-hidden"
          >
            <option value="all">All Order Statuses</option>
            <option value="ordered">Ordered / Active</option>
            <option value="partially_received">Partially Received</option>
            <option value="fully_received">Fully Received</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-600">
            <thead className="border-b border-slate-200 bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-600">
              <tr>
                <th className="py-3 px-4">PO Number</th>
                <th className="py-3 px-4">Order Date</th>
                <th className="py-3 px-4">Supplier</th>
                <th className="py-3 px-4">Expected Delivery</th>
                <th className="py-3 px-4 text-center">Fulfillment Progress</th>
                <th className="py-3 px-4 text-right">Total Amount</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    <RefreshCw className="mx-auto h-5 w-5 animate-spin text-blue-600 mb-2" />
                    Fetching purchase orders from database...
                  </td>
                </tr>
              ) : orders.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-500">
                    No purchase orders found.
                  </td>
                </tr>
              ) : (
                orders.map(po => {
                  const orderedUnits = Number(po.total_ordered_units || 0);
                  const receivedUnits = Number(po.total_received_units || 0);
                  const pct = orderedUnits > 0 ? Math.min(100, Math.round((receivedUnits / orderedUnits) * 100)) : 0;

                  return (
                    <tr key={po.purchase_order_id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4 font-mono font-bold text-blue-700">{po.po_number}</td>
                      <td className="py-3 px-4 whitespace-nowrap">{new Date(po.order_date).toLocaleDateString()}</td>
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-900">{po.supplier_name}</div>
                        <div className="text-[11px] text-slate-400">{po.contact_person}</div>
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">{new Date(po.expected_delivery_date).toLocaleDateString()}</td>
                      <td className="py-3 px-4">
                        <div className="w-36 mx-auto">
                          <div className="flex items-center justify-between text-[10px] font-semibold text-slate-600 mb-1">
                            <span>{receivedUnits}/{orderedUnits} units</span>
                            <span>{pct}%</span>
                          </div>
                          <div className="h-1.5 w-full rounded-full bg-slate-200 overflow-hidden">
                            <div
                              className={`h-full rounded-full ${pct === 100 ? 'bg-emerald-500' : pct > 0 ? 'bg-amber-500' : 'bg-blue-500'}`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right font-bold text-slate-900">
                        PHP {Number(po.total_order_amount).toFixed(2)}
                      </td>
                      <td className="py-3 px-4 text-center">{getOrderStatusBadge(po.order_status)}</td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => openDetail(po, false)}
                            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                            title="View Order Details"
                          >
                            <Eye className="h-4 w-4" />
                          </button>

                          <button
                            type="button"
                            onClick={() => openDetail(po, true)}
                            className="rounded-lg p-1.5 text-slate-400 hover:bg-blue-50 hover:text-blue-600"
                            title="Print Formal PO Voucher"
                          >
                            <Printer className="h-4 w-4" />
                          </button>

                          {canCreate && !['fully_received', 'cancelled'].includes(po.order_status) && (
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedPO(po);
                                setCancelReason('');
                                setShowCancelModal(true);
                              }}
                              className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
                              title="Cancel PO"
                            >
                              <XCircle className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL 1: CREATE DIRECT PO */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-2xl rounded-2xl border border-slate-200 bg-white shadow-2xl overflow-hidden max-h-[92vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 px-6 py-4">
              <h3 className="text-sm font-bold text-slate-900">Issue Purchase Order</h3>
              <button type="button" onClick={() => setShowCreateModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="p-6 overflow-y-auto space-y-4 flex-1">
              {modalError && <div className="rounded-lg bg-red-50 p-2.5 text-xs text-red-700">{modalError}</div>}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700">Select Supplier *</label>
                  <select
                    required
                    value={poForm.supplier_id}
                    onChange={e => setPoForm({ ...poForm, supplier_id: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-1.5 text-xs text-slate-900 focus:border-blue-500 focus:outline-hidden"
                  >
                    <option value="">-- Choose Vendor --</option>
                    {suppliersList.map(s => (
                      <option key={s.supplier_id} value={s.supplier_id}>
                        {s.supplier_name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700">Expected Delivery Date *</label>
                  <input
                    type="date"
                    required
                    value={poForm.expected_delivery_date}
                    onChange={e => setPoForm({ ...poForm, expected_delivery_date: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-1.5 text-xs text-slate-900 focus:border-blue-500 focus:outline-hidden"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700">Order Notes / Terms</label>
                <textarea
                  rows={2}
                  value={poForm.remarks}
                  onChange={e => setPoForm({ ...poForm, remarks: e.target.value })}
                  placeholder="Terms of delivery, payment, warranty..."
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-1.5 text-xs text-slate-900 focus:border-blue-500 focus:outline-hidden"
                />
              </div>

              {/* Items Table */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-xs font-bold text-slate-900 uppercase tracking-wider">
                    Purchased Items
                  </label>
                  <button
                    type="button"
                    onClick={handleAddItemRow}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-800"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span>Add Item</span>
                  </button>
                </div>

                <div className="space-y-2">
                  {poForm.items.map((row, idx) => {
                    const lineTotal = (Number(row.quantity) || 0) * (Number(row.unit_cost) || 0);
                    return (
                      <div
                        key={idx}
                        className="flex flex-col sm:flex-row sm:items-center gap-2 rounded-xl border border-slate-200 bg-slate-50/50 p-2.5"
                      >
                        <div className="flex-1">
                          <select
                            value={row.item_id}
                            onChange={e => handleItemChange(idx, 'item_id', e.target.value)}
                            className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-900 focus:border-blue-500 focus:outline-hidden"
                          >
                            <option value="">-- Choose Item --</option>
                            {itemsList.map(it => (
                              <option key={it.item_id} value={it.item_id}>
                                [{it.item_code}] {it.item_name}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className="flex items-center gap-2">
                          <div className="w-20">
                            <input
                              type="number"
                              min="1"
                              placeholder="Qty"
                              value={row.quantity}
                              onChange={e => handleItemChange(idx, 'quantity', Math.max(1, Number(e.target.value)))}
                              className="w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs text-right text-slate-900 focus:border-blue-500 focus:outline-hidden"
                            />
                          </div>

                          <div className="w-28">
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              placeholder="Unit Cost"
                              value={row.unit_cost}
                              onChange={e => handleItemChange(idx, 'unit_cost', Number(e.target.value))}
                              className="w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs text-right text-slate-900 focus:border-blue-500 focus:outline-hidden"
                            />
                          </div>

                          <div className="w-24 text-right font-mono font-bold text-xs text-slate-900">
                            ₱{lineTotal.toFixed(2)}
                          </div>

                          <button
                            type="button"
                            disabled={poForm.items.length <= 1}
                            onClick={() => handleRemoveItemRow(idx)}
                            className="p-1 text-slate-400 hover:text-red-600 disabled:opacity-20"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="mt-3 flex justify-end text-sm font-bold text-slate-900">
                  Total Order Amount: ₱
                  {poForm.items
                    .reduce((sum, it) => sum + (Number(it.quantity) || 0) * (Number(it.unit_cost) || 0), 0)
                    .toFixed(2)}
                </div>
              </div>

              <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={modalLoading}
                  className="rounded-lg bg-blue-600 px-5 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {modalLoading ? 'Issuing...' : 'Issue Order'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: PO DETAILS VIEW */}
      {showDetailModal && selectedPO && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-2xl rounded-2xl border border-slate-200 bg-white shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 px-6 py-4">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Purchase Order Details</h3>
                <span className="font-mono text-xs text-blue-700 font-bold">{selectedPO.po_number}</span>
              </div>
              <button type="button" onClick={() => setShowDetailModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-4 flex-1 text-xs">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200">
                <div>
                  <span className="text-slate-400 block">Supplier</span>
                  <span className="font-semibold text-slate-800">{selectedPO.supplier_name}</span>
                </div>
                <div>
                  <span className="text-slate-400 block">Order Date</span>
                  <span className="font-semibold text-slate-800">{new Date(selectedPO.order_date).toLocaleDateString()}</span>
                </div>
                <div>
                  <span className="text-slate-400 block">Expected Delivery</span>
                  <span className="font-semibold text-slate-800">{new Date(selectedPO.expected_delivery_date).toLocaleDateString()}</span>
                </div>
                <div>
                  <span className="text-slate-400 block">Status</span>
                  <div className="mt-0.5">{getOrderStatusBadge(selectedPO.order_status)}</div>
                </div>
              </div>

              {selectedPO.remarks && (
                <div className="rounded-lg bg-slate-50 p-3 text-slate-700 border border-slate-200">
                  <span className="font-semibold text-slate-900 block mb-0.5">Remarks / Contract Terms:</span>
                  {selectedPO.remarks}
                </div>
              )}

              {/* Items with Receiving Status */}
              <div>
                <span className="font-bold text-slate-900 uppercase tracking-wider block mb-2">Line Items Fulfillment</span>
                <div className="rounded-xl border border-slate-200 overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 border-b border-slate-200 text-[10px] uppercase font-bold text-slate-500">
                      <tr>
                        <th className="py-2.5 px-3">Item Code</th>
                        <th className="py-2.5 px-3">Item Name</th>
                        <th className="py-2.5 px-3 text-right">Ordered</th>
                        <th className="py-2.5 px-3 text-right">Received</th>
                        <th className="py-2.5 px-3 text-right">Remaining</th>
                        <th className="py-2.5 px-3 text-right">Unit Cost</th>
                        <th className="py-2.5 px-3 text-right">Line Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {selectedPO.items?.map((it: any) => {
                        const rem = it.ordered_quantity - it.received_quantity;
                        return (
                          <tr key={it.po_item_id} className="hover:bg-slate-50">
                            <td className="py-2 px-3 font-mono font-bold text-slate-800">{it.item_code}</td>
                            <td className="py-2 px-3 font-medium text-slate-900">{it.item_name}</td>
                            <td className="py-2 px-3 text-right font-bold">{it.ordered_quantity}</td>
                            <td className="py-2 px-3 text-right font-bold text-emerald-600">{it.received_quantity}</td>
                            <td className="py-2 px-3 text-right font-bold text-amber-600">{rem}</td>
                            <td className="py-2 px-3 text-right">PHP {Number(it.unit_cost).toFixed(2)}</td>
                            <td className="py-2 px-3 text-right font-semibold">PHP {Number(it.line_total).toFixed(2)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <div className="mt-3 flex justify-end text-sm font-bold text-slate-900">
                  Total Purchase Order Amount: PHP {Number(selectedPO.total_order_amount).toFixed(2)}
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 border-t border-slate-100 bg-slate-50 px-6 py-3">
              <button
                type="button"
                onClick={() => {
                  setShowDetailModal(false);
                  setShowPrintModal(true);
                }}
                className="rounded-lg border border-slate-200 bg-white px-4 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 flex items-center gap-1.5"
              >
                <Printer className="h-3.5 w-3.5" />
                <span>Print Voucher</span>
              </button>
              <button
                type="button"
                onClick={() => setShowDetailModal(false)}
                className="rounded-lg bg-slate-800 px-4 py-1.5 text-xs font-semibold text-white hover:bg-slate-900"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: FORMAL PRINTABLE PO SHEET */}
      {showPrintModal && selectedPO && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-3xl rounded-2xl border border-slate-200 bg-white p-8 shadow-2xl overflow-y-auto max-h-[90vh]">
            <div className="flex items-center justify-between border-b-2 border-slate-900 pb-4">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-900 text-white">
                  <Building2 className="h-7 w-7" />
                </div>
                <div>
                  <h2 className="text-xl font-extrabold tracking-wide text-slate-900">ENTERPRISE IPDS CORP.</h2>
                  <p className="text-xs text-slate-500">Official Purchase Order & Procurement Requisition</p>
                </div>
              </div>

              <div className="text-right">
                <span className="text-xs uppercase tracking-wider text-slate-400 font-bold block">PURCHASE ORDER</span>
                <span className="font-mono text-lg font-extrabold text-blue-900">{selectedPO.po_number}</span>
              </div>
            </div>

            <div className="mt-6 grid grid-cols-2 gap-6 text-xs border-b border-slate-200 pb-6">
              <div>
                <span className="text-slate-400 font-bold uppercase tracking-wider block mb-1">VENDOR DETAILS:</span>
                <div className="text-sm font-bold text-slate-900">{selectedPO.supplier_name}</div>
                <div className="text-slate-600">Attn: {selectedPO.contact_person}</div>
                <div className="text-slate-600">{selectedPO.supplier_address}</div>
                <div className="text-slate-600">Email: {selectedPO.supplier_email}</div>
              </div>

              <div className="text-right space-y-1">
                <div>
                  <span className="text-slate-400">Order Date:</span>{' '}
                  <span className="font-bold text-slate-900">{new Date(selectedPO.order_date).toLocaleDateString()}</span>
                </div>
                <div>
                  <span className="text-slate-400">Expected Delivery:</span>{' '}
                  <span className="font-bold text-slate-900">{new Date(selectedPO.expected_delivery_date).toLocaleDateString()}</span>
                </div>
                <div>
                  <span className="text-slate-400">Issued By:</span>{' '}
                  <span className="font-bold text-slate-900">{selectedPO.creator_name}</span>
                </div>
              </div>
            </div>

            <div className="mt-6">
              <table className="w-full text-left text-xs">
                <thead className="border-b-2 border-slate-900 bg-slate-50 text-[11px] uppercase font-bold text-slate-700">
                  <tr>
                    <th className="py-2.5 px-3">Item Code</th>
                    <th className="py-2.5 px-3">Description</th>
                    <th className="py-2.5 px-3 text-right">Qty</th>
                    <th className="py-2.5 px-3 text-right">Unit Price</th>
                    <th className="py-2.5 px-3 text-right">Total (PHP)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {selectedPO.items?.map((it: any) => (
                    <tr key={it.po_item_id}>
                      <td className="py-2.5 px-3 font-mono font-bold text-slate-800">{it.item_code}</td>
                      <td className="py-2.5 px-3">{it.item_name}</td>
                      <td className="py-2.5 px-3 text-right font-bold">{it.ordered_quantity}</td>
                      <td className="py-2.5 px-3 text-right">PHP {Number(it.unit_cost).toFixed(2)}</td>
                      <td className="py-2.5 px-3 text-right font-bold">PHP {Number(it.line_total).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="mt-4 flex justify-end">
                <div className="w-64 border-t-2 border-slate-900 pt-2 text-right">
                  <div className="flex justify-between text-sm font-extrabold text-slate-900">
                    <span>GRAND TOTAL:</span>
                    <span>PHP {Number(selectedPO.total_order_amount).toFixed(2)}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-8 border-t border-slate-200 pt-6 grid grid-cols-2 gap-12 text-center text-xs text-slate-500">
              <div>
                <div className="h-10 border-b border-slate-300"></div>
                <div className="mt-1 font-semibold text-slate-800">Authorized Procurement Officer</div>
                <div className="text-[10px]">Date Signed</div>
              </div>
              <div>
                <div className="h-10 border-b border-slate-300"></div>
                <div className="mt-1 font-semibold text-slate-800">Vendor Acceptance Confirmation</div>
                <div className="text-[10px]">Date Signed</div>
              </div>
            </div>

            <div className="mt-8 flex justify-end gap-2 border-t border-slate-100 pt-4 print:hidden">
              <button
                type="button"
                onClick={() => window.print()}
                className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700 flex items-center gap-1.5"
              >
                <Printer className="h-4 w-4" />
                <span>Print Document</span>
              </button>
              <button
                type="button"
                onClick={() => setShowPrintModal(false)}
                className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 4: CANCEL PO */}
      {showCancelModal && selectedPO && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-bold text-slate-900">Cancel Purchase Order</h3>
              <button type="button" onClick={() => setShowCancelModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleCancelSubmit} className="mt-4 space-y-4">
              <p className="text-xs text-slate-600 leading-relaxed">
                Are you sure you want to cancel Purchase Order <strong className="text-slate-900 font-mono">{selectedPO.po_number}</strong>?
                This action is audited and cannot be undone.
              </p>

              <div>
                <label className="block text-xs font-semibold text-slate-700">Reason for Cancellation *</label>
                <textarea
                  rows={2}
                  required
                  value={cancelReason}
                  onChange={e => setCancelReason(e.target.value)}
                  placeholder="e.g. Supplier out of stock, contract cancelled..."
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-1.5 text-xs text-slate-900 focus:border-blue-500 focus:outline-hidden"
                />
              </div>

              <div className="flex justify-end gap-2 border-t border-slate-100 pt-3">
                <button
                  type="button"
                  onClick={() => setShowCancelModal(false)}
                  className="rounded-lg border border-slate-200 px-3.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
                >
                  Back
                </button>
                <button
                  type="submit"
                  disabled={modalLoading}
                  className="rounded-lg bg-red-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-50"
                >
                  {modalLoading ? 'Cancelling...' : 'Confirm Cancellation'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
