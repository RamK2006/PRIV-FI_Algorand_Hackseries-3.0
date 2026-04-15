/**
 * PRIV-FI useContracts Hook
 * All contract interactions using algosdk.
 * Reads app IDs from addresses.json.
 * Demo mode returns mock responses — no deployment required.
 */

import { useCallback } from 'react';
import algosdk from 'algosdk';
import { useAlgorand } from './useAlgorand';
import { isDemoMode, getDemoProof, getDemoCredential } from '../utils/demoMode';
import addresses from '../contracts/addresses.json';

export function useContracts() {
  const { algodClient, waitForConfirmation: waitForConf } = useAlgorand();

  /**
   * Verify proof and issue credential on ProofRegistry.
   * Demo mode: returns mock transaction ID.
   * Real mode: ApplicationCallTxn to ProofRegistry.
   */
  const verifyAndIssue = useCallback(async (walletAddress, sk, proofData, demoMode) => {
    if (demoMode || isDemoMode()) {
      // Simulate network delay
      await new Promise(r => setTimeout(r, 1500));
      return {
        txId: 'DEMO_TX_' + Date.now().toString(36),
        confirmed: true,
        demo: true,
      };
    }

    try {
      if (!algodClient || !addresses.ProofRegistry) {
        throw new Error('Contract not deployed. Use demo mode.');
      }

      const sp = await algodClient.getTransactionParams().do();
      const appId = addresses.ProofRegistry;

      // Parse public inputs from proof
      const pi = proofData.publicInputs;
      const balanceOk = parseInt(pi[0]) || 0;
      const incomeOk = parseInt(pi[1]) || 0;
      const regularityOk = parseInt(pi[2]) || 0;
      const nullifier = pi[3] || '0x' + Date.now().toString(16).padStart(64, '0');
      const expiryRound = parseInt(pi[4], 16) || parseInt(pi[4]) || 40208000;
      const fipCertHash = pi[5] || '0x' + 'cafe'.repeat(16);

      // Encode arguments
      const nullifierBytes = new Uint8Array(32);
      const nullifierHex = nullifier.startsWith('0x') ? nullifier.slice(2) : nullifier;
      for (let i = 0; i < 32 && i * 2 < nullifierHex.length; i++) {
        nullifierBytes[i] = parseInt(nullifierHex.substr(i * 2, 2), 16);
      }

      const expiryBytes = new Uint8Array(8);
      const view = new DataView(expiryBytes.buffer);
      view.setBigUint64(0, BigInt(expiryRound), false);

      const certHashBytes = new Uint8Array(32);
      const certHex = fipCertHash.startsWith('0x') ? fipCertHash.slice(2) : fipCertHash;
      for (let i = 0; i < 32 && i * 2 < certHex.length; i++) {
        certHashBytes[i] = parseInt(certHex.substr(i * 2, 2), 16);
      }

      const proofBytes = proofData.proof instanceof Uint8Array
        ? proofData.proof
        : new Uint8Array(proofData.proof || []);

      const appArgs = [
        new TextEncoder().encode('verify_and_issue'),
        new Uint8Array([balanceOk]),
        new Uint8Array([incomeOk]),
        new Uint8Array([regularityOk]),
        nullifierBytes,
        expiryBytes,
        certHashBytes,
        proofBytes,
      ];

      // Build the box references for the nullifier and credential
      const senderPk = algosdk.decodeAddress(walletAddress).publicKey;

      const txn = algosdk.makeApplicationCallTxnFromObject({
        from: walletAddress,
        suggestedParams: sp,
        appIndex: appId,
        appArgs,
        boxes: [
          { appIndex: appId, name: new Uint8Array([...new TextEncoder().encode('null:'), ...nullifierBytes]) },
          { appIndex: appId, name: new Uint8Array([...new TextEncoder().encode('cred:'), ...senderPk]) },
        ],
      });

      const signedTxn = txn.signTxn(sk);
      const { txId } = await algodClient.sendRawTransaction(signedTxn).do();
      const result = await waitForConf(txId);

      return {
        txId,
        confirmed: result['confirmed-round'] > 0,
        demo: false,
      };
    } catch (e) {
      console.error('verifyAndIssue error:', e);
      throw e;
    }
  }, [algodClient, waitForConf]);

  /**
   * Get credential data from ProofRegistry box storage.
   * Demo mode: returns hardcoded passing credential.
   */
  const getCredentialData = useCallback(async (walletAddress, demoMode) => {
    if (demoMode || isDemoMode()) {
      return getDemoCredential();
    }

    try {
      if (!algodClient || !addresses.ProofRegistry) {
        return getDemoCredential();
      }

      const appId = addresses.ProofRegistry;
      const pubKey = algosdk.decodeAddress(walletAddress).publicKey;
      const boxKey = new Uint8Array([...new TextEncoder().encode('cred:'), ...pubKey]);

      const boxResult = await algodClient.getApplicationBoxByName(appId, boxKey).do();
      const data = boxResult.value;

      if (!data || data.length < 72) {
        return { exists: false };
      }

      const view = new DataView(data.buffer || new Uint8Array(data).buffer);

      return {
        balanceOk: Number(view.getBigUint64(0, false)) > 0,
        incomeOk: Number(view.getBigUint64(8, false)) > 0,
        regularityOk: Number(view.getBigUint64(16, false)) > 0,
        expiryRound: Number(view.getBigUint64(24, false)),
        fipCertHash: data.slice(32, 64),
        issuedAt: Number(view.getBigUint64(64, false)),
        exists: true,
      };
    } catch (e) {
      console.warn('getCredentialData error:', e.message);
      return { exists: false };
    }
  }, [algodClient]);

  /**
   * Check if credential is valid (exists + not expired).
   */
  const isCredentialValid = useCallback(async (walletAddress, demoMode) => {
    if (demoMode || isDemoMode()) {
      return true;
    }

    try {
      const cred = await getCredentialData(walletAddress, false);
      if (!cred || !cred.exists) return false;
      // Get current round from algodClient directly
      let round = 40000000; // fallback
      try {
        if (algodClient) {
          const status = await algodClient.status().do();
          round = status['last-round'] || 40000000;
        }
      } catch (_) {
        // Use fallback round
      }
      return cred.expiryRound > round;
    } catch (e) {
      console.warn('isCredentialValid error:', e.message);
      return false;
    }
  }, [getCredentialData, algodClient]);

  /**
   * Request a loan from MicroLender.
   * Demo mode: returns mock approved loan.
   */
  const requestLoan = useCallback(async (walletAddress, sk, amountMicroAlgo, demoMode) => {
    if (demoMode || isDemoMode()) {
      await new Promise(r => setTimeout(r, 2000));
      return {
        txId: 'DEMO_LOAN_' + Date.now().toString(36),
        approved: true,
        ltv: 70,
        amount: amountMicroAlgo,
        demo: true,
      };
    }

    try {
      if (!algodClient || !addresses.MicroLender) {
        throw new Error('MicroLender not deployed. Use demo mode.');
      }

      const sp = await algodClient.getTransactionParams().do();
      const amountBytes = new Uint8Array(8);
      const view = new DataView(amountBytes.buffer);
      view.setBigUint64(0, BigInt(amountMicroAlgo), false);

      const txn = algosdk.makeApplicationCallTxnFromObject({
        from: walletAddress,
        suggestedParams: sp,
        appIndex: addresses.MicroLender,
        appArgs: [
          new TextEncoder().encode('request_loan'),
          amountBytes,
        ],
        foreignApps: [addresses.ProofRegistry],
        boxes: [
          { appIndex: addresses.MicroLender, name: new Uint8Array([...new TextEncoder().encode('loan:'), ...algosdk.decodeAddress(walletAddress).publicKey]) },
        ],
      });

      const signedTxn = txn.signTxn(sk);
      const { txId } = await algodClient.sendRawTransaction(signedTxn).do();
      const result = await waitForConf(txId);

      return {
        txId,
        approved: result['confirmed-round'] > 0,
        ltv: 70,
        amount: amountMicroAlgo,
        demo: false,
      };
    } catch (e) {
      console.error('requestLoan error:', e);
      throw e;
    }
  }, [algodClient, waitForConf]);

  return {
    verifyAndIssue,
    getCredentialData,
    isCredentialValid,
    requestLoan,
  };
}

export default useContracts;
