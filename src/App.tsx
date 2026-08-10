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
import { AssistantChatModal } from './components/AssistantChatModal';
import { WelcomeTutorial } from './components/WelcomeTutorial';
import { TrialExpiredScreen } from './components/TrialExpiredScreen';
import { TrialBanner } from './components/TrialBanner';

import { HomeScreen } from './components/screens/HomeScreen';
import { ScanScreen } from './components/screens/ScanScreen';
import { InventoryScreen } from './components/screens/InventoryScreen';
import { RecipesScreen } from './components/screens/RecipesScreen';
import { ShoppingListScreen } from './components/screens/ShoppingListScreen';
import { NearbyStoresScreen } from './components/screens/NearbyStoresScreen';
import { CostEstimateScreen } from './components/screens/CostEstimateScreen';
import { SettingsScreen } from './components/screens/SettingsScreen';

import { convertCurrency } from './utils/currency';
import { t } from './utils/i18n';
import {
  loadTrialState,
  saveTrialState,
  isAccessLocked,
  trialDaysLeft,
  redeemAccessCode,
  TrialState,
} from './utils/trial';

export default function App() {
  const [activeTab, setActiveTab] = useState<TabType>('home');
  const [isLiveVoiceOpen, setIsLiveVoiceOpen] = useState(false);
  const [isAssistantOpen, setIsAssistantOpen] = useState(false);

  // Free-trial / access state (starts the clock on the very first open)
  const [trial, setTrial] = useState<TrialState>(() => loadTrialState());
  const [showTutorial, setShowTutorial] = useState(() => !trial.tutorialSeen);
  const [accessNotice, setAccessNotice] = useState<string | null>(null);

  // Persistent State
  const [inventory, setInventory] = useState<FoodItem[]>(() => {
    const saved = localStorage.getItem('coldscan_inventory');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length === 0) return INITIAL_INVENTORY;
        return parsed;
      } catch {
        return INITIAL_INVENTORY;
      }
    }
    return INITIAL_INVENTORY;
  });

  const [recipes, setRecipes] = useState<Recipe[]>(() => {
    const saved = localStorage.getItem('coldscan_recipes');
    return saved ? JSON.parse(saved) : DEFAULT_RECIPES;
  });

  const [shoppingList, setShoppingList] = useState<ShoppingItem[]>(() => {
    const saved = localStorage.getItem('coldscan_shopping');
    return saved ? JSON.parse(saved) : DEFAULT_SHOPPING_LIST;
  });

  const [settings, setSettings] = useState<AppSettings>(() => {
    const saved = localStorage.getItem('coldscan_settings');
    return saved ? JSON.parse(saved) : DEFAULT_SETTINGS;
  });

  const [isGeneratingRecipes, setIsGeneratingRecipes] = useState(false);
  const [isGeneratingList, setIsGeneratingList] = useState(false);

  // Keep the document language and direction in sync as well. This affects native
  // controls, accessibility tools, and right-to-left Arabic/Darija layouts.
  useEffect(() => {
    const language = settings.language || 'en';
    document.documentElement.lang = language;
    document.documentElement.dir = language === 'ar' || language === 'ar-MA' ? 'rtl' : 'ltr';
  }, [settings.language]);

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

  useEffect(() => {
    saveTrialState(trial);
  }, [trial]);

  // Derived counts
  const expiringCount = inventory.filter((i) => i.freshness === 'soon_to_expire').length;
  const shoppingCount = shoppingList.filter((i) => !i.isBought).length;

  // Trial / access gate. The landing page ('home') always stays open so people
  // can still read about ColdScan and reach the contact links; the product tabs
  // are what lock.
  const daysLeft = trialDaysLeft(trial);
  const accessLocked = isAccessLocked(trial);
  const showLockScreen = accessLocked && activeTab !== 'home';
  const lang = settings.language || 'en';

  const handleFinishTutorial = () => {
    setShowTutorial(false);
    setTrial((prev) => ({ ...prev, tutorialSeen: true }));
  };

  const handleRedeemCode = (code: string): boolean => {
    const result = redeemAccessCode(code, trial);
    if (!result.ok) return false;

    setTrial(result.state);
    setAccessNotice(
      result.granted === 'unlock'
        ? t('trialCodeUnlocked', lang)
        : t('trialCodeExtended', lang).replace('__count__', String(result.days ?? 0))
    );
    return true;
  };

  // Auto-dismiss the unlock confirmation
  useEffect(() => {
    if (!accessNotice) return;
    const timer = setTimeout(() => setAccessNotice(null), 4000);
    return () => clearTimeout(timer);
  }, [accessNotice]);

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

  // Recipe generation
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
      console.error('Error generating recipes:', err);
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

  // Shopping list generation
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
      // Clear demo data but keep the trial/access state — resetting the demo
      // must not silently hand out a brand new free trial.
      localStorage.clear();
      saveTrialState(trial);
    }
  };

  /** Opens an AI feature, or the contact screen when the trial is over. */
  const openGated = (open: () => void) => {
    if (accessLocked) {
      setActiveTab('settings');
      return;
    }
    open();
  };

  return (
    <div className="min-h-screen min-h-[100dvh] w-full overflow-x-hidden bg-white text-ink flex flex-col font-sans antialiased">
      {/* Header */}
      <Header
        activeTab={activeTab}
        expiringCount={expiringCount}
        language={settings.language}
        onOpenLiveVoice={() => openGated(() => setIsLiveVoiceOpen(true))}
        onOpenAssistant={() => openGated(() => setIsAssistantOpen(true))}
        onNavigate={(tab) => setActiveTab(tab)}
        onSelectLanguage={(lang) => setSettings((prev) => ({ ...prev, language: lang }))}
      />

      {/* Main Content Viewport */}
      <main
        className={`flex-1 w-full mx-auto overflow-x-hidden ${
          activeTab === 'home'
            ? ''
            : 'max-w-6xl px-3 sm:px-4 py-4 pb-[calc(6rem+env(safe-area-inset-bottom))] bg-[#F4F8F5]'
        }`}
      >
        {/* Trial status strip (app screens only — the landing page has its own CTAs) */}
        {activeTab !== 'home' && !showLockScreen && (
          <TrialBanner
            daysLeft={daysLeft}
            unlocked={trial.unlocked}
            lang={lang}
            onContact={() => setActiveTab('settings')}
          />
        )}

        {/* Trial over: the product tabs are replaced by the contact screen */}
        {showLockScreen && (
          <TrialExpiredScreen
            lang={lang}
            onRedeemCode={handleRedeemCode}
            onBackHome={() => setActiveTab('home')}
          />
        )}

        {activeTab === 'home' && (
          <HomeScreen
            inventory={inventory}
            recipes={recipes}
            shoppingList={shoppingList}
            settings={settings}
            onUpdateSettings={(newSettings) => setSettings((prev) => ({ ...prev, ...newSettings }))}
            onNavigate={(tab) => setActiveTab(tab)}
            onOpenLiveVoice={() => openGated(() => setIsLiveVoiceOpen(true))}
            onOpenAssistant={() => openGated(() => setIsAssistantOpen(true))}
            onQuickScan={() => setActiveTab('scan')}
          />
        )}

        {activeTab === 'scan' && !showLockScreen && (
          <ScanScreen
            settings={settings}
            onAddItemsToInventory={handleAddItemsFromScan}
            onNavigateToInventory={() => setActiveTab('inventory')}
          />
        )}

        {activeTab === 'inventory' && !showLockScreen && (
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

        {activeTab === 'recipes' && !showLockScreen && (
          <RecipesScreen
            recipes={recipes}
            inventory={inventory}
            settings={settings}
            onAddMissingToShoppingList={handleAddMissingToShoppingList}
            onRefreshRecipes={handleRefreshRecipes}
            isGenerating={isGeneratingRecipes}
          />
        )}

        {activeTab === 'shopping' && !showLockScreen && (
          <ShoppingListScreen
            shoppingList={shoppingList}
            settings={settings}
            onToggleBought={handleToggleShoppingBought}
            onAddItem={handleAddShoppingItem}
            onRemoveItem={handleRemoveShoppingItem}
            onMoveBoughtToInventory={handleMoveBoughtToInventory}
            onGenerateSmartList={handleGenerateSmartList}
            onNavigateToStores={() => setActiveTab('stores')}
            isGeneratingList={isGeneratingList}
          />
        )}

        {activeTab === 'stores' && !showLockScreen && (
          <NearbyStoresScreen
            shoppingList={shoppingList}
            inventory={inventory}
            recipes={recipes}
            language={settings.language}
            currency={settings.currency}
          />
        )}

        {activeTab === 'cost' && !showLockScreen && (
          <CostEstimateScreen
            shoppingList={shoppingList}
            inventory={inventory}
            settings={settings}
          />
        )}

        {activeTab === 'settings' && !showLockScreen && (
          <SettingsScreen
            settings={settings}
            onUpdateSettings={handleUpdateSettings}
            onResetData={handleResetData}
            trialDaysLeft={daysLeft}
            trialUnlocked={trial.unlocked}
            onReplayTutorial={() => setShowTutorial(true)}
          />
        )}
      </main>

      {/* First-open tutorial */}
      <WelcomeTutorial isOpen={showTutorial} lang={lang} onFinish={handleFinishTutorial} />

      {/* Access code confirmation */}
      {accessNotice && (
        <div className="fixed left-1/2 top-20 z-[80] -translate-x-1/2 rounded-full bg-pine px-5 py-3 text-sm font-bold text-cold shadow-[0_20px_50px_-18px_rgba(11,61,46,0.8)]">
          {accessNotice}
        </div>
      )}

      {/* Live Voice Overlay Modal */}
      <LiveVoiceModal
        isOpen={isLiveVoiceOpen && !accessLocked}
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

      {/* Text AI Assistant Modal */}
      <AssistantChatModal
        isOpen={isAssistantOpen && !accessLocked}
        onClose={() => setIsAssistantOpen(false)}
        inventory={inventory}
        settings={settings}
      />

      {/* Mobile Bottom Navigation (app screens only — the landing page uses the navbar + hamburger) */}
      <Navigation
        activeTab={activeTab}
        onNavigate={(tab) => setActiveTab(tab)}
        expiringCount={expiringCount}
        shoppingCount={shoppingCount}
        language={settings.language}
        visible={activeTab !== 'home'}
      />
    </div>
  );
}
