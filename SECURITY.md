# Security Policy

## Reporting a Vulnerability

If you discover a security vulnerability within PRIV-FI, please send an email to the maintainers **privately**. Please do **not** open a public GitHub Issue for security vulnerabilities.

### What to include:

- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Suggested fix (if any)

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 1.x     | :white_check_mark: |

## Security Considerations

This project handles sensitive financial data concepts:

- **ZK Proofs**: All financial data is processed through zero-knowledge circuits — raw data never goes on-chain
- **Mnemonics**: Never commit wallet mnemonics or private keys
- **Environment Variables**: All secrets are stored in `.env` files which are gitignored
- **Demo Mode**: The demo mode uses simulated data only — no real financial information is processed

## Disclaimer

This is a **hackathon prototype**. It is NOT intended for production use with real financial data. The ZK verification in Phase 1 uses simplified checks (nullifier + expiry) rather than full on-chain Groth16 verification.
