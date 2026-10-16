import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateStockStatus,
  validateReceivingQuantities,
  calculateLineTotal,
  validateApprovalPermission,
  determinePoReceivingStatus,
  validateStockAdjustment,
} from './inventory-rules.ts';

test('calculateStockStatus returns correct status', () => {
  assert.equal(calculateStockStatus(20, 10, true), 'In Stock');
  assert.equal(calculateStockStatus(10, 10, true), 'Low Stock');
  assert.equal(calculateStockStatus(3, 10, true), 'Low Stock');
  assert.equal(calculateStockStatus(0, 10, true), 'Out of Stock');
  assert.equal(calculateStockStatus(-2, 10, true), 'Out of Stock');
  assert.equal(calculateStockStatus(20, 10, false), 'Inactive');
});

test('validateReceivingQuantities validates accepted and rejected quantities', () => {
  // Ordered 100, already received 0, delivering 50: 45 accepted, 5 rejected
  const res1 = validateReceivingQuantities(100, 0, 50, 45, 5);
  assert.equal(res1.valid, true);
  assert.equal(res1.remainingBefore, 100);
  assert.equal(res1.remainingAfter, 55);

  // Mismatch sum: 40 accepted + 5 rejected != 50 delivered
  const resMismatch = validateReceivingQuantities(100, 0, 50, 40, 5);
  assert.equal(resMismatch.valid, false);

  // Exceeds remaining allowance: ordered 50, already 40, trying to accept 15
  const resExceed = validateReceivingQuantities(50, 40, 15, 15, 0);
  assert.equal(resExceed.valid, false);
});

test('calculateLineTotal calculates exact monetary precision', () => {
  assert.equal(calculateLineTotal(5, 19.99), 99.95);
  assert.equal(calculateLineTotal(0, 50), 0);
  assert.equal(calculateLineTotal(12, 10.5), 126);
});

test('validateApprovalPermission enforces separation of duties', () => {
  // Approver cannot approve own request unless admin
  const selfApproveNonAdmin = validateApprovalPermission(2, 2, 'approving_officer');
  assert.equal(selfApproveNonAdmin.allowed, false);

  // Approver can approve someone else's request
  const validApprove = validateApprovalPermission(1, 2, 'approving_officer');
  assert.equal(validApprove.allowed, true);

  // Admin can approve
  const adminApprove = validateApprovalPermission(2, 1, 'admin');
  assert.equal(adminApprove.allowed, true);

  // Receiving staff cannot approve PR
  const receivingStaff = validateApprovalPermission(1, 4, 'receiving_staff');
  assert.equal(receivingStaff.allowed, false);
});

test('determinePoReceivingStatus computes correct aggregated state', () => {
  assert.equal(
    determinePoReceivingStatus([
      { ordered_quantity: 10, received_quantity: 0 },
      { ordered_quantity: 5, received_quantity: 0 },
    ]),
    'pending'
  );

  assert.equal(
    determinePoReceivingStatus([
      { ordered_quantity: 10, received_quantity: 5 },
      { ordered_quantity: 5, received_quantity: 0 },
    ]),
    'partially_received'
  );

  assert.equal(
    determinePoReceivingStatus([
      { ordered_quantity: 10, received_quantity: 10 },
      { ordered_quantity: 5, received_quantity: 5 },
    ]),
    'fully_received'
  );
});

test('validateStockAdjustment protects against negative stock', () => {
  const inc = validateStockAdjustment(10, 5, 'increase');
  assert.equal(inc.valid, true);
  assert.equal(inc.newStock, 15);

  const decValid = validateStockAdjustment(10, 5, 'decrease');
  assert.equal(decValid.valid, true);
  assert.equal(decValid.newStock, 5);

  const decInvalid = validateStockAdjustment(4, 5, 'decrease');
  assert.equal(decInvalid.valid, false);
});
