"""
PRIV-FI MicroLender — Algorand Smart Contract (algopy)
Compiled by PuyaPy via AlgoKit.

Reference lending contract that checks ProofRegistry credentials
and issues undercollateralized loans based on ZK-verified predicates.

LTV tiers:
  3 predicates verified → 70% LTV
  2 predicates verified → 50% LTV
  1 predicate verified  → 30% LTV
  0 predicates verified → Rejected
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
    itxn,
    subroutine,
)
from algopy.arc4 import abimethod, String


# LTV constants (Loan-to-Value percentage)
LTV_ALL_THREE = UInt64(70)  # 70% LTV when all 3 predicates pass
LTV_TWO = UInt64(50)        # 50% LTV when 2 predicates pass
LTV_ONE = UInt64(30)        # 30% LTV when 1 predicate passes

# Maximum loan amount: 100,000 microALGO (0.1 ALGO on testnet)
MAX_LOAN = UInt64(100_000)

# Minimum balance reserve for the contract
MIN_BALANCE_RESERVE = UInt64(100_000)


class MicroLender(ARC4Contract):
    """
    Undercollateralized lending contract powered by PRIV-FI credentials.
    Reads ZK-verified predicates from ProofRegistry to determine LTV tier.
    """

    def __init__(self) -> None:
        self.registry_app_id = GlobalState(UInt64(0))
        self.total_loans_issued = GlobalState(UInt64(0))
        self.loan_history = BoxMap(Bytes, Bytes, key_prefix=b"loan:")

    @abimethod()
    def initialize(self, registry_app_id: UInt64) -> None:
        """
        Set the ProofRegistry app ID. Only callable by the contract creator.
        Must be called after deployment before any loans can be issued.
        """
        assert Txn.sender == Global.creator_address, "Only creator can initialize"
        self.registry_app_id.value = registry_app_id

    @abimethod()
    def request_loan(self, amount_microalgo: UInt64) -> String:
        """
        Request an undercollateralized loan.
        1. Validates amount is within limits
        2. Checks ProofRegistry for valid credential
        3. Determines LTV tier based on verified predicates
        4. Issues inner payment transaction if approved
        """
        # 1. Assert amount is within limits
        assert amount_microalgo <= MAX_LOAN, "Amount exceeds maximum loan"
        assert amount_microalgo > UInt64(0), "Amount must be positive"

        # 2. Assert registry is initialized
        assert self.registry_app_id.value > UInt64(0), "Registry not initialized"

        # 3. Inner call to registry: is_credential_valid
        valid_result = itxn.ApplicationCall(
            app_id=self.registry_app_id.value,
            app_args=[
                Bytes(b"is_credential_valid(byte[])bool"),
                Txn.sender.bytes,
            ],
            fee=UInt64(0),
        ).submit()

        # 4. Check if credential is valid
        last_log = valid_result.last_log
        is_valid = op.getbit(last_log, 0)
        if not is_valid:
            log(b"LoanRejected")
            return String("REJECTED: No valid credential")

        # 5. Inner call to get_credential_data
        cred_result = itxn.ApplicationCall(
            app_id=self.registry_app_id.value,
            app_args=[
                Bytes(b"get_credential_data(byte[])byte[]"),
                Txn.sender.bytes,
            ],
            fee=UInt64(0),
        ).submit()

        cred_data = cred_result.last_log

        # 6. Count verified predicates from first 3 × 8-byte fields
        balance_ok = op.btoi(op.extract(cred_data, 0, 8))
        income_ok = op.btoi(op.extract(cred_data, 8, 8))
        regularity_ok = op.btoi(op.extract(cred_data, 16, 8))

        verified_count = UInt64(0)
        if balance_ok > UInt64(0):
            verified_count += UInt64(1)
        if income_ok > UInt64(0):
            verified_count += UInt64(1)
        if regularity_ok > UInt64(0):
            verified_count += UInt64(1)

        # 7. Assign LTV based on count
        if verified_count == UInt64(0):
            log(b"LoanRejected")
            return String("REJECTED: No verified predicates")

        ltv = UInt64(0)
        if verified_count >= UInt64(3):
            ltv = LTV_ALL_THREE
        elif verified_count == UInt64(2):
            ltv = LTV_TWO
        else:
            ltv = LTV_ONE

        # 8. Check contract has sufficient balance
        contract_balance = Global.current_application_address.balance
        assert contract_balance >= amount_microalgo + MIN_BALANCE_RESERVE, "Insufficient contract balance"

        # 9. Issue inner payment
        itxn.Payment(
            receiver=Txn.sender,
            amount=amount_microalgo,
            fee=UInt64(0),
        ).submit()

        # 10. Record loan in box storage
        loan_data = (
            op.itob(amount_microalgo)
            + op.itob(ltv)
            + op.itob(Global.latest_timestamp)
        )
        self.loan_history[Txn.sender.bytes] = loan_data

        # 11. Increment counter and log
        self.total_loans_issued.value += UInt64(1)
        log(b"LoanApproved")

        return String("APPROVED")

    @abimethod(readonly=True)
    def get_eligible_ltv(self, wallet: Bytes) -> UInt64:
        """
        Returns eligible LTV for a wallet address.
        Returns 0 for Phase 1 (Phase 2 will query registry via inner call).
        """
        # Phase 2 TODO: Query registry via inner call to compute LTV
        _ = wallet
        return UInt64(0)

    @abimethod(readonly=True)
    def get_total_loans(self) -> UInt64:
        """Return total number of loans issued."""
        return self.total_loans_issued.value
