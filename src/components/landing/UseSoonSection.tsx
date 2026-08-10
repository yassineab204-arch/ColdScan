import React from 'react';
import { ArrowRight, Leaf } from 'lucide-react';
import { FoodItem, TabType, LanguageType } from '../../types';
import { Reveal } from './Reveal';
import { getLocalizedFoodItemName, getLocalizedCategory } from '../../utils/i18n';

interface UseSoonSectionProps {
  inventory: FoodItem[];
  lang: LanguageType;
  onNavigate: (tab: TabType) => void;
}

const CATEGORY_EMOJI: Record<string, string> = {
  Produce: '🥬',
  'Dairy & Eggs': '🥛',
  Proteins: '🍗',
  'Condiments & Sauces': '🧂',
  Beverages: '🧃',
  Bakery: '🥖',
  Leftovers: '🍲',
  'Pantry & Other': '🥫',
};

function statusFor(item: FoodItem): { label: string; dot: string; row: string } {
  if (item.freshness === 'soon_to_expire') {
    return {
      label: 'Best used soon',
      dot: 'bg-amber-400',
      row: 'bg-amber-50 ring-amber-200/70',
    };
  }
  if (item.freshness === 'expired') {
    return {
      label: 'Check before using',
      dot: 'bg-rose-400',
      row: 'bg-rose-50 ring-rose-200/70',
    };
  }
  return {
    label: 'Still fresh',
    dot: 'bg-cold',
    row: 'bg-white ring-ink/6',
  };
}

export const UseSoonSection: React.FC<UseSoonSectionProps> = ({
  inventory,
  lang,
  onNavigate,
}) => {
  const sorted = [...inventory].sort((a, b) => {
    const rank = (f: string) => (f === 'soon_to_expire' ? 0 : f === 'expired' ? 1 : 2);
    return rank(a.freshness) - rank(b.freshness);
  });
  const shown = sorted.slice(0, 6);
  const useSoonCount = inventory.filter((i) => i.freshness !== 'fresh').length;

  return (
    <section className="relative bg-gradient-to-b from-white to-mint/40 py-20 sm:py-28">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="grid items-center gap-14 lg:grid-cols-[0.9fr_1.1fr] lg:gap-10">
          {/* Copy */}
          <Reveal>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-mint px-3.5 py-1.5 text-xs font-bold text-pine ring-1 ring-cold/20">
              <Leaf className="w-3.5 h-3.5 text-cold-dark" />
              FRESHNESS TRACKING
            </span>
            <h2 className="mt-5 text-3xl sm:text-5xl font-extrabold tracking-[-0.03em] text-pine text-balance">
              Nothing gets forgotten in the back of the fridge.
            </h2>
            <p className="mt-4 text-base sm:text-lg text-ink/65 font-medium leading-relaxed max-w-md">
              ColdScan tracks how fresh each item is and quietly nudges you toward
              what deserves dinner first.
            </p>
            {useSoonCount > 0 && (
              <p className="mt-6 inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-bold text-pine ring-1 ring-ink/8">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-60 animate-cs-pulse-soft" />
                  <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-amber-400" />
                </span>
                {useSoonCount} item{useSoonCount > 1 ? 's' : ''} worth cooking tonight
              </p>
            )}
            <div className="mt-8">
              <button
                onClick={() => onNavigate('inventory')}
                className="inline-flex items-center gap-2 rounded-full bg-pine px-7 py-3.5 text-sm font-bold text-white transition-all duration-200 hover:bg-pine-light hover:-translate-y-0.5"
              >
                Open my fridge
                <ArrowRight className="w-4 h-4 text-cold" />
              </button>
            </div>
          </Reveal>

          {/* Live use-soon list */}
          <Reveal delay={0.15}>
            <div className="relative mx-auto w-full max-w-lg">
              <div className="absolute -inset-5 rounded-[2.5rem] bg-cold/10 blur-2xl" aria-hidden="true" />
              <div className="relative rounded-[1.75rem] bg-white p-6 sm:p-7 shadow-[0_40px_80px_-32px_rgba(11,61,46,0.35)] ring-1 ring-ink/6">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-extrabold uppercase tracking-[0.16em] text-pine">
                    Use soon
                  </h3>
                  <span className="text-[11px] font-bold text-ink/45">
                    From your real fridge inventory
                  </span>
                </div>

                <div className="mt-5 space-y-2.5">
                  {shown.length === 0 && (
                    <div className="rounded-2xl bg-mint/50 px-4 py-8 text-center ring-1 ring-cold/15">
                      <p className="text-sm font-semibold text-pine">Your fridge is empty</p>
                      <p className="mt-1 text-xs text-ink/55">Scan it to start tracking freshness.</p>
                    </div>
                  )}
                  {shown.map((item, i) => {
                    const s = statusFor(item);
                    const emoji = CATEGORY_EMOJI[item.category] ?? '🥫';
                    return (
                      <Reveal key={item.id} delay={0.08 * i} y={14}>
                        <div
                          className={`flex items-center gap-3.5 rounded-2xl px-4 py-3.5 ring-1 ${s.row}`}
                        >
                          <span className="text-xl leading-none">{emoji}</span>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-bold text-ink">
                              {getLocalizedFoodItemName(item.name, lang)}
                            </p>
                            <p className="text-[11px] font-semibold text-ink/50">
                              {getLocalizedCategory(item.category, lang)}
                            </p>
                          </div>
                          <span className="inline-flex shrink-0 items-center gap-2 text-[11px] font-bold text-ink/70">
                            <span className={`h-2 w-2 rounded-full ${s.dot}`} />
                            {s.label}
                          </span>
                        </div>
                      </Reveal>
                    );
                  })}
                </div>

                <p className="mt-5 text-center text-[10px] font-medium text-ink/40">
                  Freshness guidance based on your scan — no guesswork, no expiry claims.
                </p>
              </div>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
};
