"""
PRIV-FI Deployment Script
Deploys ProofRegistry and MicroLender to Algorand Testnet.

Usage:
    export ALGO_MNEMONIC="your twenty five word mnemonic phrase here"
    python scripts/deploy.py
"""

import os
import sys
import json
import time
import algosdk
from algosdk import transaction, account, mnemonic
from algosdk.v2client import algod
from pathlib import Path


# Algorand Testnet configuration
ALGOD_URL = "https://testnet-api.4160.nodely.dev"
ALGOD_TOKEN = ""  # No token required for Nodely
EXPLORER_BASE = "https://testnet.explorer.perawallet.app"


def get_algod_client():
    """Create Algod client for Algorand Testnet."""
    return algod.AlgodClient(ALGOD_TOKEN, ALGOD_URL)


def wait_for_confirmation(client, txid, timeout=10):
    """Wait for a transaction to be confirmed."""
    last_round = client.status()["last-round"]
    while True:
        try:
            tx_info = client.pending_transaction_info(txid)
            if tx_info.get("confirmed-round", 0) > 0:
                print(f"  Transaction confirmed in round {tx_info['confirmed-round']}")
                return tx_info
            if tx_info.get("pool-error", ""):
                raise Exception(f"Transaction error: {tx_info['pool-error']}")
        except Exception as e:
            if "not found" not in str(e).lower():
                raise
        last_round += 1
        client.status_after_block(last_round)
        timeout -= 1
        if timeout <= 0:
            raise Exception("Timeout waiting for confirmation")


def read_teal_file(filepath):
    """Read compiled TEAL file."""
    with open(filepath, "r") as f:
        return f.read()


def compile_teal(client, teal_source):
    """Compile TEAL source code."""
    result = client.compile(teal_source)
    return result


def deploy():
    # 1. Read mnemonic
    mnemonic_phrase = os.environ.get("ALGO_MNEMONIC")
    if not mnemonic_phrase:
        print("ERROR: ALGO_MNEMONIC environment variable not set")
        print("  export ALGO_MNEMONIC=\"your twenty five word mnemonic phrase here\"")
        sys.exit(1)

    sk = mnemonic.to_private_key(mnemonic_phrase)
    deployer_address = account.address_from_private_key(sk)

    # 2. Connect to testnet
    client = get_algod_client()
    status = client.status()
    print(f"Connected to Algorand Testnet")
    print(f"  Current round: {status['last-round']}")
    print(f"  Deployer: {deployer_address}")

    # Check balance
    account_info = client.account_info(deployer_address)
    balance = account_info["amount"]
    print(f"  Balance: {balance / 1e6:.4f} ALGO")

    if balance < 1_000_000:  # Need at least 1 ALGO
        print(f"\nERROR: Insufficient balance. Fund at:")
        print(f"  https://bank.testnet.algorand.network/?account={deployer_address}")
        sys.exit(1)

    # 3. Read compiled TEAL files (from PuyaPy output)
    contracts_dir = Path(__file__).parent.parent
    teal_dir = contracts_dir / "smart_contracts" / "artifacts"

    registry_approval = read_teal_file(teal_dir / "proof_registry" / "approval.teal")
    registry_clear = read_teal_file(teal_dir / "proof_registry" / "clear.teal")
    lender_approval = read_teal_file(teal_dir / "micro_lender" / "approval.teal")
    lender_clear = read_teal_file(teal_dir / "micro_lender" / "clear.teal")

    # Compile TEAL
    print("\nCompiling TEAL...")
    registry_approval_compiled = compile_teal(client, registry_approval)
    registry_clear_compiled = compile_teal(client, registry_clear)
    lender_approval_compiled = compile_teal(client, lender_approval)
    lender_clear_compiled = compile_teal(client, lender_clear)

    # 4. Deploy ProofRegistry
    print("\nDeploying ProofRegistry...")
    sp = client.suggested_params()
    sp.flat_fee = True
    sp.fee = 2000

    registry_txn = transaction.ApplicationCreateTxn(
        sender=deployer_address,
        sp=sp,
        on_complete=transaction.OnComplete.NoOpOC,
        approval_program=registry_approval_compiled["result"],
        clear_program=registry_clear_compiled["result"],
        global_schema=transaction.StateSchema(num_uints=1, num_byte_slices=0),
        local_schema=transaction.StateSchema(num_uints=0, num_byte_slices=0),
    )

    signed_registry = registry_txn.sign(sk)
    registry_txid = client.send_transaction(signed_registry)
    print(f"  TX ID: {registry_txid}")

    result = wait_for_confirmation(client, registry_txid)
    registry_app_id = result["application-index"]
    registry_address = algosdk.logic.get_application_address(registry_app_id)
    print(f"  App ID: {registry_app_id}")
    print(f"  Address: {registry_address}")
    print(f"  Explorer: {EXPLORER_BASE}/application/{registry_app_id}")

    # 5. Deploy MicroLender
    print("\nDeploying MicroLender...")
    sp = client.suggested_params()
    sp.flat_fee = True
    sp.fee = 2000

    lender_txn = transaction.ApplicationCreateTxn(
        sender=deployer_address,
        sp=sp,
        on_complete=transaction.OnComplete.NoOpOC,
        approval_program=lender_approval_compiled["result"],
        clear_program=lender_clear_compiled["result"],
        global_schema=transaction.StateSchema(num_uints=2, num_byte_slices=0),
        local_schema=transaction.StateSchema(num_uints=0, num_byte_slices=0),
    )

    signed_lender = lender_txn.sign(sk)
    lender_txid = client.send_transaction(signed_lender)
    print(f"  TX ID: {lender_txid}")

    result = wait_for_confirmation(client, lender_txid)
    lender_app_id = result["application-index"]
    lender_address = algosdk.logic.get_application_address(lender_app_id)
    print(f"  App ID: {lender_app_id}")
    print(f"  Address: {lender_address}")
    print(f"  Explorer: {EXPLORER_BASE}/application/{lender_app_id}")

    # 6. Initialize MicroLender with registry app ID
    print("\nInitializing MicroLender with ProofRegistry...")
    sp = client.suggested_params()
    init_txn = transaction.ApplicationCallTxn(
        sender=deployer_address,
        sp=sp,
        index=lender_app_id,
        on_complete=transaction.OnComplete.NoOpOC,
        app_args=[b"initialize", registry_app_id.to_bytes(8, "big")],
    )
    signed_init = init_txn.sign(sk)
    init_txid = client.send_transaction(signed_init)
    wait_for_confirmation(client, init_txid)
    print("  MicroLender initialized!")

    # 7. Fund MicroLender contract with 0.5 ALGO
    print("\nFunding MicroLender with 0.5 ALGO...")
    sp = client.suggested_params()
    fund_txn = transaction.PaymentTxn(
        sender=deployer_address,
        sp=sp,
        receiver=lender_address,
        amt=500_000,  # 0.5 ALGO
    )
    signed_fund = fund_txn.sign(sk)
    fund_txid = client.send_transaction(signed_fund)
    wait_for_confirmation(client, fund_txid)
    print("  Funded 0.5 ALGO!")

    # 8. Save deployment addresses
    addresses = {
        "network": "testnet",
        "ProofRegistry": registry_app_id,
        "MicroLender": lender_app_id,
        "MicroLenderAddress": lender_address,
        "algodURL": ALGOD_URL,
        "indexerURL": "https://testnet-idx.4160.nodely.dev",
        "explorerBase": EXPLORER_BASE,
    }

    deploy_dir = contracts_dir / "deployments"
    deploy_dir.mkdir(exist_ok=True)
    with open(deploy_dir / "addresses.json", "w") as f:
        json.dump(addresses, f, indent=2)
    print(f"\nSaved addresses to {deploy_dir / 'addresses.json'}")

    # 9. Copy to frontend
    frontend_contracts = contracts_dir.parent / "frontend" / "src" / "contracts"
    frontend_contracts.mkdir(parents=True, exist_ok=True)
    with open(frontend_contracts / "addresses.json", "w") as f:
        json.dump(addresses, f, indent=2)
    print(f"Copied addresses to {frontend_contracts / 'addresses.json'}")

    # 10. Print summary
    print("\n" + "=" * 60)
    print("DEPLOYMENT COMPLETE")
    print("=" * 60)
    print(f"ProofRegistry: {EXPLORER_BASE}/application/{registry_app_id}")
    print(f"MicroLender:   {EXPLORER_BASE}/application/{lender_app_id}")
    print(f"Deployer:      {EXPLORER_BASE}/address/{deployer_address}")
    print("=" * 60)


if __name__ == "__main__":
    deploy()
