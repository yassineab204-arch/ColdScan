import { LanguageType } from '../types';

export interface SpeechProgress {
  fraction: number; // 0 to 1
  charIndex: number; // characters revealed so far
  wordIndex: number; // 0-based active word index
  revealedText: string;
  activeWord: string;
  isComplete: boolean;
}

export interface SpeechSyncOptions {
  text: string;
  language?: LanguageType;
  voice?: string;
  audioEnabled?: boolean;
  onStart?: () => void;
  onProgress?: (progress: SpeechProgress) => void;
  onEnd?: () => void;
  onError?: (err: any) => void;
}

export interface SpeechController {
  cancel: () => void;
  isCancelled: boolean;
}

const SPEECH_LANG_MAP: Record<LanguageType, string> = {
  en: 'en-US',
  fr: 'fr-FR',
  'ar-MA': 'ar-SA',
  es: 'es-ES',
  de: 'de-DE',
  ar: 'ar-SA',
  it: 'it-IT',
  pt: 'pt-PT',
  ja: 'ja-JP',
};

// Clean text for speech processing
export function cleanSpokenText(text: string): string {
  return text
    .replace(/[*_#`~>]/g, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Plays spoken audio (via Gemini TTS or SpeechSynthesis fallback) and continuously
 * emits synchronized character & word progress so UI text writes in exact sync with voice!
 */
export function playSynchronizedSpeech(options: SpeechSyncOptions): SpeechController {
  const {
    text,
    language = 'en',
    voice = 'Zephyr',
    audioEnabled = true,
    onStart,
    onProgress,
    onEnd,
    onError,
  } = options;

  let isCancelled = false;
  let audioElement: HTMLAudioElement | null = null;
  let rafId: number | null = null;
  let intervalId: any = null;

  const controller: SpeechController = {
    cancel: () => {
      isCancelled = true;
      if (audioElement) {
        audioElement.pause();
        audioElement.src = '';
        audioElement = null;
      }
      if ('speechSynthesis' in window) {
        try {
          window.speechSynthesis.cancel();
        } catch {}
      }
      if (rafId) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
      if (intervalId) {
        clearInterval(intervalId);
        intervalId = null;
      }
    },
    get isCancelled() {
      return isCancelled;
    }
  };

  const cleanText = cleanSpokenText(text);
  if (!cleanText) {
    onEnd?.();
    return controller;
  }

  const words = cleanText.split(/\s+/).filter(Boolean);
  const totalLength = cleanText.length;

  const emitProgress = (fraction: number) => {
    if (isCancelled) return;
    const clampedFraction = Math.max(0, Math.min(1, fraction));
    const charIndex = Math.min(totalLength, Math.floor(clampedFraction * totalLength));
    const wordIndex = Math.min(words.length - 1, Math.max(0, Math.floor(clampedFraction * words.length)));
    const revealedText = cleanText.slice(0, charIndex);
    const activeWord = words[wordIndex] || '';
    const isComplete = clampedFraction >= 1;

    onProgress?.({
      fraction: clampedFraction,
      charIndex,
      wordIndex,
      revealedText,
      activeWord,
      isComplete,
    });
  };

  // If audio is disabled, simulate a pleasant typewriter writing effect
  if (!audioEnabled) {
    onStart?.();
    const durationMs = Math.min(2500, Math.max(800, words.length * 90));
    const startTime = performance.now();

    const animateTypewriter = () => {
      if (isCancelled) return;
      const elapsed = performance.now() - startTime;
      const progress = elapsed / durationMs;

      if (progress >= 1) {
        emitProgress(1);
        onEnd?.();
      } else {
        emitProgress(progress);
        rafId = requestAnimationFrame(animateTypewriter);
      }
    };

    rafId = requestAnimationFrame(animateTypewriter);
    return controller;
  }

  // Web Speech Synthesis Fallback function
  const runSpeechSynthesisFallback = () => {
    if (isCancelled) return;

    if (!('speechSynthesis' in window)) {
      // If no speech synthesis in browser, do typewriter animation
      const durationMs = Math.min(3000, Math.max(1000, words.length * 120));
      const startTime = performance.now();
      const step = () => {
        if (isCancelled) return;
        const p = (performance.now() - startTime) / durationMs;
        if (p >= 1) {
          emitProgress(1);
          onEnd?.();
        } else {
          emitProgress(p);
          rafId = requestAnimationFrame(step);
        }
      };
      rafId = requestAnimationFrame(step);
      return;
    }

    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(cleanText);
      utterance.lang = SPEECH_LANG_MAP[language] || 'en-US';
      utterance.rate = 1.0;

      onStart?.();
      const startTime = performance.now();
      // Estimated duration: ~3.2 words per second
      const estDurationMs = Math.max(1200, (words.length / 3.2) * 1000);

      utterance.onboundary = (event: any) => {
        if (isCancelled) return;
        if (event.charIndex !== undefined) {
          const charIdx = event.charIndex + (event.charLength || 0);
          const fraction = charIdx / Math.max(1, totalLength);
          emitProgress(fraction);
        }
      };

      intervalId = setInterval(() => {
        if (isCancelled) return;
        const elapsed = performance.now() - startTime;
        const estimatedFraction = Math.min(0.95, elapsed / estDurationMs);
        emitProgress(estimatedFraction);
      }, 50);

      utterance.onend = () => {
        if (intervalId) clearInterval(intervalId);
        if (isCancelled) return;
        emitProgress(1);
        onEnd?.();
      };

      utterance.onerror = (e) => {
        if (intervalId) clearInterval(intervalId);
        if (isCancelled) return;
        emitProgress(1);
        onEnd?.();
      };

      window.speechSynthesis.speak(utterance);
    } catch (err) {
      if (intervalId) clearInterval(intervalId);
      emitProgress(1);
      onEnd?.();
    }
  };

  // Primary Pathway: Gemini TTS Audio with timeupdate synchronization
  (async () => {
    try {
      onStart?.();
      // Initially show the first character or start at 0
      emitProgress(0.02);

      const res = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: cleanText,
          voice,
          language,
        }),
      });

      if (isCancelled) return;

      if (!res.ok) {
        runSpeechSynthesisFallback();
        return;
      }

      const data = await res.json();
      if (isCancelled) return;

      if (!data.base64Audio) {
        runSpeechSynthesisFallback();
        return;
      }

      const mime = data.mimeType || 'audio/wav';
      audioElement = new Audio(`data:${mime};base64,${data.base64Audio}`);

      const trackAudioProgress = () => {
        if (isCancelled || !audioElement) return;

        if (!audioElement.paused && !audioElement.ended && audioElement.duration > 0) {
          const fraction = audioElement.currentTime / audioElement.duration;
          emitProgress(fraction);
          rafId = requestAnimationFrame(trackAudioProgress);
        }
      };

      audioElement.onplay = () => {
        if (isCancelled) return;
        rafId = requestAnimationFrame(trackAudioProgress);
      };

      audioElement.ontimeupdate = () => {
        if (isCancelled || !audioElement) return;
        if (audioElement.duration > 0) {
          const fraction = audioElement.currentTime / audioElement.duration;
          emitProgress(fraction);
        }
      };

      audioElement.onended = () => {
        if (rafId) cancelAnimationFrame(rafId);
        if (isCancelled) return;
        emitProgress(1);
        onEnd?.();
      };

      audioElement.onerror = () => {
        if (rafId) cancelAnimationFrame(rafId);
        if (!isCancelled) {
          runSpeechSynthesisFallback();
        }
      };

      await audioElement.play().catch((err) => {
        if (!isCancelled) {
          runSpeechSynthesisFallback();
        }
      });
    } catch (err) {
      if (!isCancelled) {
        runSpeechSynthesisFallback();
      }
    }
  })();

  return controller;
}
