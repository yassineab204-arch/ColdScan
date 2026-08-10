import React from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { Reveal } from './Reveal';
import { LanguageType } from '../../types';
import { t } from '../../utils/i18n';

const ease = [0.22, 1, 0.36, 1] as const;

interface StepListProps { steps: { emoji: string; label: string }[]; tone: 'without' | 'with'; startDelay: number; }

const StepList: React.FC<StepListProps> = ({ steps, tone, startDelay }) => {
  const reduce = useReducedMotion();
  return (
    <div className="flex flex-col items-center gap-2.5">
      {steps.map((step, i) => (
        <React.Fragment key={step.label}>
          {i > 0 && (
            <motion.div initial={reduce ? false : { opacity: 0, scale: 0.6 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true }} transition={{ duration: 0.4, delay: startDelay + i * 0.4 - 0.15, ease }}>
              <svg className={`h-5 w-5 animate-cs-arrow-down ${tone === 'without' ? 'text-rose-300/80' : 'text-cold-soft'}`} viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M10 2v13M5 11l5 5 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </motion.div>
          )}
          <motion.div initial={reduce ? false : { opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-48px' }} transition={{ duration: 0.55, delay: startDelay + i * 0.4, ease }} className={`flex w-full max-w-[240px] items-center justify-center gap-3 rounded-2xl px-5 py-4 ring-1 backdrop-blur-sm ${tone === 'without' ? 'bg-rose-500/10 ring-rose-300/25' : 'bg-cold/10 ring-cold/30'}`}>
            <span className="text-2xl leading-none">{step.emoji}</span>
            <span className={`text-sm font-bold ${tone === 'without' ? 'text-rose-100' : 'text-white'}`}>{step.label}</span>
          </motion.div>
        </React.Fragment>
      ))}
    </div>
  );
};

export const WasteStory: React.FC<{ lang: LanguageType }> = ({ lang }) => {
  const WITHOUT = [
    { emoji: '🥀', label: t('wasteForgotten', lang) },
    { emoji: '⏰', label: t('wasteExpired', lang) },
    { emoji: '🗑️', label: t('wasteWaste', lang) },
  ];
  const WITH = [
    { emoji: '📷', label: t('wasteDetected', lang) },
    { emoji: '🍳', label: t('wasteSuggested', lang) },
    { emoji: '🍽️', label: t('wasteMeal', lang) },
  ];
  return (
    <section className="relative overflow-hidden bg-pine py-20 sm:py-28">
      <div className="pointer-events-none absolute -top-24 left-1/4 h-80 w-80 rounded-full bg-cold/10 blur-[110px]" />
      <div className="pointer-events-none absolute bottom-0 right-1/5 h-72 w-72 rounded-full bg-cold/8 blur-[100px]" />
      <div className="relative mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <Reveal className="mx-auto max-w-2xl text-center">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/8 px-3.5 py-1.5 text-xs font-bold text-cold ring-1 ring-cold/25">{t('wasteBadge', lang)}</span>
          <h2 className="mt-5 text-3xl sm:text-5xl font-extrabold tracking-[-0.03em] text-white text-balance">{t('wasteTitle1', lang)}<br />{t('wasteTitle2', lang)}</h2>
        </Reveal>
        <div className="mt-14 grid gap-10 sm:gap-8 md:grid-cols-2 md:gap-12 lg:mx-auto lg:max-w-4xl">
          <Reveal delay={0.1}>
            <div className="rounded-[1.75rem] bg-white/[0.04] p-6 sm:p-8 ring-1 ring-white/10">
              <p className="text-center text-[11px] font-extrabold uppercase tracking-[0.22em] text-rose-300">{t('wasteWithout', lang)}</p>
              <div className="mt-7"><StepList steps={WITHOUT} tone="without" startDelay={0.15} /></div>
              <p className="mt-7 text-center text-xs font-medium text-white/45">{t('wasteWithoutDesc', lang)}</p>
            </div>
          </Reveal>
          <Reveal delay={0.25}>
            <div className="relative rounded-[1.75rem] bg-cold/[0.07] p-6 sm:p-8 ring-1 ring-cold/30 shadow-[0_30px_70px_-40px_rgba(34,197,94,0.5)]">
              <p className="text-center text-[11px] font-extrabold uppercase tracking-[0.22em] text-cold-soft">{t('wasteWith', lang)}</p>
              <div className="mt-7"><StepList steps={WITH} tone="with" startDelay={0.35} /></div>
              <p className="mt-7 text-center text-xs font-medium text-white/55">{t('wasteWithDesc', lang)}</p>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
};
