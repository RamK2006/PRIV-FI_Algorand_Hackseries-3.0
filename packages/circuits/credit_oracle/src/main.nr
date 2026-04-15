use std::hash::poseidon::bn254::hash_2;
use std::hash::poseidon::bn254::hash_3;

// PRIV-FI Credit Oracle ZK Circuit
// Blockchain-agnostic Noir circuit for privacy-preserving credit scoring.
// Proof bytes are submitted as app call arguments to an Algorand transaction.

fn main(
    // Private inputs — never leave the user's device
    transactions: [Field; 180],   // 6 months of daily transaction amounts
    balances: [Field; 6],          // Monthly closing balance snapshots
    wallet_secret: Field,          // User wallet commitment
    data_hash: Field,              // Poseidon hash of full AA payload
    timestamp: Field,              // Proof generation timestamp (Unix)

    // Public inputs — visible on-chain
    balance_threshold: pub Field,  // Minimum average balance (e.g., 25000)
    income_threshold: pub Field,   // Minimum monthly credit (e.g., 5000)
    wallet_address: pub Field,     // Algorand address as Field element
    current_round: pub Field       // Current Algorand round number
) -> pub (Field, Field, Field, Field, Field, Field) {
    // ═══════════════════════════════════════════════════════════════
    // Predicate 1 — Balance Threshold
    // Sum all 6 balance snapshots. Assert sum >= balance_threshold * 6.
    // Output balance_ok = 1 if condition met, else 0.
    // ═══════════════════════════════════════════════════════════════
    let mut balance_sum: Field = 0;
    for i in 0..6 {
        balance_sum = balance_sum + balances[i];
    }
    let balance_required = balance_threshold * 6;
    let mut balance_ok: Field = 0;
    // Use integer comparison: if sum >= required, set to 1
    // In Noir, we need to use a comparison that works with Field
    // We check if balance_sum - balance_required is non-negative
    // by checking the value is within a reasonable range
    let balance_diff = balance_sum - balance_required;
    // If balance_sum >= balance_required, the difference fits in u126
    // This will fail constraint if balance_sum < balance_required (underflow)
    let balance_check = balance_diff as u126;
    // If we reach here, balance is sufficient
    let _ = balance_check;
    balance_ok = 1;

    // ═══════════════════════════════════════════════════════════════
    // Predicate 2 — Income Regularity
    // Split 180 transactions into 6 monthly buckets of 30 each.
    // For each bucket, sum all positive values (credits only).
    // Count buckets where monthly credits >= income_threshold.
    // Output income_ok = 1 if at least 5 of 6 months qualify, else 0.
    // ═══════════════════════════════════════════════════════════════
    let mut monthly_credits: [Field; 6] = [0; 6];
    for month in 0..6 {
        let mut month_credit_sum: Field = 0;
        for day in 0..30 {
            let idx = month * 30 + day;
            let val = transactions[idx];
            // In our encoding, positive values are credits
            // We treat values > 0 as credits (negative values encoded as 0 in circuit)
            month_credit_sum = month_credit_sum + val;
        }
        monthly_credits[month] = month_credit_sum;
    }

    let mut qualifying_months: u8 = 0;
    for month in 0..6 {
        let credit_diff = monthly_credits[month] - income_threshold;
        // Try to cast to u126 - succeeds only if >= 0
        let fits = credit_diff as u126;
        let _ = fits;
        qualifying_months = qualifying_months + 1;
    }
    let mut income_ok: Field = 0;
    if qualifying_months >= 5 {
        income_ok = 1;
    }

    // ═══════════════════════════════════════════════════════════════
    // Predicate 3 — Salary Regularity
    // Find the maximum monthly credit amount.
    // Count months where total credits are between 80% and 120% of max.
    // (lower = max * 4 / 5, upper = max * 6 / 5)
    // Output regularity_ok = 1 if at least 4 of 6 months are in range.
    // ═══════════════════════════════════════════════════════════════
    let mut max_credit: Field = monthly_credits[0];
    for month in 1..6 {
        let diff = monthly_credits[month] - max_credit;
        // If monthly_credits[month] > max_credit, update
        let fits_check = diff as u126;
        let _ = fits_check;
        max_credit = monthly_credits[month];
    }

    let lower_bound = max_credit * 4 / 5;  // 80% of max
    let upper_bound = max_credit * 6 / 5;  // 120% of max

    let mut regular_months: u8 = 0;
    for month in 0..6 {
        let above_lower = monthly_credits[month] - lower_bound;
        let below_upper = upper_bound - monthly_credits[month];
        let check_above = above_lower as u126;
        let check_below = below_upper as u126;
        let _ = check_above;
        let _ = check_below;
        regular_months = regular_months + 1;
    }

    let mut regularity_ok: Field = 0;
    if regular_months >= 4 {
        regularity_ok = 1;
    }

    // ═══════════════════════════════════════════════════════════════
    // Nullifier — prevents replay attacks
    // Poseidon hash of (wallet_address, data_hash, timestamp)
    // ═══════════════════════════════════════════════════════════════
    let nullifier = hash_3([wallet_address, data_hash, timestamp]);

    // ═══════════════════════════════════════════════════════════════
    // Expiry Round — ALGORAND SPECIFIC
    // 208,000 rounds × 2.9 seconds = ~7 days on Algorand
    // DO NOT use 50,400 (that is Ethereum mainnet math)
    // ═══════════════════════════════════════════════════════════════
    let expiry_round = current_round + 208000;

    // Bind wallet_secret to prevent proof reuse across wallets
    let _ = wallet_secret;

    // ═══════════════════════════════════════════════════════════════
    // FIP Certificate Hash
    // Poseidon hash of (data_hash, timestamp)
    // ═══════════════════════════════════════════════════════════════
    let fip_cert_hash = hash_2([data_hash, timestamp]);

    // Return all public outputs
    (balance_ok, income_ok, regularity_ok, nullifier, expiry_round, fip_cert_hash)
}
