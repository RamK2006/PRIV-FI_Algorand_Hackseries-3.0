import React, { useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';

const BACKEND = 'http://localhost:3002';
const EXPLORER_BASE = 'https://testnet.explorer.perawallet.app';

const LOAN_PRESETS = [
  { amount: 10000, label: '0.01 ALGO', tier: 'Micro' },
  { amount: 25000, label: '0.025 ALGO', tier: 'Small' },
  { amount: 50000, label: '0.05 ALGO', tier: 'Medium' },
  { amount: 100000, label: '0.1 ALGO', tier: 'Maximum' },
];

export default function LendingUI() {
  const navigate = useNavigate();
  const { state } = useApp();

  const [selectedAmount, setSelectedAmount] = useState(50000);
  const [customAmount, setCustomAmount] = useState('');
  const [status, setStatus] = useState('idle');
  const [result, setResult] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');

  const cred = state.credential;

  useEffect(() => {
    if (!state.wallet.connected) navigate('/');
  }, [state.wallet.connected, navigate]);

  // Compute LTV from credential
  const computeLTV = (c) => {
    if (!c) return { ltv: 0, tier: 'None', verified: 0 };
    const count = [c.balanceOk, c.incomeOk, c.regularityOk].filter(Boolean).length;
    if (count >= 3) return { ltv: 70, tier: 'Premium', verified: count };
    if (count === 2) return { ltv: 50, tier: 'Standard', verified: count };
    if (count === 1) return { ltv: 30, tier: 'Basic', verified: count };
    return { ltv: 0, tier: 'None', verified: 0 };
  };

  const ltvInfo = computeLTV(cred);
  const formatAlgo = (micro) => (micro / 1e6).toFixed(4) + ' ALGO';

  const handleLoan = useCallback(async () => {
    const amount = customAmount ? parseInt(customAmount) : selectedAmount;
    if (!amount || amount <= 0 || amount > 100000) {
      setErrorMsg('Amount must be between 1 and 100,000 μALGO');
      return;
    }

    setStatus('processing');
    setErrorMsg('');

    try {
      const res = await fetch(`${BACKEND}/request-loan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          walletAddress: state.wallet.address,
          amountMicroAlgo: amount,
          mnemonic: state.wallet.mnemonic || null,
        }),
        signal: AbortSignal.timeout(30000),
      });

      const data = await res.json();

      if (data.approved) {
        setResult({
          ...data,
          txId: data.transaction?.txId,
          onChain: data.transaction?.onChain,
          explorer: data.transaction?.explorer,
        });
        setStatus('approved');
      } else {
        setResult(data);
        setStatus('rejected');
        setErrorMsg(data.reason || 'Loan rejected');
      }
    } catch (e) {
      setErrorMsg(e.message || 'Loan request failed');
      setStatus('error');
    }
  }, [selectedAmount, customAmount, state.wallet]);

  return (
    <div className="min-h-screen bg-surface-950 p-4">
      <div className="max-w-lg mx-auto pt-6 animate-fade-in">

        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => navigate('/dashboard')} className="p-2 bg-surface-800 hover:bg-surface-700 rounded-lg transition-colors border border-surface-700/40">
            <svg className="w-3.5 h-3.5 text-surface-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div>
            <h1 className="text-lg font-bold text-white">Apply for Loan</h1>
            <p className="text-surface-400 text-xs">Undercollateralized lending on Algorand</p>
          </div>
        </div>

        {/* LTV Card */}
        <div className="card p-4 mb-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-surface-500 text-[10px] uppercase tracking-wider">Your LTV Tier</p>
              <div className={`text-2xl font-bold mt-0.5 ${
                ltvInfo.ltv >= 70 ? 'text-success-400' :
                ltvInfo.ltv >= 50 ? 'text-warn-400' :
                ltvInfo.ltv >= 30 ? 'text-warn-500' : 'text-danger-400'
              }`}>
                {ltvInfo.ltv}% <span className="text-xs font-normal text-surface-400">{ltvInfo.tier}</span>
              </div>
            </div>
            <div className="text-right">
              <p className="text-surface-500 text-[10px] mb-1">Predicates</p>
              <div className="flex gap-1">
                {[cred?.balanceOk, cred?.incomeOk, cred?.regularityOk].map((ok, i) => (
                  <span key={i} className={`w-5 h-5 rounded flex items-center justify-center text-[10px] font-bold ${
                    ok ? 'bg-success-500/10 text-success-400 border border-success-500/20' : 'bg-surface-800 text-surface-600 border border-surface-700'
                  }`}>
                    {ok ? '✓' : '–'}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>

        {status === 'idle' && (
          <>
            {/* Amount Selection */}
            <div className="card p-4 mb-4">
              <h3 className="text-xs font-semibold text-white mb-3">Select Amount</h3>
              <div className="grid grid-cols-2 gap-2 mb-3">
                {LOAN_PRESETS.map((preset) => (
                  <button
                    key={preset.amount}
                    onClick={() => { setSelectedAmount(preset.amount); setCustomAmount(''); }}
                    className={`p-2.5 rounded-lg border transition-all text-left ${
                      selectedAmount === preset.amount && !customAmount
                        ? 'bg-brand-500/8 border-brand-500/25'
                        : 'bg-surface-800/40 border-surface-700/40 hover:border-surface-600'
                    }`}
                  >
                    <div className="text-white text-sm font-medium">{preset.label}</div>
                    <div className="text-surface-500 text-[10px]">{preset.tier} • {preset.amount.toLocaleString()} μALGO</div>
                  </button>
                ))}
              </div>

              <div className="relative">
                <input
                  id="input-custom-amount"
                  type="number"
                  value={customAmount}
                  onChange={(e) => setCustomAmount(e.target.value)}
                  placeholder="Custom amount (microALGO)"
                  min="1"
                  max="100000"
                  className="input-field pr-14 text-xs"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-surface-500 text-[10px]">μALGO</span>
              </div>
              {customAmount && (
                <p className="text-surface-400 text-[10px] mt-1">= {formatAlgo(parseInt(customAmount) || 0)}</p>
              )}
            </div>

            {errorMsg && (
              <div className="mb-3 p-2.5 bg-danger-500/10 border border-danger-500/20 rounded-lg">
                <p className="text-danger-400 text-xs">{errorMsg}</p>
              </div>
            )}

            <button
              id="btn-request-loan"
              onClick={handleLoan}
              disabled={!cred?.exists || ltvInfo.ltv === 0}
              className="w-full btn-accent py-3"
            >
              Request {formatAlgo(customAmount ? parseInt(customAmount) || 0 : selectedAmount)} Loan
            </button>
            <p className="text-surface-500 text-[10px] text-center mt-2">
              Max: 0.1 ALGO (100,000 μALGO) on testnet
            </p>
          </>
        )}

        {status === 'processing' && (
          <div className="card p-8 text-center">
            <svg className="w-8 h-8 text-brand-400 animate-spin mx-auto mb-3" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            <h3 className="text-sm font-semibold text-white mb-1">Processing Loan</h3>
            <p className="text-surface-400 text-xs">Verifying credential and computing LTV...</p>
          </div>
        )}

        {status === 'approved' && result && (
          <div className="card p-5 border border-success-500/20 animate-scale-in">
            <div className="text-center mb-4">
              <div className="w-11 h-11 mx-auto mb-3 rounded-full bg-success-500/10 border border-success-500/20 flex items-center justify-center">
                <svg className="w-5 h-5 text-success-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h3 className="text-base font-bold text-white">Loan Approved</h3>
              <p className="text-success-400 text-xs mt-0.5">{formatAlgo(result.amount)} at {result.ltv}% LTV</p>
            </div>

            <div className="space-y-1.5 mb-4">
              {[
                ['Amount', formatAlgo(result.amount)],
                ['LTV Tier', `${result.ltv}% (${result.tier})`],
                ['Predicates', `${result.verified}/3 verified`],
                ['Transaction', result.txId],
                ['Status', result.onChain ? 'On-chain (Algorand)' : 'Off-chain'],
              ].map(([label, value], i) => (
                <div key={i} className="flex justify-between p-2 bg-surface-800/40 rounded-lg">
                  <span className="text-surface-500 text-xs">{label}</span>
                  <span className={`text-xs font-medium ${
                    label === 'Status'
                      ? (result.onChain ? 'text-success-400' : 'text-warn-400')
                      : 'text-surface-200'
                  } ${label === 'Transaction' ? 'font-mono truncate max-w-[180px]' : ''}`}>
                    {value}
                  </span>
                </div>
              ))}
            </div>

            {result.explorer && result.onChain && (
              <a
                href={result.explorer}
                target="_blank"
                rel="noopener noreferrer"
                className="block text-center text-accent-400 hover:text-accent-300 text-xs mb-3 transition-colors"
              >
                View on Pera Explorer →
              </a>
            )}

            <div className="p-2.5 bg-brand-500/5 border border-brand-500/15 rounded-lg mb-4">
              <p className="text-brand-300 text-[11px] text-center">
                "The Algorand protocol never saw this borrower's bank data."
              </p>
            </div>

            <button
              onClick={() => navigate('/dashboard')}
              className="w-full btn-secondary"
            >
              ← Back to Dashboard
            </button>
          </div>
        )}

        {status === 'rejected' && (
          <div className="card p-6 text-center border border-danger-500/20">
            <div className="w-10 h-10 mx-auto mb-3 rounded-full bg-danger-500/10 border border-danger-500/20 flex items-center justify-center">
              <svg className="w-4 h-4 text-danger-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <h3 className="text-sm font-semibold text-white mb-1">Loan Rejected</h3>
            <p className="text-danger-400 text-xs mb-4">{errorMsg}</p>
            <button onClick={() => { setStatus('idle'); setErrorMsg(''); }} className="btn-secondary">Try Again</button>
          </div>
        )}

        {status === 'error' && (
          <div className="card p-6 text-center border border-danger-500/20">
            <h3 className="text-sm font-semibold text-white mb-1">Error</h3>
            <p className="text-danger-400 text-xs mb-4">{errorMsg}</p>
            <button onClick={() => { setStatus('idle'); setErrorMsg(''); }} className="btn-secondary">Try Again</button>
          </div>
        )}
      </div>
    </div>
  );
}
