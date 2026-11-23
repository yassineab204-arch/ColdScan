import React, { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { ArrowRight, Loader2, MailCheck, ShieldCheck, X } from 'lucide-react';
import { LanguageType } from '../../types';
import { t } from '../../utils/i18n';
import type { AuthErrorCode } from '../../utils/auth';
import type { UseAuth } from '../../hooks/useAuth';

interface EmailOtpSheetProps {
  isOpen: boolean;
  lang: LanguageType;
  auth: UseAuth;
  /** 'scan' | 'recipe' | 'voice' when the free preview ran out; null for a normal sign-in. */
  reason?: string | null;
  onClose: () => void;
  /** Called after the server has verified the code. */
  onVerified: () => void;
}

/** Seconds before the user may ask for another code. */
const RESEND_SECONDS = 30;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

const ease = [0.22, 1, 0.36, 1] as const;

/**
 * Two-step passwordless sign-in: email, then the one-time code.
 *
 * This component renders what the server reports and nothing else. It cannot
 * mark an address as verified, cannot set a cookie, and never sees a Supabase
 * key or token. `onVerified` fires only after `/api/auth` returned success.
 */
export const EmailOtpSheet: React.FC<EmailOtpSheetProps> = ({
  isOpen,
  lang,
  auth,
  reason,
  onClose,
  onVerified,
}) => {
  const reduce = useReducedMotion();

  const [step, setStep] = useState<'email' | 'code'>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState<{ phase: 'start' | 'verify'; code: AuthErrorCode } | null>(null);
  const [cooldown, setCooldown] = useState(0);

  // Reset when the sheet is closed so a different address can be used.
  useEffect(() => {
    if (isOpen) return;
    setStep('email');
    setEmail('');
    setCode('');
    setError(null);
    setSending(false);
    setVerifying(false);
    setCooldown(0);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || cooldown <= 0) return;
    const timer = setInterval(() => setCooldown((value) => Math.max(0, value - 1)), 1000);
    return () => clearInterval(timer);
  }, [isOpen, cooldown]);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  const errorMessage = useMemo(() => {
    if (!error) return '';
    if (error.code === 'rate_limited') return t('emailOtpRateLimited', lang);
    if (error.code === 'invalid_email') return t('trialEmailInvalid', lang);
    if (error.code === 'unavailable' || error.code === 'network') {
      return error.phase === 'start'
        ? t('emailOtpSendError', lang)
        : t('emailOtpUnavailable', lang);
    }
    if (error.phase === 'verify') return t('emailOtpInvalid', lang);
    return t('emailOtpSendError', lang);
  }, [error, lang]);

  if (!isOpen) return null;

  const validEmail = EMAIL_RE.test(email.trim());

  const requestCode = async (isResend = false) => {
    if (!validEmail || sending) return;
    setSending(true);
    setError(null);
    try {
      const result = await auth.start(email.trim());
      if (!result.ok) {
        setError({ phase: 'start', code: result.error ?? 'unavailable' });
        return;
      }
      if (!isResend) setStep('code');
      setCode('');
      setCooldown(RESEND_SECONDS);
    } finally {
      setSending(false);
    }
  };

  const submitEmail = async (event: React.FormEvent) => {
    event.preventDefault();
    await requestCode(false);
  };

  const submitCode = async (event: React.FormEvent) => {
    event.preventDefault();
    const token = code.replace(/\s+/g, '');
    if (token.length < 4 || verifying) return;

    setVerifying(true);
    setError(null);
    try {
      const result = await auth.verify(email.trim(), token);
      if (!result.ok) {
        setError({ phase: 'verify', code: result.error ?? 'invalid_code' });
        return;
      }
      onVerified();
      onClose();
    } finally {
      setVerifying(false);
    }
  };

  const changeEmail = () => {
    setStep('email');
    setCode('');
    setError(null);
    setCooldown(0);
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={reduce ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[60] flex items-end justify-center bg-slate-900/50 p-0 backdrop-blur-sm sm:items-center sm:p-4"
        onClick={onClose}
      >
        <motion.div
          role="dialog"
          aria-modal="true"
          aria-labelledby="coldscan-email-otp-title"
          initial={reduce ? false : { opacity: 0, y: 28 }}
          animate={{ opacity: 1, y: 0 }}
          exit={reduce ? undefined : { opacity: 0, y: 28 }}
          transition={{ duration: 0.32, ease }}
          onClick={(event) => event.stopPropagation()}
          className="w-full max-w-md overflow-hidden rounded-t-3xl bg-white shadow-[0_30px_80px_-30px_rgba(11,61,46,0.55)] ring-1 ring-ink/[0.06] sm:rounded-3xl"
        >
          <div className="relative bg-gradient-to-b from-mint to-white px-6 pb-5 pt-7">
            <button
              onClick={onClose}
              aria-label={t('close', lang)}
              className="absolute right-4 top-4 rounded-full p-1.5 text-ink/40 transition-colors hover:bg-white/70 hover:text-pine"
            >
              <X className="h-5 w-5" strokeWidth={2.4} />
            </button>

            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-pine text-cold shadow-[0_14px_30px_-14px_rgba(11,61,46,0.7)]">
              {step === 'email' ? (
                <MailCheck className="h-6 w-6" strokeWidth={2.3} />
              ) : (
                <ShieldCheck className="h-6 w-6" strokeWidth={2.3} />
              )}
            </span>

            <h2
              id="coldscan-email-otp-title"
              className="mt-4 text-xl font-extrabold tracking-[-0.02em] text-pine"
            >
              {step === 'email'
                ? reason
                  ? t('previewLimitTitle', lang)
                  : t('emailOtpTitle', lang)
                : t('emailOtpCodeTitle', lang)}
            </h2>
            <p className="mt-2 text-sm font-medium leading-relaxed text-ink/65">
              {step === 'email'
                ? reason
                  ? t('previewLimitBody', lang)
                  : t('emailOtpBody', lang)
                : t('emailOtpCodeBody', lang).replace('__email__', email.trim())}
            </p>
          </div>

          {step === 'email' ? (
            <form onSubmit={submitEmail} className="space-y-4 px-6 pb-6">
              <div>
                <label
                  htmlFor="coldscan-otp-email"
                  className="text-[11px] font-bold uppercase tracking-[0.14em] text-ink/50"
                >
                  {t('emailOtpEmailLabel', lang)}
                </label>
                <input
                  id="coldscan-otp-email"
                  type="email"
                  value={email}
                  onChange={(event) => {
                    setEmail(event.target.value);
                    setError(null);
                  }}
                  placeholder={t('trialEmailPlaceholder', lang)}
                  autoComplete="email"
                  inputMode="email"
                  spellCheck={false}
                  autoFocus
                  className="mt-2 w-full rounded-2xl bg-white px-4 py-3.5 text-sm font-semibold text-pine ring-1 ring-ink/10 outline-none transition-shadow placeholder:text-ink/35 focus:ring-cold"
                />
              </div>

              {errorMessage && (
                <p className="text-xs font-semibold text-red-600" role="alert">
                  {errorMessage}
                </p>
              )}

              <button
                type="submit"
                disabled={!validEmail || sending}
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-cold px-5 py-3.5 text-sm font-extrabold text-pine-deep shadow-[0_16px_36px_-16px_rgba(34,197,94,0.8)] transition-all hover:bg-cold/90 active:scale-[0.99] disabled:opacity-50"
              >
                {sending ? (
                  <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2.6} />
                ) : (
                  <>
                    {t('emailOtpSend', lang)}
                    <ArrowRight className="h-4 w-4" strokeWidth={2.6} />
                  </>
                )}
              </button>

              <p className="text-[11px] leading-relaxed text-ink/45">{t('emailOtpPrivacy', lang)}</p>
            </form>
          ) : (
            <form onSubmit={submitCode} className="space-y-4 px-6 pb-6">
              <div>
                <label
                  htmlFor="coldscan-otp-code"
                  className="text-[11px] font-bold uppercase tracking-[0.14em] text-ink/50"
                >
                  {t('emailOtpCodeLabel', lang)}
                </label>
                <input
                  id="coldscan-otp-code"
                  value={code}
                  onChange={(event) => {
                    setCode(event.target.value.replace(/[^\d]/g, '').slice(0, 10));
                    setError(null);
                  }}
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  pattern="[0-9]*"
                  maxLength={10}
                  autoFocus
                  placeholder="••••••••"
                  className="mt-2 w-full rounded-2xl bg-white px-4 py-3.5 text-center text-lg font-extrabold tracking-[0.35em] text-pine ring-1 ring-ink/10 outline-none transition-shadow placeholder:tracking-[0.35em] placeholder:text-ink/25 focus:ring-cold"
                />
                <p className="mt-2 text-[11px] font-medium text-ink/45">{t('emailOtpExpiryHint', lang)}</p>
              </div>

              {errorMessage && (
                <p className="text-xs font-semibold text-red-600" role="alert">
                  {errorMessage}
                </p>
              )}

              <button
                type="submit"
                disabled={code.length < 4 || verifying}
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-pine px-5 py-3.5 text-sm font-extrabold text-cold transition-all hover:bg-pine-light active:scale-[0.99] disabled:opacity-50"
              >
                {verifying ? (
                  <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2.6} />
                ) : (
                  t('emailOtpVerify', lang)
                )}
              </button>

              <div className="flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={changeEmail}
                  className="text-xs font-bold text-ink/50 transition-colors hover:text-pine"
                >
                  {t('emailOtpChangeEmail', lang)}
                </button>
                <button
                  type="button"
                  onClick={() => void requestCode(true)}
                  disabled={sending || cooldown > 0}
                  className="text-xs font-bold text-cold-dark transition-colors hover:text-pine disabled:text-ink/35"
                >
                  {cooldown > 0
                    ? t('emailOtpResendWait', lang).replace('__seconds__', String(cooldown))
                    : t('emailOtpResend', lang)}
                </button>
              </div>
            </form>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};
