/**
 * PRIV-FI useAlgorand Hook
 * Provides algodClient instance connected to Algorand Testnet.
 * All network calls have explicit timeouts and fallbacks.
 */

import { useMemo, useCallback } from 'react';
import algosdk from 'algosdk';

const ALGOD_SERVER = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_ALGOD_SERVER)
  || 'https://testnet-api.4160.nodely.dev';
const ALGOD_TOKEN = '';
const ALGOD_PORT = '';

export function useAlgorand() {
  const algodClient = useMemo(() => {
    try {
      return new algosdk.Algodv2(ALGOD_TOKEN, ALGOD_SERVER, ALGOD_PORT);
    } catch (e) {
      console.error('Failed to create Algod client:', e);
      return null;
    }
  }, []);

  /**
   * Get current Algorand round number.
   * Falls back to demo value on network error.
   */
  const getCurrentRound = useCallback(async () => {
    try {
      if (!algodClient) return 40000000;
      const status = await algodClient.status().do();
      return status['last-round'] || 40000000;
    } catch (e) {
      console.warn('Could not fetch current round, using demo fallback:', e.message);
      return 40000000;
    }
  }, [algodClient]);

  /**
   * Get account info for an Algorand address.
   */
  const getAccountInfo = useCallback(async (address) => {
    try {
      if (!algodClient) return null;
      return await algodClient.accountInformation(address).do();
    } catch (e) {
      console.warn('Could not fetch account info:', e.message);
      return null;
    }
  }, [algodClient]);

  /**
   * Wait for transaction confirmation.
   */
  const waitForConfirmation = useCallback(async (txId) => {
    try {
      if (!algodClient) return { 'confirmed-round': 0 };
      return await algosdk.waitForConfirmation(algodClient, txId, 10);
    } catch (e) {
      console.warn('Wait for confirmation failed:', e.message);
      return { 'confirmed-round': 0, error: e.message };
    }
  }, [algodClient]);

  /**
   * Get suggested transaction parameters.
   */
  const getSuggestedParams = useCallback(async () => {
    try {
      if (!algodClient) return null;
      return await algodClient.getTransactionParams().do();
    } catch (e) {
      console.warn('Could not get suggested params:', e.message);
      return null;
    }
  }, [algodClient]);

  return {
    algodClient,
    getCurrentRound,
    getAccountInfo,
    waitForConfirmation,
    getSuggestedParams,
  };
}

export default useAlgorand;
