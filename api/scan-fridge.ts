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
    const { imageBase64, mimeType = 'image/jpeg', notes, language = 'en' } = readBody(req);

    if (!imageBase64) {
      return res.status(400).json({ error: 'Missing imageBase64 data' });
    }

    // Clean up data URL prefix if present
    const cleanBase64 = String(imageBase64).replace(/^data:image\/\w+;base64,/, '');

    const langInstruction = languageMandate(
      language,
      'all food item names, category, summaryNotes, and suggestedAction'
    );

    const promptText = `You are ColdScan AI, an expert food waste reduction and smart refrigerator analyzer.
Analyze the image of the refrigerator interior / food contents carefully.
${langInstruction}
1. Detect and list all food items visible.
2. For each food item, identify its name, category (Produce, Dairy & Eggs, Proteins, Condiments & Sauces, Beverages, Bakery, Leftovers, Pantry & Other), quantity, unit, and location in fridge.
3. Estimate freshness status strictly as one of: "fresh", "soon_to_expire", or "expired".
   - "soon_to_expire": produce showing slight wilt/ripeness, open milk, prepared leftovers older than 2 days, berries, opened dips.
   - "expired": visible mold, spoiled produce, outdated items.
4. Estimate remaining fresh days before expiry (e.g. 1-2 days for soon to expire, 5-14 days for fresh).
5. Provide a short summary and suggested waste-reduction action.
Additional context from user: ${notes || 'None'}`;

    const ai = getGenAI();
    const response = await ai.models.generateContent({
      model: TEXT_MODEL,
      contents: {
        parts: [
          { inlineData: { mimeType, data: cleanBase64 } },
          { text: promptText },
        ],
      },
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            itemsFound: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  name: { type: Type.STRING },
                  category: { type: Type.STRING },
                  freshness: { type: Type.STRING }, // 'fresh' | 'soon_to_expire' | 'expired'
                  daysRemaining: { type: Type.NUMBER },
                  quantity: { type: Type.NUMBER },
                  unit: { type: Type.STRING },
                  locationInFridge: { type: Type.STRING },
                  notes: { type: Type.STRING },
                },
                required: ['name', 'category', 'freshness', 'daysRemaining', 'quantity', 'unit'],
              },
            },
            summaryNotes: { type: Type.STRING },
            suggestedAction: { type: Type.STRING },
          },
          required: ['itemsFound', 'summaryNotes', 'suggestedAction'],
        },
      },
    });

    const resultJson = JSON.parse(response.text || '{}');

    return res.status(200).json({
      success: true,
      data: {
        itemsFound: (resultJson.itemsFound || []).map((item: any, idx: number) => ({
          id: `scan-${Date.now()}-${idx}`,
          name: item.name,
          category: item.category || 'Produce',
          freshness: ['fresh', 'soon_to_expire', 'expired'].includes(item.freshness)
            ? item.freshness
            : 'fresh',
          daysRemaining: Number(item.daysRemaining) || 3,
          quantity: Number(item.quantity) || 1,
          unit: item.unit || 'item',
          locationInFridge: item.locationInFridge || 'Middle Shelf',
          notes: item.notes || '',
          addedAt: new Date().toISOString(),
        })),
        summaryNotes: resultJson.summaryNotes || 'Fridge scan complete.',
        suggestedAction: resultJson.suggestedAction || 'Use soon-to-expire produce first.',
      },
    });
  } catch (error: any) {
    console.error('Error in /api/scan-fridge:', error);
    return fail(res, error, 'Failed to analyze fridge image');
  }
}
