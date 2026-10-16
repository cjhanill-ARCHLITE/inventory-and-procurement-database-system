import { Router } from 'express';
import { query, transaction } from '../db.js';
import { authenticateToken, requireRoles, logAudit, type AuthenticatedRequest } from '../middleware/auth.js';
import { validateReceivingQuantities, determinePoReceivingStatus } from '../../lib/inventory-rules.js';

const router = Router();

// GET /api/v1/receiving
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { search } = req.query as any;
    let sql = `
      SELECT 
        rr.*,
        po.po_number,
        s.supplier_name,
        u.full_name as receiver_name,
        COUNT(ri.receiving_item_id) as total_items_received,
        COALESCE(SUM(ri.accepted_quantity), 0) as total_accepted_units,
        COALESCE(SUM(ri.rejected_quantity), 0) as total_rejected_units
      FROM receiving_records rr
      JOIN purchase_orders po ON rr.purchase_order_id = po.purchase_order_id
      JOIN suppliers s ON po.supplier_id = s.supplier_id
      JOIN users u ON rr.received_by = u.user_id
      LEFT JOIN receiving_items ri ON rr.receiving_id = ri.receiving_id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (search && search.trim()) {
      params.push(`%${search.trim()}%`);
      sql += ` AND (rr.receiving_number ILIKE $${params.length} OR rr.delivery_reference ILIKE $${params.length} OR po.po_number ILIKE $${params.length} OR s.supplier_name ILIKE $${params.length})`;
    }

    sql += ` GROUP BY rr.receiving_id, po.po_number, s.supplier_name, u.full_name ORDER BY rr.created_at DESC`;

    const records = await query(sql, params);
    res.json({ success: true, data: records.rows });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/v1/receiving/eligible-pos
router.get('/eligible-pos', authenticateToken, async (_req, res) => {
  try {
    const eligible = await query(`
      SELECT 
        po.purchase_order_id,
        po.po_number,
        po.order_date,
        po.expected_delivery_date,
        po.total_order_amount,
        po.order_status,
        po.receiving_status,
        s.supplier_name,
        s.contact_person
      FROM purchase_orders po
      JOIN suppliers s ON po.supplier_id = s.supplier_id
      WHERE po.order_status IN ('approved', 'ordered', 'partially_received')
        AND po.receiving_status != 'fully_received'
      ORDER BY po.order_date ASC
    `);

    res.json({ success: true, data: eligible.rows });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/v1/receiving/:id
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const recId = Number(req.params.id);
    const recRes = await query(
      `SELECT 
        rr.*,
        po.po_number,
        po.order_date,
        s.supplier_name,
        s.contact_person,
        s.address as supplier_address,
        u.full_name as receiver_name,
        u.email as receiver_email
       FROM receiving_records rr
       JOIN purchase_orders po ON rr.purchase_order_id = po.purchase_order_id
       JOIN suppliers s ON po.supplier_id = s.supplier_id
       JOIN users u ON rr.received_by = u.user_id
       WHERE rr.receiving_id = $1`,
      [recId]
    );

    if (recRes.rowCount === 0) {
      res.status(404).json({ success: false, message: 'Receiving record not found.' });
      return;
    }

    const itemsRes = await query(
      `SELECT 
        ri.*,
        poi.ordered_quantity,
        poi.unit_cost,
        i.item_code,
        i.item_name,
        i.unit_of_measure
       FROM receiving_items ri
       JOIN purchase_order_items poi ON ri.po_item_id = poi.po_item_id
       JOIN items i ON ri.item_id = i.item_id
       WHERE ri.receiving_id = $1`,
      [recId]
    );

    res.json({
      success: true,
      data: {
        ...recRes.rows[0],
        items: itemsRes.rows,
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/v1/receiving
// ATOMIC TRANSACTION: Records delivery, updates PO line received qty, updates stock balances, logs stock transactions
router.post('/', authenticateToken, requireRoles('admin', 'receiving_staff'), async (req: AuthenticatedRequest, res) => {
  try {
    const {
      purchase_order_id,
      delivery_reference,
      receiving_date,
      remarks = '',
      items, // array of { po_item_id, item_id, delivered_quantity, accepted_quantity, rejected_quantity, rejection_reason }
    } = req.body;

    if (!purchase_order_id || !delivery_reference || !items || !Array.isArray(items) || items.length === 0) {
      res.status(400).json({
        success: false,
        message: 'Purchase order ID, delivery reference (e.g. Waybill/Receipt #), and delivered items are required.',
      });
      return;
    }

    const poId = Number(purchase_order_id);
    const poRes = await query('SELECT * FROM purchase_orders WHERE purchase_order_id = $1', [poId]);
    if (poRes.rowCount === 0) {
      res.status(404).json({ success: false, message: 'Purchase order not found.' });
      return;
    }

    const po = poRes.rows[0];
    if (po.order_status === 'cancelled' || po.receiving_status === 'fully_received') {
      res.status(400).json({ success: false, message: `Cannot receive delivery for PO with status '${po.order_status}' / '${po.receiving_status}'.` });
      return;
    }

    // Fetch existing PO items for limit verification
    const poItemsRes = await query('SELECT * FROM purchase_order_items WHERE purchase_order_id = $1', [poId]);
    const poItemMap = new Map<number, any>();
    for (const poi of poItemsRes.rows) {
      poItemMap.set(poi.po_item_id, poi);
    }

    // Validate quantities for all submitted items
    for (const it of items) {
      const poi = poItemMap.get(Number(it.po_item_id));
      if (!poi) {
        res.status(400).json({ success: false, message: `PO Item ID ${it.po_item_id} does not belong to this Purchase Order.` });
        return;
      }

      const delivered = Number(it.delivered_quantity) || (Number(it.accepted_quantity || 0) + Number(it.rejected_quantity || 0));
      const accepted = Number(it.accepted_quantity || 0);
      const rejected = Number(it.rejected_quantity || 0);

      const validation = validateReceivingQuantities(
        Number(poi.ordered_quantity),
        Number(poi.received_quantity),
        delivered,
        accepted,
        rejected
      );

      if (!validation.valid) {
        res.status(400).json({ success: false, message: validation.error });
        return;
      }
    }

    // Generate unique receiving reference number: RCV-YYYY-XXXX
    const year = new Date().getFullYear();
    const countRec = await query('SELECT COUNT(*) as count FROM receiving_records');
    const seq = (Number(countRec.rows[0]?.count || 0) + 1).toString().padStart(4, '0');
    const receivingNumber = `RCV-${year}-${seq}`;

    // Execute atomic transaction
    const result = await transaction(async client => {
      // 1. Insert receiving record
      const recInsert = await client.query(
        `INSERT INTO receiving_records 
          (receiving_number, purchase_order_id, received_by, receiving_date, delivery_reference, remarks)
         VALUES ($1, $2, $3, COALESCE($4, CURRENT_DATE), $5, $6)
         RETURNING *`,
        [receivingNumber, poId, req.user!.userId, receiving_date || null, delivery_reference.trim(), remarks.trim()]
      );
      const recRecord = recInsert.rows[0];

      // 2. Process each receiving item
      for (const it of items) {
        const poItemId = Number(it.po_item_id);
        const itemId = Number(it.item_id);
        const delivered = Number(it.delivered_quantity) || (Number(it.accepted_quantity || 0) + Number(it.rejected_quantity || 0));
        const accepted = Number(it.accepted_quantity || 0);
        const rejected = Number(it.rejected_quantity || 0);
        const reason = it.rejection_reason ? String(it.rejection_reason).trim() : null;

        // Save receiving_items
        await client.query(
          `INSERT INTO receiving_items 
            (receiving_id, po_item_id, item_id, received_quantity, accepted_quantity, rejected_quantity, rejection_reason)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [recRecord.receiving_id, poItemId, itemId, delivered, accepted, rejected, reason]
        );

        // Update purchase_order_items received quantity
        await client.query(
          `UPDATE purchase_order_items 
           SET received_quantity = received_quantity + $1
           WHERE po_item_id = $2`,
          [accepted, poItemId]
        );

        // If accepted > 0, update item current_stock and create stock_transaction ledger entry
        if (accepted > 0) {
          // Get current stock
          const itemRes = await client.query('SELECT current_stock, item_code FROM items WHERE item_id = $1', [itemId]);
          const currentStock = Number(itemRes.rows[0].current_stock);
          const newStock = currentStock + accepted;

          // Update item stock
          await client.query(
            `UPDATE items 
             SET current_stock = $1, updated_at = CURRENT_TIMESTAMP
             WHERE item_id = $2`,
            [newStock, itemId]
          );

          // Generate transaction number
          const txNum = `TXN-RCV-${recRecord.receiving_id}-${itemId}-${Date.now().toString().slice(-4)}`;
          await client.query(
            `INSERT INTO stock_transactions 
              (transaction_number, item_id, user_id, transaction_type, quantity, previous_stock, new_stock, reference_type, reference_id, remarks)
             VALUES ($1, $2, $3, 'purchase_receipt', $4, $5, $6, 'PURCHASE_RECEIPT', $7, $8)`,
            [
              txNum,
              itemId,
              req.user!.userId,
              accepted,
              currentStock,
              newStock,
              receivingNumber,
              `Delivery accepted under PO ${po.po_number} (Ref: ${delivery_reference})`,
            ]
          );
        }
      }

      // 3. Re-evaluate PO overall receiving and order status
      const updatedPoItemsRes = await client.query(
        'SELECT ordered_quantity, received_quantity FROM purchase_order_items WHERE purchase_order_id = $1',
        [poId]
      );
      const newReceivingStatus = determinePoReceivingStatus(updatedPoItemsRes.rows);
      const newOrderStatus = newReceivingStatus === 'fully_received' ? 'fully_received' : 'partially_received';

      await client.query(
        `UPDATE purchase_orders 
         SET receiving_status = $1, order_status = $2, updated_at = CURRENT_TIMESTAMP
         WHERE purchase_order_id = $3`,
        [newReceivingStatus, newOrderStatus, poId]
      );

      return { recRecord, newReceivingStatus };
    });

    await logAudit(
      req.user!.userId,
      'RECORD_DELIVERY',
      'RECEIVING',
      result.recRecord.receiving_number,
      `Recorded delivery for PO ${po.po_number} with DR: ${delivery_reference}`,
      req.ip
    );

    res.status(201).json({
      success: true,
      message: `Delivery receipt ${result.recRecord.receiving_number} recorded successfully. Inventory balances and PO status updated.`,
      data: result.recRecord,
    });
  } catch (err: any) {
    console.error('[Receiving Error]', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

export default router;
