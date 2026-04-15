import React, { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';

const FIP_URL = 'http://localhost:3001';
const BACKEND_URL = 'http://localhost:3002';

export default function ConsentFlow() {
  const navigate = useNavigate();
  const { state, setAAData, setConsentHandle, setCurrentRound } = useApp();

  const [step, setStep] = useState(1);
  const [consentData, setConsentData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [fetchProgress, setFetchProgress] = useState(0);
  const [error, setError] = useState('');

  if (!state.wallet.connected) {
    navigate('/');
    return null;
  }

  const walletShort = state.wallet.address
    ? `${state.wallet.address.slice(0, 6)}...${state.wallet.address.slice(-4)}`
    : '';

  // Step 1: Grant consent via FIP backend
  const handleConsent = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${FIP_URL}/consent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ walletAddress: state.wallet.address }),
        signal: AbortSignal.timeout(10000),
      });
      const data = await res.json();
      setConsentData(data);
      setConsentHandle(data.consentHandle || data.consentId);
      setStep(2);
    } catch (e) {
      setError(`FIP server error: ${e.message}. Is mock-fip running on port 3001?`);
    } finally {
      setLoading(false);
    }
  }, [state.wallet.address, setConsentHandle]);

  // Step 2: Fetch financial data from FIP
  const handleFetchData = useCallback(async () => {
    setLoading(true);
    setError('');
    setFetchProgress(0);

    const progressTimer = setInterval(() => {
      setFetchProgress(p => Math.min(p + 12, 85));
    }, 200);

    try {
      // Fetch financial data
      const res = await fetch(`${FIP_URL}/fi/fetch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ consentHandle: consentData?.consentHandle }),
        signal: AbortSignal.timeout(15000),
      });
      const result = await res.json();

      clearInterval(progressTimer);
      setFetchProgress(90);

      // Fetch Algorand round
      try {
        const roundRes = await fetch(`${BACKEND_URL}/algorand/status`, { signal: AbortSignal.timeout(5000) });
        const roundData = await roundRes.json();
        if (roundData.round) setCurrentRound(roundData.round);
      } catch (_) {}

      setFetchProgress(100);
      setAAData(result.data);

      await new Promise(r => setTimeout(r, 400));
      navigate('/proof');
    } catch (e) {
      clearInterval(progressTimer);
      setError(`Data fetch failed: ${e.message}. Is mock-fip running?`);
    } finally {
      setLoading(false);
    }
  }, [consentData, setAAData, setCurrentRound, navigate]);

  return (
    <div className="min-h-screen bg-surface-950 flex items-center justify-center p-4">
      <div className="w-full max-w-lg animate-fade-in">

        {/* Header */}
        <div className="text-center mb-6">
          <h1 className="text-xl font-bold text-white tracking-tight">Account Aggregator Consent</h1>
          <p className="text-surface-400 text-sm mt-1">Securely share financial data for credit assessment</p>
          <div className="inline-flex items-center gap-2 mt-3 badge-accent">
            <span className="w-1.5 h-1.5 rounded-full bg-accent-400" />
            <span className="font-mono">{walletShort}</span>
          </div>
        </div>

        {/* Steps */}
        <div className="flex items-center justify-center gap-2 mb-6">
          <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium ${
            step >= 1 ? 'bg-brand-500/10 text-brand-400 border border-brand-500/20' : 'bg-surface-800 text-surface-500'
          }`}>
            <span className="w-4 h-4 rounded-full bg-brand-500/20 flex items-center justify-center text-[9px] font-bold">1</span>
            Consent
          </div>
          <div className="w-6 h-px bg-surface-700" />
          <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium ${
            step >= 2 ? 'bg-accent-500/10 text-accent-400 border border-accent-500/20' : 'bg-surface-800 text-surface-500'
          }`}>
            <span className="w-4 h-4 rounded-full bg-accent-500/20 flex items-center justify-center text-[9px] font-bold">2</span>
            Fetch Data
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-4 p-3 bg-danger-500/10 border border-danger-500/20 rounded-lg">
            <p className="text-danger-400 text-xs">{error}</p>
          </div>
        )}

        {/* Main Card */}
        <div className="card p-6">
          {step === 1 ? (
            <div>
              <h3 className="text-sm font-semibold text-white mb-2">Financial Data Consent</h3>
              <p className="text-surface-400 text-xs mb-5">
                PRIV-FI uses India's Account Aggregator framework to securely access your financial data. Your raw data is never stored on-chain.
              </p>

              {/* Data scope */}
              <div className="space-y-2 mb-5">
                {[
                  { icon: (
                    <svg className="w-4 h-4 text-brand-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                  ), text: 'Data encrypted end-to-end (TLS + AES-256)' },
                  { icon: (
                    <svg className="w-4 h-4 text-accent-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                  ), text: 'Processed locally — predicates evaluated server-side' },
                  { icon: (
                    <svg className="w-4 h-4 text-success-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" /></svg>
                  ), text: 'No raw data stored on Algorand — only boolean results' },
                  { icon: (
                    <svg className="w-4 h-4 text-warn-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                  ), text: 'Revocable at any time (DPDP Act compliant)' },
                ].map((item, i) => (
                  <div key={i} className="flex items-center gap-3 p-2.5 bg-surface-800/50 rounded-lg">
                    {item.icon}
                    <span className="text-surface-300 text-xs">{item.text}</span>
                  </div>
                ))}
              </div>

              <button
                id="btn-grant-consent"
                onClick={handleConsent}
                disabled={loading}
                className="w-full btn-primary py-3"
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="w-3.5 h-3.5 animate-spin" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                    Requesting consent...
                  </span>
                ) : 'Grant Consent & Proceed'}
              </button>
            </div>
          ) : (
            <div>
              <h3 className="text-sm font-semibold text-white mb-2">Fetch Financial Data</h3>

              {/* Consent confirmation */}
              <div className="p-3 bg-success-500/5 border border-success-500/15 rounded-lg mb-4">
                <div className="flex items-center gap-2 mb-1">
                  <svg className="w-3.5 h-3.5 text-success-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="text-success-400 text-xs font-medium">Consent granted</span>
                </div>
                <p className="text-surface-400 text-[11px] font-mono pl-5.5">
                  {consentData?.consentId || consentData?.consentHandle}
                </p>
                {consentData?.expiresAt && (
                  <p className="text-surface-500 text-[10px] pl-5.5 mt-0.5">
                    Expires: {new Date(consentData.expiresAt).toLocaleString()}
                  </p>
                )}
              </div>

              {/* Data scope */}
              <div className="bg-surface-800/40 rounded-lg p-3.5 mb-5">
                <p className="section-label mb-2">Data Scope</p>
                <div className="space-y-1.5">
                  {[
                    ['Transaction History', '6 months (180 days)'],
                    ['Balance Snapshots', '6 monthly closing balances'],
                    ['Credit Summary', 'Monthly credit aggregates'],
                  ].map(([label, value], i) => (
                    <div key={i} className="flex justify-between">
                      <span className="text-surface-400 text-xs">{label}</span>
                      <span className="text-surface-200 text-xs font-medium">{value}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Progress */}
              {loading && (
                <div className="mb-4">
                  <div className="flex justify-between text-[11px] text-surface-400 mb-1">
                    <span>Fetching from Account Aggregator...</span>
                    <span>{fetchProgress}%</span>
                  </div>
                  <div className="w-full h-1.5 bg-surface-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-accent-500 rounded-full transition-all duration-300"
                      style={{ width: `${fetchProgress}%` }}
                    />
                  </div>
                </div>
              )}

              <button
                id="btn-fetch-data"
                onClick={handleFetchData}
                disabled={loading}
                className="w-full btn-accent py-3"
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="w-3.5 h-3.5 animate-spin" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                    Fetching data...
                  </span>
                ) : 'Fetch Financial Data'}
              </button>
            </div>
          )}
        </div>

        {/* Privacy notice */}
        <div className="mt-4 p-3 bg-surface-900/40 border border-surface-800/40 rounded-lg">
          <p className="text-surface-500 text-[10px] text-center">
            Raw financial data never leaves the backend. Only zero-knowledge proof boolean results are anchored on Algorand.
          </p>
        </div>
      </div>
    </div>
  );
}
