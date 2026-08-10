import React, { useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { Lock, Instagram, Mail, KeyRound, ArrowRight, Home, Refrigerator } from 'lucide-react';
import { LanguageType } from '../types';
import { t } from '../utils/i18n';
import { TRIAL_DAYS } from '../utils/trial';

const INSTAGRAM_URL = 'https://www.instagram.com/cold.scan/';
const BUSINESS_EMAIL = 'yassineab2014@gmail.com';
const MAILTO_LINK = `mailto:${BUSINESS_EMAIL}?subject=ColdScan%20access%20request&body=Hi%20ColdScan%2C%20my%207-day%20trial%20ended%20and%20I%27d%20like%20to%20keep%20using%20the%20app.`;

interface TrialExpiredScreenProps {
  lang: LanguageType;
  /** Returns true when the code was accepted. */
  onRedeemCode: (code: string) => boolean;
  onBackHome: () => void;
}

const ease = [0.22, 1, 0.36, 1] as const;

/**
 * Shown in place of the app screens once the free trial is over. The marketing
 * home page stays reachable — only the product tabs are gated.
 */
export const TrialExpiredScreen: React.FC<TrialExpiredScreenProps> = ({
  lang,
  onRedeemCode,
  onBackHome,
}) => {
  const reduce = useReducedMotion();
  const [code, setCode] = useState('');
  const [error, setError] = useState(false);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) return;
    const ok = onRedeemCode(code);
    setError(!ok);
    if (ok) setCode('');
  };

  return (
    <div className="mx-auto w-full max-w-md px-1 py-6">
      <motion.div
        initial={reduce ? false : { opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease }}
        className="overflow-hidden rounded-3xl bg-white shadow-[0_30px_70px_-30px_rgba(11,61,46,0.4)] ring-1 ring-ink/[0.06]"
      >
        {/* Header */}
        <div className="relative bg-gradient-to-b from-mint to-white px-6 pt-9 pb-7 text-center">
          <div className="pointer-events-none absolute -top-16 left-1/2 h-40 w-64 -translate-x-1/2 rounded-full bg-cold/15 blur-[70px]" />
          <span className="relative flex h-16 w-16 mx-auto items-center justify-center rounded-2xl bg-pine text-cold shadow-[0_16px_36px_-14px_rgba(11,61,46,0.7)]">
            <Lock className="h-7 w-7" strokeWidth={2.3} />
          </span>
          <h2 className="relative mt-5 text-2xl font-extrabold tracking-[-0.02em] text-pine text-balance">
            {t('trialEndedTitle', lang)}
          </h2>
          <p className="relative mt-3 text-[15px] leading-relaxed text-ink/70 font-medium">
            {t('trialEndedBody', lang).replace('7', String(TRIAL_DAYS))}
          </p>
          <p className="relative mt-4 text-xs font-bold uppercase tracking-[0.16em] text-ink/40">
            {t('trialThanks', lang)}
          </p>
        </div>

        {/* Contact actions */}
        <div className="px-6 pb-6 space-y-3">
          <a
            href={INSTAGRAM_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="group flex items-center gap-3 rounded-2xl bg-cold px-5 py-4 text-pine-deep shadow-[0_16px_40px_-16px_rgba(34,197,94,0.8)] transition-all hover:bg-cold/90 active:scale-[0.99]"
          >
            <Instagram className="h-5 w-5 shrink-0" strokeWidth={2.3} />
            <span className="flex-1 min-w-0">
              <span className="block text-[15px] font-extrabold leading-tight">
                {t('trialContactInstagram', lang)}
              </span>
              <span className="block text-xs font-semibold opacity-70">@cold.scan</span>
            </span>
            <ArrowRight className="h-4 w-4 shrink-0 transition-transform group-hover:translate-x-0.5" strokeWidth={2.6} />
          </a>

          <a
            href={MAILTO_LINK}
            className="group flex items-center gap-3 rounded-2xl bg-white px-5 py-4 text-pine ring-1 ring-ink/10 transition-all hover:ring-cold/60 active:scale-[0.99]"
          >
            <Mail className="h-5 w-5 shrink-0" strokeWidth={2.3} />
            <span className="flex-1 min-w-0">
              <span className="block text-[15px] font-extrabold leading-tight">
                {t('trialContactEmail', lang)}
              </span>
              <span className="block truncate text-xs font-semibold text-ink/50">{BUSINESS_EMAIL}</span>
            </span>
            <ArrowRight className="h-4 w-4 shrink-0 transition-transform group-hover:translate-x-0.5" strokeWidth={2.6} />
          </a>
        </div>

        {/* Access code */}
        <div className="border-t border-ink/[0.07] bg-[#F7FBF8] px-6 py-6">
          <label
            htmlFor="coldscan-access-code"
            className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.14em] text-ink/50"
          >
            <KeyRound className="h-3.5 w-3.5" strokeWidth={2.6} />
            {t('trialHaveCode', lang)}
          </label>

          <form onSubmit={submit} className="mt-3 flex gap-2">
            <input
              id="coldscan-access-code"
              value={code}
              onChange={(e) => {
                setCode(e.target.value);
                setError(false);
              }}
              placeholder={t('trialCodePlaceholder', lang)}
              autoComplete="off"
              spellCheck={false}
              className={`min-w-0 flex-1 rounded-full bg-white px-4 py-3 text-sm font-semibold text-pine placeholder:text-ink/35 ring-1 outline-none transition-shadow ${
                error ? 'ring-red-400 focus:ring-red-500' : 'ring-ink/10 focus:ring-cold'
              }`}
            />
            <button
              type="submit"
              className="shrink-0 rounded-full bg-pine px-5 py-3 text-sm font-bold text-cold transition-all hover:bg-pine-light active:scale-[0.98]"
            >
              {t('trialCodeSubmit', lang)}
            </button>
          </form>

          {error && (
            <p className="mt-2 text-xs font-semibold text-red-600">{t('trialCodeInvalid', lang)}</p>
          )}

          <button
            onClick={onBackHome}
            className="mt-5 inline-flex items-center gap-1.5 text-xs font-bold text-ink/50 transition-colors hover:text-pine"
          >
            <Home className="h-3.5 w-3.5" strokeWidth={2.5} />
            {t('trialBackHome', lang)}
          </button>
        </div>

        <div className="flex items-center justify-center gap-2 border-t border-ink/[0.07] bg-white py-4 text-[10px] font-bold uppercase tracking-[0.24em] text-ink/35">
          <Refrigerator className="h-3.5 w-3.5" strokeWidth={2.4} />
          Scan · Cook · Save
        </div>
      </motion.div>
    </div>
  );
};
