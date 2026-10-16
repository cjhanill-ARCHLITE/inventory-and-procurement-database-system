import { Router } from 'express';
import { query, transaction } from '../db.js';
import { authenticateToken, requireRoles, logAudit, type AuthenticatedRequest } from '../middleware/auth.js';
import { validateStockAdjustment } from '../../lib/inventory-rules.js';

const router = Router();

// GET /api/v1/stock-transactions
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { item_id, type, start_date, end_date, search, page = 1, limit = 25 } = req.query as any;
    let sql = `
      SELECT 
        st.*,
        i.item_code,
        i.item_name,
        i.unit_of_measure,
        c.category_name,
        u.full_name as user_full_name,
        u.username
      FROM stock_transactions st
      JOIN items i ON st.item_id = i.item_id
      JOIN categories c ON i.category_id = c.category_id
      JOIN users u ON st.user_id = u.user_id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (item_id && item_id !== 'all') {
      params.push(Number(item_id));
      sql += ` AND st.item_id = $${params.length}`;
    }

    if (type && type !== 'all') {
      params.push(type);
      sql += ` AND st.transaction_type = $${params.length}`;
    }

    if (start_date) {
      params.push(start_date);
      sql += ` AND st.transaction_date >= $${params.length}`;
    }

    if (end_date) {
      params.push(end_date);
      sql += ` AND st.transaction_date <= $${params.length}`;
    }

    if (search && search.trim()) {
      params.push(`%${search.trim()}%`);
      sql += ` AND (st.transaction_number ILIKE $${params.length} OR i.item_name ILIKE $${params.length} OR i.item_code ILIKE $${params.length} OR st.remarks ILIKE $${params.length})`;
    }

    // Count
    const countRes = await query(`SELECT COUNT(*) as total FROM (${sql}) as sub`, params);
    const totalRecords = Number(countRes.rows[0]?.total || 0);

    const offset = (Number(page) - 1) * Number(limit);
    params.push(Number(limit));
    const limitIdx = params.length;
    params.push(offset);
    const offsetIdx = params.length;

    sql += ` ORDER BY st.transaction_date DESC LIMIT $${limitIdx} OFFSET $${offsetIdx}`;

    const dataRes = await query(sql, params);

    res.json({
      success: true,
      data: dataRes.rows,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        totalRecords,
        totalPages: Math.ceil(totalRecords / Number(limit)),
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/v1/stock-transactions/adjustments
router.post('/adjustments', authenticateToken, requireRoles('admin', 'inventory_staff'), async (req: AuthenticatedRequest, res) => {
  try {
    const { item_id, adjustment_type, quantity, reason } = req.body;

    if (!item_id || !adjustment_type || !quantity || !reason || !reason.trim()) {
      res.status(400).json({
        success: false,
        message: 'Item, adjustment type (increase/decrease), quantity, and mandatory reason are required.',
      });
      return;
    }

    const qty = Math.max(1, Number(quantity) || 1);
    const type = adjustment_type === 'decrease' ? 'decrease' : 'increase';

    const itemRes = await query('SELECT * FROM items WHERE item_id = $1', [Number(item_id)]);
    if (itemRes.rowCount === 0) {
      res.status(404).json({ success: false, message: 'Item not found.' });
      return;
    }

    const item = itemRes.rows[0];
    const currentStock = Number(item.current_stock);

    const validation = validateStockAdjustment(currentStock, qty, type);
    if (!validation.valid) {
      res.status(400).json({ success: false, message: validation.error });
      return;
    }

    const signedQuantity = type === 'increase' ? qty : -qty;
    const newStock = validation.newStock;

    const countTx = await query('SELECT COUNT(*) as count FROM stock_transactions');
    const seq = (Number(countTx.rows[0]?.count || 0) + 1).toString().padStart(4, '0');
    const txNum = `TXN-ADJ-${Date.now().toString().slice(-4)}-${seq}`;

    await transaction(async client => {
      // 1. Update item stock
      await client.query(
        'UPDATE items SET current_stock = $1, updated_at = CURRENT_TIMESTAMP WHERE item_id = $2',
        [newStock, item.item_id]
      );

      // 2. Insert transaction ledger entry
      await client.query(
        `INSERT INTO stock_transactions 
          (transaction_number, item_id, user_id, transaction_type, quantity, previous_stock, new_stock, reference_type, reference_id, remarks)
         VALUES ($1, $2, $3, 'adjustment', $4, $5, $6, 'MANUAL_ADJUSTMENT', $7, $8)`,
        [
          txNum,
          item.item_id,
          req.user!.userId,
          signedQuantity,
          currentStock,
          newStock,
          req.user!.username,
          reason.trim(),
        ]
      );
    });

    await logAudit(
      req.user!.userId,
      'STOCK_ADJUSTMENT',
      'ITEM',
      item.item_code,
      `Manual stock adjustment (${type} by ${qty}) for ${item.item_name}. Reason: ${reason.trim()}`,
      req.ip
    );

    res.status(201).json({
      success: true,
      message: `Stock for ${item.item_name} adjusted to ${newStock} units. Transaction logged in ledger.`,
      data: {
        item_id: item.item_id,
        item_name: item.item_name,
        previous_stock: currentStock,
        new_stock: newStock,
        transaction_number: txNum,
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

export default router;
