# INVENTORY PROCUREMENT DATABASE SYSTEM (IPDS)

An enterprise-grade, relational database-driven full-stack web application designed for comprehensive inventory management, supplier relations, multi-tier purchase requisitions, procurement order lifecycle tracking, goods receipt dock inspection, and automated stock ledger accounting.

---

## 1. System Features

* **Relational Database Storage**: Full PostgreSQL storage engine backing all data records with primary keys, foreign key constraints, cascading rules, and atomic transactions.
* **Separation of Duties & Role-Based Access Control**:
  * 6 Distinct Roles: `Administrator`, `Inventory Staff`, `Procurement Officer`, `Approving Officer`, `Receiving Staff`, and `Management`.
  * Dedicated approval workflow rules: users cannot approve their own purchase requests.
* **Inventory Catalog & Stock Control**:
  * Real-time calculation of stock status (`In Stock`, `Low Stock`, `Out of Stock`, `Inactive`).
  * Automated reorder level warnings and replenishment triggers.
  * Opening balance ledger journal records upon registration.
  * Protected stock adjustments requiring mandatory justifications and audit entries.
* **Supplier Directory**: Vendor contacts, order history, and commercial transaction totals.
* **Purchase Request & Requisition Module**:
  * Multi-item requisition builder with automatic line item total calculations.
  * Approval and rejection workflows with required officer feedback remarks.
  * Direct conversion of approved PRs into binding Purchase Orders.
* **Purchase Order Procurement Module**:
  * Formal PO voucher generation and delivery scheduling.
  * Real-time fulfillment progress tracking (% received).
  * Printable official Purchase Order document view.
* **Goods Receiving & Quality Inspection**:
  * Dockside verification of incoming shipments against open POs.
  * Granular division into **Accepted Units** (which update available stock) and **Rejected Units** (with mandatory defect reasons).
  * Atomic database transaction updating PO lines, stock balances, and ledger journal simultaneously.
  * Printable Goods Receiving Slips.
* **Immutable Stock Movement Ledger**:
  * Chronological journal documenting every stock-in, delivery receipt, and authorized adjustment.
  * Positive and negative signed quantity deltas, user audit IDs, and document references.
* **Analytics Dashboard with Chart.js**:
  * 8 live summary metric cards.
  * 4 interactive charts: Category Distribution (Doughnut), Procurement Spending (Bar), Ledger Volume by Type, PR Status Distribution.
  * Critical low-stock replenishment alert tables with 1-click requisition.
* **10 Comprehensive Enterprise Reports**:
  1. Current Inventory Valuation Report
  2. Low-Stock Replenishment Report
  3. Out-of-Stock Depletion Report
  4. Stock Movement Ledger Report
  5. Purchase Request Summary Report
  6. Purchase Order Tracking Report
  7. Supplier Directory & Performance Report
  8. Goods Receiving & Acceptance Report
  9. Procurement Spending Analysis Report
  10. System User Activity & Audit Trail Report
  * All reports support live filtering, printable letterheads, and direct CSV file downloads.
* **User Management & Security**:
  * bcrypt password encryption and JWT authentication.
  * Account activation/deactivation and password resets.
  * Real-time system activity audit trail logging IP addresses and entity modifications.
* **Database Disaster Recovery**:
  * 1-Click point-in-time full database JSON backup export.
  * Demonstration seed data reseed / reset tool.

---

## 2. Technology Stack

* **Frontend**: React (SPA with Vite), Tailwind CSS, Lucide Icons, Chart.js.
* **Backend**: Node.js v22, Express.js REST API (`/api/v1`).
* **Database**: PostgreSQL (PGlite embedded relational engine with local filesystem persistence under `./data/ipds_pg_data` and support for external `DATABASE_URL`).
* **Security & Auth**: bcrypt password hashing, JSON Web Tokens (JWT), HTTP-only cookies, parameterized SQL queries.

---

## 3. Demonstration Accounts

The database comes pre-seeded with 6 functional role accounts for instant evaluation:

| Role | Username | Password | Operational Access |
|---|---|---|---|
| **Administrator** | `admin` | `admin123` | Full administrative control, users, settings, and database backups |
| **Inventory Staff** | `inventory` | `staff123` | Catalog items, category management, authorized stock adjustments |
| **Procurement Officer** | `procurement` | `procure123` | Vendor directory, purchase requests, and purchase orders |
| **Approving Officer** | `approver` | `approve123` | Requisition and PO review, approval, and rejection decisions |
| **Receiving Staff** | `receiving` | `receive123` | Dock goods receipt, quality inspection, and receiving slips |
| **Management** | `manager` | `manage123` | Executive KPI dashboard, analytics, and operational reports |

> **Evaluator Tip**: You can also switch between any of these roles with a single click using the **"Role" dropdown** located in the top navbar without logging out!

---

## 4. Local Installation & Development

1. **Clone the repository**:
   ```bash
   git clone <repo-url>
   cd inventory-procurement-system
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Configure environment variables**:
   ```bash
   cp .env.example .env
   ```

4. **Run Unit Tests**:
   ```bash
   node --test src/lib/inventory-rules.test.ts
   ```

5. **Start Full-Stack Server**:
   ```bash
   npm run dev
   ```
   Open your browser at `http://localhost:3000`.

---

## 5. Automated Verification Results

All core inventory calculation and separation of duties rules have been verified via Node's native test runner (`node:test`):
- `calculateStockStatus`: Verified In Stock, Low Stock, and Out of Stock calculations.
- `validateReceivingQuantities`: Verified delivered, accepted, and rejected constraints.
- `calculateLineTotal`: Verified decimal precision.
- `validateApprovalPermission`: Verified separation of duties (preventing self-approval).
- `determinePoReceivingStatus`: Verified partial and full fulfillment transitions.
- `validateStockAdjustment`: Verified non-negative stock protection.
