import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { query } from '../db.js';

export const JWT_SECRET = process.env.JWT_SECRET || 'super_secure_ipds_jwt_secret_key_change_in_production';

export interface AuthUser {
  userId: number;
  username: string;
  fullName: string;
  role: string;
  roleId: number;
  email: string;
}

export interface AuthenticatedRequest extends Request {
  user?: AuthUser;
}

export async function authenticateToken(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  let token: string | undefined;

  const authHeader = req.headers['authorization'];
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.split(' ')[1];
  } else if (req.cookies && req.cookies.ipds_token) {
    token = req.cookies.ipds_token;
  }

  if (!token) {
    res.status(401).json({ success: false, message: 'Authentication required. No token provided.' });
    return;
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    // Check if user still exists and is active
    const userRes = await query(
      `SELECT u.user_id, u.username, u.full_name, u.email, u.account_status, r.role_name, r.role_id
       FROM users u
       JOIN roles r ON u.role_id = r.role_id
       WHERE u.user_id = $1`,
      [decoded.userId]
    );

    if (userRes.rowCount === 0 || userRes.rows[0].account_status !== 'active') {
      res.status(403).json({ success: false, message: 'User account is inactive or not found.' });
      return;
    }

    const row = userRes.rows[0];
    req.user = {
      userId: row.user_id,
      username: row.username,
      fullName: row.full_name,
      email: row.email,
      role: row.role_name,
      roleId: row.role_id,
    };

    next();
  } catch (err) {
    res.status(401).json({ success: false, message: 'Invalid or expired session token.' });
  }
}

export function requireRoles(...roles: string[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Authentication required.' });
      return;
    }

    if (req.user.role === 'admin' || roles.includes(req.user.role)) {
      next();
      return;
    }

    res.status(403).json({
      success: false,
      message: `Access denied. Requires one of the following roles: ${roles.join(', ')}. Current role: ${req.user.role}`,
    });
  };
}

export async function logAudit(
  userId: number | null,
  action: string,
  entityType: string,
  entityId: string | null,
  details: string,
  ipAddress?: string
) {
  try {
    await query(
      `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details, ip_address)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [userId, action, entityType, entityId, details, ipAddress || '127.0.0.1']
    );
  } catch (err) {
    console.error('[AuditLog] Failed to record audit entry:', err);
  }
}
