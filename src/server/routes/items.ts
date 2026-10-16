import { Router } from 'express';
import { query, transaction } from '../db.js';
import { authenticateToken, requireRoles, logAudit, type AuthenticatedRequest } from '../middleware/auth.js';
import { calculateStockStatus } from '../../lib/inventory-rules.js';

const router = Router();

// GET /api/v1/items
router.get('/', authenticateToken, async (req, res) => {
  try {
    const {
      search,
      category_id,
      stock_status,
      item_status,
      page = 1,
      limit = 20,
      sort_by = 'item_name',
      sort_order = 'ASC',
    } = req.query as any;

    let baseSql = `
      FROM items i
      JOIN categories c ON i.category_id = c.category_id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (search && search.trim()) {
      params.push(`%${search.trim()}%`);
      baseSql += ` AND (i.item_code ILIKE $${params.length} OR i.item_name ILIKE $${params.length} OR i.description ILIKE $${params.length})`;
    }

    if (category_id && category_id !== 'all') {
      params.push(Number(category_id));
      baseSql += ` AND i.category_id = $${params.length}`;
    }

    if (item_status && item_status !== 'all') {
      params.push(item_status);
      baseSql += ` AND i.item_status = $${params.length}`;
    }

    if (stock_status === 'low') {
      baseSql += ` AND i.current_stock > 0 AND i.current_stock <= i.reorder_level`;
    } else if (stock_status === 'out') {
      baseSql += ` AND i.current_stock <= 0`;
    } else if (stock_status === 'in') {
      baseSql += ` AND i.current_stock > i.reorder_level`;
    }

    // Count
    const countRes = await query(`SELECT COUNT(*) as total ${baseSql}`, params);
    const totalRecords = Number(countRes.rows[0]?.total || 0);

    // Sorting safe fields
    const safeSortCols: Record<string, string> = {
      item_code: 'i.item_code',
      item_name: 'i.item_name',
      category_name: 'c.category_name',
      current_stock: 'i.current_stock',
      reorder_level: 'i.reorder_level',
      unit_price: 'i.unit_price',
      created_at: 'i.created_at',
    };
    const orderCol = safeSortCols[sort_by] || 'i.item_name';
    const orderDir = sort_order?.toUpperCase() === 'DESC' ? 'DESC' : 'ASC';

    const offset = (Number(page) - 1) * Number(limit);
    params.push(Number(limit));
    const limitIdx = params.length;
    params.push(offset);
    const offsetIdx = params.length;

    const dataQuery = `
      SELECT 
        i.item_id,
        i.item_code,
        i.item_name,
        i.description,
        i.category_id,
        c.category_name,
        i.unit_of_measure,
        i.reorder_level,
        i.current_stock,
        i.unit_price,
        i.item_status,
        i.created_at,
        i.updated_at
      ${baseSql}
      ORDER BY ${orderCol} ${orderDir}
      LIMIT $${limitIdx} OFFSET $${offsetIdx}
    `;

    const dataRes = await query(dataQuery, params);

    const items = dataRes.rows.map(item => ({
      ...item,
      computed_stock_status: calculateStockStatus(
        Number(item.current_stock),
        Number(item.reorder_level),
        item.item_status === 'active'
      ),
    }));

    res.json({
      success: true,
      data: items,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        totalRecords,
        totalPages: Math.ceil(totalRecords / Number(limit)),
      },
    });
  } catch (err: any) {
    console.error('[Get Items Error]', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/v1/items/:id
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const itemId = Number(req.params.id);
    const itemRes = await query(
      `SELECT i.*, c.category_name
       FROM items i
       JOIN categories c ON i.category_id = c.category_id
       WHERE i.item_id = $1`,
      [itemId]
    );

    if (itemRes.rowCount === 0) {
      res.status(404).json({ success: false, message: 'Item not found.' });
      return;
    }

    const txRes = await query(
      `SELECT st.*, u.username, u.full_name
       FROM stock_transactions st
       JOIN users u ON st.user_id = u.user_id
       WHERE st.item_id = $1
       ORDER BY st.transaction_date DESC
       LIMIT 50`,
      [itemId]
    );

    const item = itemRes.rows[0];
    res.json({
      success: true,
      data: {
        ...item,
        computed_stock_status: calculateStockStatus(
          Number(item.current_stock),
          Number(item.reorder_level),
          item.item_status === 'active'
        ),
        transactions: txRes.rows,
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/v1/items
router.post('/', authenticateToken, requireRoles('admin', 'inventory_staff'), async (req: AuthenticatedRequest, res) => {
  try {
    const {
      item_code,
      item_name,
      description = '',
      category_id,
      unit_of_measure = 'pcs',
      reorder_level = 10,
      initial_stock = 0,
      unit_price = 0,
    } = req.body;

    if (!item_code || !item_name || !category_id) {
      res.status(400).json({ success: false, message: 'Item code, name, and category are required.' });
      return;
    }

    // Check unique item code
    const existing = await query('SELECT item_id FROM items WHERE LOWER(item_code) = LOWER($1)', [item_code.trim()]);
    if (existing.rowCount > 0) {
      res.status(400).json({ success: false, message: `Item code '${item_code}' is already registered.` });
      return;
    }

    const stock = Math.max(0, Number(initial_stock) || 0);

    const createdItem = await transaction(async client => {
      const insertRes = await client.query(
        `INSERT INTO items 
          (item_code, item_name, description, category_id, unit_of_measure, reorder_level, current_stock, unit_price, item_status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'active')
         RETURNING *`,
        [
          item_code.trim().toUpperCase(),
          item_name.trim(),
          description.trim(),
          Number(category_id),
          unit_of_measure.trim(),
          Math.max(0, Number(reorder_level) || 0),
          stock,
          Math.max(0, Number(unit_price) || 0),
        ]
      );

      const newItem = insertRes.rows[0];

      if (stock > 0) {
        const txNum = `TXN-INIT-${newItem.item_id.toString().padStart(4, '0')}`;
        await client.query(
          `INSERT INTO stock_transactions 
            (transaction_number, item_id, user_id, transaction_type, quantity, previous_stock, new_stock, reference_type, reference_id, remarks)
           VALUES ($1, $2, $3, 'opening_balance', $4, 0, $4, 'INITIAL_RECORD', 'ITEM_CREATE', 'Opening inventory record upon registration')`,
          [txNum, newItem.item_id, req.user!.userId, stock]
        );
      }

      return newItem;
    });

    await logAudit(
      req.user!.userId,
      'CREATE_ITEM',
      'ITEM',
      createdItem.item_code,
      `Registered item ${createdItem.item_name} with initial stock ${stock}`,
      req.ip
    );

    res.status(201).json({
      success: true,
      message: 'Item registered successfully.',
      data: createdItem,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PATCH /api/v1/items/:id
router.patch('/:id', authenticateToken, requireRoles('admin', 'inventory_staff'), async (req: AuthenticatedRequest, res) => {
  try {
    const itemId = Number(req.params.id);
    const { item_name, description, category_id, unit_of_measure, reorder_level, unit_price } = req.body;

    const currentRes = await query('SELECT * FROM items WHERE item_id = $1', [itemId]);
    if (currentRes.rowCount === 0) {
      res.status(404).json({ success: false, message: 'Item not found.' });
      return;
    }

    await query(
      `UPDATE items SET 
        item_name = COALESCE($1, item_name),
        description = COALESCE($2, description),
        category_id = COALESCE($3, category_id),
        unit_of_measure = COALESCE($4, unit_of_measure),
        reorder_level = COALESCE($5, reorder_level),
        unit_price = COALESCE($6, unit_price),
        updated_at = CURRENT_TIMESTAMP
       WHERE item_id = $7`,
      [
        item_name ? item_name.trim() : null,
        description !== undefined ? description : null,
        category_id ? Number(category_id) : null,
        unit_of_measure ? unit_of_measure.trim() : null,
        reorder_level !== undefined ? Number(reorder_level) : null,
        unit_price !== undefined ? Number(unit_price) : null,
        itemId,
      ]
    );

    await logAudit(
      req.user!.userId,
      'UPDATE_ITEM',
      'ITEM',
      String(itemId),
      `Updated details for item ${currentRes.rows[0].item_code}`,
      req.ip
    );

    res.json({ success: true, message: 'Item details updated successfully.' });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PATCH /api/v1/items/:id/status
router.patch('/:id/status', authenticateToken, requireRoles('admin', 'inventory_staff'), async (req: AuthenticatedRequest, res) => {
  try {
    const itemId = Number(req.params.id);
    const { status } = req.body; // 'active' or 'inactive'

    if (!['active', 'inactive'].includes(status)) {
      res.status(400).json({ success: false, message: 'Invalid status.' });
      return;
    }

    await query('UPDATE items SET item_status = $1, updated_at = CURRENT_TIMESTAMP WHERE item_id = $2', [
      status,
      itemId,
    ]);

    await logAudit(
      req.user!.userId,
      'TOGGLE_ITEM_STATUS',
      'ITEM',
      String(itemId),
      `Set status to ${status}`,
      req.ip
    );

    res.json({ success: true, message: `Item marked as ${status}.` });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

export default router;
