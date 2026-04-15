/**
 * PRIV-FI Circuit Utilities
 * Functions for preparing ZK circuit inputs from AA data.
 * Uses algosdk for Algorand address encoding.
 */

import algosdk from 'algosdk';

/**
 * Convert Algorand base32 address to a Field element string.
 * Takes the 32-byte public key and converts to a big integer.
 */
export const algorandAddressToField = (address) => {
  try {
    const decoded = algosdk.decodeAddress(address);
    let bigint = BigInt(0);
    for (const byte of decoded.publicKey) {
      bigint = (bigint << BigInt(8)) | BigInt(byte);
    }
    return bigint.toString();
  } catch (e) {
    // Fallback for demo mode with invalid addresses
    console.warn('Could not decode Algorand address, using hash fallback');
    let hash = 0;
    for (let i = 0; i < address.length; i++) {
      hash = ((hash << 5) - hash) + address.charCodeAt(i);
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash).toString();
  }
};

/**
 * Compute SHA-256 of AA data (as Field-safe integer, first 31 bytes).
 * Uses Web Crypto API for hashing.
 */
export const computeDataHash = async (aaData) => {
  try {
    const data = new TextEncoder().encode(JSON.stringify(aaData));
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer)).slice(0, 31);
    let bigint = BigInt(0);
    for (const byte of hashArray) {
      bigint = (bigint << BigInt(8)) | BigInt(byte);
    }
    return bigint.toString();
  } catch (e) {
    // Fallback for environments without crypto.subtle
    console.warn('crypto.subtle not available, using demo hash');
    return '987654321';
  }
};

/**
 * Prepare full circuit input object from AA data + wallet + round.
 * This is the complete input structure for the Noir ZK circuit.
 */
export const prepareCircuitInputs = async (aaData, walletAddress, currentRound) => {
  const dataHash = await computeDataHash(aaData);
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const walletField = algorandAddressToField(walletAddress);

  // Pad transactions to exactly 180
  const transactions = [...aaData.transactions.slice(0, 180)];
  while (transactions.length < 180) transactions.push(0);

  // Pad balances to exactly 6
  const balances = [...aaData.balances.slice(0, 6)];
  while (balances.length < 6) balances.push(0);

  return {
    transactions: transactions.map(String),
    balances: balances.map(String),
    wallet_secret: walletField,
    data_hash: dataHash,
    timestamp,
    balance_threshold: '25000',
    income_threshold: '5000',
    wallet_address: walletField,
    current_round: currentRound.toString(),
  };
};

/**
 * Format seconds remaining as "Xd Yh remaining" or "Expired"
 */
export const formatTimeRemaining = (seconds) => {
  if (seconds <= 0) return 'Expired';
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (d > 0) return `${d}d ${h}h remaining`;
  if (h > 0) return `${h}h ${m}m remaining`;
  return `${m}m remaining`;
};

/**
 * Parse public inputs from proof result into structured data.
 */
export const parsePublicInputs = (publicInputs) => {
  if (!publicInputs || publicInputs.length < 6) {
    return {
      balanceOk: false,
      incomeOk: false,
      regularityOk: false,
      nullifier: '0x0',
      expiryRound: 0,
      fipCertHash: '0x0',
    };
  }

  return {
    balanceOk: publicInputs[0] === '1' || publicInputs[0] === '0x01',
    incomeOk: publicInputs[1] === '1' || publicInputs[1] === '0x01',
    regularityOk: publicInputs[2] === '1' || publicInputs[2] === '0x01',
    nullifier: publicInputs[3],
    expiryRound: parseInt(publicInputs[4], 16) || parseInt(publicInputs[4]) || 40208000,
    fipCertHash: publicInputs[5],
  };
};
