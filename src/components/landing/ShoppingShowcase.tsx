import React from 'react';
import { CheckCircle2, Circle, ArrowRight, ShoppingBag } from 'lucide-react';
import { ShoppingItem, TabType, LanguageType } from '../../types';
import { Reveal } from './Reveal';
import { formatCurrencyAmount } from '../../utils/currency';
import { getLocalizedFoodItemName, t } from '../../utils/i18n';

interface ShoppingShowcaseProps { shoppingList: ShoppingItem[]; currency: string; lang: LanguageType; onNavigate: (tab: TabType) => void; }
const CATEGORY_EMOJI: Record<string, string> = { Produce: '🥬', 'Dairy & Eggs': '🥛', Proteins: '🍗', 'Condiments & Sauces': '🧂', Beverages: '🧃', Bakery: '🥖', Leftovers: '🍲', 'Pantry & Other': '🥫' };
export const ShoppingShowcase: React.FC<ShoppingShowcaseProps> = ({ shoppingList, currency, lang, onNavigate }) => {
  const unbought = shoppingList.filter((i) => !i.isBought);
  const total = shoppingList.reduce((acc, i) => acc + (i.isBought ? 0 : i.estimatedPrice), 0);
  const shown = shoppingList.slice(0, 5);
  return (
    <section className="relative bg-white py-20 sm:py-28">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="grid items-center gap-14 lg:grid-cols-2 lg:gap-10">
          <Reveal>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-mint px-3.5 py-1.5 text-xs font-bold text-pine ring-1 ring-cold/20">{t('shoppingBadge', lang)}</span>
            <h2 className="mt-5 text-3xl sm:text-5xl font-extrabold tracking-[-0.03em] text-pine text-balance">{t('shoppingTitle', lang)}</h2>
            <p className="mt-4 text-base sm:text-lg text-ink/65 font-medium leading-relaxed max-w-md">{t('shoppingDesc', lang)}</p>
            <div className="mt-7 inline-flex items-center gap-3 rounded-2xl bg-mint/70 px-5 py-4 ring-1 ring-cold/20"><span className="text-2xl">🛒</span><p className="text-sm font-bold text-pine leading-snug">{t('shoppingNoWaste', lang)}<span className="block font-medium text-ink/60">{t('shoppingEveryItem', lang)}</span></p></div>
            <button onClick={() => onNavigate('shopping')} className="mt-8 inline-flex items-center gap-2 rounded-full bg-pine px-7 py-3.5 text-sm font-bold text-white transition-all duration-200 hover:bg-pine-light hover:-translate-y-0.5">{t('shoppingOpenList', lang)}<ArrowRight className="w-4 h-4 text-cold" /></button>
          </Reveal>
          <Reveal delay={0.15}>
            <div className="relative mx-auto w-full max-w-md">
              <div className="absolute -inset-6 rounded-[2.5rem] bg-mint/60 blur-2xl" aria-hidden="true" />
              <div className="relative rounded-[1.9rem] bg-white p-6 sm:p-7 shadow-[0_40px_80px_-32px_rgba(11,61,46,0.4)] ring-1 ring-ink/6">
                <div className="flex items-center justify-between"><h3 className="text-sm font-extrabold uppercase tracking-[0.16em] text-pine">{t('shoppingYourList', lang)}</h3><span className="flex items-center gap-1.5 text-[11px] font-bold text-cold-dark"><span className="w-1.5 h-1.5 rounded-full bg-cold animate-cs-pulse-soft" />{unbought.length} {t('shoppingToBuy', lang)}</span></div>
                <div className="mt-5 space-y-1">
                  {shown.length === 0 ? (<div className="rounded-2xl bg-mint/50 px-4 py-8 text-center ring-1 ring-cold/15"><ShoppingBag className="mx-auto h-6 w-6 text-cold-dark" /><p className="mt-3 text-sm font-semibold text-pine">{t('shoppingEmptyTitle2', lang)}</p><p className="mt-1 text-xs text-ink/55 font-medium">{t('shoppingEmptyDesc2', lang)}</p></div>) : (shown.map((item) => { const emoji = CATEGORY_EMOJI[item.category] ?? '🥫'; return (<div key={item.id} className={`flex items-center gap-3 rounded-2xl px-3.5 py-3 transition-colors ${item.isBought ? 'opacity-55' : 'bg-mint/35 hover:bg-mint/60'}`}>{item.isBought ? (<CheckCircle2 className="h-5 w-5 shrink-0 text-cold" strokeWidth={2.4} />) : (<Circle className="h-5 w-5 shrink-0 text-cold-dark/50" strokeWidth={2.2} />)}<span className="text-lg leading-none">{emoji}</span><span className={`min-w-0 flex-1 truncate text-sm font-semibold ${item.isBought ? 'text-ink/45 line-through' : 'text-ink'}`}>{getLocalizedFoodItemName(item.name, lang)}</span><span className="shrink-0 text-sm font-extrabold text-pine tabular-nums">{item.estimatedPrice.toFixed(2)} {currency}</span></div>); }))}
                </div>
                <div className="mt-5 flex items-center justify-between rounded-2xl bg-pine px-5 py-4"><span className="text-[11px] font-bold uppercase tracking-[0.18em] text-white/60">{t('shoppingEstimatedTotal', lang)}</span><span className="text-xl font-extrabold tracking-tight text-cold tabular-nums">{formatCurrencyAmount(total, currency)}</span></div>
              </div>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
};
