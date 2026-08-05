import { Modality } from '@google/genai';
import { TTS_MODEL, TTS_TONE_PROMPTS, getGenAI } from './_lib/genai';
import { ApiRequest, ApiResponse, fail, methodGuard, readBody } from './_lib/http';

/** Wraps raw PCM (as returned by Gemini TTS) in a RIFF/WAV header for <audio>. */
function pcmToWav(pcmBase64: string, sampleRate = 24000): string {
  const pcmBuffer = Buffer.from(pcmBase64, 'base64');
  const numChannels = 1;
  const bitsPerSample = 16;
  const byteRate = sampleRate * numChannels * (bitsPerSample / 8);
  const blockAlign = numChannels * (bitsPerSample / 8);
  const dataSize = pcmBuffer.length;
  const chunkSize = 36 + dataSize;

  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(chunkSize, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16); // Subchunk1Size (16 for PCM)
  header.writeUInt16LE(1, 20); // AudioFormat (1 = PCM)
  header.writeUInt16LE(numChannels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(bitsPerSample, 34);
  header.write('data', 36);
  header.writeUInt32LE(dataSize, 40);

  return Buffer.concat([header, pcmBuffer]).toString('base64');
}

export default async function handler(req: ApiRequest, res: ApiResponse) {
  if (!methodGuard(req, res, 'POST')) return;

  try {
    const { text, voice = 'Zephyr', language = 'en' } = readBody(req);

    if (!text) {
      return res.status(400).json({ error: 'Text parameter is required' });
    }

    const promptPrefix = TTS_TONE_PROMPTS[language] || TTS_TONE_PROMPTS.en;

    const ai = getGenAI();
    const response = await ai.models.generateContent({
      model: TTS_MODEL,
      contents: [{ parts: [{ text: `${promptPrefix} ${text}` }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } },
        },
      },
    });

    const inlineData = response.candidates?.[0]?.content?.parts?.[0]?.inlineData;
    const rawData = inlineData?.data;
    const mimeType = inlineData?.mimeType || 'audio/pcm';

    if (!rawData) {
      return res.status(500).json({ error: 'No audio generated from TTS' });
    }

    let sampleRate = 24000;
    const rateMatch = mimeType.match(/rate=(\d+)/);
    if (rateMatch && rateMatch[1]) {
      sampleRate = parseInt(rateMatch[1], 10);
    }

    let wavBase64 = rawData;
    // If raw PCM without RIFF header, wrap with WAV header
    if (mimeType.includes('pcm') || !rawData.startsWith('UklGR')) {
      wavBase64 = pcmToWav(rawData, sampleRate);
    }

    return res.status(200).json({ success: true, base64Audio: wavBase64, mimeType: 'audio/wav' });
  } catch (error: any) {
    console.error('Error in /api/tts:', error);
    return fail(res, error, 'Failed to generate speech');
  }
}
