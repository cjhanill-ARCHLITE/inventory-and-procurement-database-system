import { Router } from 'express';
import { query } from '../db.js';
import { authenticateToken, type AuthenticatedRequest } from '../middleware/auth.js';

const router = Router();

// GET /api/v1/notifications
router.get('/', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const notifs = await query(
      `SELECT * FROM notifications 
       WHERE user_id = $1 OR user_id IS NULL
       ORDER BY created_at DESC 
       LIMIT 30`,
      [req.user!.userId]
    );

    const unreadCount = await query(
      `SELECT COUNT(*) as count FROM notifications 
       WHERE (user_id = $1 OR user_id IS NULL) AND is_read = false`,
      [req.user!.userId]
    );

    res.json({
      success: true,
      data: notifs.rows,
      unreadCount: Number(unreadCount.rows[0]?.count || 0),
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/v1/notifications/mark-all-read
router.post('/mark-all-read', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    await query(
      `UPDATE notifications SET is_read = true WHERE user_id = $1 OR user_id IS NULL`,
      [req.user!.userId]
    );
    res.json({ success: true, message: 'All notifications marked as read.' });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

export default router;
