import React, { useState } from 'react';
import { X, Plus, Trash2, Calendar, Tag, Package, Clock } from 'lucide-react';
import { FoodItem, CategoryType, FreshnessStatus } from '../types';

interface ItemModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (item: FoodItem) => void;
  onDelete?: (id: string) => void;
  initialItem?: FoodItem | null;
}

const CATEGORIES: CategoryType[] = [
  'Produce',
  'Dairy & Eggs',
  'Proteins',
  'Condiments & Sauces',
  'Beverages',
  'Bakery',
  'Leftovers',
  'Pantry & Other',
];

export const ItemModal: React.FC<ItemModalProps> = ({
  isOpen,
  onClose,
  onSave,
  onDelete,
  initialItem,
}) => {
  if (!isOpen) return null;

  const [name, setName] = useState(initialItem?.name || '');
  const [category, setCategory] = useState<CategoryType>(initialItem?.category || 'Produce');
  const [freshness, setFreshness] = useState<FreshnessStatus>(initialItem?.freshness || 'fresh');
  const [daysRemaining, setDaysRemaining] = useState<number>(initialItem?.daysRemaining ?? 5);
  const [quantity, setQuantity] = useState<number>(initialItem?.quantity ?? 1);
  const [unit, setUnit] = useState(initialItem?.unit || 'pcs');
  const [locationInFridge, setLocationInFridge] = useState(initialItem?.locationInFridge || 'Middle Shelf');
  const [notes, setNotes] = useState(initialItem?.notes || '');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const itemToSave: FoodItem = {
      id: initialItem?.id || `item-${Date.now()}`,
      name: name.trim(),
      category,
      freshness,
      daysRemaining: Number(daysRemaining),
      quantity: Number(quantity),
      unit: unit.trim() || 'item',
      locationInFridge,
      notes: notes.trim(),
      addedAt: initialItem?.addedAt || new Date().toISOString(),
    };

    onSave(itemToSave);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-md rounded-3xl shadow-xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-emerald-50/50">
          <h2 className="font-bold text-slate-800 text-lg">
            {initialItem ? 'Edit Item' : 'Add Food Item'}
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-200/60 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 overflow-y-auto space-y-4 text-slate-700 text-sm">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Item Name *</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Organic Spinach, Whole Milk"
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as CategoryType)}
                className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium text-xs"
              >
                {CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Freshness Status</label>
              <select
                value={freshness}
                onChange={(e) => setFreshness(e.target.value as FreshnessStatus)}
                className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium text-xs"
              >
                <option value="fresh">Fresh 🟢</option>
                <option value="soon_to_expire">Shows Spots / Mold Risk 🟡</option>
                <option value="expired">Spoiled / Moldy 🔴</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Quantity</label>
              <input
                type="number"
                step="0.1"
                min="0.1"
                value={quantity}
                onChange={(e) => setQuantity(Number(e.target.value))}
                className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Unit</label>
              <input
                type="text"
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                placeholder="pcs, L, kg"
                className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Freshness Score</label>
              <input
                type="number"
                min="0"
                value={daysRemaining}
                onChange={(e) => setDaysRemaining(Number(e.target.value))}
                className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Fridge Location</label>
            <select
              value={locationInFridge}
              onChange={(e) => setLocationInFridge(e.target.value)}
              className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium text-xs"
            >
              <option value="Crisper Drawer">Crisper Drawer 🥬</option>
              <option value="Top Shelf">Top Shelf 🥛</option>
              <option value="Middle Shelf">Middle Shelf 🧀</option>
              <option value="Bottom Shelf">Bottom Shelf 🥩</option>
              <option value="Door Shelf">Door Shelf 🫙</option>
              <option value="Freezer">Freezer 🧊</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Notes / Tips</label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Opened on Tuesday, consume quickly"
              className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium text-xs resize-none"
            />
          </div>

          <div className="pt-2 flex items-center justify-between gap-3">
            {initialItem && onDelete && (
              <button
                type="button"
                onClick={() => {
                  onDelete(initialItem.id);
                  onClose();
                }}
                className="px-4 py-2.5 rounded-xl bg-rose-50 text-rose-600 hover:bg-rose-100 font-semibold text-xs flex items-center gap-1.5 transition-colors"
              >
                <Trash2 className="w-4 h-4" />
                Delete
              </button>
            )}

            <div className="flex items-center gap-2 ml-auto">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 rounded-xl bg-slate-100 text-slate-600 hover:bg-slate-200 font-semibold text-xs transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2.5 rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 font-semibold text-xs flex items-center gap-1.5 shadow-sm shadow-emerald-200 transition-all active:scale-95"
              >
                <Plus className="w-4 h-4" />
                {initialItem ? 'Update' : 'Add Item'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
