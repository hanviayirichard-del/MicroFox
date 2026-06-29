import React, { useState, useEffect, useCallback } from 'react';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import Dashboard from './components/Dashboard';
import GeographicMap from './components/GeographicMap';
import Members from './components/Members';
import DailyTontine from './components/DailyTontine';
import CancelCotisation from './components/CancelCotisation';
import VersementDuJour from './components/VersementDuJour';
import Commissions from './components/Commissions';
import CreditManagement from './components/CreditManagement';
import TontineWithdrawal from './components/TontineWithdrawal';
import TontineVerification from './components/TontineVerification';
import GapsReport from './components/GapsReport';
import GlobalJournal from './components/GlobalJournal';
import CashReceipts from './components/CashReceipts';
import EducationSupport from './components/EducationSupport';
import CreditRequest from './components/CreditRequest';
import CreditValidation from './components/CreditValidation';
import CreditDisbursement from './components/CreditDisbursement';
import OtherCreditOperations from './components/OtherCreditOperations';
import CreditGranted from './components/CreditGranted';
import AdministrativeExpenses from './components/AdministrativeExpenses';
import PersonnelSalaries from './components/PersonnelSalaries';
import FraisPartsSociales from './components/FraisPartsSociales';
import AccountingAndStates from './components/AccountingAndStates';
import RegulatoryReports from './components/RegulatoryReports';
import Analyse from './components/Analyse';
import Configuration from './components/Configuration';
import UserManagement from './components/UserManagement';
import Permissions from './components/Permissions';
import ModificationEpargneCredit from './components/ModificationEpargneCredit';
import UserActivity from './components/UserActivity';
import FieldControl from './components/FieldControl';
import PiecesAImprimer from './components/PiecesAImprimer';
import FinancialReports from './components/FinancialReports';
import AgentPayments from './components/AgentPayments';
import MainCashier from './components/MainCashier';
import VaultAndBank from './components/VaultAndBank';
import VenteLivrets from './components/VenteLivrets';
import StocksLivrets from './components/StocksLivrets';
import Notifications from './components/Notifications';
import DuplicateAlert from './components/DuplicateAlert';
import Accueil from './components/Accueil';
import GuidePratique from './components/GuidePratique';
import AccountBalance from './components/AccountBalance';
import MicrofinanceLogin from './components/MicrofinanceLogin';
import CashGaps from './components/CashGaps';
import { User, Microfinance } from './types';
import { recordAuditLog } from './utils/audit';
import { Loader2, Clock, ShieldAlert } from 'lucide-react';
import { supabase } from './supabase';

import { dispatchStorageEvent } from './utils/events';

// Capture des méthodes de stockage natives au chargement du module
const originalGetItem = (() => {
  try {
    const raw = localStorage.getItem;
    return raw ? raw.bind(localStorage) : null;
  } catch (e) {
    return null;
  }
})();

const originalSetItem = (() => {
  try {
    const raw = localStorage.setItem;
    return raw ? raw.bind(localStorage) : null;
  } catch (e) {
    return null;
  }
})();

const originalRemoveItem = (() => {
  try {
    const raw = localStorage.removeItem;
    return raw ? raw.bind(localStorage) : null;
  } catch (e) {
    return null;
  }
})();

const nativeGetItem = (key: string): string | null => {
  try {
    if (originalGetItem) return originalGetItem(key);
    return Storage.prototype.getItem.call(localStorage, key);
  } catch (e) {
    try {
      return localStorage.getItem(key);
    } catch (err) {
      return null;
    }
  }
};

const nativeSetItem = (key: string, value: string) => {
  if (key === 'microfox_members_data' || key.endsWith('microfox_members_data') || key.includes('microfox_history_')) {
    clearMembersCache();
  }
  let finalValue = value;
  
  // Optimization: Strip redundant history from members_data as it's stored in microfox_history_${id}
  if (key.endsWith('microfox_members_data')) {
    try {
      const members = JSON.parse(value);
      if (Array.isArray(members)) {
        finalValue = JSON.stringify(members.map((m: any) => {
          const { history, ...rest } = m;
          return rest;
        }));
      }
    } catch (e) {}
  }

  // Pre-emptive capping for audit logs to prevent QuotaExceededError in the first place
  if (key.endsWith('microfox_audit_logs')) {
    try {
      const logs = JSON.parse(value);
      if (Array.isArray(logs)) {
        finalValue = JSON.stringify(logs.slice(0, 100));
      }
    } catch (e) {}
  }
  
  try {
    if (originalSetItem) {
      originalSetItem(key, finalValue);
    } else {
      Storage.prototype.setItem.call(localStorage, key, finalValue);
    }
  } catch (e: any) {
    if (e.name === 'QuotaExceededError' || e.message?.includes('quota')) {
      console.warn(`LocalStorage quota exceeded for key: ${key}. Attempting emergency cleanup.`);
      
      try {
        const currentMf = nativeGetItem('microfox_current_mf') || globalMfCode;
        const activePrefix = currentMf ? `mf_${currentMf.toLowerCase().replace(/\s+/g, '_')}_` : '';
        
        const keysToRemove: string[] = [];
        const historyKeys: string[] = [];
        const logsKeys: string[] = [];
        
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (!k) continue;
          
          // Keep essential global keys
          const isGlobalEssential = [
            'microfox_current_user',
            'microfox_current_mf',
            'microfox_session_active',
            'microfox_offline_mode',
            'microfox_users',
            'microfox_permissions'
          ].includes(k);
          
          if (isGlobalEssential) continue;
          
          // Clear any key belonging to an inactive microfinance code
          if (k.startsWith('mf_') && activePrefix && !k.startsWith(activePrefix)) {
            keysToRemove.push(k);
            continue;
          }
          
          // Mark audit logs and user journeys for clean up
          if (k.includes('user_journeys') || k.includes('audit_logs')) {
            logsKeys.push(k);
          }
          
          // Mark history keys for clean up (as they are fully re-fetched or merged from server/cache)
          if (k.includes('microfox_history_')) {
            historyKeys.push(k);
          }
        }
        
        // Execute the cleanups
        keysToRemove.forEach(k => {
          try {
            if (originalRemoveItem) {
              originalRemoveItem(k);
            } else {
              Storage.prototype.removeItem.call(localStorage, k);
            }
          } catch (err) {}
        });
        
        logsKeys.forEach(k => {
          try {
            if (originalRemoveItem) {
              originalRemoveItem(k);
            } else {
              Storage.prototype.removeItem.call(localStorage, k);
            }
          } catch (err) {}
        });
        
        historyKeys.forEach(k => {
          try {
            if (originalRemoveItem) {
              originalRemoveItem(k);
            } else {
              Storage.prototype.removeItem.call(localStorage, k);
            }
          } catch (err) {}
        });
        
        // Retry the save once after emergency cleanup
        if (originalSetItem) {
          originalSetItem(key, finalValue);
        } else {
          Storage.prototype.setItem.call(localStorage, key, finalValue);
        }
      } catch (retryError) {
        console.error('Failed to resolve QuotaExceededError even after emergency cleanup:', retryError);
        window.dispatchEvent(new CustomEvent('microfox_quota_exceeded'));
      }
    }
  }
};
const nativeRemoveItem = (key: string) => {
  clearMembersCache();
  try {
    if (originalRemoveItem) {
      originalRemoveItem(key);
    } else {
      Storage.prototype.removeItem.call(localStorage, key);
    }
  } catch (err) {}
};

// Caching structure to avoid costly synchronous O(N^2) parsing during page navigation/renders
let cachedMembersKey: string | null = null;
let cachedMembersValue: string | null = null;
let cachedRehydratedValue: string | null = null;

const clearMembersCache = () => {
  cachedMembersKey = null;
  cachedMembersValue = null;
  cachedRehydratedValue = null;
};

// Variable globale pour stocker le code MF courant afin que les surcharges y aient accès immédiatement
let globalMfCode = nativeGetItem('microfox_current_mf');

// Surcharges globales du stockage de manière sécurisée
try {
  (localStorage as any).getItem = (key: string) => {
    const mfCode = globalMfCode;
    let fullKey = key;
    if (mfCode && typeof mfCode === 'string' && key.startsWith('microfox_') && 
        key !== 'microfox_current_mf' && 
        key !== 'microfox_current_user' && 
        key !== 'microfox_session_active' && 
        key !== 'microfox_users' && 
        key !== 'microfox_permissions' &&
        key !== 'microfox_microfinances') {
      const prefix = `mf_${mfCode.toLowerCase().replace(/\s+/g, '_')}_`;
      fullKey = prefix + key;
    }
    
    const value = nativeGetItem(fullKey);

    // Optimization: Rehydrate history for members_data if it was stripped
    if (key === 'microfox_members_data' && value) {
      if (cachedMembersKey === fullKey && cachedMembersValue === value && cachedRehydratedValue !== null) {
        return cachedRehydratedValue;
      }
      try {
        const members = JSON.parse(value);
        if (Array.isArray(members)) {
          const lastIdx = fullKey.lastIndexOf('microfox_members_data');
          const prefix = lastIdx !== -1 ? fullKey.substring(0, lastIdx) : '';
          const rehydrated = members.map((m: any) => {
            if (!m) return m;
            const historyKey = `${prefix}microfox_history_${m.id || m.code}`;
            const historyStr = nativeGetItem(historyKey);
            if (historyStr) {
              try {
                const parsedHistory = JSON.parse(historyStr);
                return { ...m, history: Array.isArray(parsedHistory) ? parsedHistory : [] };
              } catch (e) {
                return { ...m, history: [] };
              }
            }
            return { ...m, history: m.history || [] };
          });
          const resultString = JSON.stringify(rehydrated);
          cachedMembersKey = fullKey;
          cachedMembersValue = value;
          cachedRehydratedValue = resultString;
          return resultString;
        }
      } catch (e) {}
    }

    return value;
  };

  (localStorage as any).setItem = (key: string, value: string) => {
    if (key === 'microfox_members_data' || key.endsWith('microfox_members_data') || key.includes('microfox_history_')) {
      clearMembersCache();
    }
    if (key === 'microfox_current_mf') {
      globalMfCode = value;
    }
    const mfCode = globalMfCode;
    const isGlobal = key === 'microfox_users' || key === 'microfox_permissions' || key === 'microfox_microfinances';
    
    if (key.startsWith('microfox_') && key !== 'microfox_current_mf' && key !== 'microfox_current_user' && key !== 'microfox_session_active' && (isGlobal || mfCode)) {
      const prefix = (mfCode && !isGlobal) ? `mf_${mfCode.toLowerCase().replace(/\s+/g, '_')}_` : '';
      const fullKey = isGlobal ? key : prefix + key;
      
      nativeSetItem(fullKey, value);

      const isBalanceKey = key === 'microfox_vault_balance' || 
                           key === 'microfox_bank_balance' || 
                           key.startsWith('microfox_cash_balance_') ||
                           key === 'microfox_tontine_clients' ||
                           key === 'microfox_total_encaisse_jour' ||
                           key.startsWith('microfox_last_pulled_');

      // Mark as dirty
      if (key !== 'microfox_pending_sync' && key !== 'microfox_dirty_keys' && !isBalanceKey) {
        try {
          const dirtyKeysStr = nativeGetItem('microfox_dirty_keys') || '[]';
          let dirtyKeys = JSON.parse(dirtyKeysStr);
          if (!Array.isArray(dirtyKeys)) dirtyKeys = [];
          
          if (!dirtyKeys.includes(fullKey)) {
            dirtyKeys.push(fullKey);
            nativeSetItem('microfox_dirty_keys', JSON.stringify(dirtyKeys));
            if (prefix) {
              nativeSetItem(`${prefix}microfox_dirty_keys`, JSON.stringify(dirtyKeys));
            }
          }
        } catch (e) {
          nativeSetItem('microfox_dirty_keys', JSON.stringify([fullKey]));
          if (prefix) {
            nativeSetItem(`${prefix}microfox_dirty_keys`, JSON.stringify([fullKey]));
          }
        }
      }

      if (nativeGetItem('microfox_offline_mode') !== 'true' && !isBalanceKey) {
        const isCriticalKey = key === 'microfox_agent_payments' || key.startsWith('microfox_agent_balance_');

        if (isCriticalKey) {
          import('./utils/supabaseSync').then(async m => {
            const success = await m.syncToSupabase(fullKey, value);
            if (success) {
              try {
                const dirtyKeysStr = nativeGetItem('microfox_dirty_keys') || '[]';
                let dirtyKeys = JSON.parse(dirtyKeysStr);
                if (Array.isArray(dirtyKeys)) {
                  const updated = dirtyKeys.filter(k => k !== fullKey);
                  if (updated.length === 0) {
                    nativeRemoveItem('microfox_dirty_keys');
                    nativeRemoveItem('microfox_pending_sync');
                    if (prefix) {
                      nativeRemoveItem(`${prefix}microfox_dirty_keys`);
                      nativeRemoveItem(`${prefix}microfox_pending_sync`);
                    }
                  } else {
                    nativeSetItem('microfox_dirty_keys', JSON.stringify(updated));
                    if (prefix) {
                      nativeSetItem(`${prefix}microfox_dirty_keys`, JSON.stringify(updated));
                    }
                  }
                }
              } catch (e) {}
            }
          });
        } else {
          // Debounced sync logic to avoid hitting Supabase quota with rapid writes
          const syncDebounceKey = `sync_timeout_${fullKey}`;
          if ((window as any)[syncDebounceKey]) {
            clearTimeout((window as any)[syncDebounceKey]);
          }
          
          (window as any)[syncDebounceKey] = setTimeout(() => {
            import('./utils/supabaseSync').then(async m => {
              const success = await m.syncToSupabase(fullKey, value);
              if (success) {
                try {
                  const dirtyKeysStr = nativeGetItem('microfox_dirty_keys') || '[]';
                  let dirtyKeys = JSON.parse(dirtyKeysStr);
                  if (Array.isArray(dirtyKeys)) {
                    const updated = dirtyKeys.filter(k => k !== fullKey);
                    if (updated.length === 0) {
                      nativeRemoveItem('microfox_dirty_keys');
                      nativeRemoveItem('microfox_pending_sync');
                      if (prefix) {
                        nativeRemoveItem(`${prefix}microfox_dirty_keys`);
                        nativeRemoveItem(`${prefix}microfox_pending_sync`);
                      }
                    } else {
                      nativeSetItem('microfox_dirty_keys', JSON.stringify(updated));
                      if (prefix) {
                        nativeSetItem(`${prefix}microfox_dirty_keys`, JSON.stringify(updated));
                      }
                    }
                  }
                } catch (e) {}
              }
            });
            delete (window as any)[syncDebounceKey];
          }, 2000); // Wait 2 seconds of inactivity for this key before syncing
        }
      }
      if (key !== 'microfox_pending_sync' && !isBalanceKey) {
        nativeSetItem('microfox_pending_sync', 'true');
        if (prefix) {
          nativeSetItem(`${prefix}microfox_pending_sync`, 'true');
        }
      }
    } else {
      nativeSetItem(key, value);
    }
  };

  (localStorage as any).removeItem = (key: string) => {
    if (key === 'microfox_members_data' || key.endsWith('microfox_members_data') || key.includes('microfox_history_')) {
      clearMembersCache();
    }
    const mfCode = nativeGetItem('microfox_current_mf');
    const isGlobal = key === 'microfox_users' || key === 'microfox_permissions' || key === 'microfox_microfinances';

    if (key.startsWith('microfox_') && key !== 'microfox_current_mf' && key !== 'microfox_current_user' && key !== 'microfox_session_active' && (isGlobal || mfCode)) {
      const prefix = (mfCode && !isGlobal) ? `mf_${mfCode.toLowerCase().replace(/\s+/g, '_')}_` : '';
      const fullKey = isGlobal ? key : prefix + key;
      nativeRemoveItem(fullKey);

      const isBalanceKey = key === 'microfox_vault_balance' || 
                           key === 'microfox_bank_balance' || 
                           key.startsWith('microfox_cash_balance_') ||
                           key === 'microfox_tontine_clients' ||
                           key === 'microfox_total_encaisse_jour' ||
                           key.startsWith('microfox_last_pulled_');

      if (key !== 'microfox_pending_sync' && key !== 'microfox_dirty_keys' && !isBalanceKey) {
        try {
          const dirtyKeysStr = nativeGetItem('microfox_dirty_keys') || '[]';
          let dirtyKeys = JSON.parse(dirtyKeysStr);
          if (Array.isArray(dirtyKeys) && !dirtyKeys.includes(fullKey)) {
            dirtyKeys.push(fullKey);
            nativeSetItem('microfox_dirty_keys', JSON.stringify(dirtyKeys));
            if (prefix) {
              nativeSetItem(`${prefix}microfox_dirty_keys`, JSON.stringify(dirtyKeys));
            }
          }
        } catch (e) {
          nativeSetItem('microfox_dirty_keys', JSON.stringify([fullKey]));
          if (prefix) {
            nativeSetItem(`${prefix}microfox_dirty_keys`, JSON.stringify([fullKey]));
          }
        }
      }

      if (nativeGetItem('microfox_offline_mode') !== 'true' && !isBalanceKey) {
        const removeDebounceKey = `remove_timeout_${fullKey}`;
        if ((window as any)[removeDebounceKey]) {
          clearTimeout((window as any)[removeDebounceKey]);
        }
        
        (window as any)[removeDebounceKey] = setTimeout(() => {
          import('./supabase').then(async m => {
            if (m.supabase && (import.meta as any).env?.VITE_SUPABASE_URL) {
              const { error } = await m.supabase.from('storage').delete().eq('key', fullKey);
              if (!error) {
                try {
                  const dirtyKeysStr = nativeGetItem('microfox_dirty_keys') || '[]';
                  let dirtyKeys = JSON.parse(dirtyKeysStr);
                  if (Array.isArray(dirtyKeys)) {
                    const updated = dirtyKeys.filter(k => k !== fullKey);
                    if (updated.length === 0) {
                      nativeRemoveItem('microfox_dirty_keys');
                      nativeRemoveItem('microfox_pending_sync');
                      if (prefix) {
                        nativeRemoveItem(`${prefix}microfox_dirty_keys`);
                        nativeRemoveItem(`${prefix}microfox_pending_sync`);
                      }
                    } else {
                      nativeSetItem('microfox_dirty_keys', JSON.stringify(updated));
                      if (prefix) {
                        nativeSetItem(`${prefix}microfox_dirty_keys`, JSON.stringify(updated));
                      }
                    }
                  }
                } catch (e) {}
              }
            }
          });
          delete (window as any)[removeDebounceKey];
        }, 2000);
      }
      if (key !== 'microfox_pending_sync' && !isBalanceKey) {
        nativeSetItem('microfox_pending_sync', 'true');
        if (prefix) {
          nativeSetItem(`${prefix}microfox_pending_sync`, 'true');
        }
      }
    } else {
      nativeRemoveItem(key);
    }
  };
} catch (e) {
  console.warn('Storage overrides could not be applied fully:', e);
}

const App: React.FC = () => {
  const [isSyncing, setIsSyncing] = useState(false);
  const isSyncingRef = React.useRef(false);
  const isFirstPullRef = React.useRef(true);
  const [syncStatusText, setSyncStatusText] = useState('Mise à jour de vos données...');
  const [isBackgroundSyncing, setIsBackgroundSyncing] = useState(false);
  const [syncVersion, setSyncVersion] = useState(0);
  const [welcomeMessage, setWelcomeMessage] = useState<string | null>(null);
  const [isOfflineMode, setIsOfflineMode] = useState(() => {
    return localStorage.getItem('microfox_offline_mode') === 'true';
  });
  const mfCodeRef = React.useRef<string | null>(localStorage.getItem('microfox_current_mf'));

  const pullData = async (mfCode: string, isSilent: boolean = false, hasCachedData: boolean = true) => {
    if (isOfflineMode) {
      console.log('Skipping sync due to offline mode');
      return;
    }
    if (isSyncingRef.current) return;
    
    isSyncingRef.current = true;
    if (!isSilent) {
      setSyncStatusText('Mise à jour de vos données...');
      setIsSyncing(true);
      setIsBackgroundSyncing(false);
    } else {
      const prefix = `mf_${mfCode.toLowerCase().replace(/\s+/g, '_')}_`;
      const hasPendingSync = nativeGetItem(prefix + 'microfox_pending_sync') === 'true' || nativeGetItem('microfox_pending_sync') === 'true';
      setIsBackgroundSyncing(hasPendingSync);
    }
    
    const prefix = `mf_${mfCode.toLowerCase().replace(/\s+/g, '_')}_`;
    const isDirty = (key: string) => {
      try {
        const dirtyKeysStr = nativeGetItem(prefix + 'microfox_dirty_keys') || nativeGetItem('microfox_dirty_keys') || '[]';
        const dirtyKeys = JSON.parse(dirtyKeysStr);
        return Array.isArray(dirtyKeys) && dirtyKeys.includes(key);
      } catch (e) {
        return false;
      }
    };

    const syncPromise = (async () => {
      try {
        const { pullFromSupabase, syncToSupabase } = await import('./utils/supabaseSync');
        
        // Push local changes first to avoid overwriting them
        const hasPendingSync = nativeGetItem(prefix + 'microfox_pending_sync') === 'true' || nativeGetItem('microfox_pending_sync') === 'true';
        if (hasPendingSync) {
          const pushPromises: Promise<boolean>[] = [];
          
          // Push global data
          const usersData = nativeGetItem('microfox_users');
          if (usersData) {
            pushPromises.push(syncToSupabase('microfox_users', usersData));
          }
          const permsData = nativeGetItem('microfox_permissions');
          if (permsData) {
            pushPromises.push(syncToSupabase('microfox_permissions', permsData));
          }
          
          // Push only dirty keys to avoid pushing everything in the entire localStorage starting with prefix
          const dirtyKeysStr = nativeGetItem(prefix + 'microfox_dirty_keys') || nativeGetItem('microfox_dirty_keys') || '[]';
          let dirtyKeys: string[] = [];
          try {
            dirtyKeys = JSON.parse(dirtyKeysStr);
            if (!Array.isArray(dirtyKeys)) dirtyKeys = [];
          } catch (e) {
            dirtyKeys = [];
          }

          // If dirtyKeys is empty but pending_sync is true, scan prefix-based keys as a safe fallback
          if (dirtyKeys.length === 0) {
            const tenantKeys: string[] = [];
            for (let i = 0; i < localStorage.length; i++) {
              const k = localStorage.key(i);
              if (k) tenantKeys.push(k);
            }
            tenantKeys.forEach(k => {
              if (k.startsWith(prefix)) {
                const suffix = k.substring(prefix.length);
                const isBalanceKey = suffix === 'microfox_vault_balance' || 
                                     suffix === 'microfox_bank_balance' || 
                                     suffix.startsWith('microfox_cash_balance_') ||
                                     suffix === 'microfox_tontine_clients' ||
                                     suffix === 'microfox_total_encaisse_jour' ||
                                     suffix.startsWith('microfox_last_pulled_');
                if (!isBalanceKey && suffix !== 'microfox_pending_sync' && suffix !== 'microfox_dirty_keys') {
                  dirtyKeys.push(k);
                }
              }
            });
          }

          const uniqueDirtyKeys = Array.from(new Set(dirtyKeys)).filter(k => k && k.startsWith(prefix));
          
          uniqueDirtyKeys.forEach(k => {
            const value = nativeGetItem(k);
            if (value) {
              pushPromises.push(syncToSupabase(k, value));
            }
          });
          
          const results = await Promise.all(pushPromises);
          const pushSuccess = results.every(ok => ok);
          
          if (!pushSuccess && (import.meta as any).env?.VITE_SUPABASE_URL) {
            console.warn('La synchronisation vers le serveur a échoué. Vos modifications locales seront synchronisées ultérieurement.');
          }
          
          if (pushSuccess || !(import.meta as any).env?.VITE_SUPABASE_URL) {
            // Clear pending sync flag only if all pushed successfully or no sync configured
            nativeRemoveItem('microfox_pending_sync');
            nativeRemoveItem('microfox_dirty_keys');
            nativeRemoveItem(prefix + 'microfox_pending_sync');
            nativeRemoveItem(prefix + 'microfox_dirty_keys');
          }
        }

        // Récupérer les données globales et locataires en parallèle
        const [globalChanged, tenantChanged] = await Promise.all([
          pullFromSupabase('microfox_', nativeSetItem, nativeGetItem, isDirty, !isSilent),
          pullFromSupabase(prefix, nativeSetItem, nativeGetItem, isDirty, !isSilent)
        ]);
        
        const bIsStartup = isFirstPullRef.current;
        isFirstPullRef.current = false;

        if (globalChanged || tenantChanged || bIsStartup) {
          setSyncVersion(v => v + 1);
          // Dispatch storage event to notify components to reload from localStorage
          dispatchStorageEvent();
        }
        return 'success';
      } catch (error) {
        console.error('Background sync error:', error);
        throw error;
      } finally {
        setIsBackgroundSyncing(false);
        isSyncingRef.current = false;
      }
    })();

    // Dynamic timeout: if we have zero cached data, we wait slightly longer (2.5s) to guarantee tables populate, otherwise we timeout fast (2s) to show local copy. For explicit user-initiated syncs, wait up to 30s.
    const timeoutDuration = !isSilent ? 30000 : (hasCachedData ? 2000 : 2500);
    const timeoutPromise = new Promise((resolve) => 
      setTimeout(() => resolve('timeout'), timeoutDuration)
    );

    try {
      const result = await Promise.race([syncPromise, timeoutPromise]);
      
      if (result === 'timeout') {
        console.warn('Initial sync timed out, continuing in background');
        if (!isSilent) {
          setIsBackgroundSyncing(true);
        }
      }
    } catch (error) {
      console.error('Error during initial sync:', error);
    } finally {
      setIsSyncing(false);
    }
  };

  // Isolation du stockage multi-locataire
  const setupStorageIsolation = async (mfCode: string, isSilent: boolean = false, hasCachedData: boolean = true) => {
    globalMfCode = mfCode;
    mfCodeRef.current = mfCode;
    await pullData(mfCode, isSilent, hasCachedData);
  };

  const [activeSection, setActiveSection] = useState<string>('Accueil');
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(window.innerWidth >= 1024);
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    if (sessionStorage.getItem('microfox_session_active') !== 'true' && localStorage.getItem('microfox_session_active') !== 'true') return null;
    try {
      const saved = localStorage.getItem('microfox_current_user');
      return saved ? JSON.parse(saved) : null;
    } catch (e) {
      console.error("Error parsing current user:", e);
      return null;
    }
  });
  const [isBlockedBySchedule, setIsBlockedBySchedule] = useState(false);
  const currentMF = currentUser?.microfinance || null;

  // Nettoyage du stockage pour réduire la consommation de la base de données
  const cleanupStorage = useCallback(() => {
    // 1. Audit Logs Cleanup - Keep 1 month history as requested
    const logs = localStorage.getItem('microfox_audit_logs');
    if (logs) {
      try {
        const parsed = JSON.parse(logs);
        if (Array.isArray(parsed)) {
          const oneMonthAgo = new Date();
          oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
          const filtered = parsed.filter((log: any) => new Date(log.timestamp) > oneMonthAgo);
          if (filtered.length !== parsed.length) {
            localStorage.setItem('microfox_audit_logs', JSON.stringify(filtered.slice(0, 1000)));
          }
        }
      } catch (e) {}
    }

    // 1.1 Field Control Reports Cleanup - Keep 2 months history as requested
    const reports = localStorage.getItem('microfox_field_control_reports');
    if (reports) {
      try {
        const parsed = JSON.parse(reports);
        if (Array.isArray(parsed)) {
          const twoMonthsAgo = new Date();
          twoMonthsAgo.setMonth(twoMonthsAgo.getMonth() - 2);
          const filtered = parsed.filter((report: any) => new Date(report.date || report.timestamp) > twoMonthsAgo);
          if (filtered.length !== parsed.length) {
            localStorage.setItem('microfox_field_control_reports', JSON.stringify(filtered));
          }
        }
      } catch (e) {}
    }

    // 2. User Journeys Cleanup
    const journeys = nativeGetItem('microfox_user_journeys');
    if (journeys) {
      try {
        const parsed = JSON.parse(journeys);
        if (Array.isArray(parsed) && parsed.length > 500) {
          nativeSetItem('microfox_user_journeys', JSON.stringify(parsed.slice(-500)));
          nativeSetItem('microfox_pending_sync', 'true');
        }
      } catch (e) {}
    }

    // 3. Notifications Cleanup
    const notifications = nativeGetItem('microfox_notifications');
    if (notifications) {
      try {
        const parsed = JSON.parse(notifications);
        if (Array.isArray(parsed) && parsed.length > 100) {
          nativeSetItem('microfox_notifications', JSON.stringify(parsed.slice(0, 100)));
          nativeSetItem('microfox_pending_sync', 'true');
        }
      } catch (e) {}
    }

    // 4. Validated Withdrawals Cleanup (Remove deleted items)
    const withdrawals = nativeGetItem('microfox_validated_withdrawals');
    if (withdrawals) {
      try {
        const parsed = JSON.parse(withdrawals);
        if (Array.isArray(parsed)) {
          const filtered = parsed.filter((w: any) => !w.isDeleted && (!w.date || (Date.now() - new Date(w.date).getTime()) < 30 * 24 * 60 * 60 * 1000));
          if (filtered.length !== parsed.length || filtered.length > 500) {
            nativeSetItem('microfox_validated_withdrawals', JSON.stringify(filtered.slice(-500)));
            nativeSetItem('microfox_pending_sync', 'true');
          }
        }
      } catch (e) {}
    }

    // 5. Redundant History Strip from members_data
    const membersData = localStorage.getItem('microfox_members_data');
    if (membersData) {
      try {
        const parsed = JSON.parse(membersData);
        if (Array.isArray(parsed)) {
          let modified = false;
          const cleaned = parsed.map((m: any) => {
            if (m.history && m.history.length > 0) {
              modified = true;
              return { ...m, history: [] };
            }
            return m;
          });
          if (modified) {
            localStorage.setItem('microfox_members_data', JSON.stringify(cleaned));
          }
        }
      } catch (e) {}
    }
  }, []);

  useEffect(() => {
    const handleQuota = () => cleanupStorage();
    window.addEventListener('microfox_quota_exceeded', handleQuota);
    cleanupStorage();
    const interval = setInterval(cleanupStorage, 3600000); // Nettoyage périodique toutes les heures
    return () => {
      clearInterval(interval);
      window.removeEventListener('microfox_quota_exceeded', handleQuota);
    };
  }, [cleanupStorage]);

  const checkScheduleBlocking = () => {
    if (!currentUser || currentUser.role === 'administrateur') {
      setIsBlockedBySchedule(false);
      return;
    }

    const savedConfig = localStorage.getItem('microfox_mf_config');
    if (!savedConfig) return;

    try {
      const config: Microfinance = JSON.parse(savedConfig);
      if (!config.autoDeactivationEnabled) {
        setIsBlockedBySchedule(false);
        return;
      }

      const now = new Date();
      const daysMap: { [key: number]: string } = { 0: 'D', 1: 'L', 2: 'M', 3: 'Me', 4: 'J', 5: 'V', 6: 'S' };
      const currentDay = daysMap[now.getUTCDay()];
      const currentTime = `${now.getUTCHours().toString().padStart(2, '0')}:${now.getUTCMinutes().toString().padStart(2, '0')}`;

      let blocked = false;

      // Check global rules
      const deactivationDays = config.autoDeactivationDays;
      if (Array.isArray(deactivationDays) && deactivationDays.includes(currentDay)) {
        const start = config.autoDeactivationStartTime || '00:00';
        const end = config.autoDeactivationEndTime || '23:59';
        if (currentTime >= start && currentTime <= end) {
          blocked = true;
        }
      }

      // Check specific rules (higher priority or additive)
      const rules = config.autoDeactivationRules;
      if (!blocked && Array.isArray(rules)) {
        for (const rule of rules) {
          if (rule.enabled && 
              Array.isArray(rule.roles) && rule.roles.includes(currentUser.role) && 
              Array.isArray(rule.days) && rule.days.includes(currentDay)) {
            if (currentTime >= rule.startTime && currentTime <= rule.endTime) {
              blocked = true;
              break;
            }
          }
        }
      }

      setIsBlockedBySchedule(blocked);
    } catch (e) {
      console.error("Error checking schedule:", e);
    }
  };

  useEffect(() => {
    checkScheduleBlocking();
    const interval = setInterval(checkScheduleBlocking, 60000); // Check every minute
    return () => clearInterval(interval);
  }, [currentUser, syncVersion]);

  // Real-time sync subscription
  useEffect(() => {
    if (!currentUser || isOfflineMode || !supabase || !import.meta.env.VITE_SUPABASE_URL) return;

    const mfCode = localStorage.getItem('microfox_current_mf');
    if (!mfCode) return;

    const prefix = `mf_${mfCode.toLowerCase().replace(/\s+/g, '_')}_`;

    const channel = supabase
      .channel('storage_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'storage',
        },
        async (payload) => {
          if (payload.new && (payload.new as any).key) {
            const key = (payload.new as any).key;
            if (key === 'microfox_users' || key.startsWith(prefix)) {
              const remoteValue = (payload.new as any).value;
              const localValue = nativeGetItem(key);
              
              if (remoteValue && remoteValue !== localValue) {
                // Skip if locally dirty and not mergeable JSON to avoid overwriting newer local changes
                const isDirty = () => {
                  try {
                    const dirty = JSON.parse(nativeGetItem(prefix + 'microfox_dirty_keys') || nativeGetItem('microfox_dirty_keys') || '[]');
                    return Array.isArray(dirty) && dirty.includes(key);
                  } catch (e) { return false; }
                };

                if (isDirty()) {
                  if (localValue && localValue !== '[]' && localValue !== '{}' && localValue !== 'null') {
                    try {
                      JSON.parse(localValue);
                      JSON.parse(remoteValue);
                    } catch (e) {
                      return;
                    }
                  }
                }

                const { mergeJSON } = await import('./utils/supabaseSync');
                const finalValue = localValue ? mergeJSON(localValue, remoteValue) : remoteValue;
                
                if (finalValue !== localValue) {
                  nativeSetItem(key, finalValue);
                  setSyncVersion(v => v + 1);
                  dispatchStorageEvent();
                }
              }
            }
          }
        }
      )
      .subscribe();

    // Periodic background pull as fallback
    const pullInterval = setInterval(() => {
      const currentMfCode = localStorage.getItem('microfox_current_mf');
      if (currentMfCode) {
        // Fast point-lookup for microfox_agent_payments to make it instant!
        const prefix = `mf_${currentMfCode.toLowerCase().replace(/\s+/g, '_')}_`;
        const targetKey = prefix + 'microfox_agent_payments';
        if (supabase) {
          (async () => {
            try {
              const { data, error } = await supabase
                .from('storage')
                .select('value')
                .eq('key', targetKey)
                .maybeSingle();

              if (!error && data) {
                const localValue = nativeGetItem(targetKey);
                if (data.value && data.value !== localValue) {
                  const { mergeJSON } = await import('./utils/supabaseSync');
                  const finalValue = localValue ? mergeJSON(localValue, data.value) : data.value;
                  if (finalValue !== localValue) {
                    nativeSetItem(targetKey, finalValue);
                    dispatchStorageEvent();
                  }
                }
              }
            } catch (e) {}
          })();
        }
        pullData(currentMfCode, true);
      }
    }, 45000); // Every 45 seconds

    return () => {
      supabase.removeChannel(channel);
      clearInterval(pullInterval);
    };
  }, [currentUser, isOfflineMode]);

  useEffect(() => {
    // Audit logs cleaning etc handled at intervals below

    const handlePullRequest = () => {
      const mfCode = localStorage.getItem('microfox_current_mf');
      if (mfCode) {
        // Fast point-lookup for microfox_agent_payments to make it instant!
        const prefix = `mf_${mfCode.toLowerCase().replace(/\s+/g, '_')}_`;
        const targetKey = prefix + 'microfox_agent_payments';
        if (supabase) {
          (async () => {
            try {
              const { data, error } = await supabase
                .from('storage')
                .select('value')
                .eq('key', targetKey)
                .maybeSingle();

              if (!error && data) {
                const localValue = nativeGetItem(targetKey);
                if (data.value && data.value !== localValue) {
                  const { mergeJSON } = await import('./utils/supabaseSync');
                  const finalValue = localValue ? mergeJSON(localValue, data.value) : data.value;
                  if (finalValue !== localValue) {
                    nativeSetItem(targetKey, finalValue);
                    dispatchStorageEvent();
                  }
                }
              }
            } catch (e) {}
          })();
        }
        pullData(mfCode, true);
      }
    };

    window.addEventListener('request_supabase_sync', handlePullRequest);

    // Initial data pull
    const mfCodeOnLoad = localStorage.getItem('microfox_current_mf');
    if (mfCodeOnLoad) {
      const prefix = `mf_${mfCodeOnLoad.toLowerCase().replace(/\s+/g, '_')}_`;
      const hasCachedData = !!localStorage.getItem(prefix + 'microfox_members_data') || !!localStorage.getItem('microfox_members_data');
      setupStorageIsolation(mfCodeOnLoad, hasCachedData, hasCachedData);
    } else {
      // Pull only global data if not logged in (background)
      import('./utils/supabaseSync').then(m => {
        m.pullFromSupabase('microfox_users', nativeSetItem, nativeGetItem);
        m.pullFromSupabase('microfox_permissions', nativeSetItem, nativeGetItem);
      }).catch(err => console.error('Failed to load sync module:', err));
    }

    if (!currentUser) return;

    if (localStorage.getItem('microfox_reset_v1') !== 'true') {
      localStorage.setItem('microfox_reset_v1', 'true');
    }

    // Force cleanup and injection for user role permissions
    const savedPerms = localStorage.getItem('microfox_permissions');
    if (savedPerms) {
      try {
        const perms = JSON.parse(savedPerms);
        let updated = false;
        if (perms && typeof perms === 'object') {
          if (perms['agent commercial'] && Array.isArray(perms['agent commercial'])) {
            const originalLength = perms['agent commercial'].length;
            perms['agent commercial'] = perms['agent commercial'].filter((p: string) => 
              p !== 'Analyse' && p !== 'Tableau de Bord' && p !== 'Reçu de caisse'
            );
            if (perms['agent commercial'].length !== originalLength) {
              updated = true;
            }
          }
          if (perms['caissier'] && Array.isArray(perms['caissier'])) {
            if (!perms['caissier'].includes('Annulation Cotisation')) {
              perms['caissier'] = [...perms['caissier'], 'Annulation Cotisation'];
              updated = true;
            }
          }
        }
        if (updated) {
          localStorage.setItem('microfox_permissions', JSON.stringify(perms));
          dispatchStorageEvent();
        }
      } catch (e) {}
    }

    const handleResize = () => {
      if (window.innerWidth >= 1024) {
        setIsSidebarOpen(true);
      }
    };

    // Apply isolation on initial load if MF code exists
    // (Already handled by the initial setup call above to avoid double pulls)
    
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (localStorage.getItem('microfox_pending_sync') === 'true' && !isOfflineMode) {
        e.preventDefault();
        e.returnValue = 'Vous avez des données non synchronisées. Voulez-vous vraiment quitter ?';
      }
    };

    const handleStorageChange = (e: any) => {
      const key = e.key !== undefined ? e.key : (e.detail ? e.detail.key : null);
      if (key) {
        if (key === 'microfox_members_data' || key.endsWith('microfox_members_data') || key.includes('microfox_history_')) {
          clearMembersCache();
        }
      } else if (e.type === 'storage') {
        clearMembersCache();
      }
      if (key === 'microfox_offline_mode') {
        const val = e.newValue !== undefined ? e.newValue : localStorage.getItem('microfox_offline_mode');
        setIsOfflineMode(val === 'true');
      }
    };

    if (localStorage.getItem('microfox_restore_success') === 'true') {
      alert("La restauration a été effectuée avec succès !");
      localStorage.removeItem('microfox_restore_success');
    }

    window.addEventListener('resize', handleResize);
    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('microfox_storage' as any, handleStorageChange);
    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('microfox_storage' as any, handleStorageChange);
    };
  }, []);

  // User Location Tracking
  useEffect(() => {
    if (!currentUser || currentUser.role === 'administrateur') return;

    let intervalId: any = null;

    const trackLocation = () => {
      // Check if GPS tracking is enabled in config
      const savedConfig = localStorage.getItem('microfox_mf_config');
      const config = savedConfig ? JSON.parse(savedConfig) : {};
      if (config.gpsTrackingEnabled === false) {
        if (intervalId) {
          clearInterval(intervalId);
          intervalId = null;
        }
        return;
      }

      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            const { latitude, longitude } = position.coords;
            const timestamp = new Date().toISOString();

            // Check config again to prevent race conditions during async geolocation callback
            const lastConfigStr = localStorage.getItem('microfox_mf_config');
            const lastConfig = lastConfigStr ? JSON.parse(lastConfigStr) : {};
            if (lastConfig.gpsTrackingEnabled === false) return;

            // Update user in microfox_users
            const savedUsers = localStorage.getItem('microfox_users');
            if (savedUsers) {
              try {
                const users: User[] = JSON.parse(savedUsers);
                const updatedUsers = users.map(u => 
                  u.id === currentUser.id 
                    ? { ...u, latitude, longitude, lastUpdate: timestamp } 
                    : u
                );
                localStorage.setItem('microfox_users', JSON.stringify(updatedUsers));
              } catch (e) {
                console.error("Error updating user location:", e);
              }
            }

            // Update journey history
            const savedJourneys = localStorage.getItem('microfox_user_journeys');
            let journeys = [];
            if (savedJourneys) {
              try {
                journeys = JSON.parse(savedJourneys);
              } catch (e) {
                console.error("Error parsing journeys:", e);
              }
            }
            
            const newPoint = {
              userId: currentUser.id,
              userName: currentUser.identifiant,
              lat: latitude,
              lng: longitude,
              timestamp
            };

            // Keep journey history (limit to 500 points to avoid database consumption)
            const updatedJourneys = [
              ...journeys,
              newPoint
            ].slice(-500);

            localStorage.setItem('microfox_user_journeys', JSON.stringify(updatedJourneys));
          },
          (error) => console.log("Tracking error:", error),
          { enableHighAccuracy: true }
        );
      }
    };

    const runTrackingIfEnabled = (isInitial: boolean = false) => {
      const savedConfig = localStorage.getItem('microfox_mf_config');
      const config = savedConfig ? JSON.parse(savedConfig) : {};
      if (config.gpsTrackingEnabled !== false) {
        if (!intervalId) {
          trackLocation();
          intervalId = setInterval(trackLocation, 300000); // Every 5 minutes
        } else if (isInitial) {
          trackLocation();
        }
      } else {
        if (intervalId) {
          clearInterval(intervalId);
          intervalId = null;
        }
      }
    };

    runTrackingIfEnabled(true);

    const handleStorageUpdate = () => {
      runTrackingIfEnabled(false);
    };

    window.addEventListener('storage', handleStorageUpdate);
    window.addEventListener('microfox_storage' as any, handleStorageUpdate);

    return () => {
      if (intervalId) clearInterval(intervalId);
      window.removeEventListener('storage', handleStorageUpdate);
      window.removeEventListener('microfox_storage' as any, handleStorageUpdate);
    };
  }, [currentUser]);

  const handleSelectSection = (id: string) => {
    setActiveSection(id);
    if (window.innerWidth < 1024) {
      setIsSidebarOpen(false);
    }
  };

  const renderContent = () => {
    if (activeSection === 'Accueil') {
      return <Accueil />;
    }

    if (activeSection === 'Guide Pratique') {
      return <GuidePratique />;
    }

    if (activeSection === 'Tableau de Bord') {
      if (currentUser?.role === 'administrateur' || currentUser?.role === 'directeur') {
        return <Dashboard />;
      }
      return <GuidePratique />;
    }

    if (activeSection === 'Notification') {
      return <Notifications onSelectSection={handleSelectSection} />;
    }

    if (activeSection === 'Carte Géographique') {
      return <GeographicMap />;
    }

    if (activeSection === 'Membres') {
      return <Members />;
    }

    if (activeSection === 'Tontine Journalière') {
      return <DailyTontine />;
    }

    if (activeSection === 'Annulation Cotisation') {
      return <CancelCotisation />;
    }

    if (activeSection === 'Demande de retrait tontine') {
      return <TontineWithdrawal />;
    }

    if (activeSection === 'Vérification de retrait tontine') {
      return <TontineVerification />;
    }

    if (activeSection === 'Commissions') {
      return <Commissions />;
    }

    if (activeSection === 'Demande de crédit') {
      return <CreditRequest />;
    }
    
    if (activeSection === 'Validation de Crédit') {
      return <CreditValidation />;
    }

    if (activeSection === 'Déblocage de crédit') {
      return <CreditDisbursement />;
    }

    if (activeSection === 'Suivi des crédits') {
      return <CreditGranted />;
    }

    if (activeSection === 'Autres opérations crédit') {
      return <OtherCreditOperations />;
    }

    if (activeSection === 'Frais & Parts Sociales') {
      return <FraisPartsSociales />;
    }

    if (activeSection === 'Etats des écarts') {
      return <GapsReport />;
    }

    if (activeSection === 'Écarts de Caisse') {
      return <CashGaps />;
    }

    if (activeSection === 'Journal Global') {
      return <GlobalJournal />;
    }

    if (activeSection === 'Balance des comptes') {
      return <AccountBalance />;
    }

    if (activeSection === 'Reçu de caisse') {
      return <CashReceipts />;
    }

    if (activeSection === 'Comptabilité & États') {
      return <AccountingAndStates />;
    }

    if (activeSection === 'États Réglementaires') {
      return <RegulatoryReports />;
    }

    if (activeSection === 'Analyse') {
      return <Analyse />;
    }

    if (activeSection === 'Conseils & Formation') {
      return <EducationSupport />;
    }

    if (activeSection === 'Configuration') {
      return <Configuration />;
    }

    if (activeSection === 'Contrôle Terrain') {
      return <FieldControl />;
    }

    if (activeSection === 'Modifications Epargne & Crédit') {
      return <ModificationEpargneCredit />;
    }

    if (activeSection === "Réclamations Clients") {
      return (
        <div className="bg-[#121c32] rounded-xl shadow-sm border border-gray-800 p-6 lg:p-8 min-h-[500px] flex items-center justify-center text-gray-400 text-center">
          <div>
            <h2 className="text-xl lg:text-2xl font-semibold text-gray-200 mb-2">Réclamations Clients</h2>
            <p className="text-sm lg:text-base">Module de messagerie et suivi des réclamations en cours de déploiement.</p>
          </div>
        </div>
      );
    }

    if (activeSection === 'Suivi des Activités') {
      return <UserActivity />;
    }

    if (activeSection === 'Gestion des Utilisateurs') {
      return <UserManagement />;
    }

    if (activeSection === 'Permission') {
      return <Permissions />;
    }

    if (activeSection === 'Pièces à imprimer') {
      return <PiecesAImprimer />;
    }

    if (activeSection === 'Rapports Financiers') {
      return <FinancialReports />;
    }

    if (activeSection === 'Versements Agents') {
      return <AgentPayments />;
    }

    if (activeSection === 'Gestion Caisse' || activeSection === 'CAISSE PRINCIPALE') {
      return <MainCashier />;
    }

    if (activeSection === 'Coffre & Banque') {
      return <VaultAndBank />;
    }

    if (activeSection === 'Dépenses administratives') {
      return <AdministrativeExpenses />;
    }

    if (activeSection === 'Salaire du Personnel') {
      return <PersonnelSalaries />;
    }

    if (activeSection === 'Stocks Livrets') {
      return <StocksLivrets />;
    }

    if (activeSection === 'Vente Livrets') {
      return <VenteLivrets />;
    }

    if (activeSection === 'Versement du jour') {
      return <VersementDuJour />;
    }

    if (activeSection === 'Alerte Doublons') {
      return <DuplicateAlert />;
    }

    return (
      <div className="bg-[#121c32] rounded-xl shadow-sm border border-gray-800 p-6 lg:p-8 min-h-[500px] flex items-center justify-center text-gray-400 text-center">
        <div>
          <h2 className="text-xl lg:text-2xl font-semibold text-gray-200 mb-2">{activeSection}</h2>
          <p className="text-sm lg:text-base">Contenu en cours de développement pour MicroFoX.</p>
        </div>
      </div>
    );
  };

  const handleLogin = (user: User) => {
    try {
      const prevUserStr = localStorage.getItem('microfox_current_user');
      if (prevUserStr) {
        const prevUser = JSON.parse(prevUserStr);
        if (prevUser && prevUser.id !== user.id) {
          const keysToRemove: string[] = [];
          for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key) {
              if (key.startsWith('mf_') || 
                  (key.startsWith('microfox_') && 
                   key !== 'microfox_users' && 
                   key !== 'microfox_permissions' && 
                   key !== 'microfox_microfinances' && 
                   key !== 'microfox_offline_mode')) {
                keysToRemove.push(key);
              }
            }
          }
          keysToRemove.forEach(k => {
            try {
              nativeRemoveItem(k);
            } catch (e) {}
          });
        }
      }
    } catch (e) {
      console.error(e);
    }

    localStorage.setItem('microfox_current_mf', user.codeMF);
    localStorage.setItem('microfox_current_user', JSON.stringify(user));
    sessionStorage.setItem('microfox_session_active', 'true');
    localStorage.setItem('microfox_session_active', 'true');
    const prefix = `mf_${user.codeMF.toLowerCase().replace(/\s+/g, '_')}_`;
    const hasCachedData = !!localStorage.getItem(prefix + 'microfox_members_data') || !!localStorage.getItem('microfox_members_data');
    setupStorageIsolation(user.codeMF, hasCachedData, hasCachedData); // Apply isolation immediately without reload
    recordAuditLog('CONNEXION', 'AUTHENTIFICATION', `Connexion réussie de ${user.identifiant} (Code MF: ${user.codeMF})`, 'SUCCES', user);
    setWelcomeMessage(`Bienvenue ${user.identifiant}`);
    setTimeout(() => setWelcomeMessage(null), 3000);
    setCurrentUser(user);
  };

  const handleLogout = async () => {
    // Show the synchronization loader immediately to prevent user interaction and show progress
    setIsSyncing(true);
    isSyncingRef.current = true;

    if (currentUser) {
      recordAuditLog('DECONNEXION', 'AUTHENTIFICATION', `Déconnexion de ${currentUser.identifiant}`);
    }
    
    // Flush dirty keys to Supabase before logging out to prevent losing local changes in a fast-timeout race
    // ONLY attempt to flush if we are online
    const isOffline = localStorage.getItem('microfox_offline_mode') === 'true';
    const dirtyKeysStr = nativeGetItem('microfox_dirty_keys') || '[]';
    let dirtyKeys: string[] = [];
    try {
      dirtyKeys = JSON.parse(dirtyKeysStr);
      if (!Array.isArray(dirtyKeys)) dirtyKeys = [];
    } catch (e) {
      dirtyKeys = [];
    }

    const getTreatmentLabel = (key: string): string => {
      if (key.includes('microfox_agent_payments')) return 'versements des agents';
      if (key.includes('microfox_validated_zone_cotisations')) return 'validation des cotisations';
      if (key.includes('microfox_members_data')) return 'données des membres';
      if (key.includes('microfox_vault_transactions')) return 'transactions de caisse';
      if (key.includes('microfox_users')) return 'utilisateurs';
      if (key.includes('microfox_permissions')) return 'autorisations';
      return 'modifications locales';
    };

    let activeSyncs = [...dirtyKeys];
    const updateSyncText = (remainingKeys: string[]) => {
      if (remainingKeys.length > 0) {
        const uniqueLabels = Array.from(new Set(remainingKeys.map(getTreatmentLabel)));
        setSyncStatusText(`Traitement en cours : synchronisation de (${uniqueLabels.join(', ')}) avant déconnexion...`);
      } else {
        setSyncStatusText('Déconnexion en cours...');
      }
    };

    if (dirtyKeys.length > 0 && !isOffline) {
      updateSyncText(dirtyKeys);
    } else {
      setSyncStatusText('Déconnexion en cours...');
    }

    try {
      if (Array.isArray(dirtyKeys) && dirtyKeys.length > 0 && !isOffline) {
        const { syncToSupabase } = await import('./utils/supabaseSync');
        const syncPromise = Promise.all(dirtyKeys.map(async (key) => {
          const value = nativeGetItem(key);
          if (value) {
            const success = await syncToSupabase(key, value);
            activeSyncs = activeSyncs.filter(k => k !== key);
            updateSyncText(activeSyncs);
            if (success) {
              // Successfully synced! Remove it from locally dirty registry
              try {
                const currentDirtyStr = nativeGetItem('microfox_dirty_keys') || '[]';
                const currentDirty = JSON.parse(currentDirtyStr);
                if (Array.isArray(currentDirty)) {
                  const updated = currentDirty.filter(k => k !== key);
                  if (updated.length === 0) {
                    nativeRemoveItem('microfox_dirty_keys');
                    const mfCode = nativeGetItem('microfox_current_mf');
                    if (mfCode) {
                      const prefix = `mf_${mfCode.toLowerCase().replace(/\s+/g, '_')}_`;
                      nativeRemoveItem(`${prefix}microfox_dirty_keys`);
                      nativeRemoveItem(`${prefix}microfox_pending_sync`);
                    }
                    nativeRemoveItem('microfox_pending_sync');
                  } else {
                    nativeSetItem('microfox_dirty_keys', JSON.stringify(updated));
                    const mfCode = nativeGetItem('microfox_current_mf');
                    if (mfCode) {
                      const prefix = `mf_${mfCode.toLowerCase().replace(/\s+/g, '_')}_`;
                      nativeSetItem(`${prefix}microfox_dirty_keys`, JSON.stringify(updated));
                    }
                  }
                }
              } catch (innerErr) {}
            }
          }
        }));
        
        // Give up to 6 seconds for safety
        const timeoutPromise = new Promise((resolve) => setTimeout(resolve, 6000));
        await Promise.race([syncPromise, timeoutPromise]);
      }
    } catch (e) {
      console.error('Error flushing dirty keys on logout:', e);
    }

    // Use native methods to ensure cleanup works even if overrides are broken
    sessionStorage.removeItem('microfox_session_active');
    localStorage.removeItem('microfox_session_active');

    // Fetch refreshed dirty keys to ensure we do NOT delete them on logout
    const finalDirtyKeysStr = nativeGetItem('microfox_dirty_keys') || '[]';
    let finalDirtyKeys: string[] = [];
    try {
      finalDirtyKeys = JSON.parse(finalDirtyKeysStr);
      if (!Array.isArray(finalDirtyKeys)) finalDirtyKeys = [];
    } catch (e) {
      finalDirtyKeys = [];
    }

    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key) {
        const isDirty = finalDirtyKeys.includes(key);
        // CRITICAL: Skip deletion of any dirty keys (unsynced offline data) so they are kept safe
        if (!isDirty && (key.startsWith('mf_') || 
            (key.startsWith('microfox_') && 
             key !== 'microfox_users' && 
             key !== 'microfox_permissions' && 
             key !== 'microfox_microfinances' && 
             key !== 'microfox_offline_mode' &&
             key !== 'microfox_dirty_keys'))) {
          keysToRemove.push(key);
        }
      }
    }
    keysToRemove.forEach(k => {
      try {
        nativeRemoveItem(k);
      } catch (e) {}
    });

    nativeRemoveItem('microfox_current_mf');
    nativeRemoveItem('microfox_current_user');
    
    // Reset global MF code
    globalMfCode = null;
    
    // Explicitly reset state before reload
    setIsSyncing(false);
    setCurrentUser(null);
    mfCodeRef.current = null;
    
    // Full reload to clear all state and overrides
    window.location.reload();
  };

  const handleSync = async () => {
    const mfCode = localStorage.getItem('microfox_current_mf');
    if (mfCode) {
      await setupStorageIsolation(mfCode);
      setSyncVersion(v => v + 1);
    }
  };

  if (isSyncing && !currentUser) {
    return (
      <div className="h-screen bg-[#0a1226] flex flex-col items-center justify-center text-white p-6 text-center">
        <Loader2 className="w-12 h-12 text-[#00c896] animate-spin mb-4" />
        <h2 className="text-xl font-black uppercase tracking-widest mb-2">Synchronisation</h2>
        <p className="text-gray-400 text-sm max-w-xs">Veuillez patienter pendant que nous récupérons vos données depuis le serveur sécurisé...</p>
      </div>
    );
  }

  if (!currentUser) {
    return <MicrofinanceLogin onLogin={handleLogin} />;
  }

  if (isBlockedBySchedule) {
    return (
      <div className="h-screen bg-[#0a1226] flex flex-col items-center justify-center text-white p-6 text-center">
        <div className="w-24 h-24 bg-red-500/10 rounded-[2.5rem] flex items-center justify-center text-red-500 mb-8 animate-pulse">
          <Clock size={48} />
        </div>
        <h2 className="text-3xl font-black uppercase tracking-tighter mb-4">Accès Restreint</h2>
        <div className="bg-red-500/10 border border-red-500/20 p-6 rounded-3xl max-w-md space-y-4">
          <div className="flex items-center justify-center gap-3 text-red-400">
            <ShieldAlert size={20} />
            <p className="text-sm font-black uppercase tracking-widest">Planning de Désactivation</p>
          </div>
          <p className="text-gray-400 text-sm leading-relaxed">
            Votre accès est temporairement suspendu selon le planning de désactivation automatique configuré pour votre rôle.
          </p>
          <div className="pt-4">
            <button 
              onClick={handleLogout}
              className="px-8 py-4 bg-red-500 hover:bg-red-600 text-white rounded-2xl font-black uppercase tracking-widest transition-all active:scale-95"
            >
              Se déconnecter
            </button>
          </div>
        </div>
        <p className="mt-8 text-gray-600 text-[10px] font-black uppercase tracking-[0.3em]">MicroFoX Security System</p>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-[#0a1226] overflow-hidden relative text-gray-100">
      {isSyncing && (
        <div className="fixed inset-0 z-[300] bg-[#0a1226]/80 flex flex-col items-center justify-center text-white p-6 text-center backdrop-blur-sm">
          <Loader2 className="w-12 h-12 text-[#00c896] animate-spin mb-4" />
          <h2 className="text-xl font-black uppercase tracking-widest mb-2">Synchronisation</h2>
          <p className="text-gray-400 text-sm max-w-xs font-medium">{syncStatusText}</p>
        </div>
      )}
      {welcomeMessage && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center pointer-events-none">
          <div className="bg-emerald-600 text-white px-12 py-8 rounded-[3rem] font-black uppercase tracking-[0.2em] shadow-[0_0_100px_rgba(16,185,129,0.4)] animate-in fade-in zoom-in duration-500 text-2xl sm:text-4xl text-center">
            {welcomeMessage}
          </div>
        </div>
      )}
      {/* Overlay pour mobile */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}
      
      <div className={`
        fixed inset-y-0 left-0 z-50 lg:relative lg:translate-x-0 transition-transform duration-300 ease-in-out
        ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        ${!isSidebarOpen && 'lg:hidden'}
      `}>
        <Sidebar 
          activeId={activeSection} 
          onSelect={handleSelectSection} 
          onClose={() => setIsSidebarOpen(false)} 
          onLogout={handleLogout}
          onSync={handleSync}
          isSyncing={isBackgroundSyncing}
        />
      </div>
      
      <div className="flex-1 flex flex-col min-w-0">
        <Header 
          activeSection={activeSection} 
          onOpenSidebar={() => setIsSidebarOpen(true)} 
          currentUser={currentUser}
          onLogout={handleLogout}
          isSyncing={isBackgroundSyncing}
        />
        <main className="flex-1 min-h-0 overflow-y-auto p-4 lg:p-6 custom-scrollbar">
          {renderContent()}
        </main>
      </div>
    </div>
  );
};

export default App;