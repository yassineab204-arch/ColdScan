import React from 'react';
import { 
  Settings, 
  DollarSign, 
  Volume2, 
  Sparkles, 
  Bell, 
  Utensils, 
  UtensilsCrossed, 
  RotateCcw, 
  CheckCircle2,
  ShieldCheck,
  Globe,
  LogOut,
  MailCheck,
  ArrowRight
} from 'lucide-react';
import { AppSettings, CuisineType, LanguageType } from '../../types';
import { t } from '../../utils/i18n';
import type { PreviewUses } from '../../utils/trial';
import { CuisinePicker } from '../CuisinePicker';

interface SettingsScreenProps {
  settings: AppSettings;
  onUpdateSettings: (newSettings: Partial<AppSettings>) => void;
  onResetData: () => void;
  /** Pre-formatted countdown from the server-anchored clock, e.g. "1d 4h". */
  trialTimeLeftLabel?: string;
  /** Milliseconds left in the trial (0 when it has ended). */
  trialMsLeft?: number;
  /** True when the user redeemed an access code. */
  trialUnlocked?: boolean;
  /** ISO expiry computed by the server. */
  trialExpiresAt?: string;
  /** True while the visitor is in the anonymous free preview. */
  trialPreview?: boolean;
  /** Free tries left for scanning, recipes and the voice helper. */
  previewRemaining?: PreviewUses;
  /** True once an email has been verified with a one-time code. */
  trialEmailLinked?: boolean;
  /** True when this browser has a live email session. */
  authAuthenticated?: boolean;
  /** Opens the email OTP sheet. Verification happens on the server. */
  onVerifyEmail?: () => void;
  /** Opens the sheet that starts the 48-hour trial after verification. */
  onUnlockTrial?: () => void;
  /** Ends this browser's email session; the trial is untouched. */
  onSignOut?: () => void;
  onReplayTutorial?: () => void;
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

// Contact links
const INSTAGRAM_URL = 'https://www.instagram.com/cold.scan/';
const BUSINESS_EMAIL = 'yassineab2014@gmail.com';

export const SettingsScreen: React.FC<SettingsScreenProps> = ({
  settings,
  onUpdateSettings,
  onResetData,
  trialTimeLeftLabel = '',
  trialMsLeft = 0,
  trialUnlocked = false,
  trialExpiresAt = '',
  trialPreview = false,
  previewRemaining = { scan: 2, recipe: 2, voice: 2 },
  trialEmailLinked = false,
  authAuthenticated = false,
  onVerifyEmail,
  onUnlockTrial,
  onSignOut,
  onReplayTutorial,
}) => {
  const trialEnded = !trialUnlocked && !trialPreview && trialMsLeft <= 0;
  const trialUrgent =
    !trialUnlocked && !trialPreview && trialMsLeft > 0 && trialMsLeft <= 6 * 60 * 60 * 1000;

  const expiresLabel = (() => {
    const parsed = Date.parse(trialExpiresAt);
    if (Number.isNaN(parsed)) return '';
    return new Date(parsed).toLocaleString(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
  })();

  const toggleDietary = (item: string) => {
    const current = settings.dietaryPreferences;
    const updated = current.includes(item)
      ? current.filter((i) => i !== item)
      : [...current, item];
    onUpdateSettings({ dietaryPreferences: updated });
  };

  const toggleCuisine = (cuisine: CuisineType) => {
    const current = settings.favoriteCuisines || [];
    const updated = current.includes(cuisine)
      ? current.filter((c) => c !== cuisine)
      : [...current, cuisine];
    onUpdateSettings({ favoriteCuisines: updated });
  };

  const lang = (settings.language || 'en') as LanguageType;

  return (
    <div className="space-y-4 pb-20 max-w-md mx-auto text-slate-800 text-sm">
      
      {/* Page Title Card */}
      <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-xs">
        <h2 className="text-2xl sm:text-3xl font-black tracking-tighter leading-none text-slate-900">
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
            <Globe className="w-4 h-4 text-cold-dark" />
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
                    ? 'bg-cold text-pine-deep border-cold shadow-xs'
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
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 flex items-center gap-1.5">
              <DollarSign className="w-4 h-4 text-cold-dark shrink-0" />
              {t('preferredCurrency', lang)}
            </label>
            <select
              value={settings.currency || 'DH'}
              onChange={(e) => onUpdateSettings({ currency: e.target.value })}
              className="w-full sm:w-auto px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-black text-slate-800"
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
            {t('expiryAlert', lang)}
          </label>
          <select
            value={settings.wasteAlertDays}
            onChange={(e) => onUpdateSettings({ wasteAlertDays: Number(e.target.value) })}
            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-slate-800 text-xs focus:outline-none focus:ring-2 focus:ring-cold"
          >
            <option value={1}>{t('warn1Day', lang)}</option>
            <option value={2}>{t('warn2Days', lang)}</option>
            <option value={3}>{t('warn3Days', lang)}</option>
            <option value={5}>{t('warn5Days', lang)}</option>
          </select>
        </div>

        {/* Voice Assistant Preferences */}
        <div className="space-y-3 pt-3 border-t border-slate-100">
          <div className="flex items-start justify-between gap-3">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 flex items-start gap-1.5">
              <Volume2 className="w-4 h-4 text-cold-dark shrink-0" />
              {t('voiceResponses', lang)}
            </label>
            <input
              type="checkbox"
              checked={settings.voiceOutputEnabled}
              onChange={(e) => onUpdateSettings({ voiceOutputEnabled: e.target.checked })}
              className="w-5 h-5 accent-cold rounded"
            />
          </div>

          {settings.voiceOutputEnabled && (
            <div className="space-y-1">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">{t('voicePersona', lang)}</span>
              <select
                value={settings.voiceName}
                onChange={(e) => onUpdateSettings({ voiceName: e.target.value })}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-slate-800 text-xs focus:outline-none focus:ring-2 focus:ring-cold"
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
            <Utensils className="w-4 h-4 text-cold-dark" />
            {t('dietaryGoals', lang)}
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
                      ? 'bg-cold text-pine-deep border-cold shadow-xs'
                      : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  {item} {isSelected ? '✓' : ''}
                </button>
              );
            })}
          </div>
        </div>

        {/* Favorite Cuisines */}
        <div className="space-y-2 pt-3 border-t border-slate-100">
          <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 flex items-center gap-1.5">
            <UtensilsCrossed className="w-4 h-4 text-cold-dark" />
            {t('cuisinesLabel', lang)}
          </label>
          <p className="text-[11px] text-slate-500 leading-relaxed font-medium">
            {t('cuisinesHint', lang)}
          </p>
          <CuisinePicker
            selected={settings.favoriteCuisines || []}
            onToggle={toggleCuisine}
            lang={lang}
            className="justify-start"
          />
          {(settings.favoriteCuisines || []).length === 0 && (
            <p className="text-[11px] text-slate-400 font-bold italic">
              {t('cuisinesEmpty', lang)}
            </p>
          )}
        </div>

        {/* Contact & Links */}
        <div className="space-y-2 pt-3 border-t border-slate-100">
          <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">
            {t('contactLinks', lang)}
          </label>
          <div className="flex flex-col gap-2 pt-2">
            <a
              href={INSTAGRAM_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="px-3 py-2 rounded-xl text-[13px] font-black uppercase border bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100 inline-flex items-center gap-3"
            >
              Instagram — @cold.scan
            </a>

            <a
              href={`mailto:${BUSINESS_EMAIL}?subject=ColdScan%20Business%20Inquiry`}
              className="px-3 py-2 rounded-xl text-[13px] font-black uppercase border bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100 inline-flex items-center gap-3 break-all"
            >
              Business Email — {BUSINESS_EMAIL}
            </a>
          </div>
        </div>

      </div>

      {/* Access / Free trial Card */}
      <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-xs space-y-3">
        <h3 className="font-black text-slate-900 text-sm uppercase tracking-tight flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-cold-dark" />
          {t('trialKeepAccess', lang)}
        </h3>

        <div
          className={`rounded-2xl px-4 py-3 text-xs font-black uppercase tracking-wider ${
            trialUnlocked || trialPreview
              ? 'bg-mint text-pine'
              : trialEnded
                ? 'bg-rose-50 text-rose-700'
                : trialUrgent
                  ? 'bg-amber-50 text-amber-800'
                  : 'bg-mint text-pine'
          }`}
        >
          {trialUnlocked
            ? t('trialFullAccess', lang)
            : trialPreview
              ? t('previewBanner', lang)
                  .replace('__scan__', String(previewRemaining.scan))
                  .replace('__recipe__', String(previewRemaining.recipe))
                  .replace('__voice__', String(previewRemaining.voice))
              : trialEnded
                ? t('trialEndedTitle', lang)
                : t('trialBannerTime', lang).replace('__time__', trialTimeLeftLabel)}
        </div>

        {trialPreview && onUnlockTrial && (
          <button
            type="button"
            onClick={onUnlockTrial}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-cold px-4 py-3 text-sm font-extrabold text-pine-deep shadow-[0_16px_36px_-16px_rgba(34,197,94,0.8)] transition-all hover:bg-cold/90 active:scale-[0.99]"
          >
            {t('previewUnlock', lang)}
            <ArrowRight className="h-4 w-4" strokeWidth={2.6} />
          </button>
        )}

        {/* Server-computed expiry, so there is no ambiguity about the deadline. */}
        {!trialUnlocked && !trialPreview && expiresLabel && (
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
            {t('trialExpiresAt', lang).replace('__date__', expiresLabel)}
          </p>
        )}

        {/* Verified email = portable access. Verification happens via OTP only. */}
        {!trialUnlocked && onVerifyEmail && (
          trialEmailLinked ? (
            <div className="rounded-2xl bg-mint border border-cold/25 px-4 py-3 space-y-2">
              <div className="flex items-center gap-2 text-xs font-bold text-pine">
                <MailCheck className="w-4 h-4 shrink-0 text-cold-dark" strokeWidth={2.5} />
                <span className="flex-1">{t('emailOtpVerified', lang)}</span>
                {authAuthenticated && (
                  <span className="rounded-full bg-white/70 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-pine">
                    {t('emailOtpSignedIn', lang)}
                  </span>
                )}
              </div>
              {authAuthenticated ? (
                <button
                  type="button"
                  onClick={onSignOut}
                  className="inline-flex items-center gap-1.5 text-[11px] font-bold text-ink/50 transition-colors hover:text-pine"
                >
                  <LogOut className="w-3.5 h-3.5" strokeWidth={2.5} />
                  {t('emailOtpSignOut', lang)}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={onVerifyEmail}
                  className="inline-flex items-center gap-1.5 text-[11px] font-bold text-pine transition-colors hover:text-pine-light"
                >
                  {t('emailOtpTitle', lang)}
                  <ArrowRight className="w-3.5 h-3.5" strokeWidth={2.5} />
                </button>
              )}
            </div>
          ) : (
            <div className="rounded-2xl bg-slate-50 border border-slate-200 p-3 space-y-2.5">
              <p className="text-xs text-slate-500 leading-relaxed font-medium">
                {t('trialSaveAccountHint', lang)}
              </p>
              <button
                type="button"
                onClick={onVerifyEmail}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-pine px-4 py-2.5 text-[11px] font-black uppercase tracking-widest text-cold transition-colors hover:bg-pine-light"
              >
                {t('emailOtpTitle', lang)}
                <ArrowRight className="w-3.5 h-3.5" strokeWidth={2.6} />
              </button>
            </div>
          )
        )}

        {!trialUnlocked && (
          <>
            <p className="text-xs text-slate-500 leading-relaxed font-medium">
              {t('trialEndedBody', lang).replace('__hours__', '48')}
            </p>
            <div className="flex flex-col gap-2">
              <a
                href={INSTAGRAM_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full py-3 px-4 rounded-2xl bg-cold text-pine-deep font-black text-xs uppercase tracking-widest hover:bg-cold/90 flex items-center justify-center gap-2"
              >
                {t('trialContactInstagram', lang)}
              </a>
              <a
                href={`mailto:${BUSINESS_EMAIL}?subject=ColdScan%20access%20request`}
                className="w-full py-3 px-4 rounded-2xl bg-slate-50 border border-slate-200 text-slate-700 font-black text-xs uppercase tracking-widest hover:bg-slate-100 flex items-center justify-center gap-2"
              >
                {t('trialContactEmail', lang)}
              </a>
            </div>
          </>
        )}

        {onReplayTutorial && (
          <button
            onClick={onReplayTutorial}
            className="w-full py-3 px-4 rounded-2xl bg-slate-50 border border-slate-200 text-slate-700 font-black text-xs uppercase tracking-widest hover:bg-slate-100 flex items-center justify-center gap-2"
          >
            <Sparkles className="w-4 h-4" />
            {t('tourReplay', lang)}
          </button>
        )}
      </div>

      {/* Data Management Card */}
      <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-xs space-y-3">
        <h3 className="font-black text-slate-900 text-sm uppercase tracking-tight">{t('demoData', lang)}</h3>
        <p className="text-xs text-slate-500 leading-relaxed font-medium">
          {t('resetDataDescription', lang)}
        </p>
        <button
          onClick={onResetData}
          className="w-full py-3 px-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 font-black text-xs uppercase tracking-widest hover:bg-rose-100 flex items-center justify-center gap-3"
        >
          <RotateCcw className="w-4 h-4" />
          {t('resetDemoData', lang)}
        </button>
      </div>

    </div>
  );
};
