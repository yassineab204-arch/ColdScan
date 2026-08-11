import { Type } from '@google/genai';
import { TEXT_MODEL, getGenAI, languageMandate } from './_lib/genai.js';
import { ApiRequest, ApiResponse, fail, methodGuard, readBody } from './_lib/http.js';
import { requireActiveTrial } from './_lib/trial.js';

export default async function handler(req: ApiRequest, res: ApiResponse) {
  if (!methodGuard(req, res, 'POST')) return;

  // Server-side trial gate: refuses the work once the 48 hours are up,
  // regardless of anything the client claims.
  if (!(await requireActiveTrial(req, res))) return;

  try {
    const { inventory = [], dietaryPreferences = [], language = 'en' } = readBody(req);

    const inventoryList = inventory
      .map(
        (i: any) =>
          `- ${i.name} (${i.quantity} ${i.unit}, status: ${i.freshness}, expires in ${i.daysRemaining} days)`
      )
      .join('\n');

    const langInstruction = languageMandate(
      language,
      'recipe titles, descriptions, instructions, and ingredients'
    );

    const prompt = `You are ColdScan's Chef AI. Generate 4 creative, delicious recipe ideas based primarily on ingredients available in the user's refrigerator.
${langInstruction}
PRIORITY RULE: Prioritize ingredients marked 'soon_to_expire' to help the user avoid food waste and save money!

Available Refrigerator Inventory:
${inventoryList || 'No specific inventory provided'}

Dietary Preferences / Constraints: ${dietaryPreferences.join(', ') || 'None'}

Requirements for each recipe:
1. Identify ingredients the user ALREADY HAS in the fridge from the list.
2. Identify MISSING ingredients that must be bought.
3. Estimate the total cost for purchasing only the missing ingredients.
4. Mark 'usesExpiringItems': true if the recipe uses items with freshness='soon_to_expire'.
5. Include step-by-step simple cooking instructions, prep time, difficulty, and estimated calories.`;

    const ai = getGenAI();
    const response = await ai.models.generateContent({
      model: TEXT_MODEL,
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            recipes: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  name: { type: Type.STRING },
                  description: { type: Type.STRING },
                  cookTimeMinutes: { type: Type.NUMBER },
                  difficulty: { type: Type.STRING },
                  calories: { type: Type.NUMBER },
                  ingredientsHas: { type: Type.ARRAY, items: { type: Type.STRING } },
                  ingredientsMissing: { type: Type.ARRAY, items: { type: Type.STRING } },
                  missingCostEstimate: { type: Type.NUMBER },
                  instructions: { type: Type.ARRAY, items: { type: Type.STRING } },
                  tags: { type: Type.ARRAY, items: { type: Type.STRING } },
                  servings: { type: Type.NUMBER },
                  usesExpiringItems: { type: Type.BOOLEAN },
                },
                required: [
                  'name',
                  'description',
                  'cookTimeMinutes',
                  'difficulty',
                  'calories',
                  'ingredientsHas',
                  'ingredientsMissing',
                  'missingCostEstimate',
                  'instructions',
                ],
              },
            },
          },
          required: ['recipes'],
        },
      },
    });

    const resultJson = JSON.parse(response.text || '{}');

    return res.status(200).json({
      success: true,
      recipes: (resultJson.recipes || []).map((r: any, idx: number) => ({
        id: `gen-recipe-${Date.now()}-${idx}`,
        ...r,
      })),
    });
  } catch (error: any) {
    console.error('Error in /api/generate-recipes:', error);
    return fail(res, error, 'Failed to generate recipes');
  }
}
