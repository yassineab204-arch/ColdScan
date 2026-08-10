import React from 'react';
import { 
  Camera, 
  Sparkles, 
  Utensils, 
  ShoppingBag, 
  AlertTriangle, 
  TrendingUp, 
  DollarSign, 
  ShieldCheck, 
  ChevronRight, 
  ArrowRight,
  Package,
  Mic,
  Clock,
  Settings,
  Globe,
  Sliders,
  Volume2,
  MessageCircle
} from 'lucide-react';
import { FoodItem, Recipe, TabType, AppSettings, LanguageType } from '../../types';
import { convertCurrency, formatCurrencyAmount } from '../../utils/currency';
import { t, getLocalizedFoodItemName, getLocalizedRecipeName } from '../../utils/i18n';

interface HomeScreenProps {
  inventory: FoodItem[];
  recipes: Recipe[];
  settings?: AppSettings;
  onUpdateSettings?: (settings: Partial<AppSettings>) => void;
  onNavigate: (tab: TabType) => void;
  onOpenLiveVoice: () => void;
  onOpenAssistant?: () => void;
  onQuickScan: () => void;
}

export const HomeScreen: React.FC<HomeScreenProps> = ({
  inventory,
  recipes,
  settings = { userBudget: 500, currency: 'DH', language: 'en', voiceOutputEnabled: true, wasteAlertDays: 3, dietaryPreferences: ['Low Waste'] },
  onUpdateSettings,
  onNavigate,
  onOpenLiveVoice,
  onOpenAssistant,
  onQuickScan,
}) => {
  const currency = settings.currency || 'DH';
  const currentLang = (settings.language || 'en') as LanguageType;
  const expiringItems = inventory.filter((i) => i.freshness === 'soon_to_expire');
  const expiredItems = inventory.filter((i) => i.freshness === 'expired');
  const freshItems = inventory.filter((i) => i.freshness === 'fresh');

  // Calculate counts
  const totalItemsCount = inventory.length;
  const topWasteReducerRecipe = recipes.find((r) => r.usesExpiringItems) || recipes[0];

  const languagesList = [
    { id: 'en' as LanguageType, label: 'EN', flag: '🇬🇧', name: 'English' },
    { id: 'fr' as LanguageType, label: 'FR', flag: '🇫🇷', name: 'Français' },
    { id: 'ar-MA' as LanguageType, label: 'Darija', flag: '🇲🇦', name: 'الدارجة' },
    { id: 'es' as LanguageType, label: 'ES', flag: '🇪🇸', name: 'Español' },
    { id: 'de' as LanguageType, label: 'DE', flag: '🇩🇪', name: 'Deutsch' },
    { id: 'ar' as LanguageType, label: 'AR', flag: '🇸🇦', name: 'العربية' },
    { id: 'it' as LanguageType, label: 'IT', flag: '🇮🇹', name: 'Italiano' },
    { id: 'pt' as LanguageType, label: 'PT', flag: '🇵🇹', name: 'Português' },
    { id: 'ja' as LanguageType, label: 'JA', flag: '🇯🇵', name: '日本語' },
  ];

  return (
    <div className="space-y-5 pb-20 max-w-md mx-auto">
      
      {/* Quick Settings & Famous Languages Bar on Home */}
      <div className="bg-white border border-slate-200 rounded-2xl p-3 shadow-xs space-y-2.5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 min-w-0">
            <Globe className="w-4 h-4 text-emerald-600 shrink-0" />
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-700">{t('quickAiLanguage', currentLang)}</span>
          </div>
          <button
            onClick={() => onNavigate('settings')}
            className="shrink-0 flex items-center gap-1 text-[10px] font-black uppercase tracking-wider text-emerald-700 bg-emerald-50 px-2 py-1 rounded-lg border border-emerald-100 hover:bg-emerald-100 transition-colors"
          >
            <Settings className="w-3 h-3 text-emerald-600" />
            <span>{t('allSettings', currentLang)}</span>
          </button>
        </div>

        {/* Famous Languages Pill Bar */}
        <div className="flex gap-1.5 overflow-x-auto scrollbar-none py-1">
          {languagesList.map((lang) => (
            <button
              key={lang.id}
              onClick={() => onUpdateSettings?.({ language: lang.id })}
              className={`px-2.5 py-1 rounded-xl text-[11px] font-black flex items-center gap-1 transition-all shrink-0 whitespace-nowrap ${
                currentLang === lang.id
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              <span>{lang.flag}</span>
              <span>{lang.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Live Scanner & Voice Banner (Dark & High Contrast) */}
      <div className="bg-slate-900 text-white rounded-3xl p-5 relative overflow-hidden flex flex-col border-4 border-emerald-500/30 shadow-lg">
        <div className="flex justify-between items-center mb-3">
          <span className="bg-emerald-500 text-white text-[10px] font-black px-2.5 py-1 rounded tracking-widest uppercase">
            {t('liveScanner', currentLang)}
          </span>
          <div className="flex items-center gap-1.5 text-emerald-400 font-mono text-xs font-bold">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            {t('active', currentLang)}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 my-2">
          <div className="bg-white/10 rounded-2xl p-2 sm:p-3 border border-white/10 text-center">
            <p className="text-white/60 text-[8px] sm:text-[9px] font-black uppercase tracking-widest leading-tight mb-1">{t('fridgeItems', currentLang)}</p>
            <p className="text-xl sm:text-2xl font-black tracking-tighter text-white">{totalItemsCount}</p>
          </div>

          <div className="bg-white/10 rounded-2xl p-2 sm:p-3 border border-white/10 text-center">
            <p className="text-white/60 text-[8px] sm:text-[9px] font-black uppercase tracking-widest leading-tight mb-1">{t('fresh', currentLang)}</p>
            <p className="text-xl sm:text-2xl font-black tracking-tighter text-emerald-400">{freshItems.length}</p>
          </div>

          <div className="bg-white/10 rounded-2xl p-2 sm:p-3 border border-white/10 text-center">
            <p className="text-white/60 text-[8px] sm:text-[9px] font-black uppercase tracking-widest leading-tight mb-1">{t('soonToExpire', currentLang)}</p>
            <p className="text-xl sm:text-2xl font-black tracking-tighter text-amber-400">{expiringItems.length}</p>
          </div>
        </div>

        <div className="my-3 bg-white/10 backdrop-blur-md rounded-2xl p-3.5 border border-white/20">
          <p className="text-white/60 text-[10px] font-black uppercase tracking-widest mb-1">
            {t('assistantThinking', currentLang)}
          </p>
          <p className="text-white text-xs font-serif italic font-medium leading-relaxed">
            "{expiringItems.length > 0 
              ? `${getLocalizedFoodItemName(expiringItems[0].name, currentLang)} ${t('expiringSoon', currentLang)}`
              : `${freshItems.length} ${t('fresh', currentLang)}`}"
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2 mt-1">
          <button
            onClick={onQuickScan}
            className="min-w-0 py-3 px-2 sm:px-3 rounded-2xl bg-emerald-500 text-slate-900 font-black text-[10px] sm:text-xs uppercase tracking-widest flex items-center justify-center gap-1.5 whitespace-nowrap hover:bg-emerald-400 hover:scale-[1.03] active:scale-[0.97] transition-all duration-200 shadow-md hover:shadow-emerald-500/30"
          >
            <Camera className="w-4 h-4" />
            {t('scanNow', currentLang)}
          </button>

          <button
            onClick={onOpenLiveVoice}
            className="min-w-0 py-3 px-2 sm:px-3 rounded-2xl bg-white/15 text-white font-black text-[10px] sm:text-xs uppercase tracking-widest border border-white/20 flex items-center justify-center gap-1.5 whitespace-nowrap hover:bg-white/25 hover:scale-[1.03] active:scale-[0.97] transition-all duration-200 shadow-xs"
          >
            <Mic className="w-4 h-4 text-emerald-400" />
            {t('liveVoice', currentLang)}
          </button>
        </div>
      </div>

      {/* Main Section Header: Bold Typography Style */}
      <div className="bg-white rounded-3xl p-5 shadow-xs border border-slate-200">
        <div className="flex justify-between items-end gap-2 mb-4">
          <h2 className="text-2xl sm:text-3xl font-black tracking-tighter leading-none text-slate-900">
            {t('yourFridge', currentLang)}
          </h2>
          <button
            onClick={() => onNavigate('inventory')}
            className="shrink-0 text-emerald-700 font-black text-[10px] sm:text-xs uppercase tracking-widest hover:underline"
          >
            {t('viewAll', currentLang)} ({inventory.length})
          </button>
        </div>

        {/* List of Expiring & Featured Items with Big Bold Numbers */}
        <div className="space-y-2.5">
          {inventory.slice(0, 3).map((item, idx) => {
            const numStr = (idx + 1).toString().padStart(2, '0');
            const isExpiring = item.freshness === 'soon_to_expire';
            const isExpired = item.freshness === 'expired';

            return (
              <div
                key={item.id}
                className={`flex items-center justify-between p-3.5 rounded-2xl border ${
                  isExpired
                    ? 'bg-rose-50 border-rose-200 text-rose-900'
                    : isExpiring
                    ? 'bg-amber-50 border-amber-200 text-amber-900'
                    : 'bg-emerald-50/60 border-emerald-100 text-slate-800'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="text-xl">
                    {item.category.includes('Dairy') ? '🥛' : item.category.includes('Produce') ? '🥬' : '📦'}
                  </div>
                  <div>
                    <p className="font-black text-slate-900 text-sm leading-none">{getLocalizedFoodItemName(item.name, currentLang)}</p>
                    <p className={`text-[10px] font-black uppercase tracking-tighter mt-1 ${
                      isExpired ? 'text-rose-600' : isExpiring ? 'text-amber-700' : 'text-emerald-700'
                    }`}>
                      {isExpired ? t('expired', currentLang) : isExpiring ? t('expiringSoon', currentLang) : t('fresh', currentLang)}
                    </p>
                  </div>
                </div>

                <span className={`text-xl font-black ${
                  isExpired ? 'text-rose-700' : isExpiring ? 'text-amber-700' : 'text-emerald-700'
                }`}>
                  {numStr}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Featured Recipe Pick Section (Bold Emerald Card) */}
      {topWasteReducerRecipe && (
        <div className="bg-emerald-600 rounded-3xl p-5 text-white flex flex-col shadow-md">
          <div className="flex items-center justify-between mb-2">
            <span className="bg-emerald-900/40 text-emerald-200 text-[9px] font-black px-2.5 py-0.5 rounded uppercase tracking-widest border border-emerald-400/20">
              {t('featuredRecipe', currentLang)}
            </span>
            <span className="text-xs font-black text-emerald-200">{topWasteReducerRecipe.cookTimeMinutes} {t('mins', currentLang)}</span>
          </div>

          <h2 className="text-3xl font-black tracking-tighter leading-none mb-3">
            {t('recipePick', currentLang)}
          </h2>

          <div className="bg-white/10 rounded-2xl p-4 border border-white/20 mb-4">
            <p className="text-lg font-black italic font-serif leading-snug">{getLocalizedRecipeName(topWasteReducerRecipe.name, currentLang)}</p>
            <p className="text-xs text-emerald-100 mt-1 font-semibold">
              {t('usesFridgeItems', currentLang)} ({topWasteReducerRecipe.ingredientsHas.length})
            </p>
          </div>

          <div className="mt-auto flex justify-between items-center">
            <div className="text-xs font-black uppercase tracking-widest text-emerald-100">
              {topWasteReducerRecipe.calories} kcal
            </div>
            <button
              onClick={() => onNavigate('recipes')}
              className="bg-white text-emerald-900 px-4 py-2 rounded-full font-black text-xs uppercase tracking-widest hover:bg-emerald-50 hover:scale-105 active:scale-95 transition-all duration-200 shadow-sm hover:shadow-md"
            >
              {t('startCooking', currentLang)}
            </button>
          </div>
        </div>
      )}

      {/* Quick Access Grid Buttons */}
      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={() => onNavigate('shopping')}
          className="bg-white rounded-3xl p-4 border border-slate-200 shadow-xs hover:border-emerald-400 hover:scale-[1.03] active:scale-[0.97] hover:shadow-md transition-all duration-200 text-left flex flex-col justify-between h-28 group"
        >
          <div className="w-8 h-8 rounded-xl bg-slate-100 group-hover:bg-emerald-100 group-hover:text-emerald-700 flex items-center justify-center text-slate-800 transition-colors">
            <ShoppingBag className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-black text-slate-900 text-sm tracking-tight uppercase group-hover:text-emerald-700 transition-colors">{t('shoppingCardTitle', currentLang)}</h3>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{t('autoFillMissing', currentLang)}</p>
          </div>
        </button>

        <button
          onClick={() => onNavigate('recipes')}
          className="bg-white rounded-3xl p-4 border border-slate-200 shadow-xs hover:border-emerald-400 hover:scale-[1.03] active:scale-[0.97] hover:shadow-md transition-all duration-200 text-left flex flex-col justify-between h-28 group"
        >
          <div className="w-8 h-8 rounded-xl bg-slate-100 group-hover:bg-emerald-100 group-hover:text-emerald-700 flex items-center justify-center text-slate-800 transition-colors">
            <Utensils className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-black text-slate-900 text-sm tracking-tight uppercase group-hover:text-emerald-700 transition-colors">{t('recipesTitle', currentLang)}</h3>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{t('recipesSubtitleHeader', currentLang)}</p>
          </div>
        </button>
      </div>

      {/* Home Quick Settings Card */}
      <div className="bg-white rounded-3xl p-4 border border-slate-200 shadow-xs space-y-3">
        <div className="flex items-center justify-between pb-2 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-black">
              <Sliders className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-black text-xs text-slate-900 uppercase tracking-wider">{t('homeSettingsControls', currentLang)}</h3>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tight">{t('appPreferences', currentLang)}</p>
            </div>
          </div>
          <button
            onClick={() => onNavigate('settings')}
            className="text-[10px] font-black uppercase text-emerald-700 hover:underline flex items-center gap-0.5"
          >
            {t('manage', currentLang)} <ChevronRight className="w-3 h-3" />
          </button>
        </div>

        <div className="bg-slate-50 p-2.5 rounded-2xl border border-slate-200">
          <label className="text-[9px] font-black uppercase text-slate-400 tracking-wider block mb-1">
            {t('currency', currentLang)}
          </label>
          <select
            value={settings.currency || 'DH'}
            onChange={(e) => onUpdateSettings?.({ currency: e.target.value })}
            className="w-full bg-white border border-slate-200 rounded-xl px-2 py-1 text-xs font-black text-slate-800"
          >
            <option value="DH">DH (Dirhams)</option>
            <option value="MAD">MAD (Moroccan Dirham)</option>
            <option value="$">$ (USD)</option>
            <option value="€">€ (EUR)</option>
            <option value="£">£ (GBP)</option>
          </select>
        </div>
      </div>

      {/* Floating AI Chat Button */}
      {onOpenAssistant && (
        <button
          onClick={onOpenAssistant}
          aria-label={t('askAiTitle', currentLang)}
          title={t('askAiTitle', currentLang)}
          className="fixed bottom-20 right-4 sm:right-6 z-30 flex items-center gap-2 bg-emerald-600 text-white pl-3 pr-4 py-3 rounded-full shadow-lg shadow-emerald-600/30 hover:bg-emerald-700 hover:scale-105 active:scale-95 transition-all duration-200"
        >
          <MessageCircle className="w-5 h-5" />
          <span className="text-xs font-black uppercase tracking-wider">{t('askAi', currentLang)}</span>
          <span className="absolute -top-1 -right-1 flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-300 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-400 ring-2 ring-white"></span>
          </span>
        </button>
      )}

    </div>
  );
};
