import React, { createContext, useContext, useReducer, useCallback } from 'react';

const AppContext = createContext(null);

const BACKEND_URL = 'http://localhost:3002';

const initialState = {
  wallet: {
    address: null,     // Algorand base32 address string
    sk: null,          // Uint8Array secret key (for signing)
    mnemonic: null,    // Stored temporarily for real Algorand tx submission
    peraConnected: false,
    connected: false,
    balance: null,     // Real balance from testnet
  },
  aaData: null,        // Financial data from mock FIP
  consentHandle: null,  // AA consent handle
  proof: null,         // Proof data from delegation server
  credential: null,    // Stored credential
  txId: null,          // Last transaction ID
  currentRound: 0,     // Live Algorand round
  networkStatus: null,  // Algorand network health
  loading: false,
  error: null,
  backendUrl: BACKEND_URL,
};

function appReducer(state, action) {
  switch (action.type) {
    case 'SET_WALLET':
      return {
        ...state,
        wallet: { ...state.wallet, ...action.payload, connected: true },
        error: null,
      };
    case 'SET_BALANCE':
      return {
        ...state,
        wallet: { ...state.wallet, balance: action.payload },
      };
    case 'DISCONNECT_WALLET':
      return {
        ...initialState,
      };
    case 'SET_AA_DATA':
      return { ...state, aaData: action.payload, error: null };
    case 'SET_CONSENT_HANDLE':
      return { ...state, consentHandle: action.payload };
    case 'SET_PROOF':
      return { ...state, proof: action.payload, error: null };
    case 'SET_CREDENTIAL':
      return { ...state, credential: action.payload, error: null };
    case 'SET_TX_ID':
      return { ...state, txId: action.payload };
    case 'SET_CURRENT_ROUND':
      return { ...state, currentRound: action.payload };
    case 'SET_NETWORK_STATUS':
      return { ...state, networkStatus: action.payload };
    case 'SET_LOADING':
      return { ...state, loading: action.payload };
    case 'SET_ERROR':
      return { ...state, error: action.payload, loading: false };
    case 'CLEAR_ERROR':
      return { ...state, error: null };
    default:
      return state;
  }
}

export function AppProvider({ children }) {
  const [state, dispatch] = useReducer(appReducer, initialState);

  const setWallet = useCallback((walletData) => {
    dispatch({ type: 'SET_WALLET', payload: walletData });
  }, []);

  const setBalance = useCallback((balance) => {
    dispatch({ type: 'SET_BALANCE', payload: balance });
  }, []);

  const disconnectWallet = useCallback(() => {
    dispatch({ type: 'DISCONNECT_WALLET' });
  }, []);

  const setAAData = useCallback((data) => {
    dispatch({ type: 'SET_AA_DATA', payload: data });
  }, []);

  const setConsentHandle = useCallback((handle) => {
    dispatch({ type: 'SET_CONSENT_HANDLE', payload: handle });
  }, []);

  const setProof = useCallback((proof) => {
    dispatch({ type: 'SET_PROOF', payload: proof });
  }, []);

  const setCredential = useCallback((cred) => {
    dispatch({ type: 'SET_CREDENTIAL', payload: cred });
  }, []);

  const setTxId = useCallback((txId) => {
    dispatch({ type: 'SET_TX_ID', payload: txId });
  }, []);

  const setCurrentRound = useCallback((round) => {
    dispatch({ type: 'SET_CURRENT_ROUND', payload: round });
  }, []);

  const setNetworkStatus = useCallback((status) => {
    dispatch({ type: 'SET_NETWORK_STATUS', payload: status });
  }, []);

  const setLoading = useCallback((loading) => {
    dispatch({ type: 'SET_LOADING', payload: loading });
  }, []);

  const setError = useCallback((error) => {
    dispatch({ type: 'SET_ERROR', payload: error });
  }, []);

  const clearError = useCallback(() => {
    dispatch({ type: 'CLEAR_ERROR' });
  }, []);

  const value = {
    state,
    dispatch,
    setWallet,
    setBalance,
    disconnectWallet,
    setAAData,
    setConsentHandle,
    setProof,
    setCredential,
    setTxId,
    setCurrentRound,
    setNetworkStatus,
    setLoading,
    setError,
    clearError,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
}

export default AppContext;
