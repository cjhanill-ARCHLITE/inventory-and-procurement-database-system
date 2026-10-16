import { Router } from 'express';
import { query } from '../db.js';
import { authenticateToken } from '../middleware/auth.js';

const router = Router();

// Helper to convert array of objects to CSV string
function convertToCSV(data: any[]): string {
  if (!data || data.length === 0) return '';
  const headers = Object.keys(data[0]);
  const rows = data.map(row =>
    headers
      .map(fieldName => {
        let val = row[fieldName];
        if (val === null || val === undefined) val = '';
        const stringVal = String(val).replace(/"/g, '""');
        return `"${stringVal}"`;
      })
      .join(',')
  );
  return [headers.join(','), ...rows].join('\r\n');
}

// GET /api/v1/reports/:reportType
router.get('/:reportType', authenticateToken, async (req, res) => {
  try {
    const { reportType } = req.params;
    const { category_id, supplier_id, start_date, end_date, format } = req.query as any;

    let rows: any[] = [];
    let title = '';

    switch (reportType) {
      case 'inventory': {
        title = 'Current Inventory Valuation Report';
        let sql = `
          SELECT 
            i.item_code as "Item Code",
            i.item_name as "Item Name",
            c.category_name as "Category",
            i.unit_of_measure as "Unit",
            i.current_stock as "Current Stock",
            i.reorder_level as "Reorder Level",
            i.unit_price as "Unit Price (PHP)",
            (i.current_stock * i.unit_price) as "Total Value (PHP)",
            i.item_status as "Status"
          FROM items i
          JOIN categories c ON i.category_id = c.category_id
          WHERE 1=1
        `;
        const params: any[] = [];
        if (category_id && category_id !== 'all') {
          params.push(Number(category_id));
          sql += ` AND i.category_id = $${params.length}`;
        }
        sql += ` ORDER BY c.category_name, i.item_name`;
        const r = await query(sql, params);
        rows = r.rows;
        break;
      }

      case 'low-stock': {
        title = 'Low Stock Replenishment Alert Report';
        const r = await query(`
          SELECT 
            i.item_code as "Item Code",
            i.item_name as "Item Name",
            c.category_name as "Category",
            i.unit_of_measure as "Unit",
            i.current_stock as "Current Stock",
            i.reorder_level as "Reorder Level",
            (i.reorder_level - i.current_stock + 10) as "Recommended Order Qty",
            i.unit_price as "Est. Unit Price (PHP)",
            ((i.reorder_level - i.current_stock + 10) * i.unit_price) as "Est. Restock Cost (PHP)"
          FROM items i
          JOIN categories c ON i.category_id = c.category_id
          WHERE i.item_status = 'active' AND i.current_stock <= i.reorder_level
          ORDER BY (i.current_stock - i.reorder_level) ASC
        `);
        rows = r.rows;
        break;
      }

      case 'out-of-stock': {
        title = 'Out of Stock Depletion Report';
        const r = await query(`
          SELECT 
            i.item_code as "Item Code",
            i.item_name as "Item Name",
            c.category_name as "Category",
            i.unit_of_measure as "Unit",
            i.reorder_level as "Reorder Level",
            i.unit_price as "Unit Price (PHP)"
          FROM items i
          JOIN categories c ON i.category_id = c.category_id
          WHERE i.item_status = 'active' AND i.current_stock <= 0
          ORDER BY i.item_name ASC
        `);
        rows = r.rows;
        break;
      }

      case 'stock-movements': {
        title = 'Stock Movement Ledger Report';
        let sql = `
          SELECT 
            st.transaction_number as "Tx Number",
            TO_CHAR(st.transaction_date, 'YYYY-MM-DD HH24:MI') as "Date",
            i.item_code as "Item Code",
            i.item_name as "Item Name",
            st.transaction_type as "Transaction Type",
            st.quantity as "Quantity Change",
            st.previous_stock as "Previous Stock",
            st.new_stock as "New Stock",
            st.reference_type as "Reference Type",
            st.reference_id as "Reference ID",
            u.username as "Authorized By",
            st.remarks as "Remarks"
          FROM stock_transactions st
          JOIN items i ON st.item_id = i.item_id
          JOIN users u ON st.user_id = u.user_id
          WHERE 1=1
        `;
        const params: any[] = [];
        if (start_date) {
          params.push(start_date);
          sql += ` AND st.transaction_date >= $${params.length}`;
        }
        if (end_date) {
          params.push(end_date);
          sql += ` AND st.transaction_date <= $${params.length}`;
        }
        sql += ` ORDER BY st.transaction_date DESC LIMIT 500`;
        const r = await query(sql, params);
        rows = r.rows;
        break;
      }

      case 'purchase-requests': {
        title = 'Purchase Requests Summary Report';
        let sql = `
          SELECT 
            pr.request_number as "Request Number",
            pr.request_date as "Date",
            u.full_name as "Requested By",
            pr.department as "Department",
            pr.purpose as "Purpose",
            pr.total_estimated_amount as "Estimated Total (PHP)",
            pr.request_status as "Status",
            appr.full_name as "Approved By",
            pr.approval_remarks as "Remarks"
          FROM purchase_requests pr
          JOIN users u ON pr.requested_by = u.user_id
          LEFT JOIN users appr ON pr.approved_by = appr.user_id
          WHERE 1=1
        `;
        const params: any[] = [];
        if (start_date) {
          params.push(start_date);
          sql += ` AND pr.request_date >= $${params.length}`;
        }
        if (end_date) {
          params.push(end_date);
          sql += ` AND pr.request_date <= $${params.length}`;
        }
        sql += ` ORDER BY pr.created_at DESC`;
        const r = await query(sql, params);
        rows = r.rows;
        break;
      }

      case 'purchase-orders': {
        title = 'Purchase Orders Tracking Report';
        let sql = `
          SELECT 
            po.po_number as "PO Number",
            po.order_date as "Order Date",
            s.supplier_name as "Supplier",
            po.expected_delivery_date as "Expected Delivery",
            po.total_order_amount as "Total Amount (PHP)",
            po.order_status as "Order Status",
            po.receiving_status as "Receiving Status",
            u.full_name as "Issued By"
          FROM purchase_orders po
          JOIN suppliers s ON po.supplier_id = s.supplier_id
          JOIN users u ON po.created_by = u.user_id
          WHERE 1=1
        `;
        const params: any[] = [];
        if (supplier_id && supplier_id !== 'all') {
          params.push(Number(supplier_id));
          sql += ` AND po.supplier_id = $${params.length}`;
        }
        sql += ` ORDER BY po.order_date DESC`;
        const r = await query(sql, params);
        rows = r.rows;
        break;
      }

      case 'suppliers': {
        title = 'Supplier Directory and Performance Report';
        const r = await query(`
          SELECT 
            s.supplier_name as "Supplier Name",
            s.contact_person as "Contact Person",
            s.contact_number as "Phone",
            s.email as "Email",
            s.address as "Address",
            s.supplier_status as "Status",
            COUNT(po.purchase_order_id) as "Total Orders Issued",
            COALESCE(SUM(po.total_order_amount), 0) as "Total Volume (PHP)"
          FROM suppliers s
          LEFT JOIN purchase_orders po ON s.supplier_id = po.supplier_id
          GROUP BY s.supplier_id
          ORDER BY s.supplier_name
        `);
        rows = r.rows;
        break;
      }

      case 'receiving': {
        title = 'Goods Receiving and Acceptance Report';
        const r = await query(`
          SELECT 
            rr.receiving_number as "Receiving Number",
            rr.receiving_date as "Date",
            po.po_number as "Purchase Order",
            s.supplier_name as "Supplier",
            rr.delivery_reference as "Waybill/DR Ref",
            u.full_name as "Received By",
            COALESCE(SUM(ri.accepted_quantity), 0) as "Accepted Units",
            COALESCE(SUM(ri.rejected_quantity), 0) as "Rejected Units",
            rr.remarks as "Inspection Remarks"
          FROM receiving_records rr
          JOIN purchase_orders po ON rr.purchase_order_id = po.purchase_order_id
          JOIN suppliers s ON po.supplier_id = s.supplier_id
          JOIN users u ON rr.received_by = u.user_id
          LEFT JOIN receiving_items ri ON rr.receiving_id = ri.receiving_id
          GROUP BY rr.receiving_id, po.po_number, s.supplier_name, u.full_name
          ORDER BY rr.receiving_date DESC
        `);
        rows = r.rows;
        break;
      }

      case 'procurement-spending': {
        title = 'Procurement Spending by Supplier Report';
        const r = await query(`
          SELECT 
            s.supplier_name as "Supplier",
            COUNT(po.purchase_order_id) as "Completed Orders",
            COALESCE(SUM(po.total_order_amount), 0) as "Total Spend (PHP)",
            AVG(po.total_order_amount) as "Average PO Value (PHP)"
          FROM suppliers s
          JOIN purchase_orders po ON s.supplier_id = po.supplier_id
          WHERE po.order_status NOT IN ('cancelled', 'draft')
          GROUP BY s.supplier_id, s.supplier_name
          ORDER BY "Total Spend (PHP)" DESC
        `);
        rows = r.rows;
        break;
      }

      case 'audit': {
        title = 'System User Activity & Audit Trail Report';
        const r = await query(`
          SELECT 
            al.log_id as "Log ID",
            TO_CHAR(al.created_at, 'YYYY-MM-DD HH24:MI:SS') as "Timestamp",
            COALESCE(u.username, 'SYSTEM') as "User",
            al.action as "Action",
            al.entity_type as "Entity Type",
            al.entity_id as "Entity ID",
            al.details as "Details",
            al.ip_address as "IP Address"
          FROM audit_logs al
          LEFT JOIN users u ON al.user_id = u.user_id
          ORDER BY al.created_at DESC
          LIMIT 1000
        `);
        rows = r.rows;
        break;
      }

      default:
        res.status(400).json({ success: false, message: `Unknown report type: ${reportType}` });
        return;
    }

    if (format === 'csv') {
      const csv = convertToCSV(rows);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${reportType}-report-${Date.now()}.csv"`);
      res.send(csv);
      return;
    }

    res.json({
      success: true,
      title,
      recordCount: rows.length,
      data: rows,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

export default router;
