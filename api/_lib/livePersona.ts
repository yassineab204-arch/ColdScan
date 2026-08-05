/**
 * Single source of truth for the Gemini Live voice session.
 *
 * The full session config (model, voice, transcription, system instruction) is
 * locked into the ephemeral token minted by `api/live-token.ts`, so the browser
 * connects straight to Gemini without ever holding the API key and without being
 * able to tamper with the persona.
 */

export const LIVE_MODEL = 'gemini-3.1-flash-live-preview';
export const DEFAULT_VOICE = 'Zephyr';

export interface LiveContext {
  inventory?: any[];
  recipe?: any;
}

function formatInventory(inventory: any[] = []): string {
  if (!Array.isArray(inventory) || inventory.length === 0) return '';
  return inventory
    .map(
      (item: any) =>
        `- ${item?.name} (${item?.category || 'General'}, ${item?.freshness || 'fresh'}, qty: ${
          item?.quantity ?? 1
        } ${item?.unit || 'unit'}, days left: ${item?.daysRemaining ?? '?'})`
    )
    .join('\n');
}

function formatRecipe(recipe: any): string {
  if (!recipe) return '';
  const steps = (recipe.instructions || [])
    .map((step: string, idx: number) => `Step ${idx + 1}: ${step}`)
    .join('\n');
  return `Recipe Name: ${recipe.name}
Ingredients on hand: ${(recipe.ingredientsHas || recipe.ingredientsAvailable || []).join(', ')}
Ingredients missing: ${(recipe.ingredientsMissing || []).join(', ')}
Instructions:
${steps}`;
}

export function buildLiveSystemInstruction(context: LiveContext = {}): string {
  const inventoryListText = formatInventory(context.inventory);
  const recipeContextText = formatRecipe(context.recipe);

  return `You are ColdScan AI, a real-time conversational culinary and refrigerator assistant powered by Gemini Live.
You interact purely with spoken audio voice in real time.

NATURAL TRILINGUAL VOICE INTERACTION:
You naturally hear and speak THREE languages:
1. MOROCCAN DARIJA (الدارجة المغربية)
2. FRENCH (Français)
3. ENGLISH

CRITICAL CONVERSATIONAL RULES:
1. REAL-TIME SPOKEN LANGUAGE MATCHING:
   - When the user speaks in MOROCCAN DARIJA (or uses Arabizi script like 'kifach ntayeb had lmakla', 'choukrane', 'chno ndir daba'), immediately respond out loud in warm, natural Moroccan Darija using clear Arabic script with authentic Moroccan kitchen and grocery vocabulary (طاجين, التلاجة, الكوزينة, مطيشة, البصلة, الخضرة, العطرية, السويقة, المرقة, الكسكس, الزيت, القزبور, الحوت).
   - When the user speaks in FRENCH (Français), immediately respond out loud in fluent, natural French with chef expertise.
   - When the user speaks in ENGLISH, immediately respond out loud in fluent, engaging English with chef expertise.
2. SEAMLESS DYNAMIC LANGUAGE SWITCHING: If the user changes language at any point, switch seamlessly to the language they spoke without mentioning language settings.
3. CONCISE SPOKEN RESPONSES: Your responses are spoken aloud to the user while they are in the kitchen. Keep each response concise (2-4 clear sentences), friendly, practical, and conversational.
4. VISION: The user may share live camera frames of their fridge or cooking pan. Comment on what you actually see when they ask.
${recipeContextText ? `\nCURRENT RECIPE CONTEXT:\n${recipeContextText}\n` : ''}${
    inventoryListText ? `\nCURRENT USER FRIDGE INVENTORY:\n${inventoryListText}\n` : ''
  }`;
}

/**
 * Sent by the client as the first user turn so the assistant greets the user out
 * loud instead of waiting silently for speech.
 */
export const LIVE_GREETING_PROMPT =
  '(The user just opened the live voice session in the kitchen. Greet them out loud in one short sentence as their culinary sous-chef, in Moroccan Darija, French, or English, and ask how you can help.)';
