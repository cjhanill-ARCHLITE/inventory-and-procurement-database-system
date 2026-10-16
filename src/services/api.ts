const BASE_URL = '/api/v1';

let authToken: string | null = localStorage.getItem('ipds_token');

export function setToken(token: string | null) {
  authToken = token;
  if (token) {
    localStorage.setItem('ipds_token', token);
  } else {
    localStorage.removeItem('ipds_token');
  }
}

export function getToken(): string | null {
  return authToken;
}

async function request<T = any>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers || {});
  headers.set('Content-Type', 'application/json');

  if (authToken) {
    headers.set('Authorization', `Bearer ${authToken}`);
  }

  const response = await fetch(`${BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  if (response.status === 401) {
    setToken(null);
    window.dispatchEvent(new CustomEvent('ipds:unauthorized'));
  }

  const data = await response.json().catch(() => ({ success: false, message: 'Server communication error' }));

  if (!response.ok) {
    throw new Error(data.message || `Request failed with status ${response.status}`);
  }

  return data;
}

export const api = {
  // Auth
  login: (credentials: { username: string; password: string }) =>
    request('/auth/login', { method: 'POST', body: JSON.stringify(credentials) }),
  switchDemoRole: (role: string) =>
    request('/auth/switch-demo-role', { method: 'POST', body: JSON.stringify({ role }) }),
  getMe: () => request('/auth/me'),
  logout: () => request('/auth/logout', { method: 'POST' }),
  changePassword: (passwords: { currentPassword: string; newPassword: string }) =>
    request('/auth/change-password', { method: 'POST', body: JSON.stringify(passwords) }),

  // Dashboard
  getDashboardSummary: () => request('/dashboard/summary'),
  getDashboardCharts: () => request('/dashboard/charts'),
  getDashboardRecent: () => request('/dashboard/recent-activity'),

  // Items
  getItems: (params: Record<string, any> = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/items?${qs}`);
  },
  getItem: (id: number) => request(`/items/${id}`),
  createItem: (data: any) => request('/items', { method: 'POST', body: JSON.stringify(data) }),
  updateItem: (id: number, data: any) => request(`/items/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  toggleItemStatus: (id: number, status: string) =>
    request(`/items/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }),

  // Categories
  getCategories: () => request('/categories'),
  createCategory: (data: any) => request('/categories', { method: 'POST', body: JSON.stringify(data) }),
  updateCategory: (id: number, data: any) =>
    request(`/categories/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteCategory: (id: number) => request(`/categories/${id}`, { method: 'DELETE' }),

  // Suppliers
  getSuppliers: (params: Record<string, any> = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/suppliers?${qs}`);
  },
  getSupplier: (id: number) => request(`/suppliers/${id}`),
  createSupplier: (data: any) => request('/suppliers', { method: 'POST', body: JSON.stringify(data) }),
  updateSupplier: (id: number, data: any) =>
    request(`/suppliers/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  toggleSupplierStatus: (id: number, status: string) =>
    request(`/suppliers/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }),

  // Purchase Requests
  getPurchaseRequests: (params: Record<string, any> = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/purchase-requests?${qs}`);
  },
  getPurchaseRequest: (id: number) => request(`/purchase-requests/${id}`),
  createPurchaseRequest: (data: any) =>
    request('/purchase-requests', { method: 'POST', body: JSON.stringify(data) }),
  approvePurchaseRequest: (id: number, remarks: string) =>
    request(`/purchase-requests/${id}/approve`, { method: 'POST', body: JSON.stringify({ remarks }) }),
  rejectPurchaseRequest: (id: number, remarks: string) =>
    request(`/purchase-requests/${id}/reject`, { method: 'POST', body: JSON.stringify({ remarks }) }),
  convertToPurchaseOrder: (id: number, data: any) =>
    request(`/purchase-requests/${id}/convert-to-po`, { method: 'POST', body: JSON.stringify(data) }),

  // Purchase Orders
  getPurchaseOrders: (params: Record<string, any> = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/purchase-orders?${qs}`);
  },
  getPurchaseOrder: (id: number) => request(`/purchase-orders/${id}`),
  createPurchaseOrder: (data: any) =>
    request('/purchase-orders', { method: 'POST', body: JSON.stringify(data) }),
  cancelPurchaseOrder: (id: number, reason: string) =>
    request(`/purchase-orders/${id}/cancel`, { method: 'POST', body: JSON.stringify({ reason }) }),

  // Receiving
  getReceivingRecords: (params: Record<string, any> = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/receiving?${qs}`);
  },
  getEligiblePOs: () => request('/receiving/eligible-pos'),
  getReceivingRecord: (id: number) => request(`/receiving/${id}`),
  createReceivingRecord: (data: any) => request('/receiving', { method: 'POST', body: JSON.stringify(data) }),

  // Stock Transactions
  getStockTransactions: (params: Record<string, any> = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/stock-transactions?${qs}`);
  },
  adjustStock: (data: { item_id: number; adjustment_type: string; quantity: number; reason: string }) =>
    request('/stock-transactions/adjustments', { method: 'POST', body: JSON.stringify(data) }),

  // Reports
  getReport: (reportType: string, params: Record<string, any> = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/reports/${reportType}?${qs}`);
  },
  getReportDownloadUrl: (reportType: string, params: Record<string, any> = {}) => {
    const qs = new URLSearchParams({ ...params, format: 'csv' }).toString();
    return `${BASE_URL}/reports/${reportType}?${qs}`;
  },

  // Users
  getUsers: (params: Record<string, any> = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/users?${qs}`);
  },
  createUser: (data: any) => request('/users', { method: 'POST', body: JSON.stringify(data) }),
  updateUser: (id: number, data: any) => request(`/users/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  resetPassword: (id: number, newPassword: string) =>
    request(`/users/${id}/reset-password`, { method: 'POST', body: JSON.stringify({ new_password: newPassword }) }),

  // Audit
  getAuditLogs: (params: Record<string, any> = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/audit?${qs}`);
  },

  // Notifications
  getNotifications: () => request('/notifications'),
  markAllNotificationsRead: () => request('/notifications/mark-all-read', { method: 'POST' }),

  // Settings
  getSystemStatus: () => request('/settings/status'),
  resetDemoDatabase: () => request('/settings/reset-demo', { method: 'POST' }),
  getBackupUrl: () => `${BASE_URL}/settings/backup`,
};
