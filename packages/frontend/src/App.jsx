import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AppProvider } from './context/AppContext';
import ErrorBoundary from './components/ErrorBoundary';
import WalletConnect from './screens/WalletConnect';
import ConsentFlow from './screens/ConsentFlow';
import ProofGeneration from './screens/ProofGeneration';
import Dashboard from './screens/Dashboard';
import LendingUI from './screens/LendingUI';

/**
 * PRIV-FI — Privacy-Preserving Credit Oracle
 * Algorand Bharat Hack Series 3.0
 *
 * Each screen is wrapped in its own ErrorBoundary.
 * A crash in one screen cannot take down the rest of the app.
 */
export default function App() {
  return (
    <AppProvider>
      <Router>
        <div className="min-h-screen bg-dark-950 text-white">
          <Routes>
            <Route
              path="/"
              element={
                <ErrorBoundary name="WalletConnect">
                  <WalletConnect />
                </ErrorBoundary>
              }
            />
            <Route
              path="/consent"
              element={
                <ErrorBoundary name="ConsentFlow">
                  <ConsentFlow />
                </ErrorBoundary>
              }
            />
            <Route
              path="/proof"
              element={
                <ErrorBoundary name="ProofGeneration">
                  <ProofGeneration />
                </ErrorBoundary>
              }
            />
            <Route
              path="/dashboard"
              element={
                <ErrorBoundary name="Dashboard">
                  <Dashboard />
                </ErrorBoundary>
              }
            />
            <Route
              path="/lending"
              element={
                <ErrorBoundary name="LendingUI">
                  <LendingUI />
                </ErrorBoundary>
              }
            />
            {/* Fallback route */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </div>
      </Router>
    </AppProvider>
  );
}
