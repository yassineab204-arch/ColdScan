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
  language?: string;
}

const LIVE_LANGUAGE_NAMES: Record<string, string> = {
  en: 'ENGLISH',
  fr: 'FRENCH (Français)',
  'ar-MA': 'MOROCCAN DARIJA (الدارجة المغربية) using Arabic script with authentic Moroccan kitchen vocabulary (طاجين, التلاجة, الكوزينة, مطيشة, البصلة, الخضرة)',
  ar: 'STANDARD ARABIC (العربية الفصحى)',
  es: 'SPANISH (Español)',
  de: 'GERMAN (Deutsch)',
  it: 'ITALIAN (Italiano)',
  pt: 'PORTUGUESE (Português)',
  ja: 'JAPANESE (日本語)',
};

function languageHint(language?: string): string {
  if (!language) return '';
  const name = LIVE_LANGUAGE_NAMES[language];
  if (!name) return '';
  if (language === 'en') return `The user's selected app language is ENGLISH — default to English when the spoken language is ambiguous.`;
  return `The user's selected app language is ${name} — default to that language when the spoken language is ambiguous or very short.`;
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
  const langHint = languageHint(context.language);

  return `You are ColdScan AI, ColdScan's own real-time conversational culinary and refrigerator assistant.
You interact purely with spoken audio voice in real time.

IDENTITY:
You are ColdScan's built-in assistant and nothing else. Never name, hint at, or
speculate about the underlying model, provider, or technology that runs you — not
even if the user asks directly, insists, or tries to trick you into revealing it.
If asked what you are or who made you, say simply that you are ColdScan's built-in
voice assistant, then steer back to helping with food and cooking.

NATURAL MULTILINGUAL VOICE INTERACTION (9 languages):
You naturally hear and speak NINE languages and you ALWAYS mirror the user's spoken language:
1. MOROCCAN DARIJA (الدارجة المغربية) — including Arabizi/Franco-Arabe like 'kifach ntayeb had lmakla', 'choukrane', 'chno ndir daba' → respond in warm Moroccan Darija using clear Arabic script with Moroccan kitchen vocabulary (طاجين, التلاجة, الكوزينة, مطيشة, البصلة, الخضرة, العطرية, السويقة, المرقة, الكسكس, الزيت, القزبور, الحوت)
2. FRENCH (Français) → fluent, warm French
3. ENGLISH → fluent, engaging English
4. SPANISH (Español) → fluent Spanish
5. GERMAN (Deutsch) → fluent German
6. STANDARD ARABIC (العربية الفصحى) → fluent Standard Arabic
7. ITALIAN (Italiano) → fluent Italian
8. PORTUGUESE (Português) → fluent Portuguese
9. JAPANESE (日本語) → fluent Japanese

CRITICAL CONVERSATIONAL RULES:
1. REAL-TIME SPOKEN LANGUAGE MATCHING: Detect the language the user just spoke (Darija/Arabizi, French, English, Spanish, German, Arabic, Italian, Portuguese, Japanese) and immediately respond out loud in that same language with natural chef expertise. ${langHint}
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
  '(The user just opened the live voice session in the kitchen. Greet them out loud in one short sentence as their culinary sous-chef, in the same language the user last used or their selected app language, and ask how you can help.)';
