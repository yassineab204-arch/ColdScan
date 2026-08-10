import React from 'react';
import { Sparkles, SendHorizonal, Refrigerator, Mic } from 'lucide-react';
import { FoodItem, Recipe, LanguageType } from '../../types';
import { Reveal } from './Reveal';
import { getLocalizedFoodItemName, getLocalizedRecipeName } from '../../utils/i18n';

interface AIExperienceProps {
  inventory: FoodItem[];
  recipes: Recipe[];
  lang: LanguageType;
  onOpenAssistant: () => void;
  onOpenLiveVoice: () => void;
}

export const AIExperience: React.FC<AIExperienceProps> = ({
  inventory,
  recipes,
  lang,
  onOpenAssistant,
  onOpenLiveVoice,
}) => {
  const found = inventory
    .slice(0, 4)
    .map((i) => getLocalizedFoodItemName(i.name, lang));
  const foundText =
    found.length > 1
      ? `I found ${found.slice(0, -1).join(', ')} and ${found[found.length - 1]}.`
      : found[0]
        ? `I found ${found[0]}.`
        : 'Your fridge looks empty right now — scan it and I will look.';

  const suggestions = recipes.slice(0, 3);

  return (
    <section className="relative overflow-hidden bg-white py-20 sm:py-28">
      <div className="absolute -top-24 right-0 h-80 w-80 rounded-full bg-cold/8 blur-[100px]" aria-hidden="true" />
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="grid items-center gap-14 lg:grid-cols-2 lg:gap-10">
          {/* Chat card */}
          <Reveal className="order-2 lg:order-1">
            <div className="relative mx-auto w-full max-w-md">
              <div className="absolute -inset-6 rounded-[2.5rem] bg-mint/70 blur-2xl" aria-hidden="true" />
              <div className="relative overflow-hidden rounded-[1.9rem] bg-white shadow-[0_40px_80px_-32px_rgba(11,61,46,0.4)] ring-1 ring-ink/6">
                {/* Chat header */}
                <div className="flex items-center gap-3 border-b border-ink/6 bg-mint/50 px-5 py-4">
                  <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-pine ring-1 ring-cold/30">
                    <Refrigerator className="h-5 w-5 text-cold" strokeWidth={2.3} />
                  </span>
                  <div>
                    <p className="text-sm font-extrabold text-pine leading-none">ColdScan AI</p>
                    <p className="mt-1 flex items-center gap-1.5 text-[11px] font-semibold text-cold-dark">
                      <span className="h-1.5 w-1.5 rounded-full bg-cold animate-cs-pulse-soft" />
                      Watching your fridge · replies instantly
                    </p>
                  </div>
                  <Sparkles className="ml-auto h-4 w-4 text-cold-dark" />
                </div>

                {/* Messages */}
                <div className="space-y-4 px-5 py-6">
                  <div className="flex justify-end">
                    <div className="max-w-[85%] rounded-2xl rounded-br-md bg-pine px-4 py-3">
                      <p className="text-[13px] font-medium leading-relaxed text-white">
                        What can I make with what I have?
                      </p>
                    </div>
                  </div>

                  <div className="flex justify-start">
                    <div className="max-w-[90%] rounded-2xl rounded-bl-md bg-ink/[0.04] px-4 py-3 ring-1 ring-ink/6">
                      <p className="text-[13px] font-medium leading-relaxed text-ink/80">
                        {foundText}
                      </p>
                      <p className="mt-3 text-[13px] font-semibold text-ink">
                        You can make:
                      </p>
                      <ol className="mt-1.5 space-y-1.5">
                        {suggestions.map((r, i) => (
                          <li key={r.id} className="flex items-start gap-2 text-[13px]">
                            <span className="mt-0.5 flex h-4.5 w-4.5 shrink-0 items-center justify-center rounded-full bg-cold/15 text-[10px] font-extrabold text-cold-dark ring-1 ring-cold/25">
                              {i + 1}
                            </span>
                            <span className="font-semibold text-ink/85">
                              {getLocalizedRecipeName(r.name, lang)}
                            </span>
                          </li>
                        ))}
                      </ol>
                    </div>
                  </div>
                </div>

                {/* Input mock */}
                <div className="border-t border-ink/6 px-5 py-4">
                  <div className="flex items-center gap-2.5 rounded-2xl bg-ink/[0.04] px-4 py-3 ring-1 ring-ink/8">
                    <span className="flex-1 text-[13px] font-medium text-ink/40">
                      Ask anything about your fridge…
                    </span>
                    <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-cold text-pine-deep">
                      <SendHorizonal className="h-4 w-4" strokeWidth={2.4} />
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </Reveal>

          {/* Copy */}
          <Reveal delay={0.12} className="order-1 lg:order-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-mint px-3.5 py-1.5 text-xs font-bold text-pine ring-1 ring-cold/20">
              <Sparkles className="w-3.5 h-3.5 text-cold-dark" />
              YOUR AI KITCHEN ASSISTANT
            </span>
            <h2 className="mt-5 text-3xl sm:text-5xl font-extrabold tracking-[-0.03em] text-pine text-balance">
              More than a scanner.
              <br />
              A sous-chef who knows your fridge.
            </h2>
            <p className="mt-4 text-base sm:text-lg text-ink/65 font-medium leading-relaxed max-w-md">
              Ask what to cook, what's about to go, or what to buy. ColdScan answers
              with your actual ingredients — never a generic list.
            </p>

            <div className="mt-8 flex flex-col sm:flex-row items-start sm:items-center gap-4">
              <button
                onClick={onOpenAssistant}
                className="inline-flex items-center gap-2 rounded-full bg-cold px-7 py-3.5 text-sm font-bold text-pine-deep shadow-[0_16px_40px_-12px_rgba(34,197,94,0.7)] transition-all duration-200 hover:bg-cold/90 hover:-translate-y-0.5"
              >
                <Sparkles className="w-4 h-4" />
                Try it with your fridge
              </button>
              <button
                onClick={onOpenLiveVoice}
                className="inline-flex items-center gap-2 rounded-full bg-white px-7 py-3.5 text-sm font-bold text-pine ring-1 ring-ink/10 transition-all duration-200 hover:ring-cold/50 hover:-translate-y-0.5"
              >
                <Mic className="w-4 h-4 text-cold-dark" />
                Or just talk to it
              </button>
            </div>
            <p className="mt-3 text-xs font-semibold text-ink/50">
              Free · no sign-up
            </p>
          </Reveal>
        </div>
      </div>
    </section>
  );
};
