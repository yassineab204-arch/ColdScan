import React, { useState, useEffect, useRef } from 'react';
import { 
  X, 
  Mic, 
  MicOff, 
  Sparkles, 
  Volume2, 
  VolumeX, 
  Send, 
  Utensils, 
  AlertTriangle, 
  ShoppingBag,
  Camera,
  RefreshCw,
  Globe
} from 'lucide-react';
import { FoodItem, LanguageType, AppSettings } from '../types';

interface LiveVoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  inventory: FoodItem[];
  settings?: AppSettings;
  onUpdateSettings?: (settings: Partial<AppSettings>) => void;
  onNavigateToRecipes?: () => void;
  onNavigateToShopping?: () => void;
}

const PROMPTS: Record<LanguageType, Array<{ label: string; icon: any; query: string }>> = {
  en: [
    { label: 'What can I cook with what I have?', icon: Utensils, query: 'What can I cook with what I currently have in my fridge?' },
    { label: 'What should I use first?', icon: AlertTriangle, query: 'Which items in my fridge are closest to expiring and should be used first?' },
    { label: 'What do I need to buy?', icon: ShoppingBag, query: 'Based on my fridge inventory, what essential staples or ingredients am I missing?' },
  ],
  fr: [
    { label: 'Que cuisiner avec le frigo ?', icon: Utensils, query: 'Que puis-je cuisiner avec les ingrédients présents dans mon réfrigérateur ?' },
    { label: 'Que consommer en premier ?', icon: AlertTriangle, query: 'Quels aliments dans mon frigo arrivent bientôt à expiration et doivent être consommés rapidement ?' },
    { label: 'Quels ingrédients acheter ?', icon: ShoppingBag, query: 'En fonction de mon frigo, quels ingrédients essentiels me manquent pour faire des repas ?' },
  ],
  'ar-MA': [
    { label: 'شنو نطيب بهادشي فالتلاجة؟', icon: Utensils, query: 'شنو نقدر نطيب دابا بالخضرة والمأكولات اللي كاينين عندي فالتلاجة؟' },
    { label: 'شنو خاصني ناكل هو اللول؟', icon: AlertTriangle, query: 'شنو هما الحوايج فالتلاجة اللي قريب يسالي الصلاحية ديالهم وخاصني نستعملهم هما اللولين؟' },
    { label: 'شنو خاصني نشري من السويقة؟', icon: ShoppingBag, query: 'شنو هما المقادير ولا السلعة اللي ناقصاني فالتلاجة وخاصني نشريها؟' },
  ],
  es: [
    { label: '¿Qué puedo cocinar hoy?', icon: Utensils, query: '¿Qué puedo cocinar con lo que tengo en mi refrigerador?' },
    { label: '¿Qué caduca primero?', icon: AlertTriangle, query: '¿Qué alimentos en mi refrigerador están más cerca de caducar y debo usar primero?' },
    { label: '¿Qué necesito comprar?', icon: ShoppingBag, query: 'Según mi inventario, ¿qué ingredientes esenciales me faltan?' },
  ],
  de: [
    { label: 'Was kann ich kochen?', icon: Utensils, query: 'Was kann ich mit den Zutaten kochen, die sich derzeit in meinem Kühlschrank befinden?' },
    { label: 'Was läuft zuerst ab?', icon: AlertTriangle, query: 'Welche Lebensmittel laufen bald ab und sollten zuerst verbraucht werden?' },
    { label: 'Was muss ich kaufen?', icon: ShoppingBag, query: 'Welche Zutaten fehlen mir für meine Einkaufsliste?' },
  ],
  ar: [
    { label: 'ماذا أطبخ بما لدي؟', icon: Utensils, query: 'ماذا يمكنني أن أطبخ بالمكونات الموجودة حالياً في ثلاجتي؟' },
    { label: 'ما الذي ينتهي أولاً؟', icon: AlertTriangle, query: 'ما هي الأطعمة الأكثر قرباً من انتهاء الصلاحية ويجب استهلاكها أولاً؟' },
    { label: 'ما الذي ينقصني؟', icon: ShoppingBag, query: 'بناءً على مخزون ثلاجتي، ما هي المكونات الأساسية التي تنقصني؟' },
  ],
  it: [
    { label: 'Cosa posso cucinare?', icon: Utensils, query: 'Cosa posso cucinare con gli ingredienti che ho nel frigorifero?' },
    { label: 'Cosa scade prima?', icon: AlertTriangle, query: 'Quali alimenti stanno per scadere e dovrebbero essere usati per primi?' },
    { label: 'Cosa devo comprare?', icon: ShoppingBag, query: 'Quali ingredienti essenziali mi mancano per fare la spesa?' },
  ],
  pt: [
    { label: 'O que posso cozinhar?', icon: Utensils, query: 'O que posso cozinhar com os ingredientes que tenho no meu frigorífico?' },
    { label: 'O que expira primeiro?', icon: AlertTriangle, query: 'Quais alimentos estão mais próximos do prazo de validade e devem ser usados primeiro?' },
    { label: 'O que preciso comprar?', icon: ShoppingBag, query: 'Com base no meu inventário, que ingredientes essenciais estão a faltar?' },
  ],
  ja: [
    { label: '何が作れますか？', icon: Utensils, query: '冷蔵庫の食材で何を作ることができますか？' },
    { label: 'どれを先に使うべき？', icon: AlertTriangle, query: '賞味期限が近い食材はどれですか？' },
    { label: '何を買うべき？', icon: ShoppingBag, query: '足りない調味料や食材は何ですか？' },
  ],
};

const GREETINGS: Record<LanguageType, string> = {
  en: "Hi! I'm ColdScan Live Assistant. Ask me anything about your fridge!",
  fr: "Bonjour ! Je suis l'assistant vocal ColdScan. Posez-moi vos questions !",
  'ar-MA': "أهلاً بك! أنا مساعد ColdScan للثلاجة بالدارجة المغربية. سولني على أي حاجة!",
  es: "¡Hola! Soy el asistente vocal ColdScan. ¡Pregúntame lo que quieras sobre tu nevera!",
  de: "Hallo! Ich bin Ihr ColdScan AI-Assistent. Fragen Sie mich alles über Ihren Kühlschrank!",
  ar: "مرحباً بك! أنا مساعد ColdScan الذكي للثلاجة. اسألني عن أي شيء في ثلاجتك!",
  it: "Ciao! Sono l'assistente vocale ColdScan. Chiedimi qualsiasi cosa sul tuo frigo!",
  pt: "Olá! Sou o assistente de voz ColdScan. Pergunte-me qualquer coisa sobre o seu frigorífico!",
  ja: "こんにちは！ColdScan AI音声アシスタントです。冷蔵庫のことなら何でもお尋ねください！",
};

const SPEECH_LANG_CODES: Record<LanguageType, string> = {
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

export const LiveVoiceModal: React.FC<LiveVoiceModalProps> = ({
  isOpen,
  onClose,
  inventory,
  settings,
  onUpdateSettings,
  onNavigateToRecipes,
  onNavigateToShopping,
}) => {
  const [currentLang, setCurrentLang] = useState<LanguageType>(settings?.language || 'en');
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [inputText, setInputText] = useState('');
  const [messages, setMessages] = useState<Array<{ role: 'user' | 'assistant'; text: string; timestamp: string }>>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [audioEnabled, setAudioEnabled] = useState(true);

  // Sync settings language when modal opens or settings change
  useEffect(() => {
    if (settings?.language) {
      setCurrentLang(settings.language);
    }
  }, [settings?.language]);

  // Reset or initialize greetings per language
  useEffect(() => {
    if (isOpen && messages.length === 0) {
      setMessages([
        {
          role: 'assistant',
          text: GREETINGS[currentLang] || GREETINGS.en,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    }
  }, [isOpen, currentLang]);

  useEffect(() => {
    if (!isOpen) {
      setIsListening(false);
      setIsSpeaking(false);
    }
  }, [isOpen]);

  const handleLanguageSwitch = (lang: LanguageType) => {
    setCurrentLang(lang);
    onUpdateSettings?.({ language: lang });
    setMessages((prev) => [
      ...prev,
      {
        role: 'assistant',
        text: GREETINGS[lang] || GREETINGS.en,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      },
    ]);
  };

  const handleSendMessage = async (textToSend?: string) => {
    const query = textToSend || inputText;
    if (!query.trim() || isLoading) return;

    const userMessage = {
      role: 'user' as const,
      text: query,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputText('');
    setIsLoading(true);

    try {
      // Call backend AI endpoint with current selected language
      const response = await fetch('/api/ai-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: query,
          inventory,
          language: currentLang,
        }),
      });

      const data = await response.json();
      const aiReply = data.reply || "I analyzed your fridge inventory. Let me know if you want recipe ideas!";

      const assistantMessage = {
        role: 'assistant' as const,
        text: aiReply,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      setMessages((prev) => [...prev, assistantMessage]);

      // If audio enabled, play TTS
      if (audioEnabled) {
        playTTS(aiReply);
      }
    } catch (err) {
      console.error('Chat error:', err);
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          text: currentLang === 'fr' 
            ? "Erreur de connexion avec le serveur AI." 
            : currentLang === 'ar-MA' 
            ? "وقعات مشكلة فالاتصال مع السيرفر ديال الذكاء الاصطناعي." 
            : "I had trouble connecting to the AI server. Please check your network connection.",
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const fallbackSpeechSynthesis = (textToSpeak: string) => {
    if (!('speechSynthesis' in window)) {
      setIsSpeaking(false);
      return;
    }
    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(textToSpeak);
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
      utterance.lang = langMap[currentLang] || 'en-US';
      utterance.onend = () => setIsSpeaking(false);
      utterance.onerror = () => setIsSpeaking(false);
      setIsSpeaking(true);
      window.speechSynthesis.speak(utterance);
    } catch {
      setIsSpeaking(false);
    }
  };

  const playTTS = async (textToSpeak: string) => {
    try {
      setIsSpeaking(true);
      const res = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          text: textToSpeak, 
          voice: settings?.voiceName || 'Zephyr',
          language: currentLang 
        }),
      });

      if (!res.ok) {
        fallbackSpeechSynthesis(textToSpeak);
        return;
      }

      const data = await res.json();
      if (data.base64Audio) {
        const mime = data.mimeType || 'audio/wav';
        const audio = new Audio(`data:${mime};base64,${data.base64Audio}`);
        audio.onended = () => setIsSpeaking(false);
        audio.onerror = () => {
          console.warn('Audio element error, using SpeechSynthesis fallback');
          fallbackSpeechSynthesis(textToSpeak);
        };
        await audio.play().catch((err) => {
          console.warn('Audio play failed, using SpeechSynthesis fallback', err);
          fallbackSpeechSynthesis(textToSpeak);
        });
      } else {
        fallbackSpeechSynthesis(textToSpeak);
      }
    } catch (e) {
      console.error('TTS playback error, using fallback:', e);
      fallbackSpeechSynthesis(textToSpeak);
    }
  };

  const toggleMicListening = () => {
    if (isListening) {
      setIsListening(false);
    } else {
      setIsListening(true);
      if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
        const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        const recognition = new SpeechRecognition();
        recognition.continuous = false;
        recognition.interimResults = false;
        recognition.lang = SPEECH_LANG_CODES[currentLang] || 'en-US';

        recognition.onstart = () => setIsListening(true);
        recognition.onresult = (event: any) => {
          const transcript = event.results[0][0].transcript;
          setIsListening(false);
          handleSendMessage(transcript);
        };
        recognition.onerror = () => setIsListening(false);
        recognition.onend = () => setIsListening(false);
        recognition.start();
      } else {
        // Fallback for demo when WebSpeech API is unavailable in iframe
        const fallbacks: Record<LanguageType, string> = {
          en: "What can I cook with my expiring spinach and milk?",
          fr: "Que puis-je cuisiner avec mon épinard et mon lait ?",
          'ar-MA': "شنو نقدر نطيب بالسبانخ والحليب اللي عندي فالتلاجة؟",
          es: "¿Qué puedo cocinar con la espinaca y leche que están por vencer?",
          de: "Was kann ich mit meiner ablaufenden Spinat und Milch kochen?",
          ar: "ماذا يمكنني أن أطبخ بالسبانخ والحليب المتبقي في الثلاجة؟",
          it: "Cosa posso cucinare con gli spinaci e il latte in scadenza?",
          pt: "O que posso cozinhar com espinafres e leite prestes a expirar?",
          ja: "賞味期限が近いほうれん草と牛乳で何が作れますか？",
        };
        setTimeout(() => {
          setIsListening(false);
          handleSendMessage(fallbacks[currentLang]);
        }, 2000);
      }
    }
  };

  if (!isOpen) return null;

  const currentPrompts = PROMPTS[currentLang] || PROMPTS.en;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-md h-[90vh] sm:h-[650px] rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col overflow-hidden">
        
        {/* Modal Header */}
        <div className="bg-slate-900 text-white p-4 flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-full bg-emerald-500/20 flex items-center justify-center border border-emerald-400">
              <Sparkles className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <h2 className="font-black text-sm uppercase tracking-wider flex items-center gap-1.5">
                Gemini Live Voice
                {isSpeaking && (
                  <span className="flex h-2 w-2 relative">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                  </span>
                )}
              </h2>
              <p className="text-[10px] text-emerald-400 font-bold uppercase tracking-widest">
                Multilingual AI Voice
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setAudioEnabled(!audioEnabled)}
              className="p-2 rounded-xl hover:bg-white/10 transition-colors text-slate-300"
              title={audioEnabled ? 'Voice output enabled' : 'Voice output muted'}
            >
              {audioEnabled ? <Volume2 className="w-4 h-4 text-emerald-400" /> : <VolumeX className="w-4 h-4 text-slate-500" />}
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-xl hover:bg-white/10 transition-colors text-slate-300 font-black"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Language Selection Header Bar */}
        <div className="bg-slate-950 p-2 flex items-center justify-between border-b border-slate-800 px-3">
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-1 shrink-0 mr-2">
            <Globe className="w-3.5 h-3.5 text-emerald-400" />
            Lang:
          </span>
          <div className="flex gap-1.5 overflow-x-auto scrollbar-none py-0.5">
            {[
              { id: 'en' as LanguageType, label: 'EN 🇬🇧' },
              { id: 'fr' as LanguageType, label: 'FR 🇫🇷' },
              { id: 'ar-MA' as LanguageType, label: 'Darija 🇲🇦' },
              { id: 'es' as LanguageType, label: 'ES 🇪🇸' },
              { id: 'de' as LanguageType, label: 'DE 🇩🇪' },
              { id: 'ar' as LanguageType, label: 'AR 🇸🇦' },
              { id: 'it' as LanguageType, label: 'IT 🇮🇹' },
              { id: 'pt' as LanguageType, label: 'PT 🇵🇹' },
              { id: 'ja' as LanguageType, label: 'JA 🇯🇵' },
            ].map((lang) => (
              <button
                key={lang.id}
                onClick={() => handleLanguageSwitch(lang.id)}
                className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all whitespace-nowrap shrink-0 ${
                  currentLang === lang.id
                    ? 'bg-emerald-500 text-slate-900 font-extrabold shadow-xs'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
              >
                {lang.label}
              </button>
            ))}
          </div>
        </div>

        {/* Quick Prompts Bar */}
        <div className="bg-emerald-50/70 p-2.5 border-b border-emerald-100 flex gap-2 overflow-x-auto scrollbar-none">
          {currentPrompts.map((item, idx) => {
            const Icon = item.icon;
            return (
              <button
                key={idx}
                onClick={() => handleSendMessage(item.query)}
                className="whitespace-nowrap px-3 py-1.5 rounded-xl bg-white border border-emerald-200 text-emerald-900 text-xs font-bold hover:bg-emerald-100 transition-all flex items-center gap-1.5 shadow-xs shrink-0"
              >
                <Icon className="w-3.5 h-3.5 text-emerald-600" />
                {item.label}
              </button>
            );
          })}
        </div>

        {/* Messages Stream */}
        <div className="flex-1 p-4 overflow-y-auto space-y-3.5 bg-slate-50">
          {messages.map((msg, idx) => (
            <div
              key={idx}
              className={`flex flex-col ${
                msg.role === 'user' ? 'items-end' : 'items-start'
              }`}
            >
              <div
                className={`max-w-[85%] px-4 py-3 rounded-2xl text-xs font-bold ${
                  msg.role === 'user'
                    ? 'bg-emerald-600 text-white rounded-br-none shadow-xs'
                    : 'bg-white text-slate-900 border border-slate-200 rounded-bl-none shadow-xs leading-relaxed'
                }`}
              >
                <p className="whitespace-pre-line">{msg.text}</p>
              </div>
              <span className="text-[9px] font-black text-slate-400 mt-1 px-1 uppercase tracking-wider">{msg.timestamp}</span>
            </div>
          ))}

          {isLoading && (
            <div className="flex items-center gap-2 text-slate-700 text-xs font-bold py-2 px-3 bg-white rounded-2xl border border-slate-200 w-fit shadow-xs">
              <RefreshCw className="w-3.5 h-3.5 animate-spin text-emerald-600" />
              {currentLang === 'fr' 
                ? 'Réflexion ColdScan en cours...' 
                : currentLang === 'ar-MA' 
                ? 'جاري التفكير بالدارجة...' 
                : 'ColdScan AI is thinking...'}
            </div>
          )}
        </div>

        {/* Live Audio Visualizer / Controls */}
        <div className="p-3.5 bg-white border-t border-slate-200 space-y-3">
          {isListening && (
            <div className="flex items-center justify-center gap-2 py-1">
              <span className="text-xs font-black uppercase tracking-widest text-emerald-700 animate-pulse">
                {currentLang === 'fr' 
                  ? 'Écoute en cours... Parlez maintenant' 
                  : currentLang === 'ar-MA' 
                  ? 'كنسمع ليك دابا... تكلم' 
                  : 'Listening... Speak now'}
              </span>
              <div className="flex items-end gap-0.5 h-4">
                <span className="w-1 bg-emerald-500 h-2 animate-bounce rounded-full"></span>
                <span className="w-1 bg-emerald-500 h-4 animate-bounce delay-75 rounded-full"></span>
                <span className="w-1 bg-emerald-500 h-3 animate-bounce delay-150 rounded-full"></span>
                <span className="w-1 bg-emerald-500 h-1 animate-bounce delay-100 rounded-full"></span>
              </div>
            </div>
          )}

          <div className="flex items-center gap-2">
            <button
              onClick={toggleMicListening}
              className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all shrink-0 ${
                isListening
                  ? 'bg-rose-600 text-white animate-pulse shadow-md'
                  : 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-md active:scale-95'
              }`}
              title={isListening ? 'Stop listening' : 'Start voice input'}
            >
              {isListening ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5 stroke-[2.5]" />}
            </button>

            <div className="flex-1 relative flex items-center">
              <input
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                placeholder={
                  currentLang === 'fr'
                    ? "Posez une question ex: 'Que cuisiner ce soir ?'"
                    : currentLang === 'ar-MA'
                    ? "سول مثلاً: 'شنو نطيب فالعشاء؟'"
                    : "Ask e.g. 'What can I cook tonight?'"
                }
                className="w-full pl-4 pr-10 py-3 text-xs font-bold bg-slate-100 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all text-slate-900 placeholder-slate-400"
              />
              <button
                onClick={() => handleSendMessage()}
                disabled={!inputText.trim() || isLoading}
                className="absolute right-1.5 p-2 rounded-xl bg-slate-900 text-emerald-400 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-800 transition-colors"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};
