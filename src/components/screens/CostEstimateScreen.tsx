import React from 'react';
import { 
  DollarSign, 
  TrendingDown, 
  PieChart, 
  Sparkles, 
  ShieldCheck, 
  HelpCircle, 
  ArrowUpRight,
  Package,
  PiggyBank,
  CheckCircle2
} from 'lucide-react';
import { ShoppingItem, FoodItem, AppSettings, LanguageType } from '../../types';
import { convertCurrency } from '../../utils/currency';
import { t, getLocalizedCategory } from '../../utils/i18n';

interface CostEstimateScreenProps {
  shoppingList: ShoppingItem[];
  inventory: FoodItem[];
  settings: AppSettings;
}

export const CostEstimateScreen: React.FC<CostEstimateScreenProps> = ({
  shoppingList,
  inventory,
  settings,
}) => {
  const lang = (settings.language || 'en') as LanguageType;
  const missingItemsTotal = shoppingList.reduce((acc, item) => acc + item.estimatedPrice, 0);

  // Group shopping costs by category
  const categoryBreakdown: Record<string, number> = shoppingList.reduce((acc, item) => {
    acc[item.category] = (acc[item.category] || 0) + item.estimatedPrice;
    return acc;
  }, {} as Record<string, number>);

  const sortedCategories: [string, number][] = (Object.entries(categoryBreakdown) as [string, number][]).sort(
    (a, b) => b[1] - a[1]
  );

  // Waste Reduction Savings Math
  const currency = settings.currency || 'DH';
  const rescuedCount = inventory.filter((i) => i.freshness === 'soon_to_expire').length;
  const estimatedSavingsThisMonth = convertCurrency(inventory.length * 35 + 140, 'DH', currency).toFixed(2);

  const tips = [
    {
      title: 'Freeze Expiring Spinach & Herbs',
      description: 'Blend expiring greens with olive oil into ice cube trays for easy pasta flavor bombs.',
      savings: `${convertCurrency(120, 'DH', currency).toFixed(2)} ${currency} / mo`,
    },
    {
      title: 'Store Tomatoes at Room Temperature',
      description: 'Refrigerating un-cut tomatoes destroys flavor and makes them meal-mealy faster.',
      savings: `${convertCurrency(80, 'DH', currency).toFixed(2)} ${currency} / mo`,
    },
    {
      title: 'Buy Whole Produce Over Pre-Cut',
      description: 'Pre-cut vegetables carry a 40% markup and spoil in half the time.',
      savings: `${convertCurrency(250, 'DH', currency).toFixed(2)} ${currency} / mo`,
    },
  ];

  return (
    <div className="space-y-4 pb-20 max-w-md mx-auto">
      
      {/* Top Cost & Savings Summary */}
      <div className="bg-white border border-slate-200 rounded-3xl p-4 sm:p-5 shadow-xs space-y-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <h2 className="text-2xl sm:text-3xl font-black tracking-tighter leading-none text-slate-900">
              {t('financialSavingsTitle', lang)}
            </h2>
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mt-1">
              {t('monthlyBudget', lang)}: {settings.userBudget} {currency}
            </p>
          </div>

          <span className="text-[10px] font-black uppercase tracking-widest text-emerald-700 bg-emerald-100 px-2.5 py-1 rounded-md">
            {t('estAnalytics', lang)}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-3 pt-1 border-t border-slate-100">
          <div className="bg-slate-50 rounded-2xl p-3.5 border border-slate-200/80">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-0.5">{t('missingCost', lang)}</p>
            <p className="text-2xl font-black tracking-tighter text-slate-900">{missingItemsTotal.toFixed(2)} {currency}</p>
            <span className="text-[9px] font-black uppercase tracking-wider text-slate-500">{shoppingList.length} {t('itemsLogged', lang)}</span>
          </div>

          <div className="bg-emerald-600 rounded-2xl p-3.5 text-white border border-emerald-500 shadow-xs">
            <p className="text-[10px] font-black uppercase tracking-widest text-emerald-200 mb-0.5">{t('estSavedMo', lang)}</p>
            <p className="text-2xl font-black tracking-tighter text-white">{estimatedSavingsThisMonth} {currency}</p>
            <span className="text-[9px] font-black uppercase tracking-wider text-emerald-100">{rescuedCount} {t('fresh', lang)}</span>
          </div>
        </div>
      </div>

      {/* Expense Breakdown by Category */}
      <div className="bg-white border border-slate-200/80 rounded-3xl p-4 shadow-xs space-y-3">
        <h3 className="font-bold text-slate-800 text-sm flex items-center justify-between">
          <span>Shopping Category Breakdown</span>
          <span className="text-xs text-slate-500 font-normal">Est. Prices</span>
        </h3>

        {sortedCategories.length === 0 ? (
          <p className="text-xs text-slate-500 py-3 text-center">
            Your shopping list is empty. Add items to see expense breakdown.
          </p>
        ) : (
          <div className="space-y-2.5">
            {sortedCategories.map(([cat, amount]) => {
              const percent = missingItemsTotal > 0 ? Math.round((amount / missingItemsTotal) * 100) : 0;

              return (
                <div key={cat} className="space-y-1">
                  <div className="flex items-center justify-between text-xs font-semibold text-slate-700">
                    <span>{getLocalizedCategory(cat, lang)}</span>
                    <span className="text-emerald-700">{amount.toFixed(2)} {currency} ({percent}%)</span>
                  </div>
                  <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                      style={{ width: `${percent}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Money-Saving Tips */}
      <div className="space-y-2.5">
        <h3 className="font-bold text-slate-800 text-sm flex items-center gap-1.5">
          <PiggyBank className="w-4 h-4 text-emerald-600" />
          Grocery Money-Saving Hacks
        </h3>

        <div className="space-y-2">
          {tips.map((tip, idx) => (
            <div
              key={idx}
              className="p-3.5 bg-white border border-slate-200/80 rounded-2xl shadow-xs space-y-1 hover:border-emerald-300 transition-colors"
            >
              <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                <h4 className="font-bold text-slate-800 text-xs">{tip.title}</h4>
                <span className="text-[10px] font-extrabold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-100">
                  Save {tip.savings}
                </span>
              </div>
              <p className="text-[11px] text-slate-600 leading-relaxed">{tip.description}</p>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
};
