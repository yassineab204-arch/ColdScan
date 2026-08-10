import React from 'react';
import { MapPin, ArrowRight } from 'lucide-react';
import { TabType } from '../../types';
import { Reveal } from './Reveal';

interface ComingSoonSectionProps {
  onNavigate: (tab: TabType) => void;
}

export const ComingSoonSection: React.FC<ComingSoonSectionProps> = ({ onNavigate }) => {
  return (
    <section className="relative bg-gradient-to-b from-mint/40 to-white py-20 sm:py-24">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
        <Reveal>
          <div className="relative overflow-hidden rounded-[2rem] bg-white shadow-[0_32px_70px_-36px_rgba(11,61,46,0.4)] ring-1 ring-ink/6">
            {/* Decorative map-pin pattern (decorative only — no real locations) */}
            <div className="pointer-events-none absolute inset-0 opacity-[0.5]">
              <div className="cs-hero-grid absolute inset-0" />
              <MapPin
                className="absolute left-[12%] top-[18%] h-6 w-6 text-cold/30"
                strokeWidth={1.6}
              />
              <MapPin
                className="absolute right-[18%] top-[30%] h-5 w-5 text-cold/25"
                strokeWidth={1.6}
              />
              <MapPin
                className="absolute left-[28%] bottom-[22%] h-5 w-5 text-cold/25"
                strokeWidth={1.6}
              />
              <MapPin
                className="absolute right-[30%] bottom-[14%] h-7 w-7 text-cold/30"
                strokeWidth={1.6}
              />
            </div>

            <div className="relative px-6 py-14 sm:px-14 sm:py-16 text-center">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-pine px-4 py-1.5 text-[11px] font-extrabold uppercase tracking-[0.18em] text-cold shadow-lg shadow-pine/30">
                <MapPin className="h-3.5 w-3.5" />
                Coming soon
              </span>

              <h2 className="mt-6 text-3xl sm:text-4xl font-extrabold tracking-[-0.03em] text-pine text-balance">
                Missing an ingredient?
              </h2>
              <p className="mx-auto mt-4 max-w-md text-base sm:text-lg text-ink/65 font-medium leading-relaxed">
                ColdScan will soon help you find nearby places to get exactly what
                you need — without wandering the aisles.
              </p>

              <button
                onClick={() => onNavigate('shopping')}
                className="mt-9 inline-flex items-center gap-2 rounded-full bg-ink/[0.05] px-6 py-3.5 text-sm font-bold text-pine ring-1 ring-ink/10 transition-all duration-200 hover:ring-cold/50 hover:-translate-y-0.5"
              >
                Meanwhile, keep your list ready
                <ArrowRight className="h-4 w-4 text-cold-dark" />
              </button>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
};
