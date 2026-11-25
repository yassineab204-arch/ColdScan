import React from 'react';
import {
  Home,
  Camera,
  Package,
  Utensils,
  ShoppingBag,
  MapPin,
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
    { id: 'stores' as TabType, label: t('stores', lang), icon: MapPin },
  ];

  if (!visible) return null;

  return (
    <nav aria-label="Main navigation" className="fixed bottom-[calc(0.5rem+env(safe-area-inset-bottom))] left-3 right-3 z-40 rounded-2xl bg-white/95 border border-ink/[0.07] px-1 pt-2 pb-1.5 shadow-[0_12px_40px_-12px_rgba(11,61,46,0.3)] backdrop-blur-xl md:hidden">
      {/* overflow-x-clip (not -auto): "auto" would coerce overflow-y to auto as
          well and slice the crown off the raised scan button (-top-3.5 vs the
          bar's pt-1.5). clip keeps any horizontal spill contained while letting
          the FAB stick out above the bar. flex-1/min-w-0 items never actually
          overflow horizontally, so no scroll behavior is lost. */}
      <div className="w-full max-w-[520px] mx-auto flex items-center justify-between gap-0 sm:gap-1 sm:justify-around overflow-x-clip">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;

          if (tab.highlight) {
            return (
              <button
                key={tab.id}
                onClick={() => onNavigate(tab.id)}
                aria-label={tab.label}
                aria-current={isActive ? 'page' : undefined}
                className="relative -top-3 flex min-w-0 flex-1 sm:flex-none flex-col items-center group transition-all duration-200 hover:-translate-y-1 px-1"
              >
                <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-cold text-pine-deep border-[3px] border-white shadow-[0_12px_30px_-10px_rgba(34,197,94,0.8)] flex items-center justify-center transition-all duration-200 hover:scale-110 active:scale-90 ${
                  isActive ? 'ring-4 ring-cold/25 bg-cold-dark text-white' : ''
                }`}>
                  <Icon className="w-[18px] h-[18px] sm:w-5 sm:h-5 stroke-[2.5]" />
                </div>
                <span className={`text-[9px] leading-tight font-bold text-center max-w-full break-words mt-1 transition-colors ${
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
              aria-label={tab.label}
              aria-current={isActive ? 'page' : undefined}
              className={`relative min-w-0 flex flex-1 sm:flex-none flex-col items-center py-1 px-1 sm:px-2 transition-all duration-200 hover:scale-110 active:scale-90 ${
                isActive ? 'text-cold-dark' : 'text-ink/30 hover:text-ink/60'
              }`}
            >
              <div className="relative">
                <Icon className={`w-[19px] h-[19px] sm:w-5 sm:h-5 transition-transform duration-200 ${isActive ? 'stroke-[2.5]' : 'stroke-[1.8]'}`} />
                {tab.badge && tab.badge > 0 ? (
                  <span className="absolute -top-1.5 -right-2 bg-amber-400 text-pine-deep text-[9px] font-extrabold w-4 h-4 rounded-full flex items-center justify-center border-2 border-white shadow-xs">
                    {tab.badge > 9 ? '9+' : tab.badge}
                  </span>
                ) : null}
              </div>
              <span className={`text-[9px] leading-tight font-bold text-center max-w-full break-words mt-1 transition-colors ${
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
