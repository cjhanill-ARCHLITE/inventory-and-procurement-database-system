# REST API Documentation
## Inventory Procurement Database System (IPDS)

Base Path: `/api/v1`

All protected endpoints require either an `Authorization: Bearer <token>` header or an HTTP-only session cookie named `ipds_token`.

---

### 1. Authentication Endpoints

#### `POST /api/v1/auth/login`
Authenticates a user and returns a signed JWT token along with user profile.
- **Request Body**:
  ```json
  {
    "username": "admin",
    "password": "admin123"
  }
  ```
- **Response (200 OK)**:
  ```json
  {
    "success": true,
    "message": "Authentication successful",
    "token": "eyJhbGciOi...",
    "user": {
      "userId": 1,
      "username": "admin",
      "fullName": "Arthur Pendelton (Admin)",
      "email": "admin@ipds.enterprise.org",
      "role": "admin",
      "roleId": 1
    }
  }
  ```

#### `GET /api/v1/auth/me`
Retrieves current authenticated session profile.

#### `POST /api/v1/auth/switch-demo-role`
Quick role switching utility for evaluation and presentation.
- **Request Body**: `{ "role": "procurement_officer" }`

#### `POST /api/v1/auth/logout`
Clears session token and logs audit event.

---

### 2. Dashboard Endpoints

#### `GET /api/v1/dashboard/summary`
Returns live KPI metric counters:
- `totalItems`, `totalStockUnits`, `totalValuation`, `lowStockItems`, `outOfStockItems`, `totalSuppliers`, `pendingPurchaseRequests`, `outstandingPurchaseOrders`, `deliveriesAwaitingReceipt`.

#### `GET /api/v1/dashboard/charts`
Returns dataset feeds formatted for Chart.js:
- `categoryDistribution`: Doughnut chart of item counts per category.
- `monthlySpending`: Bar chart of historical procurement expenditures.
- `transactionBreakdown`: Units moved across transaction types.
- `requestStatuses`: Distribution of PR workflow stages.

#### `GET /api/v1/dashboard/recent-activity`
Returns the latest 6 transactions, open POs, pending PRs, and low stock items.

---

### 3. Inventory Endpoints

#### `GET /api/v1/items`
Query parameters:
- `search`: string
- `category_id`: number | 'all'
- `stock_status`: 'all' | 'in' | 'low' | 'out'
- `sort_by`: 'item_name' | 'item_code' | 'current_stock' | 'unit_price'
- `sort_order`: 'ASC' | 'DESC'
- `page`: number
- `limit`: number

#### `GET /api/v1/items/:id`
Returns single item with full specifications and stock transaction history.

#### `POST /api/v1/items`
Registers a new inventory item. Enforces unique item codes and records an atomic opening balance transaction in the immutable ledger if initial stock > 0.

#### `PATCH /api/v1/items/:id`
Updates item specifications.

#### `PATCH /api/v1/items/:id/status`
Sets active / inactive status.

---

### 4. Categories Endpoints

- `GET /api/v1/categories`: Lists categories with total assigned items count.
- `POST /api/v1/categories`: Creates category.
- `PATCH /api/v1/categories/:id`: Updates name / description.
- `DELETE /api/v1/categories/:id`: Deletes or deactivates category if referenced by items.

---

### 5. Suppliers Endpoints

- `GET /api/v1/suppliers`: Search and list vendors with order count and total spend.
- `GET /api/v1/suppliers/:id`: Single vendor details with full order history.
- `POST /api/v1/suppliers`: Adds new vendor with email/phone validation.
- `PATCH /api/v1/suppliers/:id`: Updates vendor profile.
- `PATCH /api/v1/suppliers/:id/status`: Toggles active/inactive.

---

### 6. Purchase Requests Endpoints

- `GET /api/v1/purchase-requests`: Lists requisitions with status/search filters.
- `GET /api/v1/purchase-requests/:id`: Requisition details with line items.
- `POST /api/v1/purchase-requests`: Creates multi-item PR.
- `POST /api/v1/purchase-requests/:id/approve`: Approves PR. Enforces separation of duties (requester cannot approve own PR).
- `POST /api/v1/purchase-requests/:id/reject`: Rejects PR with mandatory reason.
- `POST /api/v1/purchase-requests/:id/convert-to-po`: Converts approved PR to PO.

---

### 7. Purchase Orders Endpoints

- `GET /api/v1/purchase-orders`: Lists POs with fulfillment progress percentages.
- `GET /api/v1/purchase-orders/:id`: Full PO voucher with line items and delivery receipts.
- `POST /api/v1/purchase-orders`: Issues new direct PO.
- `POST /api/v1/purchase-orders/:id/cancel`: Cancels open PO with audit log.

---

### 8. Receiving Endpoints

- `GET /api/v1/receiving`: Lists goods receiving inspection records.
- `GET /api/v1/receiving/eligible-pos`: Retrieves POs awaiting delivery.
- `GET /api/v1/receiving/:id`: Receiving slip details.
- `POST /api/v1/receiving`: **Atomic delivery transaction**. Validates quantities, saves receiving record, increments stock for accepted units only, updates PO receiving status, and creates stock transactions in ledger.

---

### 9. Stock Transactions Endpoints

- `GET /api/v1/stock-transactions`: Searchable immutable ledger journal with pagination.
- `POST /api/v1/stock-transactions/adjustments`: Authorizes manual adjustment with mandatory justification, negative stock protection, and audit entry.

---

### 10. Reports Endpoints

- `GET /api/v1/reports/:reportType`: Generates any of the 10 reports in JSON format.
  - Optional `format=csv` triggers direct RFC-4180 CSV file download.
  - Report types: `inventory`, `low-stock`, `out-of-stock`, `stock-movements`, `purchase-requests`, `purchase-orders`, `suppliers`, `receiving`, `procurement-spending`, `audit`.

---

### 11. User Management Endpoints (Admin Only)

- `GET /api/v1/users`: Lists accounts and system roles.
- `POST /api/v1/users`: Registers new user with hashed password.
- `PATCH /api/v1/users/:id`: Updates profile or role.
- `POST /api/v1/users/:id/reset-password`: Resets user credentials.

---

### 12. Settings & Disaster Recovery Endpoints

- `GET /api/v1/settings/status`: Server uptime, PostgreSQL table counts, and database health.
- `GET /api/v1/settings/backup`: Full JSON backup export of all tables.
- `POST /api/v1/settings/reset-demo`: Reseeds database with initial clean test dataset.
