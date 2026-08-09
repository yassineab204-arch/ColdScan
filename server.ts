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

// 4. AI Conversational Assistant Endpoint
app.post("/api/ai-chat", async (req, res) => {
  try {
    const { message, inventory = [], language = "en" } = req.body;

    const inventorySummary = inventory
      .map(
        (item: any) =>
          `${item.name} (${item.quantity} ${item.unit}, status: ${item.freshness}, days left: ${item.daysRemaining})`
      )
      .join("; ");

    let langInstruction = "Respond in clear, friendly English.";
    if (language === "fr") {
      langInstruction = "CRITICAL LANGUAGE MANDATE: You MUST reply entirely in natural, fluent FRENCH (Français). Use friendly culinary terms and waste reduction advice in French.";
    } else if (language === "ar-MA") {
      langInstruction = "CRITICAL LANGUAGE MANDATE: You MUST reply entirely in authentic MOROCCAN DARIJA (الدارجة المغربية) using Arabic script. Use natural Moroccan food vocabulary (e.g. التلاجة, الخضرة, الفرماج, الطاجين, النعناع, السويقة, مطيشة, البصلة, الزيت, الدجاج). Keep the tone warm, helpful, and conversational in Moroccan Darija.";
    } else if (language === "es") {
      langInstruction = "CRITICAL LANGUAGE MANDATE: You MUST reply entirely in natural, fluent SPANISH (Español). Use warm culinary terms and food waste advice in Spanish.";
    } else if (language === "de") {
      langInstruction = "CRITICAL LANGUAGE MANDATE: You MUST reply entirely in natural, fluent GERMAN (Deutsch). Use friendly culinary terms and food waste advice in German.";
    } else if (language === "ar") {
      langInstruction = "CRITICAL LANGUAGE MANDATE: You MUST reply entirely in clear STANDARD ARABIC (العربية الفصحى) using Arabic script. Keep the tone warm and helpful.";
    } else if (language === "it") {
      langInstruction = "CRITICAL LANGUAGE MANDATE: You MUST reply entirely in natural, fluent ITALIAN (Italiano). Use friendly culinary terms and food waste advice in Italian.";
    } else if (language === "pt") {
      langInstruction = "CRITICAL LANGUAGE MANDATE: You MUST reply entirely in natural, fluent PORTUGUESE (Português). Use friendly culinary terms and food waste advice in Portuguese.";
    } else if (language === "ja") {
      langInstruction = "CRITICAL LANGUAGE MANDATE: You MUST reply entirely in natural, polite JAPANESE (日本語). Keep the tone warm, helpful, and friendly.";
    }

    const systemInstruction = `You are ColdScan AI, a friendly, concise, and smart food waste reduction assistant.
The user is asking a question about their refrigerator contents or cooking strategy.
Current Fridge Inventory: [${inventorySummary}]
${langInstruction}

Focus on answering user questions like:
- "What can I cook with what I have?"
- "What should I use first?"
- "What do I need to buy?"

Provide:
1. A clear, encouraging, friendly direct conversational text answer (2-4 sentences).
2. Actionable bullet points or recommended recipes / items to use immediately.`;

    const response = await ai.models.generateContent({
      model: "gemini-3.6-flash",
      contents: message,
      config: {
        systemInstruction,
      },
    });

    res.json({
      success: true,
      reply: response.text || "I'm here to help you reduce food waste and cook great meals!",
    });
  } catch (error: any) {
    console.error("Error in /api/ai-chat:", error);
    res.status(500).json({ error: error?.message || "Failed to communicate with AI Assistant" });
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
  const pathname = request.url;
  if (pathname === "/live") {
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit("connection", ws, request);
    });
  }
});

wss.on("connection", async (clientWs) => {
  console.log("Client connected to Gemini Live websocket");
  try {
    const session = await ai.live.connect({
      model: "gemini-3.1-flash-live-preview",
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: { prebuiltVoiceConfig: { voiceName: "Zephyr" } },
        },
        systemInstruction:
          "You are ColdScan, a live camera and voice assistant for refrigerator inspection and food waste reduction. You fluently support world languages including English, French (Français), Moroccan Darija (الدارجة المغربية), Spanish (Español), German (Deutsch), Standard Arabic (العربية), Italian (Italiano), Portuguese (Português), and Japanese (日本語). Always respond naturally in the exact language spoken by the user. Help the user identify food items, inspect freshness, suggest recipes, and remind them of missing grocery items.",
      },
      callbacks: {
        onmessage: (message: LiveServerMessage) => {
          const audio = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
          if (audio) {
            clientWs.send(JSON.stringify({ type: "audio", audio }));
          }
          if (message.serverContent?.interrupted) {
            clientWs.send(JSON.stringify({ type: "interrupted" }));
          }
        },
      },
    });

    clientWs.on("message", (data) => {
      try {
        const parsed = JSON.parse(data.toString());
        if (parsed.audio) {
          session.sendRealtimeInput({
            audio: { data: parsed.audio, mimeType: "audio/pcm;rate=16000" },
          });
        }
        if (parsed.video) {
          session.sendRealtimeInput({
            video: { data: parsed.video, mimeType: "image/jpeg" },
          });
        }
        if (parsed.text) {
          session.sendRealtimeInput({
            text: parsed.text,
          });
        }
      } catch (err) {
        console.error("Error sending realtime input to Gemini Live session:", err);
      }
    });

    clientWs.on("close", () => {
      console.log("Client disconnected from Gemini Live websocket");
      try {
        session.close();
      } catch (e) {}
    });
  } catch (error) {
    console.error("Failed to connect to Gemini Live session:", error);
    clientWs.send(JSON.stringify({ type: "error", error: "Could not start Live AI session" }));
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
