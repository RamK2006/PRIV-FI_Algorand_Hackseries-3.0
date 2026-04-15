/**
 * PRIV-FI Mock FIP (Financial Information Provider) Server
 * Simulates India's Account Aggregator financial data endpoint.
 *
 * Port: 3001
 * CORS: http://localhost:5173
 */

const express = require('express');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = process.env.MOCK_FIP_PORT || 3001;

// CORS for frontend
app.use(cors({
  origin: ['http://localhost:5173', 'http://127.0.0.1:5173'],
  credentials: true,
}));
app.use(express.json());

// ═══════════════════════════════════════════════════════════════
// Health Check
// ═══════════════════════════════════════════════════════════════
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'PRIV-FI Mock FIP Server', timestamp: Date.now() });
});

// ═══════════════════════════════════════════════════════════════
// POST /consent — Returns consent handle with UUID
// ═══════════════════════════════════════════════════════════════
app.post('/consent', (req, res) => {
  const consentHandle = uuidv4();
  console.log(`[FIP] Consent granted: ${consentHandle}`);
  res.json({
    status: 'ACTIVE',
    consentHandle,
    consentId: `PRIV-FI-CONSENT-${consentHandle.slice(0, 8).toUpperCase()}`,
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 86400000).toISOString(), // 24 hours
    fiDataRange: {
      from: new Date(Date.now() - 180 * 86400000).toISOString(), // 6 months ago
      to: new Date().toISOString(),
    },
    purpose: 'PRIV-FI Credit Assessment',
  });
});

// ═══════════════════════════════════════════════════════════════
// Helper: Generate passing AA data
// All three ZK predicates evaluate to TRUE with this data.
//
// Monthly balances: [45000, 48000, 42000, 51000, 47000, 44000] (all > 25,000)
// Each of 6 monthly buckets has total credits > 5,000
// At least 4 of 6 months have credits within 80-120% of maximum
// Day 5 of each month has a 25,000 salary credit
// ═══════════════════════════════════════════════════════════════
function generatePassingData() {
  const transactions = [];

  for (let month = 0; month < 6; month++) {
    for (let day = 0; day < 30; day++) {
      if (day === 4) {
        // Day 5: Salary credit of 25,000
        transactions.push(25000);
      } else if (day % 7 === 0) {
        // Weekly small credit
        transactions.push(500);
      } else if (day % 3 === 0) {
        // Periodic debit (negative = expense)
        transactions.push(0); // In circuit, we only sum positives, so debits are 0
      } else {
        transactions.push(0);
      }
    }
  }

  const balances = [45000, 48000, 42000, 51000, 47000, 44000];

  const monthlyCreditSummary = [
    { month: '2024-06', totalCredits: 27500 },
    { month: '2024-05', totalCredits: 26800 },
    { month: '2024-04', totalCredits: 28200 },
    { month: '2024-03', totalCredits: 25500 },
    { month: '2024-02', totalCredits: 27000 },
    { month: '2024-01', totalCredits: 26200 },
  ];

  return {
    transactions,
    balances,
    monthlyCreditSummary,
    signature: `fip-sig-${uuidv4().slice(0, 8)}`,
    fipCertHash: '0x' + 'cafe'.repeat(16),
    dataProvider: 'Mock FIP — Account Aggregator Simulation',
    fetchedAt: new Date().toISOString(),
    accountType: 'SAVINGS',
    accountNumber: 'XXXX-XXXX-' + Math.floor(1000 + Math.random() * 9000),
  };
}

// ═══════════════════════════════════════════════════════════════
// Helper: Generate failing AA data
// Balances below threshold, inconsistent income, no regularity
// ═══════════════════════════════════════════════════════════════
function generateFailingData() {
  const transactions = [];

  for (let month = 0; month < 6; month++) {
    for (let day = 0; day < 30; day++) {
      if (month < 2 && day === 15) {
        // Only 2 months have any significant credits
        transactions.push(3000);
      } else if (day === 10) {
        transactions.push(200);
      } else {
        transactions.push(0);
      }
    }
  }

  const balances = [8000, 9500, 7200, 11000, 8800, 9200];

  const monthlyCreditSummary = [
    { month: '2024-06', totalCredits: 3200 },
    { month: '2024-05', totalCredits: 3200 },
    { month: '2024-04', totalCredits: 200 },
    { month: '2024-03', totalCredits: 200 },
    { month: '2024-02', totalCredits: 200 },
    { month: '2024-01', totalCredits: 200 },
  ];

  return {
    transactions,
    balances,
    monthlyCreditSummary,
    signature: `fip-sig-fail-${uuidv4().slice(0, 8)}`,
    fipCertHash: '0x' + '0000'.repeat(16),
    dataProvider: 'Mock FIP — Account Aggregator Simulation',
    fetchedAt: new Date().toISOString(),
    accountType: 'SAVINGS',
    accountNumber: 'XXXX-XXXX-' + Math.floor(1000 + Math.random() * 9000),
  };
}

// ═══════════════════════════════════════════════════════════════
// POST /fi/fetch — Returns complete mock AA data (PASSING)
// ═══════════════════════════════════════════════════════════════
app.post('/fi/fetch', (req, res) => {
  console.log('[FIP] Financial data fetched (passing dataset)');
  const data = generatePassingData();
  res.json({
    status: 'SUCCESS',
    data,
  });
});

// ═══════════════════════════════════════════════════════════════
// POST /fi/fetch-failing — Same structure but with failing data
// ═══════════════════════════════════════════════════════════════
app.post('/fi/fetch-failing', (req, res) => {
  console.log('[FIP] Financial data fetched (failing dataset)');
  const data = generateFailingData();
  res.json({
    status: 'SUCCESS',
    data,
  });
});

// ═══════════════════════════════════════════════════════════════
// GET /fi/current-round — Real Algorand round from testnet
// Falls back to demo value if network is unreachable
// ═══════════════════════════════════════════════════════════════
app.get('/fi/current-round', async (req, res) => {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const response = await fetch('https://testnet-api.4160.nodely.dev/v2/status', {
      signal: controller.signal,
    });
    clearTimeout(timeout);

    const data = await response.json();
    res.json({ round: data['last-round'] });
  } catch (e) {
    console.log('[FIP] Could not fetch Algorand round, using demo fallback');
    res.json({ round: 40000000 }); // demo fallback
  }
});

// ═══════════════════════════════════════════════════════════════
// Global error handler — never crashes
// ═══════════════════════════════════════════════════════════════
app.use((err, req, res, next) => {
  console.error('[FIP] Unhandled error:', err.message);
  res.status(500).json({ error: 'Internal server error', message: err.message });
});

process.on('uncaughtException', (err) => {
  console.error('[FIP] Uncaught exception:', err.message);
});

process.on('unhandledRejection', (reason) => {
  console.error('[FIP] Unhandled rejection:', reason);
});

// ═══════════════════════════════════════════════════════════════
// Start server
// ═══════════════════════════════════════════════════════════════
app.listen(PORT, () => {
  console.log(`\n  🏦 PRIV-FI Mock FIP Server`);
  console.log(`  ├─ Port: ${PORT}`);
  console.log(`  ├─ Health: http://localhost:${PORT}/health`);
  console.log(`  ├─ Consent: POST http://localhost:${PORT}/consent`);
  console.log(`  ├─ Fetch Data: POST http://localhost:${PORT}/fi/fetch`);
  console.log(`  ├─ Failing Data: POST http://localhost:${PORT}/fi/fetch-failing`);
  console.log(`  └─ Current Round: GET http://localhost:${PORT}/fi/current-round\n`);
});
