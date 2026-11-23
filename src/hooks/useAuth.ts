import { useCallback, useEffect, useState } from 'react';
import {
  fetchAuthState,
  signOutEmail,
  startEmailCode,
  verifyEmailCode,
  type AuthAction,
} from '../utils/auth';
import type { TrialStatus } from '../utils/trial';

export interface UseAuth {
  /** True when this browser has a server-issued email session. */
  authenticated: boolean;
  /** False until the first /api/auth response has landed. */
  loaded: boolean;
  /** Emails a one-time code. Never changes access. */
  start: (email: string) => Promise<AuthAction>;
  /** Verifies the code; on success the server returns an authoritative status. */
  verify: (email: string, token: string) => Promise<AuthAction>;
  /** Ends this browser's email session without touching the trial. */
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
}

/**
 * Mirrors the server's email-session state.
 *
 * The session itself is an HttpOnly cookie, so this hook cannot read or forge
 * it; it only remembers what `/api/auth` last reported. Verification results
 * carry a fresh trial status, which is handed back to `useTrial` so the UI and
 * the server never disagree.
 */
export function useAuth(
  onTrialStatus: (status: TrialStatus) => void,
  /**
   * Wait until the trial hook has completed its first request. Both endpoints
   * create the account on first contact, so firing them in parallel on a brand
   * new browser could create two accounts and then disagree about which cookie
   * the page holds. Sequencing keeps them on the same account.
   */
  enabled = true
): UseAuth {
  const [authenticated, setAuthenticated] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const refresh = useCallback(async () => {
    const state = await fetchAuthState();
    if (state !== null) setAuthenticated(state);
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!enabled) return;
    void refresh();
  }, [enabled, refresh]);

  const start = useCallback((email: string) => startEmailCode(email), []);

  const verify = useCallback(
    async (email: string, token: string) => {
      const result = await verifyEmailCode(email, token);
      if (result.ok) {
        setAuthenticated(true);
        if (result.trial) onTrialStatus(result.trial);
      }
      return result;
    },
    [onTrialStatus]
  );

  const signOut = useCallback(async () => {
    const result = await signOutEmail();
    if (result.ok) {
      setAuthenticated(false);
      if (result.trial) onTrialStatus(result.trial);
    }
  }, [onTrialStatus]);

  return { authenticated, loaded, start, verify, signOut, refresh };
}
