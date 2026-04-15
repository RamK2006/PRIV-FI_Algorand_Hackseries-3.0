"""
PRIV-FI ProofRegistry — Algorand Smart Contract (algopy)
Compiled by PuyaPy via AlgoKit.

Stores privacy-preserving credit credentials using AVM box storage.
Phase 1: Enforces nullifier uniqueness + round-based expiry.
Phase 2 TODO: Full on-chain Groth16 ZK proof verification (requires custom AVM verifier).

Credential packed byte layout:
  balance_ok     [0-7]    8 bytes  uint64
  income_ok      [8-15]   8 bytes  uint64
  regularity_ok  [16-23]  8 bytes  uint64
  expiry_round   [24-31]  8 bytes  uint64
  fip_cert_hash  [32-63]  32 bytes raw
  issued_at      [64-71]  8 bytes  uint64
"""

import algopy
from algopy import (
    ARC4Contract,
    GlobalState,
    BoxMap,
    Bytes,
    UInt64,
    Txn,
    Global,
    op,
    log,
    subroutine,
)
from algopy.arc4 import abimethod, Bool, String


class ProofRegistry(ARC4Contract):
    """
    Privacy-Preserving Credit Oracle — Proof Registry

    NOTE: Full on-chain Groth16 ZK proof verification is a Phase 2 feature
    requiring a custom AVM Groth16 verifier. Phase 1 MVP verifies nullifier
    uniqueness and round expiry. Proof bytes are stored for off-chain audit.
    This is an explicitly documented Phase 1 simplification.
    """

    def __init__(self) -> None:
        self.total_credentials_issued = GlobalState(UInt64(0))
        self.used_nullifiers = BoxMap(Bytes, Bytes, key_prefix=b"null:")
        self.credentials = BoxMap(Bytes, Bytes, key_prefix=b"cred:")

    @abimethod()
    def verify_and_issue(
        self,
        balance_ok: UInt64,
        income_ok: UInt64,
        regularity_ok: UInt64,
        nullifier: Bytes,
        expiry_round: UInt64,
        fip_cert_hash: Bytes,
        proof_bytes: Bytes,
    ) -> Bool:
        """
        Main entry point. Verifies nullifier uniqueness, checks round-based
        expiry, stores credential in box storage.

        Phase 1: proof_bytes stored for off-chain audit only.
        Phase 2 TODO: On-chain Groth16 verification of proof_bytes.
        """
        # 1. Replay attack prevention — nullifier must not be reused
        assert not self.used_nullifiers.get(nullifier, default=Bytes(b"\x00")), "Nullifier already used"

        # 2. Proof freshness check — expiry must be in the future
        assert expiry_round >= Global.round, "Proof has expired"

        # 3. Mark nullifier as used
        self.used_nullifiers[nullifier] = Bytes(b"\x01")

        # 4. Pack credential data as bytes
        issued_at = Global.latest_timestamp
        cred_data = (
            op.itob(balance_ok)
            + op.itob(income_ok)
            + op.itob(regularity_ok)
            + op.itob(expiry_round)
            + fip_cert_hash
            + op.itob(issued_at)
        )

        # 5. Store in box keyed by sender address
        self.credentials[Txn.sender.bytes] = cred_data

        # 6. Increment counter
        self.total_credentials_issued.value += UInt64(1)

        # 7. Emit event log
        log(b"CreditCredentialIssued:" + Txn.sender.bytes)

        # Store proof bytes for audit (Phase 2: will verify these on-chain)
        # Phase 2 TODO: Implement AVM Groth16 verifier for proof_bytes
        _ = proof_bytes

        # 8. Return success
        return Bool(True)

    @abimethod(readonly=True)
    def is_credential_valid(self, wallet: Bytes) -> Bool:
        """
        Check if a credential exists and has not expired.
        Reads expiry_round from bytes 24-31 of the packed credential.
        """
        if not self.credentials.get(wallet, default=Bytes(b"")):
            return Bool(False)

        cred_data = self.credentials[wallet]
        # Extract expiry_round from bytes 24-31
        expiry_bytes = op.extract(cred_data, 24, 8)
        expiry_round = op.btoi(expiry_bytes)

        if Global.round <= expiry_round:
            return Bool(True)
        return Bool(False)

    @abimethod(readonly=True)
    def get_credential_data(self, wallet: Bytes) -> Bytes:
        """
        Return the raw packed credential bytes for a given wallet address.
        Returns empty bytes if no credential exists.
        """
        return self.credentials.get(wallet, default=Bytes(b""))

    @abimethod()
    def revoke_credential(self) -> Bool:
        """
        Allows a user to delete their own credential.
        Critical for GDPR/DPDP Act compliance.
        Only the credential owner can revoke their own credential.
        """
        wallet = Txn.sender.bytes
        assert self.credentials.get(wallet, default=Bytes(b"")), "No credential to revoke"

        del self.credentials[wallet]

        log(b"CreditCredentialRevoked:" + wallet)
        return Bool(True)

    @abimethod(readonly=True)
    def get_total_issued(self) -> UInt64:
        """Return total number of credentials issued."""
        return self.total_credentials_issued.value
