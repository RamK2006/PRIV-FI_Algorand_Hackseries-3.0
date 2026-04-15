# PRIV-FI ” Privacy-Preserving Credit Oracle

**Algorand Bharat Hack Series 3.0**

> 400M+ credit-invisible Indians â€¢ Zero raw data on-chain â€¢ Soulbound credentials â€¢ Undercollateralized loans

**THIS IS 100% ALGORAND.** No Solidity. No EVM. No ethers.js. No MetaMask. Every on-chain component uses algopy + PuyaPy + AlgoKit. Every frontend call uses algosdk v3.

## Architecture

```
User â†’ AA Consent â†’ Bank Data (on-device) â†’ Noir ZK Circuit â†’ Boolean Predicates + Nullifier
    â†’ Algorand Smart Contract (verify + store) â†’ Soulbound Credential â†’ MicroLender â†’ Loan
```

**Four-Layer System:**
1. **Data Layer** â€” Mock AA (Account Aggregator) Financial Information Provider
2. **ZK Layer** â€” Noir circuit with Barretenberg backend (chain-agnostic)
3. **Contract Layer** â€” Algorand Python (algopy) smart contracts on AVM
4. **Frontend Layer** â€” React + Vite + algosdk v3 + Pera Wallet

## Quick Start (Demo Mode â€” Zero Deployment Required)

```bash
git clone <repo> && cd privfi
npm install
cp .env.example .env   # VITE_DEMO_MODE=true is already set
npm run dev
# Open http://localhost:5173
```

That's it. Demo mode works out of the box with no blockchain deployment.

## Full Algorand Testnet Deployment

```bash
# 1. Compile ZK circuit (requires Nargo)
cd packages/circuits/credit_oracle && nargo compile && cd ../../..
node packages/circuits/scripts/export-circuit.js

# 2. Compile Algorand contracts (requires AlgoKit + PuyaPy)
pip install algokit algorand-python algosdk
npm run compile:contracts

# 3. Fund testnet account
# Visit: https://bank.testnet.algorand.network

# 4. Deploy
export ALGO_MNEMONIC="your twenty five word mnemonic here"
npm run deploy:testnet

# 5. Run
npm run dev
```

## Technology Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| ZK Language | Noir (Aztec) | 0.32.0 |
| ZK Backend | Barretenberg | 0.32.0 |
| Smart Contracts | Algorand Python (algopy) | latest |
| Contract Compiler | PuyaPy | latest |
| Blockchain | Algorand Testnet | - |
| Algod SDK | algosdk | 3.x |
| Frontend | React 18 + Vite 5 | latest |
| Styling | Tailwind CSS | 3.4.x |
| Wallet | Pera Wallet / Mnemonic | latest |

## Project Structure

```
privfi/
â”œâ”€â”€ packages/
â”‚   â”œâ”€â”€ circuits/           # Noir ZK circuits (chain-agnostic)
â”‚   â”œâ”€â”€ contracts/          # Algorand Python smart contracts
â”‚   â”œâ”€â”€ mock-fip/           # Mock AA bank data server (port 3001)
â”‚   â”œâ”€â”€ delegation-server/  # Proof delegation server (port 3002)
â”‚   â””â”€â”€ frontend/           # React frontend (port 5173)
â”œâ”€â”€ package.json            # Root workspace
â”œâ”€â”€ .env.example            # Environment config
â””â”€â”€ README.md
```

## Key URLs

| Resource | URL |
|----------|-----|
| Blockchain | Algorand Testnet |
| Explorer | https://testnet.explorer.perawallet.app |
| Faucet | https://bank.testnet.algorand.network |
| Algod API | https://testnet-api.4160.nodely.dev |
| Indexer API | https://testnet-idx.4160.nodely.dev |

## Demo Flow (9 Steps)

1. **Connect Wallet** â€” Pera Wallet, mnemonic, or demo mode
2. **Grant AA Consent** â€” Simulate Account Aggregator consent
3. **Fetch Financial Data** â€” 180 days transactions + 6 balance snapshots
4. **Prepare Circuit Inputs** â€” Convert to ZK-compatible format
5. **Generate ZK Proof** â€” Noir circuit evaluates 3 predicates
6. **Submit to Algorand** â€” Proof + nullifier submitted on-chain
7. **View Credential** â€” Dashboard shows verified predicates
8. **Toggle Lender's View** â€” See what the protocol sees (and doesn't see)
9. **Request Loan** â€” Undercollateralized loan based on LTV tier

## Phase 1 Simplifications (Documented, Not Errors)

| Feature | Phase 1 | Phase 2 |
|---------|---------|---------|
| Proof delegation | Plaintext inputs | AES-256 encrypted |
| ZK verification | Nullifier + expiry only | Full Groth16 on-chain |
| Proof bytes | Stored for audit | Verified on-chain |

## Expiry Math (ALGORAND SPECIFIC)

```
expiry_round = current_round + 208,000
time_remaining = (expiry_round - current_round) Ã— 2.9 seconds
208,000 rounds Ã— 2.9s = 603,200s â‰ˆ 7 days
```

âš ï¸ NEVER use +50,400 â€” that is Ethereum mainnet math.

## Troubleshooting

| Problem | Solution |
|---------|----------|
| Low balance | Fund at https://bank.testnet.algorand.network/?account=YOUR_ADDRESS |
| Box not found | Credential not yet issued â€” complete proof flow first |
| WASM slow on mobile | Use `?demo=true` URL parameter |
| Nullifier reuse in demo | Each session uses unique nullifier via Date.now() |
| Pera Wallet not connecting | Use mnemonic import or demo mode |

## License

Built for Algorand Bharat Hack Series 3.0.

MIT License
