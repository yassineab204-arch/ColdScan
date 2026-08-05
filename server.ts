import express from "express";
import http from "http";
import path from "path";
import { WebSocketServer } from "ws";
import { GoogleGenAI, Type, Modality, LiveServerMessage } from "@google/genai";
import { createServer as createViteServer } from "vite";

const PORT = 3000;
const app = express();
const server = http.createServer(app);

// Enable high payload limit for photo uploads (base64)
app.use(express.json({ limit: "15mb" }));
app.use(express.urlencoded({ limit: "15mb", extended: true }));

// Initialize Gemini Client server-side securely
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      "User-Agent": "aistudio-build",
    },
  },
});

// Health check route
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", app: "ColdScan AI", timestamp: new Date().toISOString() });
});

// 1. Scan Fridge Endpoint
app.post("/api/scan-fridge", async (req, res) => {
  try {
    const { imageBase64, mimeType = "image/jpeg", notes, language = "en" } = req.body;

    if (!imageBase64) {
      return res.status(400).json({ error: "Missing imageBase64 data" });
    }

    // Clean up data URL prefix if present
    const cleanBase64 = imageBase64.replace(/^data:image\/\w+;base64,/, "");

    let langInstruction = "Output food item names, category, summaryNotes, and suggestedAction in English.";
    if (language === "fr") {
      langInstruction = "CRITICAL: Output all food item names, summaryNotes, and suggestedAction in natural FRENCH (Français).";
    } else if (language === "ar-MA") {
      langInstruction = "CRITICAL: Output all food item names, summaryNotes, and suggestedAction in MOROCCAN DARIJA (الدارجة المغربية) using Arabic script.";
    } else if (language === "es") {
      langInstruction = "CRITICAL: Output all food item names, summaryNotes, and suggestedAction in SPANISH (Español).";
    } else if (language === "de") {
      langInstruction = "CRITICAL: Output all food item names, summaryNotes, and suggestedAction in GERMAN (Deutsch).";
    } else if (language === "ar") {
      langInstruction = "CRITICAL: Output all food item names, summaryNotes, and suggestedAction in STANDARD ARABIC (العربية الفصحى).";
    } else if (language === "it") {
      langInstruction = "CRITICAL: Output all food item names, summaryNotes, and suggestedAction in ITALIAN (Italiano).";
    } else if (language === "pt") {
      langInstruction = "CRITICAL: Output all food item names, summaryNotes, and suggestedAction in PORTUGUESE (Português).";
    } else if (language === "ja") {
      langInstruction = "CRITICAL: Output all food item names, summaryNotes, and suggestedAction in JAPANESE (日本語).";
    }

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
Additional context from user: ${notes || "None"}`;

    const response = await ai.models.generateContent({
      model: "gemini-3.6-flash",
      contents: {
        parts: [
          {
            inlineData: {
              mimeType,
              data: cleanBase64,
            },
          },
          { text: promptText },
        ],
      },
      config: {
        responseMimeType: "application/json",
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
                required: ["name", "category", "freshness", "daysRemaining", "quantity", "unit"],
              },
            },
            summaryNotes: { type: Type.STRING },
            suggestedAction: { type: Type.STRING },
          },
          required: ["itemsFound", "summaryNotes", "suggestedAction"],
        },
      },
    });

    const resultText = response.text || "{}";
    const resultJson = JSON.parse(resultText);

    res.json({
      success: true,
      data: {
        itemsFound: (resultJson.itemsFound || []).map((item: any, idx: number) => ({
          id: `scan-${Date.now()}-${idx}`,
          name: item.name,
          category: item.category || "Produce",
          freshness: ["fresh", "soon_to_expire", "expired"].includes(item.freshness)
            ? item.freshness
            : "fresh",
          daysRemaining: Number(item.daysRemaining) || 3,
          quantity: Number(item.quantity) || 1,
          unit: item.unit || "item",
          locationInFridge: item.locationInFridge || "Middle Shelf",
          notes: item.notes || "",
          addedAt: new Date().toISOString(),
        })),
        summaryNotes: resultJson.summaryNotes || "Fridge scan complete.",
        suggestedAction: resultJson.suggestedAction || "Use soon-to-expire produce first.",
      },
    });
  } catch (error: any) {
    console.error("Error in /api/scan-fridge:", error);
    res.status(500).json({ error: error?.message || "Failed to analyze fridge image" });
  }
});

// 2. Recipe Recommendations Endpoint
app.post("/api/generate-recipes", async (req, res) => {
  try {
    const { inventory = [], dietaryPreferences = [], goal = "zero_waste", language = "en" } = req.body;

    const inventoryList = inventory
      .map(
        (i: any) =>
          `- ${i.name} (${i.quantity} ${i.unit}, status: ${i.freshness}, expires in ${i.daysRemaining} days)`
      )
      .join("\n");

    let langInstruction = "Write recipe titles, descriptions, instructions, and missing ingredients in English.";
    if (language === "fr") {
      langInstruction = "CRITICAL LANGUAGE MANDATE: Write recipe titles, descriptions, instructions, and ingredients entirely in FRENCH (Français).";
    } else if (language === "ar-MA") {
      langInstruction = "CRITICAL LANGUAGE MANDATE: Write recipe titles, descriptions, instructions, and ingredients in MOROCCAN DARIJA (الدارجة المغربية) using Arabic script.";
    } else if (language === "es") {
      langInstruction = "CRITICAL LANGUAGE MANDATE: Write recipe titles, descriptions, instructions, and ingredients entirely in SPANISH (Español).";
    } else if (language === "de") {
      langInstruction = "CRITICAL LANGUAGE MANDATE: Write recipe titles, descriptions, instructions, and ingredients entirely in GERMAN (Deutsch).";
    } else if (language === "ar") {
      langInstruction = "CRITICAL LANGUAGE MANDATE: Write recipe titles, descriptions, instructions, and ingredients in STANDARD ARABIC (العربية الفصحى).";
    } else if (language === "it") {
      langInstruction = "CRITICAL LANGUAGE MANDATE: Write recipe titles, descriptions, instructions, and ingredients entirely in ITALIAN (Italiano).";
    } else if (language === "pt") {
      langInstruction = "CRITICAL LANGUAGE MANDATE: Write recipe titles, descriptions, instructions, and ingredients entirely in PORTUGUESE (Português).";
    } else if (language === "ja") {
      langInstruction = "CRITICAL LANGUAGE MANDATE: Write recipe titles, descriptions, instructions, and ingredients entirely in JAPANESE (日本語).";
    }

    const prompt = `You are ColdScan's Chef AI. Generate 4 creative, delicious recipe ideas based primarily on ingredients available in the user's refrigerator.
${langInstruction}
PRIORITY RULE: Prioritize ingredients marked 'soon_to_expire' to help the user avoid food waste and save money!

Available Refrigerator Inventory:
${inventoryList || "No specific inventory provided"}

Dietary Preferences / Constraints: ${dietaryPreferences.join(", ") || "None"}

Requirements for each recipe:
1. Identify ingredients the user ALREADY HAS in the fridge from the list.
2. Identify MISSING ingredients that must be bought.
3. Estimate the total cost for purchasing only the missing ingredients.
4. Mark 'usesExpiringItems': true if the recipe uses items with freshness='soon_to_expire'.
5. Include step-by-step simple cooking instructions, prep time, difficulty, and estimated calories.`;

    const response = await ai.models.generateContent({
      model: "gemini-3.6-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
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
                  "name",
                  "description",
                  "cookTimeMinutes",
                  "difficulty",
                  "calories",
                  "ingredientsHas",
                  "ingredientsMissing",
                  "missingCostEstimate",
                  "instructions",
                ],
              },
            },
          },
          required: ["recipes"],
        },
      },
    });

    const resultText = response.text || "{}";
    const resultJson = JSON.parse(resultText);

    res.json({
      success: true,
      recipes: (resultJson.recipes || []).map((r: any, idx: number) => ({
        id: `gen-recipe-${Date.now()}-${idx}`,
        ...r,
      })),
    });
  } catch (error: any) {
    console.error("Error in /api/generate-recipes:", error);
    res.status(500).json({ error: error?.message || "Failed to generate recipes" });
  }
});

// 3. Smart Shopping List & Cost Estimate Endpoint
app.post("/api/generate-shopping-list", async (req, res) => {
  try {
    const { missingItems = [], inventory = [], language = "en" } = req.body;

    let langInstruction = "Write item names and savingsTips in English.";
    if (language === "fr") {
      langInstruction = "CRITICAL LANGUAGE MANDATE: Write all missing item names and savingsTips in FRENCH (Français).";
    } else if (language === "ar-MA") {
      langInstruction = "CRITICAL LANGUAGE MANDATE: Write all missing item names and savingsTips in MOROCCAN DARIJA (الدارجة المغربية) using Arabic script.";
    } else if (language === "es") {
      langInstruction = "CRITICAL LANGUAGE MANDATE: Write all missing item names and savingsTips in SPANISH (Español).";
    } else if (language === "de") {
      langInstruction = "CRITICAL LANGUAGE MANDATE: Write all missing item names and savingsTips in GERMAN (Deutsch).";
    } else if (language === "ar") {
      langInstruction = "CRITICAL LANGUAGE MANDATE: Write all missing item names and savingsTips in STANDARD ARABIC (العربية الفصحى).";
    } else if (language === "it") {
      langInstruction = "CRITICAL LANGUAGE MANDATE: Write all missing item names and savingsTips in ITALIAN (Italiano).";
    } else if (language === "pt") {
      langInstruction = "CRITICAL LANGUAGE MANDATE: Write all missing item names and savingsTips in PORTUGUESE (Português).";
    } else if (language === "ja") {
      langInstruction = "CRITICAL LANGUAGE MANDATE: Write all missing item names and savingsTips in JAPANESE (日本語).";
    }

    const prompt = `You are ColdScan's Grocery Cost Optimizer AI.
Given the missing ingredients required for upcoming meal plans:
${missingItems.join(", ") || "General fridge staples restock"}
${langInstruction}

1. Categorize each missing item into: Produce, Dairy & Eggs, Proteins, Condiments & Sauces, Beverages, Bakery, Leftovers, Pantry & Other.
2. Estimate reasonable current market unit price in Moroccan Dirhams (DH) for each item (e.g. 5 to 60 DH per item).
3. Assign priority ('high' for basic cooking essentials, 'medium', 'low').
4. Provide total estimated cost and 3 smart money-saving grocery shopping tips to minimize waste.`;

    const response = await ai.models.generateContent({
      model: "gemini-3.6-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
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
                required: ["name", "category", "estimatedPrice", "priority"],
              },
            },
            totalEstimatedCost: { type: Type.NUMBER },
            savingsTips: { type: Type.ARRAY, items: { type: Type.STRING } },
          },
          required: ["items", "totalEstimatedCost", "savingsTips"],
        },
      },
    });

    const resultText = response.text || "{}";
    const resultJson = JSON.parse(resultText);

    res.json({
      success: true,
      items: (resultJson.items || []).map((item: any, idx: number) => ({
        id: `shop-gen-${Date.now()}-${idx}`,
        name: item.name,
        category: item.category || "Pantry & Other",
        quantity: item.quantity || 1,
        unit: item.unit || "unit",
        estimatedPrice: Number(item.estimatedPrice) || 15.00,
        isBought: false,
        priority: item.priority || "medium",
      })),
      totalEstimatedCost: resultJson.totalEstimatedCost || 0,
      savingsTips: resultJson.savingsTips || [],
    });
  } catch (error: any) {
    console.error("Error in /api/generate-shopping-list:", error);
    res.status(500).json({ error: error?.message || "Failed to generate shopping list" });
  }
});

// 4. AI Conversational Assistant Endpoint with Dynamic Language Auto-Detection
app.post("/api/ai-chat", async (req, res) => {
  try {
    const { message, inventory = [], language = "en" } = req.body;

    const inventorySummary = inventory
      .map(
        (item: any) =>
          `${item.name} (${item.quantity} ${item.unit}, status: ${item.freshness}, days left: ${item.daysRemaining})`
      )
      .join("; ");

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

    const response = await ai.models.generateContent({
      model: "gemini-3.6-flash",
      contents: message,
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            replyText: { 
              type: Type.STRING, 
              description: "The conversational response to the user in the detected language." 
            },
            detectedLanguage: {
              type: Type.STRING,
              description: "The detected language code ('en', 'fr', 'ar-MA', 'es', 'de', 'ar', etc.)"
            }
          },
          required: ["replyText", "detectedLanguage"]
        }
      },
    });

    const parsed = JSON.parse(response.text || "{}");
    res.json({
      success: true,
      reply: parsed.replyText || "I'm here to help you reduce food waste and cook great meals!",
      detectedLanguage: parsed.detectedLanguage || language,
    });
  } catch (error: any) {
    console.error("Error in /api/ai-chat:", error);
    res.status(500).json({ error: error?.message || "Failed to communicate with AI Assistant" });
  }
});

// 4.5 Dedicated Recipe Voice Bot / Live Cooking Sous-Chef Endpoint with Dynamic Language Auto-Detection
app.post("/api/recipe-voice-bot", async (req, res) => {
  try {
    const { 
      message, 
      activeRecipe = null, 
      recipes = [], 
      currentStep = 0, 
      inventory = [], 
      language = "en" 
    } = req.body;

    const inventorySummary = inventory
      .map((item: any) => `${item.name} (${item.freshness})`)
      .join(", ");

    const availableRecipesSummary = recipes
      .map((r: any, idx: number) => `${idx + 1}. ${r.name} (${r.cookTimeMinutes} mins, ${r.difficulty})`)
      .join("; ");

    let recipeContext = "No specific recipe currently active. The user is browsing recipes or asking for cooking ideas.";
    if (activeRecipe) {
      const instructionsList = (activeRecipe.instructions || [])
        .map((step: string, idx: number) => `Step ${idx + 1}: ${step}`)
        .join("\n");

      recipeContext = `Active Recipe: "${activeRecipe.name}"
Total Steps: ${(activeRecipe.instructions || []).length}
Current Step Index: ${currentStep + 1} of ${(activeRecipe.instructions || []).length}
Current Step Text: "${(activeRecipe.instructions || [])[currentStep] || 'Completed'}"
Ingredients on hand: ${(activeRecipe.ingredientsHas || []).join(", ")}
Ingredients missing: ${(activeRecipe.ingredientsMissing || []).join(", ")}
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

Available Fridge Items: [${inventorySummary || "None listed"}]
Available Recipes in App: [${availableRecipesSummary || "None listed"}]

Your Capabilities:
1. Guide step-by-step through the active recipe.
2. If the user asks for "next step" (ou "étape suivante" / "الخطوة الجاية"), "repeat step" ("répéter" / "عاود ليا"), "previous step" ("étape précédente" / "رجع للخطوة لي قبل"), or to jump to a specific step, acknowledge clearly and provide the step text.
3. If the user asks for ingredient substitutions (e.g. "I have no butter", "pas de beurre", "ما عنديش الزبدة"), give quick, practical kitchen substitutes based on typical pantry items or their fridge inventory.
4. If the user asks for a timer (e.g. "set a timer for 5 minutes", "minuteur 5 minutes", "دير ليا 5 دقايق"), calculate the total seconds and specify the action.
5. If the user asks culinary questions (e.g. "how do I know the chicken is cooked?", "comment savoir si c'est cuit?"), provide expert chef advice in 2-3 spoken sentences.
6. Keep answers concise, spoken-friendly (no asterisks, no bullet symbols in replyText, no complex markdown tables), encouraging, and clear because this is heard aloud in a busy kitchen.

Return a valid JSON object matching the schema.`;

    const response = await ai.models.generateContent({
      model: "gemini-3.6-flash",
      contents: `User voice query: "${message}"`,
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            replyText: { 
              type: Type.STRING, 
              description: "The spoken response from the AI Sous-Chef to be read aloud to the user in the detected language." 
            },
            detectedLanguage: {
              type: Type.STRING,
              description: "The detected language code: 'en' for English, 'fr' for French, 'ar-MA' for Moroccan Darija, 'es', 'de', 'ar', etc."
            },
            actionType: {
              type: Type.STRING,
              description: "One of: NEXT_STEP, PREV_STEP, REPEAT_STEP, GOTO_STEP, SET_TIMER, SELECT_RECIPE, NONE",
            },
            stepTarget: {
              type: Type.NUMBER,
              description: "The 0-based target step index if action is NEXT_STEP, PREV_STEP, GOTO_STEP, or REPEAT_STEP."
            },
            timerSeconds: {
              type: Type.NUMBER,
              description: "The duration in seconds if actionType is SET_TIMER, e.g. 300 for 5 minutes."
            },
            timerLabel: {
              type: Type.STRING,
              description: "Short label for the timer, e.g. 'Simmering' or '5 Min Timer'."
            },
            suggestedPrompts: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: "2-3 short voice prompt suggestions for the user in the detected language."
            }
          },
          required: ["replyText", "actionType", "detectedLanguage"]
        }
      }
    });

    const parsed = JSON.parse(response.text || "{}");
    res.json({
      success: true,
      reply: parsed.replyText || "I'm your Sous-Chef! What can I help you cook today?",
      detectedLanguage: parsed.detectedLanguage || language,
      action: {
        type: parsed.actionType || "NONE",
        stepTarget: typeof parsed.stepTarget === "number" ? parsed.stepTarget : undefined,
        timerSeconds: parsed.timerSeconds || undefined,
        timerLabel: parsed.timerLabel || undefined,
      },
      suggestedPrompts: parsed.suggestedPrompts || [
        "What's the next step?",
        "Set a 5 minute timer",
        "What can I substitute?"
      ]
    });
  } catch (error: any) {
    console.error("Error in /api/recipe-voice-bot:", error);
    res.status(500).json({ error: error?.message || "Failed to process recipe voice query" });
  }
});

// Helper to convert raw PCM audio (e.g. from Gemini TTS) into a valid WAV file buffer with RIFF header
function pcmToWav(pcmBase64: string, sampleRate: number = 24000): string {
  const pcmBuffer = Buffer.from(pcmBase64, "base64");
  const numChannels = 1;
  const bitsPerSample = 16;
  const byteRate = sampleRate * numChannels * (bitsPerSample / 8);
  const blockAlign = numChannels * (bitsPerSample / 8);
  const dataSize = pcmBuffer.length;
  const chunkSize = 36 + dataSize;

  const header = Buffer.alloc(44);
  header.write("RIFF", 0);
  header.writeUInt32LE(chunkSize, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16); // Subchunk1Size (16 for PCM)
  header.writeUInt16LE(1, 20); // AudioFormat (1 = PCM)
  header.writeUInt16LE(numChannels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(bitsPerSample, 34);
  header.write("data", 36);
  header.writeUInt32LE(dataSize, 40);

  const wavBuffer = Buffer.concat([header, pcmBuffer]);
  return wavBuffer.toString("base64");
}

// 5. Text-To-Speech Endpoint (Spoken responses for voice interaction)
app.post("/api/tts", async (req, res) => {
  try {
    const { text, voice = "Zephyr", language = "en" } = req.body;

    if (!text) {
      return res.status(400).json({ error: "Text parameter is required" });
    }

    let promptPrefix = "Say in a warm, helpful food-assistant tone:";
    if (language === "fr") {
      promptPrefix = "Say in clear, natural French with a warm food-assistant tone:";
    } else if (language === "ar-MA") {
      promptPrefix = "Say in clear, natural Moroccan Darija (Arabic) with a warm food-assistant tone:";
    } else if (language === "es") {
      promptPrefix = "Say in clear, natural Spanish with a warm food-assistant tone:";
    } else if (language === "de") {
      promptPrefix = "Say in clear, natural German with a warm food-assistant tone:";
    } else if (language === "ar") {
      promptPrefix = "Say in clear, natural Standard Arabic with a warm food-assistant tone:";
    } else if (language === "it") {
      promptPrefix = "Say in clear, natural Italian with a warm food-assistant tone:";
    } else if (language === "pt") {
      promptPrefix = "Say in clear, natural Portuguese with a warm food-assistant tone:";
    } else if (language === "ja") {
      promptPrefix = "Say in clear, natural Japanese with a warm food-assistant tone:";
    }

    const response = await ai.models.generateContent({
      model: "gemini-3.1-flash-tts-preview",
      contents: [{ parts: [{ text: `${promptPrefix} ${text}` }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: voice },
          },
        },
      },
    });

    const inlineData = response.candidates?.[0]?.content?.parts?.[0]?.inlineData;
    const rawData = inlineData?.data;
    const mimeType = inlineData?.mimeType || "audio/pcm";

    if (rawData) {
      let sampleRate = 24000;
      const rateMatch = mimeType.match(/rate=(\d+)/);
      if (rateMatch && rateMatch[1]) {
        sampleRate = parseInt(rateMatch[1], 10);
      }

      let wavBase64 = rawData;
      // If raw PCM without RIFF header, wrap with WAV header
      if (mimeType.includes("pcm") || !rawData.startsWith("UklGR")) {
        wavBase64 = pcmToWav(rawData, sampleRate);
      }

      res.json({ success: true, base64Audio: wavBase64, mimeType: "audio/wav" });
    } else {
      res.status(500).json({ error: "No audio generated from TTS" });
    }
  } catch (error: any) {
    console.error("Error in /api/tts:", error);
    res.status(500).json({ error: error?.message || "Failed to generate speech" });
  }
});

// 6. Gemini Live WebSocket Integration on `/live` route
const wss = new WebSocketServer({ noServer: true });

server.on("upgrade", (request, socket, head) => {
  const reqUrl = new URL(request.url || "", "http://localhost:3000");
  if (reqUrl.pathname === "/live") {
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit("connection", ws, request);
    });
  }
});

wss.on("connection", async (clientWs, request) => {
  console.log("Client connected to Gemini Live websocket");
  
  const reqUrl = new URL(request.url || "", "http://localhost:3000");
  const voiceName = reqUrl.searchParams.get("voice") || "Zephyr";

  const buildSystemInstruction = (inventoryListText: string = "", recipeContextText: string = "") => {
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
${recipeContextText ? `\nCURRENT RECIPE CONTEXT:\n${recipeContextText}\n` : ""}
${inventoryListText ? `\nCURRENT USER FRIDGE INVENTORY:\n${inventoryListText}\n` : ""}`;
  };

  try {
    const session = await ai.live.connect({
      model: "gemini-3.1-flash-live-preview",
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: { prebuiltVoiceConfig: { voiceName: voiceName as any } },
        },
        inputAudioTranscription: {},
        outputAudioTranscription: {},
        systemInstruction: buildSystemInstruction(),
      },
      callbacks: {
        onopen: () => {
          console.log("Gemini Live session opened successfully");
          if (clientWs.readyState === clientWs.OPEN) {
            clientWs.send(JSON.stringify({ type: "sessionReady" }));
          }
        },
        onmessage: (message: LiveServerMessage) => {
          if (!clientWs || clientWs.readyState !== clientWs.OPEN) return;

          const serverContent = message.serverContent;
          if (serverContent) {
            // Forward real-time audio chunks from Gemini Live model
            const parts = serverContent.modelTurn?.parts;
            if (parts && parts.length > 0) {
              for (const part of parts) {
                if (part.inlineData?.data) {
                  clientWs.send(JSON.stringify({ 
                    type: "audio", 
                    audio: part.inlineData.data,
                    mimeType: part.inlineData.mimeType || "audio/pcm;rate=24000"
                  }));
                }
                if (part.text) {
                  clientWs.send(JSON.stringify({ 
                    type: "modelTranscript", 
                    text: part.text 
                  }));
                }
              }
            }

            // Output transcription (text of what model is speaking)
            if ((serverContent as any).outputAudioTranscription?.text) {
              clientWs.send(JSON.stringify({
                type: "modelTranscript",
                text: (serverContent as any).outputAudioTranscription.text,
              }));
            }

            // Input transcription (text of user's spoken words)
            if ((serverContent as any).inputAudioTranscription?.text) {
              clientWs.send(JSON.stringify({
                type: "userTranscript",
                text: (serverContent as any).inputAudioTranscription.text,
              }));
            }

            // Interruption signal (user began speaking while model was outputting audio)
            if (serverContent.interrupted) {
              clientWs.send(JSON.stringify({ type: "interrupted" }));
            }

            // Turn complete
            if (serverContent.turnComplete) {
              clientWs.send(JSON.stringify({ type: "turnComplete" }));
            }
          }
        },
        onerror: (err: any) => {
          console.error("Gemini Live session error:", err);
          if (clientWs.readyState === clientWs.OPEN) {
            clientWs.send(JSON.stringify({ type: "error", error: "Live session error occurred" }));
          }
        },
        onclose: () => {
          console.log("Gemini Live session closed");
          if (clientWs.readyState === clientWs.OPEN) {
            clientWs.send(JSON.stringify({ type: "sessionClosed" }));
          }
        },
      },
    });

    clientWs.on("message", (data) => {
      try {
        const parsed = JSON.parse(data.toString());

        // Handle initial context injection
        if (parsed.type === "init_context") {
          const inventorySummary = Array.isArray(parsed.inventory)
            ? parsed.inventory.map((item: any) => `- ${item.name} (${item.category || 'General'}, ${item.freshness || 'fresh'}, qty: ${item.quantity || 1} ${item.unit || 'unit'})`).join("\n")
            : "";
          
          const recipeSummary = parsed.recipe ? `Recipe Name: ${parsed.recipe.name}\nIngredients: ${parsed.recipe.ingredientsAvailable?.join(', ')}\nInstructions: ${parsed.recipe.instructions?.join(' -> ')}` : "";

          session.sendRealtimeInput({
            text: `[System Context Update] ${recipeSummary ? `Current Recipe:\n${recipeSummary}\n` : ""}User's Fridge Inventory:\n${inventorySummary || "Empty fridge"}\nPlease greet the user out loud in Moroccan Darija, French, or English as their live culinary sous-chef.`,
          });
          return;
        }

        // Realtime audio streaming from microphone (16kHz PCM)
        if (parsed.audio) {
          session.sendRealtimeInput({
            audio: { data: parsed.audio, mimeType: "audio/pcm;rate=16000" },
          });
        }

        // Realtime camera video frames (JPEG)
        if (parsed.video) {
          session.sendRealtimeInput({
            video: { data: parsed.video, mimeType: "image/jpeg" },
          });
        }

        // Realtime text input
        if (parsed.text) {
          session.sendRealtimeInput({
            text: parsed.text,
          });
        }
      } catch (err) {
        console.error("Error handling client message for Gemini Live session:", err);
      }
    });

    clientWs.on("close", () => {
      console.log("Client disconnected from Gemini Live websocket");
      try {
        session.close();
      } catch (e) {}
    });
  } catch (error: any) {
    console.error("Failed to connect to Gemini Live session:", error);
    if (clientWs.readyState === clientWs.OPEN) {
      clientWs.send(JSON.stringify({ type: "error", error: error?.message || "Could not start Gemini Live session" }));
    }
  }
});

// Vite middleware & static serving
async function setupVite() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  server.listen(PORT, "0.0.0.0", () => {
    console.log(`ColdScan Server running on http://0.0.0.0:${PORT}`);
  });
}

setupVite();
