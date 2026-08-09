import React from 'react';
import { 
  Settings, 
  DollarSign, 
  Volume2, 
  Sparkles, 
  Bell, 
  Utensils, 
  RotateCcw, 
  CheckCircle2,
  ShieldCheck,
  Globe
} from 'lucide-react';
import { AppSettings, LanguageType } from '../../types';
import { t } from '../../utils/i18n';

interface SettingsScreenProps {
  settings: AppSettings;
  onUpdateSettings: (newSettings: Partial<AppSettings>) => void;
  onResetData: () => void;
}

const DIETARY_OPTIONS = [
  'Low Waste',
  'Vegetarian',
  'Vegan',
  'Gluten-Free',
  'Low-Carb',
  'Dairy-Free',
  'Keto',
  'High Protein',
];

const VOICES = [
  { id: 'Zephyr', name: 'Zephyr (Warm & Calming)' },
  { id: 'Kore', name: 'Kore (Friendly & Clear)' },
  { id: 'Puck', name: 'Puck (Upbeat)' },
  { id: 'Fenrir', name: 'Fenrir (Deep Voice)' },
  { id: 'Charon', name: 'Charon (Smooth Tone)' },
];

export const SettingsScreen: React.FC<SettingsScreenProps> = ({
  settings,
  onUpdateSettings,
  onResetData,
}) => {
  const toggleDietary = (item: string) => {
    const current = settings.dietaryPreferences;
    const updated = current.includes(item)
      ? current.filter((i) => i !== item)
      : [...current, item];
    onUpdateSettings({ dietaryPreferences: updated });
  };

  const lang = (settings.language || 'en') as LanguageType;

  return (
    <div className="space-y-4 pb-20 max-w-md mx-auto text-slate-800 text-sm">
      
      {/* Page Title Card */}
      <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-xs">
        <h2 className="text-3xl font-black tracking-tighter leading-none text-slate-900">
          {t('settingsTitle', lang)}
        </h2>
        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mt-1">
          {t('settingsSubtitleHeader', lang)}
        </p>
      </div>

      {/* Settings Card */}
      <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-xs space-y-4">
        
        {/* Language Selection */}
        <div className="space-y-2 pt-3 border-t border-slate-100">
          <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 flex items-center gap-1.5">
            <Globe className="w-4 h-4 text-emerald-600" />
            {t('languageLabel', lang)}
          </label>
          <div className="grid grid-cols-3 gap-2">
            {[
              { id: 'en' as LanguageType, label: 'English', flag: '🇬🇧' },
              { id: 'fr' as LanguageType, label: 'Français', flag: '🇫🇷' },
              { id: 'ar-MA' as LanguageType, label: 'الدارجة', flag: '🇲🇦' },
              { id: 'es' as LanguageType, label: 'Español', flag: '🇪🇸' },
              { id: 'de' as LanguageType, label: 'Deutsch', flag: '🇩🇪' },
              { id: 'ar' as LanguageType, label: 'العربية', flag: '🇸🇦' },
              { id: 'it' as LanguageType, label: 'Italiano', flag: '🇮🇹' },
              { id: 'pt' as LanguageType, label: 'Português', flag: '🇵🇹' },
              { id: 'ja' as LanguageType, label: '日本語', flag: '🇯🇵' },
            ].map((lang) => (
              <button
                key={lang.id}
                type="button"
                onClick={() => onUpdateSettings({ language: lang.id })}
                className={`py-2 px-2 rounded-2xl border text-[11px] font-black flex items-center justify-center gap-1 transition-all ${
                  (settings.language || 'en') === lang.id
                    ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                    : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                <span>{lang.flag}</span>
                <span className="truncate">{lang.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Currency Setting */}
        <div className="space-y-2 pt-3 border-t border-slate-100">
          <div className="flex items-center justify-between">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 flex items-center gap-1.5">
              <DollarSign className="w-4 h-4 text-emerald-600" />
              Preferred Currency
            </label>
            <select
              value={settings.currency || 'DH'}
              onChange={(e) => onUpdateSettings({ currency: e.target.value })}
              className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-black text-slate-800"
            >
              <option value="DH">DH (Dirhams)</option>
              <option value="MAD">MAD (Moroccan Dirham)</option>
              <option value="$">$ (USD)</option>
              <option value="€">€ (EUR)</option>
              <option value="£">£ (GBP)</option>
            </select>
          </div>
        </div>

        {/* Waste Alert Threshold */}
        <div className="space-y-1.5 pt-3 border-t border-slate-100">
          <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 flex items-center gap-1.5">
            <Bell className="w-4 h-4 text-amber-600" />
            Expiry Alert Threshold
          </label>
          <select
            value={settings.wasteAlertDays}
            onChange={(e) => onUpdateSettings({ wasteAlertDays: Number(e.target.value) })}
            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-slate-800 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            <option value={1}>Warn 1 day before expiry</option>
            <option value={2}>Warn 2 days before expiry</option>
            <option value={3}>Warn 3 days before expiry (Default)</option>
            <option value={5}>Warn 5 days before expiry</option>
          </select>
        </div>

        {/* Voice Assistant Preferences */}
        <div className="space-y-3 pt-3 border-t border-slate-100">
          <div className="flex items-center justify-between">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 flex items-center gap-1.5">
              <Volume2 className="w-4 h-4 text-emerald-600" />
              Enable Voice Responses
            </label>
            <input
              type="checkbox"
              checked={settings.voiceOutputEnabled}
              onChange={(e) => onUpdateSettings({ voiceOutputEnabled: e.target.checked })}
              className="w-5 h-5 accent-emerald-600 rounded"
            />
          </div>

          {settings.voiceOutputEnabled && (
            <div className="space-y-1">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Gemini Voice Persona</span>
              <select
                value={settings.voiceName}
                onChange={(e) => onUpdateSettings({ voiceName: e.target.value })}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-slate-800 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                {VOICES.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Dietary Preferences */}
        <div className="space-y-2 pt-3 border-t border-slate-100">
          <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 flex items-center gap-1.5">
            <Utensils className="w-4 h-4 text-emerald-600" />
            Dietary Preferences & Goals
          </label>
          <div className="flex flex-wrap gap-1.5">
            {DIETARY_OPTIONS.map((item) => {
              const isSelected = settings.dietaryPreferences.includes(item);
              return (
                <button
                  key={item}
                  onClick={() => toggleDietary(item)}
                  className={`px-3 py-1.5 rounded-xl text-[10px] font-black tracking-wider uppercase border transition-all ${
                    isSelected
                      ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                      : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  {item} {isSelected ? '✓' : ''}
                </button>
              );
            })}
          </div>
        </div>

      </div>

      {/* Data Management Card */}
      <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-xs space-y-3">
        <h3 className="font-black text-slate-900 text-sm uppercase tracking-tight">Demo Data & Storage</h3>
        <p className="text-xs text-slate-500 leading-relaxed font-medium">
          Reset ColdScan to initial refrigerator inventory, recipes, and shopping list state for testing.
        </p>
        <button
          onClick={onResetData}
          className="w-full py-3 px-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 font-black text-xs uppercase tracking-widest hover:bg-rose-100 flex items-center justify-center gap-2 transition-colors"
        >
          <RotateCcw className="w-4 h-4" />
          Reset Demo Data
        </button>
      </div>

    </div>
  );
};
