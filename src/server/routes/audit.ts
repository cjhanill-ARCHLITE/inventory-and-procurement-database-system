import { Router } from 'express';
import { query } from '../db.js';
import { authenticateToken, requireRoles } from '../middleware/auth.js';

const router = Router();

// GET /api/v1/audit
router.get('/', authenticateToken, requireRoles('admin', 'management'), async (req, res) => {
  try {
    const { action, entity_type, search, limit = 50, page = 1 } = req.query as any;

    let sql = `
      SELECT 
        al.*,
        u.username,
        u.full_name
      FROM audit_logs al
      LEFT JOIN users u ON al.user_id = u.user_id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (action && action !== 'all') {
      params.push(action);
      sql += ` AND al.action = $${params.length}`;
    }

    if (entity_type && entity_type !== 'all') {
      params.push(entity_type);
      sql += ` AND al.entity_type = $${params.length}`;
    }

    if (search && search.trim()) {
      params.push(`%${search.trim()}%`);
      sql += ` AND (al.details ILIKE $${params.length} OR al.entity_id ILIKE $${params.length} OR u.username ILIKE $${params.length})`;
    }

    const countRes = await query(`SELECT COUNT(*) as total FROM (${sql}) as sub`, params);
    const totalRecords = Number(countRes.rows[0]?.total || 0);

    const offset = (Number(page) - 1) * Number(limit);
    params.push(Number(limit));
    const limitIdx = params.length;
    params.push(offset);
    const offsetIdx = params.length;

    sql += ` ORDER BY al.created_at DESC LIMIT $${limitIdx} OFFSET $${offsetIdx}`;

    const logsRes = await query(sql, params);

    res.json({
      success: true,
      data: logsRes.rows,
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

export default router;
