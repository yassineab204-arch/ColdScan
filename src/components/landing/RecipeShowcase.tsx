import React from 'react';
import { Clock, ArrowRight, CheckCircle2, PlusCircle } from 'lucide-react';
import { Recipe, TabType, LanguageType } from '../../types';
import { Reveal } from './Reveal';
import { getLocalizedRecipeName } from '../../utils/i18n';

interface RecipeShowcaseProps {
  recipes: Recipe[];
  lang: LanguageType;
  onNavigate: (tab: TabType) => void;
}

const CARD_STYLES = [
  { bg: 'from-mint to-white', border: 'border-cold/25', emoji: '🍝' },
  { bg: 'from-[#FFF7E8] to-white', border: 'border-[#F5C97B]/30', emoji: '🍳' },
  { bg: 'from-[#F0F7FF] to-white', border: 'border-[#8FC3F0]/30', emoji: '🥗' },
];

export const RecipeShowcase: React.FC<RecipeShowcaseProps> = ({ recipes, lang, onNavigate }) => {
  const featured = recipes.slice(0, 3);

  return (
    <section className="relative overflow-hidden bg-gradient-to-b from-mint/50 via-white to-white py-20 sm:py-28">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <Reveal className="max-w-2xl">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-3.5 py-1.5 text-xs font-bold text-pine ring-1 ring-ink/8">
            RECIPE DISCOVERY
          </span>
          <h2 className="mt-5 text-3xl sm:text-5xl font-extrabold tracking-[-0.03em] text-pine text-balance">
            You already have dinner.
          </h2>
          <p className="mt-4 text-base sm:text-lg text-ink/65 font-medium leading-relaxed max-w-xl">
            ColdScan turns the ingredients you already have into meals you'll
            actually want to make.
          </p>
        </Reveal>

        <div className="mt-12 sm:mt-16 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {featured.map((recipe, i) => {
            const style = CARD_STYLES[i % CARD_STYLES.length];
            const readyNow = recipe.ingredientsMissing.length === 0;

            return (
              <Reveal key={recipe.id} delay={i * 0.12}>
                <article className="group flex h-full flex-col overflow-hidden rounded-[1.75rem] bg-white shadow-[0_24px_60px_-32px_rgba(11,61,46,0.35)] ring-1 ring-ink/6 transition-all duration-300 hover:-translate-y-1.5 hover:shadow-[0_32px_70px_-32px_rgba(11,61,46,0.45)]">
                  {/* Visual band */}
                  <div className={`relative bg-gradient-to-br ${style.bg} px-6 pt-7 pb-6 border-b-2 ${style.border}`}>
                    <span className="text-5xl drop-shadow-sm">{style.emoji}</span>
                    <span className="absolute right-4 top-4 inline-flex items-center gap-1.5 rounded-full bg-white/90 px-3 py-1.5 text-[11px] font-bold text-pine shadow-sm ring-1 ring-ink/8 backdrop-blur-sm">
                      <Clock className="w-3.5 h-3.5 text-cold-dark" />
                      {recipe.cookTimeMinutes} min
                    </span>
                    {/* Ready indicator */}
                    <span
                      className={`absolute bottom-4 right-4 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-bold ${
                        readyNow
                          ? 'bg-cold text-pine-deep shadow-[0_8px_20px_-8px_rgba(34,197,94,0.8)]'
                          : 'bg-white/90 text-ink/70 ring-1 ring-ink/8'
                      }`}
                    >
                      {readyNow ? (
                        <>
                          <span className="w-1.5 h-1.5 rounded-full bg-pine-deep animate-cs-pulse-soft" />
                          Ready now
                        </>
                      ) : (
                        <>
                          <PlusCircle className="w-3.5 h-3.5" />
                          Needs {recipe.ingredientsMissing.length} item
                          {recipe.ingredientsMissing.length > 1 ? 's' : ''}
                        </>
                      )}
                    </span>
                  </div>

                  {/* Body */}
                  <div className="flex flex-1 flex-col p-6">
                    <h3 className="text-lg font-extrabold tracking-tight text-pine leading-snug">
                      {getLocalizedRecipeName(recipe.name, lang)}
                    </h3>
                    <p className="mt-1.5 text-sm text-ink/60 font-medium leading-relaxed line-clamp-2">
                      {recipe.description}
                    </p>

                    <div className="mt-5 flex items-center gap-4 text-[12px] font-semibold text-ink/60">
                      <span className="inline-flex items-center gap-1.5 rounded-lg bg-mint px-2.5 py-1.5 text-pine">
                        <CheckCircle2 className="w-3.5 h-3.5 text-cold-dark" />
                        {recipe.ingredientsHas.length} available
                      </span>
                      <span className="inline-flex items-center gap-1.5 rounded-lg bg-ink/[0.04] px-2.5 py-1.5">
                        <PlusCircle className="w-3.5 h-3.5 text-ink/40" />
                        {recipe.ingredientsMissing.length} missing
                      </span>
                      <span className="ml-auto text-[11px] font-bold uppercase tracking-widest text-ink/40">
                        {recipe.difficulty}
                      </span>
                    </div>

                    <button
                      onClick={() => onNavigate('recipes')}
                      className="mt-6 inline-flex items-center justify-between rounded-2xl bg-pine px-5 py-3.5 text-sm font-bold text-white transition-all duration-200 hover:bg-pine-light group-hover:shadow-[0_16px_36px_-12px_rgba(11,61,46,0.6)]"
                    >
                      View recipe
                      <ArrowRight className="w-4 h-4 transition-transform duration-200 group-hover:translate-x-1" />
                    </button>
                  </div>
                </article>
              </Reveal>
            );
          })}
        </div>

        <Reveal className="mt-12 text-center">
          <button
            onClick={() => onNavigate('recipes')}
            className="inline-flex items-center gap-2 rounded-full bg-white px-7 py-3.5 text-sm font-bold text-pine ring-1 ring-ink/10 transition-all duration-200 hover:ring-cold/50 hover:-translate-y-0.5"
          >
            See all recipes for your fridge
            <ArrowRight className="w-4 h-4 text-cold-dark" />
          </button>
        </Reveal>
      </div>
    </section>
  );
};
