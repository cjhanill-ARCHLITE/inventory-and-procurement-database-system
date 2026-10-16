// Pure domain business logic functions for Inventory Procurement Database System (IPDS)

export type StockStatus = 'In Stock' | 'Low Stock' | 'Out of Stock' | 'Inactive';

export interface ReceivingValidationResult {
  valid: boolean;
  error?: string;
  remainingBefore: number;
  remainingAfter: number;
}

/**
 * Calculates the stock status based on current stock, reorder level, and active status
 */
export function calculateStockStatus(
  currentStock: number,
  reorderLevel: number,
  isActive: boolean = true
): StockStatus {
  if (!isActive) return 'Inactive';
  if (currentStock <= 0) return 'Out of Stock';
  if (currentStock <= reorderLevel) return 'Low Stock';
  return 'In Stock';
}

/**
 * Validates delivery receiving quantities against the authorized purchase order limits
 */
export function validateReceivingQuantities(
  orderedQty: number,
  alreadyReceivedQty: number,
  newlyDeliveredQty: number,
  acceptedQty: number,
  rejectedQty: number = 0
): ReceivingValidationResult {
  if (orderedQty <= 0) {
    return { valid: false, error: 'Ordered quantity must be greater than zero.', remainingBefore: 0, remainingAfter: 0 };
  }
  if (newlyDeliveredQty <= 0) {
    return { valid: false, error: 'Delivered quantity must be greater than zero.', remainingBefore: orderedQty - alreadyReceivedQty, remainingAfter: orderedQty - alreadyReceivedQty };
  }
  if (acceptedQty < 0 || rejectedQty < 0) {
    return { valid: false, error: 'Quantities cannot be negative.', remainingBefore: orderedQty - alreadyReceivedQty, remainingAfter: orderedQty - alreadyReceivedQty };
  }
  if (acceptedQty + rejectedQty !== newlyDeliveredQty) {
    return {
      valid: false,
      error: `Sum of accepted (${acceptedQty}) and rejected (${rejectedQty}) must equal total delivered quantity (${newlyDeliveredQty}).`,
      remainingBefore: orderedQty - alreadyReceivedQty,
      remainingAfter: orderedQty - alreadyReceivedQty
    };
  }

  const remainingBefore = Math.max(0, orderedQty - alreadyReceivedQty);
  if (acceptedQty > remainingBefore) {
    return {
      valid: false,
      error: `Accepted quantity (${acceptedQty}) cannot exceed remaining authorized quantity (${remainingBefore}).`,
      remainingBefore,
      remainingAfter: remainingBefore
    };
  }

  const remainingAfter = Math.max(0, remainingBefore - acceptedQty);
  return {
    valid: true,
    remainingBefore,
    remainingAfter
  };
}

/**
 * Calculates line item total with decimal precision
 */
export function calculateLineTotal(quantity: number, unitCost: number): number {
  if (quantity <= 0 || unitCost < 0) return 0;
  return Math.round(quantity * unitCost * 100) / 100;
}

/**
 * Validates purchase request approval rules, including separation of duties
 */
export function validateApprovalPermission(
  requesterId: number,
  approverId: number,
  approverRole: string
): { allowed: boolean; reason?: string } {
  const allowedRoles = ['admin', 'approving_officer'];
  if (!allowedRoles.includes(approverRole)) {
    return { allowed: false, reason: `Role '${approverRole}' is not authorized to approve purchase requests.` };
  }
  // Enforce separation of duties: cannot approve your own request unless superadmin policy override
  if (requesterId === approverId && approverRole !== 'admin') {
    return { allowed: false, reason: 'Separation of duties violation: You cannot approve your own purchase request.' };
  }
  return { allowed: true };
}

/**
 * Determines PO overall receiving status based on line item progress
 */
export function determinePoReceivingStatus(
  items: Array<{ ordered_quantity: number; received_quantity: number }>
): 'pending' | 'partially_received' | 'fully_received' {
  if (!items || items.length === 0) return 'pending';
  let totalOrdered = 0;
  let totalReceived = 0;

  for (const item of items) {
    totalOrdered += Number(item.ordered_quantity) || 0;
    totalReceived += Number(item.received_quantity) || 0;
  }

  if (totalReceived === 0) return 'pending';
  if (totalReceived >= totalOrdered) return 'fully_received';
  return 'partially_received';
}

/**
 * Validates stock adjustment operation
 */
export function validateStockAdjustment(
  currentStock: number,
  adjustmentAmount: number,
  type: 'increase' | 'decrease'
): { valid: boolean; newStock: number; error?: string } {
  if (adjustmentAmount <= 0) {
    return { valid: false, newStock: currentStock, error: 'Adjustment amount must be positive.' };
  }
  if (type === 'decrease' && currentStock - adjustmentAmount < 0) {
    return { valid: false, newStock: currentStock, error: `Insufficient stock: current stock is ${currentStock}, cannot reduce by ${adjustmentAmount}.` };
  }
  const newStock = type === 'increase' ? currentStock + adjustmentAmount : currentStock - adjustmentAmount;
  return { valid: true, newStock };
}
