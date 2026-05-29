
import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';

class ErrorBoundary extends React.Component<any, any> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("ErrorBoundary caught an error", error, errorInfo);
  }

  handleReload = () => {
    window.location.reload();
  };

  handleReset = () => {
    try {
      const keys = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (key.startsWith('microfox_') || key.startsWith('mf_')) && key !== 'microfox_current_user' && key !== 'microfox_current_mf') {
          keys.push(key);
        }
      }
      keys.forEach(k => localStorage.removeItem(k));
    } catch (e) {}
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          height: '100vh',
          backgroundColor: '#0a1226',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#ffffff',
          padding: '24px',
          textAlign: 'center',
          fontFamily: "'Inter', sans-serif"
        }}>
          <div style={{
            width: '80px',
            height: '80px',
            backgroundColor: 'rgba(239, 68, 68, 0.1)',
            borderRadius: '32px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#ef4444',
            marginBottom: '24px'
          }}>
            <svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 13c0 5-3.5 7.5-7.66 9.7a1 1 0 0 1-.68 0C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.5 3.8 17 5 19 5a1 1 0 0 1 1 1z"/><path d="M12 8v4"/><path d="M12 16h.01"/></svg>
          </div>
          <h2 style={{ fontSize: '20px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '8px', color: '#f87171' }}>Une erreur est survenue</h2>
          <p style={{ color: '#9ca3af', fontSize: '14px', maxWidth: '448px', lineHeight: '1.625', marginBottom: '24px' }}>
            L'application a rencontré un problème inattendu lors de vos opérations. Pour éviter toute corruption ou perte de données, vous pouvez actualiser la page ou réinitialiser le cache local.
          </p>
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', justifyContent: 'center' }}>
            <button 
              onClick={this.handleReload}
              style={{
                padding: '12px 24px',
                backgroundColor: '#00c896',
                border: 'none',
                color: '#ffffff',
                borderRadius: '12px',
                fontWeight: 'bold',
                textTransform: 'uppercase',
                fontSize: '12px',
                letterSpacing: '0.05em',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
            >
              Actualiser la page
            </button>
            <button 
              onClick={this.handleReset}
              style={{
                padding: '12px 24px',
                backgroundColor: '#ef4444',
                border: 'none',
                color: '#ffffff',
                borderRadius: '12px',
                fontWeight: 'bold',
                textTransform: 'uppercase',
                fontSize: '12px',
                letterSpacing: '0.05em',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
            >
              Réinitialiser le cache & Recharger
            </button>
          </div>
          {this.state.error && (
            <pre style={{
              marginTop: '32px',
              padding: '16px',
              backgroundColor: 'rgba(0, 0, 0, 0.4)',
              border: '1px solid #1f2937',
              borderRadius: '12px',
              fontSize: '10px',
              fontFamily: "monospace",
              textAlign: 'left',
              maxWidth: '384px',
              maxHeight: '128px',
              overflow: 'auto',
              color: '#6b7280',
              whiteSpace: 'pre-wrap'
            }}>
              {this.state.error.stack || this.state.error.message}
            </pre>
          )}
          <p style={{ marginTop: '32px', color: '#4b5563', fontSize: '10px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.3em' }}>MicroFoX Protection Module</p>
        </div>
      );
    }

    return this.props.children;
  }
}

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);
