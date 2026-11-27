import { Type } from '@google/genai';
import { TEXT_MODEL, getGenAI, languageMandate } from './_lib/genai.js';
import { ApiRequest, ApiResponse, fail, methodGuard, readBody } from './_lib/http.js';
import { requireFeatureAccess } from './_lib/trial.js';

export default async function handler(req: ApiRequest, res: ApiResponse) {
  if (!methodGuard(req, res, 'POST')) return;

  // Server-side trial gate: refuses the work once the 48 hours are up,
  // regardless of anything the client claims.
  if (!(await requireFeatureAccess(req, res, 'scan'))) return;

  try {
    const { imageBase64, mimeType = 'image/jpeg', notes, language = 'en' } = readBody(req);

    if (!imageBase64) {
      return res.status(400).json({ error: 'Missing imageBase64 data' });
    }

    // Clean up data URL prefix if present
    const cleanBase64 = String(imageBase64).replace(/^data:image\/\w+;base64,/, '');

    const langInstruction = languageMandate(
      language,
      'food item names, units, notes, summaryNotes, and suggestedAction; keep category, freshness, and locationInFridge in the specified English values'
    );

    const promptText = `You are ColdScan AI. Carefully inspect this photo of food or a refrigerator. Today is ${new Date().toISOString().slice(0, 10)} (UTC).
${langInstruction}
- Scan the entire image, including shelves and door, and list only foods or drinks actually visible. Never invent hidden contents, brands, opening dates, quantities or dates. If an item cannot be identified, use a cautious generic name or omit it. Return an empty list if no food is identifiable.
- Count visible items only; group identical items where appropriate. If quantity cannot be determined, use 1 and mention the uncertainty in notes.
- category must be exactly one of: Produce, Dairy & Eggs, Proteins, Condiments & Sauces, Beverages, Bakery, Leftovers, Pantry & Other. locationInFridge must be exactly one of Top Shelf, Middle Shelf, Bottom Shelf, Crisper Drawer, Door Shelf, Freezer; use an empty string if unclear.
- A photo cannot reliably establish safety, age, or an expiry date. Never claim something is safe to eat or expired based only on an assumed age. Use expired only for clearly visible spoilage or a clearly readable past expiry date; use soon_to_expire only for visible deterioration or a clearly readable near date. Otherwise use fresh as a provisional tracking category, not a safety determination. daysRemaining is only a rough storage estimate, never a confirmed expiry; explain uncertainty in notes.
- Return brief summaryNotes and suggestedAction, reminding users to check labels and food condition. Do not infer ingredients inside opaque packaging.
Additional context supplied by user (not evidence unless supported by the image): ${typeof notes === 'string' ? notes.slice(0, 1000) : 'None'}`;

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
                  category: { type: Type.STRING, enum: ['Produce', 'Dairy & Eggs', 'Proteins', 'Condiments & Sauces', 'Beverages', 'Bakery', 'Leftovers', 'Pantry & Other'] },
                  freshness: { type: Type.STRING, enum: ['fresh', 'soon_to_expire', 'expired'] },
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
    if (!Array.isArray(resultJson.itemsFound)) throw new Error('Invalid scan response');
    const categories = ['Produce', 'Dairy & Eggs', 'Proteins', 'Condiments & Sauces', 'Beverages', 'Bakery', 'Leftovers', 'Pantry & Other'];

    return res.status(200).json({
      success: true,
      data: {
        itemsFound: resultJson.itemsFound.filter((item: any) => typeof item?.name === 'string' && item.name.trim()).map((item: any, idx: number) => ({
          id: `scan-${Date.now()}-${idx}`,
          name: item.name.trim(),
          category: categories.includes(item.category) ? item.category : 'Pantry & Other',
          freshness: ['fresh', 'soon_to_expire', 'expired'].includes(item.freshness)
            ? item.freshness
            : 'fresh',
          daysRemaining: Number.isFinite(Number(item.daysRemaining)) && item.daysRemaining != null ? Math.max(0, Number(item.daysRemaining)) : 3,
          quantity: Number.isFinite(Number(item.quantity)) && Number(item.quantity) > 0 ? Number(item.quantity) : 1,
          unit: item.unit || 'item',
          locationInFridge: item.locationInFridge || '',
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
