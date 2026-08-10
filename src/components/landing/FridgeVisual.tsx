import React from 'react';
import { ScanLine, Sparkles } from 'lucide-react';
import { LanguageType } from '../../types';
import { t } from '../../utils/i18n';

interface FridgeVisualProps { itemsDetected: number; expiringCount: number; lang: LanguageType; }

const SHELF_FOOD: { emoji: string; top: string; left: string; size: string }[] = [
  { emoji: '🥛', top: '18%', left: '14%', size: '1.4rem' },
  { emoji: '🥚', top: '24%', left: '52%', size: '1.25rem' },
  { emoji: '🧀', top: '19%', left: '74%', size: '1.35rem' },
  { emoji: '🍅', top: '46%', left: '16%', size: '1.45rem' },
  { emoji: '🥬', top: '52%', left: '60%', size: '1.5rem' },
  { emoji: '🥑', top: '47%', left: '80%', size: '1.3rem' },
  { emoji: '🍓', top: '74%', left: '26%', size: '1.2rem' },
  { emoji: '🥛', top: '78%', left: '66%', size: '1.3rem' },
];

export const FridgeVisual: React.FC<FridgeVisualProps> = ({ itemsDetected, expiringCount, lang }) => {
  const DETECTIONS = [
    { label: `Tomatoes ✓`, top: '38%', left: '6%', delay: 0.6 },
    { label: `Eggs ✓`, top: '10%', left: '48%', delay: 1.1 },
    { label: `Spinach ✓`, top: '46%', left: '62%', delay: 1.6 },
    { label: `Milk ✓`, top: '68%', left: '5%', delay: 2.1 },
  ];
  return (
    <div className="relative mx-auto w-full max-w-[340px] select-none" aria-hidden="true">
      <div className="absolute -inset-10 rounded-full bg-cold/20 blur-3xl animate-cs-glow pointer-events-none" />
      <div className="absolute -inset-16 cs-hero-grid rounded-full opacity-60 pointer-events-none" />
      <div className="relative rounded-[2.4rem] bg-pine-deep p-2.5 shadow-[0_40px_80px_-24px_rgba(7,40,30,0.55)] ring-1 ring-white/10">
        <div className="relative overflow-hidden rounded-[1.9rem] bg-gradient-to-b from-pine via-pine to-pine-deep">
          <div className="relative z-10 flex items-center justify-between px-5 pt-4 pb-2">
            <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-cold animate-cs-pulse-soft" /><span className="text-[9px] font-bold tracking-[0.22em] text-cold">{t('fridgeColdScan', lang)}</span></div>
            <span className="text-[9px] font-semibold tracking-widest text-white/50">{t('fridgeScanLive', lang)}</span>
          </div>
          <div className="relative mx-3 h-[320px] rounded-2xl bg-pine-deep/70 ring-1 ring-white/10 overflow-hidden">
            <div className="absolute left-3 right-3 top-[34%] h-[3px] rounded-full bg-white/12" />
            <div className="absolute left-3 right-3 top-[64%] h-[3px] rounded-full bg-white/12" />
            <div className="absolute left-3 right-3 top-[92%] h-[3px] rounded-full bg-white/12" />
            <div className="absolute inset-y-4 left-2 w-[3px] rounded-full bg-white/8" />
            {SHELF_FOOD.map((f, i) => (<span key={i} className="absolute drop-shadow-[0_4px_8px_rgba(0,0,0,0.45)]" style={{ top: f.top, left: f.left, fontSize: f.size }}>{f.emoji}</span>))}
            <div className="absolute left-0 right-0 h-[3px] animate-cs-scanline"><div className="absolute inset-0 bg-gradient-to-r from-transparent via-cold to-transparent opacity-90" /><div className="absolute -top-[3px] left-1/2 -translate-x-1/2 w-10 h-[9px] rounded-full bg-cold/40 blur-[6px]" /></div>
            {DETECTIONS.map((d, i) => (<span key={i} className="absolute z-10 animate-cs-pop rounded-full bg-white/95 px-2.5 py-1 text-[9px] font-bold text-pine shadow-[0_6px_16px_rgba(0,0,0,0.35)] ring-1 ring-cold/40 whitespace-nowrap" style={{ top: d.top, left: d.left, animationDelay: `${d.delay}s` }}>{d.label}</span>))}
            <div className="absolute left-3 top-3 w-5 h-5 rounded-tl-lg border-l-2 border-t-2 border-cold/70" /><div className="absolute right-3 top-3 w-5 h-5 rounded-tr-lg border-r-2 border-t-2 border-cold/70" /><div className="absolute left-3 bottom-3 w-5 h-5 rounded-bl-lg border-l-2 border-b-2 border-cold/70" /><div className="absolute right-3 bottom-3 w-5 h-5 rounded-br-lg border-r-2 border-b-2 border-cold/70" />
          </div>
          <div className="relative z-10 m-3 rounded-2xl bg-white/8 px-4 py-3 ring-1 ring-white/12 backdrop-blur-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-cold/20 ring-1 ring-cold/40"><ScanLine className="w-3.5 h-3.5 text-cold" /></span>
                <div>
                  <p className="text-[10px] font-bold text-white leading-none">{itemsDetected} {t('fridgeItemsDetected', lang)}</p>
                  <p className="text-[8.5px] font-medium text-white/55 mt-0.5">{expiringCount} {t('fridgeToUseSoon2', lang)}</p>
                </div>
              </div>
              <span className="flex items-center gap-1 text-[8.5px] font-bold tracking-widest text-cold uppercase"><Sparkles className="w-3 h-3" /> {t('fridgeAIReady', lang)}</span>
            </div>
          </div>
        </div>
      </div>
      <div className="absolute -left-4 sm:-left-14 top-14 animate-cs-float-soft">
        <div className="rounded-2xl bg-white px-3.5 py-2.5 shadow-[0_16px_40px_-12px_rgba(11,61,46,0.35)] ring-1 ring-ink/5"><div className="flex items-center gap-2"><span className="text-lg leading-none">🍝</span><div><p className="text-[10px] font-bold text-ink leading-none">{t('fridgePasta', lang)}</p><p className="text-[8.5px] font-semibold text-cold-dark mt-0.5">4/5 {t('fridgeIngredientsReady', lang)}</p></div></div></div>
      </div>
      <div className="absolute -right-2 sm:-right-12 bottom-20 animate-cs-float" style={{ animationDelay: '0.8s' }}>
        <div className="rounded-2xl bg-white px-3.5 py-2.5 shadow-[0_16px_40px_-12px_rgba(11,61,46,0.35)] ring-1 ring-ink/5"><div className="flex items-center gap-2"><span className="text-lg leading-none">🛒</span><div><p className="text-[10px] font-bold text-ink leading-none">{t('fridgeOnlyBuy', lang)}</p><p className="text-[8.5px] font-semibold text-cold-dark mt-0.5">{t('fridgeHaveRest', lang)}</p></div></div></div>
      </div>
      <div className="absolute -right-4 sm:-right-16 top-1/3 animate-cs-float-soft" style={{ animationDelay: '1.6s' }}>
        <div className="rounded-full bg-pine px-3 py-1.5 shadow-[0_12px_30px_-10px_rgba(11,61,46,0.6)] ring-1 ring-cold/30"><span className="text-[9px] font-bold text-cold whitespace-nowrap">✓ {itemsDetected} {t('fridgeFoodsFound', lang)}</span></div>
      </div>
    </div>
  );
};
