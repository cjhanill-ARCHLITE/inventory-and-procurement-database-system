import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { query } from '../db.js';
import { authenticateToken, requireRoles, logAudit, type AuthenticatedRequest } from '../middleware/auth.js';

const router = Router();

// GET /api/v1/users
router.get('/', authenticateToken, requireRoles('admin'), async (req, res) => {
  try {
    const { search, role, status } = req.query as any;
    let sql = `
      SELECT 
        u.user_id,
        u.full_name,
        u.username,
        u.email,
        u.role_id,
        r.role_name,
        r.description as role_description,
        u.account_status,
        u.last_login,
        u.created_at
      FROM users u
      JOIN roles r ON u.role_id = r.role_id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (search && search.trim()) {
      params.push(`%${search.trim()}%`);
      sql += ` AND (u.full_name ILIKE $${params.length} OR u.username ILIKE $${params.length} OR u.email ILIKE $${params.length})`;
    }

    if (role && role !== 'all') {
      params.push(role);
      sql += ` AND r.role_name = $${params.length}`;
    }

    if (status && status !== 'all') {
      params.push(status);
      sql += ` AND u.account_status = $${params.length}`;
    }

    sql += ' ORDER BY u.created_at ASC';

    const usersRes = await query(sql, params);
    const rolesRes = await query('SELECT * FROM roles ORDER BY role_id ASC');

    res.json({
      success: true,
      data: usersRes.rows,
      roles: rolesRes.rows,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/v1/users
router.post('/', authenticateToken, requireRoles('admin'), async (req: AuthenticatedRequest, res) => {
  try {
    const { full_name, username, email, password, role_id } = req.body;

    if (!full_name || !username || !email || !password || !role_id) {
      res.status(400).json({ success: false, message: 'All fields including role and password are required.' });
      return;
    }

    if (password.length < 6) {
      res.status(400).json({ success: false, message: 'Password must be at least 6 characters.' });
      return;
    }

    // Check unique username and email
    const dupCheck = await query(
      'SELECT user_id FROM users WHERE LOWER(username) = LOWER($1) OR LOWER(email) = LOWER($2)',
      [username.trim(), email.trim()]
    );
    if (dupCheck.rowCount > 0) {
      res.status(400).json({ success: false, message: 'Username or email already in use.' });
      return;
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    const insertRes = await query(
      `INSERT INTO users (full_name, username, email, password_hash, role_id, account_status)
       VALUES ($1, $2, $3, $4, $5, 'active')
       RETURNING user_id, full_name, username, email, role_id, account_status, created_at`,
      [full_name.trim(), username.trim(), email.trim(), passwordHash, Number(role_id)]
    );

    await logAudit(
      req.user!.userId,
      'CREATE_USER',
      'USER',
      username.trim(),
      `Created user account ${username.trim()} (${full_name.trim()})`,
      req.ip
    );

    res.status(201).json({
      success: true,
      message: 'User account created successfully.',
      data: insertRes.rows[0],
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PATCH /api/v1/users/:id
router.patch('/:id', authenticateToken, requireRoles('admin'), async (req: AuthenticatedRequest, res) => {
  try {
    const targetUserId = Number(req.params.id);
    const { full_name, email, role_id, account_status } = req.body;

    const curr = await query('SELECT * FROM users WHERE user_id = $1', [targetUserId]);
    if (curr.rowCount === 0) {
      res.status(404).json({ success: false, message: 'User not found.' });
      return;
    }

    // Prevent admin from deactivating themselves
    if (req.user!.userId === targetUserId && account_status === 'inactive') {
      res.status(400).json({ success: false, message: 'You cannot deactivate your own administrative account.' });
      return;
    }

    await query(
      `UPDATE users SET
        full_name = COALESCE($1, full_name),
        email = COALESCE($2, email),
        role_id = COALESCE($3, role_id),
        account_status = COALESCE($4, account_status),
        updated_at = CURRENT_TIMESTAMP
       WHERE user_id = $5`,
      [
        full_name ? full_name.trim() : null,
        email ? email.trim() : null,
        role_id ? Number(role_id) : null,
        account_status || null,
        targetUserId,
      ]
    );

    await logAudit(
      req.user!.userId,
      'UPDATE_USER',
      'USER',
      curr.rows[0].username,
      `Updated user profile / role for ${curr.rows[0].username}`,
      req.ip
    );

    res.json({ success: true, message: 'User updated successfully.' });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/v1/users/:id/reset-password
router.post('/:id/reset-password', authenticateToken, requireRoles('admin'), async (req: AuthenticatedRequest, res) => {
  try {
    const targetUserId = Number(req.params.id);
    const { new_password } = req.body;

    if (!new_password || new_password.length < 6) {
      res.status(400).json({ success: false, message: 'New password must be at least 6 characters.' });
      return;
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(new_password, salt);

    await query('UPDATE users SET password_hash = $1, updated_at = CURRENT_TIMESTAMP WHERE user_id = $2', [
      passwordHash,
      targetUserId,
    ]);

    await logAudit(
      req.user!.userId,
      'RESET_PASSWORD',
      'USER',
      String(targetUserId),
      'Admin reset user password',
      req.ip
    );

    res.json({ success: true, message: 'User password reset successfully.' });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

export default router;
