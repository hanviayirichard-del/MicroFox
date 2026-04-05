import React from 'react';
import { 
  Map, 
  BookOpen, 
  Users, 
  Clock, 
  Landmark, 
  Vault, 
  Package, 
  Wallet, 
  Percent, 
  ClipboardCheck, 
  FileCheck,
  AlertTriangle, 
  ShoppingCart, 
  Gem, 
  Calculator, 
  CreditCard,
  GraduationCap,
  Settings,
  ShieldCheck,
  LayoutDashboard,
  Scale,
  MessageSquare,
  Bell,
  LogOut,
  RefreshCw,
  X,
  FileText,
  Hexagon,
  CloudSync,
  Printer,
  TrendingUp,
  TrendingDown,
  Search,
  Scale as BalanceIcon
} from 'lucide-react';
import { MenuItem, SidebarProps } from '../types';
import { useState, useEffect } from 'react';

interface MenuCategory {
  title: string;
  items: MenuItem[];
}

const Sidebar: React.FC<SidebarProps> = ({ activeId, onSelect, onClose, onLogout, onSync, isSyncing }) => {
  const [hasPendingSync, setHasPendingSync] = useState(false);
  const [permissions, setPermissions] = useState<Record<string, string[]>>({});
  const [notificationCount, setNotificationCount] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    const updateState = () => {
      setHasPendingSync(localStorage.getItem('microfox_pending_sync') === 'true' || !!isSyncing);
      const savedPerms = localStorage.getItem('microfox_permissions');
      if (savedPerms) {
        try {
          setPermissions(JSON.parse(savedPerms));
        } catch (e) {
          console.error("Error parsing permissions:", e);
        }
      }

      // Calculate notification count
      const userStr = localStorage.getItem('microfox_current_user');
      if (userStr) {
        const user = JSON.parse(userStr);
        let count = 0;

        // Agent pending deposit
        if (user.role === 'agent commercial') {
          const balance = Number(localStorage.getItem(`microfox_agent_balance_${user.id}`) || 0);
          if (balance > 0) count++;
        }

        // Pending withdrawals (Auditor/Admin)
        if (['auditeur', 'contrôleur', 'administrateur'].includes(user.role)) {
          const saved = localStorage.getItem('microfox_pending_withdrawals');
          if (saved) {
            const pending = JSON.parse(saved).filter((r: any) => !r.isDeleted && r.status === 'En attente');
            if (pending.length > 0) count++;
          }
        }

        // Cashier/Admin notifications
        if (['caissier', 'administrateur', 'directeur'].includes(user.role)) {
          // Tontine withdrawals
          const savedValidated = localStorage.getItem('microfox_validated_withdrawals');
          if (savedValidated) {
            const validated = JSON.parse(savedValidated).filter((r: any) => !r.isDeleted && r.status === 'Validé' && !r.isDisbursed);
            if (validated.length > 0) count++;
          }
          // Agent payments
          const savedPayments = localStorage.getItem('microfox_agent_payments');
          if (savedPayments) {
            const pendingPayments = JSON.parse(savedPayments).filter((p: any) => p.status === 'En attente');
            if (pendingPayments.length > 0) count++;
          }
          // Credit disbursements
          const savedMembers = localStorage.getItem('microfox_members_data');
          if (savedMembers) {
            const members = JSON.parse(savedMembers);
            const pendingCredits = members.filter((m: any) => m.lastCreditRequest && m.lastCreditRequest.status === 'En attente');
            if (pendingCredits.length > 0) count++;
          }
        }

        setNotificationCount(count);
      }
    };
    updateState();
    window.addEventListener('storage', updateState);
    const interval = setInterval(updateState, 2000);
    return () => {
      window.removeEventListener('storage', updateState);
      clearInterval(interval);
    };
  }, [isSyncing]);

  const handleSync = async () => {
    if (!navigator.onLine) {
      alert("Pas de connexion internet. Synchronisation impossible.");
      return;
    }
    
    try {
      await onSync();
      localStorage.setItem('microfox_pending_sync', 'false');
      setHasPendingSync(false);
      alert("Synchronisation terminée avec succès.");
      window.dispatchEvent(new Event('storage'));
    } catch (error) {
      console.error('Sync error:', error);
      alert("Une erreur est survenue lors de la synchronisation.");
    }
  };

  const categories: MenuCategory[] = [
    {
      title: "Aide & Support",
      items: [
        { id: 'Guide Pratique', label: 'Guide Pratique', icon: <BookOpen size={20} /> },
      ]
    },
    {
      title: "Pilotage",
      items: [
        { id: 'Tableau de Bord', label: 'Tableau de Bord', icon: <LayoutDashboard size={20} /> },
        { id: 'Notification', label: 'Notification', icon: <Bell size={20} />, badge: notificationCount },
        { id: 'Carte Géographique', label: 'Carte Géographique', icon: <Map size={20} /> },
      ]
    },
    {
      title: "Gestion des Membres",
      items: [
        { id: 'Membres', label: 'Membres', icon: <Users size={20} /> },
        { id: 'Rapport Adhésions', label: 'Rapport Adhésions', icon: <FileText size={20} /> },
        { id: 'Alerte Doublons', label: 'Alerte Doublons', icon: <AlertTriangle size={20} />, badge: 0 },
        { id: 'Réclamations Clients', label: 'Réclamations Clients', icon: <MessageSquare size={20} /> },
        { id: 'Demande de crédit', label: 'Demande de crédit', icon: <FileText size={20} /> },
        { id: 'Validation de Crédit', label: 'Validation de Crédit', icon: <FileCheck size={20} /> },
        { id: 'Crédit actif', label: 'Crédit actif', icon: <TrendingUp size={20} /> },
        { id: 'Autres opérations crédit', label: 'Autres opérations crédit', icon: <RefreshCw size={20} /> },
      ]
    },
    {
      title: "Tontine & Collecte",
      items: [
        { id: 'Tontine Journalière', label: 'Tontine Journalière', icon: <Clock size={20} /> },
        { id: 'Demande de retrait tontine', label: 'Demande de retrait tontine', icon: <RefreshCw size={20} /> },
        { id: 'Vérification de retrait tontine', label: 'Vérification de retrait tontine', icon: <FileCheck size={20} /> },
        { id: 'Versements Agents', label: 'Versements Agents', icon: <Wallet size={20} /> },
        { id: 'Vente Livrets', label: 'Vente Livrets', icon: <ShoppingCart size={20} /> },
      ]
    },
    {
      title: "Opérations Financières",
      items: [
        { id: 'Gestion Caisse', label: 'Gestion Caisse', icon: <Landmark size={20} /> },
        { id: 'CAISSE PRINCIPALE', label: 'CAISSE PRINCIPALE', icon: <Landmark size={20} /> },
        { id: 'Coffre & Banque', label: 'Coffre & Banque', icon: <Vault size={20} /> },
        { id: 'Dépenses administratives', label: 'Dépenses administratives', icon: <TrendingDown size={20} /> },
        { id: 'Stocks Livrets', label: 'Stocks Livrets', icon: <Package size={20} /> },
        { id: 'Frais & Parts Sociales', label: 'Frais & Parts Sociales', icon: <Gem size={20} /> },
        { id: 'Déblocage de crédit', label: 'Déblocage de crédit', icon: <CreditCard size={20} /> },
        { id: 'Commissions', label: 'Commissions', icon: <Percent size={20} /> },
      ]
    },
    {
      title: "Comptabilité & Analyse",
      items: [
        { id: 'Analyse', label: 'Analyse', icon: <TrendingUp size={20} /> },
        { id: 'Journal Global', label: 'Journal Global', icon: <BookOpen size={20} />, badge: 0 },
        { id: 'Balance des comptes', label: 'Balance des comptes', icon: <BalanceIcon size={20} /> },
        { id: 'Reçu de caisse', label: 'Reçu de caisse', icon: <Printer size={20} /> },
        { id: 'Comptabilité & États', label: 'Comptabilité & États', icon: <Calculator size={20} /> },
        { id: 'États Réglementaires', label: 'États Réglementaires', icon: <FileCheck size={20} /> },
        { id: 'Etats des écarts', label: 'Etats des écarts', icon: <FileText size={20} /> },
        { id: 'Écarts de Caisse', label: 'Écarts de Caisse', icon: <AlertTriangle size={20} /> },
        { id: 'Rapports Financiers', label: 'Rapports Financiers', icon: <TrendingUp size={20} /> },
        { id: 'Pièces à imprimer', label: 'Pièces à imprimer', icon: <Printer size={20} /> },
      ]
    },
    {
      title: "Contrôle & Sécurité",
      items: [
        { id: 'Contrôle Terrain', label: 'Contrôle Terrain', icon: <ClipboardCheck size={20} /> },
        { id: 'Corrections d\'opération', label: 'Corrections d\'opération', icon: <RefreshCw size={20} /> },
        { id: 'Conformité (Ratios & LAB)', label: 'Conformité (Ratios & LAB)', icon: <Scale size={20} /> },
        { id: 'Audit & Accès Sécurité', label: 'Audit & Accès Sécurité', icon: <ShieldCheck size={20} /> },
      ]
    },
    {
      title: "Support & Système",
      items: [
        { id: 'Gestion des Utilisateurs', label: 'Gestion des Utilisateurs', icon: <ShieldCheck size={20} /> },
        { id: 'Permission', label: 'Permission', icon: <ShieldCheck size={20} /> },
        { id: 'Conseils & Formation', label: 'Conseils & Formation', icon: <GraduationCap size={20} />, variant: 'success' },
        { id: 'Configuration', label: 'Configuration', icon: <Settings size={20} /> },
      ]
    },
  ];

  return (
    <aside className="w-72 bg-[#121c32] text-white flex flex-col h-full shrink-0">
      <div className="p-4 flex items-center justify-between border-b border-gray-800">
        <div className="flex items-center gap-2">
          <div className="bg-[#00c896] p-1.5 rounded-lg">
            <Hexagon size={24} className="text-white" />
          </div>
          <span className="text-2xl font-bold tracking-tight">MicroFoX</span>
        </div>
        <button 
          onClick={onClose}
          className="text-gray-400 hover:text-white transition-colors"
        >
          <X size={24} />
        </button>
      </div>

      <div className="px-4 py-3 border-b border-gray-800">
        <div className="relative">
          <input
            type="text"
            placeholder="Rechercher un onglet..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-[#1e2a44] text-white text-xs px-4 py-2.5 rounded-xl border border-gray-700 focus:outline-none focus:border-[#00c896] transition-all placeholder:text-gray-500"
          />
          <Search size={14} className="absolute right-3 top-3 text-gray-500" />
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto py-4 custom-scrollbar">
        {categories
          .filter(cat => cat.title !== "Support & Système" || (JSON.parse(localStorage.getItem('microfox_current_user') || '{}').role === 'administrateur'))
          .map((category) => {
            const userRole = JSON.parse(localStorage.getItem('microfox_current_user') || '{}').role;
            const filteredItems = category.items.filter(item => {
              // Search filter
              if (searchTerm && !item.label.toLowerCase().includes(searchTerm.toLowerCase())) {
                return false;
              }

              if (item.id === 'Guide Pratique') return true;
              if (userRole === 'administrateur') return true;

              if (permissions[userRole]) {
                return permissions[userRole].includes(item.id);
              }

              // Fallback to hardcoded defaults if no permissions stored yet for this role
              if (userRole === 'gestionnaire de crédit') {
                return ((item.label.toLowerCase().includes('crédit') || item.id.toLowerCase().includes('crédit')) && item.label !== 'Déblocage de crédit') || item.id === 'Notification';
              }
              if (userRole === 'directeur') {
                const allowedIds = [
                  'Tableau de Bord', 'Carte Géographique', 'Membres', 'Rapport Adhésions', 'Analyse', 'Demande de crédit', 
                  'Validation de Crédit', 'Crédit actif', 'Autres opérations crédit', 'Tontine Journalière', 
                  'Versements Agents', 'Vente Livrets', 'Gestion Caisse', 'CAISSE PRINCIPALE', 'Coffre & Banque', 
                  'Dépenses administratives', 'Stocks Livrets', 'Frais & Parts Sociales', 'Déblocage de crédit', 
                  'Commissions', 'Journal Global', 'Balance des comptes', 'Comptabilité & États', 'États Réglementaires', 
                  'Etats des écarts', 'Écarts de Caisse', 'Rapports Financiers', 'Pièces à imprimer', 'Reçu de caisse', 'Contrôle Terrain', 
                  'Conformité (Ratios & LAB)', 'Conseils & Formation', 'Notification'
                ];
                return allowedIds.includes(item.id);
              }
              if (userRole === 'caissier') {
                const allowedIds = [
                  'Membres',
                  'Analyse',
                  'Crédit actif',
                  'Tontine Journalière',
                  'Vente Livrets',
                  'Gestion Caisse',
                  'Dépenses administratives',
                  'Frais & Parts Sociales',
                  'Déblocage de crédit',
                  'Journal Global',
                  'Reçu de caisse',
                  'Etats des écarts',
                  'Rapports Financiers',
                  'Notification'
                ];
                return allowedIds.includes(item.id);
              }
              if (userRole === 'contrôleur') {
                const allowedIds = ['Carte Géographique', 'Contrôle Terrain', 'Notification'];
                return allowedIds.includes(item.id);
              }
              if (userRole === 'auditeur') {
                const allowedIds = [
                  'Carte Géographique',
                  'Alerte Doublons',
                  'Réclamations Clients',
                  'Vérification de retrait tontine',
                  'Notification'
                ];
                return allowedIds.includes(item.id);
              }
              if (userRole === 'agent commercial') {
                const allowedIds = [
                  'Tableau de Bord',
                  'Carte Géographique',
                  'Membres',
                  'Analyse',
                  'Alerte Doublons',
                  'Crédit actif',
                  'Tontine Journalière',
                  'Demande de retrait tontine',
                  'Versements Agents',
                  'Vente Livrets',
                  'Commissions',
                  'Journal Global',
                  'Reçu de caisse',
                  'Etats des écarts',
                  'Notification'
                ];
                return allowedIds.includes(item.id);
              }
              return true;
            });

            if (filteredItems.length === 0) return null;

            return (
              <div key={category.title} className="mb-6">
                <h3 className="px-6 mb-2 text-[10px] font-bold text-blue-400 uppercase tracking-widest">
                  {category.title}
                </h3>
                <ul className="space-y-1 px-3">
                  {filteredItems.map((item) => (
                    <li key={item.id}>
                      <button
                        onClick={() => onSelect(item.id)}
                        className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all duration-200 group
                          ${activeId === item.id
                            ? 'bg-[#00c896] text-white' 
                            : 'text-gray-300 hover:bg-gray-800 hover:text-gray-100'
                          }`}
                      >
                        <span className={activeId === item.id ? 'text-white' : 'text-gray-300 group-hover:text-gray-100'}>
                          {item.icon}
                        </span>
                        <span className="flex-1 text-left font-medium">
                          {item.label}
                        </span>
                        {item.badge !== undefined && (
                          <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${activeId === item.id ? 'bg-[#00a87d] text-white' : 'bg-gray-800 text-gray-400'}`}>
                            {item.badge}
                          </span>
                        )}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
      </nav>

      <div className="p-4 bg-[#0a1226] border-t border-gray-800 space-y-4">
        <button 
          onClick={handleSync}
          className={`w-full py-3 rounded-xl flex items-center justify-center gap-2 font-bold transition-all shadow-lg active:scale-95 ${hasPendingSync ? 'bg-red-600 hover:bg-red-700' : 'bg-emerald-600 hover:bg-emerald-700'} text-white`}
        >
          <CloudSync size={20} />
          Synchronisation
        </button>

        <div className="flex items-center justify-between text-[10px] text-gray-400 uppercase tracking-widest font-bold">
          <span>
            {(() => {
              const userStr = localStorage.getItem('microfox_current_user');
              if (!userStr) return 'Administrateur';
              const user = JSON.parse(userStr);
              return `${user.identifiant} (${user.role.charAt(0).toUpperCase() + user.role.slice(1)})`;
            })()}
          </span>
          <div className="flex items-center gap-1.5">
            <span className={`w-2 h-2 rounded-full ${navigator.onLine ? 'bg-green-500' : 'bg-gray-500'} animate-pulse`}></span>
            <span className={navigator.onLine ? 'text-green-500' : 'text-gray-500'}>{navigator.onLine ? 'Sync Live' : 'Hors ligne'}</span>
          </div>
        </div>
        
        <button 
          className="w-full bg-red-600 hover:bg-red-700 text-white py-3 rounded-xl flex items-center justify-center gap-2 font-bold transition-all shadow-lg active:scale-95"
          onClick={onLogout}
        >
          <LogOut size={18} />
          Déconnexion
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;