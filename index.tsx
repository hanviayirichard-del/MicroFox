
// Safe localStorage & sessionStorage Polyfill for restricted/iframe environments
const createMockStorage = () => {
  const store: Record<string, string> = {};
  const mock: any = {
    length: 0,
    clear: () => {
      for (const k in store) {
        delete store[k];
      }
      mock.length = 0;
    },
    getItem: (key: string) => {
      return key in store ? store[key] : null;
    },
    key: (index: number) => {
      const keys = Object.keys(store);
      return keys[index] || null;
    },
    removeItem: (key: string) => {
      delete store[key];
      mock.length = Object.keys(store).length;
    },
    setItem: (key: string, value: string) => {
      store[key] = String(value);
      mock.length = Object.keys(store).length;
    }
  };
  return mock;
};

// Check and polyfill window/global storage objects safely
let nativeLocalStorage: any = null;
let nativeSessionStorage: any = null;
let isStorageUsable = false;

try {
  const testKey = '__storage_test_key__';
  window.localStorage.setItem(testKey, 'test');
  window.localStorage.removeItem(testKey);
  nativeLocalStorage = window.localStorage;
  isStorageUsable = true;
} catch (e) {
  console.warn('Native localStorage is blocked or restricted. Will use in-memory fallback.');
}

try {
  const testKey = '__storage_test_key__';
  window.sessionStorage.setItem(testKey, 'test');
  window.sessionStorage.removeItem(testKey);
  nativeSessionStorage = window.sessionStorage;
} catch (e) {
  console.warn('Native sessionStorage is blocked or restricted. Will use in-memory fallback.');
}

const mockLocalStorage = createMockStorage();
const mockSessionStorage = createMockStorage();

const safeLocalStorage = {
  get length() {
    try {
      if (nativeLocalStorage) return nativeLocalStorage.length;
    } catch (e) {}
    return mockLocalStorage.length;
  },
  clear: () => {
    try {
      if (nativeLocalStorage) {
        nativeLocalStorage.clear();
        return;
      }
    } catch (e) {}
    mockLocalStorage.clear();
  },
  getItem: (key: string) => {
    try {
      if (nativeLocalStorage) return nativeLocalStorage.getItem(key);
    } catch (e) {}
    return mockLocalStorage.getItem(key);
  },
  key: (index: number) => {
    try {
      if (nativeLocalStorage) return nativeLocalStorage.key(index);
    } catch (e) {}
    return mockLocalStorage.key(index);
  },
  removeItem: (key: string) => {
    try {
      if (nativeLocalStorage) {
        nativeLocalStorage.removeItem(key);
        return;
      }
    } catch (e) {}
    mockLocalStorage.removeItem(key);
  },
  setItem: (key: string, value: string) => {
    try {
      if (nativeLocalStorage) {
        nativeLocalStorage.setItem(key, value);
        return;
      }
    } catch (e) {}
    mockLocalStorage.setItem(key, value);
  }
};

const safeSessionStorage = {
  get length() {
    try {
      if (nativeSessionStorage) return nativeSessionStorage.length;
    } catch (e) {}
    return mockSessionStorage.length;
  },
  clear: () => {
    try {
      if (nativeSessionStorage) {
        nativeSessionStorage.clear();
        return;
      }
    } catch (e) {}
    mockSessionStorage.clear();
  },
  getItem: (key: string) => {
    try {
      if (nativeSessionStorage) return nativeSessionStorage.getItem(key);
    } catch (e) {}
    return mockSessionStorage.getItem(key);
  },
  key: (index: number) => {
    try {
      if (nativeSessionStorage) return nativeSessionStorage.key(index);
    } catch (e) {}
    return mockSessionStorage.key(index);
  },
  removeItem: (key: string) => {
    try {
      if (nativeSessionStorage) {
        nativeSessionStorage.removeItem(key);
        return;
      }
    } catch (e) {}
    mockSessionStorage.removeItem(key);
  },
  setItem: (key: string, value: string) => {
    try {
      if (nativeSessionStorage) {
        nativeSessionStorage.setItem(key, value);
        return;
      }
    } catch (e) {}
    mockSessionStorage.setItem(key, value);
  }
};

// Define safe references globally on window
(window as any).__safeLocalStorage = safeLocalStorage;
(window as any).__safeSessionStorage = safeSessionStorage;

const defineStorage = (obj: any, prop: string, value: any) => {
  if (!obj) return;
  try {
    Object.defineProperty(obj, prop, {
      get: () => value,
      set: () => {},
      configurable: true,
      enumerable: true
    });
  } catch (e) {
    try {
      obj[prop] = value;
    } catch (err) {}
  }
};

if (!isStorageUsable) {
  // Define on prototype and globals to intercept any native window/global access
  try {
    defineStorage(Window.prototype, 'localStorage', safeLocalStorage);
    defineStorage(Window.prototype, 'sessionStorage', safeSessionStorage);
  } catch (err) {}

  defineStorage(window, 'localStorage', safeLocalStorage);
  defineStorage(window, 'sessionStorage', safeSessionStorage);
  defineStorage(globalThis, 'localStorage', safeLocalStorage);
  defineStorage(globalThis, 'sessionStorage', safeSessionStorage);

  // Safe Storage.prototype wrapper to handle both native and mock storage objects seamlessly
  try {
    const originalGetItem = Storage.prototype.getItem;
    Storage.prototype.getItem = function(key) {
      try {
        return originalGetItem.call(this, key);
      } catch (e) {
        if (this && typeof (this as any).getItem === 'function' && (this as any).getItem !== Storage.prototype.getItem) {
          return (this as any).getItem(key);
        }
        return null;
      }
    };

    const originalSetItem = Storage.prototype.setItem;
    Storage.prototype.setItem = function(key, value) {
      try {
        originalSetItem.call(this, key, value);
      } catch (e) {
        if (this && typeof (this as any).setItem === 'function' && (this as any).setItem !== Storage.prototype.setItem) {
          (this as any).setItem(key, value);
        }
      }
    };

    const originalRemoveItem = Storage.prototype.removeItem;
    Storage.prototype.removeItem = function(key) {
      try {
        originalRemoveItem.call(this, key);
      } catch (e) {
        if (this && typeof (this as any).removeItem === 'function' && (this as any).removeItem !== Storage.prototype.removeItem) {
          (this as any).removeItem(key);
        }
      }
    };

    const originalKey = Storage.prototype.key;
    Storage.prototype.key = function(index) {
      try {
        return originalKey.call(this, index);
      } catch (e) {
        if (this && typeof (this as any).key === 'function' && (this as any).key !== Storage.prototype.key) {
          return (this as any).key(index);
        }
        return null;
      }
    };

    const originalClear = Storage.prototype.clear;
    Storage.prototype.clear = function() {
      try {
        originalClear.call(this);
      } catch (e) {
        if (this && typeof (this as any).clear === 'function' && (this as any).clear !== Storage.prototype.clear) {
          (this as any).clear();
        }
      }
    };
  } catch (e) {
    console.warn('Failed to override Storage.prototype:', e);
  }
}

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
