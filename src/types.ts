export type FreshnessStatus = 'fresh' | 'soon_to_expire' | 'expired';

export type CategoryType = 
  | 'Produce'
  | 'Dairy & Eggs'
  | 'Proteins'
  | 'Condiments & Sauces'
  | 'Beverages'
  | 'Bakery'
  | 'Leftovers'
  | 'Pantry & Other';

export interface FoodItem {
  id: string;
  name: string;
  category: CategoryType;
  freshness: FreshnessStatus;
  daysRemaining: number;
  quantity: number;
  unit: string;
  locationInFridge?: string;
  notes?: string;
  addedAt: string; // ISO string
  estimatedExpiryDate?: string;
}

export interface Recipe {
  id: string;
  name: string;
  description: string;
  cookTimeMinutes: number;
  difficulty: 'easy' | 'medium' | 'hard';
  calories: number;
  ingredientsHas: string[];
  ingredientsMissing: string[];
  missingCostEstimate: number;
  instructions: string[];
  tags: string[];
  servings?: number;
  usesExpiringItems?: boolean;
  /** Cuisine the recipe draws from — a CuisineType id (e.g. 'moroccan') or a
   * free-text cuisine name straight from the Chef AI when it is not one of the
   * catalog entries. Rendered as a flag pill on the recipe card. */
  cuisine?: string;
}

export interface ShoppingItem {
  id: string;
  name: string;
  category: CategoryType;
  quantity: number;
  unit: string;
  estimatedPrice: number;
  isBought: boolean;
  priority: 'high' | 'medium' | 'low';
  relatedRecipe?: string;
}

export interface ScanResult {
  itemsFound: FoodItem[];
  totalDetected: number;
  summaryNotes: string;
  suggestedAction: string;
}

export type LanguageType = 'en' | 'fr' | 'ar-MA' | 'es' | 'de' | 'ar' | 'it' | 'pt' | 'ja';

/** Cuisines offered for food-culture personalization (see src/data/cuisines.ts). */
export type CuisineType =
  | 'moroccan'
  | 'italian'
  | 'french'
  | 'mexican'
  | 'japanese'
  | 'american'
  | 'indian'
  | 'turkish';

export interface AppSettings {
  userBudget: number;
  currency: string;
  dietaryPreferences: string[];
  /** Cuisines the Chef AI should prioritize in generated recipes. */
  favoriteCuisines: CuisineType[];
  wasteAlertDays: number;
  voiceOutputEnabled: boolean;
  voiceName: string;
  themeColor: 'emerald' | 'green' | 'teal';
  language: LanguageType;
}

export type TabType = 'home' | 'scan' | 'inventory' | 'recipes' | 'shopping' | 'stores' | 'cost' | 'settings';
