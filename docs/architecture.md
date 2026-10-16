# System Architecture & Technical Specifications
## Inventory Procurement Database System (IPDS)

### 1. Three-Tier Enterprise Architecture

```
┌────────────────────────────────────────────────────────┐
│                   PRESENTATION LAYER                   │
│  React SPA (Vite) + Tailwind CSS + Chart.js + Lucide   │
│  - Responsive Mobile Navigation & Admin Console        │
│  - Interactive Forms, Modals & Print Vouchers          │
│  - Real-time Dashboards, Ledger & Report Visualizer    │
└───────────────────────────▲────────────────────────────┘
                            │ HTTPS / REST JSON
                            ▼
┌────────────────────────────────────────────────────────┐
│                   APPLICATION LAYER                    │
│           Node.js v22 + Express REST API               │
│  - Authentication & JWT Token Verification             │
│  - Role-Based Access Control (RBAC Middleware)         │
│  - Pure Domain Validation (inventory-rules.ts)        │
│  - Separation of Duties Approval Engine                │
│  - Atomic Multi-Table Transaction Handlers             │
└───────────────────────────▲────────────────────────────┘
                            │ SQL Queries / ACID Transactions
                            ▼
┌────────────────────────────────────────────────────────┐
│                     DATABASE LAYER                     │
│               PostgreSQL Relational Storage            │
│  - Foreign Keys, Cascade Restrictions & Unique Checks  │
│  - Atomic BEGIN / COMMIT / ROLLBACK Transactions       │
│  - Immutable Stock Transaction Ledger Journal          │
│  - Comprehensive Audit Trails & Schema Migrations      │
└────────────────────────────────────────────────────────┘
```

### 2. Core Business Workflows & Data Integrity

#### 2.1 Separation of Duties Workflow
1. An employee submits a **Purchase Request (PR)** stating department, purpose, and line items.
2. The request status is set to `pending`.
3. In strict compliance with internal audit standards, the **requester cannot approve their own purchase request** unless super-administrative policy override applies.
4. An authorized **Approving Officer** reviews the requisition, budget, and estimated unit costs, then submits an official decision with required justification remarks.
5. Once marked `approved`, the requisition can be converted into a binding **Purchase Order (PO)** issued to an active vendor.

#### 2.2 Goods Receipt & Atomic Ledger Update
1. Commercial goods arrive at the receiving dock with a vendor Delivery Receipt (DR) or Waybill.
2. A **Receiving Staff** member selects the open PO. The application calculates the remaining authorized quantities per line item:
   $$\text{Remaining Allowance} = \text{Ordered Quantity} - \text{Cumulative Received}$$
3. The inspector inputs the delivered units, dividing them into **Accepted** and **Rejected** quantities with a mandatory rejection reason for damaged items.
4. The backend executes an atomic database transaction:
   - Inserts the `receiving_records` row and child `receiving_items`.
   - Increments `purchase_order_items.received_quantity` by the **accepted quantity only**.
   - Increments `items.current_stock` by the **accepted quantity only**.
   - Inserts an immutable entry into `stock_transactions` documenting before/after balances.
   - Evaluates overall PO fulfillment status (`partially_received` vs. `fully_received`).
   - If any step fails, the entire transaction is rolled back via PostgreSQL `ROLLBACK`.

---

### 3. Role-Based Access Control (RBAC) Matrix

| System Module | Administrator | Inventory Staff | Procurement Officer | Approving Officer | Receiving Staff | Management |
|---|:---:|:---:|:---:|:---:|:---:|:---:|
| **Dashboard & Analytics** | Full | View | View | View | View | Full |
| **Inventory Catalog** | Full | CRUD | View | View | View | View |
| **Stock Adjustments** | Full | Authorize | None | None | None | View |
| **Categories** | Full | CRUD | View | None | None | View |
| **Suppliers** | Full | View | CRUD | View | View | View |
| **Purchase Requests** | Full | Create | Create | Approve/Reject | Create | View |
| **Purchase Orders** | Full | View | Create/Cancel | Authorize | View | View |
| **Receiving (Inspection)** | Full | View | View | None | Record/Inspect | View |
| **Stock Movement Ledger** | Full | View | None | None | View | View |
| **Reports & CSV Export** | Full | Full | Full | Full | Full | Full |
| **User Administration** | Full | None | None | None | None | None |
| **Audit Logs** | Full | None | None | None | None | View |
| **Database Backup & Reseed** | Full | None | None | None | None | None |
