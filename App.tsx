import React, { useState, useEffect, useCallback } from 'react';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import Dashboard from './components/Dashboard';
import GeographicMap from './components/GeographicMap';
import Members from './components/Members';
import DailyTontine from './components/DailyTontine';
import ValidateZoneCotisations from './components/ValidateZoneCotisations';
import CancelCotisation from './components/CancelCotisation';
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
import ActiveCredits from './components/ActiveCredits';
import AdministrativeExpenses from './components/AdministrativeExpenses';
import PersonnelSalaries from './components/PersonnelSalaries';
import FraisPartsSociales from './components/FraisPartsSociales';
import AccountingAndStates from './components/AccountingAndStates';
import RegulatoryReports from './components/RegulatoryReports';
import AdhesionReport from './components/AdhesionReport';
import Analyse from './components/Analyse';
import Configuration from './components/Configuration';
import UserManagement from './components/UserManagement';
import Permissions from './components/Permissions';
import ModificationEpargneCredit from './components/ModificationEpargneCredit';
import AuditSecurity from './components/AuditSecurity';
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
import { supabase } from './src/supabase';

// Capture des méthodes de stockage natives au chargement du module pour éviter les problèmes avec les surcharges
const nativeGetItem = localStorage.getItem.bind(localStorage);
const nativeSetItem = localStorage.setItem.bind(localStorage);
const nativeRemoveItem = localStorage.removeItem.bind(localStorage);

// Variable globale pour stocker le code MF courant afin que les surcharges y aient accès immédiatement
let globalMfCode = nativeGetItem('microfox_current_mf');

// Surcharges globales du stockage
localStorage.getItem = (key: string) => {
  const mfCode = globalMfCode;
  if (mfCode && key.startsWith('microfox_') && 
      key !== 'microfox_current_mf' && 
      key !== 'microfox_current_user' && 
      key !== 'microfox_users' && 
      key !== 'microfox_permissions') {
    const prefix = `mf_${mfCode.toLowerCase().replace(/\s+/g, '_')}_`;
    return nativeGetItem(prefix + key);
  }
  return nativeGetItem(key);
};

localStorage.setItem = (key: string, value: string) => {
  const mfCode = globalMfCode;
  const isGlobal = key === 'microfox_users' || key === 'microfox_permissions';
  
  if (key.startsWith('microfox_') && key !== 'microfox_current_mf' && key !== 'microfox_current_user' && (isGlobal || mfCode)) {
    const prefix = (mfCode && !isGlobal) ? `mf_${mfCode.toLowerCase().replace(/\s+/g, '_')}_` : '';
    const fullKey = isGlobal ? key : prefix + key;
    nativeSetItem(fullKey, value);

    // Mark as dirty locally to avoid being overwritten by a pull before this change is pushed
    if (key !== 'microfox_pending_sync' && key !== 'microfox_dirty_keys') {
      try {
        const dirtyKeys = JSON.parse(nativeGetItem('microfox_dirty_keys') || '[]');
        if (Array.isArray(dirtyKeys) && !dirtyKeys.includes(fullKey)) {
          dirtyKeys.push(fullKey);
          nativeSetItem('microfox_dirty_keys', JSON.stringify(dirtyKeys));
        }
      } catch (e) {
        nativeSetItem('microfox_dirty_keys', JSON.stringify([fullKey]));
      }
    }

    // Sync to Supabase in background if not in offline mode
    if (nativeGetItem('microfox_offline_mode') !== 'true') {
      import('./src/utils/supabaseSync').then(async m => {
        const success = await m.syncToSupabase(fullKey, value);
        if (success) {
          try {
            const dirtyKeys = JSON.parse(nativeGetItem('microfox_dirty_keys') || '[]');
            if (Array.isArray(dirtyKeys)) {
              const updated = dirtyKeys.filter(k => k !== fullKey);
              if (updated.length === 0) {
                nativeRemoveItem('microfox_dirty_keys');
                nativeRemoveItem('microfox_pending_sync');
              } else {
                nativeSetItem('microfox_dirty_keys', JSON.stringify(updated));
              }
            }
          } catch (e) {}
        }
      });
    }
    // Mark as pending sync for UI feedback
    if (key !== 'microfox_pending_sync') {
      nativeSetItem('microfox_pending_sync', 'true');
    }
  } else {
    nativeSetItem(key, value);
  }
};

localStorage.removeItem = (key: string) => {
  const mfCode = globalMfCode;
  const isGlobal = key === 'microfox_users' || key === 'microfox_permissions';

  if (key.startsWith('microfox_') && key !== 'microfox_current_mf' && key !== 'microfox_current_user' && (isGlobal || mfCode)) {
    const prefix = (mfCode && !isGlobal) ? `mf_${mfCode.toLowerCase().replace(/\s+/g, '_')}_` : '';
    const fullKey = isGlobal ? key : prefix + key;
    nativeRemoveItem(fullKey);

    // Mark as dirty locally
    if (key !== 'microfox_pending_sync' && key !== 'microfox_dirty_keys') {
      try {
        const dirtyKeys = JSON.parse(nativeGetItem('microfox_dirty_keys') || '[]');
        if (Array.isArray(dirtyKeys) && !dirtyKeys.includes(fullKey)) {
          dirtyKeys.push(fullKey);
          nativeSetItem('microfox_dirty_keys', JSON.stringify(dirtyKeys));
        }
      } catch (e) {
        nativeSetItem('microfox_dirty_keys', JSON.stringify([fullKey]));
      }
    }

    // Remove from Supabase in background if not in offline mode
    if (nativeGetItem('microfox_offline_mode') !== 'true') {
      import('./src/supabase').then(async m => {
        if (m.supabase && (import.meta as any).env?.VITE_SUPABASE_URL) {
          const { error } = await m.supabase.from('storage').delete().eq('key', fullKey);
          if (!error) {
            try {
              const dirtyKeys = JSON.parse(nativeGetItem('microfox_dirty_keys') || '[]');
              if (Array.isArray(dirtyKeys)) {
                const updated = dirtyKeys.filter(k => k !== fullKey);
                if (updated.length === 0) {
                  nativeRemoveItem('microfox_dirty_keys');
                  nativeRemoveItem('microfox_pending_sync');
                } else {
                  nativeSetItem('microfox_dirty_keys', JSON.stringify(updated));
                }
              }
            } catch (e) {}
          } else {
            console.error('Error removing from Supabase:', error);
          }
        }
      });
    }
    // Mark as pending sync for UI feedback
    if (key !== 'microfox_pending_sync') {
      nativeSetItem('microfox_pending_sync', 'true');
    }
  } else {
    nativeRemoveItem(key);
  }
};

const App: React.FC = () => {
  const [isSyncing, setIsSyncing] = useState(false);
  const [isBackgroundSyncing, setIsBackgroundSyncing] = useState(false);
  const [syncVersion, setSyncVersion] = useState(0);
  const [welcomeMessage, setWelcomeMessage] = useState<string | null>(null);
  const [isOfflineMode, setIsOfflineMode] = useState(() => {
    return localStorage.getItem('microfox_offline_mode') === 'true';
  });
  const mfCodeRef = React.useRef<string | null>(localStorage.getItem('microfox_current_mf'));

  const pullData = async (mfCode: string) => {
    if (isOfflineMode) {
      console.log('Skipping sync due to offline mode');
      return;
    }
    setIsSyncing(true);
    setIsBackgroundSyncing(false);
    
    const isDirty = (key: string) => {
      try {
        const dirtyKeys = JSON.parse(nativeGetItem('microfox_dirty_keys') || '[]');
        return Array.isArray(dirtyKeys) && dirtyKeys.includes(key);
      } catch (e) {
        return false;
      }
    };

    const syncPromise = (async () => {
      try {
        const { pullFromSupabase, syncToSupabase } = await import('./src/utils/supabaseSync');
        
        // Push local changes first to avoid overwriting them
        if (nativeGetItem('microfox_pending_sync') === 'true') {
          const prefix = `mf_${mfCode.toLowerCase().replace(/\s+/g, '_')}_`;
          
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
          
          // Push all tenant-specific data
          for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith(prefix)) {
              const value = nativeGetItem(key);
              if (value) {
                pushPromises.push(syncToSupabase(key, value));
              }
            }
          }
          
          const results = await Promise.all(pushPromises);
          const pushSuccess = results.every(ok => ok);
          
          if (!pushSuccess && import.meta.env.VITE_SUPABASE_URL) {
            console.warn('La synchronisation vers le serveur a échoué. Vos modifications locales seront synchronisées ultérieurement.');
          }
          
          if (pushSuccess || !import.meta.env.VITE_SUPABASE_URL) {
            // Clear pending sync flag only if all pushed successfully or no sync configured
            nativeRemoveItem('microfox_pending_sync');
            nativeRemoveItem('microfox_dirty_keys');
          }
        }

        // Récupérer les données globales et locataires en parallèle
        const prefix = `mf_${mfCode.toLowerCase().replace(/\s+/g, '_')}_`;
        const [globalChanged, tenantChanged] = await Promise.all([
          pullFromSupabase('microfox_', nativeSetItem, nativeGetItem, isDirty),
          pullFromSupabase(prefix, nativeSetItem, nativeGetItem, isDirty)
        ]);
        
        if (globalChanged || tenantChanged) {
          setSyncVersion(v => v + 1);
          // Dispatch storage event to notify components to reload from localStorage
          window.dispatchEvent(new Event('storage'));
        }
        return 'success';
      } catch (error) {
        console.error('Background sync error:', error);
        throw error;
      } finally {
        setIsBackgroundSyncing(false);
      }
    })();

    const timeoutPromise = new Promise((resolve) => 
      setTimeout(() => resolve('timeout'), 10000)
    );

    try {
      const result = await Promise.race([syncPromise, timeoutPromise]);
      
      if (result === 'timeout') {
        console.warn('Initial sync timed out, continuing in background');
        setIsBackgroundSyncing(true);
        setIsSyncing(false);
      } else {
        setIsSyncing(false);
      }
    } catch (error) {
      console.error('Error during initial sync:', error);
      setIsSyncing(false);
    }
  };

  // Isolation du stockage multi-locataire
  const setupStorageIsolation = async (mfCode: string) => {
    globalMfCode = mfCode;
    mfCodeRef.current = mfCode;
    await pullData(mfCode);
  };

  const [activeSection, setActiveSection] = useState<string>('Accueil');
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(window.innerWidth >= 1024);
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    if (sessionStorage.getItem('microfox_session_active') !== 'true') return null;
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
    // 1. Audit Logs Cleanup
    const logs = nativeGetItem('microfox_audit_logs');
    if (logs) {
      try {
        const parsed = JSON.parse(logs);
        if (Array.isArray(parsed) && parsed.length > 1000) {
          nativeSetItem('microfox_audit_logs', JSON.stringify(parsed.slice(0, 1000)));
          nativeSetItem('microfox_pending_sync', 'true');
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
  }, []);

  useEffect(() => {
    cleanupStorage();
    const interval = setInterval(cleanupStorage, 3600000); // Nettoyage périodique toutes les heures
    return () => clearInterval(interval);
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
      const currentDay = daysMap[now.getDay()];
      const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

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
                // Skip if locally dirty to avoid overwriting newer local changes
                const isDirty = () => {
                  try {
                    const dirty = JSON.parse(nativeGetItem('microfox_dirty_keys') || '[]');
                    return Array.isArray(dirty) && dirty.includes(key);
                  } catch (e) { return false; }
                };

                if (isDirty()) return;

                const { mergeJSON } = await import('./src/utils/supabaseSync');
                const finalValue = localValue ? mergeJSON(localValue, remoteValue) : remoteValue;
                
                if (finalValue !== localValue) {
                  nativeSetItem(key, finalValue);
                  setSyncVersion(v => v + 1);
                  window.dispatchEvent(new Event('storage'));
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
        const currentPrefix = `mf_${currentMfCode.toLowerCase().replace(/\s+/g, '_')}_`;
        setIsBackgroundSyncing(true);
        
        const isDirty = (key: string) => {
          try {
            const dirtyKeys = JSON.parse(nativeGetItem('microfox_dirty_keys') || '[]');
            return Array.isArray(dirtyKeys) && dirtyKeys.includes(key);
          } catch (e) {
            return false;
          }
        };

        import('./src/utils/supabaseSync').then(async (m) => {
          const globalChanged = await m.pullFromSupabase('microfox_users', nativeSetItem, nativeGetItem, isDirty);
          const tenantChanged = await m.pullFromSupabase(currentPrefix, nativeSetItem, nativeGetItem, isDirty);
          if (globalChanged || tenantChanged) {
            setSyncVersion(v => v + 1);
            window.dispatchEvent(new Event('storage'));
          }
        }).finally(() => {
          setIsBackgroundSyncing(false);
        });
      }
    }, 30000); // Every 30 seconds

    return () => {
      supabase.removeChannel(channel);
      clearInterval(pullInterval);
    };
  }, [currentUser, isOfflineMode]);

  useEffect(() => {
    // Audit logs cleaning etc handled at intervals below

    // Initial data pull
    const mfCodeOnLoad = localStorage.getItem('microfox_current_mf');
    if (mfCodeOnLoad) {
      setupStorageIsolation(mfCodeOnLoad);
    } else {
      // Pull only global data if not logged in (background)
      import('./src/utils/supabaseSync').then(m => {
        m.pullFromSupabase('microfox_users', nativeSetItem, nativeGetItem);
      }).catch(err => console.error('Failed to load sync module:', err));
    }

    if (!currentUser) return;

    if (localStorage.getItem('microfox_reset_v1') !== 'true') {
      localStorage.setItem('microfox_reset_v1', 'true');
    }

    // Force cleanup for agent commercial permissions
    const savedPerms = localStorage.getItem('microfox_permissions');
    if (savedPerms) {
      try {
        const perms = JSON.parse(savedPerms);
        if (perms['agent commercial']) {
          const originalLength = perms['agent commercial'].length;
          perms['agent commercial'] = perms['agent commercial'].filter((p: string) => 
            p !== 'Analyse' && p !== 'Tableau de Bord' && p !== 'Reçu de caisse'
          );
          if (perms['agent commercial'].length !== originalLength) {
            localStorage.setItem('microfox_permissions', JSON.stringify(perms));
            window.dispatchEvent(new Event('storage'));
          }
        }
      } catch (e) {}
    }

    const handleResize = () => {
      if (window.innerWidth >= 1024) {
        setIsSidebarOpen(true);
      }
    };

    // Apply isolation on initial load if MF code exists
    if (mfCodeOnLoad) {
      setupStorageIsolation(mfCodeOnLoad);
    }
    
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (localStorage.getItem('microfox_pending_sync') === 'true' && !isOfflineMode) {
        e.preventDefault();
        e.returnValue = 'Vous avez des données non synchronisées. Voulez-vous vraiment quitter ?';
      }
    };

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'microfox_offline_mode') {
        setIsOfflineMode(e.newValue === 'true');
      }
    };

    if (localStorage.getItem('microfox_restore_success') === 'true') {
      alert("La restauration a été effectuée avec succès !");
      localStorage.removeItem('microfox_restore_success');
    }

    window.addEventListener('resize', handleResize);
    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('storage', handleStorageChange);
    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('storage', handleStorageChange);
    };
  }, []);

  // Specific initialization for FABES MICROFINANCE (002FABES)
  useEffect(() => {
    if (currentUser?.codeMF?.toUpperCase() === '002FABES') {
      if (localStorage.getItem('microfox_fabes_init_v2') !== 'true') {
        localStorage.setItem('microfox_cash_balance_CAISSE PRINCIPALE', '30000000');
        localStorage.setItem('microfox_vault_balance', '20000000');
        localStorage.setItem('microfox_fabes_init_v2', 'true');
        window.dispatchEvent(new Event('storage'));
      }
    }
  }, [currentUser]);

  // User Location Tracking
  useEffect(() => {
    if (!currentUser || currentUser.role === 'administrateur') return;

    // Check if GPS tracking is enabled in config
    const savedConfig = localStorage.getItem('microfox_mf_config');
    const config = savedConfig ? JSON.parse(savedConfig) : {};
    if (config.gpsTrackingEnabled === false) return;

    const trackLocation = () => {
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            const { latitude, longitude } = position.coords;
            const timestamp = new Date().toISOString();

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

    trackLocation();
    const interval = setInterval(trackLocation, 300000); // Every 5 minutes
    return () => clearInterval(interval);
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

    if (activeSection === 'Validation Cotisations Zone') {
      return <ValidateZoneCotisations />;
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

    if (activeSection === 'Crédit actif') {
      return <ActiveCredits />;
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

    if (activeSection === 'Rapport Adhésions') {
      return <AdhesionReport />;
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

    if (activeSection === 'Audit & Accès Sécurité') {
      return <AuditSecurity />;
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
    localStorage.setItem('microfox_current_mf', user.codeMF);
    localStorage.setItem('microfox_current_user', JSON.stringify(user));
    sessionStorage.setItem('microfox_session_active', 'true');
    setupStorageIsolation(user.codeMF); // Apply isolation immediately without reload
    recordAuditLog('CONNEXION', 'AUTHENTIFICATION', `Connexion réussie de ${user.identifiant} (Code MF: ${user.codeMF})`, 'SUCCES', user);
    setWelcomeMessage(`Bienvenue ${user.identifiant}`);
    setTimeout(() => setWelcomeMessage(null), 3000);
    setCurrentUser(user);
  };

  const handleLogout = () => {
    if (currentUser) {
      recordAuditLog('DECONNEXION', 'AUTHENTIFICATION', `Déconnexion de ${currentUser.identifiant}`);
    }
    
    // Use native methods to ensure cleanup works even if overrides are broken
    sessionStorage.removeItem('microfox_session_active');
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

  if (isSyncing) {
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
        <main key={syncVersion} className="flex-1 overflow-y-auto p-4 lg:p-6 custom-scrollbar">
          {renderContent()}
        </main>
      </div>
    </div>
  );
};

export default App;