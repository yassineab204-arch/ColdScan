import React from 'react';
import { Sparkles, Clock, ShieldCheck } from 'lucide-react';
import { LanguageType } from '../types';
import { t } from '../utils/i18n';

interface TrialBannerProps {
  daysLeft: number;
  unlocked: boolean;
  lang: LanguageType;
  onContact: () => void;
}

/**
 * Thin status strip above the app screens: how much trial is left, and a way to
 * reach the contact screen. Hidden once the user has permanent access, except
 * for a single subtle confirmation the first time it renders.
 */
export const TrialBanner: React.FC<TrialBannerProps> = ({ daysLeft, unlocked, lang, onContact }) => {
  if (unlocked) {
    return (
      <div className="mb-3 flex items-center gap-2 rounded-2xl bg-mint px-4 py-2.5 text-xs font-bold text-pine ring-1 ring-cold/25">
        <ShieldCheck className="h-4 w-4 shrink-0 text-cold-dark" strokeWidth={2.5} />
        {t('trialFullAccess', lang)}
      </div>
    );
  }

  const urgent = daysLeft <= 2;
  const label =
    daysLeft <= 1
      ? t('trialBannerLastDay', lang)
      : t('trialBannerDays', lang).replace('__count__', String(daysLeft));

  return (
    <div
      className={`mb-3 flex items-center gap-2 rounded-2xl px-4 py-2.5 text-xs font-bold ring-1 ${
        urgent ? 'bg-amber-50 text-amber-900 ring-amber-300/60' : 'bg-mint text-pine ring-cold/25'
      }`}
    >
      {urgent ? (
        <Clock className="h-4 w-4 shrink-0" strokeWidth={2.5} />
      ) : (
        <Sparkles className="h-4 w-4 shrink-0 text-cold-dark" strokeWidth={2.5} />
      )}
      <span className="flex-1 min-w-0 truncate">{label}</span>
      <button
        onClick={onContact}
        className={`shrink-0 rounded-full px-3 py-1 text-[11px] font-extrabold transition-colors ${
          urgent ? 'bg-amber-900 text-amber-50 hover:bg-amber-800' : 'bg-pine text-cold hover:bg-pine-light'
        }`}
      >
        {t('trialKeepAccess', lang)}
      </button>
    </div>
  );
};
