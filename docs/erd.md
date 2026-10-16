# Entity-Relationship Diagram (ERD) & Database Specification
## Inventory Procurement Database System (IPDS)

### 1. Relational Database Tables

#### 1.1 `roles`
| Column | Type | Constraints | Description |
|---|---|---|---|
| `role_id` | SERIAL | PRIMARY KEY | Unique role ID |
| `role_name` | VARCHAR(50) | UNIQUE, NOT NULL | Role code (admin, inventory_staff, procurement_officer, approving_officer, receiving_staff, management) |
| `description` | TEXT | | Operational responsibilities description |

#### 1.2 `users`
| Column | Type | Constraints | Description |
|---|---|---|---|
| `user_id` | SERIAL | PRIMARY KEY | User identifier |
| `full_name` | VARCHAR(100) | NOT NULL | Employee / user name |
| `username` | VARCHAR(50) | UNIQUE, NOT NULL | Login username |
| `email` | VARCHAR(100) | UNIQUE, NOT NULL | Official email |
| `password_hash` | TEXT | NOT NULL | bcrypt encrypted password hash |
| `role_id` | INT | NOT NULL, REFERENCES roles(role_id) | Assigned authorization role |
| `account_status` | VARCHAR(20) | NOT NULL DEFAULT 'active' | active / inactive |
| `last_login` | TIMESTAMPTZ | | Timestamp of last session |
| `created_at` | TIMESTAMPTZ | DEFAULT CURRENT_TIMESTAMP | Account creation |
| `updated_at` | TIMESTAMPTZ | DEFAULT CURRENT_TIMESTAMP | Profile update |

#### 1.3 `categories`
| Column | Type | Constraints | Description |
|---|---|---|---|
| `category_id` | SERIAL | PRIMARY KEY | Category ID |
| `category_name` | VARCHAR(100) | UNIQUE, NOT NULL | Category name |
| `description` | TEXT | | Classification details |
| `is_active` | BOOLEAN | DEFAULT true | Active status |
| `created_at` | TIMESTAMPTZ | DEFAULT CURRENT_TIMESTAMP | Registration date |

#### 1.4 `items`
| Column | Type | Constraints | Description |
|---|---|---|---|
| `item_id` | SERIAL | PRIMARY KEY | Item ID |
| `item_code` | VARCHAR(50) | UNIQUE, NOT NULL | SKU code (e.g., ITM-PAP-A4) |
| `item_name` | VARCHAR(150) | NOT NULL | Item name |
| `description` | TEXT | | Item specifications |
| `category_id` | INT | NOT NULL, REFERENCES categories(category_id) | Category reference |
| `unit_of_measure` | VARCHAR(30) | NOT NULL DEFAULT 'pcs' | Unit (pcs, box, ream, roll, etc.) |
| `reorder_level` | INT | NOT NULL DEFAULT 10 | Low-stock threshold |
| `current_stock` | INT | NOT NULL DEFAULT 0 | Available inventory balance |
| `unit_price` | NUMERIC(12, 2) | NOT NULL DEFAULT 0.00 | Standard unit price (PHP) |
| `item_status` | VARCHAR(20) | NOT NULL DEFAULT 'active' | active / inactive |
| `created_at` | TIMESTAMPTZ | DEFAULT CURRENT_TIMESTAMP | Date cataloged |
| `updated_at` | TIMESTAMPTZ | DEFAULT CURRENT_TIMESTAMP | Last modified |

#### 1.5 `suppliers`
| Column | Type | Constraints | Description |
|---|---|---|---|
| `supplier_id` | SERIAL | PRIMARY KEY | Vendor ID |
| `supplier_name` | VARCHAR(150) | NOT NULL | Business entity name |
| `contact_person` | VARCHAR(100) | NOT NULL | Account manager |
| `contact_number` | VARCHAR(50) | NOT NULL | Telephone / Mobile |
| `email` | VARCHAR(100) | NOT NULL | Business email |
| `address` | TEXT | NOT NULL | Physical company address |
| `supplier_status` | VARCHAR(20) | NOT NULL DEFAULT 'active' | active / inactive |
| `created_at` | TIMESTAMPTZ | DEFAULT CURRENT_TIMESTAMP | Registration date |

#### 1.6 `purchase_requests`
| Column | Type | Constraints | Description |
|---|---|---|---|
| `request_id` | SERIAL | PRIMARY KEY | Request ID |
| `request_number` | VARCHAR(50) | UNIQUE, NOT NULL | Requisition code (PR-YYYY-XXXX) |
| `requested_by` | INT | NOT NULL, REFERENCES users(user_id) | Submitting employee |
| `request_date` | DATE | NOT NULL DEFAULT CURRENT_DATE | Request date |
| `department` | VARCHAR(100) | NOT NULL | Department |
| `purpose` | TEXT | NOT NULL | Operational justification |
| `total_estimated_amount` | NUMERIC(14, 2) | NOT NULL DEFAULT 0.00 | Server-calculated total |
| `request_status` | VARCHAR(30) | NOT NULL DEFAULT 'pending' | draft, pending, approved, rejected, converted |
| `approved_by` | INT | REFERENCES users(user_id) | Reviewing officer |
| `approval_date` | TIMESTAMPTZ | | Date of approval/rejection |
| `approval_remarks` | TEXT | | Remarks / Rejection reason |
| `created_at` | TIMESTAMPTZ | DEFAULT CURRENT_TIMESTAMP | Record timestamp |

#### 1.7 `purchase_request_items`
| Column | Type | Constraints | Description |
|---|---|---|---|
| `request_item_id` | SERIAL | PRIMARY KEY | Line ID |
| `request_id` | INT | NOT NULL, REFERENCES purchase_requests ON DELETE CASCADE | Parent PR |
| `item_id` | INT | NOT NULL, REFERENCES items(item_id) | Requested item |
| `requested_quantity` | INT | NOT NULL CHECK (requested_quantity > 0) | Quantity needed |
| `estimated_unit_cost` | NUMERIC(12, 2) | NOT NULL DEFAULT 0.00 | Est. cost per unit |
| `estimated_total_cost` | NUMERIC(14, 2) | NOT NULL DEFAULT 0.00 | Line total |

#### 1.8 `purchase_orders`
| Column | Type | Constraints | Description |
|---|---|---|---|
| `purchase_order_id` | SERIAL | PRIMARY KEY | PO ID |
| `po_number` | VARCHAR(50) | UNIQUE, NOT NULL | Order code (PO-YYYY-XXXX) |
| `supplier_id` | INT | NOT NULL, REFERENCES suppliers(supplier_id) | Awarded vendor |
| `request_id` | INT | REFERENCES purchase_requests(request_id) | Source PR (if converted) |
| `created_by` | INT | NOT NULL, REFERENCES users(user_id) | Issuing officer |
| `order_date` | DATE | NOT NULL DEFAULT CURRENT_DATE | Order date |
| `expected_delivery_date` | DATE | NOT NULL | Promised delivery date |
| `total_order_amount` | NUMERIC(14, 2) | NOT NULL DEFAULT 0.00 | Total contract value |
| `order_status` | VARCHAR(30) | NOT NULL DEFAULT 'ordered' | draft, pending, approved, ordered, partially_received, fully_received, cancelled |
| `receiving_status` | VARCHAR(30) | NOT NULL DEFAULT 'pending' | pending, partially_received, fully_received |
| `approved_by` | INT | REFERENCES users(user_id) | Authorizing manager |
| `remarks` | TEXT | | Contract terms |

#### 1.9 `purchase_order_items`
| Column | Type | Constraints | Description |
|---|---|---|---|
| `po_item_id` | SERIAL | PRIMARY KEY | PO Line ID |
| `purchase_order_id` | INT | NOT NULL, REFERENCES purchase_orders ON DELETE CASCADE | Parent PO |
| `item_id` | INT | NOT NULL, REFERENCES items(item_id) | Ordered item |
| `ordered_quantity` | INT | NOT NULL CHECK (ordered_quantity > 0) | Units ordered |
| `received_quantity` | INT | NOT NULL DEFAULT 0 CHECK (received_quantity >= 0) | Cumulative received units |
| `unit_cost` | NUMERIC(12, 2) | NOT NULL DEFAULT 0.00 | Contract unit price |
| `line_total` | NUMERIC(14, 2) | NOT NULL DEFAULT 0.00 | Server line total |

#### 1.10 `receiving_records`
| Column | Type | Constraints | Description |
|---|---|---|---|
| `receiving_id` | SERIAL | PRIMARY KEY | Receiving receipt ID |
| `receiving_number` | VARCHAR(50) | UNIQUE, NOT NULL | Slip code (RCV-YYYY-XXXX) |
| `purchase_order_id` | INT | NOT NULL, REFERENCES purchase_orders | Associated PO |
| `received_by` | INT | NOT NULL, REFERENCES users(user_id) | Receiving dock officer |
| `receiving_date` | DATE | NOT NULL DEFAULT CURRENT_DATE | Date delivered |
| `delivery_reference` | VARCHAR(100) | NOT NULL | Delivery Receipt / Waybill # |
| `remarks` | TEXT | | Inspection notes |

#### 1.11 `receiving_items`
| Column | Type | Constraints | Description |
|---|---|---|---|
| `receiving_item_id` | SERIAL | PRIMARY KEY | Line item ID |
| `receiving_id` | INT | NOT NULL, REFERENCES receiving_records ON DELETE CASCADE | Receiving slip |
| `po_item_id` | INT | NOT NULL, REFERENCES purchase_order_items | Target PO line |
| `item_id` | INT | NOT NULL, REFERENCES items(item_id) | Item received |
| `received_quantity` | INT | NOT NULL CHECK (received_quantity >= 0) | Delivered units |
| `accepted_quantity` | INT | NOT NULL CHECK (accepted_quantity >= 0) | Units passed inspection (added to stock) |
| `rejected_quantity` | INT | NOT NULL DEFAULT 0 | Units damaged/rejected |
| `rejection_reason` | TEXT | | Mandatory if rejected > 0 |

#### 1.12 `stock_transactions` (Immutable Ledger Journal)
| Column | Type | Constraints | Description |
|---|---|---|---|
| `transaction_id` | SERIAL | PRIMARY KEY | Ledger entry ID |
| `transaction_number` | VARCHAR(50) | UNIQUE, NOT NULL | Ledger transaction number |
| `item_id` | INT | NOT NULL, REFERENCES items(item_id) | Impacted item |
| `user_id` | INT | NOT NULL, REFERENCES users(user_id) | Authorizing user |
| `transaction_type` | VARCHAR(30) | NOT NULL | opening_balance, stock_in, stock_out, purchase_receipt, adjustment, return |
| `quantity` | INT | NOT NULL | Signed stock delta (+/-) |
| `previous_stock` | INT | NOT NULL | Balance before transaction |
| `new_stock` | INT | NOT NULL | Balance after transaction |
| `reference_type` | VARCHAR(50) | | RECEIVING, MANUAL_ADJUSTMENT, INITIAL_RECORD |
| `reference_id` | VARCHAR(50) | | Document number reference |
| `remarks` | TEXT | | Required adjustment reason |
| `transaction_date` | TIMESTAMPTZ | DEFAULT CURRENT_TIMESTAMP | Audit timestamp |

#### 1.13 `audit_logs`
| Column | Type | Constraints | Description |
|---|---|---|---|
| `log_id` | SERIAL | PRIMARY KEY | Audit log ID |
| `user_id` | INT | REFERENCES users(user_id) | Responsible actor |
| `action` | VARCHAR(50) | NOT NULL | Event name |
| `entity_type` | VARCHAR(50) | NOT NULL | Table / domain affected |
| `entity_id` | VARCHAR(50) | | Primary key or reference |
| `details` | TEXT | | Full audit explanation |
| `ip_address` | VARCHAR(45) | | Network origin IP |
| `created_at` | TIMESTAMPTZ | DEFAULT CURRENT_TIMESTAMP | Immutable timestamp |

---

### 2. Conceptual Entity Relationship Model

```
       ROLES (1) ───────────< USERS (M)
                                │
          ┌─────────────────────┼──────────────────────┐
          │                     │                      │
          ▼                     ▼                      ▼
PURCHASE_REQUESTS (1)    PURCHASE_ORDERS (1)    STOCK_TRANSACTIONS (M)
          │                     │                      │
          │ (1:M)               │ (1:M)                │
          ▼                     ▼                      ▼
PURCHASE_REQUEST_ITEMS   PURCHASE_ORDER_ITEMS   ITEMS (1)
          │                     │                      ▲
          └───────────┐         │ (1:M)                │
                      ▼         ▼                      │
                     ITEMS <─── RECEIVING_ITEMS (M) ───┤
                      ▲         │                      │
                      │         │                      │
                      │         ▼                      │
                CATEGORIES (1)  RECEIVING_RECORDS (1)  │
                                │                      │
                 SUPPLIERS (1) ─┴──────────────────────┘
```
