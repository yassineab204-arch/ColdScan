import React, { useState } from 'react';
import { 
  ShoppingBag, 
  CheckSquare, 
  Square, 
  Plus, 
  Trash2, 
  DollarSign, 
  ArrowRight, 
  PackageCheck,
  Tag,
  Sparkles,
  Copy,
  Check,
  Share2
} from 'lucide-react';
import { ShoppingItem, CategoryType, FoodItem, AppSettings, LanguageType } from '../../types';
import { convertCurrency } from '../../utils/currency';
import { t, getLocalizedFoodItemName, getLocalizedCategory, getLocalizedRecipeName } from '../../utils/i18n';

interface ShoppingListScreenProps {
  shoppingList: ShoppingItem[];
  settings?: AppSettings;
  onToggleBought: (id: string) => void;
  onAddItem: (item: ShoppingItem) => void;
  onRemoveItem: (id: string) => void;
  onMoveBoughtToInventory: () => void;
  onGenerateSmartList: () => void;
  isGeneratingList: boolean;
}

export const ShoppingListScreen: React.FC<ShoppingListScreenProps> = ({
  shoppingList,
  settings,
  onToggleBought,
  onAddItem,
  onRemoveItem,
  onMoveBoughtToInventory,
  onGenerateSmartList,
  isGeneratingList,
}) => {
  const lang = (settings?.language || 'en') as LanguageType;
  const currency = settings?.currency || 'DH';
  const [newItemName, setNewItemName] = useState('');
  const [newItemPrice, setNewItemPrice] = useState(() => convertCurrency(15, 'DH', currency).toFixed(2));
  const [copiedToast, setCopiedToast] = useState(false);

  const boughtCount = shoppingList.filter((i) => i.isBought).length;
  const unboughtList = shoppingList.filter((i) => !i.isBought);
  const totalCost = shoppingList.reduce((acc, curr) => acc + (curr.isBought ? 0 : curr.estimatedPrice), 0);

  const handleCopyList = () => {
    if (shoppingList.length === 0) return;

    const listText = shoppingList
      .map((item) => `${item.isBought ? '✅' : '🛒'} ${item.name} (${item.quantity} ${item.unit}) - ${item.estimatedPrice.toFixed(2)} ${currency}`)
      .join('\n');

    const fullMessage = `🛒 ${t('shoppingListTitle', lang)}:\n\n${listText}\n\n${t('totalEst', lang)}: ${totalCost.toFixed(2)} ${currency}`;

    navigator.clipboard.writeText(fullMessage);
    setCopiedToast(true);
    setTimeout(() => setCopiedToast(false), 2500);
  };

  const handleClearBought = () => {
    shoppingList.filter((i) => i.isBought).forEach((i) => onRemoveItem(i.id));
  };

  const handleAddCustom = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItemName.trim()) return;

    const customItem: ShoppingItem = {
      id: `shop-custom-${Date.now()}`,
      name: newItemName.trim(),
      category: 'Pantry & Other',
      quantity: 1,
      unit: 'item',
      estimatedPrice: Number(newItemPrice) || 15.00,
      isBought: false,
      priority: 'medium',
    };

    onAddItem(customItem);
    setNewItemName('');
  };

  return (
    <div className="space-y-4 pb-20 max-w-md mx-auto">
      
      {/* Toast popup */}
      {copiedToast && (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 z-50 bg-slate-900 text-emerald-400 text-xs font-black uppercase tracking-widest px-4 py-2.5 rounded-full shadow-2xl flex items-center gap-2 border border-emerald-500/30 animate-in fade-in slide-in-from-top-4">
          <Check className="w-4 h-4 text-emerald-400" />
          <span>Shopping List Copied to Clipboard!</span>
        </div>
      )}

      {/* Header Cost Summary Card */}
      <div className="bg-white border border-slate-200 rounded-3xl p-4 sm:p-5 shadow-xs space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <h2 className="text-2xl sm:text-3xl font-black tracking-tighter leading-none text-slate-900">
              {t('shoppingListTitle', lang)}
            </h2>
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mt-1">
              {shoppingList.length} {t('itemsToBuy', lang)}
            </p>
          </div>

          <div className="text-left sm:text-right">
            <span className="text-[10px] font-black uppercase tracking-widest text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-md">
              {t('totalEst', lang)}
            </span>
            <div className="text-2xl font-black tracking-tighter text-slate-900 mt-0.5">
              {totalCost.toFixed(2)} {currency}
            </div>
          </div>
        </div>

        {/* Quick Action Bar */}
        <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-100">
          <button
            onClick={onGenerateSmartList}
            disabled={isGeneratingList}
            className="py-3 px-3 rounded-2xl bg-emerald-600 text-white font-black text-xs uppercase tracking-widest hover:bg-emerald-700 hover:scale-105 active:scale-95 transition-all duration-200 flex items-center justify-center gap-1.5 shadow-xs disabled:opacity-50"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>{isGeneratingList ? t('thinkingRecipes', lang) : t('generateRecipes', lang)}</span>
          </button>

          <button
            onClick={handleCopyList}
            disabled={shoppingList.length === 0}
            className="py-3 px-3 rounded-2xl bg-slate-100 text-slate-800 font-black text-xs uppercase tracking-widest hover:bg-slate-200 hover:scale-105 active:scale-95 transition-all duration-200 flex items-center justify-center gap-1.5 shadow-xs disabled:opacity-40"
          >
            <Copy className="w-3.5 h-3.5 text-slate-600" />
            <span>{t('copyList', lang)}</span>
          </button>
        </div>

        {boughtCount > 0 && (
          <div className="flex gap-2 pt-2 border-t border-slate-100">
            <button
              onClick={onMoveBoughtToInventory}
              className="flex-1 py-2.5 px-3 rounded-xl bg-slate-900 text-emerald-400 font-black text-[11px] uppercase tracking-widest hover:bg-slate-800 transition-colors flex items-center justify-center gap-1.5 shadow-xs"
            >
              <PackageCheck className="w-3.5 h-3.5" />
              <span>Restock Bought ({boughtCount})</span>
            </button>
            <button
              onClick={handleClearBought}
              className="px-3 py-2.5 rounded-xl bg-rose-50 text-rose-700 border border-rose-200 font-black text-[10px] uppercase tracking-wider hover:bg-rose-100 transition-colors"
            >
              Clear Done
            </button>
          </div>
        )}
      </div>

      {/* Add Custom Item Input */}
      <form onSubmit={handleAddCustom} className="flex items-stretch gap-2">

        <input
          type="text"
          value={newItemName}
          onChange={(e) => setNewItemName(e.target.value)}
          placeholder="Add item e.g. Olive Oil, Garlic, Oats..."
          className="min-w-0 flex-1 px-3.5 py-2.5 bg-white border border-slate-200 rounded-2xl text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 shadow-xs"
        />
        <div className="w-20 sm:w-24 relative flex items-center shrink-0">
          <input
            type="number"
            step="1"
            value={newItemPrice}
            onChange={(e) => setNewItemPrice(e.target.value)}
            className="w-full pl-3 pr-7 py-2.5 bg-white border border-slate-200 rounded-2xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 shadow-xs"
          />
          <span className="absolute right-2 text-[10px] font-black text-slate-400">{currency}</span>
        </div>
        <button
          type="submit"
          className="p-2.5 rounded-2xl bg-emerald-600 text-white font-bold text-xs hover:bg-emerald-700 transition-colors shadow-xs shrink-0"
        >
          <Plus className="w-4 h-4" />
        </button>
      </form>

      {/* Shopping List Items */}
      {shoppingList.length === 0 ? (
        <div className="bg-white border border-slate-200/80 rounded-2xl p-8 text-center space-y-3">
          <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
            <ShoppingBag className="w-6 h-6" />
          </div>
          <div>
            <h3 className="font-bold text-slate-800 text-sm">Shopping List is Empty</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Add missing ingredients from recipes or use Auto-Fill to restock essentials.
            </p>
          </div>
          <button
            onClick={onGenerateSmartList}
            className="px-4 py-2 rounded-xl bg-emerald-600 text-white font-semibold text-xs inline-flex items-center gap-1"
          >
            <Sparkles className="w-3.5 h-3.5" />
            Auto-Generate List
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {shoppingList.map((item) => (
            <div
              key={item.id}
              className={`p-3.5 rounded-2xl border transition-all flex items-start gap-2 text-xs ${
                item.isBought
                  ? 'bg-slate-50 border-slate-200 opacity-60 line-through'
                  : 'bg-white border-slate-200/80 hover:border-emerald-300 shadow-xs'
              }`}
            >
              <div className="flex items-start gap-3 min-w-0 flex-1">
                <button
                  onClick={() => onToggleBought(item.id)}
                  className="text-emerald-600 hover:scale-110 transition-transform"
                >
                  {item.isBought ? (
                    <CheckSquare className="w-5 h-5 text-emerald-600" />
                  ) : (
                    <Square className="w-5 h-5 text-slate-300" />
                  )}
                </button>

                <div className="min-w-0">
                  <div className="font-bold text-slate-800 text-sm break-words">{getLocalizedFoodItemName(item.name, lang)}</div>
                  <div className="text-[11px] text-slate-500 font-medium">
                    {getLocalizedCategory(item.category, lang)} • {item.quantity} {item.unit}
                    {item.relatedRecipe && (
                      <span className="text-emerald-700 ml-1">({getLocalizedRecipeName(item.relatedRecipe, lang)})</span>
                    )}
                  </div>
                </div>
              </div>

              <div className="shrink-0 flex items-center gap-1.5">
                <span className="font-black text-emerald-800 bg-emerald-50 px-2 py-1 rounded-lg border border-emerald-100 text-[11px] whitespace-nowrap">
                  {item.estimatedPrice.toFixed(2)} {currency}
                </span>
                <button
                  onClick={() => onRemoveItem(item.id)}
                  className="p-1 text-slate-300 hover:text-rose-600 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

    </div>
  );
};
