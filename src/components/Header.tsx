import React, { useEffect, useState } from 'react';
import {
  Refrigerator,
  MessageCircle,
  Mic,
  Settings,
  Globe,
  Menu,
  X,
  Camera,
  AlertCircle,
} from 'lucide-react';
import { TabType, LanguageType } from '../types';
import { t } from '../utils/i18n';

interface HeaderProps {
  activeTab: TabType;
  expiringCount: number;
  language?: LanguageType;
  onOpenLiveVoice: () => void;
  onOpenAssistant: () => void;
  onNavigate: (tab: TabType) => void;
  onSelectLanguage?: (lang: LanguageType) => void;
}

/**
 * Premium sticky ColdScan navbar.
 * Transparent over the hero, frosted white once the page scrolls.
 * On mobile it collapses into a clean hamburger menu.
 */
export const Header: React.FC<HeaderProps> = ({
  activeTab,
  expiringCount,
  language = 'en',
  onOpenLiveVoice,
  onOpenAssistant,
  onNavigate,
  onSelectLanguage,
}) => {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const lang = (language || 'en') as LanguageType;

  const NAV_LINKS: { id: TabType; label: string }[] = [
    { id: 'home', label: t('home', lang) },
    { id: 'scan', label: t('scan', lang) },
    { id: 'recipes', label: t('recipes', lang) },
    { id: 'shopping', label: t('shopping', lang) },
  ];

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Close the mobile menu whenever a tab is selected
  const go = (tab: TabType) => {
    setMenuOpen(false);
    onNavigate(tab);
  };

  const solid = scrolled || activeTab !== 'home' || menuOpen;

  return (
    <header
      className={`sticky top-0 z-40 w-full transition-all duration-300 ${
        solid
          ? 'bg-white/85 backdrop-blur-xl border-b border-ink/[0.07] shadow-[0_8px_30px_-16px_rgba(11,61,46,0.18)]'
          : 'bg-transparent border-b border-transparent'
      }`}
    >
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 sm:h-[72px] items-center justify-between gap-3">
          {/* Logo */}
          <button
            onClick={() => go('home')}
            className="flex items-center gap-2.5 shrink-0 group"
            aria-label="ColdScan home"
          >
            <span className="flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-xl bg-pine text-cold shadow-[0_8px_20px_-8px_rgba(11,61,46,0.6)] transition-transform duration-200 group-hover:scale-105">
              <Refrigerator className="h-5 w-5" strokeWidth={2.3} />
            </span>
            <span className="flex flex-col items-start leading-none">
              <span className="text-[17px] sm:text-lg font-extrabold tracking-tight text-pine">
                ColdScan
              </span>
              <span className="mt-0.5 hidden sm:block text-[8.5px] font-bold uppercase tracking-[0.28em] text-ink/40">
                Scan · Cook · Save
              </span>
            </span>
          </button>

          {/* Desktop nav links */}
          <nav className="hidden md:flex items-center gap-1" aria-label="Main navigation">
            {NAV_LINKS.map((link) => {
              const isActive = activeTab === link.id;
              return (
                <button
                  key={link.id}
                  onClick={() => go(link.id)}
                  className={`relative rounded-full px-4 py-2 text-sm font-semibold transition-colors duration-200 ${
                    isActive
                      ? 'text-pine bg-mint'
                      : 'text-ink/60 hover:text-pine hover:bg-ink/[0.04]'
                  }`}
                >
                  {link.label}
                  {isActive && (
                    <span className="absolute left-1/2 -bottom-0.5 h-1 w-1 -translate-x-1/2 rounded-full bg-cold" />
                  )}
                </button>
              );
            })}
          </nav>

          {/* Right actions */}
          <div className="flex items-center gap-1.5 sm:gap-2">
            {/* Quick language toggle: EN / FR / Darija — always visible on
                every screen size so the language button is one tap away.
                The full 9-language picker stays in Settings. */}
            {onSelectLanguage && (
              <div
                className="flex items-center gap-0.5 rounded-full bg-ink/[0.04] p-1 ring-1 ring-ink/[0.08]"
                role="group"
                aria-label="Language"
              >
                <Globe className="ml-1.5 hidden sm:block h-3.5 w-3.5 text-ink/40" />
                {(
                  [
                    { id: 'en', label: 'EN', title: 'Switch to English' },
                    { id: 'fr', label: 'FR', title: 'Passer en Français' },
                    { id: 'ar-MA', label: 'MA', title: 'الدارجة المغربية' },
                  ] as { id: LanguageType; label: string; title: string }[]
                ).map((l) => (
                  <button
                    key={l.id}
                    onClick={() => onSelectLanguage(l.id)}
                    title={l.title}
                    aria-pressed={language === l.id}
                    className={`rounded-full px-1.5 py-1 text-[10px] font-bold transition-colors sm:px-2 sm:text-[11px] ${
                      language === l.id
                        ? 'bg-pine text-cold shadow-[0_2px_8px_-2px_rgba(11,61,46,0.5)]'
                        : 'text-ink/50 hover:text-ink'
                    }`}
                  >
                    {l.label}
                  </button>
                ))}
              </div>
            )}

            {/* Expiring alert */}
            {expiringCount > 0 && activeTab !== 'inventory' && (
              <button
                onClick={() => go('inventory')}
                className="relative hidden sm:flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-2 text-xs font-bold text-amber-700 ring-1 ring-amber-200/80 transition-all hover:bg-amber-100"
                title={`${expiringCount} items to use soon`}
              >
                <AlertCircle className="h-4 w-4 text-amber-500" />
                <span className="tabular-nums">{expiringCount}</span>
              </button>
            )}

            {/* AI chat */}
            <button
              onClick={onOpenAssistant}
              className="hidden sm:flex items-center gap-2 rounded-full bg-mint px-3.5 py-2 text-xs font-bold text-pine ring-1 ring-cold/20 transition-all duration-200 hover:bg-mint-deep"
              title="Chat with ColdScan AI"
            >
              <MessageCircle className="h-4 w-4 text-cold-dark" />
              <span className="hidden lg:inline">{t('askAi', lang)}</span>
            </button>

            {/* Live voice */}
            <button
              onClick={onOpenLiveVoice}
              className="hidden sm:flex items-center gap-2 rounded-full bg-mint px-3.5 py-2 text-xs font-bold text-pine ring-1 ring-cold/20 transition-all duration-200 hover:bg-mint-deep"
              title="Talk to ColdScan Live Voice"
            >
              <Mic className="h-4 w-4 text-cold-dark" />
              <span className="hidden lg:inline">{t('askLive', lang)}</span>
            </button>

            {/* Primary CTA */}
            <button
              onClick={() => go('scan')}
              className="hidden md:inline-flex items-center gap-2 rounded-full bg-cold px-5 py-2.5 text-sm font-bold text-pine-deep shadow-[0_10px_26px_-10px_rgba(34,197,94,0.8)] transition-all duration-200 hover:bg-cold/90 hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98]"
            >
              <Camera className="h-4 w-4" strokeWidth={2.4} />
              {t('scanMyFridge', lang)}
            </button>

            {/* Mobile hamburger */}
            <button
              onClick={() => setMenuOpen((v) => !v)}
              className="md:hidden flex h-10 w-10 items-center justify-center rounded-xl bg-white/80 ring-1 ring-ink/10 text-pine transition-colors hover:bg-mint"
              aria-label={menuOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={menuOpen}
            >
              {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile menu panel */}
      {menuOpen && (
        <div className="md:hidden border-t border-ink/[0.06] bg-white/95 backdrop-blur-xl">
          <div className="mx-auto max-w-6xl px-4 py-4 space-y-1">
            {NAV_LINKS.map((link) => {
              const isActive = activeTab === link.id;
              return (
                <button
                  key={link.id}
                  onClick={() => go(link.id)}
                  className={`flex w-full items-center justify-between rounded-xl px-4 py-3 text-[15px] font-semibold transition-colors ${
                    isActive ? 'bg-mint text-pine' : 'text-ink/70 hover:bg-ink/[0.04]'
                  }`}
                >
                  {link.label}
                  {isActive && <span className="h-2 w-2 rounded-full bg-cold" />}
                </button>
              );
            })}

            <div className="mt-2 grid grid-cols-2 gap-2">
              <button
                onClick={() => {
                  setMenuOpen(false);
                  onOpenAssistant();
                }}
                className="flex items-center justify-center gap-2 rounded-xl bg-mint px-4 py-3 text-sm font-bold text-pine ring-1 ring-cold/20"
              >
                <MessageCircle className="h-4 w-4 text-cold-dark" />
                {t('askAi', lang)}
              </button>
              <button
                onClick={() => {
                  setMenuOpen(false);
                  onOpenLiveVoice();
                }}
                className="flex items-center justify-center gap-2 rounded-xl bg-mint px-4 py-3 text-sm font-bold text-pine ring-1 ring-cold/20"
              >
                <Mic className="h-4 w-4 text-cold-dark" />
                {t('askLive', lang)}
              </button>
            </div>

            {expiringCount > 0 && activeTab !== 'inventory' && (
              <button
                onClick={() => go('inventory')}
                className="mt-2 flex w-full items-center gap-2 rounded-xl bg-amber-50 px-4 py-3 text-sm font-bold text-amber-800 ring-1 ring-amber-200/80"
              >
                <AlertCircle className="h-4 w-4 text-amber-500" />
                {expiringCount} item{expiringCount > 1 ? 's' : ''} to use soon
              </button>
            )}

            {/* Language quick toggle (same as before, preserved) */}
            {onSelectLanguage && (
              <div className="mt-2 flex items-center gap-1 rounded-xl bg-ink/[0.03] p-1 ring-1 ring-ink/[0.06]">
                <Globe className="ml-2 h-4 w-4 text-ink/40" />
                {(
                  [
                    { id: 'en', label: 'EN' },
                    { id: 'fr', label: 'FR' },
                    { id: 'ar-MA', label: 'MA' },
                  ] as { id: LanguageType; label: string }[]
                ).map((l) => (
                  <button
                    key={l.id}
                    onClick={() => onSelectLanguage(l.id)}
                    className={`flex-1 rounded-lg px-2 py-1.5 text-xs font-bold transition-colors ${
                      language === l.id
                        ? 'bg-pine text-cold'
                        : 'text-ink/50 hover:text-ink'
                    }`}
                  >
                    {l.label}
                  </button>
                ))}
              </div>
            )}

            <div className="mt-2 flex items-center gap-2">
              <button
                onClick={() => go('settings')}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-ink/[0.04] px-4 py-3 text-sm font-semibold text-ink/70"
              >
                <Settings className="h-4 w-4" />
                Settings
              </button>
              <button
                onClick={() => go('scan')}
                className="flex flex-[1.6] items-center justify-center gap-2 rounded-xl bg-cold px-4 py-3 text-sm font-bold text-pine-deep shadow-[0_10px_24px_-10px_rgba(34,197,94,0.8)]"
              >
                <Camera className="h-4 w-4" strokeWidth={2.4} />
                {t('scanMyFridge', lang)}
              </button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
};
