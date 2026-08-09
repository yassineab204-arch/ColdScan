import React, { useState, useEffect } from 'react';
import { TabType, FoodItem, Recipe, ShoppingItem, AppSettings } from './types';
import { 
  INITIAL_INVENTORY, 
  DEFAULT_RECIPES, 
  DEFAULT_SHOPPING_LIST, 
  DEFAULT_SETTINGS 
} from './data/mockData';
import { Header } from './components/Header';
import { Navigation } from './components/Navigation';
import { LiveVoiceModal } from './components/LiveVoiceModal';

import { HomeScreen } from './components/screens/HomeScreen';
import { ScanScreen } from './components/screens/ScanScreen';
import { InventoryScreen } from './components/screens/InventoryScreen';
import { RecipesScreen } from './components/screens/RecipesScreen';
import { ShoppingListScreen } from './components/screens/ShoppingListScreen';
import { CostEstimateScreen } from './components/screens/CostEstimateScreen';
import { SettingsScreen } from './components/screens/SettingsScreen';

import { convertCurrency } from './utils/currency';
import {
  buildExpiryNotice,
  clearNotifiedItemIds,
  getExpiringItems,
  getNotifiedItemIds,
  saveNotifiedItemIds,
  showExpiryNotification,
} from './utils/notifications';

const getInitialInventory = (): FoodItem[] => {
  const saved = localStorage.getItem('coldscan_inventory');
  if (!saved) return [];
  
  try {
    const parsed = JSON.parse(saved);
    if (!Array.isArray(parsed)) return [];
    
    // Check if this is the old demo data (has 12 items with specific demo names)
    const isDemoData = parsed.length === 12 && 
      parsed.some(item => item.name === 'Organic Spinach') &&
      parsed.some(item => item.name === 'Whole Milk');
    
    if (isDemoData) {
      localStorage.removeItem('coldscan_inventory');
      return [];
    }
    
    return parsed;
  } catch {
    return [];
  }
};

const getInitialRecipes = (): Recipe[] => {
  const saved = localStorage.getItem('coldscan_recipes');
  if (!saved) return [];
  
  try {
    const parsed = JSON.parse(saved);
    if (!Array.isArray(parsed)) return [];
    
    // Check if this is the old demo data
    const isDemoData = parsed.length === 4 && 
      parsed.some(r => r.name === 'Spinach & Cheddar Omelette');
    
    if (isDemoData) {
      localStorage.removeItem('coldscan_recipes');
      return [];
    }
    
    return parsed;
  } catch {
    return [];
  }
};

const getInitialShoppingList = (): ShoppingItem[] => {
  const saved = localStorage.getItem('coldscan_shopping');
  if (!saved) return [];
  
  try {
    const parsed = JSON.parse(saved);
    if (!Array.isArray(parsed)) return [];
    
    // Check if this is the old demo data
    const isDemoData = parsed.length === 5 && 
      parsed.some(item => item.name === 'Butter (Unsalted)');
    
    if (isDemoData) {
      localStorage.removeItem('coldscan_shopping');
      return [];
    }
    
    return parsed;
  } catch {
    return [];
  }
};

export default function App() {
  const [activeTab, setActiveTab] = useState<TabType>('home');
  const [isLiveVoiceOpen, setIsLiveVoiceOpen] = useState(false);
  const [expiryNotice, setExpiryNotice] = useState<{ title: string; body: string } | null>(null);

  // Persistent State
  const [inventory, setInventory] = useState<FoodItem[]>(getInitialInventory);
  const [recipes, setRecipes] = useState<Recipe[]>(getInitialRecipes);
  const [shoppingList, setShoppingList] = useState<ShoppingItem[]>(getInitialShoppingList);

  const [settings, setSettings] = useState<AppSettings>(() => {
    const saved = localStorage.getItem('coldscan_settings');
    return saved ? JSON.parse(saved) : DEFAULT_SETTINGS;
  });

  const [isGeneratingRecipes, setIsGeneratingRecipes] = useState(false);
  const [isGeneratingList, setIsGeneratingList] = useState(false);

  // Sync to local storage
  useEffect(() => {
    localStorage.setItem('coldscan_inventory', JSON.stringify(inventory));
  }, [inventory]);

  useEffect(() => {
    localStorage.setItem('coldscan_recipes', JSON.stringify(recipes));
  }, [recipes]);

  useEffect(() => {
    localStorage.setItem('coldscan_shopping', JSON.stringify(shoppingList));
  }, [shoppingList]);

  useEffect(() => {
    localStorage.setItem('coldscan_settings', JSON.stringify(settings));
  }, [settings]);

  // Derived counts
  const expiringCount = inventory.filter((i) => i.freshness === 'soon_to_expire').length;
  const shoppingCount = shoppingList.filter((i) => !i.isBought).length;

  // Inventory Actions
  const handleAddItemsFromScan = (newItems: FoodItem[]) => {
    setInventory((prev) => [...newItems, ...prev]);
  };

  const handleSaveInventoryItem = (item: FoodItem) => {
    setInventory((prev) => {
      const idx = prev.findIndex((i) => i.id === item.id);
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = item;
        return copy;
      }
      return [item, ...prev];
    });
  };

  const handleDeleteInventoryItem = (id: string) => {
    setInventory((prev) => prev.filter((i) => i.id !== id));
  };

  // Recipe AI Generation
  const handleRefreshRecipes = async () => {
    setIsGeneratingRecipes(true);
    try {
      const res = await fetch('/api/generate-recipes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          inventory,
          dietaryPreferences: settings.dietaryPreferences,
          language: settings.language,
        }),
      });

      const data = await res.json();
      if (data.success && data.recipes?.length) {
        setRecipes(data.recipes);
      }
    } catch (err) {
      console.error('Error generating AI recipes:', err);
    } finally {
      setIsGeneratingRecipes(false);
    }
  };

  // Add missing recipe ingredients to Shopping List
  const handleAddMissingToShoppingList = (items: string[], recipeName: string) => {
    const newShoppingItems: ShoppingItem[] = items.map((ingName, idx) => ({
      id: `shop-recipe-${Date.now()}-${idx}`,
      name: ingName,
      category: 'Pantry & Other',
      quantity: 1,
      unit: 'item',
      estimatedPrice: Number((1.5 + Math.random() * 3).toFixed(2)),
      isBought: false,
      priority: 'high',
      relatedRecipe: recipeName,
    }));

    setShoppingList((prev) => [...newShoppingItems, ...prev]);
  };

  // Move bought items to Inventory
  const handleMoveBoughtToInventory = () => {
    const bought = shoppingList.filter((i) => i.isBought);
    if (bought.length === 0) return;

    const newFoodItems: FoodItem[] = bought.map((b) => ({
      id: `item-bought-${Date.now()}-${b.id}`,
      name: b.name,
      category: b.category,
      freshness: 'fresh',
      daysRemaining: 7,
      quantity: b.quantity,
      unit: b.unit,
      locationInFridge: 'Middle Shelf',
      addedAt: new Date().toISOString(),
    }));

    setInventory((prev) => [...newFoodItems, ...prev]);
    setShoppingList((prev) => prev.filter((i) => !i.isBought));
  };

  // Shopping List Actions
  const handleToggleShoppingBought = (id: string) => {
    setShoppingList((prev) =>
      prev.map((i) => (i.id === id ? { ...i, isBought: !i.isBought } : i))
    );
  };

  const handleAddShoppingItem = (item: ShoppingItem) => {
    setShoppingList((prev) => [item, ...prev]);
  };

  const handleRemoveShoppingItem = (id: string) => {
    setShoppingList((prev) => prev.filter((i) => i.id !== id));
  };

  // AI Shopping List Generation
  const handleGenerateSmartList = async () => {
    setIsGeneratingList(true);
    try {
      const res = await fetch('/api/generate-shopping-list', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          inventory,
          missingItems: ['Fresh Herbs', 'Olive Oil', 'Butter', 'Garlic', 'Penne Pasta'],
          language: settings.language,
        }),
      });
      const data = await res.json();
      if (data.success && data.items?.length) {
        setShoppingList(data.items);
      }
    } catch (err) {
      console.error('Error generating smart list:', err);
    } finally {
      setIsGeneratingList(false);
    }
  };

  // Settings & Reset
  const handleUpdateSettings = (newSettings: Partial<AppSettings>) => {
    setSettings((prev) => {
      const oldCurrency = prev.currency || 'DH';
      const newCurrency = newSettings.currency;

      if (newCurrency && newCurrency !== oldCurrency) {
        // Convert user budget
        const convertedBudget = Number(
          convertCurrency(prev.userBudget, oldCurrency, newCurrency).toFixed(2)
        );

        // Convert shopping list item prices
        setShoppingList((prevList) =>
          prevList.map((item) => ({
            ...item,
            estimatedPrice: Number(
              convertCurrency(item.estimatedPrice, oldCurrency, newCurrency).toFixed(2)
            ),
          }))
        );

        // Convert recipe missing cost estimates
        setRecipes((prevRecipes) =>
          prevRecipes.map((r) => ({
            ...r,
            missingCostEstimate: Number(
              convertCurrency(r.missingCostEstimate, oldCurrency, newCurrency).toFixed(2)
            ),
          }))
        );

        return {
          ...prev,
          ...newSettings,
          userBudget: convertedBudget,
        };
      }

      return { ...prev, ...newSettings };
    });
  };

  const handleResetData = () => {
    if (confirm('Reset ColdScan demo data to default clean state?')) {
      setInventory(INITIAL_INVENTORY);
      setRecipes(DEFAULT_RECIPES);
      setShoppingList(DEFAULT_SHOPPING_LIST);
      setSettings(DEFAULT_SETTINGS);
      localStorage.clear();
    }
  };

  return (
    <div className="min-h-screen bg-slate-100/70 text-slate-900 flex flex-col font-sans antialiased">
      {/* Header */}
      <Header
        activeTab={activeTab}
        expiringCount={expiringCount}
        language={settings.language}
        onOpenLiveVoice={() => setIsLiveVoiceOpen(true)}
        onNavigate={(tab) => setActiveTab(tab)}
        onSelectLanguage={(lang) => setSettings((prev) => ({ ...prev, language: lang }))}
      />

      {/* Main Content Viewport */}
      <main className="flex-1 px-3 py-4 max-w-md md:max-w-2xl lg:max-w-4xl mx-auto w-full pb-24">
        {activeTab === 'home' && (
          <HomeScreen
            inventory={inventory}
            recipes={recipes}
            settings={settings}
            onUpdateSettings={(newSettings) => setSettings((prev) => ({ ...prev, ...newSettings }))}
            onNavigate={(tab) => setActiveTab(tab)}
            onOpenLiveVoice={() => setIsLiveVoiceOpen(true)}
            onQuickScan={() => setActiveTab('scan')}
          />
        )}

        {activeTab === 'scan' && (
          <ScanScreen
            settings={settings}
            onAddItemsToInventory={handleAddItemsFromScan}
            onNavigateToInventory={() => setActiveTab('inventory')}
          />
        )}

        {activeTab === 'inventory' && (
          <InventoryScreen
            inventory={inventory}
            settings={settings}
            onSaveItem={handleSaveInventoryItem}
            onDeleteItem={handleDeleteInventoryItem}
            onNavigateToRecipes={(filterIngredient) => {
              setActiveTab('recipes');
            }}
          />
        )}

        {activeTab === 'recipes' && (
          <RecipesScreen
            recipes={recipes}
            inventory={inventory}
            onAddMissingToShoppingList={handleAddMissingToShoppingList}
            onRefreshRecipes={handleRefreshRecipes}
            isGenerating={isGeneratingRecipes}
          />
        )}

        {activeTab === 'shopping' && (
          <ShoppingListScreen
            shoppingList={shoppingList}
            settings={settings}
            onToggleBought={handleToggleShoppingBought}
            onAddItem={handleAddShoppingItem}
            onRemoveItem={handleRemoveShoppingItem}
            onMoveBoughtToInventory={handleMoveBoughtToInventory}
            onGenerateSmartList={handleGenerateSmartList}
            isGeneratingList={isGeneratingList}
          />
        )}

        {activeTab === 'cost' && (
          <CostEstimateScreen
            shoppingList={shoppingList}
            inventory={inventory}
            settings={settings}
          />
        )}

        {activeTab === 'settings' && (
          <SettingsScreen
            settings={settings}
            onUpdateSettings={handleUpdateSettings}
            onResetData={handleResetData}
          />
        )}
      </main>

      {/* Gemini Live Voice Overlay Modal */}
      <LiveVoiceModal
        isOpen={isLiveVoiceOpen}
        onClose={() => setIsLiveVoiceOpen(false)}
        inventory={inventory}
        settings={settings}
        onUpdateSettings={handleUpdateSettings}
        onNavigateToRecipes={() => {
          setIsLiveVoiceOpen(false);
          setActiveTab('recipes');
        }}
        onNavigateToShopping={() => {
          setIsLiveVoiceOpen(false);
          setActiveTab('shopping');
        }}
      />

      {/* Mobile Bottom Navigation */}
      <Navigation
        activeTab={activeTab}
        onNavigate={(tab) => setActiveTab(tab)}
        expiringCount={expiringCount}
        shoppingCount={shoppingCount}
        language={settings.language}
      />
    </div>
  );
}
