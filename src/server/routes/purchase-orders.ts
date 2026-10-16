import { Router } from 'express';
import { query, transaction } from '../db.js';
import { authenticateToken, requireRoles, logAudit, type AuthenticatedRequest } from '../middleware/auth.js';
import { calculateLineTotal } from '../../lib/inventory-rules.js';

const router = Router();

// GET /api/v1/purchase-orders
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { status, supplier_id, search } = req.query as any;
    let sql = `
      SELECT 
        po.*,
        s.supplier_name,
        s.contact_person,
        s.email as supplier_email,
        u.full_name as creator_name,
        COUNT(poi.po_item_id) as total_items,
        COALESCE(SUM(poi.ordered_quantity), 0) as total_ordered_units,
        COALESCE(SUM(poi.received_quantity), 0) as total_received_units
      FROM purchase_orders po
      JOIN suppliers s ON po.supplier_id = s.supplier_id
      JOIN users u ON po.created_by = u.user_id
      LEFT JOIN purchase_order_items poi ON po.purchase_order_id = poi.purchase_order_id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (status && status !== 'all') {
      params.push(status);
      sql += ` AND po.order_status = $${params.length}`;
    }

    if (supplier_id && supplier_id !== 'all') {
      params.push(Number(supplier_id));
      sql += ` AND po.supplier_id = $${params.length}`;
    }

    if (search && search.trim()) {
      params.push(`%${search.trim()}%`);
      sql += ` AND (po.po_number ILIKE $${params.length} OR s.supplier_name ILIKE $${params.length} OR po.remarks ILIKE $${params.length})`;
    }

    sql += ` GROUP BY po.purchase_order_id, s.supplier_name, s.contact_person, s.email, u.full_name ORDER BY po.created_at DESC`;

    const poRes = await query(sql, params);
    res.json({ success: true, data: poRes.rows });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/v1/purchase-orders/:id
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const poId = Number(req.params.id);
    const poRes = await query(
      `SELECT po.*, 
        s.supplier_name, s.contact_person, s.contact_number, s.email as supplier_email, s.address as supplier_address,
        u.full_name as creator_name, u.email as creator_email,
        appr.full_name as approver_name
       FROM purchase_orders po
       JOIN suppliers s ON po.supplier_id = s.supplier_id
       JOIN users u ON po.created_by = u.user_id
       LEFT JOIN users appr ON po.approved_by = appr.user_id
       WHERE po.purchase_order_id = $1`,
      [poId]
    );

    if (poRes.rowCount === 0) {
      res.status(404).json({ success: false, message: 'Purchase order not found.' });
      return;
    }

    const itemsRes = await query(
      `SELECT poi.*, i.item_code, i.item_name, i.unit_of_measure, i.current_stock
       FROM purchase_order_items poi
       JOIN items i ON poi.item_id = i.item_id
       WHERE poi.purchase_order_id = $1`,
      [poId]
    );

    const recRes = await query(
      `SELECT rr.*, u.full_name as receiver_name
       FROM receiving_records rr
       JOIN users u ON rr.received_by = u.user_id
       WHERE rr.purchase_order_id = $1
       ORDER BY rr.receiving_date DESC`,
      [poId]
    );

    res.json({
      success: true,
      data: {
        ...poRes.rows[0],
        items: itemsRes.rows,
        receivingRecords: recRes.rows,
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/v1/purchase-orders (Direct PO creation)
router.post('/', authenticateToken, requireRoles('admin', 'procurement_officer'), async (req: AuthenticatedRequest, res) => {
  try {
    const { supplier_id, expected_delivery_date, items, remarks = '' } = req.body;

    if (!supplier_id || !expected_delivery_date || !items || !Array.isArray(items) || items.length === 0) {
      res.status(400).json({ success: false, message: 'Supplier, expected delivery date, and items are required.' });
      return;
    }

    // Verify supplier is active
    const supp = await query('SELECT supplier_id, supplier_status FROM suppliers WHERE supplier_id = $1', [Number(supplier_id)]);
    if (supp.rowCount === 0 || supp.rows[0].supplier_status !== 'active') {
      res.status(400).json({ success: false, message: 'Selected supplier is not active or does not exist.' });
      return;
    }

    const year = new Date().getFullYear();
    const countPo = await query('SELECT COUNT(*) as count FROM purchase_orders');
    const seq = (Number(countPo.rows[0]?.count || 0) + 1).toString().padStart(4, '0');
    const poNumber = `PO-${year}-${seq}`;

    let totalAmount = 0;
    const validatedItems: Array<{ itemId: number; quantity: number; cost: number; lineTotal: number }> = [];

    for (const item of items) {
      const q = Math.max(1, Number(item.quantity) || 1);
      const c = Math.max(0, Number(item.unit_cost) || 0);
      const lineTot = calculateLineTotal(q, c);
      totalAmount += lineTot;
      validatedItems.push({
        itemId: Number(item.item_id),
        quantity: q,
        cost: c,
        lineTotal: lineTot,
      });
    }

    const createdPO = await transaction(async client => {
      const poInsert = await client.query(
        `INSERT INTO purchase_orders 
          (po_number, supplier_id, created_by, expected_delivery_date, total_order_amount, order_status, receiving_status, remarks)
         VALUES ($1, $2, $3, $4, $5, 'ordered', 'pending', $6)
         RETURNING *`,
        [poNumber, Number(supplier_id), req.user!.userId, expected_delivery_date, totalAmount, remarks.trim()]
      );

      const po = poInsert.rows[0];

      for (const it of validatedItems) {
        await client.query(
          `INSERT INTO purchase_order_items 
            (purchase_order_id, item_id, ordered_quantity, received_quantity, unit_cost, line_total)
           VALUES ($1, $2, $3, 0, $4, $5)`,
          [po.purchase_order_id, it.itemId, it.quantity, it.cost, it.lineTotal]
        );
      }

      return po;
    });

    await logAudit(
      req.user!.userId,
      'CREATE_PURCHASE_ORDER',
      'PURCHASE_ORDER',
      createdPO.po_number,
      `Issued PO to supplier ID ${supplier_id} with amount ₱${totalAmount.toFixed(2)}`,
      req.ip
    );

    res.status(201).json({
      success: true,
      message: `Purchase Order ${createdPO.po_number} created successfully.`,
      data: createdPO,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/v1/purchase-orders/:id/cancel
router.post('/:id/cancel', authenticateToken, requireRoles('admin', 'procurement_officer'), async (req: AuthenticatedRequest, res) => {
  try {
    const poId = Number(req.params.id);
    const { reason = '' } = req.body;

    const poRes = await query('SELECT * FROM purchase_orders WHERE purchase_order_id = $1', [poId]);
    if (poRes.rowCount === 0) {
      res.status(404).json({ success: false, message: 'Purchase order not found.' });
      return;
    }

    const po = poRes.rows[0];
    if (['fully_received', 'cancelled'].includes(po.order_status)) {
      res.status(400).json({ success: false, message: `Cannot cancel an order that is '${po.order_status}'.` });
      return;
    }

    await query(
      `UPDATE purchase_orders SET 
        order_status = 'cancelled',
        remarks = COALESCE(remarks, '') || ' [Cancelled: ' || $1 || ']',
        updated_at = CURRENT_TIMESTAMP
       WHERE purchase_order_id = $2`,
      [reason || 'Administrative cancellation', poId]
    );

    await logAudit(
      req.user!.userId,
      'CANCEL_PURCHASE_ORDER',
      'PURCHASE_ORDER',
      po.po_number,
      `Cancelled PO: ${reason}`,
      req.ip
    );

    res.json({ success: true, message: `Purchase Order ${po.po_number} has been cancelled.` });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

export default router;
