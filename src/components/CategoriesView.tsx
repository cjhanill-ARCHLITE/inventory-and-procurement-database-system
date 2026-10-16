import React, { useEffect, useState } from 'react';
import { Tags, Plus, Edit2, Trash2, X, RefreshCw, Boxes, AlertCircle } from 'lucide-react';
import type { Category, User } from '../types.js';
import { api } from '../services/api.js';

interface CategoriesViewProps {
  currentUser: User | null;
  onNavigate: (tab: string) => void;
}

export const CategoriesView: React.FC<CategoriesViewProps> = ({ currentUser, onNavigate }) => {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedCat, setSelectedCat] = useState<Category | null>(null);

  const [form, setForm] = useState({ category_name: '', description: '' });
  const [modalLoading, setModalLoading] = useState(false);
  const [modalError, setModalError] = useState('');
  const [notice, setNotice] = useState('');

  const loadCategories = async () => {
    try {
      setLoading(true);
      const res = await api.getCategories();
      if (res.success) setCategories(res.data);
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCategories();
  }, []);

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalError('');
    try {
      setModalLoading(true);
      const res = await api.createCategory(form);
      if (res.success) {
        setShowAddModal(false);
        setForm({ category_name: '', description: '' });
        loadCategories();
      }
    } catch (err: any) {
      setModalError(err.message || 'Failed to create category');
    } finally {
      setModalLoading(false);
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCat) return;
    setModalError('');
    try {
      setModalLoading(true);
      const res = await api.updateCategory(selectedCat.category_id, form);
      if (res.success) {
        setShowEditModal(false);
        loadCategories();
      }
    } catch (err: any) {
      setModalError(err.message || 'Failed to update category');
    } finally {
      setModalLoading(false);
    }
  };

  const handleDelete = async (cat: Category) => {
    if (!confirm(`Are you sure you want to delete category '${cat.category_name}'?`)) return;
    try {
      const res = await api.deleteCategory(cat.category_id);
      setNotice(res.message);
      loadCategories();
      setTimeout(() => setNotice(''), 5000);
    } catch (err: any) {
      alert(err.message);
    }
  };

  const canModify = currentUser?.role === 'admin' || currentUser?.role === 'inventory_staff';

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">Product Categories</h2>
          <p className="text-xs text-slate-500">
            Organize inventory items into operational departments and classification groups.
          </p>
        </div>

        {canModify && (
          <button
            type="button"
            onClick={() => {
              setForm({ category_name: '', description: '' });
              setShowAddModal(true);
            }}
            className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-blue-700 transition-colors"
          >
            <Plus className="h-4 w-4" />
            <span>Add Category</span>
          </button>
        )}
      </div>

      {notice && (
        <div className="flex items-center gap-2 rounded-xl bg-amber-50 p-3 text-xs text-amber-800 border border-amber-200">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{notice}</span>
        </div>
      )}

      {/* Categories Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {loading ? (
          <div className="col-span-full py-12 text-center text-slate-400">
            <RefreshCw className="mx-auto h-6 w-6 animate-spin text-blue-600 mb-2" />
            Loading categories from database...
          </div>
        ) : categories.length === 0 ? (
          <div className="col-span-full py-12 text-center text-slate-500">No categories found.</div>
        ) : (
          categories.map(cat => (
            <div
              key={cat.category_id}
              className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-5 shadow-2xs hover:border-blue-300 transition-all"
            >
              <div>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="rounded-lg bg-blue-50 p-2 text-blue-600">
                      <Tags className="h-4 w-4" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-slate-900">{cat.category_name}</h3>
                      <span className={`text-[10px] font-semibold uppercase ${cat.is_active ? 'text-emerald-600' : 'text-slate-400'}`}>
                        {cat.is_active ? 'Active' : 'Deactivated'}
                      </span>
                    </div>
                  </div>

                  {canModify && (
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedCat(cat);
                          setForm({ category_name: cat.category_name, description: cat.description || '' });
                          setShowEditModal(true);
                        }}
                        className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                        title="Edit Category"
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                      </button>
                      {currentUser?.role === 'admin' && (
                        <button
                          type="button"
                          onClick={() => handleDelete(cat)}
                          className="rounded-lg p-1 text-slate-400 hover:bg-red-50 hover:text-red-600"
                          title="Delete Category"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  )}
                </div>

                <p className="mt-3 text-xs text-slate-600 leading-relaxed min-h-8">
                  {cat.description || 'No description provided.'}
                </p>
              </div>

              <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3 text-xs text-slate-500">
                <div className="flex items-center gap-1.5">
                  <Boxes className="h-3.5 w-3.5 text-slate-400" />
                  <span>
                    <strong className="text-slate-900">{cat.item_count || 0}</strong> registered items
                  </span>
                </div>
                <div className="font-semibold text-slate-700">
                  {cat.total_stock || 0} units in stock
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Modal Add Category */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-bold text-slate-900">Add New Category</h3>
              <button type="button" onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="h-4 w-4" />
              </button>
            </div>
            <form onSubmit={handleAddSubmit} className="mt-4 space-y-4">
              {modalError && <div className="rounded-lg bg-red-50 p-2 text-xs text-red-700">{modalError}</div>}
              <div>
                <label className="block text-xs font-semibold text-slate-700">Category Name *</label>
                <input
                  type="text"
                  required
                  value={form.category_name}
                  onChange={e => setForm({ ...form, category_name: e.target.value })}
                  placeholder="e.g. Electrical & Hardware"
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-1.5 text-xs text-slate-900 focus:border-blue-500 focus:outline-hidden"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700">Description</label>
                <textarea
                  rows={2}
                  value={form.description}
                  onChange={e => setForm({ ...form, description: e.target.value })}
                  placeholder="Brief description of items in this category..."
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-1.5 text-xs text-slate-900 focus:border-blue-500 focus:outline-hidden"
                />
              </div>
              <div className="flex justify-end gap-2 border-t border-slate-100 pt-3">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={modalLoading}
                  className="rounded-lg bg-blue-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {modalLoading ? 'Creating...' : 'Save Category'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Edit Category */}
      {showEditModal && selectedCat && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-bold text-slate-900">Edit Category</h3>
              <button type="button" onClick={() => setShowEditModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="h-4 w-4" />
              </button>
            </div>
            <form onSubmit={handleEditSubmit} className="mt-4 space-y-4">
              {modalError && <div className="rounded-lg bg-red-50 p-2 text-xs text-red-700">{modalError}</div>}
              <div>
                <label className="block text-xs font-semibold text-slate-700">Category Name *</label>
                <input
                  type="text"
                  required
                  value={form.category_name}
                  onChange={e => setForm({ ...form, category_name: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-1.5 text-xs text-slate-900 focus:border-blue-500 focus:outline-hidden"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700">Description</label>
                <textarea
                  rows={2}
                  value={form.description}
                  onChange={e => setForm({ ...form, description: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-1.5 text-xs text-slate-900 focus:border-blue-500 focus:outline-hidden"
                />
              </div>
              <div className="flex justify-end gap-2 border-t border-slate-100 pt-3">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={modalLoading}
                  className="rounded-lg bg-blue-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {modalLoading ? 'Saving...' : 'Update Category'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
