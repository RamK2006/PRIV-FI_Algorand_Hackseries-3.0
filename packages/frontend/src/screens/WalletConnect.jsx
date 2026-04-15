import React, { useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import algosdk from 'algosdk';

const BACKEND = 'http://localhost:3002';

export default function WalletConnect() {
  const navigate = useNavigate();
  const { setWallet, setBalance, setCurrentRound, setNetworkStatus, state } = useApp();
  const [mnemonic, setMnemonic] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showMnemonic, setShowMnemonic] = useState(false);
  const [networkInfo, setNetworkInfo] = useState(null);
  const [generatedWallet, setGeneratedWallet] = useState(null);

  // Fetch Algorand network status on mount
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${BACKEND}/algorand/status`, { signal: AbortSignal.timeout(5000) });
        const data = await res.json();
        setNetworkInfo(data);
        if (data.round) setCurrentRound(data.round);
        setNetworkStatus(data);
      } catch (e) {
        setNetworkInfo({ round: 0, error: 'Backend offline' });
      }
    })();
  }, [setCurrentRound, setNetworkStatus]);

  // Fetch balance after wallet connect
  const fetchBalance = useCallback(async (address) => {
    try {
      const res = await fetch(`${BACKEND}/algorand/account/${address}`, { signal: AbortSignal.timeout(5000) });
      const data = await res.json();
      if (data.balance !== undefined) {
        setBalance(data.balance);
        return data;
      }
    } catch (e) {
      console.warn('Could not fetch balance:', e.message);
    }
    return null;
  }, [setBalance]);

  // Handle mnemonic import
  const handleMnemonicConnect = useCallback(async () => {
    setError('');
    setLoading(true);
    try {
      const trimmed = mnemonic.trim().toLowerCase();
      const words = trimmed.split(/\s+/);
      if (words.length !== 25) {
        throw new Error(`Expected 25 words, got ${words.length}`);
      }

      const account = algosdk.mnemonicToSecretKey(trimmed);
      const addrStr = account.addr.toString();

      setWallet({
        address: addrStr,
        sk: account.sk,
        mnemonic: trimmed,
        peraConnected: false,
      });

      // Fetch real balance
      const acctInfo = await fetchBalance(addrStr);
      setMnemonic('');

      if (acctInfo && acctInfo.balance === 0) {
        setError('Wallet has 0 balance. Fund it at the testnet faucet, then proceed.');
      }

      navigate('/consent');
    } catch (e) {
      setError(e.message || 'Invalid mnemonic');
    } finally {
      setLoading(false);
    }
  }, [mnemonic, setWallet, navigate, fetchBalance]);

  // Generate a new test wallet
  const handleGenerateWallet = useCallback(async () => {
    setError('');
    setLoading(true);
    try {
      const res = await fetch(`${BACKEND}/generate-wallet`, {
        method: 'POST',
        signal: AbortSignal.timeout(5000),
      });
      const data = await res.json();
      setGeneratedWallet(data);
      setMnemonic(data.mnemonic);
      setShowMnemonic(true);
    } catch (e) {
      // Fallback: generate locally
      const account = algosdk.generateAccount();
      const mn = algosdk.secretKeyToMnemonic(account.sk);
      setGeneratedWallet({
        address: account.addr.toString(),
        mnemonic: mn,
        faucet: `https://bank.testnet.algorand.network/?account=${account.addr}`,
      });
      setMnemonic(mn);
      setShowMnemonic(true);
    } finally {
      setLoading(false);
    }
  }, []);

  // Handle Pera Wallet (optional — may not be installed)
  const handlePeraConnect = useCallback(async () => {
    setError('');
    setLoading(true);
    try {
      const moduleName = '@pera' + 'wallet/connect';
      const peraModule = await import(/* @vite-ignore */ moduleName);
      const PeraWalletConnect = peraModule.PeraWalletConnect || peraModule.default;
      const peraWallet = new PeraWalletConnect();
      const accounts = await peraWallet.connect();
      if (accounts && accounts.length > 0) {
        setWallet({ address: accounts[0], sk: null, peraConnected: true });
        await fetchBalance(accounts[0]);
        navigate('/consent');
      }
    } catch (e) {
      setError('Pera Wallet unavailable. Use mnemonic import instead.');
      setShowMnemonic(true);
    } finally {
      setLoading(false);
    }
  }, [setWallet, navigate, fetchBalance]);

  if (state.wallet.connected) {
    navigate('/consent');
    return null;
  }

  return (
    <div className="min-h-screen bg-surface-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md animate-fade-in">

        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-xl bg-brand-600/20 border border-brand-500/30 mb-4">
            <svg className="w-7 h-7 text-brand-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">PRIV-FI</h1>
          <p className="text-surface-400 text-sm mt-1">Privacy-Preserving Credit Oracle</p>

          {/* Network status */}
          <div className="inline-flex items-center gap-2 mt-4 px-3 py-1.5 rounded-md bg-surface-900 border border-surface-700/40">
            <span className={`w-1.5 h-1.5 rounded-full ${networkInfo?.round > 0 ? 'bg-success-400 animate-pulse-subtle' : 'bg-surface-500'}`} />
            <span className="text-surface-400 text-xs font-mono">
              {networkInfo?.round > 0
                ? `Algorand Testnet • Round ${networkInfo.round.toLocaleString()}`
                : 'Connecting to Algorand...'}
            </span>
          </div>
        </div>

        {/* Main Card */}
        <div className="card p-6">
          <h2 className="text-sm font-semibold text-white mb-1">Connect Wallet</h2>
          <p className="text-surface-400 text-xs mb-5">
            Connect an Algorand testnet wallet to begin the credit assessment flow.
          </p>

          {/* Error */}
          {error && (
            <div className="mb-4 p-3 bg-danger-500/10 border border-danger-500/20 rounded-lg">
              <p className="text-danger-400 text-xs">{error}</p>
            </div>
          )}

          {/* Pera Wallet */}
          <button
            id="btn-pera-connect"
            onClick={handlePeraConnect}
            disabled={loading}
            className="w-full flex items-center gap-3 p-3.5 bg-surface-800/60 hover:bg-surface-800 border border-surface-700/40 hover:border-brand-500/30 rounded-lg transition-all duration-200 group mb-2.5"
          >
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-yellow-500/20 to-yellow-600/20 border border-yellow-500/20 flex items-center justify-center flex-shrink-0">
              <svg className="w-4 h-4 text-yellow-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.172 13.828a4 4 0 015.656 0l4-4a4 4 0 00-5.656-5.656l-1.102 1.101" />
              </svg>
            </div>
            <div className="text-left">
              <div className="text-white text-sm font-medium group-hover:text-brand-300 transition-colors">Pera Wallet</div>
              <div className="text-surface-500 text-[11px]">Browser extension or mobile</div>
            </div>
            <svg className="w-4 h-4 text-surface-600 ml-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>

          {/* Mnemonic toggle */}
          <button
            id="btn-mnemonic-toggle"
            onClick={() => setShowMnemonic(!showMnemonic)}
            className="w-full flex items-center gap-3 p-3.5 bg-surface-800/60 hover:bg-surface-800 border border-surface-700/40 hover:border-accent-500/30 rounded-lg transition-all duration-200 group mb-2.5"
          >
            <div className="w-9 h-9 rounded-lg bg-accent-500/10 border border-accent-500/20 flex items-center justify-center flex-shrink-0">
              <svg className="w-4 h-4 text-accent-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
              </svg>
            </div>
            <div className="text-left">
              <div className="text-white text-sm font-medium group-hover:text-accent-300 transition-colors">Mnemonic Import</div>
              <div className="text-surface-500 text-[11px]">Enter 25-word recovery phrase</div>
            </div>
            <svg className={`w-4 h-4 text-surface-600 ml-auto transition-transform duration-200 ${showMnemonic ? 'rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>

          {/* Mnemonic input */}
          {showMnemonic && (
            <div className="mb-3 animate-slide-down">
              {generatedWallet && (
                <div className="mb-3 p-3 bg-accent-500/5 border border-accent-500/20 rounded-lg">
                  <p className="text-accent-400 text-xs font-medium mb-1">Generated Test Wallet</p>
                  <p className="text-surface-300 text-[11px] font-mono break-all">{generatedWallet.address}</p>
                  <a
                    href={generatedWallet.faucet}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 mt-2 text-accent-400 hover:text-accent-300 text-[11px] transition-colors"
                  >
                    Fund this wallet on Algorand faucet →
                  </a>
                </div>
              )}
              <textarea
                id="input-mnemonic"
                value={mnemonic}
                onChange={(e) => setMnemonic(e.target.value)}
                placeholder="Enter your 25-word Algorand mnemonic..."
                rows={3}
                className="input-field font-mono text-xs resize-none"
              />
              <button
                id="btn-mnemonic-connect"
                onClick={handleMnemonicConnect}
                disabled={loading || !mnemonic.trim()}
                className="w-full mt-2 btn-primary"
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="w-3.5 h-3.5 animate-spin" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                    Connecting...
                  </span>
                ) : 'Connect Wallet'}
              </button>
            </div>
          )}

          {/* Divider */}
          <div className="flex items-center gap-3 my-4">
            <div className="flex-1 h-px bg-surface-800" />
            <span className="text-surface-500 text-[10px] uppercase tracking-wider">or</span>
            <div className="flex-1 h-px bg-surface-800" />
          </div>

          {/* Generate test wallet */}
          <button
            id="btn-generate-wallet"
            onClick={handleGenerateWallet}
            disabled={loading}
            className="w-full btn-secondary text-xs"
          >
            Generate Test Wallet
            <span className="block text-[10px] text-surface-500 mt-0.5 font-normal">
              Creates a fresh Algorand testnet keypair
            </span>
          </button>
        </div>

        {/* Footer links */}
        <div className="mt-4 flex items-center justify-between px-1">
          <a
            href="https://bank.testnet.algorand.network"
            target="_blank"
            rel="noopener noreferrer"
            className="text-surface-500 hover:text-accent-400 text-[11px] transition-colors"
          >
            Algorand Testnet Faucet ↗
          </a>

          {networkInfo?.explorer && (
            <a
              href={networkInfo.explorer}
              target="_blank"
              rel="noopener noreferrer"
              className="text-surface-500 hover:text-accent-400 text-[11px] transition-colors"
            >
              Pera Explorer ↗
            </a>
          )}
        </div>

        <div className="mt-3 text-center">
          <p className="text-surface-600 text-[10px]">Built for Algorand Bharat Hack Series 3.0</p>
        </div>
      </div>
    </div>
  );
}
