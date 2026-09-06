/**
 * Server-side cuisine catalog for food-culture personalization.
 *
 * The ids are the `CuisineType` values persisted by the client. This is a
 * deliberate twin of `src/data/cuisines.ts` — the serverless functions never
 * import browser code, so both lists must be kept in sync by hand.
 */
export interface CuisineOption {
  id: string;
  /** English name — what the Chef AI echoes back in recipe JSON. */
  name: string;
  flag: string;
  /** Flavor anchors that steer the recipe generation toward the cuisine. */
  flavorProfile: string;
}

export const CUISINE_OPTIONS: CuisineOption[] = [
  { id: 'moroccan', name: 'Moroccan', flag: '🇲🇦', flavorProfile: 'tagines, couscous, ras el hanout, preserved lemon, olives' },
  { id: 'italian', name: 'Italian', flag: '🇮🇹', flavorProfile: 'pasta, risotto, fresh basil, parmesan, good olive oil' },
  { id: 'french', name: 'French', flag: '🇫🇷', flavorProfile: 'rustic stews, béchamel, herbes de Provence, butter pan sauces' },
  { id: 'mexican', name: 'Mexican', flag: '🇲🇽', flavorProfile: 'tacos, salsas, cumin, lime, cilantro, chili' },
  { id: 'japanese', name: 'Japanese', flag: '🇯🇵', flavorProfile: 'donburi, miso, soy-ginger, sesame, dashi' },
  { id: 'american', name: 'American', flag: '🇺🇸', flavorProfile: 'burgers, casseroles, BBQ, mac and cheese' },
  { id: 'indian', name: 'Indian', flag: '🇮🇳', flavorProfile: 'curries, garam masala, lentils, cumin-tomato bases' },
  { id: 'turkish', name: 'Turkish', flag: '🇹🇷', flavorProfile: 'kebabs, mezes, yogurt sauces, sumac, flatbreads' },
];

const BY_ID = new Map(CUISINE_OPTIONS.map((c) => [c.id, c]));
const BY_NAME = new Map(CUISINE_OPTIONS.map((c) => [c.name.toLowerCase(), c]));

/**
 * Keeps only recognized cuisines from the client payload (ids or English
 * names), de-duplicated in catalog order. Never trusts the wire format.
 */
export function sanitizeCuisines(input: unknown): CuisineOption[] {
  if (!Array.isArray(input)) return [];
  const seen = new Set<string>();
  for (const raw of input) {
    if (typeof raw !== 'string') continue;
    const key = raw.toLowerCase().trim();
    const option = BY_ID.get(key) ?? BY_NAME.get(key);
    if (option) seen.add(option.id);
  }
  return CUISINE_OPTIONS.filter((c) => seen.has(c.id));
}

/** Resolves a model-returned cuisine name/id to its catalog option, if known. */
export function findCuisineOption(value: string): CuisineOption | undefined {
  const key = value.toLowerCase().trim();
  return BY_ID.get(key) ?? BY_NAME.get(key);
}
