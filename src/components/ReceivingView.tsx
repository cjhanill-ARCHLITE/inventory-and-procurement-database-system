import React, { useEffect, useState } from 'react';
import {
  PackageCheck,
  Plus,
  Search,
  Eye,
  Printer,
  CheckCircle,
  AlertTriangle,
  FileText,
  Calendar,
  Building2,
  X,
  RefreshCw,
} from 'lucide-react';
import type { ReceivingRecord, PurchaseOrder, User } from '../types.js';
import { api } from '../services/api.js';

interface ReceivingViewProps {
  currentUser: User | null;
  onNavigate: (tab: string) => void;
}

export const ReceivingView: React.FC<ReceivingViewProps> = ({ currentUser, onNavigate }) => {
  const [receivingRecords, setReceivingRecords] = useState<ReceivingRecord[]>([]);
  const [eligiblePOs, setEligiblePOs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Modals
  const [showRecordModal, setShowRecordModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showPrintModal, setShowPrintModal] = useState(false);

  const [selectedRecord, setSelectedRecord] = useState<any>(null);
  const [selectedPOForReceiving, setSelectedPOForReceiving] = useState<any>(null);
  const [notice, setNotice] = useState('');

  // Receiving Form State
  const [deliveryRef, setDeliveryRef] = useState('');
  const [receivingDate, setReceivingDate] = useState(new Date().toISOString().split('T')[0]);
  const [remarks, setRemarks] = useState('');
  const [receivingItems, setReceivingItems] = useState<
    Array<{
      po_item_id: number;
      item_id: number;
      item_code: string;
      item_name: string;
      ordered_quantity: number;
      received_quantity: number;
      remaining_quantity: number;
      delivered_quantity: number;
      accepted_quantity: number;
      rejected_quantity: number;
      rejection_reason: string;
    }>
  >([]);

  const [modalLoading, setModalLoading] = useState(false);
  const [modalError, setModalError] = useState('');

  const loadReceivingData = async () => {
    try {
      setLoading(true);
      const [recRes, eligibleRes] = await Promise.all([
        api.getReceivingRecords({ search }),
        api.getEligiblePOs(),
      ]);

      if (recRes.success) setReceivingRecords(recRes.data);
      if (eligibleRes.success) setEligiblePOs(eligibleRes.data);
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReceivingData();
  }, [search]);

  // When user selects a PO to receive
  const handleSelectPO = async (poId: number) => {
    try {
      setModalLoading(true);
      const res = await api.getPurchaseOrder(poId);
      if (res.success) {
        const po = res.data;
        setSelectedPOForReceiving(po);

        // Prepopulate lines with remaining quantities
        const lines = (po.items || []).map((it: any) => {
          const rem = Math.max(0, it.ordered_quantity - it.received_quantity);
          return {
            po_item_id: it.po_item_id,
            item_id: it.item_id,
            item_code: it.item_code,
            item_name: it.item_name,
            ordered_quantity: it.ordered_quantity,
            received_quantity: it.received_quantity,
            remaining_quantity: rem,
            delivered_quantity: rem,
            accepted_quantity: rem,
            rejected_quantity: 0,
            rejection_reason: '',
          };
        });

        setReceivingItems(lines);
      }
    } catch (err: any) {
      alert(err.message);
    } finally {
      setModalLoading(false);
    }
  };

  const handleLineQtyChange = (
    idx: number,
    field: 'accepted_quantity' | 'rejected_quantity',
    value: number
  ) => {
    const updated = [...receivingItems];
    const val = Math.max(0, Number(value) || 0);
    updated[idx][field] = val;

    // Keep delivered_quantity equal to accepted + rejected
    updated[idx].delivered_quantity = updated[idx].accepted_quantity + updated[idx].rejected_quantity;

    setReceivingItems(updated);
  };

  const handleReasonChange = (idx: number, reason: string) => {
    const updated = [...receivingItems];
    updated[idx].rejection_reason = reason;
    setReceivingItems(updated);
  };

  // Submit Receiving Record
  const handleSubmitReceiving = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalError('');

    if (!selectedPOForReceiving) {
      setModalError('Please select a purchase order.');
      return;
    }

    if (!deliveryRef.trim()) {
      setModalError('Please enter the Delivery Receipt / Waybill reference number.');
      return;
    }

    // Filter items where delivered > 0
    const activeItems = receivingItems.filter(it => it.delivered_quantity > 0);
    if (activeItems.length === 0) {
      setModalError('At least one item must have a delivered quantity greater than zero.');
      return;
    }

    // Validation
    for (const it of activeItems) {
      if (it.accepted_quantity > it.remaining_quantity) {
        setModalError(
          `Accepted quantity (${it.accepted_quantity}) for ${it.item_name} exceeds authorized remaining allowance (${it.remaining_quantity}).`
        );
        return;
      }
      if (it.rejected_quantity > 0 && !it.rejection_reason.trim()) {
        setModalError(`Please specify a reason for rejecting ${it.rejected_quantity} units of ${it.item_name}.`);
        return;
      }
    }

    try {
      setModalLoading(true);
      const res = await api.createReceivingRecord({
        purchase_order_id: selectedPOForReceiving.purchase_order_id,
        delivery_reference: deliveryRef.trim(),
        receiving_date: receivingDate,
        remarks: remarks.trim(),
        items: activeItems.map(it => ({
          po_item_id: it.po_item_id,
          item_id: it.item_id,
          delivered_quantity: it.delivered_quantity,
          accepted_quantity: it.accepted_quantity,
          rejected_quantity: it.rejected_quantity,
          rejection_reason: it.rejection_reason,
        })),
      });

      if (res.success) {
        setShowRecordModal(false);
        setDeliveryRef('');
        setRemarks('');
        setSelectedPOForReceiving(null);
        setReceivingItems([]);
        setNotice(`Success! Delivery receipt ${res.data.receiving_number} recorded. Stock balances updated!`);
        setTimeout(() => setNotice(''), 6000);
        loadReceivingData();
      }
    } catch (err: any) {
      setModalError(err.message || 'Failed to record delivery');
    } finally {
      setModalLoading(false);
    }
  };

  const openDetail = async (rec: ReceivingRecord, isPrint: boolean = false) => {
    setModalLoading(true);
    if (isPrint) setShowPrintModal(true);
    else setShowDetailModal(true);

    try {
      const res = await api.getReceivingRecord(rec.receiving_id);
      if (res.success) setSelectedRecord(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setModalLoading(false);
    }
  };

  const canReceive = currentUser?.role === 'admin' || currentUser?.role === 'receiving_staff';

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">Goods Receiving & Inspection</h2>
          <p className="text-xs text-slate-500">
            Log physical deliveries against approved Purchase Orders, inspect quantities, and update stock ledger.
          </p>
        </div>

        {canReceive && (
          <button
            type="button"
            onClick={() => {
              setSelectedPOForReceiving(null);
              setReceivingItems([]);
              setDeliveryRef('');
              setRemarks('');
              setShowRecordModal(true);
            }}
            className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-emerald-700 transition-colors"
          >
            <Plus className="h-4 w-4" />
            <span>Record Goods Receipt</span>
          </button>
        )}
      </div>

      {notice && (
        <div className="flex items-center gap-2 rounded-xl bg-emerald-50 p-4 text-xs font-semibold text-emerald-800 border border-emerald-200 shadow-2xs">
          <CheckCircle className="h-4 w-4 text-emerald-600 shrink-0" />
          <span>{notice}</span>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-3.5 shadow-2xs">
        <div className="relative min-w-56 flex-1">
          <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search receiving reference #, DR / Waybill, PO number..."
            className="w-full rounded-lg border border-slate-200 bg-slate-50 py-1.5 pl-8 pr-3 text-xs text-slate-900 focus:border-emerald-500 focus:bg-white focus:outline-hidden"
          />
        </div>
      </div>

      {/* Receiving Records Table */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-600">
            <thead className="border-b border-slate-200 bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-600">
              <tr>
                <th className="py-3 px-4">Receipt #</th>
                <th className="py-3 px-4">Receiving Date</th>
                <th className="py-3 px-4">PO Number</th>
                <th className="py-3 px-4">Supplier</th>
                <th className="py-3 px-4">Delivery Ref (DR / Waybill)</th>
                <th className="py-3 px-4 text-center">Accepted Units</th>
                <th className="py-3 px-4 text-center">Rejected Units</th>
                <th className="py-3 px-4">Inspector</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400">
                    <RefreshCw className="mx-auto h-5 w-5 animate-spin text-emerald-600 mb-2" />
                    Fetching receiving records from database...
                  </td>
                </tr>
              ) : receivingRecords.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-500">
                    No delivery records logged yet.
                  </td>
                </tr>
              ) : (
                receivingRecords.map(rec => (
                  <tr key={rec.receiving_id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-4 font-mono font-bold text-emerald-700">{rec.receiving_number}</td>
                    <td className="py-3 px-4 whitespace-nowrap">{new Date(rec.receiving_date).toLocaleDateString()}</td>
                    <td className="py-3 px-4 font-mono font-semibold text-blue-700">{rec.po_number}</td>
                    <td className="py-3 px-4 font-medium text-slate-900">{rec.supplier_name}</td>
                    <td className="py-3 px-4 font-mono text-slate-700">{rec.delivery_reference}</td>
                    <td className="py-3 px-4 text-center font-bold text-emerald-600">
                      +{rec.total_accepted_units || 0}
                    </td>
                    <td className="py-3 px-4 text-center font-bold text-red-600">
                      {rec.total_rejected_units || 0}
                    </td>
                    <td className="py-3 px-4 text-slate-700">{rec.receiver_name}</td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => openDetail(rec, false)}
                          className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                          title="View Details"
                        >
                          <Eye className="h-4 w-4" />
                        </button>

                        <button
                          type="button"
                          onClick={() => openDetail(rec, true)}
                          className="rounded-lg p-1.5 text-slate-400 hover:bg-emerald-50 hover:text-emerald-700"
                          title="Print Receiving Slip"
                        >
                          <Printer className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL 1: RECORD GOODS RECEIPT (THE ATOMIC DELIVERY WORKFLOW) */}
      {showRecordModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-3xl rounded-2xl border border-slate-200 bg-white shadow-2xl overflow-hidden max-h-[92vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 px-6 py-4">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Record Delivery Receipt & Inspection</h3>
                <p className="text-xs text-slate-500">Atomic inventory update: only accepted quantities enter stock ledger.</p>
              </div>
              <button type="button" onClick={() => setShowRecordModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitReceiving} className="p-6 overflow-y-auto space-y-4 flex-1">
              {modalError && <div className="rounded-lg bg-red-50 p-2.5 text-xs text-red-700">{modalError}</div>}

              {/* Select Eligible PO */}
              <div>
                <label className="block text-xs font-semibold text-slate-700">Select Purchase Order Awaiting Goods *</label>
                <select
                  required
                  value={selectedPOForReceiving?.purchase_order_id || ''}
                  onChange={e => handleSelectPO(Number(e.target.value))}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-1.5 text-xs text-slate-900 focus:border-emerald-500 focus:outline-hidden"
                >
                  <option value="">-- Choose Eligible PO --</option>
                  {eligiblePOs.map(po => (
                    <option key={po.purchase_order_id} value={po.purchase_order_id}>
                      {po.po_number} | {po.supplier_name} | Expected: {new Date(po.expected_delivery_date).toLocaleDateString()}
                    </option>
                  ))}
                </select>
              </div>

              {selectedPOForReceiving && (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700">
                        Delivery Receipt / Waybill / DR Number *
                      </label>
                      <input
                        type="text"
                        required
                        value={deliveryRef}
                        onChange={e => setDeliveryRef(e.target.value)}
                        placeholder="e.g. DR-99210-A"
                        className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-1.5 text-xs text-slate-900 uppercase font-mono focus:border-emerald-500 focus:outline-hidden"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700">Delivery Receiving Date *</label>
                      <input
                        type="date"
                        required
                        value={receivingDate}
                        onChange={e => setReceivingDate(e.target.value)}
                        className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-1.5 text-xs text-slate-900 focus:border-emerald-500 focus:outline-hidden"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700">Dock Inspection Notes</label>
                    <textarea
                      rows={2}
                      value={remarks}
                      onChange={e => setRemarks(e.target.value)}
                      placeholder="e.g. Delivered by truck in good packaging; outer carton clean..."
                      className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-1.5 text-xs text-slate-900 focus:border-emerald-500 focus:outline-hidden"
                    />
                  </div>

                  {/* Inspection Line Items */}
                  <div>
                    <span className="block text-xs font-bold uppercase tracking-wider text-slate-900 mb-2">
                      Delivered Items Verification
                    </span>

                    <div className="space-y-3">
                      {receivingItems.map((line, idx) => (
                        <div
                          key={line.po_item_id}
                          className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5 space-y-2.5"
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <span className="font-mono text-xs font-bold text-slate-900">[{line.item_code}]</span>{' '}
                              <span className="text-xs font-semibold text-slate-800">{line.item_name}</span>
                            </div>
                            <div className="text-[11px] text-slate-500">
                              Ordered: <strong className="text-slate-800">{line.ordered_quantity}</strong> | Already Received:{' '}
                              <strong className="text-emerald-700">{line.received_quantity}</strong> | Remaining Allowed:{' '}
                              <strong className="text-amber-700">{line.remaining_quantity}</strong>
                            </div>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            <div>
                              <label className="block text-[11px] font-semibold text-emerald-800">
                                Accepted Quantity (Adds to stock)
                              </label>
                              <input
                                type="number"
                                min="0"
                                max={line.remaining_quantity}
                                value={line.accepted_quantity}
                                onChange={e => handleLineQtyChange(idx, 'accepted_quantity', Number(e.target.value))}
                                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs font-bold text-emerald-700 focus:border-emerald-500 focus:outline-hidden"
                              />
                            </div>

                            <div>
                              <label className="block text-[11px] font-semibold text-red-800">
                                Rejected Quantity (Defective/Damaged)
                              </label>
                              <input
                                type="number"
                                min="0"
                                value={line.rejected_quantity}
                                onChange={e => handleLineQtyChange(idx, 'rejected_quantity', Number(e.target.value))}
                                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs font-bold text-red-700 focus:border-red-500 focus:outline-hidden"
                              />
                            </div>

                            <div>
                              <label className="block text-[11px] font-semibold text-slate-700">Total Delivered</label>
                              <div className="mt-1 py-1 px-2.5 rounded-lg bg-slate-100 font-mono text-xs font-bold text-slate-800 border border-slate-200">
                                {line.delivered_quantity} units
                              </div>
                            </div>
                          </div>

                          {line.rejected_quantity > 0 && (
                            <div>
                              <label className="block text-[11px] font-semibold text-red-700">
                                Mandatory Rejection Reason *
                              </label>
                              <input
                                type="text"
                                required
                                value={line.rejection_reason}
                                onChange={e => handleReasonChange(idx, e.target.value)}
                                placeholder="e.g. Shattered casing, defective power plug, wrong model delivered..."
                                className="mt-1 w-full rounded-lg border border-red-300 bg-white px-2.5 py-1 text-xs text-red-900 focus:border-red-500 focus:outline-hidden"
                              />
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}

              <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
                <button
                  type="button"
                  onClick={() => setShowRecordModal(false)}
                  className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={modalLoading || !selectedPOForReceiving}
                  className="rounded-lg bg-emerald-600 px-5 py-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                >
                  {modalLoading ? 'Recording...' : 'Commit Receiving Record'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: RECEIVING DETAILS VIEW */}
      {showDetailModal && selectedRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-2xl rounded-2xl border border-slate-200 bg-white shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 px-6 py-4">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Delivery Receipt Record</h3>
                <span className="font-mono text-xs text-emerald-700 font-bold">{selectedRecord.receiving_number}</span>
              </div>
              <button type="button" onClick={() => setShowDetailModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-4 flex-1 text-xs">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200">
                <div>
                  <span className="text-slate-400 block">PO Number</span>
                  <span className="font-mono font-bold text-blue-700">{selectedRecord.po_number}</span>
                </div>
                <div>
                  <span className="text-slate-400 block">Supplier</span>
                  <span className="font-semibold text-slate-800">{selectedRecord.supplier_name}</span>
                </div>
                <div>
                  <span className="text-slate-400 block">Delivery Ref</span>
                  <span className="font-mono font-bold text-slate-900">{selectedRecord.delivery_reference}</span>
                </div>
                <div>
                  <span className="text-slate-400 block">Received By</span>
                  <span className="font-semibold text-slate-800">{selectedRecord.receiver_name}</span>
                </div>
              </div>

              {selectedRecord.remarks && (
                <div className="rounded-lg bg-slate-50 p-3 text-slate-700 border border-slate-200">
                  <span className="font-semibold text-slate-900 block mb-0.5">Remarks:</span>
                  {selectedRecord.remarks}
                </div>
              )}

              {/* Items List */}
              <div>
                <span className="font-bold text-slate-900 uppercase tracking-wider block mb-2">Verified Goods</span>
                <div className="rounded-xl border border-slate-200 overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 border-b border-slate-200 text-[10px] uppercase font-bold text-slate-500">
                      <tr>
                        <th className="py-2.5 px-3">Item</th>
                        <th className="py-2.5 px-3 text-right">Delivered</th>
                        <th className="py-2.5 px-3 text-right">Accepted</th>
                        <th className="py-2.5 px-3 text-right">Rejected</th>
                        <th className="py-2.5 px-3">Rejection Reason</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {selectedRecord.items?.map((it: any) => (
                        <tr key={it.receiving_item_id} className="hover:bg-slate-50">
                          <td className="py-2.5 px-3">
                            <span className="font-mono font-bold text-slate-800">[{it.item_code}]</span>{' '}
                            <span className="font-medium text-slate-900">{it.item_name}</span>
                          </td>
                          <td className="py-2.5 px-3 text-right font-bold text-slate-700">{it.received_quantity}</td>
                          <td className="py-2.5 px-3 text-right font-bold text-emerald-600">+{it.accepted_quantity}</td>
                          <td className="py-2.5 px-3 text-right font-bold text-red-600">{it.rejected_quantity}</td>
                          <td className="py-2.5 px-3 text-slate-500">{it.rejection_reason || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
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
                <span>Print Receiving Slip</span>
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

      {/* MODAL 3: FORMAL PRINTABLE RECEIVING SLIP */}
      {showPrintModal && selectedRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-2xl rounded-2xl border border-slate-200 bg-white p-8 shadow-2xl overflow-y-auto max-h-[90vh]">
            <div className="flex items-center justify-between border-b-2 border-slate-900 pb-4">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-800 text-white">
                  <PackageCheck className="h-7 w-7" />
                </div>
                <div>
                  <h2 className="text-xl font-extrabold tracking-wide text-slate-900">ENTERPRISE IPDS CORP.</h2>
                  <p className="text-xs text-slate-500">Official Material Receiving Inspection Slip</p>
                </div>
              </div>

              <div className="text-right">
                <span className="text-xs uppercase tracking-wider text-slate-400 font-bold block">RECEIVING REPORT</span>
                <span className="font-mono text-lg font-extrabold text-emerald-800">{selectedRecord.receiving_number}</span>
              </div>
            </div>

            <div className="mt-6 grid grid-cols-2 gap-4 text-xs border-b border-slate-200 pb-6">
              <div className="space-y-1">
                <div>
                  <span className="text-slate-400">Purchase Order:</span>{' '}
                  <span className="font-mono font-bold text-slate-900">{selectedRecord.po_number}</span>
                </div>
                <div>
                  <span className="text-slate-400">Supplier:</span>{' '}
                  <span className="font-bold text-slate-900">{selectedRecord.supplier_name}</span>
                </div>
                <div>
                  <span className="text-slate-400">Delivery Receipt (DR):</span>{' '}
                  <span className="font-mono font-bold text-slate-900">{selectedRecord.delivery_reference}</span>
                </div>
              </div>

              <div className="text-right space-y-1">
                <div>
                  <span className="text-slate-400">Date Received:</span>{' '}
                  <span className="font-bold text-slate-900">{new Date(selectedRecord.receiving_date).toLocaleDateString()}</span>
                </div>
                <div>
                  <span className="text-slate-400">Receiving Inspector:</span>{' '}
                  <span className="font-bold text-slate-900">{selectedRecord.receiver_name}</span>
                </div>
              </div>
            </div>

            <div className="mt-6">
              <table className="w-full text-left text-xs">
                <thead className="border-b-2 border-slate-900 bg-slate-50 text-[11px] uppercase font-bold text-slate-700">
                  <tr>
                    <th className="py-2.5 px-3">Item Code</th>
                    <th className="py-2.5 px-3">Description</th>
                    <th className="py-2.5 px-3 text-right">Delivered</th>
                    <th className="py-2.5 px-3 text-right">Accepted (Stock In)</th>
                    <th className="py-2.5 px-3 text-right">Rejected</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {selectedRecord.items?.map((it: any) => (
                    <tr key={it.receiving_item_id}>
                      <td className="py-2.5 px-3 font-mono font-bold text-slate-800">{it.item_code}</td>
                      <td className="py-2.5 px-3">{it.item_name}</td>
                      <td className="py-2.5 px-3 text-right font-bold">{it.received_quantity}</td>
                      <td className="py-2.5 px-3 text-right font-bold text-emerald-700">+{it.accepted_quantity}</td>
                      <td className="py-2.5 px-3 text-right font-bold text-red-600">{it.rejected_quantity}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-8 border-t border-slate-200 pt-6 grid grid-cols-2 gap-12 text-center text-xs text-slate-500">
              <div>
                <div className="h-10 border-b border-slate-300"></div>
                <div className="mt-1 font-semibold text-slate-800">Warehouse Receiving Clerk</div>
                <div className="text-[10px]">Signature & Date</div>
              </div>
              <div>
                <div className="h-10 border-b border-slate-300"></div>
                <div className="mt-1 font-semibold text-slate-800">Quality Inspection Officer</div>
                <div className="text-[10px]">Signature & Date</div>
              </div>
            </div>

            <div className="mt-8 flex justify-end gap-2 border-t border-slate-100 pt-4 print:hidden">
              <button
                type="button"
                onClick={() => window.print()}
                className="rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-700 flex items-center gap-1.5"
              >
                <Printer className="h-4 w-4" />
                <span>Print Slip</span>
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
    </div>
  );
};
