import { Type } from '@google/genai';
import { TEXT_MODEL, getGenAI } from './_lib/genai.js';
import { ApiRequest, ApiResponse, fail, methodGuard, readBody } from './_lib/http.js';
import { requireActiveTrial } from './_lib/trial.js';

export default async function handler(req: ApiRequest, res: ApiResponse) {
  if (!methodGuard(req, res, 'POST')) return;

  // Server-side trial gate: refuses the work once the 48 hours are up,
  // regardless of anything the client claims.
  if (!(await requireActiveTrial(req, res))) return;

  try {
    const { message, inventory = [], language = 'en' } = readBody(req);

    const inventorySummary = inventory
      .map(
        (item: any) =>
          `${item.name} (${item.quantity} ${item.unit}, status: ${item.freshness}, days left: ${item.daysRemaining})`
      )
      .join('; ');

    const systemInstruction = `You are ColdScan AI, a friendly, concise, and smart food waste reduction and kitchen assistant.
The user is asking a question about their refrigerator contents or cooking strategy.
Current Fridge Inventory: [${inventorySummary}]

CRITICAL DYNAMIC LANGUAGE DETECTION & MULTILINGUAL CONVERSATION MANDATE:
1. Analyze the user's message: "${message}".
2. Detect if the user is speaking in:
   - ENGLISH -> Set detectedLanguage to "en". Reply in natural, encouraging spoken English.
   - FRENCH -> Set detectedLanguage to "fr". Reply in fluent, warm spoken French ("Voici ce que vous pouvez préparer...", "Dans votre frigo...").
   - MOROCCAN DARIJA -> Set detectedLanguage to "ar-MA". If the user speaks Moroccan Darija (الدارجة المغربية) — whether in Arabic alphabet (e.g. "شنو نطيب دابا", "شنو عندي فالتلاجة", "شنو خاصني نشري") OR Latin Arabizi/Franco-Arabe (e.g. "kifash ntayeb", "chno kayn f tlaja", "chno ndir b maticha") — reply in authentic, warm Moroccan Darija using clear Arabic script (e.g. "أهلاً بك! تقدر تطيب طاجين بالخضرة لي بقات عندك فالتلاجة...").
   - SPANISH ("es"), GERMAN ("de"), ARABIC ("ar"), ITALIAN ("it"), PORTUGUESE ("pt"), JAPANESE ("ja") if detected.
   - If ambiguous or short, default to user's selected language: "${language}".

Focus on answering user questions like:
- "What can I cook with what I have?"
- "What should I use first?"
- "What do I need to buy?"

Provide:
1. A clear, encouraging, friendly direct conversational text answer (2-4 spoken sentences).
2. Keep it natural for voice reading (no asterisks, no bullet symbols in replyText, no complex markdown tables).

Return a valid JSON object matching the schema.`;

    const ai = getGenAI();
    const response = await ai.models.generateContent({
      model: TEXT_MODEL,
      contents: message,
      config: {
        systemInstruction,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            replyText: {
              type: Type.STRING,
              description: 'The conversational response to the user in the detected language.',
            },
            detectedLanguage: {
              type: Type.STRING,
              description: "The detected language code ('en', 'fr', 'ar-MA', 'es', 'de', 'ar', etc.)",
            },
          },
          required: ['replyText', 'detectedLanguage'],
        },
      },
    });

    const parsed = JSON.parse(response.text || '{}');
    return res.status(200).json({
      success: true,
      reply:
        parsed.replyText || "I'm here to help you reduce food waste and cook great meals!",
      detectedLanguage: parsed.detectedLanguage || language,
    });
  } catch (error: any) {
    console.error('Error in /api/ai-chat:', error);
    return fail(res, error, 'Failed to communicate with AI Assistant');
  }
}
