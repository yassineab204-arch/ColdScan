import { Type } from '@google/genai';
import { TEXT_MODEL, getGenAI, languageMandate } from './_lib/genai';
import { ApiRequest, ApiResponse, fail, methodGuard, readBody } from './_lib/http';

export default async function handler(req: ApiRequest, res: ApiResponse) {
  if (!methodGuard(req, res, 'POST')) return;

  try {
    const { missingItems = [], language = 'en' } = readBody(req);

    const langInstruction = languageMandate(
      language,
      'all missing item names and savingsTips'
    );

    const prompt = `You are ColdScan's Grocery Cost Optimizer AI.
Given the missing ingredients required for upcoming meal plans:
${missingItems.join(', ') || 'General fridge staples restock'}
${langInstruction}

1. Categorize each missing item into: Produce, Dairy & Eggs, Proteins, Condiments & Sauces, Beverages, Bakery, Leftovers, Pantry & Other.
2. Estimate reasonable current market unit price in Moroccan Dirhams (DH) for each item (e.g. 5 to 60 DH per item).
3. Assign priority ('high' for basic cooking essentials, 'medium', 'low').
4. Provide total estimated cost and 3 smart money-saving grocery shopping tips to minimize waste.`;

    const ai = getGenAI();
    const response = await ai.models.generateContent({
      model: TEXT_MODEL,
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            items: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  name: { type: Type.STRING },
                  category: { type: Type.STRING },
                  quantity: { type: Type.NUMBER },
                  unit: { type: Type.STRING },
                  estimatedPrice: { type: Type.NUMBER },
                  priority: { type: Type.STRING },
                },
                required: ['name', 'category', 'estimatedPrice', 'priority'],
              },
            },
            totalEstimatedCost: { type: Type.NUMBER },
            savingsTips: { type: Type.ARRAY, items: { type: Type.STRING } },
          },
          required: ['items', 'totalEstimatedCost', 'savingsTips'],
        },
      },
    });

    const resultJson = JSON.parse(response.text || '{}');

    return res.status(200).json({
      success: true,
      items: (resultJson.items || []).map((item: any, idx: number) => ({
        id: `shop-gen-${Date.now()}-${idx}`,
        name: item.name,
        category: item.category || 'Pantry & Other',
        quantity: item.quantity || 1,
        unit: item.unit || 'unit',
        estimatedPrice: Number(item.estimatedPrice) || 15.0,
        isBought: false,
        priority: item.priority || 'medium',
      })),
      totalEstimatedCost: resultJson.totalEstimatedCost || 0,
      savingsTips: resultJson.savingsTips || [],
    });
  } catch (error: any) {
    console.error('Error in /api/generate-shopping-list:', error);
    return fail(res, error, 'Failed to generate shopping list');
  }
}
