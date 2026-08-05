import React, { useState, useEffect, useRef } from 'react';
import { 
  X, 
  Mic, 
  MicOff, 
  Sparkles, 
  Send, 
  Utensils, 
  AlertTriangle, 
  ShoppingBag,
  RefreshCw,
  Radio,
  Video,
  VideoOff,
  Zap,
  Activity,
  ChefHat
} from 'lucide-react';
import { FoodItem, AppSettings, Recipe } from '../types';
import { GeminiLiveClient } from '../utils/geminiLiveClient';

interface LiveVoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  inventory: FoodItem[];
  activeRecipe?: Recipe | null;
  settings?: AppSettings;
  onUpdateSettings?: (settings: Partial<AppSettings>) => void;
  onNavigateToRecipes?: () => void;
  onNavigateToShopping?: () => void;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  timestamp: string;
  isLiveStreaming?: boolean;
}

// Natural Multilingual Prompt Starters (Darija, French, English)
const NATURAL_MULTILINGUAL_PROMPTS = [
  { label: '🇲🇦 شنو نطيب بهادشي فالتلاجة؟', icon: Utensils, query: 'شنو نقدر نطيب دابا بالخضرة والمأكولات اللي كاينين عندي فالتلاجة؟' },
  { label: '🇲🇦 شنو خاصني ناكل هو اللول؟', icon: AlertTriangle, query: 'شنو هما الحوايج فالتلاجة اللي قريب يسالي الصلاحية ديالهم وخاصني نستعملهم هما اللولين؟' },
  { label: '🇲🇦 عطيني وصفة طاجين ساهل', icon: ChefHat, query: 'عطيني فكرة طاجين مغربي بنين وساهل بهاد المقادير اللي عندي فالتلاجة' },
  { label: '🇫🇷 Que cuisiner avec mon frigo ?', icon: Utensils, query: 'Que puis-je cuisiner avec les ingrédients présents dans mon réfrigérateur ?' },
  { label: '🇫🇷 Qu\'est-ce qui expire bientôt ?', icon: AlertTriangle, query: 'Quels aliments dans mon frigo arrivent bientôt à expiration et doivent être consommés rapidement ?' },
  { label: '🇬🇧 What can I cook right now?', icon: Utensils, query: 'What can I cook with what I currently have in my fridge?' },
  { label: '🇬🇧 What groceries am I missing?', icon: ShoppingBag, query: 'Based on my fridge inventory, what essential groceries am I missing?' },
];

const INITIAL_TRILINGUAL_GREETING = 
  'أهلاً بك الشاف ! أنا المساعد الصوتي ديالك كولد سكان. تكلم معايا بحرية بالدارجة المغربية، بالفرنسية، ولا بالإنجليزية — أنا كنسمع ليك مباشرة ونجاوبك بنفس اللغة ! 🎙️✨';

export const LiveVoiceModal: React.FC<LiveVoiceModalProps> = ({
  isOpen,
  onClose,
  inventory,
  activeRecipe,
  settings,
}) => {
  const [isLiveConnected, setIsLiveConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isModelSpeaking, setIsModelSpeaking] = useState(false);
  const [isInterrupted, setIsInterrupted] = useState(false);
  const [userAudioLevel, setUserAudioLevel] = useState(0);
  const [modelAudioLevel, setModelAudioLevel] = useState(0);
  const [inputText, setInputText] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Live Camera Inspection State
  const [isCameraActive, setIsCameraActive] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const cameraStreamRef = useRef<MediaStream | null>(null);
  const cameraIntervalRef = useRef<any>(null);

  // Live voice client reference
  const liveClientRef = useRef<GeminiLiveClient | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isModelSpeaking]);

  // Connect to the voice session when modal opens
  useEffect(() => {
    if (!isOpen) {
      disconnectLiveSession();
      stopCamera();
      return;
    }

    startLiveSession();

    return () => {
      disconnectLiveSession();
      stopCamera();
    };
  }, [isOpen, activeRecipe]);

  const startLiveSession = async () => {
    disconnectLiveSession();
    setIsConnecting(true);
    setErrorMessage(null);
    setIsInterrupted(false);

    // Initial greeting message
    const initialGreeting = activeRecipe
      ? `أهلاً بك الشاف ! أنا معاك دابا باش نعاونك فوصفة "${activeRecipe.name}". تكلم معايا بالدارجة ولا بالفرنسية ولا بالإنجليزي، أنا كنسمع ليك مباشرة ! 🍲✨`
      : INITIAL_TRILINGUAL_GREETING;

    const greetingMsgId = `assistant-init-${Date.now()}`;
    setMessages([
      {
        id: greetingMsgId,
        role: 'assistant',
        text: initialGreeting,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      },
    ]);

    const client = new GeminiLiveClient({
      voiceName: settings?.voiceName || 'Zephyr',
      inventory: inventory || [],
      recipe: activeRecipe || null,
      onSessionReady: () => {
        console.log('[LiveVoiceModal] Voice session is live and active');
        setIsLiveConnected(true);
        setIsConnecting(false);
        setErrorMessage(null);
      },
      onUserTranscript: (text: string) => {
        if (!text.trim()) return;
        setMessages((prev) => {
          const lastMsg = prev[prev.length - 1];
          if (lastMsg && lastMsg.role === 'user' && lastMsg.isLiveStreaming) {
            return [
              ...prev.slice(0, -1),
              { ...lastMsg, text: `${lastMsg.text} ${text}`.trim() },
            ];
          }
          return [
            ...prev,
            {
              id: `user-${Date.now()}`,
              role: 'user',
              text: text,
              timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
              isLiveStreaming: true,
            },
          ];
        });
      },
      onModelTranscript: (text: string) => {
        if (!text.trim()) return;
        setMessages((prev) => {
          const lastMsg = prev[prev.length - 1];
          if (lastMsg && lastMsg.role === 'assistant' && lastMsg.isLiveStreaming) {
            return [
              ...prev.slice(0, -1),
              { ...lastMsg, text: `${lastMsg.text} ${text}`.trim() },
            ];
          }
          return [
            ...prev,
            {
              id: `assistant-${Date.now()}`,
              role: 'assistant',
              text: text,
              timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
              isLiveStreaming: true,
            },
          ];
        });
      },
      onModelSpeakingChange: (speaking: boolean) => {
        setIsModelSpeaking(speaking);
        if (!speaking) {
          // Finalize streaming flag on the last assistant message
          setMessages((prev) =>
            prev.map((m) => (m.role === 'assistant' ? { ...m, isLiveStreaming: false } : m))
          );
        }
      },
      onInterrupted: () => {
        setIsInterrupted(true);
        setTimeout(() => setIsInterrupted(false), 2000);
      },
      onAudioLevel: (userLvl: number, modelLvl: number) => {
        setUserAudioLevel(userLvl);
        setModelAudioLevel(modelLvl);
      },
      onError: (err: string) => {
        console.warn('[LiveVoiceModal] Voice session warning/error:', err);
        setErrorMessage(err);
        setIsConnecting(false);
      },
      onClose: () => {
        setIsLiveConnected(false);
        setIsConnecting(false);
      },
    });

    liveClientRef.current = client;
    await client.connect();
  };

  const disconnectLiveSession = () => {
    if (liveClientRef.current) {
      liveClientRef.current.cleanup();
      liveClientRef.current = null;
    }
    setIsLiveConnected(false);
    setIsConnecting(false);
    setIsModelSpeaking(false);
    setUserAudioLevel(0);
    setModelAudioLevel(0);
  };

  const handleToggleMute = () => {
    const nextMute = !isMuted;
    setIsMuted(nextMute);
    if (liveClientRef.current) {
      liveClientRef.current.setMuted(nextMute);
    }
  };

  const handleSendMessage = (textToSend?: string) => {
    const query = textToSend || inputText;
    if (!query.trim()) return;

    // Append user message locally
    setMessages((prev) => [
      ...prev,
      {
        id: `user-text-${Date.now()}`,
        role: 'user',
        text: query,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        isLiveStreaming: false,
      },
    ]);

    setInputText('');

    // Send text to the voice session
    if (liveClientRef.current) {
      liveClientRef.current.sendText(query);
    }
  };

  // Camera handling for Live Fridge Inspection
  const toggleCamera = async () => {
    if (isCameraActive) {
      stopCamera();
    } else {
      await startCamera();
    }
  };

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'environment' },
      });
      cameraStreamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
      setIsCameraActive(true);

      // Periodically capture and send frames to the voice session (1 frame every 1.5s)
      const canvas = document.createElement('canvas');
      canvas.width = 320;
      canvas.height = 240;
      const ctx = canvas.getContext('2d');

      cameraIntervalRef.current = setInterval(() => {
        if (!videoRef.current || !ctx || !liveClientRef.current) return;
        try {
          ctx.drawImage(videoRef.current, 0, 0, 320, 240);
          const dataUrl = canvas.toDataURL('image/jpeg', 0.6);
          const base64Jpeg = dataUrl.split(',')[1];
          if (base64Jpeg) {
            liveClientRef.current.sendVideoFrame(base64Jpeg);
          }
        } catch (e) {
          console.error('[LiveVoiceModal] Camera frame capture error:', e);
        }
      }, 1500);
    } catch (err) {
      console.warn('[LiveVoiceModal] Could not start live camera:', err);
    }
  };

  const stopCamera = () => {
    if (cameraIntervalRef.current) {
      clearInterval(cameraIntervalRef.current);
      cameraIntervalRef.current = null;
    }
    if (cameraStreamRef.current) {
      cameraStreamRef.current.getTracks().forEach((t) => t.stop());
      cameraStreamRef.current = null;
    }
    setIsCameraActive(false);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 text-white w-full max-w-lg h-[92vh] sm:h-[680px] rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col overflow-hidden">
        
        {/* Top Header */}
        <div className="bg-slate-950 px-4 py-3.5 flex items-center justify-between border-b border-slate-800/80">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center shadow-lg shadow-emerald-500/20">
                <Sparkles className="w-5 h-5 text-slate-950" />
              </div>
              {isLiveConnected && (
                <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-emerald-500 border-2 border-slate-950"></span>
                </span>
              )}
            </div>

            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-black text-sm uppercase tracking-wider text-white">
                  Live Voice Assistant
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                  <Activity className="w-2.5 h-2.5 animate-pulse text-emerald-400" />
                  Real-Time
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-medium">
                Moroccan Darija • Français • English (Auto-Detect)
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Live Camera Toggle */}
            <button
              onClick={toggleCamera}
              className={`p-2 rounded-xl transition-all border ${
                isCameraActive
                  ? 'bg-amber-500/20 border-amber-400 text-amber-300'
                  : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white'
              }`}
              title={isCameraActive ? 'Disable Live Camera' : 'Enable Live Camera Fridge Scan'}
            >
              {isCameraActive ? <Video className="w-4 h-4" /> : <VideoOff className="w-4 h-4" />}
            </button>

            {/* Mute Toggle */}
            <button
              onClick={handleToggleMute}
              className={`p-2 rounded-xl transition-all border ${
                isMuted
                  ? 'bg-rose-500/20 border-rose-500/40 text-rose-400'
                  : 'bg-slate-800 border-slate-700 text-emerald-400 hover:text-emerald-300'
              }`}
              title={isMuted ? 'Unmute microphone' : 'Mute microphone'}
            >
              {isMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
            </button>

            {/* Close Button */}
            <button
              onClick={onClose}
              className="p-2 rounded-xl bg-slate-800 border border-slate-700 hover:bg-slate-700 transition-colors text-slate-300"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Live Camera Viewport (If Active) */}
        {isCameraActive && (
          <div className="relative bg-black h-44 w-full border-b border-slate-800 shrink-0 overflow-hidden flex items-center justify-center">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
            />
            <div className="absolute top-2 left-2 px-2.5 py-1 rounded-lg bg-black/60 backdrop-blur-md border border-emerald-500/30 text-emerald-400 text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping"></span>
              Live Camera Feed • Inspecting Fridge
            </div>
          </div>
        )}

        {/* Real-time Status & Waveform Animation Bar */}
        <div className="bg-slate-900/90 px-4 py-2.5 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            {isConnecting ? (
              <div className="flex items-center gap-2 text-xs font-bold text-amber-400">
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                Connecting voice session...
              </div>
            ) : isInterrupted ? (
              <div className="flex items-center gap-2 text-xs font-bold text-rose-400 animate-pulse">
                <Zap className="w-3.5 h-3.5" />
                Interrupted (Listening to you)...
              </div>
            ) : isModelSpeaking ? (
              <div className="flex items-center gap-2 text-xs font-bold text-emerald-400">
                <Radio className="w-3.5 h-3.5 animate-spin text-emerald-400" />
                <span>ColdScan is speaking in real-time...</span>
              </div>
            ) : isMuted ? (
              <div className="flex items-center gap-2 text-xs font-bold text-rose-400">
                <MicOff className="w-3.5 h-3.5" />
                Microphone is muted
              </div>
            ) : (
              <div className="flex items-center gap-2 text-xs font-bold text-emerald-300">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></span>
                <span>Speak naturally in Darija, French, or English</span>
              </div>
            )}
          </div>

          {/* Dynamic Waveform Bars */}
          <div className="flex items-center gap-1 h-5 px-2">
            {[1, 2, 3, 4, 5, 6, 7, 8].map((bar) => {
              const activeLevel = isModelSpeaking ? modelAudioLevel : isMuted ? 0 : userAudioLevel;
              const scale = Math.max(0.2, (activeLevel / 100) * (bar % 2 === 0 ? 1 : 1.4));
              return (
                <span
                  key={bar}
                  className={`w-1 rounded-full transition-all duration-75 ${
                    isModelSpeaking
                      ? 'bg-gradient-to-t from-teal-500 to-emerald-300'
                      : isMuted
                      ? 'bg-slate-700'
                      : 'bg-gradient-to-t from-emerald-600 to-cyan-400'
                  }`}
                  style={{ height: `${Math.min(20, Math.max(4, 20 * scale))}px` }}
                />
              );
            })}
          </div>
        </div>

        {/* Quick Suggestion Prompts */}
        <div className="bg-slate-950/60 px-3.5 py-2 border-b border-slate-800/60 flex gap-2 overflow-x-auto scrollbar-none">
          {NATURAL_MULTILINGUAL_PROMPTS.map((item, idx) => {
            const Icon = item.icon;
            return (
              <button
                key={idx}
                onClick={() => handleSendMessage(item.query)}
                className="whitespace-nowrap px-3 py-1.5 rounded-xl bg-slate-800/80 border border-slate-700/80 text-emerald-300 hover:text-white hover:bg-slate-700 text-xs font-bold transition-all flex items-center gap-1.5 shadow-xs shrink-0"
              >
                <Icon className="w-3.5 h-3.5 text-emerald-400" />
                {item.label}
              </button>
            );
          })}
        </div>

        {/* Messages Stream */}
        <div className="flex-1 p-4 overflow-y-auto space-y-3.5 bg-slate-900/50">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex flex-col ${
                msg.role === 'user' ? 'items-end' : 'items-start'
              }`}
            >
              <div
                className={`max-w-[88%] px-4 py-3 rounded-2xl text-xs font-medium leading-relaxed ${
                  msg.role === 'user'
                    ? 'bg-emerald-600 text-white rounded-br-none shadow-md'
                    : 'bg-slate-800/90 text-slate-100 border border-slate-700/80 rounded-bl-none shadow-md'
                }`}
              >
                <p className="whitespace-pre-line text-xs font-semibold">{msg.text}</p>
              </div>
              <div className="flex items-center gap-1.5 mt-1 px-1">
                <span className="text-[9px] font-black text-slate-500 uppercase tracking-wider">{msg.timestamp}</span>
                {msg.role === 'assistant' && isModelSpeaking && msg.isLiveStreaming && (
                  <span className="flex items-center gap-1 text-[9px] font-black text-emerald-400 uppercase tracking-wider">
                    <Radio className="w-2.5 h-2.5 animate-spin" />
                    Speaking Live...
                  </span>
                )}
              </div>
            </div>
          ))}

          {isConnecting && (
            <div className="flex items-center gap-2 text-slate-400 text-xs font-bold py-2 px-3 bg-slate-800/60 rounded-2xl border border-slate-700 w-fit">
              <RefreshCw className="w-3.5 h-3.5 animate-spin text-emerald-400" />
              Initializing audio stream...
            </div>
          )}

          {errorMessage && (
            <div className="p-3 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs font-bold flex items-center justify-between gap-2">
              <span>{errorMessage}</span>
              <button
                onClick={() => startLiveSession()}
                className="px-2.5 py-1 rounded-lg bg-rose-500 text-white text-[10px] font-black uppercase"
              >
                Retry
              </button>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Bottom Input & Voice Interaction Controls */}
        <div className="p-3.5 bg-slate-950 border-t border-slate-800 space-y-2.5">
          <div className="flex items-center gap-2">
            {/* Mic Toggle Button */}
            <button
              onClick={handleToggleMute}
              className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all shrink-0 shadow-lg ${
                isMuted
                  ? 'bg-slate-800 border border-rose-500/40 text-rose-400 hover:bg-slate-700'
                  : 'bg-gradient-to-tr from-emerald-600 to-teal-500 text-slate-950 font-black hover:brightness-110 shadow-emerald-500/20 active:scale-95'
              }`}
              title={isMuted ? 'Unmute microphone' : 'Mute microphone'}
            >
              {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5 stroke-[2.5]" />}
            </button>

            {/* Text input fallback */}
            <div className="flex-1 relative flex items-center">
              <input
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                placeholder="تكلم بالصوت ولا كتب بالدارجة، français ou english..."
                className="w-full pl-4 pr-10 py-3 text-xs font-semibold bg-slate-900 border border-slate-800 rounded-2xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-white placeholder-slate-500 transition-all"
              />
              <button
                onClick={() => handleSendMessage()}
                disabled={!inputText.trim()}
                className="absolute right-1.5 p-2 rounded-xl bg-emerald-500 text-slate-950 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-emerald-400 transition-colors font-bold"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between text-[10px] text-slate-500 font-semibold px-1">
            <span>✨ Live Voice • 16kHz in / 24kHz out</span>
            <span className="text-emerald-400 font-bold">Auto-detects Darija, French & English</span>
          </div>
        </div>

      </div>
    </div>
  );
};
