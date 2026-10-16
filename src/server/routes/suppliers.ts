import { Router } from 'express';
import { query } from '../db.js';
import { authenticateToken, requireRoles, logAudit, type AuthenticatedRequest } from '../middleware/auth.js';

const router = Router();

// GET /api/v1/suppliers
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { search, status } = req.query as any;
    let sql = `
      SELECT 
        s.*,
        COUNT(po.purchase_order_id) as total_orders,
        COALESCE(SUM(po.total_order_amount), 0) as total_spend
      FROM suppliers s
      LEFT JOIN purchase_orders po ON s.supplier_id = po.supplier_id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (search && search.trim()) {
      params.push(`%${search.trim()}%`);
      sql += ` AND (s.supplier_name ILIKE $${params.length} OR s.contact_person ILIKE $${params.length} OR s.email ILIKE $${params.length})`;
    }

    if (status && status !== 'all') {
      params.push(status);
      sql += ` AND s.supplier_status = $${params.length}`;
    }

    sql += ` GROUP BY s.supplier_id ORDER BY s.supplier_name ASC`;

    const result = await query(sql, params);
    res.json({ success: true, data: result.rows });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/v1/suppliers/:id
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const supplierId = Number(req.params.id);
    const suppRes = await query('SELECT * FROM suppliers WHERE supplier_id = $1', [supplierId]);
    if (suppRes.rowCount === 0) {
      res.status(404).json({ success: false, message: 'Supplier not found.' });
      return;
    }

    const poRes = await query(
      `SELECT po.*, u.username as creator_name
       FROM purchase_orders po
       JOIN users u ON po.created_by = u.user_id
       WHERE po.supplier_id = $1
       ORDER BY po.order_date DESC`,
      [supplierId]
    );

    res.json({
      success: true,
      data: {
        ...suppRes.rows[0],
        purchaseOrders: poRes.rows,
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/v1/suppliers
router.post('/', authenticateToken, requireRoles('admin', 'procurement_officer'), async (req: AuthenticatedRequest, res) => {
  try {
    const { supplier_name, contact_person, contact_number, email, address } = req.body;

    if (!supplier_name || !contact_person || !contact_number || !email || !address) {
      res.status(400).json({ success: false, message: 'All supplier fields are required.' });
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      res.status(400).json({ success: false, message: 'Please provide a valid email address.' });
      return;
    }

    const insertRes = await query(
      `INSERT INTO suppliers (supplier_name, contact_person, contact_number, email, address, supplier_status)
       VALUES ($1, $2, $3, $4, $5, 'active')
       RETURNING *`,
      [supplier_name.trim(), contact_person.trim(), contact_number.trim(), email.trim(), address.trim()]
    );

    await logAudit(
      req.user!.userId,
      'CREATE_SUPPLIER',
      'SUPPLIER',
      String(insertRes.rows[0].supplier_id),
      `Registered supplier ${supplier_name}`,
      req.ip
    );

    res.status(201).json({
      success: true,
      message: 'Supplier registered successfully.',
      data: insertRes.rows[0],
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PATCH /api/v1/suppliers/:id
router.patch('/:id', authenticateToken, requireRoles('admin', 'procurement_officer'), async (req: AuthenticatedRequest, res) => {
  try {
    const supplierId = Number(req.params.id);
    const { supplier_name, contact_person, contact_number, email, address, supplier_status } = req.body;

    const curr = await query('SELECT * FROM suppliers WHERE supplier_id = $1', [supplierId]);
    if (curr.rowCount === 0) {
      res.status(404).json({ success: false, message: 'Supplier not found.' });
      return;
    }

    await query(
      `UPDATE suppliers SET
        supplier_name = COALESCE($1, supplier_name),
        contact_person = COALESCE($2, contact_person),
        contact_number = COALESCE($3, contact_number),
        email = COALESCE($4, email),
        address = COALESCE($5, address),
        supplier_status = COALESCE($6, supplier_status)
       WHERE supplier_id = $7`,
      [
        supplier_name ? supplier_name.trim() : null,
        contact_person ? contact_person.trim() : null,
        contact_number ? contact_number.trim() : null,
        email ? email.trim() : null,
        address ? address.trim() : null,
        supplier_status || null,
        supplierId,
      ]
    );

    await logAudit(
      req.user!.userId,
      'UPDATE_SUPPLIER',
      'SUPPLIER',
      String(supplierId),
      `Updated supplier ${curr.rows[0].supplier_name}`,
      req.ip
    );

    res.json({ success: true, message: 'Supplier updated successfully.' });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PATCH /api/v1/suppliers/:id/status
router.patch('/:id/status', authenticateToken, requireRoles('admin', 'procurement_officer'), async (req: AuthenticatedRequest, res) => {
  try {
    const supplierId = Number(req.params.id);
    const { status } = req.body;

    if (!['active', 'inactive'].includes(status)) {
      res.status(400).json({ success: false, message: 'Invalid status.' });
      return;
    }

    await query('UPDATE suppliers SET supplier_status = $1 WHERE supplier_id = $2', [status, supplierId]);
    await logAudit(
      req.user!.userId,
      'TOGGLE_SUPPLIER_STATUS',
      'SUPPLIER',
      String(supplierId),
      `Set supplier status to ${status}`,
      req.ip
    );

    res.json({ success: true, message: `Supplier marked as ${status}.` });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

export default router;
