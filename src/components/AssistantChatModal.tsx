import React, { useState, useEffect, useRef } from 'react';
import { X, Sparkles, Send, Utensils, AlertTriangle, ShoppingBag, ChefHat, Loader2 } from 'lucide-react';
import { FoodItem, AppSettings, LanguageType } from '../types';
import { t } from '../utils/i18n';

interface AssistantChatModalProps {
  isOpen: boolean;
  onClose: () => void;
  inventory: FoodItem[];
  settings?: AppSettings;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
}

// Internal prompt text is sent to the model in English; the backend auto-detects
// the user's language and replies in it. The visible labels are translated.
const QUICK_PROMPTS = [
  { icon: Utensils, labelKey: 'assistantQuickCook', query: 'What can I cook with what I currently have in my fridge?' },
  { icon: AlertTriangle, labelKey: 'assistantQuickExpiring', query: 'Which items are expiring soon and what should I cook to use them first?' },
  { icon: ShoppingBag, labelKey: 'assistantQuickMissing', query: 'Based on my fridge inventory, what essential groceries am I missing?' },
  { icon: ChefHat, labelKey: 'assistantQuickQuickMeal', query: 'Suggest one quick, easy meal using the ingredients I have.' },
] as const;

export const AssistantChatModal: React.FC<AssistantChatModalProps> = ({
  isOpen,
  onClose,
  inventory,
  settings,
}) => {
  const currentLang = (settings?.language || 'en') as LanguageType;
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  // Reset the conversation whenever the modal is reopened or the language changes.
  useEffect(() => {
    if (isOpen) {
      setMessages([
        { id: 'greeting', role: 'assistant', text: t('assistantGreeting', currentLang) },
      ]);
      setError(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, currentLang]);
  const [input, setInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isSending]);

  useEffect(() => {
    if (isOpen) {
      const id = setTimeout(() => inputRef.current?.focus(), 150);
      return () => clearTimeout(id);
    }
  }, [isOpen]);

  // Close on Escape for accessibility.
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const sendMessage = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || isSending) return;

    setError(null);
    const userMsg: ChatMessage = { id: `user-${Date.now()}`, role: 'user', text: trimmed };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setIsSending(true);

    try {
      const res = await fetch('/api/ai-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: trimmed,
          inventory,
          language: settings?.language || 'en',
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data?.error || 'Request failed');
      }
      setMessages((prev) => [
        ...prev,
        { id: `assistant-${Date.now()}`, role: 'assistant', text: data.reply },
      ]);
    } catch (err) {
      console.error('Assistant chat error:', err);
      setError(t('assistantError', currentLang));
    } finally {
      setIsSending(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  const itemCount = inventory.length;
  const expiringCount = inventory.filter((i) => i.freshness === 'soon_to_expire').length;

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label="ColdScan AI assistant"
    >
      <div className="bg-white w-full max-w-lg h-[90vh] sm:h-[640px] rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col overflow-hidden border border-slate-200">
        {/* Header */}
        <div className="bg-white border-b border-slate-200 px-4 py-3 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-emerald-600 flex items-center justify-center shadow-sm shrink-0">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
              <h2 className="font-black text-sm uppercase tracking-wider text-slate-900">
                {t('assistantTitle', currentLang)}
              </h2>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200">
                {t('assistantBadge', currentLang)}
              </span>
            </div>
              <p className="text-[11px] text-slate-500 font-semibold truncate">
                {expiringCount > 0
                  ? t('assistantFridgeStatusExpiring', currentLang)
                      .replace('__count__', String(itemCount))
                      .replace('__exp__', String(expiringCount))
                  : t('assistantFridgeStatus', currentLang).replace('__count__', String(itemCount))}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close assistant"
            className="p-2 rounded-xl text-slate-500 hover:bg-slate-100 hover:text-slate-900 transition-colors shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Messages */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3 bg-slate-50">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[85%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${
                  msg.role === 'user'
                    ? 'bg-emerald-600 text-white rounded-br-md'
                    : 'bg-white text-slate-800 border border-slate-200 rounded-bl-md shadow-xs'
                }`}
              >
                {msg.text}
              </div>
            </div>
          ))}

          {isSending && (
            <div className="flex justify-start">
              <div className="bg-white border border-slate-200 rounded-2xl rounded-bl-md px-4 py-3 shadow-xs flex items-center gap-2">
                <Loader2 className="w-4 h-4 text-emerald-600 animate-spin" />
                <span className="text-xs font-bold text-slate-500">{t('assistantThinkingChat', currentLang)}</span>
              </div>
            </div>
          )}

          {error && (
            <div className="bg-rose-50 border border-rose-200 text-rose-700 rounded-2xl px-4 py-2.5 text-xs font-semibold">
              {error}
            </div>
          )}
        </div>

        {/* Quick prompts */}
        {messages.length <= 1 && (
          <div className="px-4 pt-3 pb-1 bg-slate-50 border-t border-slate-100 shrink-0">
            <div className="grid grid-cols-2 gap-2">
              {QUICK_PROMPTS.map((p) => {
                const Icon = p.icon;
                return (
                  <button
                    key={p.labelKey}
                    onClick={() => sendMessage(p.query)}
                    disabled={isSending}
                    className="flex items-center gap-2 text-left bg-white border border-slate-200 rounded-2xl px-3 py-2.5 hover:border-emerald-400 hover:bg-emerald-50/50 transition-colors disabled:opacity-50"
                  >
                    <Icon className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span className="text-[11px] font-bold text-slate-700 leading-tight">
                      {t(p.labelKey, currentLang)}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Input */}
        <form onSubmit={handleSubmit} className="border-t border-slate-200 bg-white p-3 shrink-0">
          <div className="flex items-end gap-2">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              rows={1}
              placeholder={t('assistantPlaceholder', currentLang)}
              className="flex-1 resize-none bg-slate-100 border border-slate-200 rounded-2xl px-4 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-400 max-h-28"
            />
            <button
              type="submit"
              disabled={isSending || !input.trim()}
              aria-label="Send message"
              className="w-11 h-11 rounded-2xl bg-emerald-600 text-white flex items-center justify-center hover:bg-emerald-700 active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed shrink-0 shadow-sm"
            >
              {isSending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
