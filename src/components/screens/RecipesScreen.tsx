import React, { useState } from 'react';
import { 
  Utensils, 
  Sparkles, 
  Clock, 
  CheckCircle2, 
  ShoppingBag, 
  RefreshCw, 
  ChevronRight, 
  X, 
  DollarSign,
  AlertTriangle,
  Flame,
  ChefHat,
  Mic,
  Volume2
} from 'lucide-react';
import { Recipe, FoodItem, ShoppingItem, AppSettings, LanguageType } from '../../types';
import { CookingWizardModal } from '../CookingWizardModal';
import { LiveVoiceModal } from '../LiveVoiceModal';
import { t, getLocalizedRecipeName, getLocalizedRecipeDescription, getLocalizedRecipeInstructions, getLocalizedFoodItemName } from '../../utils/i18n';

interface RecipesScreenProps {
  recipes: Recipe[];
  inventory: FoodItem[];
  settings?: AppSettings;
  onAddMissingToShoppingList: (items: string[], recipeName: string) => void;
  onRefreshRecipes: () => void;
  isGenerating: boolean;
}

export const RecipesScreen: React.FC<RecipesScreenProps> = ({
  recipes,
  inventory,
  settings,
  onAddMissingToShoppingList,
  onRefreshRecipes,
  isGenerating,
}) => {
  const lang = (settings?.language || 'en') as LanguageType;
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);
  const [cookingRecipe, setCookingRecipe] = useState<Recipe | null>(null);
  const [voiceBotRecipe, setVoiceBotRecipe] = useState<Recipe | null>(null);
  const [isVoiceBotOpen, setIsVoiceBotOpen] = useState(false);
  const [activeFilter, setActiveFilter] = useState<'all' | 'waste_reducer' | 'quick'>('all');
  const [addedRecipeIds, setAddedRecipeIds] = useState<string[]>([]);

  const filteredRecipes = recipes.filter((r) => {
    if (activeFilter === 'waste_reducer') return r.usesExpiringItems;
    if (activeFilter === 'quick') return r.cookTimeMinutes <= 15;
    return true;
  });

  const handleAddMissing = (recipe: Recipe) => {
    onAddMissingToShoppingList(recipe.ingredientsMissing, recipe.name);
    setAddedRecipeIds((prev) => [...prev, recipe.id]);
  };

  const handleOpenVoiceBot = (recipe?: Recipe) => {
    if (recipe) {
      setVoiceBotRecipe(recipe);
    } else {
      setVoiceBotRecipe(null);
    }
    setIsVoiceBotOpen(true);
  };

  return (
    <div className="space-y-4 pb-20 max-w-md mx-auto">
      
      {/* Header Banner */}
      <div className="bg-white border border-slate-200 rounded-3xl p-4 sm:p-5 shadow-xs flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h2 className="text-2xl sm:text-3xl font-black tracking-tighter leading-none text-slate-900">
            {t('recipesTitle', lang)}
          </h2>
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mt-1">
            {t('recipesSubtitle', lang)}
          </p>
        </div>

        <button
          onClick={onRefreshRecipes}
          disabled={isGenerating}
          className="w-full sm:w-auto justify-center px-4 py-3 rounded-2xl bg-pine text-cold font-black text-xs uppercase tracking-widest flex items-center gap-1.5 hover:bg-pine-light hover:scale-105 active:scale-95 transition-all duration-200 shadow-xs disabled:opacity-50"
          title="Generate fresh recipes"
        >
          <RefreshCw className={`w-4 h-4 text-cold ${isGenerating ? 'animate-spin' : ''}`} />
          <span>{isGenerating ? t('thinkingRecipes', lang) : t('refreshRecipes', lang)}</span>
        </button>
      </div>

      {/* Voice Bot Quick Launcher Banner */}
      <div className="bg-gradient-to-r from-pine-deep via-pine to-pine text-white rounded-3xl p-4 sm:p-5 border border-cold/25 shadow-md relative overflow-hidden">
        <div className="absolute right-0 top-0 translate-x-4 -translate-y-4 w-32 h-32 bg-cold/15 rounded-full blur-2xl pointer-events-none" />
        
        <div className="flex items-start justify-between gap-3 relative z-10">
          <div className="space-y-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full bg-cold/15 text-cold font-mono text-[9px] font-black uppercase tracking-wider border border-cold/30 flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-cold" />
                {t('voiceGuide', lang)}
              </span>
            </div>
            <h3 className="text-lg font-black text-white leading-tight">
              {t('voiceGuide', lang)}
            </h3>
            <p className="text-xs text-slate-300 font-medium leading-snug max-w-[280px]">
              {t('voiceGuideDescription', lang)}
            </p>
          </div>

          <button
            onClick={() => handleOpenVoiceBot()}
            className="shrink-0 p-3.5 rounded-2xl bg-cold text-pine-deep hover:bg-cold/90 hover:scale-105 active:scale-95 transition-all duration-200 font-black shadow-lg shadow-cold/30 flex flex-col items-center gap-1"
            title="Launch Voice Bot"
          >
            <Mic className="w-5 h-5 text-pine-deep" />
            <span className="text-[9px] uppercase tracking-widest font-black">{t('talk', lang)}</span>
          </button>
        </div>

        {/* Quick Spoken Prompts */}
        <div className="mt-3 pt-3 border-t border-white/10 flex items-center gap-1.5 overflow-x-auto scrollbar-none">
          {[
            t('assistantQuickQuickMeal', lang),
            t('stepsBtn', lang),
            t('missingIngredients', lang),
          ].map((prompt, pIdx) => (
            <button
              key={pIdx}
              onClick={() => handleOpenVoiceBot()}
              className="px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-cold-soft text-[10px] font-bold whitespace-nowrap transition-colors flex items-center gap-1"
            >
              <Volume2 className="w-3 h-3 text-cold" />
              <span>{prompt}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2 overflow-x-auto scrollbar-none pb-1">
        {[
          { id: 'all', label: `${t('allRecipes', lang)} (${recipes.length})` },
          { id: 'waste_reducer', label: t('wasteReducer', lang) },
          { id: 'quick', label: t('quickMeals', lang) },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveFilter(tab.id as any)}
            className={`px-3.5 py-1.5 rounded-xl text-[10px] font-black tracking-widest whitespace-nowrap transition-all duration-200 hover:scale-105 active:scale-95 border ${
              activeFilter === tab.id
                ? 'bg-cold text-pine-deep border-cold shadow-xs'
                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Recipe Cards List */}
      <div className="space-y-4">
        {filteredRecipes.map((recipe, idx) => {
          const isAdded = addedRecipeIds.includes(recipe.id);
          const numStr = (idx + 1).toString().padStart(2, '0');

          return (
            <div
              key={recipe.id}
              className="bg-white border border-slate-200 hover:border-cold rounded-3xl p-5 transition-all shadow-xs space-y-3"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {recipe.usesExpiringItems && (
                      <span className="px-2.5 py-0.5 rounded-md bg-amber-100 text-amber-900 font-black text-[9px] uppercase tracking-widest border border-amber-200">
                        {t('wasteReducer', lang)}
                      </span>
                    )}
                    {recipe.tags?.map((tTag, idxTag) => (
                      <span key={idxTag} className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-black text-[9px] uppercase tracking-wider">
                        {tTag}
                      </span>
                    ))}
                  </div>

                  <h3 className="font-serif italic text-2xl font-bold text-slate-900 mt-2">
                    {getLocalizedRecipeName(recipe.name, lang)}
                  </h3>
                  <p className="text-xs text-slate-600 line-clamp-2 mt-1">
                    {getLocalizedRecipeDescription(recipe, lang)}
                  </p>
                </div>
                <span className="text-xl font-black text-slate-300 font-mono">{numStr}</span>
              </div>

              {/* Cooking Stats Pills */}
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] font-black uppercase tracking-widest text-slate-500 bg-slate-50 p-3 rounded-2xl border border-slate-100">
                <div className="flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-cold-dark" />
                  <span>{recipe.cookTimeMinutes} MINS</span>
                </div>
                <div>•</div>
                <div className="flex items-center gap-1">
                  <Flame className="w-3.5 h-3.5 text-amber-600" />
                  <span>{recipe.calories} KCAL</span>
                </div>
                <div>•</div>
                <div className="uppercase">{recipe.difficulty}</div>
              </div>

              {/* Ingredients Overview */}
              <div className="space-y-1.5">
                <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                  {t('hasIngredients', lang)}:
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {recipe.ingredientsHas.map((ing, idx) => (
                    <span
                      key={idx}
                      className="px-2.5 py-1 bg-mint text-pine border border-cold/25 rounded-xl text-[10px] font-black uppercase tracking-tight flex items-center gap-1"
                    >
                      <CheckCircle2 className="w-3 h-3 text-cold-dark shrink-0" />
                      {getLocalizedFoodItemName(ing, lang)}
                    </span>
                  ))}
                  {recipe.ingredientsMissing.map((ing, idx) => (
                    <span
                      key={idx}
                      className="px-2.5 py-1 bg-slate-100 text-slate-700 border border-slate-200 rounded-xl text-[10px] font-bold uppercase tracking-tight flex items-center gap-1"
                    >
                      <ShoppingBag className="w-3 h-3 text-slate-400 shrink-0" />
                      {getLocalizedFoodItemName(ing, lang)}
                    </span>
                  ))}
                </div>
              </div>

              {/* Action Bar */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-1.5 flex-wrap sm:flex-nowrap">
                <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                  Est: <span className="font-extrabold text-slate-900">${recipe.missingCostEstimate.toFixed(2)}</span>
                </div>

                <div className="flex items-center gap-1.5 flex-wrap sm:flex-nowrap justify-end">
                  {recipe.ingredientsMissing.length > 0 && (
                    <button
                      onClick={() => handleAddMissing(recipe)}
                      disabled={isAdded}
                      className={`px-2.5 py-2 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all duration-200 flex items-center gap-1 ${
                        isAdded
                          ? 'bg-slate-100 text-slate-400 cursor-default'
                          : 'bg-mint text-pine border border-cold/25 hover:bg-mint-deep hover:scale-105 active:scale-95'
                      }`}
                    >
                      <ShoppingBag className="w-3 h-3" />
                      {isAdded ? t('addedToCart', lang) : t('addMissingToCart', lang)}
                    </button>
                  )}

                  {/* Voice Bot Guide Button */}
                  <button
                    onClick={() => handleOpenVoiceBot(recipe)}
                    className="px-2.5 py-2 rounded-xl bg-pine hover:bg-pine-light text-cold font-black text-[10px] uppercase tracking-widest hover:scale-105 active:scale-95 transition-all duration-200 flex items-center gap-1 border border-cold/25"
                    title="Voice Guide for this recipe"
                  >
                    <Mic className="w-3 h-3 text-cold" />
                    <span>Voice</span>
                  </button>

                  {/* Cook Mode Button */}
                  <button
                    onClick={() => setCookingRecipe(recipe)}
                    className="px-2.5 py-2 rounded-xl bg-cold text-pine-deep font-black text-[10px] uppercase tracking-widest hover:bg-cold-dark hover:text-white hover:scale-105 active:scale-95 transition-all duration-200 flex items-center gap-1 shadow-xs"
                  >
                    <ChefHat className="w-3 h-3" />
                    {t('cookModeBtn', lang)}
                  </button>

                  {/* Steps Button */}
                  <button
                    onClick={() => setSelectedRecipe(recipe)}
                    className="px-2.5 py-2 rounded-xl bg-slate-100 text-slate-700 hover:bg-slate-200 font-black text-[10px] uppercase tracking-widest hover:scale-105 active:scale-95 transition-all duration-200 flex items-center gap-1"
                  >
                    {t('stepsBtn', lang)}
                    <ChevronRight className="w-3 h-3 text-slate-400" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Live Voice Modal */}
      <LiveVoiceModal
        isOpen={isVoiceBotOpen}
        onClose={() => setIsVoiceBotOpen(false)}
        inventory={inventory}
        activeRecipe={voiceBotRecipe}
        settings={settings}
      />

      {/* Cooking Mode Wizard Modal */}
      {cookingRecipe && (
        <CookingWizardModal
          recipe={cookingRecipe}
          language={settings?.language}
          inventory={inventory}
          settings={settings}
          onClose={() => setCookingRecipe(null)}
          onOpenVoiceBot={(r) => {
            setCookingRecipe(null);
            handleOpenVoiceBot(r);
          }}
        />
      )}

      {/* Recipe Instructions Overview Modal */}
      {selectedRecipe && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-md rounded-3xl shadow-xl overflow-hidden flex flex-col max-h-[85vh]">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-mint/60">
              <div>
                <span className="text-[10px] font-bold text-pine uppercase tracking-wider">
                  Cooking Guide
                </span>
                <h3 className="font-bold text-slate-800 text-base leading-tight">
                  {getLocalizedRecipeName(selectedRecipe.name, lang)}
                </h3>
              </div>
              <button
                onClick={() => setSelectedRecipe(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-200/60"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-4 text-xs text-slate-700">
              <div>
                <h4 className="font-bold text-slate-800 text-sm mb-1.5">Instructions</h4>
                <ol className="space-y-2 list-decimal list-inside leading-relaxed text-slate-600">
                  {getLocalizedRecipeInstructions(selectedRecipe, lang).map((step, idx) => (
                    <li key={idx} className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                      {step}
                    </li>
                  ))}
                </ol>
              </div>

              <div className="pt-2 flex flex-col-reverse sm:flex-row sm:justify-between sm:items-center gap-2 border-t border-slate-100">
                <button
                  onClick={() => {
                    const r = selectedRecipe;
                    setSelectedRecipe(null);
                    setCookingRecipe(r);
                  }}
                  className="w-full sm:w-auto justify-center px-4 py-2 rounded-xl bg-pine text-cold font-black text-xs uppercase tracking-widest inline-flex items-center gap-1.5"
                >
                  <ChefHat className="w-4 h-4" />
                  Start Interactive Cook Mode
                </button>
                <button
                  onClick={() => setSelectedRecipe(null)}
                  className="w-full sm:w-auto px-4 py-2 rounded-xl bg-slate-100 text-slate-700 font-bold text-xs hover:bg-slate-200"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
