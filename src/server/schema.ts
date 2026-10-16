import { query } from './db.js';

export async function initializeSchema() {
  console.log('[Schema] Verifying and initializing database tables...');

  // 1. Roles table
  await query(`
    CREATE TABLE IF NOT EXISTS roles (
      role_id SERIAL PRIMARY KEY,
      role_name VARCHAR(50) UNIQUE NOT NULL,
      description TEXT
    );
  `);

  // 2. Users table
  await query(`
    CREATE TABLE IF NOT EXISTS users (
      user_id SERIAL PRIMARY KEY,
      full_name VARCHAR(100) NOT NULL,
      username VARCHAR(50) UNIQUE NOT NULL,
      email VARCHAR(100) UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role_id INT NOT NULL REFERENCES roles(role_id),
      account_status VARCHAR(20) NOT NULL DEFAULT 'active',
      last_login TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // 3. Categories table
  await query(`
    CREATE TABLE IF NOT EXISTS categories (
      category_id SERIAL PRIMARY KEY,
      category_name VARCHAR(100) UNIQUE NOT NULL,
      description TEXT,
      is_active BOOLEAN DEFAULT true,
      created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // 4. Items table
  await query(`
    CREATE TABLE IF NOT EXISTS items (
      item_id SERIAL PRIMARY KEY,
      item_code VARCHAR(50) UNIQUE NOT NULL,
      item_name VARCHAR(150) NOT NULL,
      description TEXT,
      category_id INT NOT NULL REFERENCES categories(category_id),
      unit_of_measure VARCHAR(30) NOT NULL DEFAULT 'pcs',
      reorder_level INT NOT NULL DEFAULT 10,
      current_stock INT NOT NULL DEFAULT 0,
      unit_price NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
      item_status VARCHAR(20) NOT NULL DEFAULT 'active',
      created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // 5. Suppliers table
  await query(`
    CREATE TABLE IF NOT EXISTS suppliers (
      supplier_id SERIAL PRIMARY KEY,
      supplier_name VARCHAR(150) NOT NULL,
      contact_person VARCHAR(100) NOT NULL,
      contact_number VARCHAR(50) NOT NULL,
      email VARCHAR(100) NOT NULL,
      address TEXT NOT NULL,
      supplier_status VARCHAR(20) NOT NULL DEFAULT 'active',
      created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // 6. Purchase Requests table
  await query(`
    CREATE TABLE IF NOT EXISTS purchase_requests (
      request_id SERIAL PRIMARY KEY,
      request_number VARCHAR(50) UNIQUE NOT NULL,
      requested_by INT NOT NULL REFERENCES users(user_id),
      request_date DATE NOT NULL DEFAULT CURRENT_DATE,
      department VARCHAR(100) NOT NULL DEFAULT 'General',
      purpose TEXT NOT NULL,
      total_estimated_amount NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
      request_status VARCHAR(30) NOT NULL DEFAULT 'pending',
      approved_by INT REFERENCES users(user_id),
      approval_date TIMESTAMPTZ,
      approval_remarks TEXT,
      created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // 7. Purchase Request Items table
  await query(`
    CREATE TABLE IF NOT EXISTS purchase_request_items (
      request_item_id SERIAL PRIMARY KEY,
      request_id INT NOT NULL REFERENCES purchase_requests(request_id) ON DELETE CASCADE,
      item_id INT NOT NULL REFERENCES items(item_id),
      requested_quantity INT NOT NULL CHECK (requested_quantity > 0),
      estimated_unit_cost NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
      estimated_total_cost NUMERIC(14, 2) NOT NULL DEFAULT 0.00
    );
  `);

  // 8. Purchase Orders table
  await query(`
    CREATE TABLE IF NOT EXISTS purchase_orders (
      purchase_order_id SERIAL PRIMARY KEY,
      po_number VARCHAR(50) UNIQUE NOT NULL,
      supplier_id INT NOT NULL REFERENCES suppliers(supplier_id),
      request_id INT REFERENCES purchase_requests(request_id),
      created_by INT NOT NULL REFERENCES users(user_id),
      order_date DATE NOT NULL DEFAULT CURRENT_DATE,
      expected_delivery_date DATE NOT NULL,
      total_order_amount NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
      order_status VARCHAR(30) NOT NULL DEFAULT 'pending',
      receiving_status VARCHAR(30) NOT NULL DEFAULT 'pending',
      approved_by INT REFERENCES users(user_id),
      approval_date TIMESTAMPTZ,
      remarks TEXT,
      created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // 9. Purchase Order Items table
  await query(`
    CREATE TABLE IF NOT EXISTS purchase_order_items (
      po_item_id SERIAL PRIMARY KEY,
      purchase_order_id INT NOT NULL REFERENCES purchase_orders(purchase_order_id) ON DELETE CASCADE,
      item_id INT NOT NULL REFERENCES items(item_id),
      ordered_quantity INT NOT NULL CHECK (ordered_quantity > 0),
      received_quantity INT NOT NULL DEFAULT 0 CHECK (received_quantity >= 0),
      unit_cost NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
      line_total NUMERIC(14, 2) NOT NULL DEFAULT 0.00
    );
  `);

  // 10. Receiving Records table
  await query(`
    CREATE TABLE IF NOT EXISTS receiving_records (
      receiving_id SERIAL PRIMARY KEY,
      receiving_number VARCHAR(50) UNIQUE NOT NULL,
      purchase_order_id INT NOT NULL REFERENCES purchase_orders(purchase_order_id),
      received_by INT NOT NULL REFERENCES users(user_id),
      receiving_date DATE NOT NULL DEFAULT CURRENT_DATE,
      delivery_reference VARCHAR(100) NOT NULL,
      remarks TEXT,
      created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // 11. Receiving Items table
  await query(`
    CREATE TABLE IF NOT EXISTS receiving_items (
      receiving_item_id SERIAL PRIMARY KEY,
      receiving_id INT NOT NULL REFERENCES receiving_records(receiving_id) ON DELETE CASCADE,
      po_item_id INT NOT NULL REFERENCES purchase_order_items(po_item_id),
      item_id INT NOT NULL REFERENCES items(item_id),
      received_quantity INT NOT NULL CHECK (received_quantity >= 0),
      accepted_quantity INT NOT NULL CHECK (accepted_quantity >= 0),
      rejected_quantity INT NOT NULL DEFAULT 0 CHECK (rejected_quantity >= 0),
      rejection_reason TEXT
    );
  `);

  // 12. Stock Transactions table (Immutable Ledger)
  await query(`
    CREATE TABLE IF NOT EXISTS stock_transactions (
      transaction_id SERIAL PRIMARY KEY,
      transaction_number VARCHAR(50) UNIQUE NOT NULL,
      item_id INT NOT NULL REFERENCES items(item_id),
      user_id INT NOT NULL REFERENCES users(user_id),
      transaction_type VARCHAR(30) NOT NULL,
      quantity INT NOT NULL,
      previous_stock INT NOT NULL,
      new_stock INT NOT NULL,
      reference_type VARCHAR(50),
      reference_id VARCHAR(50),
      remarks TEXT,
      transaction_date TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // 13. Audit Logs table
  await query(`
    CREATE TABLE IF NOT EXISTS audit_logs (
      log_id SERIAL PRIMARY KEY,
      user_id INT REFERENCES users(user_id),
      action VARCHAR(50) NOT NULL,
      entity_type VARCHAR(50) NOT NULL,
      entity_id VARCHAR(50),
      details TEXT,
      ip_address VARCHAR(45),
      created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // 14. Notifications table
  await query(`
    CREATE TABLE IF NOT EXISTS notifications (
      notification_id SERIAL PRIMARY KEY,
      user_id INT REFERENCES users(user_id),
      title VARCHAR(150) NOT NULL,
      message TEXT NOT NULL,
      type VARCHAR(30) NOT NULL DEFAULT 'info',
      is_read BOOLEAN DEFAULT false,
      created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Create indexes for efficient searching and foreign keys
  await query(`CREATE INDEX IF NOT EXISTS idx_items_code ON items(item_code);`);
  await query(`CREATE INDEX IF NOT EXISTS idx_items_category ON items(category_id);`);
  await query(`CREATE INDEX IF NOT EXISTS idx_pr_status ON purchase_requests(request_status);`);
  await query(`CREATE INDEX IF NOT EXISTS idx_po_status ON purchase_orders(order_status);`);
  await query(`CREATE INDEX IF NOT EXISTS idx_stock_tx_item ON stock_transactions(item_id);`);
  await query(`CREATE INDEX IF NOT EXISTS idx_stock_tx_date ON stock_transactions(transaction_date);`);
  await query(`CREATE INDEX IF NOT EXISTS idx_audit_time ON audit_logs(created_at);`);

  console.log('[Schema] All tables and indexes verified successfully.');
}
