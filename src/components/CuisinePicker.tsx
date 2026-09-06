import React from 'react';
import { Check } from 'lucide-react';
import { CuisineType, LanguageType } from '../types';
import { CUISINES } from '../data/cuisines';
import { getLocalizedCuisineName, t } from '../utils/i18n';

interface CuisinePickerProps {
  /** Currently selected cuisine ids (from settings.favoriteCuisines). */
  selected: CuisineType[];
  /** Called with the cuisine id that was tapped. */
  onToggle: (cuisine: CuisineType) => void;
  lang?: LanguageType;
  /** Extra classes for the pill row (e.g. 'justify-start' inside Settings). */
  className?: string;
}

/**
 * Multi-select pill selector for the cuisine catalog. Shared by the onboarding
 * tutorial and the Settings screen so both stay visually identical.
 */
export const CuisinePicker: React.FC<CuisinePickerProps> = ({
  selected,
  onToggle,
  lang = 'en',
  className = '',
}) => (
  <div
    role="group"
    aria-label={t('cuisinesLabel', lang)}
    className={`flex flex-wrap gap-1.5 justify-center ${className}`}
  >
    {CUISINES.map((cuisine) => {
      const isSelected = selected.includes(cuisine.id);
      return (
        <button
          key={cuisine.id}
          type="button"
          aria-pressed={isSelected}
          onClick={() => onToggle(cuisine.id)}
          className={`px-3 py-1.5 rounded-xl text-[11px] font-black tracking-wide border transition-all inline-flex items-center gap-1.5 active:scale-95 ${
            isSelected
              ? 'bg-cold text-pine-deep border-cold shadow-xs'
              : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
          }`}
        >
          <span aria-hidden className="text-sm leading-none">{cuisine.flag}</span>
          <span>{getLocalizedCuisineName(cuisine.id, lang)}</span>
          {isSelected && <Check className="h-3 w-3 shrink-0" strokeWidth={3.5} />}
        </button>
      );
    })}
  </div>
);
