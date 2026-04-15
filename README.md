# PRIV-FI – Privacy-Preserving Credit Oracle

**Algorand Bharat Hack Series 3.0**

> 400M+ credit-invisible Indians • Zero raw data on-chain • Soulbound credentials • Undercollateralized loans

**THIS IS 100% ALGORAND.** No Solidity. No EVM. No ethers.js. No MetaMask. Every on-chain component uses algopy + PuyaPy + AlgoKit. Every frontend call uses algosdk v3.

## Overview

PRIV-FI is a privacy-first credit system built on top of the Algorand blockchain designed to securely issue Soulbound credentials and undercollateralized loans. By relying on Zero-Knowledge Proofs (ZKP), PRIV-FI achieves trustless evaluation of user financial data without exposing raw information on-chain or compromising the privacy of the user. 
The users pull down their banking records (via an Account Aggregator API), generate privacy-preserving proofs directly on their end, and interact with Algorand via Python Smart Contracts written using Pyteal / Algopy.

## Architecture

```text
User 
  → AA Consent 
    → Bank Data (on-device) 
      → Noir ZK Circuit 
        → Boolean Predicates + Nullifier
          → Algorand Smart Contract (verify + store) 
            → Soulbound Credential 
              → MicroLender 
                → Loan
```

**Four-Layer System:**
1. **Data Layer** — Mock AA (Account Aggregator) Financial Information Provider simulates fetching verified bank data.
2. **ZK Layer** — Noir circuit with Barretenberg backend processes data using ZKP algorithms. Validates constraints securely.
3. **Contract Layer** — Algorand Python (`algopy`) smart contracts deployed on the AVM (Algorand Virtual Machine) record logic.
4. **Frontend Layer** — A robust React interface composed using Vite, `algosdk` v3 + Pera Wallet for user interaction.

## Quick Start (Demo Mode — Zero Deployment Required)

You do not need to do any smart contract deployments to run the UI in demo mode. 

```bash
# 1. Clone repository and install dependencies
git clone <repo> && cd privfi
npm install

# 2. Setup your local environment
cp .env.example .env   # Note: VITE_DEMO_MODE=true is already set to use the fallback demo implementation

# 3. Start the dev server
npm run dev

# 4. Open in browser
# Navigate to http://localhost:5173
```

That's it. Demo mode works out of the box with no blockchain deployment.

## Full Algorand Testnet Deployment

If you wish to spin up your very own fully authenticated instance:

```bash
# 1. Compile ZK circuit (requires Nargo to be installed on your system)
cd packages/circuits/credit_oracle 
nargo compile 
cd ../../..
node packages/circuits/scripts/export-circuit.js

# 2. Compile Algorand contracts (requires AlgoKit + PuyaPy)
pip install algokit algorand-python algosdk
npm run compile:contracts

# 3. Fund your Testnet account
# Visit the Algorand Dispenser: https://bank.testnet.algorand.network

# 4. Deploy Smart Contracts
export ALGO_MNEMONIC="your twenty five word mnemonic here"
npm run deploy:testnet

# 5. Start the frontend
npm run dev
```

## Technology Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| ZK Language | Noir (Aztec) | 0.32.0 |
| ZK Backend | Barretenberg | 0.32.0 |
| Smart Contracts | Algorand Python (`algopy`) | latest |
| Contract Compiler | PuyaPy | latest |
| Blockchain | Algorand Testnet | - |
| Algod SDK | `algosdk` | 3.x |
| Frontend | React 18 + Vite 5 | latest |
| Styling | Tailwind CSS | 3.4.x |
| Wallet | Pera Wallet / Mnemonic | latest |

## Project Structure

```text
privfi/
├── packages/
│   ├── circuits/           # Noir ZK circuits (chain-agnostic logic definitions)
│   ├── contracts/          # Algorand Python smart contracts handling soulbound issuance
│   ├── mock-fip/           # Mock AA bank data server running on port 3001
│   ├── delegation-server/  # Proof delegation server running on port 3002
│   └── frontend/           # The User-Facing React frontend application (port 5173)
├── package.json            # NPM root workspace configurations
├── .env.example            # Boilerplate Environment config
└── README.md
```

## Key URLs

| Resource | URL |
|----------|-----|
| Blockchain | Algorand Testnet |
| Explorer | https://testnet.explorer.perawallet.app |
| Faucet | https://bank.testnet.algorand.network |
| Algod API | https://testnet-api.4160.nodely.dev |
| Indexer API | https://testnet-idx.4160.nodely.dev |

## Flow Walkthrough (9 Steps)

Getting started with the privacy-preserved flow involves 9 standard steps:

1. **Connect Wallet** — Link your Pera Wallet, input a Mnemonic phrase directly, or just use the local Demo mode.
2. **Grant AA Consent** — Allow the application to simulate Account Aggregator data polling.
3. **Fetch Financial Data** — Retrieves the simulated user records (last 180 days transactions + 6 chronological balance snapshots).
4. **Prepare Circuit Inputs** — Structure numerical data into ZK-compatible byte format arrays.
5. **Generate ZK Proof** — The Noir circuit processes the inputs and securely evaluates 3 secret logical predicates off-chain.
6. **Submit to Algorand** — A generated cryptographic Proof + a unique Nullifier are submitted as an Algorand Application call.
7. **View Credential** — Once verified, your dashboard populates the verified generic predicates to represent your status.
8. **Toggle Lender's View** — Discover exactly what third-party micro-lenders actually see (completely shielded raw values, protecting user integrity).
9. **Request Loan** — Request and claim a quick undercollateralized loan securely based entirely on the LTV tier obtained.

## Phase 1 Simplifications (Implementation Details)

A quick glance at some design choices enforced in Phase 1 as opposed to planned milestones for Phase 2:

| Feature | Phase 1 Standard | Phase 2 Target |
|---------|------------------|----------------|
| Proof delegation | Handled with Plaintext inputs | Will be completely AES-256 encrypted throughout |
| ZK verification | Checks Nullifier uniqueness and target expiry logic only | Full Groth16 mathematical verification computed on-chain |
| Proof bytes | Serialized strings stored explicitly for audit traces | Formally mathematically verified directly on Algorand |

## Expiry Math (Algorand Specific Constraints)

Note on expiry mathematical evaluations on the backend:

```text
expiry_round = current_round + 208,000
time_remaining = (expiry_round - current_round) x 2.9 seconds
208,000 rounds x 2.9s = 603,200s ≈ 7 days
```

⚠️ **WARNING:** NEVER use standard Ethereum `+50,400` offsets — that is standard Ethereum mainnet math and is fundamentally incorrect for Algorand's block times.

## Troubleshooting

Common issues and their fixes:

| Problem | Solution |
|---------|----------|
| Low testnet balance | Fund your wallet via Dispenser: `https://bank.testnet.algorand.network/?account=YOUR_ADDRESS` |
| Box not found | Credential not yet issued on the contract — you must complete the demo verification proof flow first. |
| WASM slow on mobile | Use native demo rendering mode. Append `?demo=true` URL parameter. |
| Nullifier reuse error in demo | Each local session enforces unique nullifiers via epoch timing `Date.now()`. Reset your session. |
| Pera Wallet fails connecting | Fall back entirely, use mnemonic import directly or the demo mode. |

## License

Built specifically for the Algorand Bharat Hack Series 3.0.

Open-sourced explicitly under the MIT License.
