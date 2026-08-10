import React from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { Camera, Sparkles, ShoppingBag } from 'lucide-react';
import { Reveal } from './Reveal';

const STEPS = [
  {
    num: '01',
    title: 'Scan',
    text: 'Take a photo of your fridge.',
    icon: Camera,
    accent: 'bg-mint text-pine ring-cold/25',
  },
  {
    num: '02',
    title: 'Discover',
    text: 'Get recipes based on what you already have.',
    icon: Sparkles,
    accent: 'bg-mint text-pine ring-cold/25',
  },
  {
    num: '03',
    title: 'Save',
    text: "Buy only what you're missing.",
    icon: ShoppingBag,
    accent: 'bg-mint text-pine ring-cold/25',
  },
];

const ease = [0.22, 1, 0.36, 1] as const;

export const HowItWorks: React.FC = () => {
  const reduce = useReducedMotion();

  return (
    <section className="relative bg-white py-20 sm:py-28">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <Reveal className="text-center max-w-2xl mx-auto">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-mint px-3.5 py-1.5 text-xs font-bold text-pine ring-1 ring-cold/20">
            HOW IT WORKS
          </span>
          <h2 className="mt-5 text-3xl sm:text-5xl font-extrabold tracking-[-0.03em] text-pine text-balance">
            From fridge to dinner in seconds.
          </h2>
        </Reveal>

        <div className="relative mt-14 sm:mt-20">
          {/* Connecting line (desktop) */}
          <div
            className="absolute left-[16%] right-[16%] top-[52px] hidden lg:block"
            aria-hidden="true"
          >
            <svg className="w-full" height="2" viewBox="0 0 800 2" preserveAspectRatio="none">
              <line
                x1="0"
                y1="1"
                x2="800"
                y2="1"
                stroke="#d9f0e4"
                strokeWidth="2"
                strokeDasharray="4 8"
                strokeLinecap="round"
              />
            </svg>
          </div>

          <div className="grid gap-10 sm:gap-8 md:grid-cols-3">
            {STEPS.map((step, i) => {
              const Icon = step.icon;
              return (
                <motion.div
                  key={step.num}
                  initial={reduce ? false : { opacity: 0, y: 32 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: '-64px' }}
                  transition={{ duration: 0.65, delay: i * 0.15, ease }}
                  className="relative text-center"
                >
                  <div className="relative mx-auto flex h-[104px] w-[104px] items-center justify-center rounded-3xl bg-white shadow-[0_20px_50px_-20px_rgba(11,61,46,0.35)] ring-1 ring-ink/5">
                    <span className={`flex h-16 w-16 items-center justify-center rounded-2xl ring-1 ${step.accent}`}>
                      <Icon className="w-7 h-7" strokeWidth={2.2} />
                    </span>
                    <span className="absolute -top-3 -right-2 flex h-9 w-9 items-center justify-center rounded-full bg-pine text-[11px] font-extrabold text-cold ring-4 ring-white">
                      {step.num}
                    </span>
                  </div>
                  <h3 className="mt-6 text-xl sm:text-2xl font-extrabold tracking-tight text-pine uppercase">
                    {step.title}
                  </h3>
                  <p className="mt-2 text-sm sm:text-base text-ink/65 font-medium leading-relaxed max-w-[260px] mx-auto">
                    {step.text}
                  </p>
                </motion.div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
};
