import { GoogleGenAI } from '@google/genai';

/**
 * Server-side Gemini client. The API key stays on the server: on Vercel it comes
 * from the project's environment variables, never from the browser bundle.
 */
export function getGenAI(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error(
      'GEMINI_API_KEY is not configured. Set it in Vercel > Settings > Environment Variables.'
    );
  }
  return new GoogleGenAI({ apiKey });
}

export const TEXT_MODEL = 'gemini-3.6-flash';
export const TTS_MODEL = 'gemini-3.1-flash-tts-preview';

const LANGUAGE_NAMES: Record<string, string> = {
  fr: 'FRENCH (Français)',
  'ar-MA': 'MOROCCAN DARIJA (الدارجة المغربية) using Arabic script',
  es: 'SPANISH (Español)',
  de: 'GERMAN (Deutsch)',
  ar: 'STANDARD ARABIC (العربية الفصحى)',
  it: 'ITALIAN (Italiano)',
  pt: 'PORTUGUESE (Português)',
  ja: 'JAPANESE (日本語)',
};

/**
 * Builds the per-endpoint output-language mandate. `subject` names what must be
 * translated, e.g. "all food item names, summaryNotes, and suggestedAction".
 */
export function languageMandate(language: string, subject: string): string {
  const name = LANGUAGE_NAMES[language];
  if (!name) return `Output ${subject} in English.`;
  return `CRITICAL LANGUAGE MANDATE: Output ${subject} in ${name}.`;
}

export const TTS_TONE_PROMPTS: Record<string, string> = {
  en: 'Say in a warm, helpful food-assistant tone:',
  fr: 'Say in clear, natural French with a warm food-assistant tone:',
  'ar-MA': 'Say in clear, natural Moroccan Darija (Arabic) with a warm food-assistant tone:',
  es: 'Say in clear, natural Spanish with a warm food-assistant tone:',
  de: 'Say in clear, natural German with a warm food-assistant tone:',
  ar: 'Say in clear, natural Standard Arabic with a warm food-assistant tone:',
  it: 'Say in clear, natural Italian with a warm food-assistant tone:',
  pt: 'Say in clear, natural Portuguese with a warm food-assistant tone:',
  ja: 'Say in clear, natural Japanese with a warm food-assistant tone:',
};
