import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
import { Camera, ChefHat, PiggyBank, Sparkles, ArrowRight, ArrowLeft, X, Check } from 'lucide-react';
import { LanguageType } from '../types';
import { t } from '../utils/i18n';
import { TRIAL_HOURS } from '../utils/trial';

interface WelcomeTutorialProps {
  isOpen: boolean;
  lang: LanguageType;
  /** Called when the user finishes or skips — the trial clock is already running. */
  onFinish: () => void;
}

const ease = [0.22, 1, 0.36, 1] as const;

const STEPS = [
  { icon: Camera, titleKey: 'tourStep1Title', bodyKey: 'tourStep1Body' },
  { icon: ChefHat, titleKey: 'tourStep2Title', bodyKey: 'tourStep2Body' },
  { icon: PiggyBank, titleKey: 'tourStep3Title', bodyKey: 'tourStep3Body' },
  { icon: Sparkles, titleKey: 'tourStep4Title', bodyKey: 'tourStep4Body' },
] as const;

/**
 * Short first-open walkthrough: 4 cards covering Scan → Cook → Save, ending on
 * the 48-hour free trial. Shown once (persisted via the trial state) and
 * replayable from Settings.
 */
export const WelcomeTutorial: React.FC<WelcomeTutorialProps> = ({ isOpen, lang, onFinish }) => {
  const reduce = useReducedMotion();
  const [step, setStep] = useState(0);

  // Restart at the first card each time it opens (also covers the Settings replay).
  useEffect(() => {
    if (isOpen) setStep(0);
  }, [isOpen]);

  // Lock background scrolling while the tutorial is up.
  useEffect(() => {
    if (!isOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onFinish();
      if (e.key === 'ArrowRight') setStep((s) => Math.min(STEPS.length - 1, s + 1));
      if (e.key === 'ArrowLeft') setStep((s) => Math.max(0, s - 1));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onFinish]);

  if (!isOpen) return null;

  const isLast = step === STEPS.length - 1;
  const { icon: Icon, titleKey, bodyKey } = STEPS[step];

  return (
    <div
      className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center p-0 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label={t('tourWelcomeBadge', lang)}
    >
      <motion.div
        className="absolute inset-0 bg-pine-deep/60 backdrop-blur-sm"
        initial={reduce ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        onClick={onFinish}
      />

      <motion.div
        initial={reduce ? false : { opacity: 0, y: 40, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.45, ease }}
        className="relative w-full max-w-md rounded-t-3xl sm:rounded-3xl bg-white shadow-[0_40px_90px_-30px_rgba(11,61,46,0.55)] overflow-hidden"
      >
        {/* Skip */}
        <button
          onClick={onFinish}
          className="absolute top-4 right-4 z-10 inline-flex items-center gap-1 rounded-full bg-white/80 px-3 py-1.5 text-xs font-bold text-ink/50 ring-1 ring-ink/10 transition-colors hover:text-pine"
        >
          {t('tourSkip', lang)}
          <X className="h-3.5 w-3.5" strokeWidth={2.5} />
        </button>

        {/* Illustration area */}
        <div className="relative bg-gradient-to-b from-mint to-white px-6 pt-9 pb-6 text-center">
          <div className="pointer-events-none absolute -top-16 left-1/2 h-48 w-72 -translate-x-1/2 rounded-full bg-cold/15 blur-[70px]" />
          <span className="relative inline-flex items-center gap-2 rounded-full bg-white px-3.5 py-1.5 text-[11px] font-bold uppercase tracking-[0.16em] text-pine ring-1 ring-ink/8">
            {t('tourWelcomeBadge', lang)}
          </span>

          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={reduce ? false : { opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reduce ? undefined : { opacity: 0, y: -10 }}
              transition={{ duration: 0.3, ease }}
              className="relative mt-6 flex flex-col items-center"
            >
              <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-pine text-cold shadow-[0_16px_36px_-14px_rgba(11,61,46,0.7)]">
                <Icon className="h-8 w-8" strokeWidth={2.2} />
              </span>
              <h2 className="mt-5 text-2xl font-extrabold tracking-[-0.02em] text-pine text-balance">
                {t(titleKey, lang)}
              </h2>
              <p className="mt-3 text-[15px] leading-relaxed text-ink/70 font-medium max-w-xs">
                {t(bodyKey, lang)}
              </p>

              {isLast && (
                <span className="mt-5 inline-flex items-center gap-2 rounded-full bg-cold/15 px-4 py-2 text-sm font-extrabold text-pine">
                  <Check className="h-4 w-4" strokeWidth={3} />
                  {t('trialDaysFree', lang).replace('__count__', String(TRIAL_HOURS))}
                </span>
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Controls */}
        <div className="px-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))] pt-2">
          <div className="flex items-center justify-center gap-2">
            {STEPS.map((_, i) => (
              <button
                key={i}
                onClick={() => setStep(i)}
                aria-label={`Step ${i + 1}`}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  i === step ? 'w-7 bg-cold' : 'w-1.5 bg-ink/15 hover:bg-ink/30'
                }`}
              />
            ))}
          </div>

          <div className="mt-5 flex items-center gap-3">
            {step > 0 && (
              <button
                onClick={() => setStep((s) => s - 1)}
                className="inline-flex items-center justify-center gap-1.5 rounded-full bg-white px-5 py-3.5 text-sm font-bold text-pine ring-1 ring-ink/10 transition-all hover:ring-cold/60 active:scale-[0.98]"
              >
                <ArrowLeft className="h-4 w-4" strokeWidth={2.4} />
                {t('tourBack', lang)}
              </button>
            )}

            <button
              onClick={() => (isLast ? onFinish() : setStep((s) => s + 1))}
              className="group inline-flex flex-1 items-center justify-center gap-2 rounded-full bg-cold px-6 py-3.5 text-[15px] font-bold text-pine-deep shadow-[0_16px_40px_-14px_rgba(34,197,94,0.8)] transition-all hover:bg-cold/90 active:scale-[0.98]"
            >
              {isLast ? t('tourStart', lang) : t('tourNext', lang)}
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" strokeWidth={2.6} />
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};
