import React from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { Camera, ChefHat, ShoppingBag } from 'lucide-react';
import { TabType } from '../../types';
import { FridgeVisual } from './FridgeVisual';

interface HeroProps {
  onNavigate: (tab: TabType) => void;
  itemsDetected: number;
  expiringCount: number;
  recipeCount: number;
}

const ease = [0.22, 1, 0.36, 1] as const;

export const Hero: React.FC<HeroProps> = ({
  onNavigate,
  itemsDetected,
  expiringCount,
  recipeCount,
}) => {
  const reduce = useReducedMotion();

  return (
    <section className="relative overflow-hidden">
      {/* Ambient background */}
      <div className="absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-gradient-to-b from-mint/70 via-white to-white" />
        <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-[720px] h-[480px] rounded-full bg-cold/10 blur-[120px]" />
        <div className="absolute top-40 -left-24 w-96 h-96 rounded-full bg-mint-deep/60 blur-[100px]" />
        <div className="cs-hero-grid absolute inset-x-0 top-0 h-[560px] opacity-50 [mask-image:linear-gradient(to_bottom,black,transparent)]" />
      </div>

      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 pt-16 sm:pt-24 lg:pt-28 pb-16 sm:pb-24">
        <div className="grid items-center gap-14 lg:grid-cols-[1.05fr_0.95fr] lg:gap-8">
          {/* Copy */}
          <div className="max-w-xl mx-auto lg:mx-0 text-center lg:text-left">
            <motion.div
              initial={reduce ? false : { opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease }}
            >
              <span className="inline-flex items-center gap-2 rounded-full bg-white px-3.5 py-1.5 text-xs font-semibold text-pine ring-1 ring-ink/8 shadow-[0_2px_12px_rgba(11,61,46,0.06)]">
                <span className="text-sm leading-none">✨</span>
                Your smart kitchen assistant
              </span>
            </motion.div>

            <motion.h1
              initial={reduce ? false : { opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.08, ease }}
              className="mt-6 text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-[-0.03em] text-pine leading-[1.04] text-balance"
            >
              Your fridge has a{' '}
              <span className="relative whitespace-nowrap">
                secret.
                <svg
                  className="absolute -bottom-2 left-0 w-full text-cold"
                  viewBox="0 0 220 12"
                  fill="none"
                  aria-hidden="true"
                >
                  <path
                    d="M3 9C60 3 160 3 217 9"
                    stroke="currentColor"
                    strokeWidth="5"
                    strokeLinecap="round"
                  />
                </svg>
              </span>
            </motion.h1>

            <motion.p
              initial={reduce ? false : { opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.16, ease }}
              className="mt-6 text-lg sm:text-xl text-ink/70 font-medium leading-relaxed max-w-md mx-auto lg:mx-0"
            >
              Turn the food you already have into your next meal.
            </motion.p>

            <motion.div
              initial={reduce ? false : { opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.24, ease }}
              className="mt-9 flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-3.5"
            >
              <button
                onClick={() => onNavigate('scan')}
                className="group inline-flex w-full sm:w-auto items-center justify-center gap-2.5 rounded-full bg-cold px-7 py-4 text-[15px] font-bold text-pine-deep shadow-[0_16px_40px_-12px_rgba(34,197,94,0.7)] transition-all duration-200 hover:bg-cold/90 hover:shadow-[0_20px_48px_-12px_rgba(34,197,94,0.8)] hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98]"
              >
                <Camera className="w-5 h-5" strokeWidth={2.4} />
                Scan my fridge
              </button>
              <button
                onClick={() => onNavigate('recipes')}
                className="inline-flex w-full sm:w-auto items-center justify-center gap-2 rounded-full bg-white px-7 py-4 text-[15px] font-bold text-pine ring-1 ring-ink/10 shadow-sm transition-all duration-200 hover:ring-cold/60 hover:text-pine-light hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98]"
              >
                <ChefHat className="w-5 h-5" strokeWidth={2.2} />
                Explore recipes
              </button>
            </motion.div>

            {/* Live mini-stats from real app data */}
            <motion.div
              initial={reduce ? false : { opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.34, ease }}
              className="mt-10 flex items-center justify-center lg:justify-start gap-7"
            >
              <div className="text-center lg:text-left">
                <p className="text-2xl font-extrabold text-pine leading-none">{itemsDetected}</p>
                <p className="mt-1 text-[10px] font-semibold uppercase tracking-widest text-ink/50">
                  Items in your fridge
                </p>
              </div>
              <div className="h-8 w-px bg-ink/10" />
              <div className="text-center lg:text-left">
                <p className="text-2xl font-extrabold text-pine leading-none">{recipeCount}</p>
                <p className="mt-1 text-[10px] font-semibold uppercase tracking-widest text-ink/50">
                  Recipes ready
                </p>
              </div>
              <div className="h-8 w-px bg-ink/10" />
              <div className="text-center lg:text-left">
                <p className="text-2xl font-extrabold text-cold-dark leading-none">{expiringCount}</p>
                <p className="mt-1 text-[10px] font-semibold uppercase tracking-widest text-ink/50">
                  Use soon
                </p>
              </div>
            </motion.div>
          </div>

          {/* Visual */}
          <motion.div
            initial={reduce ? false : { opacity: 0, y: 32, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.9, delay: 0.2, ease }}
            className="relative"
          >
            <FridgeVisual itemsDetected={itemsDetected} expiringCount={expiringCount} />

            {/* FRIDGE → SCAN → AI → RECIPES caption */}
            <div className="mt-10 flex items-center justify-center gap-2.5 text-[10px] font-bold uppercase tracking-[0.18em] text-ink/45">
              <span>Fridge</span>
              <Arrow />
              <span className="flex items-center gap-1 text-cold-dark">
                <Camera className="w-3.5 h-3.5" /> Scan
              </span>
              <Arrow />
              <span className="flex items-center gap-1 text-cold-dark">AI</span>
              <Arrow />
              <span className="flex items-center gap-1 text-cold-dark">
                <ShoppingBag className="w-3.5 h-3.5" /> Recipes
              </span>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
};

const Arrow: React.FC = () => (
  <svg className="w-4 h-4 text-cold" viewBox="0 0 16 16" fill="none" aria-hidden="true">
    <path d="M2 8h11M9 4l4 4-4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
