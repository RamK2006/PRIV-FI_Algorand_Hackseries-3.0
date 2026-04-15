/**
 * PRIV-FI useCredential Hook
 * Queries credential data and current Algorand round.
 * Computes time remaining: (expiryRound - currentRound) × 2.9 seconds.
 * Auto-refreshes every 30 seconds.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { useAlgorand } from './useAlgorand';
import { useContracts } from './useContracts';
import { isDemoMode, getDemoCredential } from '../utils/demoMode';

const ALGORAND_BLOCK_TIME = 2.9; // seconds per round
const REFRESH_INTERVAL = 30000; // 30 seconds

export function useCredential() {
  const { state, setCredential, setCurrentRound } = useApp();
  const { getCurrentRound } = useAlgorand();
  const { getCredentialData } = useContracts();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const intervalRef = useRef(null);

  const refresh = useCallback(async () => {
    if (!state.wallet.address && !isDemoMode()) return;

    setLoading(true);
    setError(null);

    try {
      // Get current round
      const round = await getCurrentRound();
      setCurrentRound(round);

      // Get credential data
      const cred = await getCredentialData(
        state.wallet.address || 'DEMO_ADDRESS',
        state.isDemoMode
      );
      setCredential(cred);
    } catch (e) {
      console.warn('Credential refresh error:', e.message);
      setError(e.message);
      // Fallback to demo credential on error
      if (isDemoMode() || state.isDemoMode) {
        setCredential(getDemoCredential());
        setCurrentRound(40000000);
      }
    } finally {
      setLoading(false);
    }
  }, [state.wallet.address, state.isDemoMode, getCurrentRound, getCredentialData, setCredential, setCurrentRound]);

  // Auto-refresh every 30 seconds
  useEffect(() => {
    if (state.wallet.connected || state.isDemoMode) {
      refresh();
      intervalRef.current = setInterval(refresh, REFRESH_INTERVAL);
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [state.wallet.connected, state.isDemoMode]); // eslint-disable-line react-hooks/exhaustive-deps

  // Computed values
  const credential = state.credential;
  const currentRound = state.currentRound || 40000000;

  const isExpired = credential
    ? currentRound > credential.expiryRound
    : true;

  const isValid = credential
    ? credential.exists && !isExpired
    : false;

  const roundsRemaining = credential
    ? Math.max(0, credential.expiryRound - currentRound)
    : 0;

  const secondsRemaining = roundsRemaining * ALGORAND_BLOCK_TIME;

  // Urgency level based on rounds remaining
  // Green > 72,000; Yellow 24,000-72,000; Red < 24,000
  let urgency = 'expired';
  if (isValid) {
    if (roundsRemaining > 72000) urgency = 'green';
    else if (roundsRemaining > 24000) urgency = 'yellow';
    else urgency = 'red';
  }

  return {
    credential,
    currentRound,
    isExpired,
    isValid,
    secondsRemaining,
    roundsRemaining,
    urgency,
    loading,
    error,
    refresh,
  };
}

export default useCredential;
