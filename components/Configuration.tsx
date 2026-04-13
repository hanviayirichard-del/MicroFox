import React, { useState, useEffect } from 'react';
import { Download, Upload, Settings, ShieldCheck, Database, Building2, Save, Plus, Trash2 } from 'lucide-react';
import { Microfinance, UserRole, AutoDeactivationRule } from '../types';

const Configuration: React.FC = () => {
  const [isOfflineMode, setIsOfflineMode] = useState(() => {
    return localStorage.getItem('microfox_offline_mode') === 'true';
  });

  const [mfConfig, setMfConfig] = useState<Microfinance>(() => {
    const saved = localStorage.getItem('microfox_mf_config');
    const config = saved ? JSON.parse(saved) : { nom: '', adresse: '', code: '', telephone: '' };
    return {
      ...config,
      autoDeactivationEnabled: config.autoDeactivationEnabled ?? false,
      autoDeactivationDays: config.autoDeactivationDays ?? [],
      autoDeactivationStartTime: config.autoDeactivationStartTime ?? '00:00',
      autoDeactivationEndTime: config.autoDeactivationEndTime ?? '23:59',
      autoDeactivationRules: config.autoDeactivationRules ?? []
    };
  });

  const [newRule, setNewRule] = useState<Partial<AutoDeactivationRule>>({
    roles: [],
    days: [],
    startTime: '18:00',
    endTime: '23:59',
    enabled: true
  });

  const roles: UserRole[] = [
    'administrateur',
    'directeur',
    'gestionnaire de crédit',
    'caissier',
    'contrôleur',
    'auditeur',
    'agent commercial'
  ];

  const addRule = () => {
    if (!newRule.roles?.length || !newRule.days?.length) {
      alert("Veuillez sélectionner au moins un rôle et un jour.");
      return;
    }
    const rule: AutoDeactivationRule = {
      id: Date.now().toString(),
      roles: newRule.roles as UserRole[],
      days: newRule.days as string[],
      startTime: newRule.startTime || '00:00',
      endTime: newRule.endTime || '23:59',
      enabled: true
    };
    setMfConfig({
      ...mfConfig,
      autoDeactivationRules: [...(mfConfig.autoDeactivationRules || []), rule]
    });
    setNewRule({
      roles: [],
      days: [],
      startTime: '18:00',
      endTime: '23:59',
      enabled: true
    });
  };

  const removeRule = (id: string) => {
    setMfConfig({
      ...mfConfig,
      autoDeactivationRules: (mfConfig.autoDeactivationRules || []).filter(r => r.id !== id)
    });
  };

  const toggleDay = (day: string) => {
    const currentDays = mfConfig.autoDeactivationDays || [];
    const newDays = currentDays.includes(day)
      ? currentDays.filter(d => d !== day)
      : [...currentDays, day];
    setMfConfig({ ...mfConfig, autoDeactivationDays: newDays });
  };

  const toggleNewRuleDay = (day: string) => {
    const currentDays = newRule.days || [];
    const newDays = currentDays.includes(day)
      ? currentDays.filter(d => d !== day)
      : [...currentDays, day];
    setNewRule({ ...newRule, days: newDays });
  };

  const toggleNewRuleRole = (role: UserRole) => {
    const currentRoles = newRule.roles || [];
    const newRoles = currentRoles.includes(role)
      ? currentRoles.filter(r => r !== role)
      : [...currentRoles, role];
    setNewRule({ ...newRule, roles: newRoles });
  };

  const timeOptions = Array.from({ length: 24 }, (_, i) => {
    const h = i.toString().padStart(2, '0');
    return [`${h}:00`, `${h}:30`];
  }).flat();

  const [newMfForm, setNewMfForm] = useState({ nom: '', code: '' });
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [showSaveConfirmation, setShowSaveConfirmation] = useState(false);
  const [microfinances, setMicrofinances] = useState<Microfinance[]>(() => {
    const saved = localStorage.getItem('microfox_microfinances');
    return saved ? JSON.parse(saved) : [];
  });

  const handleCreateMf = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMfForm.nom || !newMfForm.code) return;
    
    const newMf: Microfinance = {
      nom: newMfForm.nom,
      code: newMfForm.code,
      adresse: '',
      telephone: ''
    };

    const updatedList = [...microfinances, newMf];
    setMicrofinances(updatedList);
    localStorage.setItem('microfox_microfinances', JSON.stringify(updatedList));

    const updatedConfig = { ...mfConfig, nom: newMfForm.nom, code: newMfForm.code };
    setMfConfig(updatedConfig);
    localStorage.setItem('microfox_mf_config', JSON.stringify(updatedConfig));
    localStorage.setItem('microfox_current_mf', updatedConfig.nom);
    setNewMfForm({ nom: '', code: '' });
    setShowConfirmation(true);
    setTimeout(() => setShowConfirmation(false), 3000);
    alert("Microfinance créée avec succès !");
    window.dispatchEvent(new Event('storage'));
  };

  const handleSaveMfConfig = (e: React.FormEvent) => {
    e.preventDefault();
    localStorage.setItem('microfox_mf_config', JSON.stringify(mfConfig));
    localStorage.setItem('microfox_current_mf', mfConfig.nom);
    setShowSaveConfirmation(true);
    setTimeout(() => setShowSaveConfirmation(false), 3000);
    alert("Configuration de la microfinance enregistrée !");
    window.dispatchEvent(new Event('storage'));
  };

  const toggleOfflineMode = () => {
    const newValue = !isOfflineMode;
    setIsOfflineMode(newValue);
    localStorage.setItem('microfox_offline_mode', String(newValue));
    window.dispatchEvent(new Event('storage'));
  };

  const handleBackup = () => {
    const mf = localStorage.getItem('microfox_current_mf');
    if (!mf) return;
    const prefix = `mf_${mf.toLowerCase().replace(/\s+/g, '_')}_`;
    
    const data: Record<string, string | null> = {};
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(prefix)) {
        // Store without prefix for easier restore
        data[key.replace(prefix, '')] = localStorage.getItem(key.replace(prefix, ''));
      }
    }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `microfox_${mf.toLowerCase().replace(/\s+/g, '_')}_backup_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleRestore = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e: any) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (re) => {
        try {
          const content = re.target?.result as string;
          const data = JSON.parse(content);
          
          if (confirm("Voulez-vous vraiment restaurer ces données ? Cela écrasera vos données actuelles pour cette microfinance.")) {
            const mf = localStorage.getItem('microfox_current_mf');
            if (!mf) return;
            const prefix = `mf_${mf.toLowerCase().replace(/\s+/g, '_')}_`;

            // 1. Nettoyer les données existantes pour CETTE microfinance
            const keysToRemove: string[] = [];
            for (let i = 0; i < localStorage.length; i++) {
              const key = localStorage.key(i);
              if (key && key.startsWith(prefix)) {
                keysToRemove.push(key);
              }
            }
            keysToRemove.forEach(key => localStorage.removeItem(key));

            // 2. Appliquer les nouvelles données (l'override s'occupera du préfixe via setItem)
            Object.entries(data).forEach(([key, value]) => {
              if (key.startsWith('microfox_') && value !== null) {
                const stringValue = typeof value === 'string' ? value : JSON.stringify(value);
                localStorage.setItem(key, stringValue);
              }
            });
            
            // 3. Marquer le succès et réinitialiser l'état de synchronisation
            localStorage.setItem('microfox_restore_success', 'true');
            localStorage.setItem('microfox_pending_sync', 'false');
            
            // 4. Rechargement forcé après un court délai pour assurer la persistance
            setTimeout(() => {
              window.location.reload();
            }, 300);
          }
        } catch (err) {
          alert("Erreur lors de la lecture du fichier de sauvegarde. Format JSON invalide.");
        }
      };
      reader.readAsText(file);
    };
    input.click();
  };

  const handleResetAccounts = () => {
    if (confirm("ATTENTION : Voulez-vous vraiment remettre tous les comptes à zéro et annuler les opérations en cours ? Cette action est irréversible.")) {
      // Reset main balances
      localStorage.setItem('microfox_vault_balance', '0');
      localStorage.setItem('microfox_bank_balance', '0');
      localStorage.setItem('microfox_cash_balance_CAISSE PRINCIPALE', '40000000');
      localStorage.setItem('microfox_cash_balance_CAISSE 1', '0');
      localStorage.setItem('microfox_cash_balance_CAISSE 2', '0');

      // Reset member balances
      const savedMembers = localStorage.getItem('microfox_members_data');
      if (savedMembers) {
        const members = JSON.parse(savedMembers);
        const resetMembers = members.map((m: any) => ({
          ...m,
          balances: {
            epargne: 0,
            tontine: 0,
            credit: 0,
            garantie: 0,
            partSociale: 0
          },
          tontineAccounts: (m.tontineAccounts || []).map((ta: any) => ({ ...ta, balance: 0 })),
          history: [] // Clear history to maintain consistency with zero balance
        }));
        localStorage.setItem('microfox_members_data', JSON.stringify(resetMembers));
      }

      // Clear journals and history
      localStorage.removeItem('microfox_global_journal');
      localStorage.removeItem('microfox_agent_payments');
      localStorage.removeItem('microfox_vault_transactions');
      localStorage.removeItem('microfox_gaps_data');
      
      // Annuler les opérations en cours
      localStorage.removeItem('microfox_validated_withdrawals');
      localStorage.removeItem('microfox_credit_requests');
      localStorage.removeItem('microfox_credit_disbursements');
      localStorage.removeItem('microfox_tontine_withdrawals');
      localStorage.removeItem('microfox_field_controls');
      localStorage.removeItem('microfox_pending_gaps');
      localStorage.setItem('microfox_commissions_data', '0');
      localStorage.setItem('microfox_commissions_history', JSON.stringify([]));
      localStorage.removeItem('microfox_total_encaisse_jour');
      localStorage.removeItem('microfox_current_session_data');
      localStorage.removeItem('microfox_daily_tontine_data');
      localStorage.removeItem('microfox_pending_transfers');
      localStorage.removeItem('microfox_notifications');
      localStorage.removeItem('microfox_pending_deposits');
      localStorage.removeItem('microfox_pending_withdrawals');
      localStorage.removeItem('microfox_pending_credits');
      localStorage.removeItem('microfox_pending_tontine');
      localStorage.removeItem('microfox_pending_epargne');
      localStorage.removeItem('microfox_pending_social');
      localStorage.removeItem('microfox_pending_validations');

      // Clear individual history files
      const keysToRemove = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('microfox_history_')) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach(key => localStorage.removeItem(key));

      // Find and reset all agent balances
      const mf = localStorage.getItem('microfox_current_mf');
      if (mf) {
        const prefix = `mf_${mf.toLowerCase().replace(/\s+/g, '_')}_`;
        
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && key.startsWith(prefix + 'microfox_agent_balance_')) {
            localStorage.setItem(key.replace(prefix, ''), '0');
          }
          if (key && key.startsWith(prefix + 'microfox_agent_commission_')) {
            localStorage.setItem(key.replace(prefix, ''), '0');
          }
        }
      }

      alert("Tous les comptes ont été remis à zéro et les opérations en cours ont été annulées.");
      window.location.reload();
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-black text-white uppercase tracking-tight">Configuration Système</h1>
        <p className="text-gray-400 text-sm font-medium mt-1">Paramètres et maintenance de l'application</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Ajouter une Microfinance (Image 1) */}
        <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-gray-100">
          <h2 className="text-2xl font-black text-[#00c896] uppercase tracking-tight mb-8">AJOUTER UNE MICROFINANCE</h2>
          
          {showConfirmation && (
            <div className="mb-6 p-4 bg-emerald-50 text-emerald-600 rounded-2xl text-center font-bold border border-emerald-100">
              Microfinance ajoutée avec succès !
            </div>
          )}

          <form onSubmit={handleCreateMf} className="space-y-6">
            <div className="space-y-2">
              <label className="text-sm font-black text-gray-400 uppercase tracking-widest">NOM DE L'INSTITUTION</label>
              <input 
                type="text" 
                value={newMfForm.nom}
                onChange={e => setNewMfForm({...newMfForm, nom: e.target.value})}
                placeholder="Nom (Ex: COOPEC...)"
                className="w-full p-6 bg-[#1e293b] border-none rounded-3xl outline-none text-white text-xl font-bold"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-black text-gray-400 uppercase tracking-widest">CODE INSTITUTIONNEL</label>
              <input 
                type="text" 
                value={newMfForm.code}
                onChange={e => setNewMfForm({...newMfForm, code: e.target.value})}
                placeholder="CODE UNIQUE..."
                className="w-full p-6 bg-[#1e293b] border-none rounded-3xl outline-none text-white text-xl font-bold"
              />
            </div>
            <button type="submit" className="w-full bg-[#00c896] text-white py-6 rounded-3xl font-black text-xl uppercase tracking-widest shadow-lg hover:bg-[#00a87d] transition-all active:scale-95">
              CRÉER L'INSTITUTION
            </button>
          </form>

          {microfinances.length > 0 && (
            <div className="mt-8 pt-8 border-t border-gray-100">
              <h3 className="text-sm font-black text-gray-400 uppercase tracking-widest mb-4">LISTE DES INSTITUTIONS</h3>
              <div className="space-y-3">
                {microfinances.map((mf, index) => (
                  <div key={index} className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl border border-gray-100">
                    <div className="flex flex-col">
                      <span className="font-bold text-[#121c32]">{mf.nom}</span>
                      <span className="text-[10px] text-gray-400 font-black uppercase tracking-widest">Code: {mf.code}</span>
                    </div>
                    <Building2 size={20} className="text-gray-300" />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Configuration de l'Institution (Image 2) */}
        <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-gray-100">
          <h2 className="text-4xl font-black text-[#121c32] uppercase tracking-tight mb-8 leading-tight">Configuration de l'Institution</h2>
          
          {showSaveConfirmation && (
            <div className="mb-6 p-4 bg-emerald-50 text-emerald-600 rounded-2xl text-center font-bold border border-emerald-100">
              Configuration enregistrée avec succès !
            </div>
          )}

          <div className="space-y-6">
            <div className="space-y-2">
              <label className="text-sm font-black text-gray-400 uppercase tracking-widest">NOM DE L'INSTITUTION</label>
              <input 
                type="text"
                value={mfConfig.nom}
                onChange={e => setMfConfig({...mfConfig, nom: e.target.value})}
                className="w-full p-6 bg-[#1e293b] border-none rounded-3xl outline-none text-white text-xl font-bold"
                placeholder="COOPEC FABES"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-black text-gray-400 uppercase tracking-widest">ADRESSE</label>
              <input 
                type="text"
                value={mfConfig.adresse}
                onChange={e => setMfConfig({...mfConfig, adresse: e.target.value})}
                className="w-full p-6 bg-[#1e293b] border-none rounded-3xl outline-none text-white text-xl font-bold"
                placeholder="Lomé,Bè Pa de SOUZA"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-black text-gray-400 uppercase tracking-widest">TÉLÉPHONE</label>
              <input 
                type="text"
                value={mfConfig.telephone}
                onChange={e => setMfConfig({...mfConfig, telephone: e.target.value})}
                className="w-full p-6 bg-[#1e293b] border-none rounded-3xl outline-none text-white text-xl font-bold"
                placeholder="(228)93719389"
              />
            </div>
            <button 
              onClick={handleSaveMfConfig}
              className="w-full bg-[#121c32] text-white py-6 rounded-3xl font-black text-xl uppercase tracking-widest shadow-lg hover:bg-[#0a1428] transition-all active:scale-95"
            >
              Enregistrer
            </button>
          </div>
        </div>

        {/* Gestion des Tarifs */}
        <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-gray-100">
          <h2 className="text-4xl font-black text-[#121c32] uppercase tracking-tight mb-8 leading-tight">Gestion des Tarifs</h2>
          
          {showSaveConfirmation && (
            <div className="mb-6 p-4 bg-emerald-50 text-emerald-600 rounded-2xl text-center font-bold border border-emerald-100">
              Tarifs enregistrés avec succès !
            </div>
          )}

          <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">PRIX PART SOCIALE</label>
                <input 
                  type="number"
                  value={mfConfig.prixPartSociale || ''}
                  onChange={e => setMfConfig({...mfConfig, prixPartSociale: Number(e.target.value)})}
                  className="w-full p-4 bg-[#1e293b] border-none rounded-2xl outline-none text-white text-lg font-bold"
                  placeholder="0"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">ADHÉSION</label>
                <input 
                  type="number"
                  value={mfConfig.prixAdhesion || ''}
                  onChange={e => setMfConfig({...mfConfig, prixAdhesion: Number(e.target.value)})}
                  className="w-full p-4 bg-[#1e293b] border-none rounded-2xl outline-none text-white text-lg font-bold"
                  placeholder="0"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">LIVRET DE COMPTE</label>
                <input 
                  type="number"
                  value={mfConfig.prixLivretCompte || ''}
                  onChange={e => setMfConfig({...mfConfig, prixLivretCompte: Number(e.target.value)})}
                  className="w-full p-4 bg-[#1e293b] border-none rounded-2xl outline-none text-white text-lg font-bold"
                  placeholder="0"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">LIVRET TONTINE</label>
                <input 
                  type="number"
                  value={mfConfig.prixLivretTontine || ''}
                  onChange={e => setMfConfig({...mfConfig, prixLivretTontine: Number(e.target.value)})}
                  className="w-full p-4 bg-[#1e293b] border-none rounded-2xl outline-none text-white text-lg font-bold"
                  placeholder="0"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">FRAIS TENU DE COMPTE</label>
                <input 
                  type="number"
                  value={mfConfig.fraisTenuCompte || ''}
                  onChange={e => setMfConfig({...mfConfig, fraisTenuCompte: Number(e.target.value)})}
                  className="w-full p-4 bg-[#1e293b] border-none rounded-2xl outline-none text-white text-lg font-bold"
                  placeholder="0"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">FRÉQUENCE DE PRÉLÈVEMENT</label>
                <select 
                  value={mfConfig.frequenceFraisTenueCompte || 'mensuel'}
                  onChange={e => setMfConfig({...mfConfig, frequenceFraisTenueCompte: e.target.value as any})}
                  className="w-full p-4 bg-[#1e293b] border-none rounded-2xl outline-none text-white text-lg font-bold appearance-none"
                >
                  <option value="mensuel">Mensuel</option>
                  <option value="trimestriel">Trimestriel</option>
                  <option value="semestriel">Semestriel</option>
                  <option value="annuel">Annuel</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">TAUX RÉMUNÉRATION (%)</label>
                <input 
                  type="number"
                  step="0.01"
                  value={mfConfig.tauxRemunerationEpargne || ''}
                  onChange={e => setMfConfig({...mfConfig, tauxRemunerationEpargne: Number(e.target.value)})}
                  className="w-full p-4 bg-[#1e293b] border-none rounded-2xl outline-none text-white text-lg font-bold"
                  placeholder="0.00"
                />
              </div>
            </div>
            <button 
              onClick={handleSaveMfConfig}
              className="w-full bg-[#00c896] text-white py-6 rounded-3xl font-black text-xl uppercase tracking-widest shadow-lg hover:bg-[#00a87d] transition-all active:scale-95"
            >
              Enregistrer les Tarifs
            </button>
          </div>
        </div>

        {/* Désactivation Automatique (Planning) */}
        <div className="bg-[#0f172a] p-8 rounded-[2.5rem] shadow-sm border border-gray-100 md:col-span-2">
          <h2 className="text-2xl font-black text-[#00c896] uppercase tracking-tight mb-8">DÉSACTIVATION AUTOMATIQUE</h2>
          
          {showSaveConfirmation && (
            <div className="mb-6 p-4 bg-emerald-500/10 text-emerald-500 rounded-2xl text-center font-bold border border-emerald-500/20">
              Planning enregistré avec succès !
            </div>
          )}

          <div className="space-y-8">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Statut du Planning */}
              <div className="bg-[#1e293b] p-8 rounded-[2rem] flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-black text-white">Statut Global</h3>
                  <p className="text-gray-400 text-sm font-medium mt-1">Activer le blocage automatique</p>
                </div>
                <button 
                  onClick={() => setMfConfig({...mfConfig, autoDeactivationEnabled: !mfConfig.autoDeactivationEnabled})}
                  className={`w-16 h-8 rounded-full relative transition-colors ${mfConfig.autoDeactivationEnabled ? 'bg-[#00c896]' : 'bg-gray-600'}`}
                >
                  <div className={`absolute top-1 w-6 h-6 bg-white rounded-full transition-all ${mfConfig.autoDeactivationEnabled ? 'right-1' : 'left-1'}`}></div>
                </button>
              </div>

              {/* Jours de Désactivation Globale */}
              <div className="bg-[#1e293b] p-8 rounded-[2rem] lg:col-span-2">
                <h3 className="text-sm font-black text-gray-400 uppercase tracking-widest mb-6">JOURS DE DÉSACTIVATION GLOBALE</h3>
                <div className="flex flex-wrap gap-4">
                  {['D', 'L', 'M', 'Me', 'J', 'V', 'S'].map(day => (
                    <button
                      key={day}
                      onClick={() => toggleDay(day)}
                      className={`w-12 h-12 rounded-xl font-black text-lg transition-all ${
                        (mfConfig.autoDeactivationDays || []).includes(day)
                          ? 'bg-[#00c896] text-white'
                          : 'bg-[#0f172a] text-gray-500'
                      }`}
                    >
                      {day}
                    </button>
                  ))}
                </div>
              </div>

              {/* Début Global */}
              <div className="bg-[#1e293b] p-8 rounded-[2rem]">
                <h3 className="text-sm font-black text-gray-400 uppercase tracking-widest mb-4">DÉBUT GLOBAL</h3>
                <div className="relative">
                  <select 
                    value={mfConfig.autoDeactivationStartTime || '00:00'}
                    onChange={e => setMfConfig({...mfConfig, autoDeactivationStartTime: e.target.value})}
                    className="w-full bg-transparent text-[#00c896] text-2xl font-black outline-none appearance-none cursor-pointer"
                  >
                    {timeOptions.map(t => <option key={t} value={t} className="bg-[#1e293b] text-white">{t}</option>)}
                  </select>
                  <div className="absolute right-0 top-1/2 -translate-y-1/2 pointer-events-none text-[#00c896]">
                    <Settings size={16} />
                  </div>
                </div>
              </div>

              {/* Fin Global */}
              <div className="bg-[#1e293b] p-8 rounded-[2rem]">
                <h3 className="text-sm font-black text-gray-400 uppercase tracking-widest mb-4">FIN GLOBAL</h3>
                <div className="relative">
                  <select 
                    value={mfConfig.autoDeactivationEndTime || '23:59'}
                    onChange={e => setMfConfig({...mfConfig, autoDeactivationEndTime: e.target.value})}
                    className="w-full bg-transparent text-[#00c896] text-2xl font-black outline-none appearance-none cursor-pointer"
                  >
                    {timeOptions.map(t => <option key={t} value={t} className="bg-[#1e293b] text-white">{t}</option>)}
                    <option value="23:59" className="bg-[#1e293b] text-white">23:59</option>
                  </select>
                  <div className="absolute right-0 top-1/2 -translate-y-1/2 pointer-events-none text-[#00c896]">
                    <Settings size={16} />
                  </div>
                </div>
              </div>
            </div>

            {/* Règles par Rôle */}
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-black text-white uppercase tracking-tight">Programmation par Rôle</h3>
                <div className="h-px flex-1 bg-gray-800 mx-6"></div>
              </div>

              {/* Formulaire Nouvelle Règle */}
              <div className="bg-[#1e293b] p-8 rounded-[2.5rem] border border-emerald-500/20 space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-4">
                    <h4 className="text-xs font-black text-gray-400 uppercase tracking-widest">1. Sélectionner les Rôles</h4>
                    <div className="flex flex-wrap gap-2">
                      {roles.map(role => (
                        <button
                          key={role}
                          onClick={() => toggleNewRuleRole(role)}
                          className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                            (newRule.roles || []).includes(role)
                              ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20'
                              : 'bg-[#0f172a] text-gray-500 hover:text-gray-300'
                          }`}
                        >
                          {role}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h4 className="text-xs font-black text-gray-400 uppercase tracking-widest">2. Sélectionner les Jours</h4>
                    <div className="flex gap-2">
                      {['D', 'L', 'M', 'Me', 'J', 'V', 'S'].map(day => (
                        <button
                          key={day}
                          onClick={() => toggleNewRuleDay(day)}
                          className={`w-10 h-10 rounded-xl font-black text-sm transition-all ${
                            (newRule.days || []).includes(day)
                              ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20'
                              : 'bg-[#0f172a] text-gray-500 hover:text-gray-300'
                          }`}
                        >
                          {day}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 items-end">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-2">Heure de Début</label>
                    <select 
                      value={newRule.startTime}
                      onChange={e => setNewRule({...newRule, startTime: e.target.value})}
                      className="w-full p-4 bg-[#0f172a] border-none rounded-2xl outline-none text-emerald-500 text-lg font-black appearance-none"
                    >
                      {timeOptions.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-2">Heure de Fin</label>
                    <select 
                      value={newRule.endTime}
                      onChange={e => setNewRule({...newRule, endTime: e.target.value})}
                      className="w-full p-4 bg-[#0f172a] border-none rounded-2xl outline-none text-emerald-500 text-lg font-black appearance-none"
                    >
                      {timeOptions.map(t => <option key={t} value={t}>{t}</option>)}
                      <option value="23:59">23:59</option>
                    </select>
                  </div>
                  <button 
                    onClick={addRule}
                    className="flex items-center justify-center gap-3 bg-emerald-500 text-white p-4 rounded-2xl font-black uppercase tracking-widest hover:bg-emerald-600 transition-all active:scale-95"
                  >
                    <Plus size={20} />
                    Ajouter la Règle
                  </button>
                </div>
              </div>

              {/* Liste des Règles */}
              <div className="space-y-4">
                {(mfConfig.autoDeactivationRules || []).map(rule => (
                  <div key={rule.id} className="bg-[#1e293b] p-6 rounded-[2rem] flex flex-col sm:flex-row items-center justify-between gap-6 group hover:bg-[#243147] transition-all border border-transparent hover:border-emerald-500/10">
                    <div className="flex-1 space-y-3">
                      <div className="flex flex-wrap gap-2">
                        {rule.roles.map(role => (
                          <span key={role} className="px-3 py-1 bg-emerald-500/10 text-emerald-500 rounded-lg text-[9px] font-black uppercase tracking-widest">
                            {role}
                          </span>
                        ))}
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="flex gap-1">
                          {['D', 'L', 'M', 'Me', 'J', 'V', 'S'].map(day => (
                            <span key={day} className={`text-[10px] font-black ${rule.days.includes(day) ? 'text-white' : 'text-gray-600'}`}>
                              {day}
                            </span>
                          ))}
                        </div>
                        <div className="w-1 h-1 rounded-full bg-gray-700"></div>
                        <span className="text-sm font-black text-emerald-500">{rule.startTime} — {rule.endTime}</span>
                      </div>
                    </div>
                    <button 
                      onClick={() => removeRule(rule.id)}
                      className="p-4 bg-red-500/10 text-red-500 rounded-2xl hover:bg-red-500 hover:text-white transition-all opacity-0 group-hover:opacity-100"
                    >
                      <Trash2 size={20} />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-end pt-4">
              <button 
                onClick={handleSaveMfConfig}
                className="bg-[#00c896] text-white px-12 py-6 rounded-3xl font-black text-xl uppercase tracking-widest shadow-lg hover:bg-[#00a87d] transition-all active:scale-95 flex items-center gap-4"
              >
                <Save size={24} />
                Enregistrer Tout le Planning
              </button>
            </div>
          </div>
        </div>

        {/* Section Sauvegarde */}
        <div className="bg-white rounded-[2rem] p-8 border border-gray-100 shadow-sm space-y-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-500 flex items-center justify-center">
              <Database size={24} />
            </div>
            <div>
              <h3 className="text-lg font-black text-[#121c32] uppercase tracking-tight">Sécurité des Données</h3>
              <p className="text-xs font-bold text-gray-600 uppercase tracking-widest">Backup & Restauration</p>
            </div>
          </div>

          <p className="text-sm text-gray-700 leading-relaxed">
            Il est fortement recommandé de sauvegarder régulièrement vos données localement pour éviter toute perte en cas de problème technique.
          </p>

          <div className="grid grid-cols-2 gap-4 pt-2">
            <button 
              onClick={handleBackup}
              className="flex flex-col items-center justify-center gap-3 p-6 bg-gray-50 hover:bg-gray-100 rounded-3xl transition-all group border border-transparent hover:border-gray-200"
            >
              <div className="w-10 h-10 rounded-full bg-white shadow-sm flex items-center justify-center text-gray-600 group-hover:text-emerald-500 transition-colors">
                <Download size={20} />
              </div>
              <span className="text-[10px] font-black uppercase tracking-widest text-[#121c32]">Backup</span>
            </button>

            <button 
              onClick={handleRestore}
              className="flex flex-col items-center justify-center gap-3 p-6 bg-gray-50 hover:bg-gray-100 rounded-3xl transition-all group border border-transparent hover:border-gray-200"
            >
              <div className="w-10 h-10 rounded-full bg-white shadow-sm flex items-center justify-center text-gray-600 group-hover:text-amber-500 transition-colors">
                <Upload size={20} />
              </div>
              <span className="text-[10px] font-black uppercase tracking-widest text-[#121c32]">Restore</span>
            </button>

            <button 
              onClick={handleResetAccounts}
              className="flex flex-col items-center justify-center gap-3 p-6 bg-red-50 hover:bg-red-100 rounded-3xl transition-all group border border-transparent hover:border-red-200 col-span-2"
            >
              <div className="w-10 h-10 rounded-full bg-white shadow-sm flex items-center justify-center text-red-600 group-hover:text-red-700 transition-colors">
                <Database size={20} />
              </div>
              <span className="text-[10px] font-black uppercase tracking-widest text-red-600">Remise à zéro complète</span>
            </button>
          </div>
        </div>

        {/* Section Paramètres */}
        <div className="bg-white rounded-[2rem] p-8 border border-gray-100 shadow-sm space-y-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-500 flex items-center justify-center">
              <Settings size={24} />
            </div>
            <div>
              <h3 className="text-lg font-black text-[#121c32] uppercase tracking-tight">Paramètres Généraux</h3>
              <p className="text-xs font-bold text-gray-600 uppercase tracking-widest">Personnalisation</p>
            </div>
          </div>

          <div className="space-y-4">
            <button 
              onClick={toggleOfflineMode}
              className="w-full flex items-center justify-between p-4 bg-gray-50 rounded-2xl transition-all hover:bg-gray-100"
            >
              <div className="flex items-center gap-3">
                <ShieldCheck size={18} className={isOfflineMode ? "text-emerald-500" : "text-gray-600"} />
                <span className="text-sm font-bold text-[#121c32]">Mode Hors-ligne</span>
              </div>
              <div className={`w-10 h-5 rounded-full relative transition-colors ${isOfflineMode ? 'bg-emerald-500' : 'bg-gray-300'}`}>
                <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${isOfflineMode ? 'right-1' : 'left-1'}`}></div>
              </div>
            </button>
            <p className="text-[10px] text-gray-600 italic">D'autres paramètres seront disponibles prochainement.</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Configuration;
