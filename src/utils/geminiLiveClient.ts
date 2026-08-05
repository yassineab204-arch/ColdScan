/**
 * Gemini Live Client
 * Real-time Bidirectional Audio & Video Client for Gemini Live API
 * Handles 16kHz PCM mic capture, 24kHz PCM low-latency audio playback,
 * live transcription, interruption handling, and visualizer waveform metrics.
 */

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
  private ws: WebSocket | null = null;
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

  constructor(options: GeminiLiveClientOptions) {
    this.options = options;
  }

  public async connect(): Promise<void> {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const lang = this.options.language || 'ar-MA';
    const voice = this.options.voiceName || 'Zephyr';
    const wsUrl = `${protocol}//${window.location.host}/live?lang=${encodeURIComponent(lang)}&voice=${encodeURIComponent(voice)}`;

    try {
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = async () => {
        console.log('[GeminiLive] WebSocket connected, initializing mic & audio context');
        this.isConnected = true;
        
        // Send initial fridge inventory & recipe context
        this.send({
          type: 'init_context',
          inventory: this.options.inventory || [],
          recipe: this.options.recipe || null,
        });

        // Start Microphone & Audio systems
        await this.startAudioPipeline();
        this.options.onSessionReady?.();
      };

      this.ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          this.handleServerMessage(msg);
        } catch (e) {
          console.error('[GeminiLive] Error parsing server message:', e);
        }
      };

      this.ws.onerror = (err) => {
        console.error('[GeminiLive] WebSocket error:', err);
        this.options.onError?.('WebSocket connection error');
      };

      this.ws.onclose = () => {
        console.log('[GeminiLive] WebSocket closed');
        this.isConnected = false;
        this.options.onClose?.();
        this.cleanup();
      };
    } catch (err: any) {
      console.error('[GeminiLive] Connect error:', err);
      this.options.onError?.(err?.message || 'Failed to connect to Live session');
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
          this.send({ audio: pcm16Base64 });
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

  private handleServerMessage(msg: any) {
    if (msg.type === 'audio' && msg.audio) {
      this.playPcm24kAudio(msg.audio);
    } else if (msg.type === 'modelTranscript' && msg.text) {
      this.options.onModelTranscript?.(msg.text);
    } else if (msg.type === 'userTranscript' && msg.text) {
      this.options.onUserTranscript?.(msg.text);
    } else if (msg.type === 'interrupted') {
      this.handleInterruption();
    } else if (msg.type === 'turnComplete') {
      // Model finished output turn
    } else if (msg.type === 'error') {
      this.options.onError?.(msg.error);
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

      const pcm16 = new Int16Array(bytes.buffer);
      const float32 = new Float32Array(pcm16.length);
      for (let i = 0; i < pcm16.length; i++) {
        float32[i] = pcm16[i] / 32768;
      }

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
    this.send({ text });
  }

  public sendVideoFrame(base64Jpeg: string) {
    if (!base64Jpeg) return;
    this.send({ video: base64Jpeg });
  }

  public setMuted(muted: boolean) {
    this.isMuted = muted;
  }

  private send(data: any) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
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

    if (this.ws) {
      try {
        this.ws.close();
      } catch (e) {}
      this.ws = null;
    }

    this.isConnected = false;
    this.setIsModelSpeaking(false);
  }
}
