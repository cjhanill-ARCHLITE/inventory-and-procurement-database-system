import React, { useEffect, useState } from 'react';
import {
  FileSpreadsheet,
  Plus,
  Search,
  Filter,
  CheckCircle,
  XCircle,
  Clock,
  ArrowRight,
  Eye,
  Trash2,
  AlertCircle,
  ShieldAlert,
  X,
  RefreshCw,
} from 'lucide-react';
import type { PurchaseRequest, InventoryItem, Supplier, User } from '../types.js';
import { api } from '../services/api.js';

interface PurchaseRequestsViewProps {
  currentUser: User | null;
  onNavigate: (tab: string) => void;
  preselectedItem?: any;
}

export const PurchaseRequestsView: React.FC<PurchaseRequestsViewProps> = ({
  currentUser,
  onNavigate,
  preselectedItem,
}) => {
  const [requests, setRequests] = useState<PurchaseRequest[]>([]);
  const [itemsList, setItemsList] = useState<InventoryItem[]>([]);
  const [suppliersList, setSuppliersList] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showApprovalModal, setShowApprovalModal] = useState(false);
  const [showConvertModal, setShowConvertModal] = useState(false);

  const [selectedPR, setSelectedPR] = useState<any>(null);
  const [approvalAction, setApprovalAction] = useState<'approve' | 'reject'>('approve');
  const [approvalRemarks, setApprovalRemarks] = useState('');

  // Convert to PO Form
  const [convertForm, setConvertForm] = useState({
    supplier_id: '',
    expected_delivery_date: '',
    remarks: '',
  });

  // Create PR State (multi-item)
  const [prForm, setPrForm] = useState({
    department: 'Information Technology',
    purpose: '',
    status: 'pending',
    items: [
      {
        item_id: '',
        quantity: 1,
        estimated_unit_cost: 0,
      },
    ],
  });

  const [modalLoading, setModalLoading] = useState(false);
  const [modalError, setModalError] = useState('');
  const [modalSuccess, setModalSuccess] = useState('');

  const loadRequests = async () => {
    try {
      setLoading(true);
      const res = await api.getPurchaseRequests({ search, status: statusFilter });
      if (res.success) setRequests(res.data);
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
    loadRequests();
  }, [search, statusFilter]);

  // If user clicked "Requisition PR" from low stock alert
  useEffect(() => {
    if (preselectedItem) {
      setPrForm({
        department: 'Operations',
        purpose: `Replenishment order for low-stock item: ${preselectedItem.item_name}`,
        status: 'pending',
        items: [
          {
            item_id: String(preselectedItem.item_id),
            quantity: Math.max(10, preselectedItem.reorder_level - preselectedItem.current_stock + 10),
            estimated_unit_cost: Number(preselectedItem.unit_price) || 100,
          },
        ],
      });
      setShowCreateModal(true);
    }
  }, [preselectedItem]);

  // Handle PR Item Row additions
  const handleAddItemRow = () => {
    const firstItem = itemsList[0];
    setPrForm({
      ...prForm,
      items: [
        ...prForm.items,
        {
          item_id: firstItem ? String(firstItem.item_id) : '',
          quantity: 1,
          estimated_unit_cost: firstItem ? Number(firstItem.unit_price) : 0,
        },
      ],
    });
  };

  const handleRemoveItemRow = (idx: number) => {
    if (prForm.items.length <= 1) return;
    setPrForm({
      ...prForm,
      items: prForm.items.filter((_, i) => i !== idx),
    });
  };

  const handleItemChange = (idx: number, field: string, val: any) => {
    const updated = [...prForm.items];
    (updated[idx] as any)[field] = val;

    // Auto-populate estimated unit price when item is selected
    if (field === 'item_id') {
      const selected = itemsList.find(it => String(it.item_id) === String(val));
      if (selected) {
        updated[idx].estimated_unit_cost = Number(selected.unit_price) || 0;
      }
    }

    setPrForm({ ...prForm, items: updated });
  };

  // Submit PR
  const handleCreatePrSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalError('');
    setModalSuccess('');

    // Check item selection
    for (const it of prForm.items) {
      if (!it.item_id) {
        setModalError('Please select a valid item for all rows.');
        return;
      }
    }

    try {
      setModalLoading(true);
      const res = await api.createPurchaseRequest({
        department: prForm.department,
        purpose: prForm.purpose,
        status: prForm.status,
        items: prForm.items.map(it => ({
          item_id: Number(it.item_id),
          quantity: Number(it.quantity),
          estimated_unit_cost: Number(it.estimated_unit_cost),
        })),
      });

      if (res.success) {
        setModalSuccess('Purchase Request created successfully!');
        setTimeout(() => {
          setShowCreateModal(false);
          setModalSuccess('');
          loadRequests();
        }, 1000);
      }
    } catch (err: any) {
      setModalError(err.message || 'Failed to submit purchase request');
    } finally {
      setModalLoading(false);
    }
  };

  // Open Details Modal
  const openDetail = async (pr: PurchaseRequest) => {
    setModalLoading(true);
    setShowDetailModal(true);
    try {
      const res = await api.getPurchaseRequest(pr.request_id);
      if (res.success) setSelectedPR(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setModalLoading(false);
    }
  };

  // Approve / Reject Execution
  const handleApprovalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPR) return;
    setModalError('');

    try {
      setModalLoading(true);
      let res;
      if (approvalAction === 'approve') {
        res = await api.approvePurchaseRequest(selectedPR.request_id, approvalRemarks);
      } else {
        if (!approvalRemarks.trim()) {
          setModalError('Rejection reason is mandatory.');
          setModalLoading(false);
          return;
        }
        res = await api.rejectPurchaseRequest(selectedPR.request_id, approvalRemarks);
      }

      if (res.success) {
        setShowApprovalModal(false);
        setApprovalRemarks('');
        loadRequests();
      }
    } catch (err: any) {
      setModalError(err.message || 'Action failed');
    } finally {
      setModalLoading(false);
    }
  };

  // Convert Approved PR to PO
  const handleConvertSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPR) return;
    setModalError('');

    try {
      setModalLoading(true);
      const res = await api.convertToPurchaseOrder(selectedPR.request_id, {
        supplier_id: Number(convertForm.supplier_id),
        expected_delivery_date: convertForm.expected_delivery_date,
        remarks: convertForm.remarks,
      });

      if (res.success) {
        setShowConvertModal(false);
        loadRequests();
        onNavigate('purchase-orders');
      }
    } catch (err: any) {
      setModalError(err.message || 'Failed to convert PR to PO');
    } finally {
      setModalLoading(false);
    }
  };

  // Status Badge Helper
  const getPrStatusBadge = (status: string) => {
    switch (status) {
      case 'approved':
        return <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-[10px] font-bold text-emerald-800 border border-emerald-200">APPROVED</span>;
      case 'pending':
        return <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-[10px] font-bold text-amber-800 border border-amber-200">PENDING REVIEW</span>;
      case 'converted':
        return <span className="rounded-full bg-blue-100 px-2.5 py-0.5 text-[10px] font-bold text-blue-800 border border-blue-200">CONVERTED TO PO</span>;
      case 'rejected':
        return <span className="rounded-full bg-red-100 px-2.5 py-0.5 text-[10px] font-bold text-red-800 border border-red-200">REJECTED</span>;
      default:
        return <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[10px] font-bold text-slate-700 border border-slate-200">DRAFT</span>;
    }
  };

  const canApprove = currentUser?.role === 'admin' || currentUser?.role === 'approving_officer';
  const canConvert = currentUser?.role === 'admin' || currentUser?.role === 'procurement_officer';

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">Purchase Requests</h2>
          <p className="text-xs text-slate-500">
            Internal procurement requisitions, departmental budget justifications, and approval tracking.
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            const firstItem = itemsList[0];
            setPrForm({
              department: 'General Administration',
              purpose: '',
              status: 'pending',
              items: [
                {
                  item_id: firstItem ? String(firstItem.item_id) : '',
                  quantity: 1,
                  estimated_unit_cost: firstItem ? Number(firstItem.unit_price) : 0,
                },
              ],
            });
            setShowCreateModal(true);
          }}
          className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-blue-700 transition-colors"
        >
          <Plus className="h-4 w-4" />
          <span>New Purchase Request</span>
        </button>
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
              placeholder="Search PR number, justification, requester..."
              className="w-full rounded-lg border border-slate-200 bg-slate-50 py-1.5 pl-8 pr-3 text-xs text-slate-900 focus:border-blue-500 focus:bg-white focus:outline-hidden"
            />
          </div>

          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs text-slate-700 focus:border-blue-500 focus:outline-hidden"
          >
            <option value="all">All Request Statuses</option>
            <option value="pending">Pending Approval</option>
            <option value="approved">Approved</option>
            <option value="converted">Converted to PO</option>
            <option value="rejected">Rejected</option>
            <option value="draft">Drafts</option>
          </select>
        </div>
      </div>

      {/* Requests Table */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-600">
            <thead className="border-b border-slate-200 bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-600">
              <tr>
                <th className="py-3 px-4">Request #</th>
                <th className="py-3 px-4">Date</th>
                <th className="py-3 px-4">Requester & Dept</th>
                <th className="py-3 px-4">Purpose / Justification</th>
                <th className="py-3 px-4 text-center">Items</th>
                <th className="py-3 px-4 text-right">Est. Total</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    <RefreshCw className="mx-auto h-5 w-5 animate-spin text-blue-600 mb-2" />
                    Fetching purchase requests from database...
                  </td>
                </tr>
              ) : requests.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-500">
                    No purchase requests found.
                  </td>
                </tr>
              ) : (
                requests.map(pr => (
                  <tr key={pr.request_id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-4 font-mono font-bold text-blue-700">{pr.request_number}</td>
                    <td className="py-3 px-4 whitespace-nowrap">{new Date(pr.created_at).toLocaleDateString()}</td>
                    <td className="py-3 px-4">
                      <div className="font-semibold text-slate-900">{pr.requester_name}</div>
                      <div className="text-[11px] text-slate-400">{pr.department}</div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="line-clamp-1 max-w-xs text-slate-700">{pr.purpose}</div>
                    </td>
                    <td className="py-3 px-4 text-center font-semibold text-slate-700">{pr.total_items || 1}</td>
                    <td className="py-3 px-4 text-right font-bold text-slate-900">
                      PHP {Number(pr.total_estimated_amount).toFixed(2)}
                    </td>
                    <td className="py-3 px-4 text-center">{getPrStatusBadge(pr.request_status)}</td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => openDetail(pr)}
                          className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                          title="View Details"
                        >
                          <Eye className="h-4 w-4" />
                        </button>

                        {/* Review / Approve Button */}
                        {pr.request_status === 'pending' && canApprove && (
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedPR(pr);
                              setApprovalAction('approve');
                              setApprovalRemarks('');
                              setShowApprovalModal(true);
                            }}
                            className="rounded-md bg-amber-50 px-2 py-1 text-[11px] font-semibold text-amber-800 hover:bg-amber-100 transition-colors"
                          >
                            Review
                          </button>
                        )}

                        {/* Convert to PO Button */}
                        {pr.request_status === 'approved' && canConvert && (
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedPR(pr);
                              setConvertForm({
                                supplier_id: suppliersList[0]?.supplier_id.toString() || '',
                                expected_delivery_date: new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString().split('T')[0],
                                remarks: `Derived from ${pr.request_number}`,
                              });
                              setShowConvertModal(true);
                            }}
                            className="rounded-md bg-blue-50 px-2 py-1 text-[11px] font-semibold text-blue-700 hover:bg-blue-100 flex items-center gap-1 transition-colors"
                          >
                            <span>Convert to PO</span>
                            <ArrowRight className="h-3 w-3" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL 1: CREATE MULTI-ITEM PURCHASE REQUEST */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-2xl rounded-2xl border border-slate-200 bg-white shadow-2xl overflow-hidden max-h-[92vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 px-6 py-4">
              <h3 className="text-sm font-bold text-slate-900">Create Purchase Requisition</h3>
              <button type="button" onClick={() => setShowCreateModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleCreatePrSubmit} className="p-6 overflow-y-auto space-y-4 flex-1">
              {modalError && <div className="rounded-lg bg-red-50 p-2.5 text-xs text-red-700">{modalError}</div>}
              {modalSuccess && <div className="rounded-lg bg-emerald-50 p-2.5 text-xs text-emerald-700">{modalSuccess}</div>}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700">Requesting Department *</label>
                  <input
                    type="text"
                    required
                    value={prForm.department}
                    onChange={e => setPrForm({ ...prForm, department: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-1.5 text-xs text-slate-900 focus:border-blue-500 focus:outline-hidden"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700">Initial Status</label>
                  <select
                    value={prForm.status}
                    onChange={e => setPrForm({ ...prForm, status: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-1.5 text-xs text-slate-900 focus:border-blue-500 focus:outline-hidden"
                  >
                    <option value="pending">Submit Directly for Approval</option>
                    <option value="draft">Save as Draft</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700">Purpose / Justification *</label>
                <textarea
                  rows={2}
                  required
                  value={prForm.purpose}
                  onChange={e => setPrForm({ ...prForm, purpose: e.target.value })}
                  placeholder="State the operational requirement and justification for this requisition..."
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-1.5 text-xs text-slate-900 focus:border-blue-500 focus:outline-hidden"
                />
              </div>

              {/* Multi-Item Line Rows */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-xs font-bold text-slate-900 uppercase tracking-wider">
                    Requested Items
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
                  {prForm.items.map((row, idx) => {
                    const lineTotal = (Number(row.quantity) || 0) * (Number(row.estimated_unit_cost) || 0);
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
                            <option value="">-- Select Catalog Item --</option>
                            {itemsList.map(it => (
                              <option key={it.item_id} value={it.item_id}>
                                [{it.item_code}] {it.item_name} (Current: {it.current_stock} {it.unit_of_measure})
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
                              value={row.estimated_unit_cost}
                              onChange={e => handleItemChange(idx, 'estimated_unit_cost', Number(e.target.value))}
                              className="w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs text-right text-slate-900 focus:border-blue-500 focus:outline-hidden"
                            />
                          </div>

                          <div className="w-24 text-right font-mono font-bold text-xs text-slate-900">
                            PHP {lineTotal.toFixed(2)}
                          </div>

                          <button
                            type="button"
                            disabled={prForm.items.length <= 1}
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
                  Total Estimated Amount: PHP{" "}
                  {prForm.items
                    .reduce((sum, it) => sum + (Number(it.quantity) || 0) * (Number(it.estimated_unit_cost) || 0), 0)
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
                  {modalLoading ? 'Saving...' : 'Submit Request'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: PR DETAILS VIEW */}
      {showDetailModal && selectedPR && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-2xl rounded-2xl border border-slate-200 bg-white shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 px-6 py-4">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Purchase Request Details</h3>
                <span className="font-mono text-xs text-blue-700 font-bold">{selectedPR.request_number}</span>
              </div>
              <button type="button" onClick={() => setShowDetailModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-4 flex-1 text-xs">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200">
                <div>
                  <span className="text-slate-400 block">Requested By</span>
                  <span className="font-semibold text-slate-800">{selectedPR.requester_name}</span>
                </div>
                <div>
                  <span className="text-slate-400 block">Department</span>
                  <span className="font-semibold text-slate-800">{selectedPR.department}</span>
                </div>
                <div>
                  <span className="text-slate-400 block">Date</span>
                  <span className="font-semibold text-slate-800">{new Date(selectedPR.request_date).toLocaleDateString()}</span>
                </div>
                <div>
                  <span className="text-slate-400 block">Status</span>
                  <div className="mt-0.5">{getPrStatusBadge(selectedPR.request_status)}</div>
                </div>
              </div>

              <div>
                <span className="text-slate-500 font-semibold block mb-1">Purpose / Justification:</span>
                <p className="rounded-lg bg-slate-50 p-3 text-slate-700 border border-slate-200 leading-relaxed">
                  {selectedPR.purpose}
                </p>
              </div>

              {selectedPR.approval_remarks && (
                <div className="rounded-lg bg-amber-50/60 p-3 border border-amber-200">
                  <span className="font-semibold text-amber-900 block mb-0.5">
                    Officer Remarks ({selectedPR.approver_name || 'Approver'}):
                  </span>
                  <p className="text-amber-800">{selectedPR.approval_remarks}</p>
                </div>
              )}

              {/* Items Table */}
              <div>
                <span className="font-bold text-slate-900 uppercase tracking-wider block mb-2">Requisition Items</span>
                <div className="rounded-xl border border-slate-200 overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 border-b border-slate-200 text-[10px] uppercase font-bold text-slate-500">
                      <tr>
                        <th className="py-2.5 px-3">Item Code</th>
                        <th className="py-2.5 px-3">Item Name</th>
                        <th className="py-2.5 px-3 text-right">Quantity</th>
                        <th className="py-2.5 px-3 text-right">Est. Unit Cost</th>
                        <th className="py-2.5 px-3 text-right">Line Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {selectedPR.items?.map((it: any) => (
                        <tr key={it.request_item_id} className="hover:bg-slate-50">
                          <td className="py-2 px-3 font-mono font-bold text-slate-800">{it.item_code}</td>
                          <td className="py-2 px-3 font-medium text-slate-900">{it.item_name}</td>
                          <td className="py-2 px-3 text-right font-bold">{it.requested_quantity} {it.unit_of_measure}</td>
                          <td className="py-2 px-3 text-right">PHP {Number(it.estimated_unit_cost).toFixed(2)}</td>
                          <td className="py-2 px-3 text-right font-semibold">PHP {Number(it.estimated_total_cost).toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="mt-3 flex justify-end text-sm font-bold text-slate-900">
                  Total Requisition Amount: PHP {Number(selectedPR.total_estimated_amount).toFixed(2)}
                </div>
              </div>
            </div>

            <div className="flex justify-end border-t border-slate-100 bg-slate-50 px-6 py-3">
              <button
                type="button"
                onClick={() => setShowDetailModal(false)}
                className="rounded-lg bg-slate-800 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-900"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: APPROVE OR REJECT PR (WITH SEPARATION OF DUTIES VERIFICATION) */}
      {showApprovalModal && selectedPR && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Review Purchase Request</h3>
                <span className="font-mono text-xs text-blue-700 font-bold">{selectedPR.request_number}</span>
              </div>
              <button type="button" onClick={() => setShowApprovalModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleApprovalSubmit} className="mt-4 space-y-4">
              {modalError && (
                <div className="flex items-start gap-2 rounded-lg bg-red-50 p-3 text-xs text-red-700 border border-red-200">
                  <ShieldAlert className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>{modalError}</span>
                </div>
              )}

              <div className="rounded-lg bg-slate-50 p-3 text-xs space-y-1">
                <div>
                  <span className="text-slate-400">Requester:</span>{' '}
                  <span className="font-semibold text-slate-800">{selectedPR.requester_name}</span>
                </div>
                <div>
                  <span className="text-slate-400">Department:</span>{' '}
                  <span className="font-semibold text-slate-800">{selectedPR.department}</span>
                </div>
                <div>
                  <span className="text-slate-400">Amount:</span>{' '}
                  <span className="font-bold text-slate-900">PHP {Number(selectedPR.total_estimated_amount).toFixed(2)}</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700">Approval Decision *</label>
                <div className="mt-1.5 grid grid-cols-2 gap-3">
                  <label
                    className={`flex cursor-pointer items-center justify-center gap-2 rounded-lg border p-2.5 text-xs font-semibold transition-all ${
                      approvalAction === 'approve'
                        ? 'border-emerald-500 bg-emerald-50 text-emerald-800'
                        : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <input
                      type="radio"
                      name="decision"
                      checked={approvalAction === 'approve'}
                      onChange={() => setApprovalAction('approve')}
                      className="hidden"
                    />
                    <CheckCircle className="h-4 w-4 text-emerald-600" />
                    <span>Approve Request</span>
                  </label>

                  <label
                    className={`flex cursor-pointer items-center justify-center gap-2 rounded-lg border p-2.5 text-xs font-semibold transition-all ${
                      approvalAction === 'reject'
                        ? 'border-red-500 bg-red-50 text-red-800'
                        : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <input
                      type="radio"
                      name="decision"
                      checked={approvalAction === 'reject'}
                      onChange={() => setApprovalAction('reject')}
                      className="hidden"
                    />
                    <XCircle className="h-4 w-4 text-red-600" />
                    <span>Reject Request</span>
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700">
                  {approvalAction === 'reject' ? 'Mandatory Reason for Rejection *' : 'Approval Remarks / Conditions'}
                </label>
                <textarea
                  rows={2}
                  required={approvalAction === 'reject'}
                  value={approvalRemarks}
                  onChange={e => setApprovalRemarks(e.target.value)}
                  placeholder={
                    approvalAction === 'reject'
                      ? 'Specify reasons (e.g. Budget exceeded, non-compliant specs...)'
                      : 'e.g. Approved under Q4 operations budget allocation...'
                  }
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-1.5 text-xs text-slate-900 focus:border-blue-500 focus:outline-hidden"
                />
              </div>

              <div className="flex justify-end gap-2 border-t border-slate-100 pt-3">
                <button
                  type="button"
                  onClick={() => setShowApprovalModal(false)}
                  className="rounded-lg border border-slate-200 px-3.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={modalLoading}
                  className={`rounded-lg px-4 py-1.5 text-xs font-semibold text-white disabled:opacity-50 ${
                    approvalAction === 'approve' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-red-600 hover:bg-red-700'
                  }`}
                >
                  {modalLoading ? 'Processing...' : approvalAction === 'approve' ? 'Confirm Approval' : 'Confirm Rejection'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 4: CONVERT APPROVED PR TO PURCHASE ORDER */}
      {showConvertModal && selectedPR && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Issue Purchase Order from PR</h3>
                <span className="font-mono text-xs text-blue-700 font-bold">{selectedPR.request_number}</span>
              </div>
              <button type="button" onClick={() => setShowConvertModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleConvertSubmit} className="mt-4 space-y-4">
              {modalError && <div className="rounded-lg bg-red-50 p-2.5 text-xs text-red-700">{modalError}</div>}

              <div>
                <label className="block text-xs font-semibold text-slate-700">Select Awarded Supplier *</label>
                <select
                  required
                  value={convertForm.supplier_id}
                  onChange={e => setConvertForm({ ...convertForm, supplier_id: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-1.5 text-xs text-slate-900 focus:border-blue-500 focus:outline-hidden"
                >
                  <option value="">-- Choose Vendor --</option>
                  {suppliersList.map(s => (
                    <option key={s.supplier_id} value={s.supplier_id}>
                      {s.supplier_name} ({s.contact_person})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700">Expected Delivery Date *</label>
                <input
                  type="date"
                  required
                  value={convertForm.expected_delivery_date}
                  onChange={e => setConvertForm({ ...convertForm, expected_delivery_date: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-1.5 text-xs text-slate-900 focus:border-blue-500 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700">Contract Notes / Terms</label>
                <textarea
                  rows={2}
                  value={convertForm.remarks}
                  onChange={e => setConvertForm({ ...convertForm, remarks: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-1.5 text-xs text-slate-900 focus:border-blue-500 focus:outline-hidden"
                />
              </div>

              <div className="flex justify-end gap-2 border-t border-slate-100 pt-3">
                <button
                  type="button"
                  onClick={() => setShowConvertModal(false)}
                  className="rounded-lg border border-slate-200 px-3.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={modalLoading}
                  className="rounded-lg bg-blue-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {modalLoading ? 'Generating PO...' : 'Issue Purchase Order'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
