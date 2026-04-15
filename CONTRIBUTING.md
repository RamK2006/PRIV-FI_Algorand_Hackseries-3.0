# Contributing to PRIV-FI

Thank you for your interest in contributing to PRIV-FI! This guide will help you get started.

## Getting Started

1. Fork the repository
2. Clone your fork:
   ```bash
   git clone https://github.com/<your-username>/PRIV-FI_Algorand_Hackseries-3.0.git
   cd PRIV-FI_Algorand_Hackseries-3.0
   ```
3. Install dependencies:
   ```bash
   npm install
   ```
4. Create your environment:
   ```bash
   cp .env.example .env
   ```
5. Start development:
   ```bash
   npm run dev
   ```

## Development Workflow

1. Create a feature branch: `git checkout -b feature/your-feature`
2. Make your changes
3. Test your changes locally
4. Commit with clear messages: `git commit -m "feat: add xyz feature"`
5. Push to your fork: `git push origin feature/your-feature`
6. Open a Pull Request

## Commit Message Convention

We follow [Conventional Commits](https://www.conventionalcommits.org/):

- `feat:` — New feature
- `fix:` — Bug fix
- `docs:` — Documentation changes
- `style:` — Code style changes (formatting, etc.)
- `refactor:` — Code refactoring
- `test:` — Adding or updating tests
- `chore:` — Maintenance tasks

## Project Structure

```
packages/
├── circuits/           # Noir ZK circuits
├── contracts/          # Algorand Python smart contracts
├── mock-fip/           # Mock Account Aggregator server
├── delegation-server/  # Proof delegation server
└── frontend/           # React + Vite frontend
```

## Code Style

- **JavaScript/React**: Use ES6+ features, functional components with hooks
- **Python**: Follow PEP 8 conventions
- **Noir**: Follow standard Noir formatting

## Reporting Issues

- Use GitHub Issues to report bugs
- Include steps to reproduce, expected behavior, and screenshots if applicable
- Tag issues with appropriate labels

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
