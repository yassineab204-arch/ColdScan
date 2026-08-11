import React from 'react';
import { Sparkles, Clock, ShieldCheck, MailCheck } from 'lucide-react';
import { LanguageType } from '../types';
import { t } from '../utils/i18n';

interface TrialBannerProps {
  /** Pre-formatted countdown from the server-anchored clock, e.g. "1d 4h". */
  timeLeftLabel: string;
  /** Milliseconds left, used only to decide how urgent the styling is. */
  msLeft: number;
  unlocked: boolean;
  /** True once the trial is tied to an email and survives any browser. */
  emailLinked: boolean;
  lang: LanguageType;
  onContact: () => void;
}

const SIX_HOURS_MS = 6 * 60 * 60 * 1000;

/**
 * Thin status strip above the app screens: how much of the 48-hour trial is
 * left, and a way to reach the contact screen.
 *
 * The countdown is derived from the server's expiry timestamp — it is a display
 * of the server's decision, not a decision of its own.
 */
export const TrialBanner: React.FC<TrialBannerProps> = ({
  timeLeftLabel,
  msLeft,
  unlocked,
  emailLinked,
  lang,
  onContact,
}) => {
  if (unlocked) {
    return (
      <div className="mb-3 flex items-center gap-2 rounded-2xl bg-mint px-4 py-2.5 text-xs font-bold text-pine ring-1 ring-cold/25">
        <ShieldCheck className="h-4 w-4 shrink-0 text-cold-dark" strokeWidth={2.5} />
        {t('trialFullAccess', lang)}
      </div>
    );
  }

  const urgent = msLeft <= SIX_HOURS_MS;
  const label = t('trialBannerTime', lang).replace('__time__', timeLeftLabel);

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

      {emailLinked && (
        <MailCheck
          className="h-3.5 w-3.5 shrink-0 opacity-60"
          strokeWidth={2.5}
          aria-label={t('trialEmailLinkedShort', lang)}
        />
      )}

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
