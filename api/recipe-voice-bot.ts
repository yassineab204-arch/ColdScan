import { Type } from '@google/genai';
import { TEXT_MODEL, getGenAI } from './_lib/genai.js';
import { ApiRequest, ApiResponse, fail, methodGuard, readBody } from './_lib/http.js';

export default async function handler(req: ApiRequest, res: ApiResponse) {
  if (!methodGuard(req, res, 'POST')) return;

  try {
    const {
      message,
      activeRecipe = null,
      recipes = [],
      currentStep = 0,
      inventory = [],
      language = 'en',
    } = readBody(req);

    const inventorySummary = inventory
      .map((item: any) => `${item.name} (${item.freshness})`)
      .join(', ');

    const availableRecipesSummary = recipes
      .map((r: any, idx: number) => `${idx + 1}. ${r.name} (${r.cookTimeMinutes} mins, ${r.difficulty})`)
      .join('; ');

    let recipeContext =
      'No specific recipe currently active. The user is browsing recipes or asking for cooking ideas.';
    if (activeRecipe) {
      const instructionsList = (activeRecipe.instructions || [])
        .map((step: string, idx: number) => `Step ${idx + 1}: ${step}`)
        .join('\n');

      recipeContext = `Active Recipe: "${activeRecipe.name}"
Total Steps: ${(activeRecipe.instructions || []).length}
Current Step Index: ${currentStep + 1} of ${(activeRecipe.instructions || []).length}
Current Step Text: "${(activeRecipe.instructions || [])[currentStep] || 'Completed'}"
Ingredients on hand: ${(activeRecipe.ingredientsHas || []).join(', ')}
Ingredients missing: ${(activeRecipe.ingredientsMissing || []).join(', ')}
All Recipe Instructions:
${instructionsList}`;
    }

    const systemInstruction = `You are ColdScan's AI Sous-Chef Voice Guide.
You are helping the user in the kitchen through voice conversation while they cook or choose a recipe.

CRITICAL DYNAMIC LANGUAGE DETECTION & MULTILINGUAL SOUS-CHEF MANDATE:
1. Analyze the user's voice message: "${message}".
2. Detect if the user is speaking in:
   - ENGLISH -> Set detectedLanguage to "en". Reply in natural, encouraging spoken English.
   - FRENCH -> Set detectedLanguage to "fr". Reply in fluent, warm spoken French ("Chef, à l'étape suivante...", "Vous pouvez remplacer...").
   - MOROCCAN DARIJA -> Set detectedLanguage to "ar-MA". If the user speaks Moroccan Darija (الدارجة المغربية) — whether in Arabic alphabet (e.g. "شنو نطيب دابا", "زيدني خطوة", "دير ليا مينيتور ديال 5 دقايق", "باش نبدل الزبدة") OR Latin Arabizi/Franco-Arabe (e.g. "kifash ntayeb", "chno ndir daba", "chouf liya chi wsfa", "dir 5 d9ay9", "3tini step jaya") — reply in authentic, warm Moroccan Darija using clear Arabic script (e.g. "واخا الشاف، دابا غادين ندوزو للخطوة...").
   - SPANISH ("es"), GERMAN ("de"), ARABIC ("ar"), ITALIAN ("it"), PORTUGUESE ("pt"), JAPANESE ("ja") if detected.
   - If the user query is very short or ambiguous (e.g. "Next", "Repeat", "5 minutes"), default to the user's active session language: "${language}".

Current Context:
${recipeContext}

Available Fridge Items: [${inventorySummary || 'None listed'}]
Available Recipes in App: [${availableRecipesSummary || 'None listed'}]

Your Capabilities:
1. Guide step-by-step through the active recipe.
2. If the user asks for "next step" (ou "étape suivante" / "الخطوة الجاية"), "repeat step" ("répéter" / "عاود ليا"), "previous step" ("étape précédente" / "رجع للخطوة لي قبل"), or to jump to a specific step, acknowledge clearly and provide the step text.
3. If the user asks for ingredient substitutions (e.g. "I have no butter", "pas de beurre", "ما عنديش الزبدة"), give quick, practical kitchen substitutes based on typical pantry items or their fridge inventory.
4. If the user asks for a timer (e.g. "set a timer for 5 minutes", "minuteur 5 minutes", "دير ليا 5 دقايق"), calculate the total seconds and specify the action.
5. If the user asks culinary questions (e.g. "how do I know the chicken is cooked?", "comment savoir si c'est cuit?"), provide expert chef advice in 2-3 spoken sentences.
6. Keep answers concise, spoken-friendly (no asterisks, no bullet symbols in replyText, no complex markdown tables), encouraging, and clear because this is heard aloud in a busy kitchen.

Return a valid JSON object matching the schema.`;

    const ai = getGenAI();
    const response = await ai.models.generateContent({
      model: TEXT_MODEL,
      contents: `User voice query: "${message}"`,
      config: {
        systemInstruction,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            replyText: {
              type: Type.STRING,
              description:
                'The spoken response from the AI Sous-Chef to be read aloud to the user in the detected language.',
            },
            detectedLanguage: {
              type: Type.STRING,
              description:
                "The detected language code: 'en' for English, 'fr' for French, 'ar-MA' for Moroccan Darija, 'es', 'de', 'ar', etc.",
            },
            actionType: {
              type: Type.STRING,
              description:
                'One of: NEXT_STEP, PREV_STEP, REPEAT_STEP, GOTO_STEP, SET_TIMER, SELECT_RECIPE, NONE',
            },
            stepTarget: {
              type: Type.NUMBER,
              description:
                'The 0-based target step index if action is NEXT_STEP, PREV_STEP, GOTO_STEP, or REPEAT_STEP.',
            },
            timerSeconds: {
              type: Type.NUMBER,
              description: 'The duration in seconds if actionType is SET_TIMER, e.g. 300 for 5 minutes.',
            },
            timerLabel: {
              type: Type.STRING,
              description: "Short label for the timer, e.g. 'Simmering' or '5 Min Timer'.",
            },
            suggestedPrompts: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: '2-3 short voice prompt suggestions for the user in the detected language.',
            },
          },
          required: ['replyText', 'actionType', 'detectedLanguage'],
        },
      },
    });

    const parsed = JSON.parse(response.text || '{}');
    return res.status(200).json({
      success: true,
      reply: parsed.replyText || "I'm your Sous-Chef! What can I help you cook today?",
      detectedLanguage: parsed.detectedLanguage || language,
      action: {
        type: parsed.actionType || 'NONE',
        stepTarget: typeof parsed.stepTarget === 'number' ? parsed.stepTarget : undefined,
        timerSeconds: parsed.timerSeconds || undefined,
        timerLabel: parsed.timerLabel || undefined,
      },
      suggestedPrompts: parsed.suggestedPrompts || [
        "What's the next step?",
        'Set a 5 minute timer',
        'What can I substitute?',
      ],
    });
  } catch (error: any) {
    console.error('Error in /api/recipe-voice-bot:', error);
    return fail(res, error, 'Failed to process recipe voice query');
  }
}
