import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { formatTimeRemaining } from '../utils/circuitUtils';

const BACKEND = 'http://localhost:3002';
const EXPLORER_BASE = 'https://testnet.explorer.perawallet.app';
const ALGORAND_BLOCK_TIME = 2.9;

export default function Dashboard() {
  const navigate = useNavigate();
  const { state, setCredential, setCurrentRound, setBalance } = useApp();
  const [showLenderView, setShowLenderView] = useState(false);
  const [loading, setLoading] = useState(false);

  // Fetch credential from backend on mount and periodically
  const refresh = useCallback(async () => {
    if (!state.wallet.address) return;
    setLoading(true);
    try {
      // Fetch credential
      const credRes = await fetch(`${BACKEND}/credential/${state.wallet.address}`, {
        signal: AbortSignal.timeout(5000),
      });
      const credData = await credRes.json();
      if (credData.exists) {
        setCredential(credData);
        setCurrentRound(credData.currentRound || state.currentRound);
      }

      // Fetch balance
      try {
        const balRes = await fetch(`${BACKEND}/algorand/account/${state.wallet.address}`, {
          signal: AbortSignal.timeout(5000),
        });
        const balData = await balRes.json();
        if (balData.balance !== undefined) setBalance(balData.balance);
      } catch (_) {}

    } catch (e) {
      console.warn('Dashboard refresh error:', e.message);
    } finally {
      setLoading(false);
    }
  }, [state.wallet.address, state.currentRound, setCredential, setCurrentRound, setBalance]);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 30000);
    return () => clearInterval(interval);
  }, []); // eslint-disable-line

  // Redirect if no wallet
  useEffect(() => {
    if (!state.wallet.connected) navigate('/');
  }, [state.wallet.connected, navigate]);

  const cred = state.credential;
  const currentRound = state.currentRound || 0;

  if (!cred || !cred.exists) {
    return (
      <div className="min-h-screen bg-surface-950 flex items-center justify-center p-4">
        <div className="card p-8 max-w-md text-center">
          <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-surface-800 border border-surface-700 flex items-center justify-center">
            <svg className="w-5 h-5 text-surface-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <h2 className="text-base font-semibold text-white mb-1">No Credential Found</h2>
          <p className="text-surface-400 text-xs mb-5">Complete the proof flow to receive your credit credential.</p>
          <button onClick={() => navigate('/consent')} className="btn-primary">
            Start Proof Flow
          </button>
        </div>
      </div>
    );
  }

  const roundsRemaining = Math.max(0, (cred.expiryRound || 0) - currentRound);
  const secondsRemaining = roundsRemaining * ALGORAND_BLOCK_TIME;
  const isValid = cred.exists && roundsRemaining > 0;
  const progress = Math.min(100, (roundsRemaining / 208000) * 100);

  let urgency = 'expired';
  if (isValid) {
    if (roundsRemaining > 72000) urgency = 'green';
    else if (roundsRemaining > 24000) urgency = 'yellow';
    else urgency = 'red';
  }

  const urgencyStyles = {
    green: { border: 'border-success-500/20', label: 'text-success-400', dot: 'bg-success-400', bar: 'bg-success-400' },
    yellow: { border: 'border-warn-500/20', label: 'text-warn-400', dot: 'bg-warn-400', bar: 'bg-warn-400' },
    red: { border: 'border-danger-500/20', label: 'text-danger-400', dot: 'bg-danger-400', bar: 'bg-danger-400' },
    expired: { border: 'border-surface-700', label: 'text-surface-500', dot: 'bg-surface-500', bar: 'bg-surface-600' },
  };
  const uStyle = urgencyStyles[urgency];

  const predicates = [
    { label: 'Balance Threshold', ok: cred.balanceOk, desc: 'Avg balance ≥ ₹25,000' },
    { label: 'Income Regularity', ok: cred.incomeOk, desc: '5/6 months income ≥ ₹5,000' },
    { label: 'Salary Detection', ok: cred.regularityOk, desc: '4/6 months within 80-120%' },
  ];

  const walletShort = state.wallet.address
    ? `${state.wallet.address.slice(0, 6)}...${state.wallet.address.slice(-4)}`
    : '';

  return (
    <div className="min-h-screen bg-surface-950 p-4">
      <div className="max-w-2xl mx-auto pt-6 animate-fade-in">

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-lg font-bold text-white">Dashboard</h1>
            <p className="text-surface-400 text-xs mt-0.5">PRIV-FI Credential Status</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={refresh}
              disabled={loading}
              className="p-2 bg-surface-800 hover:bg-surface-700 rounded-lg transition-colors disabled:opacity-50 border border-surface-700/40"
              title="Refresh"
            >
              <svg className={`w-3.5 h-3.5 text-surface-400 ${loading ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
            <div className="px-2.5 py-1 bg-surface-800 rounded-md border border-surface-700/40">
              <span className="text-surface-400 text-[10px] font-mono">
                Round {currentRound.toLocaleString()}
              </span>
            </div>
          </div>
        </div>

        {/* Wallet info */}
        <div className="flex items-center gap-3 mb-5 p-3 card">
          <div className="w-8 h-8 rounded-lg bg-brand-500/10 border border-brand-500/20 flex items-center justify-center">
            <svg className="w-4 h-4 text-brand-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-surface-300 text-xs font-mono truncate">{state.wallet.address}</p>
          </div>
          {state.wallet.balance !== null && state.wallet.balance !== undefined && (
            <div className="text-right">
              <p className="text-white text-sm font-semibold">{(state.wallet.balance / 1e6).toFixed(4)}</p>
              <p className="text-surface-500 text-[10px]">ALGO</p>
            </div>
          )}
          <a
            href={`${EXPLORER_BASE}/address/${state.wallet.address}`}
            target="_blank"
            rel="noopener noreferrer"
            className="p-1.5 bg-surface-800 hover:bg-surface-700 rounded transition-colors"
            title="View on Explorer"
          >
            <svg className="w-3 h-3 text-surface-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
          </a>
        </div>

        {/* Credential Card */}
        <div className={`card p-5 mb-4 border ${uStyle.border}`}>
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-lg bg-surface-800 flex items-center justify-center">
                {isValid ? (
                  <svg className="w-5 h-5 text-success-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5 text-surface-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                )}
              </div>
              <div>
                <h2 className="text-sm font-semibold text-white">Credit Credential</h2>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className={`w-1.5 h-1.5 rounded-full ${uStyle.dot} ${isValid ? 'animate-pulse-subtle' : ''}`} />
                  <span className={`${uStyle.label} text-xs`}>
                    {isValid ? formatTimeRemaining(secondsRemaining) : 'Expired'}
                  </span>
                </div>
              </div>
            </div>
            <div className="text-right">
              <p className="text-surface-500 text-[10px]">Expiry Round</p>
              <p className="text-surface-200 text-xs font-mono">{cred.expiryRound?.toLocaleString()}</p>
            </div>
          </div>

          {/* Predicates */}
          <div className="grid grid-cols-3 gap-2 mb-4">
            {predicates.map((p, i) => (
              <div key={i} className={`p-2.5 rounded-lg border text-center ${
                p.ok ? 'bg-success-500/5 border-success-500/15' : 'bg-danger-500/5 border-danger-500/15'
              }`}>
                <span className={`text-xs font-bold ${p.ok ? 'text-success-400' : 'text-danger-400'}`}>
                  {p.ok ? 'PASS' : 'FAIL'}
                </span>
                <div className="text-surface-300 text-[10px] mt-0.5 font-medium">{p.label}</div>
                <div className="text-surface-500 text-[9px] mt-0.5">{p.desc}</div>
              </div>
            ))}
          </div>

          {/* Validity bar */}
          <div className="bg-surface-800/40 rounded-lg p-2.5">
            <div className="flex justify-between text-[10px] mb-1">
              <span className="text-surface-500">Validity</span>
              <span className={uStyle.label}>{roundsRemaining.toLocaleString()} rounds remaining</span>
            </div>
            <div className="w-full h-1 bg-surface-800 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-1000 ${uStyle.bar}`}
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        </div>

        {/* Lender's View Toggle */}
        <div className="mb-4">
          <button
            id="btn-lender-view-toggle"
            onClick={() => setShowLenderView(!showLenderView)}
            className={`w-full p-3.5 rounded-xl border transition-all duration-300 ${
              showLenderView
                ? 'bg-brand-500/5 border-brand-500/20'
                : 'bg-surface-900/60 border-surface-700/40 border-dashed hover:border-brand-500/30'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                  showLenderView ? 'bg-brand-500/15' : 'bg-surface-800'
                }`}>
                  <svg className="w-4 h-4 text-brand-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                </div>
                <div className="text-left">
                  <span className="text-white text-xs font-medium">
                    {showLenderView ? "Lender's View — Active" : "Toggle Lender's View"}
                  </span>
                  <div className="text-surface-500 text-[10px]">See what the lending protocol sees on Algorand</div>
                </div>
              </div>
              <div className={`w-9 h-5 rounded-full p-0.5 transition-colors ${showLenderView ? 'bg-brand-500' : 'bg-surface-700'}`}>
                <div className={`w-4 h-4 rounded-full bg-white shadow transition-transform ${showLenderView ? 'translate-x-4' : 'translate-x-0'}`} />
              </div>
            </div>
          </button>
        </div>

        {/* Lender's View Content */}
        {showLenderView && (
          <div className="mb-4 animate-slide-up">
            <div className="card p-5 border border-brand-500/15">
              <div className="flex items-center gap-2 mb-4">
                <svg className="w-4 h-4 text-brand-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
                <h3 className="text-sm font-semibold text-white">What the Lending Protocol Sees</h3>
              </div>

              {/* Visible */}
              <div className="space-y-1.5 mb-4">
                <p className="section-label text-success-400 mb-1">Verified On-Chain (ZK Proof)</p>
                {predicates.map((p, i) => (
                  <div key={i} className="flex items-center gap-2.5 p-2 bg-success-500/5 border border-success-500/10 rounded-lg">
                    <svg className="w-3.5 h-3.5 text-success-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                    </svg>
                    <span className="text-surface-200 text-xs">{p.label}:</span>
                    <span className="text-success-400 text-xs font-medium">{p.ok ? 'Verified' : 'Unverified'}</span>
                  </div>
                ))}
                <div className="flex items-center gap-2.5 p-2 bg-success-500/5 border border-success-500/10 rounded-lg">
                  <svg className="w-3.5 h-3.5 text-success-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="text-surface-200 text-xs">Valid until round:</span>
                  <span className="text-success-400 text-xs font-mono">{cred.expiryRound?.toLocaleString()}</span>
                </div>
              </div>

              {/* Separator */}
              <div className="border-t border-surface-700 my-4 relative">
                <span className="absolute left-1/2 -translate-x-1/2 -translate-y-1/2 bg-surface-900 px-2.5 text-surface-500 text-[9px] uppercase tracking-wider font-medium">
                  Privacy Boundary
                </span>
              </div>

              {/* Hidden */}
              <div className="space-y-1.5">
                <p className="section-label text-danger-400 mb-1">Not Accessible (ZK Protected)</p>
                {['Account number', 'Bank balance', 'Transaction history', 'Name / Identity', 'Bank name', 'Income amount', 'Employer details'].map((item, i) => (
                  <div key={i} className="flex items-center gap-2.5 p-2 bg-danger-500/3 border border-danger-500/10 rounded-lg">
                    <svg className="w-3.5 h-3.5 text-danger-400/60 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                    <span className="text-surface-500 text-xs">{item}</span>
                    <span className="text-danger-400/40 text-[10px] italic ml-auto">Protected</span>
                  </div>
                ))}
              </div>

              <div className="mt-4 p-2.5 bg-brand-500/5 border border-brand-500/15 rounded-lg">
                <p className="text-brand-300 text-[11px] text-center">
                  "The Algorand protocol never saw this borrower's bank data."
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="grid grid-cols-2 gap-3">
          <button
            id="btn-apply-loan"
            onClick={() => navigate('/lending')}
            className="card-interactive p-4 text-center"
          >
            <svg className="w-5 h-5 text-accent-400 mx-auto mb-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="text-white text-xs font-medium">Apply for Loan</span>
            <span className="text-surface-500 text-[10px] block">Undercollateralized</span>
          </button>
          <button
            id="btn-new-proof"
            onClick={() => navigate('/consent')}
            className="card-interactive p-4 text-center"
          >
            <svg className="w-5 h-5 text-brand-400 mx-auto mb-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            <span className="text-white text-xs font-medium">New Proof</span>
            <span className="text-surface-500 text-[10px] block">Refresh credential</span>
          </button>
        </div>
      </div>
    </div>
  );
}
