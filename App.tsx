import React, { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import Dashboard from './components/Dashboard';
import GeographicMap from './components/GeographicMap';
import Members from './components/Members';
import DailyTontine from './components/DailyTontine';
import Commissions from './components/Commissions';
import CreditManagement from './components/CreditManagement';
import TontineWithdrawal from './components/TontineWithdrawal';
import TontineVerification from './components/TontineVerification';
import GapsReport from './components/GapsReport';
import GlobalJournal from './components/GlobalJournal';
import CashReceipts from './components/CashReceipts';
import EducationSupport from './components/EducationSupport';
import CreditRequest from './components/CreditRequest';
import CreditDisbursement from './components/CreditDisbursement';
import OtherCreditOperations from './components/OtherCreditOperations';
import ActiveCredits from './components/ActiveCredits';
import AdministrativeExpenses from './components/AdministrativeExpenses';
import FraisPartsSociales from './components/FraisPartsSociales';
import AccountingAndStates from './components/AccountingAndStates';
import RegulatoryReports from './components/RegulatoryReports';
import AdhesionReport from './components/AdhesionReport';
import Configuration from './components/Configuration';
import UserManagement from './components/UserManagement';
import Permissions from './components/Permissions';
import OperationCorrections from './components/OperationCorrections';
import AuditSecurity from './components/AuditSecurity';
import FieldControl from './components/FieldControl';
import PiecesAImprimer from './components/PiecesAImprimer';
import FinancialReports from './components/FinancialReports';
import AgentPayments from './components/AgentPayments';
import MainCashier from './components/MainCashier';
import VaultAndBank from './components/VaultAndBank';
import VenteLivrets from './components/VenteLivrets';
import StocksLivrets from './components/StocksLivrets';
import DuplicateAlert from './components/DuplicateAlert';
import GuidePratique from './components/GuidePratique';
import MicrofinanceLogin from './components/MicrofinanceLogin';
import CashGaps from './components/CashGaps';
import { User } from './types';
import { recordAuditLog } from './utils/audit';
import { Loader2 } from 'lucide-react';

const App: React.FC = () => {
  const [isSyncing, setIsSyncing] = useState(false);

  // Multi-tenant storage isolation
  const setupStorageIsolation = async (mfCode: string) => {
    const prefix = `mf_${mfCode.toLowerCase().replace(/\s+/g, '_')}_`;
    
    const originalGetItem = localStorage.getItem.bind(localStorage);
    const originalSetItem = localStorage.setItem.bind(localStorage);
    const originalRemoveItem = localStorage.removeItem.bind(localStorage);

    localStorage.getItem = (key: string) => {
      if (key.startsWith('microfox_') && key !== 'microfox_current_mf' && key !== 'microfox_current_user' && key !== 'microfox_users') {
        return originalGetItem(prefix + key);
      }
      return originalGetItem(key);
    };

    localStorage.setItem = (key: string, value: string) => {
      if (key.startsWith('microfox_') && key !== 'microfox_current_mf' && key !== 'microfox_current_user' && key !== 'microfox_users') {
        const fullKey = prefix + key;
        originalSetItem(fullKey, value);
        // Sync to Supabase in background
        import('./src/utils/supabaseSync').then(m => m.syncToSupabase(fullKey, value));
      } else {
        originalSetItem(key, value);
      }
    };

    localStorage.removeItem = (key: string) => {
      if (key.startsWith('microfox_') && key !== 'microfox_current_mf' && key !== 'microfox_current_user' && key !== 'microfox_users') {
        const fullKey = prefix + key;
        originalRemoveItem(fullKey);
        // Remove from Supabase in background
        import('./src/supabase').then(m => {
          if (m.supabase && (import.meta as any).env?.VITE_SUPABASE_URL) {
            m.supabase.from('storage').delete().eq('key', fullKey).then(({ error }: { error: any }) => {
              if (error) console.error('Error removing from Supabase:', error);
            });
          }
        });
      } else {
        originalRemoveItem(key);
      }
    };

    // Pull from Supabase on load
    setIsSyncing(true);
    try {
      const { pullFromSupabase } = await import('./src/utils/supabaseSync');
      await pullFromSupabase(prefix, originalSetItem);
    } catch (error) {
      console.error('Error pulling from Supabase:', error);
    } finally {
      setIsSyncing(false);
    }
  };

  const [activeSection, setActiveSection] = useState<string>('Guide Pratique');
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
  const currentMF = currentUser?.microfinance || null;

  useEffect(() => {
    if (!currentUser) return;

    if (localStorage.getItem('microfox_reset_v1') !== 'true') {
      localStorage.setItem('microfox_reset_v1', 'true');
    }

    const handleResize = () => {
      if (window.innerWidth >= 1024) {
        setIsSidebarOpen(true);
      }
    };

    // Apply isolation on initial load if MF code exists
    const mfCodeOnLoad = localStorage.getItem('microfox_current_mf');
    if (mfCodeOnLoad) {
      setupStorageIsolation(mfCodeOnLoad);
    }
    
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (localStorage.getItem('microfox_pending_sync') === 'true') {
        e.preventDefault();
        e.returnValue = 'Vous avez des données non synchronisées. Voulez-vous vraiment quitter ?';
      }
    };

    if (localStorage.getItem('microfox_restore_success') === 'true') {
      alert("La restauration a été effectuée avec succès !");
      localStorage.removeItem('microfox_restore_success');
    }

    window.addEventListener('resize', handleResize);
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, []);

  const handleSelectSection = (id: string) => {
    setActiveSection(id);
    if (window.innerWidth < 1024) {
      setIsSidebarOpen(false);
    }
  };

  const renderContent = () => {
    if (activeSection === 'Guide Pratique') {
      return <GuidePratique />;
    }

    if (activeSection === 'Tableau de Bord') {
      return <Dashboard />;
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

    if (activeSection === 'Demande de retrait tontine') {
      return <TontineWithdrawal />;
    }

    if (activeSection === 'Vérification de retrait tontine') {
      return <TontineVerification />;
    }

    if (activeSection === 'Commissions') {
      return <Commissions />;
    }

    if (activeSection === 'Gestion Crédits') {
      return <CreditManagement />;
    }

    if (activeSection === 'Demande de crédit') {
      return <CreditRequest />;
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

    if (activeSection === 'Conseils & Formation') {
      return <EducationSupport />;
    }

    if (activeSection === 'Configuration') {
      return <Configuration />;
    }

    if (activeSection === 'Contrôle Terrain') {
      return <FieldControl />;
    }

    if (activeSection === 'Corrections d\'opération') {
      return <OperationCorrections />;
    }

    if (activeSection === 'Audit & Accès Sécurité') {
      return <AuditSecurity />;
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
    setCurrentUser(user);
  };

  const handleLogout = () => {
    if (currentUser) {
      recordAuditLog('DECONNEXION', 'AUTHENTIFICATION', `Déconnexion de ${currentUser.identifiant}`);
    }
    sessionStorage.removeItem('microfox_session_active');
    localStorage.removeItem('microfox_current_mf');
    localStorage.removeItem('microfox_current_user');
    
    window.location.href = window.location.origin;
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

  return (
    <div className="flex h-screen bg-[#0a1226] overflow-hidden relative text-gray-100">
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
        />
      </div>
      
      <div className="flex-1 flex flex-col min-w-0">
        <Header 
          activeSection={activeSection} 
          onOpenSidebar={() => setIsSidebarOpen(true)} 
          currentUser={currentUser}
          onLogout={handleLogout}
        />
        <main className="flex-1 overflow-y-auto p-4 lg:p-6 custom-scrollbar">
          {renderContent()}
        </main>
      </div>
    </div>
  );
};

export default App;