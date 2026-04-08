
import React, { useState, useEffect } from 'react';
import { ShieldCheck, Save, CheckSquare, Square, Search, X } from 'lucide-react';
import { recordAuditLog } from '../utils/audit';

const ROLES = [
  'administrateur',
  'directeur',
  'gestionnaire de crédit',
  'caissier',
  'contrôleur',
  'auditeur',
  'agent commercial'
];

const ALL_TABS = [
  'Tableau de Bord',
  'Carte Géographique',
  'Membres',
  'Rapport Adhésions',
  'Analyse',
  'Alerte Doublons',
  'Réclamations Clients',
  'Demande de crédit',
  'Validation de Crédit',
  'Déblocage de crédit',
  'Crédit actif',
  'Autres opérations crédit',
  'Tontine Journalière',
  'Validation Cotisations Zone',
  'Annulation Cotisation',
  'Demande de retrait tontine',
  'Vérification de retrait tontine',
  'Versements Agents',
  'Vente Livrets',
  'Gestion Caisse',
  'CAISSE PRINCIPALE',
  'Coffre & Banque',
  'Dépenses administratives',
  'Salaire du Personnel',
  'Stocks Livrets',
  'Frais & Parts Sociales',
  'Commissions',
  'Journal Global',
  'Reçu de caisse',
  'Comptabilité & États',
  'Balance des comptes',
  'États Réglementaires',
  'Etats des écarts',
  'Écarts de Caisse',
  'Rapports Financiers',
  'Pièces à imprimer',
  'Contrôle Terrain',
  'Corrections d\'opération',
  'Conformité (Ratios & LAB)',
  'Audit & Accès Sécurité',
  'Suivi des Activités',
  'Gestion des Utilisateurs',
  'Permission',
  'Conseils & Formation',
  'Configuration',
  'Notification'
];

const Permissions: React.FC = () => {
  const [selectedRole, setSelectedRole] = useState(ROLES[1]); // Default to second role as admin has all
  const [permissions, setPermissions] = useState<Record<string, string[]>>({});
  const [showSuccess, setShowSuccess] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    const saved = localStorage.getItem('microfox_permissions');
    const defaults: Record<string, string[]> = {
      'directeur': ['Tableau de Bord', 'Carte Géographique', 'Membres', 'Rapport Adhésions', 'Analyse', 'Demande de crédit', 'Validation de Crédit', 'Déblocage de crédit', 'Crédit actif', 'Autres opérations crédit', 'Tontine Journalière', 'Demande de retrait tontine', 'Vérification de retrait tontine', 'Versements Agents', 'Vente Livrets', 'Gestion Caisse', 'CAISSE PRINCIPALE', 'Coffre & Banque', 'Dépenses administratives', 'Salaire du Personnel', 'Stocks Livrets', 'Frais & Parts Sociales', 'Commissions', 'Journal Global', 'Balance des comptes', 'Reçu de caisse', 'Comptabilité & États', 'États Réglementaires', 'Etats des écarts', 'Écarts de Caisse', 'Rapports Financiers', 'Pièces à imprimer', 'Contrôle Terrain', 'Conformité (Ratios & LAB)', 'Conseils & Formation', 'Notification'],
      'caissier': ['Membres', 'Analyse', 'Crédit actif', 'Vente Livrets', 'Gestion Caisse', 'Dépenses administratives', 'Frais & Parts Sociales', 'Déblocage de crédit', 'Journal Global', 'Reçu de caisse', 'Etats des écarts', 'Rapports Financiers', 'Notification'],
      'contrôleur': ['Carte Géographique', 'Contrôle Terrain', 'Notification'],
      'auditeur': ['Carte Géographique', 'Alerte Doublons', 'Réclamations Clients', 'Vérification de retrait tontine', 'Notification'],
      'agent commercial': ['Carte Géographique', 'Membres', 'Alerte Doublons', 'Crédit actif', 'Tontine Journalière', 'Annulation Cotisation', 'Demande de retrait tontine', 'Versements Agents', 'Vente Livrets', 'Commissions', 'Journal Global', 'Etats des écarts', 'Notification'],
      'gestionnaire de crédit': ['Membres', 'Rapport Adhésions', 'Alerte Doublons', 'Réclamations Clients', 'Demande de crédit', 'Crédit actif', 'Autres opérations crédit', 'Notification']
    };

    if (saved) {
      const perms = JSON.parse(saved);
      // Merge with defaults to ensure all roles have keys
      const merged = { ...defaults, ...perms };
      
      // Force cleanup for agent commercial (as requested previously)
      if (merged['agent commercial']) {
        merged['agent commercial'] = merged['agent commercial'].filter((p: string) => 
          p !== 'Analyse' && p !== 'Tableau de Bord' && p !== 'Reçu de caisse'
        );
      }
      
      setPermissions(merged);
      localStorage.setItem('microfox_permissions', JSON.stringify(merged));
    } else {
      setPermissions(defaults);
      localStorage.setItem('microfox_permissions', JSON.stringify(defaults));
    }
  }, []);

  const togglePermission = (tab: string) => {
    const rolePerms = permissions[selectedRole] || [];
    const newPerms = rolePerms.includes(tab)
      ? rolePerms.filter(t => t !== tab)
      : [...rolePerms, tab];
    
    const updated = { ...permissions, [selectedRole]: newPerms };
    setPermissions(updated);
  };

  const handleSave = () => {
    localStorage.setItem('microfox_permissions', JSON.stringify(permissions));
    recordAuditLog('MODIFICATION', 'PERMISSIONS', `Mise à jour des permissions pour tous les rôles`);
    setShowSuccess(true);
    setTimeout(() => setShowSuccess(false), 3000);
    window.dispatchEvent(new Event('storage'));
  };

  const filteredTabs = ALL_TABS.filter(tab => 
    tab.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-20">
      <div className="flex items-start gap-4">
        <div className="p-3 bg-blue-100 text-blue-600 rounded-2xl">
          <ShieldCheck size={32} />
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl font-black text-[#121c32] uppercase tracking-tight">Gestion des Permissions</h1>
          <p className="text-gray-500 font-medium">Configurez les onglets visibles pour chaque rôle utilisateur.</p>
        </div>
      </div>

      <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-gray-100 space-y-8">
        <div className="space-y-4">
          <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Sélectionner un Rôle</label>
          <div className="flex flex-wrap gap-2">
            {ROLES.filter(r => r !== 'administrateur').map(role => (
              <button
                key={role}
                onClick={() => setSelectedRole(role)}
                className={`px-6 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${
                  selectedRole === role 
                    ? 'bg-[#121c32] text-white shadow-lg' 
                    : 'bg-gray-50 text-gray-400 hover:bg-gray-100'
                }`}
              >
                {role}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex-1 space-y-2">
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Onglets Disponibles</label>
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                <input 
                  type="text"
                  placeholder="Rechercher un onglet..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-11 pr-10 py-3 bg-gray-50 border border-gray-100 rounded-2xl outline-none focus:border-blue-500 font-bold text-[#121c32] transition-all text-sm"
                />
                {searchTerm && (
                  <button 
                    onClick={() => setSearchTerm('')}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    <X size={16} />
                  </button>
                )}
              </div>
            </div>
            <div className="flex items-center gap-4 self-end">
              {showSuccess && (
                <div className="fixed top-20 right-8 z-[100] bg-emerald-600 text-white px-6 py-3 rounded-xl font-black uppercase tracking-widest shadow-2xl animate-bounce flex items-center gap-2">
                  <ShieldCheck size={18} />
                  Permissions enregistrées !
                </div>
              )}
              <button 
                onClick={handleSave}
                className="flex items-center gap-2 bg-emerald-600 text-white px-6 py-3 rounded-xl font-black uppercase tracking-widest text-[10px] hover:bg-emerald-700 transition-all shadow-lg active:scale-95"
              >
                <Save size={16} />
                Enregistrer
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {filteredTabs.map(tab => {
              const isChecked = (permissions[selectedRole] || []).includes(tab);
              return (
                <button
                  key={tab}
                  onClick={() => togglePermission(tab)}
                  className={`flex items-center gap-3 p-4 rounded-2xl border transition-all text-left ${
                    isChecked 
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-900' 
                      : 'bg-gray-50 border-gray-100 text-gray-500 hover:border-gray-200'
                  }`}
                >
                  {isChecked ? <CheckSquare size={20} className="text-emerald-600" /> : <Square size={20} />}
                  <span className="text-xs font-bold uppercase tracking-tight">{tab}</span>
                </button>
              );
            })}
            {filteredTabs.length === 0 && (
              <div className="col-span-full py-10 text-center text-gray-400 italic">
                Aucun onglet ne correspond à votre recherche.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Permissions;
