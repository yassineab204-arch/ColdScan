import React from 'react';
import {
  Home,
  Camera,
  Package,
  Utensils,
  ShoppingBag,
} from 'lucide-react';
import { TabType, LanguageType } from '../types';
import { t } from '../utils/i18n';

interface NavigationProps {
  activeTab: TabType;
  onNavigate: (tab: TabType) => void;
  expiringCount: number;
  shoppingCount: number;
  language?: LanguageType;
  /** Hide the bar (e.g. on the marketing landing page, which uses the navbar + hamburger). */
  visible?: boolean;
}

export const Navigation: React.FC<NavigationProps> = ({
  activeTab,
  onNavigate,
  expiringCount,
  shoppingCount,
  language = 'en',
  visible = true,
}) => {
  const lang = (language || 'en') as LanguageType;
  const tabs = [
    { id: 'home' as TabType, label: t('home', lang), icon: Home },
    { id: 'inventory' as TabType, label: t('fridge', lang), icon: Package, badge: expiringCount },
    { id: 'scan' as TabType, label: t('scan', lang), icon: Camera, highlight: true },
    { id: 'recipes' as TabType, label: t('recipes', lang), icon: Utensils },
    { id: 'shopping' as TabType, label: t('shopping', lang), icon: ShoppingBag, badge: shoppingCount },
  ];

  if (!visible) return null;

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white/92 backdrop-blur-xl border-t border-ink/[0.07] px-2 sm:px-3 pt-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] shadow-[0_-12px_40px_-20px_rgba(11,61,46,0.25)]">
      <div className="w-full max-w-md mx-auto flex items-center justify-between gap-0.5 sm:gap-2 sm:justify-around">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;

          if (tab.highlight) {
            return (
              <button
                key={tab.id}
                onClick={() => onNavigate(tab.id)}
                className="relative -top-4 sm:-top-5 flex min-w-0 flex-1 sm:flex-none flex-col items-center group transition-all duration-200 hover:-translate-y-1"
              >
                <div className={`w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-cold text-pine-deep border-4 border-white shadow-[0_12px_30px_-10px_rgba(34,197,94,0.8)] flex items-center justify-center transition-all duration-200 hover:scale-110 active:scale-90 ${
                  isActive ? 'ring-4 ring-cold/25 bg-cold-dark text-white' : ''
                }`}>
                  <Icon className="w-5 h-5 sm:w-6 sm:h-6 stroke-[2.5]" />
                </div>
                <span className={`text-[8px] sm:text-[9px] font-bold uppercase tracking-wide sm:tracking-widest whitespace-nowrap mt-1 transition-colors ${
                  isActive ? 'text-cold-dark' : 'text-ink/35 group-hover:text-cold-dark'
                }`}>
                  {tab.label}
                </span>
              </button>
            );
          }

          return (
            <button
              key={tab.id}
              onClick={() => onNavigate(tab.id)}
              className={`relative min-w-0 flex flex-1 sm:flex-none flex-col items-center py-1 px-1 sm:px-2.5 transition-all duration-200 hover:scale-110 active:scale-90 ${
                isActive ? 'text-cold-dark' : 'text-ink/30 hover:text-ink/60'
              }`}
            >
              <div className="relative">
                <Icon className={`w-5 h-5 transition-transform duration-200 ${isActive ? 'stroke-[2.5]' : 'stroke-[1.8]'}`} />
                {tab.badge && tab.badge > 0 ? (
                  <span className="absolute -top-1.5 -right-2 bg-amber-400 text-pine-deep text-[9px] font-extrabold w-4 h-4 rounded-full flex items-center justify-center border-2 border-white shadow-xs">
                    {tab.badge > 9 ? '9+' : tab.badge}
                  </span>
                ) : null}
              </div>
              <span className={`text-[8px] sm:text-[9px] font-bold uppercase tracking-wide sm:tracking-widest whitespace-nowrap mt-1 transition-colors ${
                isActive ? 'text-cold-dark' : 'text-ink/35'
              }`}>
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
