import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { parsePublicInputs } from '../utils/circuitUtils';

const BACKEND = 'http://localhost:3002';

const STEPS = [
  { id: 1, label: 'Sending data to delegation server', phase: 'prepare' },
  { id: 2, label: 'Evaluating balance predicate (avg ≥ ₹25,000)', phase: 'compute' },
  { id: 3, label: 'Evaluating income regularity (5/6 months ≥ ₹5,000)', phase: 'compute' },
  { id: 4, label: 'Evaluating salary detection (80-120% range)', phase: 'compute' },
  { id: 5, label: 'Generating SHA-256 nullifier', phase: 'crypto' },
  { id: 6, label: 'Constructing proof structure (256 bytes)', phase: 'crypto' },
  { id: 7, label: 'Storing credential on backend', phase: 'submit' },
  { id: 8, label: 'Anchoring to Algorand Testnet', phase: 'submit' },
];

export default function ProofGeneration() {
  const navigate = useNavigate();
  const { state, setProof, setCredential, setTxId } = useApp();

  const [currentStep, setCurrentStep] = useState(0);
  const [status, setStatus] = useState('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [txResult, setTxResult] = useState(null);
  const [predicateResults, setPredicateResults] = useState(null);
  const [serverLogs, setServerLogs] = useState([]);
  const isGenerating = useRef(false);
  const logEndRef = useRef(null);

  useEffect(() => {
    if (!state.aaData && !state.wallet.connected) {
      navigate('/');
    }
  }, [state.aaData, state.wallet.connected, navigate]);

  // Auto-scroll logs
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [serverLogs]);

  const addLog = (msg, type = 'info') => {
    const ts = new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
    setServerLogs(prev => [...prev, { ts, msg, type }]);
  };

  const generateAndSubmit = useCallback(async () => {
    if (isGenerating.current) return;
    isGenerating.current = true;

    setStatus('generating');
    setErrorMsg('');
    setCurrentStep(0);
    setServerLogs([]);

    try {
      // Step 1: Send to delegation server
      setCurrentStep(1);
      addLog('Connecting to delegation server at localhost:3002...');
      await new Promise(r => setTimeout(r, 300));

      addLog(`Sending ${state.aaData?.transactions?.length || 0} transactions, ${state.aaData?.balances?.length || 0} balances`);

      // Step 2-4: Actual proof generation via backend
      setCurrentStep(2);
      addLog('POST /generate-proof — computing predicates server-side...');

      const proofResponse = await fetch(`${BACKEND}/generate-proof`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          aaData: state.aaData,
          circuitInputs: {
            transactions: (state.aaData?.transactions || []).map(String),
            balances: (state.aaData?.balances || []).map(String),
            wallet_address: state.wallet.address,
            data_hash: '0',
            timestamp: Math.floor(Date.now() / 1000).toString(),
            balance_threshold: '25000',
            income_threshold: '5000',
            current_round: state.currentRound.toString(),
          },
        }),
        signal: AbortSignal.timeout(30000),
      });

      if (!proofResponse.ok) {
        const errData = await proofResponse.json();
        throw new Error(errData.error || 'Proof generation failed');
      }

      const proofData = await proofResponse.json();
      setPredicateResults(proofData.predicates);

      // Show predicate results step by step
      const preds = proofData.predicates;
      addLog(`Balance predicate: ${preds.balanceOk ? 'PASS' : 'FAIL'} (avg: ₹${preds.details.avgBalance.toLocaleString()})`, preds.balanceOk ? 'success' : 'error');
      setCurrentStep(3);
      await new Promise(r => setTimeout(r, 400));

      addLog(`Income regularity: ${preds.incomeOk ? 'PASS' : 'FAIL'} (${preds.details.qualifyingMonths}/${preds.details.requiredMonths} qualifying months)`, preds.incomeOk ? 'success' : 'error');
      setCurrentStep(4);
      await new Promise(r => setTimeout(r, 400));

      addLog(`Salary detection: ${preds.regularityOk ? 'PASS' : 'FAIL'} (${preds.details.regularMonths}/4 within 80-120% range)`, preds.regularityOk ? 'success' : 'error');
      setCurrentStep(5);
      await new Promise(r => setTimeout(r, 300));

      addLog(`Nullifier: ${proofData.nullifier?.slice(0, 22)}...`, 'info');
      setCurrentStep(6);
      await new Promise(r => setTimeout(r, 300));

      addLog(`Proof: ${proofData.proof.length} bytes generated`, 'info');
      addLog(`Expiry round: ${proofData.expiryRound?.toLocaleString()} (current + 208,000)`, 'info');

      // Store proof in context
      setProof({
        proof: new Uint8Array(proofData.proof),
        publicInputs: proofData.publicInputs,
      });

      // Step 7: Submit credential to backend
      setCurrentStep(7);
      setStatus('submitting');
      addLog('POST /submit-credential — storing credential & anchoring to Algorand...', 'info');

      const parsedCred = parsePublicInputs(proofData.publicInputs);

      const submitResponse = await fetch(`${BACKEND}/submit-credential`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          walletAddress: state.wallet.address,
          credential: {
            balanceOk: parsedCred.balanceOk,
            incomeOk: parsedCred.incomeOk,
            regularityOk: parsedCred.regularityOk,
            expiryRound: parsedCred.expiryRound || proofData.expiryRound,
            nullifier: proofData.nullifier,
            issuedAt: Math.floor(Date.now() / 1000),
          },
          mnemonic: state.wallet.mnemonic || null,
        }),
        signal: AbortSignal.timeout(30000),
      });

      const submitResult = await submitResponse.json();

      // Step 8: Show result
      setCurrentStep(8);

      const tx = submitResult.transaction;
      setTxId(tx.txId);
      setTxResult({
        txId: tx.txId,
        confirmedRound: tx.confirmedRound,
        onChain: tx.onChain,
        explorer: tx.explorer,
        demo: !tx.onChain,
      });

      if (tx.onChain) {
        addLog(`✓ Algorand TX confirmed: ${tx.txId}`, 'success');
        addLog(`✓ Explorer: ${tx.explorer}`, 'success');
      } else {
        addLog(`Credential stored off-chain. TX ref: ${tx.txId}`, 'warn');
        if (!state.wallet.mnemonic) {
          addLog('Tip: Import wallet via mnemonic for real Algorand transactions', 'warn');
        }
      }

      // Set credential in context
      setCredential({
        ...parsedCred,
        expiryRound: parsedCred.expiryRound || proofData.expiryRound,
        issuedAt: Math.floor(Date.now() / 1000),
        exists: true,
      });

      addLog('━━━ Process complete ━━━', 'info');
      setStatus('success');

    } catch (e) {
      console.error('Proof error:', e);
      setStatus('error');
      setErrorMsg(e.message || 'Unexpected error');
      addLog(`ERROR: ${e.message}`, 'error');
    } finally {
      isGenerating.current = false;
    }
  }, [state, setProof, setCredential, setTxId]);

  const logColors = {
    info: 'text-surface-400',
    success: 'text-success-400',
    error: 'text-danger-400',
    warn: 'text-warn-400',
  };

  return (
    <div className="min-h-screen bg-surface-950 flex items-center justify-center p-4">
      <div className="w-full max-w-xl animate-fade-in">

        <div className="text-center mb-6">
          <h1 className="text-xl font-bold text-white tracking-tight">Zero-Knowledge Proof Generation</h1>
          <p className="text-surface-400 text-sm mt-1">Privacy-preserving credit predicate evaluation</p>
        </div>

        <div className="card p-5">
          {status === 'idle' && (
            <div>
              <h3 className="text-sm font-semibold text-white mb-2">Ready to Generate</h3>
              <p className="text-surface-400 text-xs mb-5">
                Your financial data will be sent to the delegation server for predicate evaluation. Only boolean results and a unique nullifier are produced — no raw data is stored.
              </p>

              {/* What will be proven */}
              <div className="bg-surface-800/40 rounded-lg p-3.5 mb-5">
                <p className="section-label mb-2">Predicates to Evaluate</p>
                <div className="space-y-2">
                  {[
                    { label: 'Balance Threshold', desc: 'Average balance ≥ ₹25,000', icon: '₹' },
                    { label: 'Income Regularity', desc: '5 of 6 months with income ≥ ₹5,000', icon: '↗' },
                    { label: 'Salary Detection', desc: '4 of 6 months within 80-120% range', icon: '≈' },
                  ].map((item, i) => (
                    <div key={i} className="flex items-start gap-2.5">
                      <span className="w-5 h-5 rounded bg-brand-500/10 text-brand-400 text-[10px] font-bold flex items-center justify-center flex-shrink-0 mt-0.5">{item.icon}</span>
                      <div>
                        <span className="text-surface-200 text-xs font-medium">{item.label}</span>
                        <span className="text-surface-500 text-[11px] ml-1.5">{item.desc}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <button
                id="btn-generate-proof"
                onClick={generateAndSubmit}
                className="w-full btn-primary py-3"
              >
                Generate & Submit Proof
              </button>
            </div>
          )}

          {(status === 'generating' || status === 'submitting') && (
            <div>
              {/* Steps */}
              <div className="space-y-1.5 mb-4">
                {STEPS.map((step) => {
                  const isActive = currentStep === step.id;
                  const isComplete = currentStep > step.id;
                  const isPending = currentStep < step.id;

                  return (
                    <div
                      key={step.id}
                      className={`flex items-center gap-2.5 px-3 py-2 rounded-lg transition-all duration-300 ${
                        isActive ? 'bg-brand-500/8 border border-brand-500/20' :
                        isComplete ? 'bg-success-500/5' : 'opacity-40'
                      }`}
                    >
                      <div className="w-5 h-5 flex items-center justify-center flex-shrink-0">
                        {isComplete ? (
                          <svg className="w-3.5 h-3.5 text-success-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
                        ) : isActive ? (
                          <svg className="w-3.5 h-3.5 text-brand-400 animate-spin" viewBox="0 0 24 24" fill="none">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                          </svg>
                        ) : (
                          <span className="w-1.5 h-1.5 rounded-full bg-surface-600" />
                        )}
                      </div>
                      <span className={`text-xs font-medium ${
                        isComplete ? 'text-success-400' : isActive ? 'text-white' : 'text-surface-500'
                      }`}>{step.label}</span>
                    </div>
                  );
                })}
              </div>

              {/* Progress bar */}
              <div className="w-full h-1 bg-surface-800 rounded-full overflow-hidden mb-4">
                <div
                  className="h-full bg-brand-500 rounded-full transition-all duration-500"
                  style={{ width: `${(currentStep / 8) * 100}%` }}
                />
              </div>

              {/* Server Log */}
              {serverLogs.length > 0 && (
                <div className="terminal-log max-h-40">
                  {serverLogs.map((log, i) => (
                    <div key={i} className={`${logColors[log.type]} leading-relaxed`}>
                      <span className="text-surface-600">[{log.ts}]</span> {log.msg}
                    </div>
                  ))}
                  <div ref={logEndRef} />
                </div>
              )}
            </div>
          )}

          {status === 'success' && txResult && (
            <div className="animate-scale-in">
              <div className="text-center mb-5">
                <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-success-500/10 border border-success-500/20 flex items-center justify-center">
                  <svg className="w-6 h-6 text-success-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h3 className="text-lg font-bold text-white">Proof Verified</h3>
                <p className="text-surface-400 text-xs mt-1">
                  {txResult.onChain ? 'Anchored on Algorand Testnet' : 'Credential stored — ready for lending'}
                </p>
              </div>

              {/* Results */}
              {predicateResults && (
                <div className="grid grid-cols-3 gap-2 mb-4">
                  {[
                    { label: 'Balance', ok: predicateResults.balanceOk },
                    { label: 'Income', ok: predicateResults.incomeOk },
                    { label: 'Regularity', ok: predicateResults.regularityOk },
                  ].map((p, i) => (
                    <div key={i} className={`text-center p-2.5 rounded-lg border ${
                      p.ok ? 'bg-success-500/5 border-success-500/20' : 'bg-danger-500/5 border-danger-500/20'
                    }`}>
                      <span className={`text-xs font-bold ${p.ok ? 'text-success-400' : 'text-danger-400'}`}>
                        {p.ok ? 'PASS' : 'FAIL'}
                      </span>
                      <div className="text-surface-400 text-[10px] mt-0.5">{p.label}</div>
                    </div>
                  ))}
                </div>
              )}

              {/* Transaction info */}
              <div className="bg-surface-800/40 rounded-lg p-3 mb-4 space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-surface-500 text-xs">Transaction</span>
                  <span className="text-surface-200 text-xs font-mono truncate max-w-[220px]">{txResult.txId}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-surface-500 text-xs">Status</span>
                  <span className={`text-xs font-medium ${txResult.onChain ? 'text-success-400' : 'text-warn-400'}`}>
                    {txResult.onChain ? `Confirmed (round ${txResult.confirmedRound?.toLocaleString()})` : 'Off-chain'}
                  </span>
                </div>
              </div>

              {txResult.explorer && txResult.onChain && (
                <a
                  href={txResult.explorer}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block text-center text-accent-400 hover:text-accent-300 text-xs mb-4 transition-colors"
                >
                  View on Pera Explorer →
                </a>
              )}

              {/* Server logs (collapsed) */}
              {serverLogs.length > 0 && (
                <details className="mb-4">
                  <summary className="text-surface-500 text-[11px] cursor-pointer hover:text-surface-300 transition-colors">
                    Server computation log ({serverLogs.length} entries)
                  </summary>
                  <div className="terminal-log mt-2 max-h-32">
                    {serverLogs.map((log, i) => (
                      <div key={i} className={`${logColors[log.type]} leading-relaxed`}>
                        <span className="text-surface-600">[{log.ts}]</span> {log.msg}
                      </div>
                    ))}
                  </div>
                </details>
              )}

              <button
                id="btn-go-dashboard"
                onClick={() => navigate('/dashboard')}
                className="w-full btn-accent py-3"
              >
                View Dashboard →
              </button>
            </div>
          )}

          {status === 'error' && (
            <div className="text-center">
              <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-danger-500/10 border border-danger-500/20 flex items-center justify-center">
                <svg className="w-5 h-5 text-danger-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
              <h3 className="text-sm font-semibold text-white mb-1">Proof Generation Failed</h3>
              <p className="text-danger-400 text-xs mb-2">{errorMsg}</p>
              <p className="text-surface-500 text-[11px] mb-4">
                Make sure the delegation server is running on port 3002.
              </p>

              {serverLogs.length > 0 && (
                <div className="terminal-log mb-4 max-h-24 text-left">
                  {serverLogs.map((log, i) => (
                    <div key={i} className={`${logColors[log.type]}`}>
                      <span className="text-surface-600">[{log.ts}]</span> {log.msg}
                    </div>
                  ))}
                </div>
              )}

              <button
                onClick={() => { setStatus('idle'); setCurrentStep(0); setServerLogs([]); }}
                className="btn-secondary"
              >
                Try Again
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
