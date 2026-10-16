import bcrypt from 'bcryptjs';
import { query } from './db.js';

export async function seedDatabase() {
  const checkUsers = await query('SELECT COUNT(*) as count FROM users');
  const userCount = Number(checkUsers.rows[0]?.count || 0);

  if (userCount > 0) {
    console.log('[Seed] Database already seeded. Skipping initial seeding.');
    return;
  }

  console.log('[Seed] Starting database seed with sample data...');

  // 1. Roles
  const roles = [
    { name: 'admin', desc: 'System Administrator with full access to all modules and configurations' },
    { name: 'inventory_staff', desc: 'Maintains item catalog, tracks inventory quantities, and logs adjustments' },
    { name: 'procurement_officer', desc: 'Manages vendor relations, prepares purchase requests and purchase orders' },
    { name: 'approving_officer', desc: 'Authorized to review, approve, or reject procurement requests and orders' },
    { name: 'receiving_staff', desc: 'Inspects and logs delivery of purchased goods and verification results' },
    { name: 'management', desc: 'Executive oversight, dashboard metrics, and analytical business reports' },
  ];

  for (const r of roles) {
    await query(
      'INSERT INTO roles (role_name, description) VALUES ($1, $2) ON CONFLICT (role_name) DO NOTHING',
      [r.name, r.desc]
    );
  }

  const roleMap: Record<string, number> = {};
  const roleRows = await query('SELECT role_id, role_name FROM roles');
  for (const row of roleRows.rows) {
    roleMap[row.role_name] = row.role_id;
  }

  // 2. Users
  const salt = await bcrypt.genSalt(10);
  const users = [
    {
      full_name: 'Arthur Pendelton (Admin)',
      username: 'admin',
      email: 'admin@ipds.enterprise.org',
      password: await bcrypt.hash('admin123', salt),
      role_id: roleMap['admin'],
    },
    {
      full_name: 'Elena Cruz (Inventory)',
      username: 'inventory',
      email: 'elena.cruz@ipds.enterprise.org',
      password: await bcrypt.hash('staff123', salt),
      role_id: roleMap['inventory_staff'],
    },
    {
      full_name: 'Marcus Vance (Procurement)',
      username: 'procurement',
      email: 'marcus.vance@ipds.enterprise.org',
      password: await bcrypt.hash('procure123', salt),
      role_id: roleMap['procurement_officer'],
    },
    {
      full_name: 'Diana Prince (Approving Officer)',
      username: 'approver',
      email: 'diana.prince@ipds.enterprise.org',
      password: await bcrypt.hash('approve123', salt),
      role_id: roleMap['approving_officer'],
    },
    {
      full_name: 'Robert Garcia (Receiving Staff)',
      username: 'receiving',
      email: 'robert.garcia@ipds.enterprise.org',
      password: await bcrypt.hash('receive123', salt),
      role_id: roleMap['receiving_staff'],
    },
    {
      full_name: 'Sophia Sterling (Operations Director)',
      username: 'manager',
      email: 'sophia.sterling@ipds.enterprise.org',
      password: await bcrypt.hash('manage123', salt),
      role_id: roleMap['management'],
    },
  ];

  for (const u of users) {
    await query(
      `INSERT INTO users (full_name, username, email, password_hash, role_id, account_status)
       VALUES ($1, $2, $3, $4, $5, 'active') ON CONFLICT (username) DO NOTHING`,
      [u.full_name, u.username, u.email, u.password, u.role_id]
    );
  }

  // 3. Categories
  const categories = [
    { name: 'Office & Stationery Supplies', desc: 'Paper products, pens, binders, writing pads, and everyday desktop essentials' },
    { name: 'IT & Computer Peripherals', desc: 'Keyboards, monitors, network hardware, storage drives, and computing accessories' },
    { name: 'Safety & PPE Equipment', desc: 'Hard hats, safety glasses, high-visibility vests, first-aid kits, and masks' },
    { name: 'Cleaning & Facility Maintenance', desc: 'Sanitization chemicals, dispensers, trash bins, mops, and hygiene products' },
    { name: 'Electrical & Cable Infrastructure', desc: 'Ethernet cables, patch panels, power strips, and testing apparatus' },
    { name: 'Laboratory & Precision Instruments', desc: 'Measuring glassware, digital calipers, pipettes, and inspection scopes' },
  ];

  for (const c of categories) {
    await query(
      'INSERT INTO categories (category_name, description) VALUES ($1, $2) ON CONFLICT (category_name) DO NOTHING',
      [c.name, c.desc]
    );
  }

  const catMap: Record<string, number> = {};
  const catRows = await query('SELECT category_id, category_name FROM categories');
  for (const row of catRows.rows) {
    catMap[row.category_name] = row.category_id;
  }

  // 4. Suppliers
  const suppliers = [
    {
      name: 'Apex Commercial Supplies Corp.',
      contact: 'Victor Chen',
      phone: '+63 917 555 0192',
      email: 'sales@apexsupplies.com',
      address: '142 Rizal Avenue, Santa Cruz, Manila',
    },
    {
      name: 'Quantum Tech Solutions Inc.',
      contact: 'Sarah Jenkins',
      phone: '+63 920 888 4310',
      email: 'procurement@quantumtech.ph',
      address: 'Bldg 4, Cyberzone IT Park, Cebu City',
    },
    {
      name: 'SafeGuard Industrial & Safety Gear',
      contact: 'Danilo Ramos',
      phone: '+63 918 333 9021',
      email: 'orders@safeguardindustrial.com',
      address: '77 Highway 54, Pasig City, Metro Manila',
    },
    {
      name: 'CleanPro Facility Supplies',
      contact: 'Maria Santos',
      phone: '+63 922 444 7862',
      email: 'contact@cleanprosupplies.ph',
      address: '88 MacArthur Hwy, San Fernando, Pampanga',
    },
    {
      name: 'Nexus Fiber & Power Hardware',
      contact: 'Benjamin Tan',
      phone: '+63 917 222 6543',
      email: 'b2b@nexushardware.com',
      address: 'Unit 12 Technopark, Laguna International Industrial Park',
    },
    {
      name: 'Precision Scientific Instruments Ltd.',
      contact: 'Dr. Katherine Wood',
      phone: '+63 919 777 1209',
      email: 'support@precisionsci.com',
      address: '33 University Innovation Hub, Quezon City',
    },
  ];

  for (const s of suppliers) {
    await query(
      `INSERT INTO suppliers (supplier_name, contact_person, contact_number, email, address, supplier_status)
       VALUES ($1, $2, $3, $4, $5, 'active')`,
      [s.name, s.contact, s.phone, s.email, s.address]
    );
  }

  // 5. Items with realistic initial stock and reorder levels
  const items = [
    {
      code: 'ITM-PAP-A4',
      name: 'Copy Paper A4 80gsm (500 Sheets/Ream)',
      desc: 'High-brightness multipurpose copy paper suitable for laser and inkjet printers',
      cat: 'Office & Stationery Supplies',
      uom: 'ream',
      reorder: 25,
      stock: 18, // Low Stock on purpose!
      price: 240.00,
    },
    {
      code: 'ITM-PEN-GEL',
      name: 'Gel Ink Rollerball Pen 0.5mm (Box of 12)',
      desc: 'Smooth-flowing black quick-dry document signing pens',
      cat: 'Office & Stationery Supplies',
      uom: 'box',
      reorder: 15,
      stock: 42,
      price: 180.00,
    },
    {
      code: 'ITM-BND-D2',
      name: 'Heavy Duty D-Ring Arch Binder 2-Inch',
      desc: 'Polypropylene locking ring document organization binder',
      cat: 'Office & Stationery Supplies',
      uom: 'pcs',
      reorder: 10,
      stock: 8, // Low stock
      price: 145.00,
    },
    {
      code: 'ITM-NOT-PST',
      name: 'Self-Adhesive Notes 3x3 Inch (Pack of 6)',
      desc: 'Removable canary yellow memo reminder note pads',
      cat: 'Office & Stationery Supplies',
      uom: 'pack',
      reorder: 12,
      stock: 35,
      price: 125.00,
    },
    {
      code: 'ITM-KEY-MEC',
      name: 'Ergonomic Spill-Resistant Keyboard USB',
      desc: 'Full-size office keyboard with tactile membrane switches and wrist rest',
      cat: 'IT & Computer Peripherals',
      uom: 'pcs',
      reorder: 8,
      stock: 14,
      price: 850.00,
    },
    {
      code: 'ITM-MOU-OPT',
      name: 'Silent Optical Wireless Mouse 2.4GHz',
      desc: 'Compact ergonomic mouse with DPI adjustment and battery',
      cat: 'IT & Computer Peripherals',
      uom: 'pcs',
      reorder: 10,
      stock: 22,
      price: 490.00,
    },
    {
      code: 'ITM-MON-24F',
      name: 'IPS Monitor 24-inch Full HD 75Hz',
      desc: 'Ultra-thin bezel display with HDMI and DisplayPort inputs',
      cat: 'IT & Computer Peripherals',
      uom: 'unit',
      reorder: 5,
      stock: 0, // Out of stock on purpose!
      price: 6800.00,
    },
    {
      code: 'ITM-SSD-1TB',
      name: 'Internal NVMe M.2 Solid State Drive 1TB',
      desc: 'High-speed PCIe 4.0 storage drive for workstation upgrades',
      cat: 'IT & Computer Peripherals',
      uom: 'unit',
      reorder: 6,
      stock: 9,
      price: 3600.00,
    },
    {
      code: 'ITM-SAF-HAT',
      name: 'ANSI Z89.1 Industrial Hard Hat White',
      desc: 'Impact-resistant polyethylene helmet with 6-point ratchet suspension',
      cat: 'Safety & PPE Equipment',
      uom: 'pcs',
      reorder: 15,
      stock: 30,
      price: 320.00,
    },
    {
      code: 'ITM-SAF-GLA',
      name: 'Anti-Fog Scratch-Resistant Safety Goggles',
      desc: 'Wrap-around clear polycarbonate UV400 protective eye wear',
      cat: 'Safety & PPE Equipment',
      uom: 'pcs',
      reorder: 20,
      stock: 12, // Low stock
      price: 110.00,
    },
    {
      code: 'ITM-SAF-VST',
      name: 'High-Visibility Reflective Safety Vest XL',
      desc: 'Fluorescent neon vest with class 2 silver reflective striping',
      cat: 'Safety & PPE Equipment',
      uom: 'pcs',
      reorder: 15,
      stock: 26,
      price: 175.00,
    },
    {
      code: 'ITM-CLN-DIS',
      name: 'Hospital-Grade Disinfectant Solution 1-Gallon',
      desc: 'Quaternary sanitizing solution for floors and high-touch surfaces',
      cat: 'Cleaning & Facility Maintenance',
      uom: 'gallon',
      reorder: 10,
      stock: 25,
      price: 450.00,
    },
    {
      code: 'ITM-CLN-MIC',
      name: 'Microfiber Cleaning Cloths (Pack of 12)',
      desc: 'Non-abrasive streak-free dusting and glass cleaning wipes',
      cat: 'Cleaning & Facility Maintenance',
      uom: 'pack',
      reorder: 10,
      stock: 19,
      price: 260.00,
    },
    {
      code: 'ITM-CLN-BAG',
      name: 'Heavy-Duty Trash Liners 37x40 Black (Roll of 25)',
      desc: 'Puncture-resistant industrial waste disposal trash bags',
      cat: 'Cleaning & Facility Maintenance',
      uom: 'roll',
      reorder: 15,
      stock: 40,
      price: 195.00,
    },
    {
      code: 'ITM-CAB-C6U',
      name: 'Cat6 UTP Solid Bulk Ethernet Cable 305M Roll',
      desc: 'Pure copper 23AWG high-speed gigabit network cabling reel',
      cat: 'Electrical & Cable Infrastructure',
      uom: 'roll',
      reorder: 4,
      stock: 6,
      price: 4200.00,
    },
    {
      code: 'ITM-POW-SUR',
      name: 'Surge Protected 6-Outlet Power Extension 3M',
      desc: 'Heavy-duty surge protector with reset fuse and master switch',
      cat: 'Electrical & Cable Infrastructure',
      uom: 'pcs',
      reorder: 8,
      stock: 16,
      price: 780.00,
    },
    {
      code: 'ITM-LAB-CAL',
      name: 'Stainless Steel Digital Vernier Caliper 150mm',
      desc: 'High-accuracy metric and imperial LCD measurement gauge with zero-set',
      cat: 'Laboratory & Precision Instruments',
      uom: 'unit',
      reorder: 3,
      stock: 5,
      price: 1450.00,
    },
    {
      code: 'ITM-LAB-PIP',
      name: 'Adjustable Volume Micropipette 100-1000uL',
      desc: 'Autoclavable laboratory liquid dispensing pipette with calibration certificate',
      cat: 'Laboratory & Precision Instruments',
      uom: 'unit',
      reorder: 2,
      stock: 0, // Out of stock on purpose
      price: 3200.00,
    },
  ];

  for (const it of items) {
    const catId = catMap[it.cat] || Object.values(catMap)[0];
    const itemRes = await query(
      `INSERT INTO items (item_code, item_name, description, category_id, unit_of_measure, reorder_level, current_stock, unit_price, item_status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'active') RETURNING item_id`,
      [it.code, it.name, it.desc, catId, it.uom, it.reorder, it.stock, it.price]
    );

    const itemId = itemRes.rows[0].item_id;

    // Log Opening Balance stock transaction
    if (it.stock > 0) {
      await query(
        `INSERT INTO stock_transactions (transaction_number, item_id, user_id, transaction_type, quantity, previous_stock, new_stock, reference_type, reference_id, remarks)
         VALUES ($1, $2, $3, 'opening_balance', $4, 0, $4, 'INITIAL_SETUP', 'SYSTEM_INIT', 'Initial verified stock ledger record')`,
        [`TXN-INIT-${itemId.toString().padStart(4, '0')}`, itemId, 1, it.stock]
      );
    }
  }

  // 6. Sample Purchase Requests
  // PR 1: Approved
  const pr1 = await query(
    `INSERT INTO purchase_requests (request_number, requested_by, request_date, department, purpose, total_estimated_amount, request_status, approved_by, approval_date, approval_remarks)
     VALUES ('PR-2026-0001', 3, CURRENT_DATE - INTERVAL '12 days', 'Information Technology', 'Quarterly desktop upgrade and peripheral replenishment for new hires', 15760.00, 'approved', 4, CURRENT_DATE - INTERVAL '10 days', 'Approved as budgeted under Q4 IT equipment allocation.')
     RETURNING request_id`
  );
  const pr1Id = pr1.rows[0].request_id;
  await query(
    `INSERT INTO purchase_request_items (request_id, item_id, requested_quantity, estimated_unit_cost, estimated_total_cost)
     VALUES ($1, 5, 8, 850.00, 6800.00), ($1, 6, 12, 490.00, 5880.00), ($1, 16, 4, 770.00, 3080.00)`,
    [pr1Id]
  );

  // PR 2: Pending Approval
  const pr2 = await query(
    `INSERT INTO purchase_requests (request_number, requested_by, request_date, department, purpose, total_estimated_amount, request_status)
     VALUES ('PR-2026-0002', 2, CURRENT_DATE - INTERVAL '2 days', 'Facilities & Admin', 'Emergency restocking of A4 paper, file binders, and safety goggles', 9440.00, 'pending')
     RETURNING request_id`
  );
  const pr2Id = pr2.rows[0].request_id;
  await query(
    `INSERT INTO purchase_request_items (request_id, item_id, requested_quantity, estimated_unit_cost, estimated_total_cost)
     VALUES ($1, 1, 30, 240.00, 7200.00), ($1, 3, 10, 145.00, 1450.00), ($1, 10, 7, 110.00, 770.00)`,
    [pr2Id]
  );

  // PR 3: Draft
  const pr3 = await query(
    `INSERT INTO purchase_requests (request_number, requested_by, request_date, department, purpose, total_estimated_amount, request_status)
     VALUES ('PR-2026-0003', 3, CURRENT_DATE, 'Operations & Logistics', 'Safety PPE equipment procurement for incoming site audit team', 6850.00, 'draft')
     RETURNING request_id`
  );
  const pr3Id = pr3.rows[0].request_id;
  await query(
    `INSERT INTO purchase_request_items (request_id, item_id, requested_quantity, estimated_unit_cost, estimated_total_cost)
     VALUES ($1, 9, 15, 320.00, 4800.00), ($1, 11, 10, 175.00, 1750.00), ($1, 10, 3, 100.00, 300.00)`,
    [pr3Id]
  );

  // 7. Sample Purchase Orders
  // PO 1: Approved and Partially Received
  const po1 = await query(
    `INSERT INTO purchase_orders (po_number, supplier_id, request_id, created_by, order_date, expected_delivery_date, total_order_amount, order_status, receiving_status, approved_by, approval_date, remarks)
     VALUES ('PO-2026-0001', 2, $1, 3, CURRENT_DATE - INTERVAL '9 days', CURRENT_DATE + INTERVAL '2 days', 15760.00, 'partially_received', 'partially_received', 4, CURRENT_DATE - INTERVAL '8 days', 'Standard commercial supply contract PO-2026-0001 with Quantum Tech')
     RETURNING purchase_order_id`,
    [pr1Id]
  );
  const po1Id = po1.rows[0].purchase_order_id;

  const poi1 = await query(
    `INSERT INTO purchase_order_items (purchase_order_id, item_id, ordered_quantity, received_quantity, unit_cost, line_total)
     VALUES ($1, 5, 8, 8, 850.00, 6800.00) RETURNING po_item_id`,
    [po1Id]
  );
  const poi2 = await query(
    `INSERT INTO purchase_order_items (purchase_order_id, item_id, ordered_quantity, received_quantity, unit_cost, line_total)
     VALUES ($1, 6, 12, 6, 490.00, 5880.00) RETURNING po_item_id`,
    [po1Id]
  );
  const poi3 = await query(
    `INSERT INTO purchase_order_items (purchase_order_id, item_id, ordered_quantity, received_quantity, unit_cost, line_total)
     VALUES ($1, 16, 4, 0, 770.00, 3080.00) RETURNING po_item_id`,
    [po1Id]
  );

  // 8. Sample Receiving Record for PO 1
  const rec1 = await query(
    `INSERT INTO receiving_records (receiving_number, purchase_order_id, received_by, receiving_date, delivery_reference, remarks)
     VALUES ('RCV-2026-0001', $1, 5, CURRENT_DATE - INTERVAL '4 days', 'DR-QT-99210-A', 'Partial delivery: All 8 keyboards received intact; 6 out of 12 mice delivered; surge protectors backordered.')
     RETURNING receiving_id`,
    [po1Id]
  );
  const rec1Id = rec1.rows[0].receiving_id;

  await query(
    `INSERT INTO receiving_items (receiving_id, po_item_id, item_id, received_quantity, accepted_quantity, rejected_quantity, rejection_reason)
     VALUES ($1, $2, 5, 8, 8, 0, NULL), ($1, $3, 6, 6, 6, 0, NULL)`,
    [rec1Id, poi1.rows[0].po_item_id, poi2.rows[0].po_item_id]
  );

  // PO 2: Approved and Ordered (Awaiting Delivery)
  await query(
    `INSERT INTO purchase_orders (po_number, supplier_id, created_by, order_date, expected_delivery_date, total_order_amount, order_status, receiving_status, approved_by, approval_date, remarks)
     VALUES ('PO-2026-0002', 1, 3, CURRENT_DATE - INTERVAL '3 days', CURRENT_DATE + INTERVAL '5 days', 21600.00, 'ordered', 'pending', 4, CURRENT_DATE - INTERVAL '2 days', 'Bulk paper ream shipment dispatched via freight.')
     RETURNING purchase_order_id`
  );

  // 9. Initial Notifications
  await query(
    `INSERT INTO notifications (user_id, title, message, type)
     VALUES 
     (1, 'Critical Stock Alert', 'Item ITM-MON-24F (IPS Monitor 24-inch) and ITM-LAB-PIP are Out of Stock!', 'low_stock'),
     (4, 'Pending Approval Required', 'Purchase Request PR-2026-0002 submitted by Elena Cruz requires your review.', 'approval_pending'),
     (5, 'Delivery Expected Today', 'Purchase Order PO-2026-0001 partial balance delivery expected from Quantum Tech Solutions.', 'delivery')`
  );

  // 10. Initial Audit Logs
  await query(
    `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details)
     VALUES
     (1, 'SYSTEM_INIT', 'SYSTEM', 'IPDS_SCHEMA', 'Database schema initialized and seed dataset loaded successfully'),
     (3, 'CREATE_PR', 'PURCHASE_REQUEST', 'PR-2026-0001', 'Created Purchase Request PR-2026-0001 for IT Department supplies'),
     (4, 'APPROVE_PR', 'PURCHASE_REQUEST', 'PR-2026-0001', 'Approved Purchase Request PR-2026-0001 after budget review'),
     (5, 'GOODS_RECEIPT', 'RECEIVING', 'RCV-2026-0001', 'Processed partial delivery for PO-2026-0001 via DR-QT-99210-A')`
  );

  console.log('[Seed] Database seeding completed successfully.');
}
