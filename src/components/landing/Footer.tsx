import React from 'react';
import { Refrigerator, Instagram, Mail } from 'lucide-react';
import { TabType, LanguageType } from '../../types';

interface FooterProps {
  lang: LanguageType;
  onNavigate: (tab: TabType) => void;
  onUpdateSettings?: (settings: Partial<{ language: LanguageType }>) => void;
}

const INSTAGRAM_URL = 'https://www.instagram.com/cold.scan/';
const BUSINESS_EMAIL = 'yassineab2014@gmail.com';

const LINKS: { label: string; tab: TabType }[] = [
  { label: 'Home', tab: 'home' },
  { label: 'Scan', tab: 'scan' },
  { label: 'Recipes', tab: 'recipes' },
  { label: 'Shopping List', tab: 'shopping' },
];

const LANGS: { id: LanguageType; flag: string }[] = [
  { id: 'en', flag: '🇬🇧' },
  { id: 'fr', flag: '🇫🇷' },
  { id: 'ar-MA', flag: '🇲🇦' },
  { id: 'es', flag: '🇪🇸' },
  { id: 'de', flag: '🇩🇪' },
  { id: 'ar', flag: '🇸🇦' },
  { id: 'it', flag: '🇮🇹' },
  { id: 'pt', flag: '🇵🇹' },
  { id: 'ja', flag: '🇯🇵' },
];

export const Footer: React.FC<FooterProps> = ({ lang, onNavigate, onUpdateSettings }) => {
  return (
    <footer className="bg-pine-deep text-white">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-14 sm:py-16">
        <div className="grid gap-12 lg:grid-cols-[1.2fr_0.8fr_1fr] lg:gap-8">
          {/* Brand */}
          <div>
            <button
              onClick={() => onNavigate('home')}
              className="flex items-center gap-2.5"
              aria-label="ColdScan home"
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-cold/15 ring-1 ring-cold/30">
                <Refrigerator className="h-5 w-5 text-cold" strokeWidth={2.3} />
              </span>
              <span className="text-xl font-extrabold tracking-tight text-white">ColdScan</span>
            </button>
            <p className="mt-3 text-sm font-medium text-white/55">
              Your smart kitchen assistant.
            </p>
            <p className="mt-2 text-[11px] font-bold uppercase tracking-[0.3em] text-cold/70">
              Scan. Cook. Save.
            </p>
          </div>

          {/* Product links */}
          <div>
            <h4 className="text-[11px] font-extrabold uppercase tracking-[0.22em] text-white/40">
              Product
            </h4>
            <ul className="mt-4 space-y-2.5">
              {LINKS.map((l) => (
                <li key={l.tab}>
                  <button
                    onClick={() => onNavigate(l.tab)}
                    className="text-sm font-semibold text-white/70 transition-colors hover:text-cold"
                  >
                    {l.label}
                  </button>
                </li>
              ))}
              <li>
                <button
                  onClick={() => onNavigate('settings')}
                  className="text-sm font-semibold text-white/70 transition-colors hover:text-cold"
                >
                  Settings
                </button>
              </li>
            </ul>
          </div>

          {/* Language + social */}
          <div>
            <h4 className="text-[11px] font-extrabold uppercase tracking-[0.22em] text-white/40">
              Language
            </h4>
            <div className="mt-4 flex flex-wrap gap-1.5">
              {LANGS.map((l) => (
                <button
                  key={l.id}
                  onClick={() => onUpdateSettings?.({ language: l.id })}
                  title={l.id}
                  className={`flex h-8 w-9 items-center justify-center rounded-lg text-sm transition-all ${
                    lang === l.id
                      ? 'bg-cold/25 ring-1 ring-cold/50'
                      : 'bg-white/5 ring-1 ring-white/10 hover:bg-white/10'
                  }`}
                >
                  {l.flag}
                </button>
              ))}
            </div>

            <h4 className="mt-7 text-[11px] font-extrabold uppercase tracking-[0.22em] text-white/40">
              Connect
            </h4>
            <div className="mt-4 flex flex-col gap-2.5">
              <a
                href={INSTAGRAM_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-sm font-semibold text-white/70 transition-colors hover:text-cold"
              >
                <Instagram className="h-4 w-4" />
                @cold.scan
              </a>
              <a
                href={`mailto:${BUSINESS_EMAIL}?subject=ColdScan%20Business%20Inquiry`}
                className="inline-flex items-center gap-2 text-sm font-semibold text-white/70 transition-colors hover:text-cold"
              >
                <Mail className="h-4 w-4" />
                Business contact
              </a>
            </div>
          </div>
        </div>

        <div className="mt-12 flex flex-col items-center justify-between gap-3 border-t border-white/10 pt-7 sm:flex-row">
          <p className="text-xs font-medium text-white/40">
            © {new Date().getFullYear()} ColdScan. Less waste. Less spending. More meals.
          </p>
          <p className="text-xs font-semibold text-white/40">
            Made with <span className="text-cold">♥</span> for home cooks
          </p>
        </div>
      </div>
    </footer>
  );
};
