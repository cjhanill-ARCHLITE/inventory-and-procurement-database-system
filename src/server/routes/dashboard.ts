import { Router } from 'express';
import { query } from '../db.js';
import { authenticateToken } from '../middleware/auth.js';

const router = Router();

// GET /api/v1/dashboard/summary
router.get('/summary', authenticateToken, async (_req, res) => {
  try {
    const [
      itemStats,
      lowStockRes,
      outOfStockRes,
      suppliersRes,
      pendingPrRes,
      openPoRes,
      pendingDeliveryRes,
    ] = await Promise.all([
      query(`
        SELECT 
          COUNT(*) as total_items,
          COALESCE(SUM(current_stock), 0) as total_stock_units,
          COALESCE(SUM(current_stock * unit_price), 0) as total_valuation
        FROM items
        WHERE item_status = 'active'
      `),
      query(`
        SELECT COUNT(*) as count 
        FROM items 
        WHERE item_status = 'active' AND current_stock > 0 AND current_stock <= reorder_level
      `),
      query(`
        SELECT COUNT(*) as count 
        FROM items 
        WHERE item_status = 'active' AND current_stock <= 0
      `),
      query(`
        SELECT COUNT(*) as count 
        FROM suppliers 
        WHERE supplier_status = 'active'
      `),
      query(`
        SELECT COUNT(*) as count 
        FROM purchase_requests 
        WHERE request_status = 'pending'
      `),
      query(`
        SELECT COUNT(*) as count 
        FROM purchase_orders 
        WHERE order_status IN ('approved', 'ordered', 'partially_received')
      `),
      query(`
        SELECT COUNT(*) as count 
        FROM purchase_orders 
        WHERE receiving_status IN ('pending', 'partially_received') AND order_status IN ('approved', 'ordered', 'partially_received')
      `),
    ]);

    res.json({
      success: true,
      data: {
        totalItems: Number(itemStats.rows[0]?.total_items || 0),
        totalStockUnits: Number(itemStats.rows[0]?.total_stock_units || 0),
        totalValuation: Number(itemStats.rows[0]?.total_valuation || 0),
        lowStockItems: Number(lowStockRes.rows[0]?.count || 0),
        outOfStockItems: Number(outOfStockRes.rows[0]?.count || 0),
        totalSuppliers: Number(suppliersRes.rows[0]?.count || 0),
        pendingPurchaseRequests: Number(pendingPrRes.rows[0]?.count || 0),
        outstandingPurchaseOrders: Number(openPoRes.rows[0]?.count || 0),
        deliveriesAwaitingReceipt: Number(pendingDeliveryRes.rows[0]?.count || 0),
      },
    });
  } catch (err: any) {
    console.error('[Dashboard Summary Error]', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/v1/dashboard/charts
router.get('/charts', authenticateToken, async (_req, res) => {
  try {
    // 1. Category distribution
    const categoryDist = await query(`
      SELECT c.category_name, COUNT(i.item_id) as item_count, COALESCE(SUM(i.current_stock), 0) as stock_count
      FROM categories c
      LEFT JOIN items i ON c.category_id = i.category_id AND i.item_status = 'active'
      WHERE c.is_active = true
      GROUP BY c.category_id, c.category_name
      ORDER BY item_count DESC
    `);

    // 2. Monthly procurement spending (from POs)
    const monthlySpending = await query(`
      SELECT 
        TO_CHAR(order_date, 'Mon YYYY') as month_label,
        DATE_TRUNC('month', order_date) as sort_month,
        COALESCE(SUM(total_order_amount), 0) as total_spent
      FROM purchase_orders
      WHERE order_status NOT IN ('cancelled', 'draft')
      GROUP BY month_label, sort_month
      ORDER BY sort_month DESC
      LIMIT 6
    `);

    // 3. Stock movement volume by type
    const txBreakdown = await query(`
      SELECT transaction_type, COUNT(*) as tx_count, COALESCE(SUM(ABS(quantity)), 0) as total_units
      FROM stock_transactions
      GROUP BY transaction_type
    `);

    // 4. PR status breakdown
    const prStatuses = await query(`
      SELECT request_status, COUNT(*) as count
      FROM purchase_requests
      GROUP BY request_status
    `);

    res.json({
      success: true,
      data: {
        categoryDistribution: categoryDist.rows,
        monthlySpending: monthlySpending.rows.reverse(),
        transactionBreakdown: txBreakdown.rows,
        requestStatuses: prStatuses.rows,
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/v1/dashboard/recent-activity
router.get('/recent-activity', authenticateToken, async (_req, res) => {
  try {
    const [recentTx, recentPo, pendingPr, lowStock] = await Promise.all([
      query(`
        SELECT st.*, i.item_name, i.item_code, u.username
        FROM stock_transactions st
        JOIN items i ON st.item_id = i.item_id
        JOIN users u ON st.user_id = u.user_id
        ORDER BY st.transaction_date DESC
        LIMIT 6
      `),
      query(`
        SELECT po.*, s.supplier_name, u.username as creator_name
        FROM purchase_orders po
        JOIN suppliers s ON po.supplier_id = s.supplier_id
        JOIN users u ON po.created_by = u.user_id
        ORDER BY po.created_at DESC
        LIMIT 5
      `),
      query(`
        SELECT pr.*, u.full_name as requester_name
        FROM purchase_requests pr
        JOIN users u ON pr.requested_by = u.user_id
        WHERE pr.request_status = 'pending'
        ORDER BY pr.request_date ASC
        LIMIT 5
      `),
      query(`
        SELECT i.item_id, i.item_code, i.item_name, i.current_stock, i.reorder_level, i.unit_of_measure, c.category_name
        FROM items i
        JOIN categories c ON i.category_id = c.category_id
        WHERE i.item_status = 'active' AND i.current_stock <= i.reorder_level
        ORDER BY i.current_stock ASC
        LIMIT 6
      `),
    ]);

    res.json({
      success: true,
      data: {
        recentTransactions: recentTx.rows,
        recentOrders: recentPo.rows,
        pendingApprovals: pendingPr.rows,
        lowStockAlerts: lowStock.rows,
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

export default router;
