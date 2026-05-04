import React, { useState, useEffect } from 'react';
import { dispatchStorageEvent } from '../utils/events';
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
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);

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
      if (user.role === 'agent commercial') {
        const agentZones = user.zonesCollecte || (user.zoneCollecte ? [user.zoneCollecte] : []);
        if (agentZones.length > 0) {
          filteredAllMembers = allMembers.filter((m: any) => agentZones.includes(m.zone));
        }
      } else if (user.role === 'caissier') {
        filteredAllMembers = allMembers.filter((m: any) => m.zone === '01');
      }

      // Filtrer pour n'afficher que les membres ayant au moins un compte tontine
      const tontiniers = filteredAllMembers
        .filter((m: any) => m.tontineAccounts && m.tontineAccounts.length > 0)
        .flatMap((m: any) => {
          // Filtrer les comptes tontine invisibles pour les caissiers et agents
          const accountsToProcess = (user.role === 'caissier' || user.role === 'agent commercial') 
            ? m.tontineAccounts.filter((acc: any) => !acc.isInvisible)
            : m.tontineAccounts;

          if (accountsToProcess.length === 0) return [];

          // Récupération de l'historique
          const savedHistory = localStorage.getItem(`microfox_history_${m.id}`);
          let clientHistory = savedHistory ? JSON.parse(savedHistory) : (m.history || []);

          // Load pending and validated withdrawals
          const savedPending = localStorage.getItem('microfox_pending_withdrawals');
          const allPending = savedPending ? JSON.parse(savedPending).filter((r: any) => !r.isDeleted && r.clientId === m.id) : [];
          
          const savedValidated = localStorage.getItem('microfox_validated_withdrawals');
          const allValidated = savedValidated ? JSON.parse(savedValidated).filter((r: any) => !r.isDeleted && r.clientId === m.id) : [];
          
          const allRequests = [...allPending, ...allValidated];

          return accountsToProcess.map((acc: any, index: number) => {
            const accountId = acc.id || `${m.id}_tn_${index + 1}`;
            const todayStr = new Date().toISOString().split('T')[0];
            const isFirstAccount = index === 0;

            const sessionCotise = clientHistory
              .filter((h: any) => h.account === 'tontine' && (
                h.tontineAccountId === accountId || 
                h.tontineAccountNumber === acc.number ||
                (!h.tontineAccountId && !h.tontineAccountNumber && (
                  (isFirstAccount && (!h.description?.includes('Compte:') || (acc.number && h.description?.includes(acc.number)))) ||
                  (acc.number && h.description?.includes(acc.number))
                ))
              ) && h.type === 'cotisation' && h.date.startsWith(todayStr) && !h.description?.toLowerCase().includes('livret'))
              .reduce((sum: number, h: any) => sum + h.amount, 0);

            const tontineDeposits = clientHistory
              .filter((h: any) => ((h.account === 'tontine' && (
                h.tontineAccountId === accountId || 
                h.tontineAccountNumber === acc.number ||
                (!h.tontineAccountId && !h.tontineAccountNumber && (
                  (isFirstAccount && (!h.description?.includes('Compte:') || (acc.number && h.description?.includes(acc.number)))) ||
                  (acc.number && h.description?.includes(acc.number))
                ))
              ) && (h.type === 'cotisation' || h.type === 'depot')) || (h.type === 'transfert' && h.destinationAccount === 'tontine' && (
                h.tontineAccountId === accountId || 
                h.tontineAccountNumber === acc.number ||
                (!h.tontineAccountId && !h.tontineAccountNumber && (
                  (isFirstAccount && (!h.description?.includes('Compte:') || (acc.number && h.description?.includes(acc.number)))) ||
                  (acc.number && h.description?.includes(acc.number))
                ))
              ))) && !h.description?.toLowerCase().includes('livret'))
              .reduce((sum: number, h: any) => sum + h.amount, 0);
            
            const tontineWithdrawals = clientHistory
              .filter((h: any) => (h.account === 'tontine' && (
                h.tontineAccountId === accountId || 
                h.tontineAccountNumber === acc.number ||
                (!h.tontineAccountId && !h.tontineAccountNumber && (
                  (isFirstAccount && (!h.description?.includes('Compte:') || (acc.number && h.description?.includes(acc.number)))) ||
                  (acc.number && h.description?.includes(acc.number))
                ))
              ) && (h.type === 'retrait' || h.type === 'transfert')))
              .reduce((sum: number, h: any) => sum + h.amount, 0);
            
            const grossBalance = Math.max(0, tontineDeposits - tontineWithdrawals);
            let canChangeMise = true;

            const accountRequests = allRequests.filter((r: any) => r.tontineAccountId === accountId || (isFirstAccount && !r.tontineAccountId));
            const pendingAmount = accountRequests.reduce((sum: number, r: any) => sum + r.amount, 0);

            // Calcul de la commission
            let totalCommission = 0;
            let totalCommissionsPaid = 0;
            const dailyMise = Number(acc.dailyMise) || 500;

            if (grossBalance > 0) {
              const accountHistory = clientHistory
                .filter((h: any) => ((h.account === 'tontine' && (
                  h.tontineAccountId === accountId || 
                  h.tontineAccountNumber === acc.number ||
                  (!h.tontineAccountId && !h.tontineAccountNumber && (
                    (isFirstAccount && (!h.description?.includes('Compte:') || (acc.number && h.description?.includes(acc.number)))) ||
                    (acc.number && h.description?.includes(acc.number))
                  ))
                ) && (h.type === 'cotisation' || h.type === 'depot')) || (h.type === 'transfert' && h.destinationAccount === 'tontine' && (
                  h.tontineAccountId === accountId || 
                  h.tontineAccountNumber === acc.number ||
                  (!h.tontineAccountId && !h.tontineAccountNumber && (
                    (isFirstAccount && (!h.description?.includes('Compte:') || (acc.number && h.description?.includes(acc.number)))) ||
                    (acc.number && h.description?.includes(acc.number))
                  ))
                ))) && !h.description?.toLowerCase().includes('livret'))
                .sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime());

              const accountWithdrawals = [
                ...clientHistory.filter((h: any) => h.account === 'tontine' && (
                  h.tontineAccountId === accountId || 
                  h.tontineAccountNumber === acc.number ||
                  (!h.tontineAccountId && !h.tontineAccountNumber && (
                    (isFirstAccount && (!h.description?.includes('Compte:') || (acc.number && h.description?.includes(acc.number)))) ||
                    (acc.number && h.description?.includes(acc.number))
                  ))
                ) && (h.type === 'retrait' || h.type === 'transfert')),
                ...accountRequests.filter((p: any) => p.tontineAccountId === acc.id || p.tontineAccountNumber === acc.number || (isFirstAccount && !p.tontineAccountId && !p.tontineAccountNumber)).map((p: any) => ({
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
                totalCommissionsPaid = 0;

                const accountWithdrawalsAmount = accountWithdrawals.reduce((sum: number, h: any) => sum + h.amount, 0);
                let remainingWithdrawals = accountWithdrawalsAmount;
                const usedWithdrawalIds = new Set<string>();

                for (const tx of accountHistory) {
                  const txDate = new Date(tx.date);
                  let remainingAmount = Number(tx.amount);

                  while (remainingAmount > 0) {
                    if (currentCycleFirstDepositDate === null) {
                      // Gérer les retraits qui ont eu lieu AVANT ce dépôt et qui doivent clôturer les cycles précédents
                      let priorWithdrawal;
                      while (priorWithdrawal = accountWithdrawals.find((w: any) => {
                        if (usedWithdrawalIds.has(w.id)) return false;
                        if (new Date(w.date) >= txDate) return false;
                        const matches = w.description.match(/Cycles: ([\d, ]+)/);
                        if (matches) {
                          const indices = matches[1].split(',').map((s: string) => parseInt(s.trim()));
                          return indices.includes(cycleIdx);
                        }
                        return true;
                      })) {
                        usedWithdrawalIds.add(priorWithdrawal.id);
                        cycleIdx++;
                      }
                      currentCycleFirstDepositDate = txDate;
                    }
                    // On traite d'abord l'ajout du montant au cycle en cours
                    const amountToCompleteCycle = (31 * Number(dailyMise)) - currentCycleAmount;
                    const oldCases = currentCycleCases;

                    if (remainingAmount >= amountToCompleteCycle) {
                      currentCycleAmount = Number(currentCycleAmount) + amountToCompleteCycle;
                      currentCycleCases = 31;
                      remainingAmount -= amountToCompleteCycle;
                    } else {
                      currentCycleAmount = Number(currentCycleAmount) + remainingAmount;
                      const newCases = Math.floor(currentCycleAmount / Number(dailyMise));
                      currentCycleCases = newCases;
                      remainingAmount = 0;
                    }

                    // Ensuite on vérifie si le cycle doit être clôturé (expiration ou retrait)
                    const cycleEndDateLimit = new Date(currentCycleFirstDepositDate.getTime() + (31 * 24 * 60 * 60 * 1000));
                    const withdrawalDuringCycle = accountWithdrawals.find((w: any) => {
                      const wDate = new Date(w.date);
                      const isSameDay = wDate.toDateString() === txDate.toDateString();
                      return !usedWithdrawalIds.has(w.id) && (isSameDay || (wDate >= currentCycleFirstDepositDate! && wDate <= txDate));
                    });

                    if (txDate >= cycleEndDateLimit || withdrawalDuringCycle || currentCycleCases === 31) {
                      if (withdrawalDuringCycle) usedWithdrawalIds.add(withdrawalDuringCycle.id);
                      const comm = currentCycleAmount > 0 ? dailyMise : 0;
                      totalCommissionsPaid += comm;
                      const netCycleAmount = Math.max(0, currentCycleAmount - comm);
                      
                      let isRetire = false;
                      const specificWithdrawal = withdrawalDuringCycle || accountWithdrawals.find((h: any) => {
                        if (usedWithdrawalIds.has(h.id)) return false;
                        const matches = h.description.match(/Cycles: ([\d, ]+)/);
                        if (matches) {
                          const indices = matches[1].split(',').map(s => parseInt(s.trim()));
                          return indices.includes(cycleIdx);
                        }
                        return false;
                      });

                      if (specificWithdrawal) {
                        usedWithdrawalIds.add(specificWithdrawal.id);
                        isRetire = true;
                        remainingWithdrawals = Math.max(0, remainingWithdrawals - specificWithdrawal.amount);
                      } else if (remainingWithdrawals >= netCycleAmount && netCycleAmount > 0) {
                        const fallbackWithdrawal = accountWithdrawals.find(w => !usedWithdrawalIds.has(w.id) && !w.description.includes('Cycles:'));
                        if (fallbackWithdrawal) {
                          usedWithdrawalIds.add(fallbackWithdrawal.id);
                          isRetire = true;
                          remainingWithdrawals -= netCycleAmount;
                        }
                      }

                      if (!isRetire) {
                        totalDecaissable += netCycleAmount;
                      }
                      
                      currentCycleFirstDepositDate = remainingAmount > 0 ? txDate : null;
                      currentCycleCases = 0;
                      currentCycleAmount = 0;
                      cycleIdx++;
                    }
                  }
                }
                if (currentCycleFirstDepositDate) {
                  const comm = currentCycleAmount > 0 ? Math.min(currentCycleAmount, dailyMise) : 0;
                  totalCommissionsPaid += comm;
                  const netCycleAmount = Math.max(0, currentCycleAmount - comm);
                  
                  let isRetire = false;
                  const specificWithdrawal = accountWithdrawals.find((h: any) => 
                    !usedWithdrawalIds.has(h.id) && h.description.includes(`Cycles:`) && h.description.includes(`${cycleIdx}`) &&
                    new Date(h.date) >= currentCycleFirstDepositDate!
                  );

                  if (specificWithdrawal) {
                    usedWithdrawalIds.add(specificWithdrawal.id);
                    isRetire = true;
                    remainingWithdrawals = Math.max(0, remainingWithdrawals - specificWithdrawal.amount);
                  } else if (remainingWithdrawals >= netCycleAmount && netCycleAmount > 0) {
                    const hasFutureWithdrawal = accountWithdrawals.find((w: any) => !usedWithdrawalIds.has(w.id) && !w.description.includes('Cycles:') && new Date(w.date) >= currentCycleFirstDepositDate!);
                    if (hasFutureWithdrawal) {
                      usedWithdrawalIds.add(hasFutureWithdrawal.id);
                      isRetire = true;
                      remainingWithdrawals -= netCycleAmount;
                    }
                  }

                  if (!isRetire) {
                    totalDecaissable += netCycleAmount;
                  }

                  const now = new Date();
                  const startMonth = currentCycleFirstDepositDate.getMonth();
                  const startYear = currentCycleFirstDepositDate.getFullYear();
                  const currentMonth = now.getMonth();
                  const currentYear = now.getFullYear();
                  
                  if (startMonth !== currentMonth || startYear !== currentYear) {
                    canChangeMise = false;
                  }
                }
                totalCommission = Math.max(0, totalDecaissable - remainingWithdrawals);
              }
            }

            return {
              id: `${m.id}_${accountId}`,
              clientId: m.id,
              name: m.name,
              code: m.code,
              tontineAccountId: accountId,
              accountNumber: acc.number,
              dailyMise: acc.dailyMise,
              tontineBalance: grossBalance,
              availableBalance: Math.max(0, grossBalance - totalCommissionsPaid),
              cotiseJour: sessionCotise,
              canChangeMise,
              zone: m.zone
            };
          });
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
    window.addEventListener('microfox_storage' as any, loadTontineClients);
    return () => window.removeEventListener('storage', loadTontineClients);
      window.removeEventListener('microfox_storage' as any, loadTontineClients);
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
    if (!client) return;

    if (!client.canChangeMise) {
      setErrorMessage("Modification impossible : La mise ne peut être changée qu'au cours du premier mois du cycle.");
      setTimeout(() => setErrorMessage(null), 5000);
      return;
    }

    const savedMembers = localStorage.getItem('microfox_members_data');
    if (savedMembers) {
      const allMembers = JSON.parse(savedMembers);
      const updatedMembers = allMembers.map((m: any) => {
        if (m.id === client.clientId) {
          if (m.tontineAccounts && m.tontineAccounts.length > 0) {
            const updatedTontineAccounts = m.tontineAccounts.map((acc: any) => {
              if (acc.id === client.tontineAccountId) {
                return { ...acc, dailyMise: newMise };
              }
              return acc;
            });
            return { ...m, tontineAccounts: updatedTontineAccounts };
          }
        }
        return m;
      });
      localStorage.setItem('microfox_members_data', JSON.stringify(updatedMembers));
      localStorage.setItem('microfox_pending_sync', 'true');
      dispatchStorageEvent();
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
    const accountInfo = client.accountNumber ? ` (Compte: ${client.accountNumber})` : '';
    const description = complement > 0 
      ? (cotisation > 0 ? `Collecte journalière + Complément - Agent ${agentName}${accountInfo}` : `Complément de mise - Agent ${agentName}${accountInfo}`)
      : `Collecte journalière - Agent ${agentName}${accountInfo}`;
    
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
      const savedUsers = JSON.parse(localStorage.getItem('microfox_users') || '[]');
      const agentForZone = savedUsers.find((u: any) => {
        if (u.role !== 'agent commercial') return false;
        const agentZones = u.zonesCollecte || (u.zoneCollecte ? [u.zoneCollecte] : []);
        return agentZones.includes(client.zone);
      });
      const agentNameForZone = agentForZone ? agentForZone.identifiant : (currentUser?.identifiant || 'N/A');

      let createdTx: any = null;
      const updatedMembers = allMembers.map((m: any) => {
        if (m.id === client.clientId) {
          // Ensure all accounts have IDs for consistent matching
          const accountsWithIds = (m.tontineAccounts || []).map((acc: any, idx: number) => ({
            ...acc,
            id: acc.id || `${m.id}_tn_${idx + 1}`
          }));

          // Load full history to avoid losing it when updating members data
          const savedHistory = localStorage.getItem(`microfox_history_${m.id}`);
          let fullHistory = savedHistory ? JSON.parse(savedHistory) : (m.history || []);

          const targetAccountId = client.tontineAccountId;
          const targetAccount = accountsWithIds.find((a: any) => a.id === targetAccountId);

          createdTx = {
            id: `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            type: 'cotisation',
            account: 'tontine',
            tontineAccountId: targetAccountId,
            tontineAccountNumber: targetAccount?.number,
            amount: amount,
            date: new Date().toISOString(),
            description: description,
            userId: currentUser?.id,
            cashierName: agentNameForZone,
            caisse: currentUser?.role === 'agent commercial' ? 'AGENT' : (currentUser?.caisse || (currentUser?.role === 'administrateur' || currentUser?.role === 'directeur' ? 'CAISSE PRINCIPALE' : 'N/A')),
            balanceBefore: targetAccount?.balance || 0,
            balance: (targetAccount?.balance || 0) + amount
          };

          const updatedTontineAccounts = accountsWithIds.map((ta: any) => {
            if (ta.id === targetAccountId) {
              return { ...ta, balance: ta.balance + amount };
            }
            return ta;
          });

          const newHistory = [createdTx, ...fullHistory];
          localStorage.setItem(`microfox_history_${m.id}`, JSON.stringify(newHistory));

          return {
            ...m,
            balances: { ...m.balances, tontine: (m.balances?.tontine || 0) + amount },
            tontineAccounts: updatedTontineAccounts,
            history: newHistory
          };
        }
        return m;
      });
      localStorage.setItem('microfox_members_data', JSON.stringify(updatedMembers));
      localStorage.setItem('microfox_pending_sync', 'true');
      
      // 3. Mise à jour des soldes (Caisse ou Agent)
      const targetCaisse = currentUser?.role === 'agent commercial' ? null : (currentUser?.caisse || (currentUser?.role === 'administrateur' || currentUser?.role === 'directeur' ? 'CAISSE PRINCIPALE' : null));
      if (targetCaisse) {
        const cashKey = `microfox_cash_balance_${targetCaisse}`;
        const currentCashBalance = Number(localStorage.getItem(cashKey) || 0);
        localStorage.setItem(cashKey, (currentCashBalance + amount).toString());
      } else if (currentUser?.role === 'agent commercial') {
        const agentBalanceKey = `microfox_agent_balance_${currentUser.id}`;
        const currentAgentBalance = Number(localStorage.getItem(agentBalanceKey) || 0);
        localStorage.setItem(agentBalanceKey, (currentAgentBalance + amount).toString());
      }

      dispatchStorageEvent();
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
    if (currentUser?.role === 'agent commercial') {
      const agentZones = currentUser.zonesCollecte || (currentUser.zoneCollecte ? [currentUser.zoneCollecte] : []);
      if (agentZones.length > 0 && !agentZones.includes(c.zone)) return false;
    }

    return c.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
           c.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
           c.accountNumber.toLowerCase().includes(searchTerm.toLowerCase());
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
            placeholder="Rechercher par nom, code ou numéro tontine..." 
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
                <th className="px-4 py-4 text-[10px] font-black text-gray-500 uppercase tracking-widest">SOLDE BRUT</th>
                <th className="px-4 py-4 text-[10px] font-black text-gray-500 uppercase tracking-widest">SOLDE NET</th>
                <th className="px-4 py-4 text-[10px] font-black text-gray-500 uppercase tracking-widest">COTISÉ JOUR</th>
                <th className="px-4 py-4 text-[10px] font-black text-gray-500 uppercase tracking-widest">COMPLÉMENT</th>
                <th className="px-4 py-4 text-[10px] font-black text-gray-500 uppercase tracking-widest">MISE JOUR</th>
                <th className="px-4 py-4 text-[10px] font-black text-gray-500 uppercase tracking-widest text-right">ACTION COLLECTE</th>
              </tr>
            </thead>
            <tbody>
              {filteredClients.length > 0 ? (
                filteredClients.map((client: any, idx) => (
                  <tr 
                    key={`${client.id}-${idx}`} 
                    onClick={() => setSelectedClientId(client.id)}
                    className={`border-b border-gray-800/50 hover:bg-white/5 transition-colors cursor-pointer ${selectedClientId === client.id ? 'bg-[#00c896]/20 border-l-4 border-l-[#00c896]' : ''}`}
                  >
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-[#00c896] flex items-center justify-center text-white font-black text-xs shrink-0">
                          {client.name.split(' ').map((n: string) => n[0]).join('')}
                        </div>
                        <div className="flex flex-col min-w-0">
                          <span className="text-sm font-black text-white uppercase">{client.name}</span>
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
                      <div className="flex items-center justify-end gap-3">
                        <button 
                          type="button"
                          onClick={() => handleEncaisser(client)}
                          className="bg-[#00c896] text-white px-5 py-2.5 rounded-xl font-black text-xs uppercase tracking-tight shadow-md active:scale-95 transition-all whitespace-nowrap"
                        >
                          Encaisser
                        </button>
                        {selectedClientId === client.id && (
                          <CheckCircle size={20} className="text-[#00c896] shrink-0 animate-in zoom-in duration-300" />
                        )}
                      </div>
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