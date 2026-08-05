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

export interface AppSettings {
  userBudget: number;
  currency: string;
  dietaryPreferences: string[];
  wasteAlertDays: number;
  voiceOutputEnabled: boolean;
  voiceName: string;
  themeColor: 'emerald' | 'green' | 'teal';
  language: LanguageType;
}

export type TabType = 'home' | 'scan' | 'inventory' | 'recipes' | 'shopping' | 'cost' | 'settings';
