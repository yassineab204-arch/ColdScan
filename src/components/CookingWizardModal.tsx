import React, { useState, useEffect, useRef } from 'react';
import { 
  X, 
  Volume2, 
  VolumeX, 
  ChevronRight, 
  ChevronLeft, 
  CheckCircle2, 
  Play, 
  Pause, 
  RotateCcw, 
  Sparkles, 
  ChefHat, 
  Mic, 
  MicOff, 
  Clock, 
  MessageSquare
} from 'lucide-react';
import { Recipe, LanguageType, FoodItem, AppSettings } from '../types';
import { getLocalizedRecipeName, getLocalizedRecipeInstructions } from '../utils/i18n';

interface CookingWizardModalProps {
  recipe: Recipe;
  language?: LanguageType;
  inventory?: FoodItem[];
  settings?: AppSettings;
  onClose: () => void;
  onOpenVoiceBot?: (recipe: Recipe) => void;
}

export const CookingWizardModal: React.FC<CookingWizardModalProps> = ({
  recipe,
  language = 'en',
  inventory = [],
  settings,
  onClose,
  onOpenVoiceBot,
}) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [completedSteps, setCompletedSteps] = useState<number[]>([]);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isVoiceListening, setIsVoiceListening] = useState(false);
  const [voiceFeedback, setVoiceFeedback] = useState<string | null>(null);

  // Timer state
  const [activeTimerSeconds, setActiveTimerSeconds] = useState<number | null>(null);
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [timerLabel, setTimerLabel] = useState<string>('Cooking Timer');

  const activeLang = (language || 'en') as LanguageType;
  const instructions = getLocalizedRecipeInstructions(recipe, activeLang);
  const totalSteps = instructions.length;
  const progressPercent = Math.round(((currentStep + 1) / totalSteps) * 100);

  const recognitionRef = useRef<any>(null);
  const timerIntervalRef = useRef<any>(null);

  // Kitchen Timer countdown
  useEffect(() => {
    if (isTimerRunning && activeTimerSeconds !== null && activeTimerSeconds > 0) {
      timerIntervalRef.current = setInterval(() => {
        setActiveTimerSeconds((prev) => {
          if (prev === null || prev <= 1) {
            clearInterval(timerIntervalRef.current);
            setIsTimerRunning(false);
            playBeep();
            setVoiceFeedback('⏱️ Timer Finished!');
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      clearInterval(timerIntervalRef.current);
    }
    return () => clearInterval(timerIntervalRef.current);
  }, [isTimerRunning, activeTimerSeconds]);

  const playBeep = () => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
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
    } catch {}
  };

  // Web Speech synthesis for reading step
  const speakCurrentStep = () => {
    if (!('speechSynthesis' in window)) return;

    window.speechSynthesis.cancel();
    if (isSpeaking) {
      setIsSpeaking(false);
      return;
    }

    const textToSay = `Step ${currentStep + 1}: ${instructions[currentStep]}`;
    const utterance = new SpeechSynthesisUtterance(textToSay);

    const langMap: Record<LanguageType, string> = {
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
    utterance.lang = langMap[language] || 'en-US';

    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);

    setIsSpeaking(true);
    window.speechSynthesis.speak(utterance);
  };

  // Speech Recognition for Hands-Free Voice Commands
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
      recognition.lang = langCodes[activeLang] || 'en-US';

      recognition.onresult = (event: any) => {
        const transcript = (event.results[0][0].transcript || '').toLowerCase().trim();
        setIsVoiceListening(false);
        setVoiceFeedback(`Heard: "${transcript}"`);

        // Check for common hands-free voice commands
        if (transcript.includes('next') || transcript.includes('suivant') || transcript.includes('التالي') || transcript.includes('siguiente') || transcript.includes('weiter')) {
          handleNext();
          setVoiceFeedback('➡️ Next Step');
        } else if (transcript.includes('back') || transcript.includes('previous') || transcript.includes('précédent') || transcript.includes('السابق') || transcript.includes('anterior') || transcript.includes('zurück')) {
          handlePrev();
          setVoiceFeedback('⬅️ Previous Step');
        } else if (transcript.includes('repeat') || transcript.includes('again') || transcript.includes('répéter') || transcript.includes('عاود') || transcript.includes('repetir') || transcript.includes('wiederholen')) {
          speakCurrentStep();
          setVoiceFeedback('🔁 Repeating Step');
        } else if (transcript.includes('timer') || transcript.includes('minuteur') || transcript.includes('دقيقة') || transcript.includes('temporizador') || transcript.includes('minuten')) {
          // Extract minutes if any
          const match = transcript.match(/\d+/);
          const mins = match ? parseInt(match[0], 10) : 5;
          setActiveTimerSeconds(mins * 60);
          setIsTimerRunning(true);
          setTimerLabel(`${mins} Min Timer`);
          setVoiceFeedback(`⏱️ Set ${mins} min timer`);
        } else if (onOpenVoiceBot) {
          // Open the full AI Sous-Chef voice bot
          onOpenVoiceBot(recipe);
        }
      };

      recognition.onerror = () => {
        setIsVoiceListening(false);
      };

      recognition.onend = () => {
        setIsVoiceListening(false);
      };

      recognitionRef.current = recognition;
    }

    return () => {
      if (recognitionRef.current) {
        try { recognitionRef.current.stop(); } catch {}
      }
    };
  }, [currentStep, totalSteps, activeLang, instructions]);

  const toggleVoiceListening = () => {
    if (isVoiceListening) {
      try { recognitionRef.current?.stop(); } catch {}
      setIsVoiceListening(false);
    } else {
      window.speechSynthesis?.cancel();
      setIsSpeaking(false);
      try {
        recognitionRef.current?.start();
        setIsVoiceListening(true);
        setVoiceFeedback('🎙️ Listening for "Next", "Back", "Repeat", or "Timer"...');
      } catch {
        setIsVoiceListening(false);
      }
    }
  };

  const handleNext = () => {
    window.speechSynthesis?.cancel();
    setIsSpeaking(false);
    if (!completedSteps.includes(currentStep)) {
      setCompletedSteps((prev) => [...prev, currentStep]);
    }
    if (currentStep < totalSteps - 1) {
      setCurrentStep((prev) => prev + 1);
    }
  };

  const handlePrev = () => {
    window.speechSynthesis?.cancel();
    setIsSpeaking(false);
    if (currentStep > 0) {
      setCurrentStep((prev) => prev - 1);
    }
  };

  const toggleStepCompleted = (stepIdx: number) => {
    setCompletedSteps((prev) =>
      prev.includes(stepIdx) ? prev.filter((s) => s !== stepIdx) : [...prev, stepIdx]
    );
  };

  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] border border-slate-200">
        
        {/* Header */}
        <div className="bg-slate-900 text-white p-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30">
              <ChefHat className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[10px] font-black uppercase tracking-widest text-emerald-400 flex items-center gap-1">
                <span>Interactive Cooking Mode</span>
                <span className="bg-emerald-500/20 text-emerald-300 text-[8px] font-mono px-1.5 py-0.2 rounded">VOICE READY</span>
              </span>
              <h3 className="font-bold text-white text-base leading-tight truncate max-w-[210px] sm:max-w-[260px]">
                {getLocalizedRecipeName(recipe.name, activeLang)}
              </h3>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {/* Open Full Voice Bot Button */}
            {onOpenVoiceBot && (
              <button
                onClick={() => {
                  window.speechSynthesis?.cancel();
                  onOpenVoiceBot(recipe);
                }}
                className="px-2.5 py-1.5 rounded-xl bg-emerald-600/30 border border-emerald-500/40 text-emerald-300 hover:bg-emerald-600/50 text-[11px] font-black uppercase tracking-wider flex items-center gap-1 transition-all"
                title="Open AI Sous-Chef Voice Guide"
              >
                <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                <span className="hidden sm:inline">AI Voice Guide</span>
              </button>
            )}

            <button
              onClick={() => {
                window.speechSynthesis?.cancel();
                onClose();
              }}
              className="p-1.5 text-slate-400 hover:text-white rounded-full hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="bg-slate-100 px-4 py-2 flex items-center justify-between border-b border-slate-200">
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">
            Step {currentStep + 1} of {totalSteps}
          </span>
          <div className="flex-1 mx-3 h-2 bg-slate-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-emerald-600 transition-all duration-300"
              style={{ width: `${progressPercent}%` }}
            ></div>
          </div>
          <span className="text-[10px] font-black text-emerald-700 font-mono">
            {progressPercent}%
          </span>
        </div>

        {/* Hands-Free Voice & Timer Status Bar */}
        <div className="bg-slate-900 px-4 py-2 flex items-center justify-between text-white border-b border-slate-800">
          <div className="flex items-center gap-2">
            <button
              onClick={toggleVoiceListening}
              className={`px-3 py-1.5 rounded-xl text-[11px] font-black uppercase tracking-wider flex items-center gap-1.5 transition-all ${
                isVoiceListening
                  ? 'bg-amber-500 text-slate-950 animate-pulse'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
              }`}
            >
              {isVoiceListening ? <Mic className="w-3.5 h-3.5" /> : <MicOff className="w-3.5 h-3.5 text-slate-400" />}
              <span>{isVoiceListening ? 'Listening...' : 'Hands-Free Mic'}</span>
            </button>

            {voiceFeedback && (
              <span className="text-[11px] font-medium text-emerald-400 truncate max-w-[170px]">
                {voiceFeedback}
              </span>
            )}
          </div>

          {/* Quick Timer Launcher */}
          {activeTimerSeconds !== null ? (
            <div className="flex items-center gap-1.5 bg-amber-500/20 border border-amber-500/30 px-2 py-1 rounded-xl text-amber-300">
              <Clock className="w-3.5 h-3.5 animate-spin" />
              <span className="font-mono font-black text-xs">
                {formatTimer(activeTimerSeconds)}
              </span>
              <button
                onClick={() => setIsTimerRunning(!isTimerRunning)}
                className="p-1 hover:bg-amber-500/30 rounded"
              >
                {isTimerRunning ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
              </button>
              <button
                onClick={() => {
                  setActiveTimerSeconds(null);
                  setIsTimerRunning(false);
                }}
                className="p-1 hover:bg-amber-500/30 rounded text-amber-400"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => {
                setActiveTimerSeconds(300);
                setIsTimerRunning(true);
                setTimerLabel('5 Min Timer');
              }}
              className="text-[10px] font-black uppercase tracking-wider text-slate-400 hover:text-amber-300 flex items-center gap-1"
            >
              <Clock className="w-3 h-3" />
              +5m Timer
            </button>
          )}
        </div>

        {/* Active Step Content */}
        <div className="p-5 flex-1 overflow-y-auto space-y-4">
          <div className="bg-emerald-50/60 p-4 rounded-2xl border border-emerald-100 space-y-3 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase tracking-widest text-emerald-800 bg-emerald-100 px-2.5 py-0.5 rounded-md">
                CURRENT INSTRUCTION
              </span>

              <button
                onClick={speakCurrentStep}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-xl text-[11px] font-black uppercase tracking-wider transition-all ${
                  isSpeaking
                    ? 'bg-emerald-600 text-white animate-pulse'
                    : 'bg-white text-emerald-700 border border-emerald-200 hover:bg-emerald-100'
                }`}
              >
                <Volume2 className="w-3.5 h-3.5" />
                <span>{isSpeaking ? 'Speaking...' : 'Read Aloud'}</span>
              </button>
            </div>

            <p className="text-base font-bold text-slate-800 leading-relaxed">
              {instructions[currentStep]}
            </p>

            <button
              onClick={() => toggleStepCompleted(currentStep)}
              className={`w-full py-2 px-3 rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all ${
                completedSteps.includes(currentStep)
                  ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
              }`}
            >
              <CheckCircle2 className={`w-4 h-4 ${completedSteps.includes(currentStep) ? 'text-emerald-600' : 'text-slate-300'}`} />
              <span>{completedSteps.includes(currentStep) ? 'Step Marked Done' : 'Mark Step Completed'}</span>
            </button>
          </div>

          {/* Quick List of All Steps */}
          <div className="space-y-1.5 pt-2">
            <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400">All Steps</h4>
            <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
              {recipe.instructions.map((step, idx) => {
                const isCurrent = idx === currentStep;
                const isDone = completedSteps.includes(idx);
                return (
                  <button
                    key={idx}
                    onClick={() => {
                      window.speechSynthesis.cancel();
                      setIsSpeaking(false);
                      setCurrentStep(idx);
                    }}
                    className={`w-full text-left p-2.5 rounded-xl border text-xs flex items-start gap-2 transition-all ${
                      isCurrent
                        ? 'bg-slate-900 text-white border-slate-900 font-bold shadow-xs'
                        : isDone
                        ? 'bg-emerald-50 text-slate-500 border-emerald-100 line-through'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <span className={`text-[10px] font-mono shrink-0 px-1.5 py-0.5 rounded ${isCurrent ? 'bg-emerald-500 text-slate-900 font-black' : 'bg-slate-200 text-slate-600 font-bold'}`}>
                      {idx + 1}
                    </span>
                    <span className="line-clamp-2 leading-tight flex-1">{step}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Bottom Navigation Controls */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <button
            onClick={handlePrev}
            disabled={currentStep === 0}
            className="px-4 py-2.5 rounded-2xl bg-white border border-slate-200 text-slate-700 font-black text-xs uppercase tracking-wider flex items-center gap-1 disabled:opacity-40 hover:bg-slate-100 transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
            Prev
          </button>

          {currentStep === totalSteps - 1 ? (
            <button
              onClick={() => {
                window.speechSynthesis?.cancel();
                onClose();
              }}
              className="px-5 py-2.5 rounded-2xl bg-emerald-600 text-white font-black text-xs uppercase tracking-widest flex items-center gap-1.5 shadow-xs hover:bg-emerald-700 transition-colors"
            >
              <CheckCircle2 className="w-4 h-4" />
              Finish Cooking!
            </button>
          ) : (
            <button
              onClick={handleNext}
              className="px-5 py-2.5 rounded-2xl bg-slate-900 text-white font-black text-xs uppercase tracking-widest flex items-center gap-1.5 shadow-xs hover:bg-slate-800 transition-colors"
            >
              <span>Next Step</span>
              <ChevronRight className="w-4 h-4 text-emerald-400" />
            </button>
          )}
        </div>

      </div>
    </div>
  );
};

