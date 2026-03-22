import React, { useState, useEffect } from 'react';
import { QrCode, TrendingUp, Search, Wallet, Cloud, CheckCircle, AlertCircle } from 'lucide-react';

const DailyTontine: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  
  // Persistance du total encaissé journalier
  const [totalEncaisse, setTotalEncaisse] = useState(() => {
    const saved = localStorage.getItem('microfox_total_encaisse_jour');
    return saved ? Number(saved) : 0;
  });

  const [cotisationAmounts, setCotisationAmounts] = useState<{[key: string]: string}>({});
  const [complementAmounts, setComplementAmounts] = useState<{[key: string]: string}>({});
  const [currentUser, setCurrentUser] = useState<any>(null);

  useEffect(() => {
    const user = localStorage.getItem('microfox_current_user');
    if (user) setCurrentUser(JSON.parse(user));
  }, []);

  // Chargement de la liste des clients depuis la base globale
  const [clientList, setClientList] = useState<any[]>([]);

  const loadTontineClients = () => {
    const savedMembers = localStorage.getItem('microfox_members_data');
    if (savedMembers) {
      const allMembers = JSON.parse(savedMembers);
      
      const savedUser = localStorage.getItem('microfox_current_user');
      const user = savedUser ? JSON.parse(savedUser) : {};
      
      let filteredAllMembers = allMembers;
      if (user.role === 'agent commercial' && user.zoneCollecte) {
        filteredAllMembers = allMembers.filter((m: any) => m.zone === user.zoneCollecte);
      } else if (user.role === 'caissier') {
        filteredAllMembers = allMembers.filter((m: any) => m.zone === '01');
      }

      // Filtrer pour n'afficher que les membres ayant au moins un compte tontine
      const tontiniers = filteredAllMembers
        .filter((m: any) => m.tontineAccounts && m.tontineAccounts.length > 0)
        .map((m: any) => {
          // Récupération de l'historique (soit depuis l'objet membre, soit depuis localStorage direct si besoin)
        let clientHistory = m.history || [];
        if (clientHistory.length === 0) {
          const savedHistory = localStorage.getItem(`microfox_history_${m.id}`);
          if (savedHistory) clientHistory = JSON.parse(savedHistory);
        }

        // Récupérer le montant cotisé aujourd'hui depuis l'historique
        const todayStr = new Date().toISOString().split('T')[0];
        const sessionCotise = clientHistory
          .filter((h: any) => h.account === 'tontine' && h.type === 'cotisation' && h.date.startsWith(todayStr) && !h.description?.toLowerCase().includes('livret'))
          .reduce((sum: number, h: any) => sum + h.amount, 0);

        const hasTontine = m.tontineAccounts && m.tontineAccounts.length > 0;
        
        const tontineDeposits = clientHistory
          .filter((h: any) => h.account === 'tontine' && (h.type === 'cotisation' || h.type === 'depot' || (h.type === 'transfert' && h.destinationAccount === 'tontine')) && !h.description?.toLowerCase().includes('livret'))
          .reduce((sum: number, h: any) => sum + h.amount, 0);
        const tontineWithdrawals = clientHistory
          .filter((h: any) => h.account === 'tontine' && (h.type === 'retrait' || (h.type === 'transfert' && h.account === 'tontine')))
          .reduce((sum: number, h: any) => sum + h.amount, 0);
        
        const grossBalance = Math.max(0, tontineDeposits - tontineWithdrawals);
        let canChangeMise = true;

        // Load pending and validated withdrawals to subtract from available
        const savedPending = localStorage.getItem('microfox_pending_withdrawals');
        const allPending = savedPending ? JSON.parse(savedPending).filter((r: any) => !r.isDeleted && r.clientId === m.id) : [];
        
        const savedValidated = localStorage.getItem('microfox_validated_withdrawals');
        const allValidated = savedValidated ? JSON.parse(savedValidated).filter((r: any) => !r.isDeleted && r.clientId === m.id) : [];
        
        const allRequests = [...allPending, ...allValidated];
        const pendingAmount = allRequests.reduce((sum: number, r: any) => sum + r.amount, 0);

        // Calcul de la commission pour déterminer le solde disponible
        let totalCommission = 0;
        if (hasTontine && grossBalance > 0) {
          const acc = m.tontineAccounts[0];
          const dailyMise = Number(acc.dailyMise) || 500;

          const accountHistory = clientHistory
            .filter((h: any) => h.account === 'tontine' && (h.tontineAccountId === acc.id || !h.tontineAccountId) && (h.type === 'cotisation' || h.type === 'depot') && !h.description?.toLowerCase().includes('livret'))
            .sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime());

          const accountWithdrawals = [
            ...clientHistory.filter((h: any) => h.account === 'tontine' && (h.tontineAccountId === acc.id || !h.tontineAccountId) && (h.type === 'retrait' || h.type === 'transfert')),
            ...allRequests.map(p => ({
              ...p,
              type: 'retrait',
              account: 'tontine',
              description: p.reason || `Retrait Tontine - ${p.amount} F`
            }))
          ].sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime());

          if (accountHistory.length > 0) {
            let currentCycleFirstDepositDate: Date | null = null;
            let currentCycleCases = 0;
            let currentCycleAmount = 0;
            let totalDecaissable = 0;
            let cycleIdx = 1;

            const accountWithdrawalsAmount = accountWithdrawals.reduce((sum: number, h: any) => sum + h.amount, 0);
            let remainingWithdrawals = accountWithdrawalsAmount;

            for (const tx of accountHistory) {
              const txDate = new Date(tx.date);
              let remainingAmount = tx.amount;

              while (remainingAmount > 0) {
                if (currentCycleFirstDepositDate === null) {
                  currentCycleFirstDepositDate = txDate;
                }
                const cycleEndDateLimit = new Date(currentCycleFirstDepositDate.getTime() + (31 * 24 * 60 * 60 * 1000));

                const withdrawalDuringCycle = accountWithdrawals.find((w: any) => {
                  const wDate = new Date(w.date);
                  return wDate >= currentCycleFirstDepositDate! && wDate < txDate;
                });

                if (txDate >= cycleEndDateLimit || withdrawalDuringCycle) {
                  const comm = currentCycleAmount > 0 ? dailyMise : 0;
                  const netCycleAmount = Math.max(0, currentCycleAmount - comm);
                  
                  let isRetire = false;
                  const specificWithdrawal = withdrawalDuringCycle || accountWithdrawals.find((h: any) => 
                    h.description.includes(`Cycles:`) && h.description.includes(`${cycleIdx}`) &&
                    new Date(h.date) >= currentCycleFirstDepositDate!
                  );

                  if (specificWithdrawal) {
                    isRetire = true;
                  } else if (remainingWithdrawals >= netCycleAmount && netCycleAmount > 0) {
                    const hasFutureWithdrawal = accountWithdrawals.some((w: any) => !w.description.includes('Cycles:') && new Date(w.date) >= currentCycleFirstDepositDate!);
                    if (hasFutureWithdrawal) {
                      isRetire = true;
                      remainingWithdrawals -= netCycleAmount;
                    }
                  }

                  if (!isRetire) totalDecaissable += netCycleAmount;
                  
                  currentCycleFirstDepositDate = txDate;
                  currentCycleCases = 0;
                  currentCycleAmount = 0;
                  cycleIdx++;
                  continue;
                }

                let casesToAdd = Math.floor(remainingAmount / dailyMise);
                let space = 31 - currentCycleCases;
                if (space <= 0) space = 31;

                if (casesToAdd >= space) {
                  const amountUsed = space * dailyMise;
                  currentCycleAmount += amountUsed;
                  currentCycleCases += space;
                  remainingAmount -= amountUsed;
                  
                  const comm = currentCycleAmount > 0 ? dailyMise : 0;
                  const netCycleAmount = Math.max(0, currentCycleAmount - comm);
                  
                  let isRetire = false;
                  const specificWithdrawal = accountWithdrawals.find((h: any) => 
                    h.description.includes(`Cycles:`) && h.description.includes(`${cycleIdx}`) &&
                    new Date(h.date) >= currentCycleFirstDepositDate!
                  );

                  if (specificWithdrawal) {
                    isRetire = true;
                  } else if (remainingWithdrawals >= netCycleAmount && netCycleAmount > 0) {
                    const hasFutureWithdrawal = accountWithdrawals.some((w: any) => !w.description.includes('Cycles:') && new Date(w.date) >= currentCycleFirstDepositDate!);
                    if (hasFutureWithdrawal) {
                      isRetire = true;
                      remainingWithdrawals -= netCycleAmount;
                    }
                  }

                  if (!isRetire) totalDecaissable += netCycleAmount;
                  
                  currentCycleFirstDepositDate = null;
                  currentCycleCases = 0;
                  currentCycleAmount = 0;
                  cycleIdx++;
                } else {
                  currentCycleAmount += remainingAmount;
                  currentCycleCases += casesToAdd;
                  remainingAmount = 0;
                }
              }
            }
            if (currentCycleFirstDepositDate) {
              const comm = currentCycleAmount > 0 ? Math.min(currentCycleAmount, dailyMise) : 0;
              const netCycleAmount = Math.max(0, currentCycleAmount - comm);
              
              let isRetire = false;
              const specificWithdrawal = accountWithdrawals.find((h: any) => 
                h.description.includes(`Cycles:`) && h.description.includes(`${cycleIdx}`)
              );

              if (specificWithdrawal) {
                isRetire = true;
              } else if (remainingWithdrawals >= netCycleAmount && netCycleAmount > 0) {
                const hasFutureWithdrawal = accountWithdrawals.some((w: any) => !w.description.includes('Cycles:') && new Date(w.date) >= currentCycleFirstDepositDate!);
                if (hasFutureWithdrawal) {
                  isRetire = true;
                }
              }

              if (!isRetire) totalDecaissable += netCycleAmount;

              // Restoring canChangeMise logic
              const now = new Date();
              const startMonth = currentCycleFirstDepositDate.getMonth();
              const startYear = currentCycleFirstDepositDate.getFullYear();
              const currentMonth = now.getMonth();
              const currentYear = now.getFullYear();
              
              if (startMonth !== currentMonth || startYear !== currentYear) {
                canChangeMise = false;
              }
            }
            totalCommission = Math.max(0, totalDecaissable); 
          }
        }

        return {
          id: m.id,
          name: m.name,
          code: m.code,
          accountNumber: hasTontine ? m.tontineAccounts[0].number : 'SANS COMPTE',
          dailyMise: hasTontine ? m.tontineAccounts[0].dailyMise : 0,
          tontineBalance: grossBalance,
          availableBalance: totalCommission, // This is now the sum of decaissable
          cotiseJour: sessionCotise,
          canChangeMise,
          zone: m.zone
        };
      });
      setClientList(tontiniers);
      
      // Calculer le total encaissé du jour à partir des cotisations réelles
      const totalToday = tontiniers.reduce((sum: number, t: any) => sum + (t.cotiseJour || 0), 0);
      setTotalEncaisse(totalToday);

      // Initialiser les montants de saisie par défaut à 0
      const defaultAmounts: {[key: string]: string} = {};
      const defaultComplements: {[key: string]: string} = {};
      tontiniers.forEach((t: any) => {
        if (!cotisationAmounts[t.id]) {
          defaultAmounts[t.id] = "0";
        }
        if (!complementAmounts[t.id]) {
          defaultComplements[t.id] = "0";
        }
      });
      setCotisationAmounts(prev => ({ ...prev, ...defaultAmounts }));
      setComplementAmounts(prev => ({ ...prev, ...defaultComplements }));
    }
  };

  useEffect(() => {
    loadTontineClients();
    window.addEventListener('storage', loadTontineClients);
    return () => window.removeEventListener('storage', loadTontineClients);
  }, []);

  // Mise à jour de localStorage lors des changements d'état
  useEffect(() => {
    localStorage.setItem('microfox_total_encaisse_jour', totalEncaisse.toString());
    localStorage.setItem('microfox_pending_sync', 'true');
  }, [totalEncaisse]);

  useEffect(() => {
    if (clientList.length > 0) {
      localStorage.setItem('microfox_tontine_clients', JSON.stringify(clientList));
      localStorage.setItem('microfox_pending_sync', 'true');
    }
  }, [clientList]);

  const handleUpdateMise = (clientId: string, newMise: number) => {
    if (newMise < 0) return;

    const client = clientList.find(c => c.id === clientId);
    if (client) {
      if (!client.canChangeMise) {
        setErrorMessage("Modification impossible : La mise ne peut être changée qu'au cours du premier mois du cycle.");
        setTimeout(() => setErrorMessage(null), 5000);
        return;
      }

      // Récupérer les montants saisis pour le calcul du solde projeté
      const cotisation = Number(cotisationAmounts[clientId] || 0);
      const complement = Number(complementAmounts[clientId] || 0);
      const projectedBalance = client.tontineBalance + cotisation + complement;
    }

    const savedMembers = localStorage.getItem('microfox_members_data');
    if (savedMembers) {
      const allMembers = JSON.parse(savedMembers);
      const updatedMembers = allMembers.map((m: any) => {
        if (m.id === clientId) {
          if (m.tontineAccounts && m.tontineAccounts.length > 0) {
            const updatedTontineAccounts = [...m.tontineAccounts];
            updatedTontineAccounts[0] = { ...updatedTontineAccounts[0], dailyMise: newMise };
            return { ...m, tontineAccounts: updatedTontineAccounts };
          }
        }
        return m;
      });
      localStorage.setItem('microfox_members_data', JSON.stringify(updatedMembers));
      localStorage.setItem('microfox_pending_sync', 'true');
      window.dispatchEvent(new Event('storage'));
    }
  };

  const handleEncaisser = (client: any) => {
    if (client.dailyMise <= 0) {
      setErrorMessage("Opération impossible : Ce client n'a pas de compte tontine configuré.");
      setTimeout(() => setErrorMessage(null), 5000);
      return;
    }

    const amountStr = cotisationAmounts[client.id] || "0";
    const complementStr = complementAmounts[client.id] || "0";
    const amount = Number(amountStr) + Number(complementStr);
    const cotisation = Number(amountStr);
    const complement = Number(complementStr);
    
    const agentName = (currentUser?.identifiant || 'N/A').trim();
    const description = complement > 0 
      ? (cotisation > 0 ? `Collecte journalière + Complément - Agent ${agentName}` : `Complément de mise - Agent ${agentName}`)
      : `Collecte journalière - Agent ${agentName}`;
    
    if (amount <= 0) {
      setErrorMessage("Opération refusée : Le montant doit être supérieur à 0.");
      setTimeout(() => setErrorMessage(null), 5000);
      return;
    }

    if (cotisation > 0 && cotisation % client.dailyMise !== 0) {
      setErrorMessage(`Opération refusée : Le montant de la cotisation (${cotisation} F) doit être un multiple de la mise journalière (${client.dailyMise} F).`);
      setTimeout(() => setErrorMessage(null), 5000);
      return;
    }

    const nextBalance = client.tontineBalance + amount;

    // 1. Mise à jour dans microfox_members_data (Source de vérité globale)
    const savedMembers = localStorage.getItem('microfox_members_data');
    if (savedMembers) {
      const allMembers = JSON.parse(savedMembers);
      const updatedMembers = allMembers.map((m: any) => {
        if (m.id === client.id) {
          const newTx = {
            id: Date.now().toString(),
            type: 'cotisation',
            account: 'tontine',
            tontineAccountId: m.tontineAccounts[0].id,
            amount: amount,
            date: new Date().toISOString(),
            description: description,
            userId: currentUser?.id
          };

          const updatedTontineAccounts = m.tontineAccounts.map((ta: any) => {
            if (ta.number === client.accountNumber) {
              return { ...ta, balance: ta.balance + amount };
            }
            return ta;
          });

          return {
            ...m,
            balances: { ...m.balances, tontine: nextBalance },
            tontineAccounts: updatedTontineAccounts,
            history: [newTx, ...(m.history || [])]
          };
        }
        return m;
      });
      localStorage.setItem('microfox_members_data', JSON.stringify(updatedMembers));
      localStorage.setItem('microfox_pending_sync', 'true');
      
      // 2. Mise à jour de l'historique spécifique
      const historyKey = `microfox_history_${client.id}`;
      const savedHistory = localStorage.getItem(historyKey);
      let history = savedHistory ? JSON.parse(savedHistory) : [];
      const newTx = {
        id: Date.now().toString(),
        type: 'cotisation',
        account: 'tontine',
        tontineAccountId: client.accountNumber.startsWith('TN') ? client.accountNumber : `${client.id}_tn_0`,
        amount: amount,
        date: new Date().toISOString(),
        description: description,
        userId: currentUser?.id
      };
      localStorage.setItem(historyKey, JSON.stringify([newTx, ...history]));
      localStorage.setItem('microfox_pending_sync', 'true');

      // 3. Mise à jour des soldes (Caisse ou Agent)
      const targetCaisse = currentUser?.role === 'agent commercial' ? null : (currentUser?.caisse || (currentUser?.role === 'administrateur' ? 'CAISSE PRINCIPALE' : null));
      if (targetCaisse) {
        const cashKey = `microfox_cash_balance_${targetCaisse}`;
        const currentCashBalance = Number(localStorage.getItem(cashKey) || 0);
        localStorage.setItem(cashKey, (currentCashBalance + amount).toString());
      } else if (currentUser?.role === 'agent commercial') {
        const agentBalanceKey = `microfox_agent_balance_${currentUser.id}`;
        const currentAgentBalance = Number(localStorage.getItem(agentBalanceKey) || 0);
        localStorage.setItem(agentBalanceKey, (currentAgentBalance + amount).toString());
      }

      window.dispatchEvent(new Event('storage'));
      loadTontineClients();
    }

    setCotisationAmounts(prev => ({ ...prev, [client.id]: "0" }));
    setComplementAmounts(prev => ({ ...prev, [client.id]: "0" }));
    setSuccessMessage(`Encaissement de ${amount} F effectué avec succès pour ${client.name}`);
    setTimeout(() => setSuccessMessage(null), 4000);
  };

  const filteredClients = clientList.filter((c: any) => {
    // La liste clientList est déjà filtrée dans loadTontineClients par zone pour l'agent,
    // mais nous gardons cette sécurité supplémentaire ici.
    if (currentUser?.role === 'agent commercial' && currentUser?.zoneCollecte) {
      if (c.zone !== currentUser.zoneCollecte) return false;
    }

    return c.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
           c.code.toLowerCase().includes(searchTerm.toLowerCase());
  });

  const today = new Date().toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-12">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div className="flex items-start gap-3">
          <div className="mt-1 text-[#00c896]">
            <Wallet size={24} />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold text-white uppercase tracking-tight leading-tight">
              Collecte Tontine<br />Journalière
            </h1>
            <p className="text-gray-400 font-medium text-sm mt-1">{today}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-500/10 text-emerald-400 rounded-lg border border-emerald-500/20 text-xs font-bold">
          <Cloud size={16} />
          <span>CLOUD</span>
        </div>
      </div>

      {/* Action Cards */}
      <div className="grid grid-cols-2 gap-4">
        <button type="button" className="bg-[#121c32] rounded-[1.5rem] p-6 text-white flex flex-col items-center justify-center gap-3 shadow-lg active:scale-95 transition-all">
          <QrCode size={32} />
          <span className="font-bold text-center uppercase tracking-tight text-sm">Scanner<br />Client</span>
        </button>
        <div className="bg-[#009664] rounded-[1.5rem] p-6 text-white flex flex-col items-center justify-center gap-1 shadow-lg">
          <p className="text-[10px] font-bold uppercase tracking-widest opacity-80">TOTAL ENCAISSÉ JOUR</p>
          <div className="flex items-center gap-2 mt-1">
            <TrendingUp size={20} />
            <span className="text-3xl font-black">{totalEncaisse.toLocaleString()} F</span>
          </div>
        </div>
      </div>

      {/* Success Message Banner */}
      {successMessage && (
        <div className="bg-[#00c896] text-white p-4 rounded-2xl flex items-center justify-center gap-3 shadow-xl animate-in fade-in slide-in-from-top-4 duration-300">
          <CheckCircle size={20} />
          <span className="font-black uppercase tracking-tight text-sm text-center">{successMessage}</span>
        </div>
      )}

      {/* Error Message Banner */}
      {errorMessage && (
        <div className="bg-red-500 text-white p-4 rounded-2xl flex items-center justify-center gap-3 shadow-xl animate-in fade-in slide-in-from-top-4 duration-300">
          <AlertCircle size={20} />
          <span className="font-black uppercase tracking-tight text-sm text-center">{errorMessage}</span>
        </div>
      )}

      {/* Search Bar */}
      <div className="bg-[#121c32] p-4 rounded-[1.5rem] shadow-sm border border-gray-800">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" size={20} />
          <input 
            type="text" 
            placeholder="Rechercher par nom ou code..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-12 pr-4 py-4 bg-[#0a1226] text-white rounded-2xl font-medium outline-none placeholder:text-gray-600 border border-gray-800 focus:border-emerald-500 transition-all"
          />
        </div>
      </div>

      {/* Table Section */}
      <div className="bg-[#121c32] rounded-[1.5rem] shadow-sm border border-gray-800 overflow-hidden">
        <div className="overflow-x-auto scrollbar-hide">
          <table className="w-full text-left min-w-[900px]">
            <thead>
              <tr className="border-b border-gray-800">
                <th className="px-4 py-4 text-[10px] font-black text-gray-500 uppercase tracking-widest">CLIENT / COMPTE</th>
                <th className="px-4 py-4 text-[10px] font-black text-gray-500 uppercase tracking-widest text-center">MISE</th>
                <th className="px-4 py-4 text-[10px] font-black text-gray-500 uppercase tracking-widest">SOLDE DISPONIBLE</th>
                <th className="px-4 py-4 text-[10px] font-black text-gray-500 uppercase tracking-widest">SOLDE DÉCAISSABLE</th>
                <th className="px-4 py-4 text-[10px] font-black text-gray-500 uppercase tracking-widest">COTISÉ JOUR</th>
                <th className="px-4 py-4 text-[10px] font-black text-gray-500 uppercase tracking-widest">COMPLÉMENT</th>
                <th className="px-4 py-4 text-[10px] font-black text-gray-500 uppercase tracking-widest">MISE JOUR</th>
                <th className="px-4 py-4 text-[10px] font-black text-gray-500 uppercase tracking-widest text-right">ACTION COLLECTE</th>
              </tr>
            </thead>
            <tbody>
              {filteredClients.length > 0 ? (
                filteredClients.map((client: any) => (
                  <tr key={client.id} className="border-b border-gray-800/50 hover:bg-white/5 transition-colors">
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-[#00c896] flex items-center justify-center text-white font-black text-xs shrink-0">
                          {client.name.split(' ').map((n: string) => n[0]).join('')}
                        </div>
                        <div className="flex flex-col min-w-0">
                          <span className="text-sm font-black text-white uppercase truncate max-w-[150px]">{client.name}</span>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-bold text-gray-500">{client.code}</span>
                            <span className="text-[10px] font-black text-emerald-400 bg-emerald-500/10 px-1.5 rounded">{client.accountNumber}</span>
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4 text-center">
                      <div className={`flex items-center gap-2 px-2 py-1 rounded-lg border w-24 mx-auto transition-all ${
                        client.canChangeMise 
                          ? "bg-amber-500/5 border-amber-500/20 focus-within:border-amber-500" 
                          : "bg-gray-800/50 border-gray-800 opacity-60 cursor-not-allowed"
                      }`}>
                        <input 
                          type="number" 
                          value={client.dailyMise} 
                          onChange={(e) => handleUpdateMise(client.id, Number(e.target.value))}
                          disabled={!client.canChangeMise}
                          className={`w-full bg-transparent text-sm font-black outline-none text-center ${
                            client.canChangeMise ? "text-amber-400" : "text-gray-500"
                          }`}
                        />
                        <span className={`text-[10px] font-bold ${client.canChangeMise ? "text-amber-600" : "text-gray-600"}`}>F</span>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <span className="text-sm font-black text-white whitespace-nowrap">{client.tontineBalance.toLocaleString()} F</span>
                    </td>
                    <td className="px-4 py-4">
                      <span className="text-sm font-black text-blue-400 whitespace-nowrap">{client.availableBalance.toLocaleString()} F</span>
                    </td>
                    <td className="px-4 py-4">
                      <span className="text-sm font-black text-orange-400 whitespace-nowrap">{(client.cotiseJour || 0).toLocaleString()} F</span>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-2 bg-blue-500/5 px-3 py-2 rounded-xl w-40 border border-blue-500/20 focus-within:border-blue-500 focus-within:bg-blue-500/10 transition-all">
                        <input 
                          type="number" 
                          value={complementAmounts[client.id] || ''} 
                          onChange={(e) => setComplementAmounts({...complementAmounts, [client.id]: e.target.value})}
                          className="w-full bg-transparent text-sm font-black text-blue-400 outline-none"
                        />
                        <span className="text-[10px] font-bold text-blue-600">F</span>
                        <button 
                          type="button"
                          onClick={() => handleEncaisser(client)}
                          className="p-1 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all active:scale-90 shrink-0"
                        >
                          <CheckCircle size={14} />
                        </button>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-2 bg-white/5 px-3 py-2 rounded-xl w-32 border border-gray-800 focus-within:border-[#00c896] focus-within:bg-white/10 transition-all">
                        <input 
                          type="number" 
                          value={cotisationAmounts[client.id] || ''} 
                          onChange={(e) => setCotisationAmounts({...cotisationAmounts, [client.id]: e.target.value})}
                          className="w-full bg-transparent text-sm font-black text-white outline-none"
                        />
                        <span className="text-[10px] font-bold text-gray-600">F</span>
                      </div>
                    </td>
                    <td className="px-4 py-4 text-right">
                      <button 
                        type="button"
                        onClick={() => handleEncaisser(client)}
                        className="bg-[#00c896] text-white px-5 py-2.5 rounded-xl font-black text-xs uppercase tracking-tight shadow-md active:scale-95 transition-all whitespace-nowrap"
                      >
                        Encaisser
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={8} className="px-6 py-24 text-center">
                    <p className="text-sm font-bold text-gray-500 italic">
                      Aucun client trouvé pour cette recherche.
                    </p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default DailyTontine;