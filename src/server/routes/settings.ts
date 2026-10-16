import { Router } from 'express';
import { query } from '../db.js';
import { authenticateToken, requireRoles, logAudit, type AuthenticatedRequest } from '../middleware/auth.js';
import { seedDatabase } from '../seed.js';

const router = Router();

// GET /api/v1/settings/backup - Exports complete JSON snapshot of all tables
router.get('/backup', authenticateToken, requireRoles('admin'), async (req: AuthenticatedRequest, res) => {
  try {
    const [
      roles,
      users,
      categories,
      items,
      suppliers,
      purchaseRequests,
      purchaseRequestItems,
      purchaseOrders,
      purchaseOrderItems,
      receivingRecords,
      receivingItems,
      stockTransactions,
      auditLogs,
    ] = await Promise.all([
      query('SELECT * FROM roles'),
      query('SELECT user_id, full_name, username, email, role_id, account_status, last_login, created_at FROM users'),
      query('SELECT * FROM categories'),
      query('SELECT * FROM items'),
      query('SELECT * FROM suppliers'),
      query('SELECT * FROM purchase_requests'),
      query('SELECT * FROM purchase_request_items'),
      query('SELECT * FROM purchase_orders'),
      query('SELECT * FROM purchase_order_items'),
      query('SELECT * FROM receiving_records'),
      query('SELECT * FROM receiving_items'),
      query('SELECT * FROM stock_transactions'),
      query('SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 1000'),
    ]);

    const backupPayload = {
      system: 'Inventory Procurement Database System (IPDS)',
      version: '1.0.0',
      exportedAt: new Date().toISOString(),
      exportedBy: req.user!.username,
      database: 'PostgreSQL',
      tables: {
        roles: roles.rows,
        users: users.rows,
        categories: categories.rows,
        items: items.rows,
        suppliers: suppliers.rows,
        purchase_requests: purchaseRequests.rows,
        purchase_request_items: purchaseRequestItems.rows,
        purchase_orders: purchaseOrders.rows,
        purchase_order_items: purchaseOrderItems.rows,
        receiving_records: receivingRecords.rows,
        receiving_items: receivingItems.rows,
        stock_transactions: stockTransactions.rows,
        audit_logs: auditLogs.rows,
      },
    };

    await logAudit(
      req.user!.userId,
      'DATABASE_BACKUP',
      'SYSTEM',
      'FULL_BACKUP',
      'Generated full database JSON backup',
      req.ip
    );

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="ipds-backup-${Date.now()}.json"`);
    res.json(backupPayload);
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/v1/settings/reset-demo
router.post('/reset-demo', authenticateToken, requireRoles('admin'), async (req: AuthenticatedRequest, res) => {
  try {
    console.log('[Settings] Resetting database to initial seed dataset...');

    await query('TRUNCATE TABLE receiving_items CASCADE');
    await query('TRUNCATE TABLE receiving_records CASCADE');
    await query('TRUNCATE TABLE purchase_order_items CASCADE');
    await query('TRUNCATE TABLE purchase_orders CASCADE');
    await query('TRUNCATE TABLE purchase_request_items CASCADE');
    await query('TRUNCATE TABLE purchase_requests CASCADE');
    await query('TRUNCATE TABLE stock_transactions CASCADE');
    await query('TRUNCATE TABLE items CASCADE');
    await query('TRUNCATE TABLE suppliers CASCADE');
    await query('TRUNCATE TABLE categories CASCADE');
    await query('TRUNCATE TABLE notifications CASCADE');
    await query('TRUNCATE TABLE audit_logs CASCADE');
    await query('TRUNCATE TABLE users CASCADE');

    await seedDatabase();

    await logAudit(
      req.user!.userId,
      'DATABASE_RESET',
      'SYSTEM',
      'DEMO_DATA',
      'Administrator reseeded demonstration dataset',
      req.ip
    );

    res.json({
      success: true,
      message: 'Database has been restored to the initial demonstration seed state.',
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/v1/settings/status
router.get('/status', authenticateToken, async (_req, res) => {
  try {
    const tableCounts = await Promise.all([
      query('SELECT COUNT(*) as count FROM items'),
      query('SELECT COUNT(*) as count FROM categories'),
      query('SELECT COUNT(*) as count FROM suppliers'),
      query('SELECT COUNT(*) as count FROM purchase_requests'),
      query('SELECT COUNT(*) as count FROM purchase_orders'),
      query('SELECT COUNT(*) as count FROM receiving_records'),
      query('SELECT COUNT(*) as count FROM stock_transactions'),
      query('SELECT COUNT(*) as count FROM users'),
    ]);

    res.json({
      success: true,
      data: {
        serverTime: new Date().toISOString(),
        database: 'PostgreSQL (Relational Storage Engine)',
        storage: 'Persistent Relational Tables & Transaction Journal',
        stats: {
          items: Number(tableCounts[0].rows[0].count),
          categories: Number(tableCounts[1].rows[0].count),
          suppliers: Number(tableCounts[2].rows[0].count),
          purchase_requests: Number(tableCounts[3].rows[0].count),
          purchase_orders: Number(tableCounts[4].rows[0].count),
          receiving_records: Number(tableCounts[5].rows[0].count),
          stock_transactions: Number(tableCounts[6].rows[0].count),
          users: Number(tableCounts[7].rows[0].count),
        },
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

export default router;
