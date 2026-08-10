import React from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { Camera, Refrigerator } from 'lucide-react';
import { TabType, LanguageType } from '../../types';
import { Reveal } from './Reveal';
import { t } from '../../utils/i18n';

interface FinalCTAProps { onNavigate: (tab: TabType) => void; lang: LanguageType; }

export const FinalCTA: React.FC<FinalCTAProps> = ({ onNavigate, lang }) => {
  const reduce = useReducedMotion();
  return (
    <section className="relative bg-white py-20 sm:py-28">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
        <Reveal>
          <div className="relative overflow-hidden rounded-[2.5rem] bg-pine px-6 py-16 sm:px-16 sm:py-20 text-center shadow-[0_50px_100px_-40px_rgba(11,61,46,0.7)]">
            <div className="pointer-events-none absolute -top-28 left-1/2 h-72 w-[540px] -translate-x-1/2 rounded-full bg-cold/15 blur-[110px]" />
            <div className="pointer-events-none absolute -bottom-24 -left-16 h-56 w-56 rounded-full bg-cold/10 blur-[90px]" />
            <div className="pointer-events-none absolute -bottom-24 -right-16 h-56 w-56 rounded-full bg-cold/10 blur-[90px]" />
            <motion.div initial={reduce ? false : { opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-48px' }} transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1] }} className="relative">
              <h2 className="mx-auto max-w-2xl text-3xl sm:text-5xl font-extrabold tracking-[-0.03em] text-white text-balance">{t('finalTitle', lang)}</h2>
              <p className="mt-4 text-lg sm:text-xl font-medium text-white/60">{t('finalSubtitle', lang)}</p>
              <button onClick={() => onNavigate('scan')} className="mt-10 inline-flex items-center gap-3 rounded-full bg-cold px-9 py-4.5 text-base font-extrabold text-pine-deep shadow-[0_20px_50px_-12px_rgba(34,197,94,0.7)] transition-all duration-200 hover:bg-cold/90 hover:-translate-y-1 active:translate-y-0 active:scale-[0.98]"><Camera className="h-5 w-5" strokeWidth={2.4} />{t('finalScanFridge', lang)}</button>
              <p className="mt-8 text-sm font-bold uppercase tracking-[0.22em] text-cold-soft">{t('finalTagline', lang)}</p>
              <div className="mt-10 flex items-center justify-center gap-3"><span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/10 ring-1 ring-white/15"><Refrigerator className="h-5.5 w-5.5 text-cold" strokeWidth={2.3} /></span><span className="text-lg font-extrabold tracking-tight text-white">ColdScan</span></div>
              <p className="mt-5 text-[11px] font-bold uppercase tracking-[0.34em] text-white/40">{t('finalScanCookSave', lang)}</p>
            </motion.div>
          </div>
        </Reveal>
      </div>
    </section>
  );
};
