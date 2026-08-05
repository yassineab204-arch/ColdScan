/**
 * Gemini Live Client
 * Real-time Bidirectional Audio & Video Client for Gemini Live API
 * Handles 16kHz PCM mic capture, 24kHz PCM low-latency audio playback,
 * live transcription, interruption handling, and visualizer waveform metrics.
 *
 * DEPLOYMENT NOTE (Vercel):
 * This client connects DIRECTLY to the Gemini Live API over Google's own
 * WebSocket, authenticated with a single-use ephemeral token minted by
 * `/api/live-token`. The previous AI Studio build proxied audio through a
 * self-hosted `ws://.../live` endpoint, which cannot work on Vercel because
 * serverless functions are short-lived and cannot hold a WebSocket open — that
 * is the "WebSocket error" seen after deploying. GEMINI_API_KEY still never
 * reaches the browser: the token carries a locked session config instead.
 */

import type { Session } from '@google/genai';

export interface GeminiLiveClientOptions {
  language?: string;
  voiceName?: string;
  inventory?: any[];
  recipe?: any;
  onSessionReady?: () => void;
  onUserTranscript?: (text: string) => void;
  onModelTranscript?: (text: string) => void;
  onModelSpeakingChange?: (isSpeaking: boolean) => void;
  onInterrupted?: () => void;
  onAudioLevel?: (userLevel: number, modelLevel: number) => void;
  onError?: (error: string) => void;
  onClose?: () => void;
}

export class GeminiLiveClient {
  private session: Session | null = null;
  private options: GeminiLiveClientOptions;

  // Audio Input (16kHz PCM capture)
  private inputAudioContext: AudioContext | null = null;
  private micStream: MediaStream | null = null;
  private inputSource: MediaStreamAudioSourceNode | null = null;
  private inputProcessor: ScriptProcessorNode | null = null;
  private inputAnalyser: AnalyserNode | null = null;

  // Audio Output (24kHz PCM playback)
  private outputAudioContext: AudioContext | null = null;
  private outputAnalyser: AnalyserNode | null = null;
  private activeAudioSources: AudioBufferSourceNode[] = [];
  private nextStartTime = 0;
  private isModelSpeaking = false;
  private playbackCheckInterval: number | null = null;

  // Level monitoring
  private animFrameId: number | null = null;
  private isConnected = false;
  private isMuted = false;
  private isClosing = false;

  constructor(options: GeminiLiveClientOptions) {
    this.options = options;
  }

  public async connect(): Promise<void> {
    this.isClosing = false;

    try {
      // 1. Ask our own server for a short-lived token. The fridge inventory and
      //    active recipe are baked into the token's locked system instruction.
      const tokenRes = await fetch('/api/live-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          inventory: this.options.inventory || [],
          recipe: this.options.recipe || null,
          voiceName: this.options.voiceName || 'Zephyr',
        }),
      });

      if (!tokenRes.ok) {
        const detail = await tokenRes.json().catch(() => ({} as any));
        throw new Error(detail?.error || `Could not start live session (${tokenRes.status})`);
      }

      const { token, model } = await tokenRes.json();
      if (!token) throw new Error('Live session token missing from server response');

      // 2. Load the SDK lazily so it stays out of the initial bundle.
      const { GoogleGenAI, Modality } = await import('@google/genai');

      // Ephemeral tokens are supported on v1alpha only.
      const ai = new GoogleGenAI({
        apiKey: token,
        httpOptions: { apiVersion: 'v1alpha' },
      });

      this.session = await ai.live.connect({
        model: model || 'gemini-3.1-flash-live-preview',
        // The real config (voice, persona, transcription) is locked into the
        // token server-side; anything sent here would be ignored.
        config: { responseModalities: [Modality.AUDIO] },
        callbacks: {
          onopen: async () => {
            console.log('[GeminiLive] Session open, initializing mic & audio context');
            this.isConnected = true;

            await this.startAudioPipeline();
            this.options.onSessionReady?.();

            // Prompt the assistant to greet the user out loud first.
            try {
              this.session?.sendClientContent({
                turns: [
                  {
                    role: 'user',
                    parts: [
                      {
                        text: '(The user just opened the live voice session in the kitchen. Greet them out loud in one short sentence as their culinary sous-chef.)',
                      },
                    ],
                  },
                ],
                turnComplete: true,
              });
            } catch (e) {
              console.warn('[GeminiLive] Greeting send failed:', e);
            }
          },
          onmessage: (message: any) => this.handleServerMessage(message),
          onerror: (err: any) => {
            console.error('[GeminiLive] Session error:', err);
            this.options.onError?.(err?.message || 'Live session error');
          },
          onclose: (event: any) => {
            console.log('[GeminiLive] Session closed', event?.reason || '');
            this.isConnected = false;
            this.options.onClose?.();
            if (!this.isClosing) this.cleanup();
          },
        },
      });
    } catch (err: any) {
      console.error('[GeminiLive] Connect error:', err);
      this.options.onError?.(err?.message || 'Failed to connect to Live session');
      this.options.onClose?.();
    }
  }

  private async startAudioPipeline() {
    try {
      // 1. Initialize 24kHz Output Audio Context for Gemini Live Audio
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      this.outputAudioContext = new AudioCtx({ sampleRate: 24000 });
      if (this.outputAudioContext.state === 'suspended') {
        await this.outputAudioContext.resume();
      }
      this.outputAnalyser = this.outputAudioContext.createAnalyser();
      this.outputAnalyser.fftSize = 64;
      this.outputAnalyser.connect(this.outputAudioContext.destination);

      // 2. Initialize Microphone Capture
      this.micStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          sampleRate: 16000,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      this.inputAudioContext = new AudioCtx({ sampleRate: 16000 });
      if (this.inputAudioContext.state === 'suspended') {
        await this.inputAudioContext.resume();
      }

      this.inputSource = this.inputAudioContext.createMediaStreamSource(this.micStream);
      this.inputAnalyser = this.inputAudioContext.createAnalyser();
      this.inputAnalyser.fftSize = 64;
      this.inputSource.connect(this.inputAnalyser);

      // Create processor to extract 16-bit PCM chunks (bufferSize = 4096 samples = 256ms @ 16kHz)
      this.inputProcessor = this.inputAudioContext.createScriptProcessor(4096, 1, 1);
      this.inputProcessor.onaudioprocess = (e) => {
        if (this.isMuted || !this.isConnected) return;
        const inputData = e.inputBuffer.getChannelData(0);
        const pcm16Base64 = this.float32ToPcm16Base64(inputData);
        if (pcm16Base64) {
          this.sendRealtime({
            audio: { data: pcm16Base64, mimeType: 'audio/pcm;rate=16000' },
          });
        }
      };

      this.inputSource.connect(this.inputProcessor);
      this.inputProcessor.connect(this.inputAudioContext.destination);

      // Start level monitoring loop
      this.startLevelMonitoring();
    } catch (err: any) {
      console.warn('[GeminiLive] Mic access error (will operate in text mode):', err);
      this.options.onError?.(`Microphone: ${err?.message || 'Access denied'}`);
    }
  }

  private handleServerMessage(message: any) {
    const serverContent = message?.serverContent;
    if (!serverContent) return;

    // Barge-in: user started talking over the model.
    if (serverContent.interrupted) {
      this.handleInterruption();
      return;
    }

    // Audio comes back as inline PCM parts on the model turn.
    const parts = serverContent.modelTurn?.parts || [];
    for (const part of parts) {
      if (part?.inlineData?.data) {
        this.playPcm24kAudio(part.inlineData.data);
      }
      if (part?.text) {
        this.options.onModelTranscript?.(part.text);
      }
    }

    // Live transcription of what the model is saying / what the user said.
    if (serverContent.outputTranscription?.text) {
      this.options.onModelTranscript?.(serverContent.outputTranscription.text);
    }
    if (serverContent.inputTranscription?.text) {
      this.options.onUserTranscript?.(serverContent.inputTranscription.text);
    }
  }

  private playPcm24kAudio(base64Pcm: string) {
    if (!this.outputAudioContext) return;
    try {
      if (this.outputAudioContext.state === 'suspended') {
        this.outputAudioContext.resume().catch((e) => console.warn('[GeminiLive] AudioContext resume failed:', e));
      }

      const binaryString = atob(base64Pcm);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      // Guard against an odd byte count so the Int16Array view is always valid.
      const usableBytes = bytes.length - (bytes.length % 2);
      const pcm16 = new Int16Array(bytes.buffer, 0, usableBytes / 2);
      const float32 = new Float32Array(pcm16.length);
      for (let i = 0; i < pcm16.length; i++) {
        float32[i] = pcm16[i] / 32768;
      }
      if (float32.length === 0) return;

      const audioBuffer = this.outputAudioContext.createBuffer(1, float32.length, 24000);
      audioBuffer.getChannelData(0).set(float32);

      const sourceNode = this.outputAudioContext.createBufferSource();
      sourceNode.buffer = audioBuffer;

      if (this.outputAnalyser) {
        sourceNode.connect(this.outputAnalyser);
      } else {
        sourceNode.connect(this.outputAudioContext.destination);
      }

      // Schedule gapless playback
      const currentTime = this.outputAudioContext.currentTime;
      if (this.nextStartTime < currentTime) {
        this.nextStartTime = currentTime;
      }

      sourceNode.start(this.nextStartTime);
      this.nextStartTime += audioBuffer.duration;
      this.activeAudioSources.push(sourceNode);

      sourceNode.onended = () => {
        const index = this.activeAudioSources.indexOf(sourceNode);
        if (index > -1) {
          this.activeAudioSources.splice(index, 1);
        }
        if (this.activeAudioSources.length === 0 && this.outputAudioContext && this.outputAudioContext.currentTime >= this.nextStartTime) {
          this.setIsModelSpeaking(false);
        }
      };

      this.setIsModelSpeaking(true);
    } catch (e) {
      console.error('[GeminiLive] Error decoding/playing 24kHz audio chunk:', e);
    }
  }

  public handleInterruption() {
    console.log('[GeminiLive] Interruption triggered, halting model audio playback');
    // Stop all actively playing audio sources immediately
    for (const source of this.activeAudioSources) {
      try {
        source.onended = null;
        source.stop();
        source.disconnect();
      } catch (e) {}
    }
    this.activeAudioSources = [];
    if (this.outputAudioContext) {
      this.nextStartTime = this.outputAudioContext.currentTime;
    }
    this.setIsModelSpeaking(false);
    this.options.onInterrupted?.();
  }

  private setIsModelSpeaking(speaking: boolean) {
    if (this.isModelSpeaking !== speaking) {
      this.isModelSpeaking = speaking;
      this.options.onModelSpeakingChange?.(speaking);
    }
  }

  private float32ToPcm16Base64(input: Float32Array): string {
    const buffer = new ArrayBuffer(input.length * 2);
    const view = new DataView(buffer);
    for (let i = 0; i < input.length; i++) {
      const s = Math.max(-1, Math.min(1, input[i]));
      view.setInt16(i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    }
    const bytes = new Uint8Array(buffer);
    let binary = '';
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  public sendText(text: string) {
    if (!text.trim()) return;
    this.sendRealtime({ text });
  }

  public sendVideoFrame(base64Jpeg: string) {
    if (!base64Jpeg) return;
    const data = base64Jpeg.replace(/^data:image\/\w+;base64,/, '');
    this.sendRealtime({ video: { data, mimeType: 'image/jpeg' } });
  }

  public setMuted(muted: boolean) {
    this.isMuted = muted;
    // Also gate the track itself so nothing leaks while muted.
    this.micStream?.getAudioTracks().forEach((track) => (track.enabled = !muted));
  }

  private sendRealtime(payload: any) {
    if (!this.session || !this.isConnected) return;
    try {
      this.session.sendRealtimeInput(payload);
    } catch (e) {
      console.warn('[GeminiLive] Failed to send realtime input:', e);
    }
  }

  private startLevelMonitoring() {
    const userArray = new Uint8Array(32);
    const modelArray = new Uint8Array(32);

    const update = () => {
      let userLevel = 0;
      let modelLevel = 0;

      if (this.inputAnalyser && !this.isMuted) {
        this.inputAnalyser.getByteFrequencyData(userArray);
        let sum = 0;
        for (let i = 0; i < userArray.length; i++) {
          sum += userArray[i];
        }
        userLevel = Math.min(100, Math.round((sum / (userArray.length * 255)) * 100 * 2));
      }

      if (this.outputAnalyser && this.isModelSpeaking) {
        this.outputAnalyser.getByteFrequencyData(modelArray);
        let sum = 0;
        for (let i = 0; i < modelArray.length; i++) {
          sum += modelArray[i];
        }
        modelLevel = Math.min(100, Math.round((sum / (modelArray.length * 255)) * 100 * 2.5));
      }

      this.options.onAudioLevel?.(userLevel, modelLevel);
      this.animFrameId = requestAnimationFrame(update);
    };

    this.animFrameId = requestAnimationFrame(update);
  }

  public cleanup() {
    this.isClosing = true;
    this.isConnected = false;

    if (this.animFrameId) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }

    if (this.playbackCheckInterval) {
      clearInterval(this.playbackCheckInterval);
      this.playbackCheckInterval = null;
    }

    this.handleInterruption();

    if (this.inputProcessor) {
      try {
        this.inputProcessor.onaudioprocess = null;
        this.inputProcessor.disconnect();
      } catch (e) {}
      this.inputProcessor = null;
    }

    if (this.inputSource) {
      try {
        this.inputSource.disconnect();
      } catch (e) {}
      this.inputSource = null;
    }

    if (this.micStream) {
      this.micStream.getTracks().forEach((track) => track.stop());
      this.micStream = null;
    }

    if (this.inputAudioContext) {
      try {
        this.inputAudioContext.close();
      } catch (e) {}
      this.inputAudioContext = null;
    }

    if (this.outputAudioContext) {
      try {
        this.outputAudioContext.close();
      } catch (e) {}
      this.outputAudioContext = null;
    }

    if (this.session) {
      try {
        this.session.close();
      } catch (e) {}
      this.session = null;
    }

    this.setIsModelSpeaking(false);
  }
}
