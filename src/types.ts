export type UserRole =
  | 'admin'
  | 'inventory_staff'
  | 'procurement_officer'
  | 'approving_officer'
  | 'receiving_staff'
  | 'management';

export interface User {
  userId: number;
  username: string;
  fullName: string;
  email: string;
  role: UserRole;
  roleId: number;
  accountStatus?: 'active' | 'inactive';
  lastLogin?: string;
  createdAt?: string;
}

export interface Category {
  category_id: number;
  category_name: string;
  description: string;
  is_active: boolean;
  item_count?: number;
  total_stock?: number;
}

export interface InventoryItem {
  item_id: number;
  item_code: string;
  item_name: string;
  description: string;
  category_id: number;
  category_name?: string;
  unit_of_measure: string;
  reorder_level: number;
  current_stock: number;
  unit_price: number;
  item_status: 'active' | 'inactive';
  computed_stock_status?: 'In Stock' | 'Low Stock' | 'Out of Stock' | 'Inactive';
  created_at?: string;
  updated_at?: string;
}

export interface Supplier {
  supplier_id: number;
  supplier_name: string;
  contact_person: string;
  contact_number: string;
  email: string;
  address: string;
  supplier_status: 'active' | 'inactive';
  created_at?: string;
  total_orders?: number;
  total_spend?: number;
}

export interface PurchaseRequestItem {
  request_item_id?: number;
  request_id?: number;
  item_id: number;
  item_code?: string;
  item_name?: string;
  unit_of_measure?: string;
  requested_quantity: number;
  estimated_unit_cost: number;
  estimated_total_cost?: number;
}

export interface PurchaseRequest {
  request_id: number;
  request_number: string;
  requested_by: number;
  requester_name?: string;
  requester_username?: string;
  department: string;
  purpose: string;
  total_estimated_amount: number;
  request_status: 'draft' | 'pending' | 'approved' | 'rejected' | 'converted';
  approved_by?: number | null;
  approver_name?: string | null;
  approval_date?: string | null;
  approval_remarks?: string | null;
  created_at: string;
  items?: PurchaseRequestItem[];
}

export interface PurchaseOrderItem {
  po_item_id: number;
  purchase_order_id: number;
  item_id: number;
  item_code?: string;
  item_name?: string;
  unit_of_measure?: string;
  ordered_quantity: number;
  received_quantity: number;
  unit_cost: number;
  line_total: number;
}

export interface PurchaseOrder {
  purchase_order_id: number;
  po_number: string;
  supplier_id: number;
  supplier_name?: string;
  contact_person?: string;
  supplier_email?: string;
  request_id?: number | null;
  created_by: number;
  creator_name?: string;
  order_date: string;
  expected_delivery_date: string;
  total_order_amount: number;
  order_status: 'draft' | 'pending' | 'approved' | 'ordered' | 'partially_received' | 'fully_received' | 'cancelled';
  receiving_status: 'pending' | 'partially_received' | 'fully_received';
  approved_by?: number | null;
  approver_name?: string | null;
  remarks?: string;
  created_at: string;
  items?: PurchaseOrderItem[];
  receivingRecords?: any[];
}

export interface ReceivingItem {
  receiving_item_id?: number;
  receiving_id?: number;
  po_item_id: number;
  item_id: number;
  item_code?: string;
  item_name?: string;
  unit_of_measure?: string;
  ordered_quantity?: number;
  received_quantity: number;
  accepted_quantity: number;
  rejected_quantity: number;
  rejection_reason?: string;
}

export interface ReceivingRecord {
  receiving_id: number;
  receiving_number: string;
  purchase_order_id: number;
  po_number?: string;
  supplier_name?: string;
  received_by: number;
  receiver_name?: string;
  receiving_date: string;
  delivery_reference: string;
  remarks?: string;
  created_at: string;
  items?: ReceivingItem[];
  total_items_received?: number;
  total_accepted_units?: number;
  total_rejected_units?: number;
}

export interface StockTransaction {
  transaction_id: number;
  transaction_number: string;
  item_id: number;
  item_code: string;
  item_name: string;
  unit_of_measure: string;
  category_name?: string;
  user_id: number;
  username: string;
  user_full_name?: string;
  transaction_type: 'opening_balance' | 'stock_in' | 'stock_out' | 'purchase_receipt' | 'adjustment' | 'return';
  quantity: number;
  previous_stock: number;
  new_stock: number;
  reference_type?: string;
  reference_id?: string;
  remarks?: string;
  transaction_date: string;
}

export interface DashboardSummary {
  totalItems: number;
  totalStockUnits: number;
  totalValuation: number;
  lowStockItems: number;
  outOfStockItems: number;
  totalSuppliers: number;
  pendingPurchaseRequests: number;
  outstandingPurchaseOrders: number;
  deliveriesAwaitingReceipt: number;
}

export interface AuditLog {
  log_id: number;
  user_id: number | null;
  username?: string;
  full_name?: string;
  action: string;
  entity_type: string;
  entity_id: string;
  details: string;
  ip_address: string;
  created_at: string;
}

export interface NotificationItem {
  notification_id: number;
  user_id: number | null;
  title: string;
  message: string;
  type: string;
  is_read: boolean;
  created_at: string;
}
