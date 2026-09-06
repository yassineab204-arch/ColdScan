import { CuisineType } from '../types';

export interface CuisineInfo {
  id: CuisineType;
  /** Country flag shown on the pill and recipe cards, e.g. "🇲🇦". */
  flag: string;
  /** English name — also what the Chef AI echoes back in recipe JSON. */
  name: string;
}

/**
 * Canonical cuisine catalog for food-culture personalization.
 *
 * The ids double as the values persisted in `settings.favoriteCuisines` and
 * sent to /api/generate-recipes. There is a server-side twin in
 * `api/_lib/cuisines.ts` (the serverless functions never import browser code),
 * so keep both lists in sync.
 */
export const CUISINES: CuisineInfo[] = [
  { id: 'moroccan', flag: '🇲🇦', name: 'Moroccan' },
  { id: 'italian', flag: '🇮🇹', name: 'Italian' },
  { id: 'french', flag: '🇫🇷', name: 'French' },
  { id: 'mexican', flag: '🇲🇽', name: 'Mexican' },
  { id: 'japanese', flag: '🇯🇵', name: 'Japanese' },
  { id: 'american', flag: '🇺🇸', name: 'American' },
  { id: 'indian', flag: '🇮🇳', name: 'Indian' },
  { id: 'turkish', flag: '🇹🇷', name: 'Turkish' },
];

const BY_KEY = new Map<string, CuisineInfo>(
  CUISINES.flatMap((c) => [
    [c.id, c] as const,
    [c.name.toLowerCase(), c] as const,
  ])
);

/**
 * Resolves a cuisine reference — a catalog id ('moroccan') or the English
 * cuisine name the Chef AI may return ('Moroccan') — to its catalog entry.
 * Returns null for unknown/empty values so callers can fall back gracefully.
 */
export function getCuisineMeta(value?: string | null): CuisineInfo | null {
  if (!value) return null;
  return BY_KEY.get(value.toLowerCase().trim()) ?? null;
}
