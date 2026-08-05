import { FoodItem, Recipe, ShoppingItem, AppSettings } from '../types';

export const INITIAL_INVENTORY: FoodItem[] = [
  {
    id: 'item-1',
    name: 'Organic Spinach',
    category: 'Produce',
    freshness: 'soon_to_expire',
    daysRemaining: 1,
    quantity: 1,
    unit: 'bag (200g)',
    locationInFridge: 'Crisper Drawer',
    notes: 'Use in salad or frittata soon',
    addedAt: new Date(Date.now() - 4 * 86400000).toISOString(),
  },
  {
    id: 'item-2',
    name: 'Whole Milk',
    category: 'Dairy & Eggs',
    freshness: 'soon_to_expire',
    daysRemaining: 2,
    quantity: 0.5,
    unit: 'carton (1L)',
    locationInFridge: 'Top Shelf',
    notes: 'Nearly empty',
    addedAt: new Date(Date.now() - 6 * 86400000).toISOString(),
  },
  {
    id: 'item-3',
    name: 'Greek Yogurt (Vanilla)',
    category: 'Dairy & Eggs',
    freshness: 'fresh',
    daysRemaining: 7,
    quantity: 1,
    unit: 'tub (500g)',
    locationInFridge: 'Middle Shelf',
    addedAt: new Date().toISOString(),
  },
  {
    id: 'item-4',
    name: 'Large Eggs',
    category: 'Dairy & Eggs',
    freshness: 'fresh',
    daysRemaining: 12,
    quantity: 8,
    unit: 'eggs',
    locationInFridge: 'Door Shelf',
    addedAt: new Date(Date.now() - 2 * 86400000).toISOString(),
  },
  {
    id: 'item-5',
    name: 'Cheddar Cheese Block',
    category: 'Dairy & Eggs',
    freshness: 'fresh',
    daysRemaining: 10,
    quantity: 1,
    unit: 'block (250g)',
    locationInFridge: 'Middle Shelf',
    addedAt: new Date(Date.now() - 3 * 86400000).toISOString(),
  },
  {
    id: 'item-6',
    name: 'Roma Tomatoes',
    category: 'Produce',
    freshness: 'soon_to_expire',
    daysRemaining: 2,
    quantity: 4,
    unit: 'pcs',
    locationInFridge: 'Crisper Drawer',
    notes: 'A bit soft, perfect for sauce',
    addedAt: new Date(Date.now() - 5 * 86400000).toISOString(),
  },
  {
    id: 'item-7',
    name: 'Boneless Chicken Breast',
    category: 'Proteins',
    freshness: 'fresh',
    daysRemaining: 3,
    quantity: 2,
    unit: 'breasts (400g)',
    locationInFridge: 'Bottom Shelf',
    notes: 'Cook or freeze by Friday',
    addedAt: new Date(Date.now() - 1 * 86400000).toISOString(),
  },
  {
    id: 'item-8',
    name: 'Dijon Mustard',
    category: 'Condiments & Sauces',
    freshness: 'fresh',
    daysRemaining: 60,
    quantity: 1,
    unit: 'jar',
    locationInFridge: 'Door Shelf',
    addedAt: new Date(Date.now() - 20 * 86400000).toISOString(),
  },
  {
    id: 'item-9',
    name: 'Hass Avocados',
    category: 'Produce',
    freshness: 'fresh',
    daysRemaining: 4,
    quantity: 2,
    unit: 'pcs',
    locationInFridge: 'Crisper Drawer',
    addedAt: new Date(Date.now() - 1 * 86400000).toISOString(),
  },
  {
    id: 'item-10',
    name: 'Fresh Strawberries',
    category: 'Produce',
    freshness: 'expired',
    daysRemaining: 0,
    quantity: 1,
    unit: 'punnet (300g)',
    locationInFridge: 'Top Shelf',
    notes: 'Check for mold before eating',
    addedAt: new Date(Date.now() - 8 * 86400000).toISOString(),
  },
  {
    id: 'item-11',
    name: 'Oat Milk',
    category: 'Beverages',
    freshness: 'fresh',
    daysRemaining: 8,
    quantity: 1,
    unit: 'carton (1L)',
    locationInFridge: 'Door Shelf',
    addedAt: new Date(Date.now() - 2 * 86400000).toISOString(),
  },
  {
    id: 'item-12',
    name: 'Leftover Pasta Bake',
    category: 'Leftovers',
    freshness: 'soon_to_expire',
    daysRemaining: 1,
    quantity: 1,
    unit: 'container',
    locationInFridge: 'Middle Shelf',
    notes: 'Reheat thoroughly today',
    addedAt: new Date(Date.now() - 3 * 86400000).toISOString(),
  }
];

export const DEFAULT_RECIPES: Recipe[] = [
  {
    id: 'recipe-1',
    name: 'Spinach & Cheddar Omelette',
    description: 'Quick protein-packed breakfast that rescues your expiring spinach and eggs.',
    cookTimeMinutes: 12,
    difficulty: 'easy',
    calories: 320,
    ingredientsHas: ['Organic Spinach', 'Large Eggs', 'Cheddar Cheese Block'],
    ingredientsMissing: ['Butter (10g)', 'Black Pepper'],
    missingCostEstimate: 1.50,
    instructions: [
      'Whisk 3 eggs with a splash of milk and pinch of salt.',
      'Sauté spinach in butter for 1 minute until wilted.',
      'Pour egg mixture into skillet and sprinkle shredded cheddar cheese.',
      'Fold and serve warm.'
    ],
    tags: ['Quick', 'Vegetarian', 'High Protein', 'Waste Reducer'],
    servings: 1,
    usesExpiringItems: true
  },
  {
    id: 'recipe-2',
    name: 'Pan-Seared Chicken with Tomato-Basil Salad',
    description: 'Fresh chicken breasts accompanied by ripe Roma tomatoes and sliced avocado.',
    cookTimeMinutes: 22,
    difficulty: 'medium',
    calories: 480,
    ingredientsHas: ['Boneless Chicken Breast', 'Roma Tomatoes', 'Hass Avocados', 'Dijon Mustard'],
    ingredientsMissing: ['Olive Oil', 'Fresh Basil', 'Balsamic Vinegar'],
    missingCostEstimate: 3.80,
    instructions: [
      'Season chicken breast with Dijon mustard, salt, and pepper.',
      'Pan sear chicken in olive oil for 6-7 minutes per side until gold and cooked through.',
      'Dice Roma tomatoes and avocado, toss with olive oil and fresh basil.',
      'Plate chicken with tomato salad and drizzle balsamic vinegar.'
    ],
    tags: ['Healthy', 'Keto Friendly', 'Low Carb', 'Waste Reducer'],
    servings: 2,
    usesExpiringItems: true
  },
  {
    id: 'recipe-3',
    name: 'Berry Vanilla Yogurt Parfait',
    description: 'Crisp and refreshing parfait layering creamy vanilla Greek yogurt with fresh fruits.',
    cookTimeMinutes: 5,
    difficulty: 'easy',
    calories: 240,
    ingredientsHas: ['Greek Yogurt (Vanilla)'],
    ingredientsMissing: ['Granola (100g)', 'Fresh Honey', 'Blueberries'],
    missingCostEstimate: 4.20,
    instructions: [
      'Spoon half of Greek yogurt into a tall glass.',
      'Add a layer of crunchy granola and honey.',
      'Top with remaining yogurt and fresh blueberries.'
    ],
    tags: ['Breakfast', 'Snack', 'No-Cook'],
    servings: 1,
    usesExpiringItems: false
  },
  {
    id: 'recipe-4',
    name: 'Creamy Spinach & Tomato Pasta',
    description: 'Satisfying vegetarian pasta incorporating wilting spinach and sweet Roma tomatoes.',
    cookTimeMinutes: 18,
    difficulty: 'easy',
    calories: 520,
    ingredientsHas: ['Organic Spinach', 'Roma Tomatoes', 'Whole Milk', 'Cheddar Cheese Block'],
    ingredientsMissing: ['Penne Pasta (250g)', 'Garlic Cloves', 'Olive Oil'],
    missingCostEstimate: 2.90,
    instructions: [
      'Boil penne pasta according to package instructions until al dente.',
      'Sauté minced garlic and diced tomatoes in olive oil.',
      'Add milk and shredded cheddar, simmer into a smooth sauce.',
      'Stir in spinach until wilted, fold in cooked pasta.'
    ],
    tags: ['Comfort Food', 'Vegetarian', 'Waste Reducer'],
    servings: 2,
    usesExpiringItems: true
  }
];

export const DEFAULT_SHOPPING_LIST: ShoppingItem[] = [
  {
    id: 'shop-1',
    name: 'Butter (Unsalted)',
    category: 'Dairy & Eggs',
    quantity: 1,
    unit: 'pack (250g)',
    estimatedPrice: 28.00,
    isBought: false,
    priority: 'high',
    relatedRecipe: 'Spinach & Cheddar Omelette'
  },
  {
    id: 'shop-2',
    name: 'Fresh Basil Leaves',
    category: 'Produce',
    quantity: 1,
    unit: 'bunch',
    estimatedPrice: 5.00,
    isBought: false,
    priority: 'medium',
    relatedRecipe: 'Pan-Seared Chicken'
  },
  {
    id: 'shop-3',
    name: 'Penne Pasta',
    category: 'Pantry & Other',
    quantity: 1,
    unit: 'box (500g)',
    estimatedPrice: 14.00,
    isBought: false,
    priority: 'high',
    relatedRecipe: 'Creamy Spinach Pasta'
  },
  {
    id: 'shop-4',
    name: 'Extra Virgin Olive Oil',
    category: 'Condiments & Sauces',
    quantity: 1,
    unit: 'bottle (500ml)',
    estimatedPrice: 65.00,
    isBought: false,
    priority: 'low'
  },
  {
    id: 'shop-5',
    name: 'Granola (Honey Oat)',
    category: 'Bakery',
    quantity: 1,
    unit: 'bag (350g)',
    estimatedPrice: 34.00,
    isBought: false,
    priority: 'medium',
    relatedRecipe: 'Berry Vanilla Parfait'
  }
];

export const DEFAULT_SETTINGS: AppSettings = {
  userBudget: 500,
  currency: 'DH',
  dietaryPreferences: ['Low Waste', 'Balanced'],
  wasteAlertDays: 3,
  voiceOutputEnabled: true,
  voiceName: 'Zephyr',
  themeColor: 'emerald',
  language: 'en'
};

export const SAMPLE_FRIDGE_PHOTOS = [
  {
    id: 'sample-1',
    title: 'Balanced Fresh Fridge',
    description: 'Contains greens, dairy, eggs, condiments, and chicken breasts',
    thumbnail: 'https://images.unsplash.com/photo-1588854337236-6889d631faa8?auto=format&fit=crop&w=600&q=80',
    mockItemsFound: [
      { name: 'Fresh Bell Peppers', category: 'Produce', freshness: 'fresh', daysRemaining: 5, quantity: 3, unit: 'pcs', locationInFridge: 'Crisper Drawer' },
      { name: 'Organic Spinach', category: 'Produce', freshness: 'soon_to_expire', daysRemaining: 1, quantity: 1, unit: 'bag', locationInFridge: 'Crisper Drawer' },
      { name: 'Whole Milk', category: 'Dairy & Eggs', freshness: 'soon_to_expire', daysRemaining: 2, quantity: 1, unit: 'carton', locationInFridge: 'Top Shelf' },
      { name: 'Greek Yogurt', category: 'Dairy & Eggs', freshness: 'fresh', daysRemaining: 9, quantity: 2, unit: 'tubs', locationInFridge: 'Middle Shelf' },
      { name: 'Cheddar Cheese', category: 'Dairy & Eggs', freshness: 'fresh', daysRemaining: 14, quantity: 1, unit: 'block', locationInFridge: 'Middle Shelf' },
      { name: 'Eggs', category: 'Dairy & Eggs', freshness: 'fresh', daysRemaining: 12, quantity: 12, unit: 'eggs', locationInFridge: 'Door Shelf' }
    ]
  },
  {
    id: 'sample-2',
    title: 'Produce & Greens Focus',
    description: 'Rich in vegetables, fruits, and fresh berries needing attention',
    thumbnail: 'https://images.unsplash.com/photo-1540420773420-3366772f4999?auto=format&fit=crop&w=600&q=80',
    mockItemsFound: [
      { name: 'Roma Tomatoes', category: 'Produce', freshness: 'soon_to_expire', daysRemaining: 2, quantity: 5, unit: 'pcs', locationInFridge: 'Crisper' },
      { name: 'Strawberries', category: 'Produce', freshness: 'soon_to_expire', daysRemaining: 1, quantity: 1, unit: 'punnet', locationInFridge: 'Top Shelf' },
      { name: 'Avocados', category: 'Produce', freshness: 'fresh', daysRemaining: 4, quantity: 3, unit: 'pcs', locationInFridge: 'Crisper' },
      { name: 'Cucumbers', category: 'Produce', freshness: 'fresh', daysRemaining: 6, quantity: 2, unit: 'pcs', locationInFridge: 'Crisper' },
      { name: 'Lemon', category: 'Produce', freshness: 'fresh', daysRemaining: 10, quantity: 2, unit: 'pcs', locationInFridge: 'Door' }
    ]
  }
];
