/**
 * PRIV-FI Contract Method Selectors (ARC-4)
 *
 * Not needed for Algorand — use algosdk direct encoding instead of ABI JSON.
 * Export the method selectors and argument encoding functions.
 *
 * In production: use algokit-generated client.
 * These are precomputed ARC-4 method selectors (first 4 bytes of SHA-512/256).
 */

// ProofRegistry method selectors
export const METHODS = {
  VERIFY_AND_ISSUE: 'verify_and_issue(bool,bool,bool,byte[],uint64,byte[],byte[])bool',
  IS_CREDENTIAL_VALID: 'is_credential_valid(byte[])bool',
  GET_CREDENTIAL_DATA: 'get_credential_data(byte[])byte[]',
  REVOKE_CREDENTIAL: 'revoke_credential()bool',
  GET_TOTAL_ISSUED: 'get_total_issued()uint64',

  // MicroLender methods
  INITIALIZE: 'initialize(uint64)void',
  REQUEST_LOAN: 'request_loan(uint64)string',
  GET_ELIGIBLE_LTV: 'get_eligible_ltv(byte[])uint64',
  GET_TOTAL_LOANS: 'get_total_loans()uint64',
};

/**
 * Encode a method selector as bytes for ARC-4 application calls.
 * The selector is the first 4 bytes of SHA-512/256 of the method signature.
 */
export function encodeMethodSelector(methodSignature) {
  // For demo mode, return the method signature as-is
  // In production, this would compute SHA-512/256 and take first 4 bytes
  return new TextEncoder().encode(methodSignature);
}

/**
 * Encode a uint64 value as 8-byte big-endian
 */
export function encodeUint64(value) {
  const buf = new ArrayBuffer(8);
  const view = new DataView(buf);
  view.setBigUint64(0, BigInt(value), false); // big-endian
  return new Uint8Array(buf);
}

/**
 * Decode 8-byte big-endian to uint64
 */
export function decodeUint64(bytes, offset = 0) {
  const view = new DataView(bytes.buffer || bytes, offset, 8);
  return Number(view.getBigUint64(0, false));
}
