import React, { useState, useEffect, useRef } from 'react';
import { 
  X, 
  Mic, 
  MicOff, 
  Volume2, 
  VolumeX, 
  Send, 
  ChefHat, 
  Clock, 
  Sparkles, 
  ChevronRight, 
  ChevronLeft, 
  RotateCcw, 
  Play, 
  Pause, 
  CheckCircle2, 
  AlertCircle,
  HelpCircle,
  Flame,
  Utensils,
  Radio
} from 'lucide-react';
import { Recipe, FoodItem, LanguageType, AppSettings } from '../types';
import { t, getLocalizedRecipeName, getLocalizedRecipeInstructions } from '../utils/i18n';
import { playSynchronizedSpeech, SpeechController } from '../utils/speechSync';
import { SynchronizedSpeechText } from './SynchronizedSpeechText';
import { apiFetch } from '../utils/api';

interface RecipeVoiceBotModalProps {
  isOpen: boolean;
  onClose: () => void;
  recipes: Recipe[];
  activeRecipe: Recipe | null;
  onSelectRecipe?: (recipe: Recipe) => void;
  inventory: FoodItem[];
  settings?: AppSettings;
  onOpenCookWizard?: (recipe: Recipe) => void;
}

interface ActiveTimer {
  id: string;
  label: string;
  totalSeconds: number;
  remainingSeconds: number;
  isRunning: boolean;
}

interface BotMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  text: string;
  timestamp: string;
  actionInfo?: string;
  revealedText?: string;
  wordIndex?: number;
  isStreaming?: boolean;
  isComplete?: boolean;
}

export const RecipeVoiceBotModal: React.FC<RecipeVoiceBotModalProps> = ({
  isOpen,
  onClose,
  recipes,
  activeRecipe,
  onSelectRecipe,
  inventory,
  settings,
  onOpenCookWizard,
}) => {
  const currentLang = (settings?.language || 'en') as LanguageType;
  const [activeConversationLang, setActiveConversationLang] = useState<LanguageType>(currentLang);
  
  // Conversation state
  const [messages, setMessages] = useState<BotMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [activeSpeakingMsgId, setActiveSpeakingMsgId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [audioEnabled, setAudioEnabled] = useState(true);

  // Active Cooking State inside the Bot
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [activeTimer, setActiveTimer] = useState<ActiveTimer | null>(null);
  const [suggestedPrompts, setSuggestedPrompts] = useState<string[]>([
    "What can I cook with my expiring food?",
    "Next step",
    "Set a 5 minute timer",
    "What can I substitute for butter?"
  ]);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);
  const timerIntervalRef = useRef<any>(null);
  const activeSpeechControllerRef = useRef<SpeechController | null>(null);

  // Sync active language when settings change
  useEffect(() => {
    if (settings?.language) {
      setActiveConversationLang(settings.language);
    }
  }, [settings?.language]);

  // Auto-scroll to bottom of conversation
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading, isSpeaking]);

  // Clean up audio speech when modal closes
  useEffect(() => {
    if (!isOpen) {
      if (activeSpeechControllerRef.current) {
        activeSpeechControllerRef.current.cancel();
        activeSpeechControllerRef.current = null;
      }
      setIsSpeaking(false);
      setIsListening(false);
      setActiveSpeakingMsgId(null);
    }
  }, [isOpen]);

  // Sync active recipe and reset step index when activeRecipe changes
  useEffect(() => {
    if (activeRecipe) {
      setCurrentStepIndex(0);
    }
  }, [activeRecipe?.id]);

  // Synchronized speech player function: synchronizes voice audio with live written text and active word highlighting
  const speakResponseWithSync = (textToSpeak: string, targetMsgId: string, targetLanguage?: LanguageType) => {
    if (activeSpeechControllerRef.current) {
      activeSpeechControllerRef.current.cancel();
      activeSpeechControllerRef.current = null;
    }

    setIsSpeaking(true);
    setActiveSpeakingMsgId(targetMsgId);

    // Initialize the target message state for live streaming
    setMessages((prev) =>
      prev.map((m) =>
        m.id === targetMsgId
          ? { ...m, isStreaming: true, isComplete: false, revealedText: '', wordIndex: 0 }
          : { ...m, isStreaming: false, isComplete: true, revealedText: m.text }
      )
    );

    const langToUse = targetLanguage || activeConversationLang || currentLang;

    activeSpeechControllerRef.current = playSynchronizedSpeech({
      text: textToSpeak,
      language: langToUse,
      voice: settings?.voiceName || 'Zephyr',
      audioEnabled,
      onStart: () => {
        setIsSpeaking(true);
        setActiveSpeakingMsgId(targetMsgId);
      },
      onProgress: (progress) => {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === targetMsgId
              ? {
                  ...m,
                  revealedText: progress.revealedText,
                  wordIndex: progress.wordIndex,
                  isComplete: progress.isComplete,
                }
              : m
          )
        );
      },
      onEnd: () => {
        setIsSpeaking(false);
        setActiveSpeakingMsgId(null);
        setMessages((prev) =>
          prev.map((m) =>
            m.id === targetMsgId
              ? { ...m, isStreaming: false, isComplete: true, revealedText: m.text }
              : m
          )
        );
        activeSpeechControllerRef.current = null;
      },
      onError: () => {
        setIsSpeaking(false);
        setActiveSpeakingMsgId(null);
        setMessages((prev) =>
          prev.map((m) =>
            m.id === targetMsgId
              ? { ...m, isStreaming: false, isComplete: true, revealedText: m.text }
              : m
          )
        );
        activeSpeechControllerRef.current = null;
      },
    });
  };

  // Initial welcome greeting
  useEffect(() => {
    if (isOpen && messages.length === 0) {
      const effectiveLang = activeConversationLang || currentLang;
      let welcome = "";
      if (activeRecipe) {
        const localizedName = getLocalizedRecipeName(activeRecipe.name, effectiveLang);
        welcome = effectiveLang === 'fr' 
          ? `Bonjour Chef ! Je suis votre Sous-Chef vocal pour la recette "${localizedName}". Je vais vous guider étape par étape. Dites "Étape suivante", "Minuteur", ou posez-moi n'importe quelle question !`
          : effectiveLang === 'ar-MA'
          ? `أهلاً بك الشاف ! أنا المساعد الصوتي ديالك للطياب لهاد الوصفة "${localizedName}". نقدر نوجهك خطوة بخطوة، نقولك شنو دير، ولا نحدد ليك الوقت. سولني بالصوت فاي وقت !`
          : `Hello Chef! I'm your Sous-Chef Voice Guide for "${localizedName}". I'll guide you through every step hands-free. Say "Next step", "Set a timer", or ask any cooking question!`;
      } else {
        welcome = effectiveLang === 'fr'
          ? "Bonjour Chef ! Je suis votre assistant culinaire vocal. Dites-moi ce que vous voulez cuisiner ou demandez-moi de vous guider à travers une recette !"
          : effectiveLang === 'ar-MA'
          ? "أهلاً بك الشاف ! أنا المساعد الصوتي للوصفات. قوليا شنو بغيتي تطيب ولا اختار شي وصفة ونعاونك فيها خطوة بخطوة !"
          : "Hello Chef! I'm your Sous-Chef Voice Guide. Ask me what to cook from your fridge, or pick a recipe to be guided step-by-step hands-free!";
      }

      const welcomeId = `welcome-${Date.now()}`;
      setMessages([
        {
          id: welcomeId,
          role: 'assistant',
          text: welcome,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          revealedText: '',
          wordIndex: 0,
          isStreaming: true,
          isComplete: false,
        }
      ]);

      speakResponseWithSync(welcome, welcomeId, effectiveLang);
    }
  }, [isOpen, activeRecipe?.id, activeConversationLang]);

  // Kitchen Timer countdown engine
  useEffect(() => {
    if (activeTimer && activeTimer.isRunning) {
      timerIntervalRef.current = setInterval(() => {
        setActiveTimer((prev) => {
          if (!prev || !prev.isRunning) return prev;
          if (prev.remainingSeconds <= 1) {
            clearInterval(timerIntervalRef.current);
            playTimerAlarm();
            const alertMsg = currentLang === 'fr' 
              ? `⏱️ Le minuteur "${prev.label}" est terminé !`
              : currentLang === 'ar-MA'
              ? `⏱️ الوقت ديال "${prev.label}" سالا !`
              : `⏱️ Timer for "${prev.label}" is up!`;
            
            const timerMsgId = `timer-done-${Date.now()}`;
            setMessages((m) => [
              ...m,
              {
                id: timerMsgId,
                role: 'system',
                text: alertMsg,
                timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                isComplete: true,
              }
            ]);

            speakResponseWithSync(alertMsg, timerMsgId);
            return { ...prev, remainingSeconds: 0, isRunning: false };
          }
          return { ...prev, remainingSeconds: prev.remainingSeconds - 1 };
        });
      }, 1000);
    } else {
      clearInterval(timerIntervalRef.current);
    }

    return () => clearInterval(timerIntervalRef.current);
  }, [activeTimer?.isRunning, currentLang, audioEnabled]);

  // Beep alarm synthesizer
  const playTimerAlarm = () => {
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) return;
      const ctx = new AudioContextClass();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      osc.frequency.setValueAtTime(587.33, ctx.currentTime + 0.2);
      osc.frequency.setValueAtTime(880, ctx.currentTime + 0.4);
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.8);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.8);
    } catch {
      // Audio context might be restricted
    }
  };

  // Speech-to-Text setup
  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;

      const langCodes: Record<LanguageType, string> = {
        en: 'en-US',
        fr: 'fr-FR',
        'ar-MA': 'ar-MA',
        es: 'es-ES',
        de: 'de-DE',
        ar: 'ar-SA',
        it: 'it-IT',
        pt: 'pt-PT',
        ja: 'ja-JP',
      };
      recognition.lang = langCodes[activeConversationLang || currentLang] || 'en-US';

      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setIsListening(false);
        if (transcript.trim()) {
          handleSendMessage(transcript);
        }
      };

      recognition.onerror = () => {
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
    }

    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch {}
      }
    };
  }, [activeConversationLang, currentLang]);

  const toggleListening = () => {
    if (isListening) {
      try {
        recognitionRef.current?.stop();
      } catch {}
      setIsListening(false);
    } else {
      if (isSpeaking) {
        if (activeSpeechControllerRef.current) {
          activeSpeechControllerRef.current.cancel();
          activeSpeechControllerRef.current = null;
        }
        setIsSpeaking(false);
        setActiveSpeakingMsgId(null);
      }
      try {
        recognitionRef.current?.start();
        setIsListening(true);
      } catch {
        setIsListening(false);
      }
    }
  };

  // Send message to the Sous-Chef backend
  const handleSendMessage = async (queryText: string) => {
    if (!queryText.trim()) return;

    if (activeSpeechControllerRef.current) {
      activeSpeechControllerRef.current.cancel();
      activeSpeechControllerRef.current = null;
      setIsSpeaking(false);
      setActiveSpeakingMsgId(null);
    }

    const userMsg: BotMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      text: queryText,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      isComplete: true,
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputText('');
    setIsLoading(true);

    try {
      const res = await apiFetch('/api/recipe-voice-bot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: queryText,
          activeRecipe,
          recipes,
          currentStep: currentStepIndex,
          inventory,
          language: activeConversationLang || currentLang,
        }),
      });

      const data = await res.json();
      if (data.success) {
        const replyText = data.reply;
        const detectedLang = (data.detectedLanguage as LanguageType) || activeConversationLang || currentLang;
        
        // Auto-switch active conversation language to the detected language (English, French, Darija, etc.)
        if (detectedLang && detectedLang !== activeConversationLang) {
          setActiveConversationLang(detectedLang);
        }

        let actionNote = '';

        // Handle action commands returned by the assistant
        if (data.action?.type === 'NEXT_STEP') {
          if (activeRecipe) {
            const nextIdx = Math.min((activeRecipe.instructions?.length || 1) - 1, currentStepIndex + 1);
            setCurrentStepIndex(nextIdx);
            actionNote = detectedLang === 'fr' 
              ? `➡️ Passé à l'Étape ${nextIdx + 1}`
              : detectedLang === 'ar-MA'
              ? `➡️ دزنا للخطوة ${nextIdx + 1}`
              : `➡️ Advanced to Step ${nextIdx + 1}`;
          }
        } else if (data.action?.type === 'PREV_STEP') {
          if (activeRecipe) {
            const prevIdx = Math.max(0, currentStepIndex - 1);
            setCurrentStepIndex(prevIdx);
            actionNote = detectedLang === 'fr'
              ? `⬅️ Retour à l'Étape ${prevIdx + 1}`
              : detectedLang === 'ar-MA'
              ? `⬅️ رجعنا للخطوة ${prevIdx + 1}`
              : `⬅️ Returned to Step ${prevIdx + 1}`;
          }
        } else if (data.action?.type === 'GOTO_STEP') {
          if (typeof data.action.stepTarget === 'number') {
            setCurrentStepIndex(data.action.stepTarget);
            actionNote = detectedLang === 'fr'
              ? `📍 Étape ${data.action.stepTarget + 1}`
              : detectedLang === 'ar-MA'
              ? `📍 مشينا للخطوة ${data.action.stepTarget + 1}`
              : `📍 Jumped to Step ${data.action.stepTarget + 1}`;
          }
        } else if (data.action?.type === 'SET_TIMER') {
          const seconds = data.action.timerSeconds || 300;
          const label = data.action.timerLabel || (activeRecipe ? `${activeRecipe.name} Step ${currentStepIndex + 1}` : 'Cooking Timer');
          setActiveTimer({
            id: `timer-${Date.now()}`,
            label,
            totalSeconds: seconds,
            remainingSeconds: seconds,
            isRunning: true,
          });
          const mins = Math.floor(seconds / 60);
          actionNote = `⏱️ Started timer: ${mins} min (${label})`;
        } else if (data.action?.type === 'SELECT_RECIPE') {
          const matched = recipes.find(r => r.name.toLowerCase().includes((data.action.recipeName || '').toLowerCase()));
          if (matched && onSelectRecipe) {
            onSelectRecipe(matched);
            actionNote = `🍳 Selected "${matched.name}"`;
          }
        }

        const chefMsgId = `chef-${Date.now()}`;
        setMessages((prev) => [
          ...prev,
          {
            id: chefMsgId,
            role: 'assistant',
            text: replyText,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            actionInfo: actionNote,
            revealedText: '',
            wordIndex: 0,
            isStreaming: true,
            isComplete: false,
          }
        ]);

        if (data.suggestedPrompts?.length) {
          setSuggestedPrompts(data.suggestedPrompts);
        }

        speakResponseWithSync(replyText, chefMsgId, detectedLang);
      } else {
        throw new Error(data.error || 'Failed to get chef guidance');
      }
    } catch (err: any) {
      console.error('Error with Recipe Voice Bot:', err);
      const effectiveLang = activeConversationLang || currentLang;
      const errorMsg = effectiveLang === 'fr'
        ? "Désolé Chef, j'ai rencontré une petite erreur de connexion. Pouvez-vous répéter ?"
        : effectiveLang === 'ar-MA'
        ? "سمحلي الشاف، وقع مشكل فالاتصال. واش تقدر تعاود ليا السؤال ؟"
        : "Sorry Chef, I had a brief connection issue. Could you repeat that?";

      const errorMsgId = `error-${Date.now()}`;
      setMessages((prev) => [
        ...prev,
        {
          id: errorMsgId,
          role: 'assistant',
          text: errorMsg,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          isComplete: true,
        }
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  // Helper format seconds into MM:SS
  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  if (!isOpen) return null;

  const currentInstructions = activeRecipe ? getLocalizedRecipeInstructions(activeRecipe, activeConversationLang || currentLang) : [];
  const currentStepText = currentInstructions[currentStepIndex] || (activeRecipe?.instructions?.[currentStepIndex] || '');
  const totalSteps = currentInstructions.length || activeRecipe?.instructions?.length || 0;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-md h-[92vh] sm:h-[680px] rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col overflow-hidden border border-slate-800/20">
        
        {/* Header */}
        <div className="bg-slate-950 text-white p-4 flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-2xl flex items-center justify-center border transition-all duration-300 ${
              isSpeaking
                ? 'bg-emerald-500/30 border-emerald-400 text-emerald-300 ring-2 ring-emerald-500/40 shadow-lg shadow-emerald-500/20'
                : 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400'
            }`}>
              <ChefHat className={`w-5 h-5 ${isSpeaking ? 'animate-bounce' : ''}`} />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h2 className="font-black text-sm uppercase tracking-wider text-white">
                  Sous-Chef Voice
                </h2>
                <span className={`px-1.5 py-0.5 rounded-sm font-mono text-[9px] font-black uppercase tracking-wider border flex items-center gap-1 transition-all ${
                  isSpeaking 
                    ? 'bg-emerald-500 text-slate-950 border-emerald-400 shadow-sm shadow-emerald-500/50' 
                    : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                }`}>
                  <Radio className={`w-2.5 h-2.5 ${isSpeaking ? 'text-slate-950 animate-spin' : 'text-emerald-400 animate-pulse'}`} />
                  {isSpeaking ? 'TALKING SYNC' : 'SYNC READY'}
                </span>
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-[10px] text-emerald-400 font-bold bg-emerald-950/80 px-1.5 py-0.2 rounded border border-emerald-800/60 flex items-center gap-1">
                  🌐 Darija • Français • English (Auto)
                </span>
                <span className="text-[10px] text-slate-400 font-semibold truncate max-w-[120px]">
                  {activeRecipe ? getLocalizedRecipeName(activeRecipe.name, activeConversationLang || currentLang) : t('recipesTitle', currentLang)}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => {
                if (audioEnabled && activeSpeechControllerRef.current) {
                  activeSpeechControllerRef.current.cancel();
                  setIsSpeaking(false);
                  setActiveSpeakingMsgId(null);
                }
                setAudioEnabled(!audioEnabled);
              }}
              className={`p-2 rounded-xl border transition-all ${
                audioEnabled
                  ? 'bg-emerald-950/60 border-emerald-700/50 text-emerald-400 hover:bg-emerald-900/80'
                  : 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700'
              }`}
              title={audioEnabled ? 'Mute Voice' : 'Enable Voice'}
            >
              {audioEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            </button>

            <button
              onClick={() => {
                if (activeSpeechControllerRef.current) {
                  activeSpeechControllerRef.current.cancel();
                  activeSpeechControllerRef.current = null;
                }
                setIsSpeaking(false);
                if (recognitionRef.current) {
                  try { recognitionRef.current.stop(); } catch {}
                }
                onClose();
              }}
              className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Recipe Step Banner (When Active Recipe is Attached) */}
        {activeRecipe && (
          <div className="bg-slate-900/95 text-slate-100 p-3.5 border-b border-slate-800 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded-md bg-emerald-500 text-slate-900 font-mono font-black text-[10px] uppercase tracking-wider">
                  Step {currentStepIndex + 1} / {totalSteps}
                </span>
                <span className="text-xs font-bold text-slate-300 truncate max-w-[200px]">
                  {getLocalizedRecipeName(activeRecipe.name, currentLang)}
                </span>
              </div>

              {onOpenCookWizard && (
                <button
                  onClick={() => onOpenCookWizard(activeRecipe)}
                  className="text-[10px] font-black uppercase tracking-wider bg-white/10 hover:bg-white/20 text-emerald-300 px-2.5 py-1 rounded-lg border border-white/10 transition-colors flex items-center gap-1"
                >
                  <Utensils className="w-3 h-3" />
                  Full Wizard
                </button>
              )}
            </div>

            <p className="text-xs font-semibold text-slate-200 line-clamp-2 leading-relaxed bg-slate-800/80 p-2 rounded-xl border border-slate-700/50">
              {currentStepText}
            </p>

            {/* Quick Step Buttons */}
            <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none pt-0.5">
              <button
                onClick={() => handleSendMessage("Previous step")}
                disabled={currentStepIndex === 0}
                className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-[10px] uppercase tracking-wider flex items-center gap-1 disabled:opacity-40 transition-colors"
              >
                <ChevronLeft className="w-3 h-3" />
                Back
              </button>

              <button
                onClick={() => handleSendMessage("Repeat step")}
                className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-emerald-400 font-bold text-[10px] uppercase tracking-wider flex items-center gap-1 transition-colors"
              >
                <RotateCcw className="w-3 h-3" />
                Repeat
              </button>

              <button
                onClick={() => handleSendMessage("Next step")}
                disabled={currentStepIndex >= totalSteps - 1}
                className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[10px] uppercase tracking-wider flex items-center gap-1 disabled:opacity-40 transition-colors"
              >
                Next
                <ChevronRight className="w-3 h-3" />
              </button>

              <button
                onClick={() => handleSendMessage("Set a 5 minute timer")}
                className="px-2.5 py-1 rounded-lg bg-amber-500/20 border border-amber-500/30 text-amber-300 font-bold text-[10px] uppercase tracking-wider flex items-center gap-1 hover:bg-amber-500/30 transition-colors"
              >
                <Clock className="w-3 h-3" />
                +5m Timer
              </button>
            </div>
          </div>
        )}

        {/* Active Timer Floating Alert */}
        {activeTimer && (
          <div className="bg-amber-50 border-b border-amber-200 px-4 py-2 flex items-center justify-between text-amber-900 animate-in slide-in-from-top duration-200">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-lg bg-amber-200 flex items-center justify-center text-amber-800 font-mono">
                <Clock className="w-3.5 h-3.5 animate-spin" />
              </div>
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider text-amber-700">
                  {activeTimer.label}
                </span>
                <p className="font-mono text-base font-black leading-none text-amber-950">
                  {formatTimer(activeTimer.remainingSeconds)}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={() => setActiveTimer(prev => prev ? { ...prev, isRunning: !prev.isRunning } : null)}
                className="p-1.5 rounded-lg bg-amber-200 hover:bg-amber-300 text-amber-900 text-xs font-bold"
                title={activeTimer.isRunning ? 'Pause Timer' : 'Resume Timer'}
              >
                {activeTimer.isRunning ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
              </button>

              <button
                onClick={() => setActiveTimer(prev => prev ? { ...prev, remainingSeconds: prev.remainingSeconds + 60 } : null)}
                className="px-2 py-1 rounded-lg bg-amber-200 hover:bg-amber-300 text-amber-900 text-[10px] font-black font-mono"
              >
                +1m
              </button>

              <button
                onClick={() => setActiveTimer(null)}
                className="p-1.5 rounded-lg bg-amber-200/60 hover:bg-amber-300 text-amber-800"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* Conversation Message Stream with Synchronized Typewriter and Karaoke Highlighting */}
        <div className="flex-1 p-4 overflow-y-auto space-y-3.5 bg-slate-50">
          {messages.map((msg) => {
            const isUser = msg.role === 'user';
            const isSystem = msg.role === 'system';
            const isThisMsgSpeaking = isSpeaking && activeSpeakingMsgId === msg.id;

            if (isSystem) {
              return (
                <div key={msg.id} className="flex justify-center my-2">
                  <div className="bg-amber-100 border border-amber-300 text-amber-900 px-3 py-1.5 rounded-2xl text-xs font-bold flex items-center gap-1.5 shadow-xs">
                    <Sparkles className="w-3.5 h-3.5 text-amber-700" />
                    <span>{msg.text}</span>
                  </div>
                </div>
              );
            }

            return (
              <div
                key={msg.id}
                className={`flex gap-2.5 ${isUser ? 'justify-end' : 'justify-start'}`}
              >
                {!isUser && (
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5 border shadow-xs transition-colors ${
                    isThisMsgSpeaking 
                      ? 'bg-emerald-600 text-white border-emerald-500 ring-2 ring-emerald-400/40 shadow-emerald-500/20' 
                      : 'bg-slate-900 text-emerald-400 border-slate-800'
                  }`}>
                    <ChefHat className={`w-4 h-4 ${isThisMsgSpeaking ? 'animate-bounce' : ''}`} />
                  </div>
                )}

                <div
                  className={`max-w-[85%] rounded-2xl p-3.5 space-y-1 shadow-xs transition-all ${
                    isUser
                      ? 'bg-emerald-600 text-white rounded-tr-xs'
                      : 'bg-white text-slate-800 border border-slate-200/90 rounded-tl-xs'
                  } ${isThisMsgSpeaking ? 'ring-2 ring-emerald-500/50 shadow-md bg-emerald-50/20' : ''}`}
                >
                  <div className="flex items-center justify-between gap-3 text-[10px] opacity-75 font-mono">
                    <span className="font-bold uppercase tracking-wider flex items-center gap-1.5">
                      {isUser ? 'You' : 'Sous-Chef'}
                      {isThisMsgSpeaking && (
                        <span className="text-[9px] text-emerald-700 font-black px-1.5 py-0.5 bg-emerald-100/90 rounded border border-emerald-300 flex items-center gap-1">
                          <Radio className="w-2 h-2 text-emerald-600 animate-spin" />
                          Dictating
                        </span>
                      )}
                    </span>
                    <span>{msg.timestamp}</span>
                  </div>

                  {isUser ? (
                    <p className="text-sm font-medium leading-relaxed whitespace-pre-wrap">
                      {msg.text}
                    </p>
                  ) : (
                    <div className="text-sm font-medium leading-relaxed whitespace-pre-wrap">
                      <SynchronizedSpeechText
                        fullText={msg.text}
                        revealedText={msg.revealedText}
                        wordIndex={msg.wordIndex}
                        isSpeaking={isThisMsgSpeaking}
                        isStreaming={msg.isStreaming}
                        isComplete={msg.isComplete}
                      />
                    </div>
                  )}

                  {msg.actionInfo && (
                    <div className="pt-1 mt-1 border-t border-slate-100 flex items-center gap-1 text-[11px] font-bold text-emerald-700">
                      <Sparkles className="w-3 h-3 text-emerald-600" />
                      <span>{msg.actionInfo}</span>
                    </div>
                  )}

                  {!isUser && (
                    <div className="pt-1 flex items-center justify-between gap-2 border-t border-slate-100/60 mt-1">
                      <span className="text-[9px] font-mono text-slate-400">
                        {isThisMsgSpeaking ? 'Synchronized live voice' : 'Hands-free voice'}
                      </span>
                      <button
                        onClick={() => speakResponseWithSync(msg.text, msg.id)}
                        className={`text-[10px] font-bold flex items-center gap-1 px-2 py-0.5 rounded-lg transition-colors ${
                          isThisMsgSpeaking
                            ? 'text-emerald-700 bg-emerald-100 font-black'
                            : 'text-slate-400 hover:text-emerald-600 hover:bg-slate-50'
                        }`}
                      >
                        <Volume2 className={`w-3 h-3 ${isThisMsgSpeaking ? 'text-emerald-600 animate-pulse' : ''}`} />
                        {isThisMsgSpeaking ? 'Replaying...' : 'Listen'}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {isLoading && (
            <div className="flex gap-2.5 justify-start">
              <div className="w-8 h-8 rounded-xl bg-slate-900 text-emerald-400 flex items-center justify-center shrink-0 border border-slate-800">
                <ChefHat className="w-4 h-4 animate-bounce" />
              </div>
              <div className="bg-white border border-slate-200 rounded-2xl rounded-tl-xs p-3 shadow-xs flex items-center gap-2 text-slate-500 text-xs font-bold">
                <div className="flex gap-1">
                  <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-bounce [animation-delay:-0.3s]"></span>
                  <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-bounce [animation-delay:-0.15s]"></span>
                  <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-bounce"></span>
                </div>
                <span>Chef is preparing spoken answer...</span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Live Audio Visualizer Pulse Banner when Active */}
        {(isListening || isSpeaking) && (
          <div className="bg-slate-950 text-white px-4 py-2 border-t border-slate-800 flex items-center justify-between animate-in fade-in duration-200">
            <div className="flex items-center gap-2">
              <span className={`w-2.5 h-2.5 rounded-full ${isListening ? 'bg-amber-400 animate-ping' : 'bg-emerald-400 animate-pulse'}`} />
              <span className="text-xs font-black uppercase tracking-wider text-slate-200">
                {isListening ? 'Listening to your voice...' : 'Sous-Chef is dictating...'}
              </span>
            </div>

            {/* Live sound waves equalizer */}
            <div className="flex items-center gap-1 h-4">
              <span className="w-1 bg-emerald-400 rounded-full animate-[pulse_0.6s_ease-in-out_infinite] h-3"></span>
              <span className="w-1 bg-emerald-400 rounded-full animate-[pulse_0.4s_ease-in-out_infinite] h-4"></span>
              <span className="w-1 bg-emerald-400 rounded-full animate-[pulse_0.8s_ease-in-out_infinite] h-2"></span>
              <span className="w-1 bg-emerald-400 rounded-full animate-[pulse_0.5s_ease-in-out_infinite] h-4"></span>
              <span className="w-1 bg-emerald-400 rounded-full animate-[pulse_0.7s_ease-in-out_infinite] h-3"></span>
            </div>
          </div>
        )}

        {/* Suggested Voice Prompt Chips */}
        <div className="px-3 pt-2 bg-white border-t border-slate-100 flex gap-1.5 overflow-x-auto scrollbar-none pb-1">
          {suggestedPrompts.map((prompt, pIdx) => (
            <button
              key={pIdx}
              onClick={() => handleSendMessage(prompt)}
              className="px-3 py-1.5 rounded-full bg-slate-100 hover:bg-emerald-50 hover:text-emerald-800 hover:border-emerald-200 border border-slate-200 text-slate-700 text-[11px] font-bold whitespace-nowrap transition-all flex items-center gap-1 shrink-0"
            >
              <Sparkles className="w-3 h-3 text-emerald-600" />
              <span>{prompt}</span>
            </button>
          ))}
        </div>

        {/* Voice & Text Input Control Bar */}
        <div className="p-3.5 bg-white border-t border-slate-200">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage(inputText);
            }}
            className="flex items-center gap-2"
          >
            {/* Big Mic Button */}
            <button
              type="button"
              onClick={toggleListening}
              className={`p-3.5 rounded-2xl font-black text-xs uppercase tracking-wider flex items-center justify-center transition-all duration-200 shadow-md ${
                isListening
                  ? 'bg-amber-500 text-slate-950 animate-pulse scale-105 shadow-amber-500/30'
                  : 'bg-emerald-600 text-white hover:bg-emerald-500 hover:scale-105 active:scale-95 shadow-emerald-600/30'
              }`}
              title={isListening ? 'Stop Listening' : 'Speak to Sous-Chef'}
            >
              {isListening ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
            </button>

            <div className="flex-1 relative">
              <input
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder={isListening ? "Listening... speak now" : (currentLang === 'fr' ? 'Parlez ou écrivez au Sous-Chef...' : currentLang === 'ar-MA' ? 'هضر ولا كتب للشاف...' : "Ask chef or say 'Next step'...")}
                className="w-full pl-4 pr-10 py-3 bg-slate-100 border border-slate-200 rounded-2xl text-sm font-medium text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all placeholder:text-slate-400"
              />
              <button
                type="submit"
                disabled={!inputText.trim() || isLoading}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-slate-400 hover:text-emerald-600 disabled:opacity-30 transition-colors"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </form>
          
          <div className="flex items-center justify-between text-[10px] font-bold text-slate-400 px-1 pt-2 uppercase tracking-widest">
            <span>🎙️ Hands-free Voice Mode</span>
            <span>Say "Next", "Repeat", "Timer 5m"</span>
          </div>
        </div>

      </div>
    </div>
  );
};
