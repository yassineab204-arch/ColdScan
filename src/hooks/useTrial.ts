import { useCallback, useEffect, useRef, useState } from 'react';
import {
  clockSkew,
  fetchTrialStatus,
  formatRemaining,
  linkTrialEmail,
  markTutorialSeen,
  redeemAccessCode,
  remainingMs,
  TrialStatus,
  UNKNOWN_STATUS,
} from '../utils/trial';

/** How often to re-ask the server for the authoritative status. */
const POLL_MS = 5 * 60 * 1000;
/** How often to re-render the local countdown between polls. */
const TICK_MS = 30 * 1000;

export interface UseTrial {
  /** Server-reported status. */
  status: TrialStatus;
  /** False until the first server response has landed. */
  loaded: boolean;
  /** True when the server could not be reached at all. */
  offline: boolean;
  /** Milliseconds left, anchored to the server clock. */
  msLeft: number;
  /** Pre-formatted countdown, e.g. "1d 4h". */
  timeLeftLabel: string;
  /** Premium features must be hidden/blocked when true. */
  locked: boolean;
  refresh: () => Promise<void>;
  /** Applies a status the server returned from a gated API call (e.g. a 402). */
  applyStatus: (status: TrialStatus) => void;
  redeemCode: (code: string) => Promise<{ ok: boolean; granted?: 'unlock' | 'extend'; hours?: number }>;
  linkEmail: (email: string) => Promise<{ ok: boolean; error?: string }>;
  completeTutorial: () => void;
}

/**
 * Owns the trial state for the whole app.
 *
 * The server is the only source of truth; this hook just mirrors it, keeps a
 * countdown ticking between polls, and re-checks when the tab regains focus
 * (so leaving ColdScan open past the deadline still locks it).
 */
export function useTrial(): UseTrial {
  const [status, setStatus] = useState<TrialStatus>(UNKNOWN_STATUS);
  const [loaded, setLoaded] = useState(false);
  const [offline, setOffline] = useState(false);
  const [, forceTick] = useState(0);
  const skewRef = useRef(0);

  const applyStatus = useCallback((next: TrialStatus) => {
    skewRef.current = clockSkew(next);
    setStatus(next);
    setLoaded(true);
    setOffline(false);
  }, []);

  const refresh = useCallback(async () => {
    const next = await fetchTrialStatus();
    if (next) {
      applyStatus(next);
    } else {
      setOffline(true);
      setLoaded(true);
    }
  }, [applyStatus]);

  // First load + periodic re-check.
  useEffect(() => {
    void refresh();
    const poll = setInterval(() => void refresh(), POLL_MS);
    return () => clearInterval(poll);
  }, [refresh]);

  // Re-check whenever the tab becomes visible again: a session left open
  // overnight must lock as soon as the user comes back.
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') void refresh();
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onVisible);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onVisible);
    };
  }, [refresh]);

  // Local countdown between polls.
  useEffect(() => {
    const tick = setInterval(() => forceTick((n) => n + 1), TICK_MS);
    return () => clearInterval(tick);
  }, []);

  const msLeft = loaded && !offline ? remainingMs(status, skewRef.current) : status.msRemaining;

  // When the local countdown crosses zero, confirm with the server right away
  // rather than waiting for the next poll.
  const expiredLocally = loaded && !status.unlocked && msLeft <= 0;
  useEffect(() => {
    if (expiredLocally && !status.expired) void refresh();
  }, [expiredLocally, status.expired, refresh]);

  const locked = loaded && !status.unlocked && (status.expired || msLeft <= 0);

  const redeemCode = useCallback(
    async (code: string) => {
      const result = await redeemAccessCode(code);
      if (result.ok && result.trial) applyStatus(result.trial);
      return { ok: result.ok, granted: result.granted, hours: result.hours };
    },
    [applyStatus]
  );

  const linkEmail = useCallback(
    async (email: string) => {
      const result = await linkTrialEmail(email);
      if (result.ok && result.trial) applyStatus(result.trial);
      return { ok: result.ok, error: result.error };
    },
    [applyStatus]
  );

  const completeTutorial = useCallback(() => {
    setStatus((prev) => ({ ...prev, tutorialSeen: true }));
    void markTutorialSeen();
  }, []);

  return {
    status,
    loaded,
    offline,
    msLeft,
    timeLeftLabel: formatRemaining(msLeft),
    locked,
    refresh,
    applyStatus,
    redeemCode,
    linkEmail,
    completeTutorial,
  };
}
