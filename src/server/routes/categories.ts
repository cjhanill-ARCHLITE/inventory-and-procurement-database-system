import { Router } from 'express';
import { query } from '../db.js';
import { authenticateToken, requireRoles, logAudit, type AuthenticatedRequest } from '../middleware/auth.js';

const router = Router();

// GET /api/v1/categories
router.get('/', authenticateToken, async (_req, res) => {
  try {
    const catsRes = await query(`
      SELECT 
        c.category_id,
        c.category_name,
        c.description,
        c.is_active,
        c.created_at,
        COUNT(i.item_id) as item_count,
        COALESCE(SUM(i.current_stock), 0) as total_stock
      FROM categories c
      LEFT JOIN items i ON c.category_id = i.category_id
      GROUP BY c.category_id, c.category_name, c.description, c.is_active, c.created_at
      ORDER BY c.category_name ASC
    `);

    res.json({
      success: true,
      data: catsRes.rows,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/v1/categories
router.post('/', authenticateToken, requireRoles('admin', 'inventory_staff'), async (req: AuthenticatedRequest, res) => {
  try {
    const { category_name, description = '' } = req.body;
    if (!category_name || !category_name.trim()) {
      res.status(400).json({ success: false, message: 'Category name is required.' });
      return;
    }

    const check = await query('SELECT category_id FROM categories WHERE LOWER(category_name) = LOWER($1)', [
      category_name.trim(),
    ]);
    if (check.rowCount > 0) {
      res.status(400).json({ success: false, message: 'Category already exists.' });
      return;
    }

    const insertRes = await query(
      'INSERT INTO categories (category_name, description) VALUES ($1, $2) RETURNING *',
      [category_name.trim(), description.trim()]
    );

    await logAudit(
      req.user!.userId,
      'CREATE_CATEGORY',
      'CATEGORY',
      String(insertRes.rows[0].category_id),
      `Created category ${category_name}`,
      req.ip
    );

    res.status(201).json({
      success: true,
      message: 'Category created successfully.',
      data: insertRes.rows[0],
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PATCH /api/v1/categories/:id
router.patch('/:id', authenticateToken, requireRoles('admin', 'inventory_staff'), async (req: AuthenticatedRequest, res) => {
  try {
    const categoryId = Number(req.params.id);
    const { category_name, description, is_active } = req.body;

    const curr = await query('SELECT * FROM categories WHERE category_id = $1', [categoryId]);
    if (curr.rowCount === 0) {
      res.status(404).json({ success: false, message: 'Category not found.' });
      return;
    }

    await query(
      `UPDATE categories SET 
        category_name = COALESCE($1, category_name),
        description = COALESCE($2, description),
        is_active = COALESCE($3, is_active)
       WHERE category_id = $4`,
      [
        category_name ? category_name.trim() : null,
        description !== undefined ? description.trim() : null,
        is_active !== undefined ? Boolean(is_active) : null,
        categoryId,
      ]
    );

    await logAudit(
      req.user!.userId,
      'UPDATE_CATEGORY',
      'CATEGORY',
      String(categoryId),
      `Updated category ${curr.rows[0].category_name}`,
      req.ip
    );

    res.json({ success: true, message: 'Category updated successfully.' });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// DELETE /api/v1/categories/:id (Protected: prevents deleting if items exist)
router.delete('/:id', authenticateToken, requireRoles('admin'), async (req: AuthenticatedRequest, res) => {
  try {
    const categoryId = Number(req.params.id);
    const itemsCheck = await query('SELECT COUNT(*) as count FROM items WHERE category_id = $1', [categoryId]);
    const count = Number(itemsCheck.rows[0]?.count || 0);

    if (count > 0) {
      // Auto deactivate instead of hard delete to preserve relational integrity
      await query('UPDATE categories SET is_active = false WHERE category_id = $1', [categoryId]);
      res.json({
        success: true,
        message: `Category has ${count} registered items. It has been safely deactivated instead of deleted to protect historical records.`,
      });
      return;
    }

    await query('DELETE FROM categories WHERE category_id = $1', [categoryId]);
    await logAudit(req.user!.userId, 'DELETE_CATEGORY', 'CATEGORY', String(categoryId), 'Deleted unused category', req.ip);

    res.json({ success: true, message: 'Category deleted successfully.' });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

export default router;
