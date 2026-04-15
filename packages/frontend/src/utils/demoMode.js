/**
 * PRIV-FI Demo Mode Utilities
 * All demo data is self-contained — zero deployment required.
 */

export const isDemoMode = () =>
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_DEMO_MODE === 'true') ||
  new URLSearchParams(window.location.search).get('demo') === 'true';

/**
 * Generate a unique demo proof.
 * Uses Date.now() for the nullifier — each call is unique.
 * This eliminates the most common demo failure mode (nullifier reuse).
 */
export const getDemoProof = (walletAddress) => {
  const timestamp = Date.now();
  const nullifier = '0x' + timestamp.toString(16).padStart(64, '0');
  const currentRound = 40000000;
  const expiryRound = currentRound + 208000; // ~7 days on Algorand

  return {
    proof: new Uint8Array(256).fill(0xab),
    publicInputs: [
      '1', '1', '1',              // balance_ok, income_ok, regularity_ok = all true
      nullifier,
      '0x' + expiryRound.toString(16).padStart(64, '0'),
      '0x' + 'cafe'.repeat(16),   // fip_cert_hash
      '0x' + (25000).toString(16).padStart(64, '0'),  // balance_threshold
      '0x' + (5000).toString(16).padStart(64, '0'),   // income_threshold
      '0x' + '0'.padStart(64, '0'),                    // wallet_address
      '0x' + currentRound.toString(16).padStart(64, '0'),
    ],
  };
};

/**
 * Demo credential — all predicates passing, valid expiry.
 */
export const getDemoCredential = () => ({
  balanceOk: true,
  incomeOk: true,
  regularityOk: true,
  expiryRound: 40000000 + 208000,
  issuedAt: Math.floor(Date.now() / 1000) - 3600,
  exists: true,
});

/**
 * Demo AA data — crafted so all 3 ZK predicates evaluate to TRUE.
 *
 * Monthly balances: [45000, 48000, 42000, 51000, 47000, 44000] (all > 25,000)
 * Day 5 of each month: 25,000 salary credit
 * Each month has total credits > 5,000
 * At least 4 of 6 months have credits within 80-120% of max
 */
export const getDemoAAData = () => ({
  transactions: Array.from({ length: 180 }, (_, i) => {
    if (i % 30 === 4) return 25000;  // salary credit day 5 each month
    if (i % 7 === 0) return 500;
    if (i % 3 === 0) return 0;  // debits as 0 for circuit (only credits count)
    return 0;
  }),
  balances: [45000, 48000, 42000, 51000, 47000, 44000],
  monthlyCreditSummary: [
    { month: '2024-06', totalCredits: 27500 },
    { month: '2024-05', totalCredits: 26800 },
    { month: '2024-04', totalCredits: 28200 },
    { month: '2024-03', totalCredits: 25500 },
    { month: '2024-02', totalCredits: 27000 },
    { month: '2024-01', totalCredits: 26200 },
  ],
  signature: 'demo-fip-sig-mock',
  fipCertHash: '0x' + 'cafe'.repeat(16),
});
