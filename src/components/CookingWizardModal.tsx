import React, { useState } from 'react';
import { X, Volume2, ChevronRight, ChevronLeft, CheckCircle2, Play, Pause, RefreshCw, Sparkles, ChefHat } from 'lucide-react';
import { Recipe, LanguageType } from '../types';
import { getLocalizedRecipeName, getLocalizedRecipeInstructions } from '../utils/i18n';

interface CookingWizardModalProps {
  recipe: Recipe;
  language?: LanguageType;
  onClose: () => void;
}

export const CookingWizardModal: React.FC<CookingWizardModalProps> = ({
  recipe,
  language = 'en',
  onClose,
}) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [completedSteps, setCompletedSteps] = useState<number[]>([]);
  const [isSpeaking, setIsSpeaking] = useState(false);

  const activeLang = (language || 'en') as LanguageType;
  const instructions = getLocalizedRecipeInstructions(recipe, activeLang);
  const totalSteps = instructions.length;
  const progressPercent = Math.round(((currentStep + 1) / totalSteps) * 100);

  const speakCurrentStep = () => {
    if (!('speechSynthesis' in window)) return;

    window.speechSynthesis.cancel();
    if (isSpeaking) {
      setIsSpeaking(false);
      return;
    }

    const textToSay = `Step ${currentStep + 1}: ${instructions[currentStep]}`;
    const utterance = new SpeechSynthesisUtterance(textToSay);

    // Pick speech voice based on active app language
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

  const handleNext = () => {
    window.speechSynthesis.cancel();
    setIsSpeaking(false);
    if (!completedSteps.includes(currentStep)) {
      setCompletedSteps((prev) => [...prev, currentStep]);
    }
    if (currentStep < totalSteps - 1) {
      setCurrentStep((prev) => prev + 1);
    }
  };

  const handlePrev = () => {
    window.speechSynthesis.cancel();
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

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] border border-slate-200">
        
        {/* Header */}
        <div className="bg-slate-900 text-white p-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
              <ChefHat className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[10px] font-black uppercase tracking-widest text-emerald-400">
                Interactive Cooking Mode
              </span>
              <h3 className="font-bold text-white text-base leading-tight truncate max-w-[220px]">
                {getLocalizedRecipeName(recipe.name, activeLang)}
              </h3>
            </div>
          </div>
          <button
            onClick={() => {
              window.speechSynthesis.cancel();
              onClose();
            }}
            className="p-1.5 text-slate-400 hover:text-white rounded-full hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
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

        {/* Active Step Content */}
        <div className="p-5 flex-1 overflow-y-auto space-y-4">
          <div className="bg-emerald-50/50 p-4 rounded-2xl border border-emerald-100 space-y-3">
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
            className="px-4 py-2.5 rounded-2xl bg-white border border-slate-200 text-slate-700 font-black text-xs uppercase tracking-wider flex items-center gap-1 disabled:opacity-40 hover:bg-slate-100"
          >
            <ChevronLeft className="w-4 h-4" />
            Prev
          </button>

          {currentStep === totalSteps - 1 ? (
            <button
              onClick={() => {
                window.speechSynthesis.cancel();
                onClose();
              }}
              className="px-5 py-2.5 rounded-2xl bg-emerald-600 text-white font-black text-xs uppercase tracking-widest flex items-center gap-1.5 shadow-xs hover:bg-emerald-700"
            >
              <CheckCircle2 className="w-4 h-4" />
              Finish Cooking!
            </button>
          ) : (
            <button
              onClick={handleNext}
              className="px-5 py-2.5 rounded-2xl bg-slate-900 text-white font-black text-xs uppercase tracking-widest flex items-center gap-1.5 shadow-xs hover:bg-slate-800"
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
