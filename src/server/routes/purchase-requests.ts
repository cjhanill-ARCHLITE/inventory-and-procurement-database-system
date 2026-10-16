import { Router } from 'express';
import { query, transaction } from '../db.js';
import { authenticateToken, requireRoles, logAudit, type AuthenticatedRequest } from '../middleware/auth.js';
import { validateApprovalPermission, calculateLineTotal } from '../../lib/inventory-rules.js';

const router = Router();

// GET /api/v1/purchase-requests
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { status, search } = req.query as any;
    let sql = `
      SELECT 
        pr.*,
        u.full_name as requester_name,
        u.username as requester_username,
        appr.full_name as approver_name,
        COUNT(pri.request_item_id) as total_items
      FROM purchase_requests pr
      JOIN users u ON pr.requested_by = u.user_id
      LEFT JOIN users appr ON pr.approved_by = appr.user_id
      LEFT JOIN purchase_request_items pri ON pr.request_id = pri.request_id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (status && status !== 'all') {
      params.push(status);
      sql += ` AND pr.request_status = $${params.length}`;
    }

    if (search && search.trim()) {
      params.push(`%${search.trim()}%`);
      sql += ` AND (pr.request_number ILIKE $${params.length} OR pr.purpose ILIKE $${params.length} OR pr.department ILIKE $${params.length} OR u.full_name ILIKE $${params.length})`;
    }

    sql += ` GROUP BY pr.request_id, u.full_name, u.username, appr.full_name ORDER BY pr.created_at DESC`;

    const prRes = await query(sql, params);
    res.json({ success: true, data: prRes.rows });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/v1/purchase-requests/:id
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const prId = Number(req.params.id);
    const prRes = await query(
      `SELECT pr.*, 
        u.full_name as requester_name, u.email as requester_email, u.username as requester_username,
        appr.full_name as approver_name
       FROM purchase_requests pr
       JOIN users u ON pr.requested_by = u.user_id
       LEFT JOIN users appr ON pr.approved_by = appr.user_id
       WHERE pr.request_id = $1`,
      [prId]
    );

    if (prRes.rowCount === 0) {
      res.status(404).json({ success: false, message: 'Purchase request not found.' });
      return;
    }

    const itemsRes = await query(
      `SELECT pri.*, i.item_code, i.item_name, i.unit_of_measure, i.current_stock
       FROM purchase_request_items pri
       JOIN items i ON pri.item_id = i.item_id
       WHERE pri.request_id = $1`,
      [prId]
    );

    res.json({
      success: true,
      data: {
        ...prRes.rows[0],
        items: itemsRes.rows,
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/v1/purchase-requests
router.post('/', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const { department, purpose, items, status = 'pending' } = req.body;

    if (!department || !purpose || !items || !Array.isArray(items) || items.length === 0) {
      res.status(400).json({ success: false, message: 'Department, purpose, and at least one item are required.' });
      return;
    }

    // Generate unique PR number: PR-YYYY-XXXX
    const year = new Date().getFullYear();
    const countRes = await query('SELECT COUNT(*) as count FROM purchase_requests');
    const seq = (Number(countRes.rows[0]?.count || 0) + 1).toString().padStart(4, '0');
    const prNumber = `PR-${year}-${seq}`;

    // Calculate total on server
    let totalEstimated = 0;
    const validatedItems: Array<{ itemId: number; quantity: number; cost: number; lineTotal: number }> = [];

    for (const item of items) {
      const q = Math.max(1, Number(item.quantity) || 1);
      const c = Math.max(0, Number(item.estimated_unit_cost) || 0);
      const lineTotal = calculateLineTotal(q, c);
      totalEstimated += lineTotal;
      validatedItems.push({
        itemId: Number(item.item_id),
        quantity: q,
        cost: c,
        lineTotal,
      });
    }

    const initialStatus = status === 'draft' ? 'draft' : 'pending';

    const createdPR = await transaction(async client => {
      const prInsert = await client.query(
        `INSERT INTO purchase_requests 
          (request_number, requested_by, department, purpose, total_estimated_amount, request_status)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING *`,
        [prNumber, req.user!.userId, department.trim(), purpose.trim(), totalEstimated, initialStatus]
      );

      const pr = prInsert.rows[0];

      for (const it of validatedItems) {
        await client.query(
          `INSERT INTO purchase_request_items 
            (request_id, item_id, requested_quantity, estimated_unit_cost, estimated_total_cost)
           VALUES ($1, $2, $3, $4, $5)`,
          [pr.request_id, it.itemId, it.quantity, it.cost, it.lineTotal]
        );
      }

      return pr;
    });

    await logAudit(
      req.user!.userId,
      'CREATE_PURCHASE_REQUEST',
      'PURCHASE_REQUEST',
      createdPR.request_number,
      `Submitted PR for department ${department} with total ₱${totalEstimated.toFixed(2)}`,
      req.ip
    );

    // Notify approvers if pending
    if (initialStatus === 'pending') {
      await query(
        `INSERT INTO notifications (title, message, type)
         VALUES ('New Purchase Request', $1, 'approval_pending')`,
        [`Purchase Request ${createdPR.request_number} requires review.`]
      );
    }

    res.status(201).json({
      success: true,
      message: 'Purchase request created successfully.',
      data: createdPR,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/v1/purchase-requests/:id/approve
router.post('/:id/approve', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const prId = Number(req.params.id);
    const { remarks = '' } = req.body;

    const prRes = await query('SELECT * FROM purchase_requests WHERE request_id = $1', [prId]);
    if (prRes.rowCount === 0) {
      res.status(404).json({ success: false, message: 'Purchase request not found.' });
      return;
    }

    const pr = prRes.rows[0];

    // Separation of duties and role authorization check
    const perm = validateApprovalPermission(pr.requested_by, req.user!.userId, req.user!.role);
    if (!perm.allowed) {
      res.status(403).json({ success: false, message: perm.reason });
      return;
    }

    if (pr.request_status !== 'pending') {
      res.status(400).json({ success: false, message: `Cannot approve request in '${pr.request_status}' status.` });
      return;
    }

    await query(
      `UPDATE purchase_requests SET
        request_status = 'approved',
        approved_by = $1,
        approval_date = CURRENT_TIMESTAMP,
        approval_remarks = $2,
        updated_at = CURRENT_TIMESTAMP
       WHERE request_id = $3`,
      [req.user!.userId, remarks ? remarks.trim() : 'Approved by authorized officer', prId]
    );

    await logAudit(
      req.user!.userId,
      'APPROVE_PURCHASE_REQUEST',
      'PURCHASE_REQUEST',
      pr.request_number,
      `Approved PR: ${remarks || 'Standard approval'}`,
      req.ip
    );

    await query(
      `INSERT INTO notifications (user_id, title, message, type)
       VALUES ($1, 'PR Approved', $2, 'status_update')`,
      [pr.requested_by, `Your purchase request ${pr.request_number} has been approved.`]
    );

    res.json({ success: true, message: `Purchase request ${pr.request_number} has been approved.` });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/v1/purchase-requests/:id/reject
router.post('/:id/reject', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const prId = Number(req.params.id);
    const { remarks } = req.body;

    if (!remarks || !remarks.trim()) {
      res.status(400).json({ success: false, message: 'Rejection reason is required.' });
      return;
    }

    const prRes = await query('SELECT * FROM purchase_requests WHERE request_id = $1', [prId]);
    if (prRes.rowCount === 0) {
      res.status(404).json({ success: false, message: 'Purchase request not found.' });
      return;
    }

    const pr = prRes.rows[0];
    const perm = validateApprovalPermission(pr.requested_by, req.user!.userId, req.user!.role);
    if (!perm.allowed) {
      res.status(403).json({ success: false, message: perm.reason });
      return;
    }

    await query(
      `UPDATE purchase_requests SET
        request_status = 'rejected',
        approved_by = $1,
        approval_date = CURRENT_TIMESTAMP,
        approval_remarks = $2,
        updated_at = CURRENT_TIMESTAMP
       WHERE request_id = $3`,
      [req.user!.userId, remarks.trim(), prId]
    );

    await logAudit(
      req.user!.userId,
      'REJECT_PURCHASE_REQUEST',
      'PURCHASE_REQUEST',
      pr.request_number,
      `Rejected PR: ${remarks.trim()}`,
      req.ip
    );

    await query(
      `INSERT INTO notifications (user_id, title, message, type)
       VALUES ($1, 'PR Rejected', $2, 'status_update')`,
      [pr.requested_by, `Your purchase request ${pr.request_number} was rejected: ${remarks.trim()}`]
    );

    res.json({ success: true, message: `Purchase request ${pr.request_number} has been rejected.` });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/v1/purchase-requests/:id/convert-to-po
router.post('/:id/convert-to-po', authenticateToken, requireRoles('admin', 'procurement_officer'), async (req: AuthenticatedRequest, res) => {
  try {
    const prId = Number(req.params.id);
    const { supplier_id, expected_delivery_date, remarks = '' } = req.body;

    if (!supplier_id || !expected_delivery_date) {
      res.status(400).json({ success: false, message: 'Supplier and expected delivery date are required.' });
      return;
    }

    const prRes = await query('SELECT * FROM purchase_requests WHERE request_id = $1', [prId]);
    if (prRes.rowCount === 0) {
      res.status(404).json({ success: false, message: 'Purchase request not found.' });
      return;
    }

    const pr = prRes.rows[0];
    if (pr.request_status !== 'approved') {
      res.status(400).json({ success: false, message: 'Only approved purchase requests can be converted into purchase orders.' });
      return;
    }

    const prItemsRes = await query('SELECT * FROM purchase_request_items WHERE request_id = $1', [prId]);
    if (prItemsRes.rowCount === 0) {
      res.status(400).json({ success: false, message: 'Purchase request has no items to order.' });
      return;
    }

    // Generate PO Number: PO-YYYY-XXXX
    const year = new Date().getFullYear();
    const countPo = await query('SELECT COUNT(*) as count FROM purchase_orders');
    const seq = (Number(countPo.rows[0]?.count || 0) + 1).toString().padStart(4, '0');
    const poNumber = `PO-${year}-${seq}`;

    const newPO = await transaction(async client => {
      let totalAmount = 0;
      for (const it of prItemsRes.rows) {
        totalAmount += calculateLineTotal(it.requested_quantity, it.estimated_unit_cost);
      }

      const poInsert = await client.query(
        `INSERT INTO purchase_orders 
          (po_number, supplier_id, request_id, created_by, expected_delivery_date, total_order_amount, order_status, receiving_status, remarks)
         VALUES ($1, $2, $3, $4, $5, $6, 'ordered', 'pending', $7)
         RETURNING *`,
        [poNumber, Number(supplier_id), prId, req.user!.userId, expected_delivery_date, totalAmount, remarks.trim() || `Generated from ${pr.request_number}`]
      );

      const po = poInsert.rows[0];

      for (const it of prItemsRes.rows) {
        const lineTot = calculateLineTotal(it.requested_quantity, it.estimated_unit_cost);
        await client.query(
          `INSERT INTO purchase_order_items 
            (purchase_order_id, item_id, ordered_quantity, received_quantity, unit_cost, line_total)
           VALUES ($1, $2, $3, 0, $4, $5)`,
          [po.purchase_order_id, it.item_id, it.requested_quantity, it.estimated_unit_cost, lineTot]
        );
      }

      // Mark PR as converted
      await client.query(`UPDATE purchase_requests SET request_status = 'converted' WHERE request_id = $1`, [prId]);

      return po;
    });

    await logAudit(
      req.user!.userId,
      'CONVERT_PR_TO_PO',
      'PURCHASE_ORDER',
      newPO.po_number,
      `Converted PR ${pr.request_number} to Purchase Order ${newPO.po_number}`,
      req.ip
    );

    res.status(201).json({
      success: true,
      message: `Purchase Order ${newPO.po_number} created successfully from ${pr.request_number}.`,
      data: newPO,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

export default router;
