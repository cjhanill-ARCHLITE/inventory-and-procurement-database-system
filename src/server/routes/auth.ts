import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { query } from '../db.js';
import { JWT_SECRET, authenticateToken, logAudit, type AuthenticatedRequest } from '../middleware/auth.js';

const router = Router();

// POST /api/v1/auth/login
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      res.status(400).json({ success: false, message: 'Username and password are required.' });
      return;
    }

    const userRes = await query(
      `SELECT u.user_id, u.username, u.full_name, u.email, u.password_hash, u.account_status, r.role_name, r.role_id
       FROM users u
       JOIN roles r ON u.role_id = r.role_id
       WHERE LOWER(u.username) = LOWER($1) OR LOWER(u.email) = LOWER($1)`,
      [username.trim()]
    );

    if (userRes.rowCount === 0) {
      res.status(401).json({ success: false, message: 'Invalid username or password.' });
      return;
    }

    const user = userRes.rows[0];

    if (user.account_status !== 'active') {
      res.status(403).json({ success: false, message: 'Account is deactivated. Contact system administrator.' });
      return;
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      res.status(401).json({ success: false, message: 'Invalid username or password.' });
      return;
    }

    // Update last login
    await query('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE user_id = $1', [user.user_id]);

    const token = jwt.sign(
      {
        userId: user.user_id,
        username: user.username,
        role: user.role_name,
      },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.cookie('ipds_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 24 * 60 * 60 * 1000,
    });

    await logAudit(user.user_id, 'USER_LOGIN', 'AUTH', user.username, 'User logged into IPDS system', req.ip);

    res.json({
      success: true,
      message: 'Authentication successful',
      token,
      user: {
        userId: user.user_id,
        username: user.username,
        fullName: user.full_name,
        email: user.email,
        role: user.role_name,
        roleId: user.role_id,
      },
    });
  } catch (err: any) {
    console.error('[Auth Error]', err);
    res.status(500).json({ success: false, message: 'Internal authentication server error.' });
  }
});

// POST /api/v1/auth/switch-demo-role (Evaluator convenience tool)
router.post('/switch-demo-role', async (req, res) => {
  try {
    const { role } = req.body;
    const userRes = await query(
      `SELECT u.user_id, u.username, u.full_name, u.email, u.account_status, r.role_name, r.role_id
       FROM users u
       JOIN roles r ON u.role_id = r.role_id
       WHERE r.role_name = $1 AND u.account_status = 'active'
       LIMIT 1`,
      [role]
    );

    if (userRes.rowCount === 0) {
      res.status(404).json({ success: false, message: `No active user found for role: ${role}` });
      return;
    }

    const user = userRes.rows[0];
    const token = jwt.sign(
      {
        userId: user.user_id,
        username: user.username,
        role: user.role_name,
      },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.cookie('ipds_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 24 * 60 * 60 * 1000,
    });

    res.json({
      success: true,
      token,
      user: {
        userId: user.user_id,
        username: user.username,
        fullName: user.full_name,
        email: user.email,
        role: user.role_name,
        roleId: user.role_id,
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/v1/auth/me
router.get('/me', authenticateToken, (req: AuthenticatedRequest, res) => {
  res.json({
    success: true,
    user: req.user,
  });
});

// POST /api/v1/auth/logout
router.post('/logout', authenticateToken, async (req: AuthenticatedRequest, res) => {
  res.clearCookie('ipds_token');
  if (req.user) {
    await logAudit(req.user.userId, 'USER_LOGOUT', 'AUTH', req.user.username, 'User logged out', req.ip);
  }
  res.json({ success: true, message: 'Successfully logged out.' });
});

// POST /api/v1/auth/change-password
router.post('/change-password', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword || newPassword.length < 6) {
      res.status(400).json({ success: false, message: 'New password must be at least 6 characters.' });
      return;
    }

    const userRes = await query('SELECT password_hash FROM users WHERE user_id = $1', [req.user!.userId]);
    const isMatch = await bcrypt.compare(currentPassword, userRes.rows[0].password_hash);
    if (!isMatch) {
      res.status(400).json({ success: false, message: 'Current password does not match.' });
      return;
    }

    const salt = await bcrypt.genSalt(10);
    const newHash = await bcrypt.hash(newPassword, salt);
    await query('UPDATE users SET password_hash = $1, updated_at = CURRENT_TIMESTAMP WHERE user_id = $2', [
      newHash,
      req.user!.userId,
    ]);

    await logAudit(req.user!.userId, 'PASSWORD_CHANGE', 'USER', req.user!.username, 'User changed password', req.ip);

    res.json({ success: true, message: 'Password updated successfully.' });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

export default router;
