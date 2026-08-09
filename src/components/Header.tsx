import React from 'react';
import { Refrigerator, Sparkles, AlertCircle, Mic, Settings, Globe } from 'lucide-react';
import { TabType, LanguageType } from '../types';
import { t } from '../utils/i18n';

interface HeaderProps {
  activeTab: TabType;
  expiringCount: number;
  language?: LanguageType;
  onOpenLiveVoice: () => void;
  onNavigate: (tab: TabType) => void;
  onSelectLanguage?: (lang: LanguageType) => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  expiringCount,
  language = 'en',
  onOpenLiveVoice,
  onNavigate,
  onSelectLanguage,
}) => {
  const currentLang = (language || 'en') as LanguageType;

  const titles: Record<TabType, { title: string; subtitle: string }> = {
    home: {
      title: 'COLDSCAN',
      subtitle: t('appSubtitle', currentLang),
    },
    scan: {
      title: t('scanTitle', currentLang),
      subtitle: t('scanSubtitleHeader', currentLang),
    },
    inventory: {
      title: t('fridgeInventory', currentLang),
      subtitle: t('inventorySubtitleHeader', currentLang),
    },
    recipes: {
      title: t('recipesTitle', currentLang),
      subtitle: t('recipesSubtitleHeader', currentLang),
    },
    shopping: {
      title: t('shoppingListTitle', currentLang),
      subtitle: t('shoppingSubtitleHeader', currentLang),
    },
    cost: {
      title: t('financialSavingsTitle', currentLang),
      subtitle: t('costSubtitleHeader', currentLang),
    },
    settings: {
      title: t('settingsTitle', currentLang),
      subtitle: t('settingsSubtitleHeader', currentLang),
    },
  };

  return (
    <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200 px-3 py-2.5 shadow-xs">
      <div className="max-w-md md:max-w-2xl lg:max-w-4xl mx-auto flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <button 
            onClick={() => onNavigate('home')}
            className="w-10 h-10 bg-emerald-600 rounded-xl flex items-center justify-center text-white shadow-sm hover:scale-105 active:scale-95 hover:bg-emerald-700 transition-all duration-200 shrink-0"
          >
            <Refrigerator className="w-5 h-5 stroke-[2.5]" />
          </button>
          <div className="min-w-0">
            <h1 className="font-black tracking-tighter text-emerald-950 text-lg leading-none flex items-center gap-1.5 truncate">
              <span>{titles[activeTab].title}</span>
              {activeTab === 'home' && (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest bg-emerald-50 text-emerald-700 border border-emerald-200 shrink-0">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                  AI
                </span>
              )}
            </h1>
            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-tight mt-0.5 truncate">
              {titles[activeTab].subtitle}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {/* Quick Language Toggle Button: EN / FR */}
          {onSelectLanguage && (
            <div className="flex items-center p-0.5 rounded-xl bg-slate-100 border border-slate-200 text-[10px] font-black">
              <button
                onClick={() => onSelectLanguage('en')}
                className={`px-1.5 py-1 rounded-lg transition-all flex items-center gap-0.5 ${
                  currentLang === 'en'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title="Switch to English"
              >
                <span>🇬🇧</span>
                <span className="font-bold">EN</span>
              </button>
              <button
                onClick={() => onSelectLanguage('fr')}
                className={`px-1.5 py-1 rounded-lg transition-all flex items-center gap-0.5 ${
                  currentLang === 'fr'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title="Passer en Français"
              >
                <span>🇫🇷</span>
                <span className="font-bold">FR</span>
              </button>
            </div>
          )}

          {expiringCount > 0 && activeTab !== 'inventory' && (
            <button
              onClick={() => onNavigate('inventory')}
              className="relative px-2 py-1.5 rounded-xl bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100 hover:scale-105 active:scale-95 transition-all duration-200 flex items-center gap-1 text-xs font-black shadow-xs"
              title={`${expiringCount} items expiring soon`}
            >
              <AlertCircle className="w-4 h-4 text-rose-600 animate-pulse" />
              <span className="font-mono text-xs">{expiringCount}</span>
            </button>
          )}

          <button
            onClick={onOpenLiveVoice}
            className="flex items-center gap-1 bg-emerald-50 px-2 py-1.5 rounded-xl border border-emerald-200 hover:bg-emerald-100 hover:scale-105 active:scale-95 transition-all duration-200 shadow-xs"
            title="Talk to Gemini Live Assistant"
          >
            <Mic className="w-3.5 h-3.5 text-emerald-700" />
            <span className="text-[10px] font-black text-emerald-700 uppercase tracking-wider hidden sm:inline">
              {t('askLive', currentLang)}
            </span>
          </button>

          <button
            onClick={() => onNavigate('settings')}
            className={`p-2 rounded-xl border transition-all duration-200 hover:scale-105 active:scale-95 ${
              activeTab === 'settings'
                ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                : 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200'
            }`}
            title="Settings"
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
};

