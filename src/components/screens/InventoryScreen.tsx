import React, { useState } from 'react';
import { 
  Package, 
  Search, 
  Plus, 
  Filter, 
  AlertTriangle, 
  CheckCircle2, 
  Clock, 
  Utensils, 
  Trash2, 
  Edit3,
  ChevronDown
} from 'lucide-react';
import { FoodItem, CategoryType, FreshnessStatus, TabType, AppSettings, LanguageType } from '../../types';
import { ItemModal } from '../ItemModal';
import { t, getLocalizedFoodItemName, getLocalizedCategory, getLocalizedLocation } from '../../utils/i18n';

interface InventoryScreenProps {
  inventory: FoodItem[];
  settings?: AppSettings;
  onSaveItem: (item: FoodItem) => void;
  onDeleteItem: (id: string) => void;
  onNavigateToRecipes: (filterIngredient?: string) => void;
}

export const InventoryScreen: React.FC<InventoryScreenProps> = ({
  inventory,
  settings,
  onSaveItem,
  onDeleteItem,
  onNavigateToRecipes,
}) => {
  const lang = (settings?.language || 'en') as LanguageType;
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<'all' | FreshnessStatus>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [editingItem, setEditingItem] = useState<FoodItem | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Filter Logic
  const filteredItems = inventory.filter((item) => {
    const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.notes && item.notes.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesFreshness = activeFilter === 'all' || item.freshness === activeFilter;
    const matchesCategory = selectedCategory === 'all' || item.category === selectedCategory;

    return matchesSearch && matchesFreshness && matchesCategory;
  });

  const categories = Array.from(new Set(inventory.map((i) => i.category)));

  const handleAddNew = () => {
    setEditingItem(null);
    setIsModalOpen(true);
  };

  const handleEdit = (item: FoodItem) => {
    setEditingItem(item);
    setIsModalOpen(true);
  };

  return (
    <div className="space-y-5 pb-20 max-w-md mx-auto">
      
      {/* Page Title Card */}
      <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-xs flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-black tracking-tighter leading-none text-slate-900">
            {t('fridgeInventory', lang).split(' ')[0]}<br/>
            {t('fridgeInventory', lang).split(' ').slice(1).join(' ') || 'INVENTORY'}
          </h2>
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mt-1">
            {filteredItems.length} {t('itemsLogged', lang)}
          </p>
        </div>

        <button
          onClick={handleAddNew}
          className="px-4 py-3 rounded-2xl bg-emerald-600 text-white font-black text-xs uppercase tracking-widest flex items-center gap-1.5 hover:bg-emerald-700 hover:scale-105 active:scale-95 transition-all duration-200 shadow-sm hover:shadow-md"
        >
          <Plus className="w-4 h-4" />
          {t('addItem', lang)}
        </button>
      </div>

      {/* Search & Filter Header */}
      <div className="space-y-2.5">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t('searchPlaceholder', lang)}
            className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-2xl text-xs font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-900 placeholder-slate-400 shadow-xs"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3.5 top-3 text-[10px] text-slate-400 hover:text-slate-600 font-black uppercase tracking-wider"
            >
              Clear
            </button>
          )}
        </div>

        {/* Freshness Status Filter Pills */}
        <div className="flex gap-2 overflow-x-auto scrollbar-none pb-1">
          {[
            { id: 'all', label: `${t('all', lang)} (${inventory.length})` },
            { id: 'soon_to_expire', label: `${t('expiringSoon', lang)} (${inventory.filter((i) => i.freshness === 'soon_to_expire').length})` },
            { id: 'fresh', label: `${t('fresh', lang)} (${inventory.filter((i) => i.freshness === 'fresh').length})` },
            { id: 'expired', label: `${t('expired', lang)} (${inventory.filter((i) => i.freshness === 'expired').length})` },
          ].map((pill) => (
            <button
              key={pill.id}
              onClick={() => setActiveFilter(pill.id as any)}
              className={`px-3 py-1.5 rounded-xl text-[10px] font-black tracking-wider whitespace-nowrap transition-all duration-200 hover:scale-105 active:scale-95 border ${
                activeFilter === pill.id
                  ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
              }`}
            >
              {pill.label}
            </button>
          ))}
        </div>
      </div>

      {/* Inventory List */}
      {filteredItems.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-3xl p-8 text-center space-y-3 shadow-xs">
          <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
            <Package className="w-6 h-6" />
          </div>
          <div>
            <h3 className="font-black text-slate-900 text-base uppercase tracking-tight">{t('noItemsFound', lang)}</h3>
          </div>
          <button
            onClick={handleAddNew}
            className="px-5 py-2.5 rounded-2xl bg-emerald-600 text-white font-black text-xs uppercase tracking-widest inline-flex items-center gap-1.5 shadow-xs"
          >
            <Plus className="w-4 h-4" />
            {t('addFirstItem', lang)}
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredItems.map((item, idx) => {
            const numStr = (idx + 1).toString().padStart(2, '0');
            const isExpiring = item.freshness === 'soon_to_expire';
            const isExpired = item.freshness === 'expired';

            return (
              <div
                key={item.id}
                className={`p-4 rounded-3xl border bg-white transition-all shadow-xs ${
                  isExpiring
                    ? 'border-amber-200 bg-amber-50/20'
                    : isExpired
                    ? 'border-rose-200 bg-rose-50/20'
                    : 'border-slate-200 hover:border-emerald-300'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-black text-slate-900 text-base leading-tight">{getLocalizedFoodItemName(item.name, lang)}</h3>
                      <span className="text-xs text-slate-500 font-bold">
                        ({item.quantity} {item.unit})
                      </span>
                    </div>

                    <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-wider text-slate-500">
                      <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700">
                        {getLocalizedCategory(item.category, lang)}
                      </span>
                      {item.locationInFridge && (
                        <span>• {getLocalizedLocation(item.locationInFridge, lang)}</span>
                      )}
                    </div>

                    {item.notes && (
                      <p className="text-xs text-slate-600 italic font-serif mt-1">{item.notes}</p>
                    )}
                  </div>

                  {/* Freshness Badge & Number */}
                  <div className="text-right shrink-0 flex flex-col items-end gap-1">
                    <span className="text-lg font-black text-slate-300 font-mono leading-none">{numStr}</span>
                    {isExpiring && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-100 text-amber-800 font-black text-[10px] uppercase tracking-wider border border-amber-200">
                        <AlertTriangle className="w-3 h-3 text-amber-600" />
                        {t('expiringSoon', lang)}
                      </span>
                    )}
                    {item.freshness === 'fresh' && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 font-black text-[10px] uppercase tracking-wider border border-emerald-200">
                        <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                        {t('fresh', lang)}
                      </span>
                    )}
                    {isExpired && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-rose-100 text-rose-800 font-black text-[10px] uppercase tracking-wider border border-rose-200">
                        <AlertTriangle className="w-3 h-3 text-rose-600" />
                        {t('expired', lang)}
                      </span>
                    )}
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between">
                  <button
                    onClick={() => onNavigateToRecipes(item.name)}
                    className="text-xs font-black text-emerald-800 hover:text-emerald-900 uppercase tracking-widest flex items-center gap-1 bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-100"
                  >
                    <Utensils className="w-3.5 h-3.5 text-emerald-600" />
                    {t('cookWithThis', lang)}
                  </button>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleEdit(item)}
                      className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                      title={t('edit', lang)}
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => onDeleteItem(item.id)}
                      className="p-1.5 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                      title={t('delete', lang)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Item Modal */}
      <ItemModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={onSaveItem}
        onDelete={onDeleteItem}
        initialItem={editingItem}
      />

    </div>
  );
};
