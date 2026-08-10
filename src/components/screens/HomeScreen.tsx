import React from 'react';
import { FoodItem, Recipe, ShoppingItem, TabType, AppSettings, LanguageType } from '../../types';
import { Hero } from '../landing/Hero';
import { HowItWorks } from '../landing/HowItWorks';
import { RecipeShowcase } from '../landing/RecipeShowcase';
import { ShoppingShowcase } from '../landing/ShoppingShowcase';
import { WasteStory } from '../landing/WasteStory';
import { UseSoonSection } from '../landing/UseSoonSection';
import { AIExperience } from '../landing/AIExperience';
import { ComingSoonSection } from '../landing/ComingSoonSection';
import { FinalCTA } from '../landing/FinalCTA';
import { Footer } from '../landing/Footer';

interface HomeScreenProps {
  inventory: FoodItem[];
  recipes: Recipe[];
  shoppingList?: ShoppingItem[];
  settings?: AppSettings;
  onUpdateSettings?: (settings: Partial<AppSettings>) => void;
  onNavigate: (tab: TabType) => void;
  onOpenLiveVoice: () => void;
  onOpenAssistant?: () => void;
  onQuickScan: () => void;
}

/**
 * Home = the ColdScan marketing landing page.
 * Every showcase section is driven by real app state (inventory, recipes,
 * shopping list, settings) — no fake demos.
 */
export const HomeScreen: React.FC<HomeScreenProps> = ({
  inventory,
  recipes,
  shoppingList = [],
  settings,
  onUpdateSettings,
  onNavigate,
  onOpenLiveVoice,
  onOpenAssistant,
  onQuickScan,
}) => {
  const lang = (settings?.language || 'en') as LanguageType;
  const currency = settings?.currency || 'DH';
  const expiringCount = inventory.filter((i) => i.freshness === 'soon_to_expire').length;

  return (
    <div className="min-h-screen w-full overflow-x-hidden bg-white">
      <Hero
        onNavigate={onNavigate}
        itemsDetected={inventory.length}
        expiringCount={expiringCount}
        recipeCount={recipes.length}
      />

      <HowItWorks />

      <RecipeShowcase recipes={recipes} lang={lang} onNavigate={onNavigate} />

      <ShoppingShowcase
        shoppingList={shoppingList}
        currency={currency}
        lang={lang}
        onNavigate={onNavigate}
      />

      <WasteStory />

      <UseSoonSection inventory={inventory} lang={lang} onNavigate={onNavigate} />

      <AIExperience
        inventory={inventory}
        recipes={recipes}
        lang={lang}
        onOpenAssistant={() => {
          if (onOpenAssistant) {
            onOpenAssistant();
          } else {
            onQuickScan();
          }
        }}
        onOpenLiveVoice={onOpenLiveVoice}
      />

      <ComingSoonSection onNavigate={onNavigate} />

      <FinalCTA onNavigate={onNavigate} />

      <Footer lang={lang} onNavigate={onNavigate} onUpdateSettings={onUpdateSettings} />
    </div>
  );
};
