import React, { useState, useEffect } from 'react';
import { Search, Wallet, Cloud, RefreshCw, AlertCircle, CheckCircle, FileText, User, Trash2, X, ChevronRight, LayoutGrid, History as HistoryIcon, ArrowDownLeft, ArrowUpRight } from 'lucide-react';

const TontineWithdrawal: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [clients, setClients] = useState<any[]>([]);
  const [selectedClient, setSelectedClient] = useState<any | null>(null);
  const [withdrawalAmount, setWithdrawalAmount] = useState('');
  const [withdrawalReason, setWithdrawalReason] = useState('Besoin personnel');
  const [pendingRequests, setPendingRequests] = useState<any[]>([]);
  const [selectedCycleIndices, setSelectedCycleIndices] = useState<number[]>([]);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const currentUser = JSON.parse(localStorage.getItem('microfox_current_user') || '{}');

  // Logique de calcul du solde net (Disponible = Cotisé - Commission)
  const getTontineStats = (grossBalance: number, dailyMise: number, history: any[], accountId: string, pendingWithdrawals: any[] = [], isFirstAccount: boolean = true, accountNumber?: string) => {
    if (dailyMise <= 0) dailyMise = 500;
    
    const accountHistory = (history || [])
      .filter(h => ((h.account === 'tontine' && (h.type === 'cotisation' || h.type === 'depot')) || (h.type === 'transfert' && h.destinationAccount === 'tontine')) && (
        h.tontineAccountId === accountId || 
        h.tontineAccountNumber === accountNumber ||
        (!h.tontineAccountId && !h.tontineAccountNumber && (
          (isFirstAccount && (!h.description?.includes('Compte:') || (accountNumber && h.description?.includes(accountNumber)))) ||
          (accountNumber && h.description?.includes(accountNumber))
        ))
      ) && h.description?.toLowerCase().includes('livret') !== true)
      .sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    
    // Merge history withdrawals with pending withdrawals to correctly split cycles
    const allWithdrawals = [
      ...(history || []).filter(h => h.account === 'tontine' && (
        h.tontineAccountId === accountId || 
        h.tontineAccountNumber === accountNumber ||
        (!h.tontineAccountId && !h.tontineAccountNumber && (
          (isFirstAccount && (!h.description?.includes('Compte:') || (accountNumber && h.description?.includes(accountNumber)))) ||
          (accountNumber && h.description?.includes(accountNumber))
        ))
      ) && (h.type === 'retrait' || h.type === 'transfert')),
      ...(pendingWithdrawals || []).filter(p => p.tontineAccountId === accountId || p.tontineAccountNumber === accountNumber || (isFirstAccount && !p.tontineAccountId && !p.tontineAccountNumber)).map(p => ({
        ...p,
        type: 'retrait',
        account: 'tontine',
        description: p.reason || `Retrait Tontine - ${p.amount} F`
      }))
    ].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    const accountWithdrawalsAmount = allWithdrawals.reduce((sum, h) => sum + h.amount, 0);

    let remainingWithdrawals = accountWithdrawalsAmount;
    const fmt = (d: Date) => d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const today = new Date();

    if (accountHistory.length === 0) {
      const isRetire = allWithdrawals.length > 0 || grossBalance < 0;
      const mRetire = allWithdrawals.reduce((sum, w) => sum + w.amount, 0);
      
      // Gérer le cas où il y a plusieurs retraits sans cotisations
      if (allWithdrawals.length > 1) {
        const details = [];
        let idx = 1;
        for (const w of allWithdrawals) {
          details.push({
            index: idx,
            amount: 0,
            disponible: 0,
            commission: 0,
            decaissable: 0,
            cases: 0,
            period: `Cycle ${idx} (Retiré)`,
            isRetire: true,
            dateRetrait: new Date(w.date).toLocaleDateString('fr-FR'),
            montantRetire: w.amount,
            dates: []
          });
          idx++;
        }
        return {
          netBalance: 0,
          cycles: idx,
          currentCycleCases: 0,
          currentCycleDates: [],
          cycleDetails: details
        };
      }

      return { 
        netBalance: 0, 
        cycles: isRetire ? 2 : 1, 
        currentCycleCases: 0, 
        currentCycleDates: [], 
        cycleDetails: [{ 
          index: 1, 
          amount: 0, 
          disponible: 0, 
          commission: 0, 
          decaissable: 0, 
          cases: 0, 
          period: `${fmt(today)} au ...`, 
          isRetire: isRetire, 
          dateRetrait: allWithdrawals[0] ? new Date(allWithdrawals[0].date).toLocaleDateString('fr-FR') : null, 
          montantRetire: mRetire,
          dates: []
        }] 
      };
    }

    let cycleDetails = [];
    let currentCycleFirstDepositDate: Date | null = null;
    let currentCycleCases = 0;
    let currentCycleAmount = 0;
    let currentCycleDates: string[] = [];
    let cycleIdx = 1;
    let totalComm = 0;
    let specificWithdrawal;
    const usedWithdrawalIds = new Set<string>();

    for (const tx of accountHistory) {
      const txDate = new Date(tx.date);
      let remainingAmount = Number(tx.amount);

      while (remainingAmount > 0) {
        if (currentCycleFirstDepositDate === null) {
          // Gérer les retraits qui ont eu lieu AVANT ce dépôt et qui doivent clôturer les cycles précédents
          let priorWithdrawal;
          while (priorWithdrawal = allWithdrawals.find(w => {
            if (usedWithdrawalIds.has(w.id)) {
              const matches = w.description.match(/Cycles: ([\d, ]+)/);
              if (matches) {
                const indices = matches[1].split(',').map(s => parseInt(s.trim()));
                if (indices.includes(cycleIdx)) return true;
              }
              return false;
            }
            if (new Date(w.date) >= txDate) return false;
            const matches = w.description.match(/Cycles: ([\d, ]+)/);
            if (matches) {
              const indices = matches[1].split(',').map(s => parseInt(s.trim()));
              return indices.includes(cycleIdx);
            }
            return true;
          })) {
            usedWithdrawalIds.add(priorWithdrawal.id);
            
            const matches = priorWithdrawal.description.match(/Cycles: ([\d, ]+)/);
            let currentMRetire = priorWithdrawal.amount;
            if (matches) {
              const indices = matches[1].split(',').map(s => parseInt(s.trim()));
              const isLast = indices[indices.length - 1] === cycleIdx;
              if (!isLast) usedWithdrawalIds.delete(priorWithdrawal.id);
              currentMRetire = priorWithdrawal.amount / indices.length;
            }

            cycleDetails.push({
              index: cycleIdx,
              amount: 0,
              disponible: 0,
              commission: 0,
              decaissable: 0,
              cases: 0,
              period: `Cycle ${cycleIdx} (Retiré)`,
              isRetire: true,
              dateRetrait: new Date(priorWithdrawal.date).toLocaleDateString('fr-FR'),
              montantRetire: currentMRetire,
              dates: []
            });
            cycleIdx++;
          }
          currentCycleFirstDepositDate = txDate;
        }

        const amountToCompleteCycle = (31 * Number(dailyMise)) - currentCycleAmount;
        const oldCases = currentCycleCases;

        // On traite d'abord l'ajout du montant au cycle en cours
        if (remainingAmount >= amountToCompleteCycle) {
          currentCycleAmount = Number(currentCycleAmount) + amountToCompleteCycle;
          currentCycleCases = 31;
          const casesAdded = 31 - oldCases;
          for (let m = 0; m < casesAdded; m++) {
            currentCycleDates.push(new Date(tx.date).toLocaleDateString('fr-FR', {day: '2-digit', month: '2-digit'}));
          }
          remainingAmount -= amountToCompleteCycle;
        } else {
          currentCycleAmount = Number(currentCycleAmount) + remainingAmount;
          const newCases = Math.floor(currentCycleAmount / Number(dailyMise));
          const casesAdded = newCases - oldCases;
          for (let m = 0; m < casesAdded; m++) {
            currentCycleDates.push(new Date(tx.date).toLocaleDateString('fr-FR', {day: '2-digit', month: '2-digit'}));
          }
          currentCycleCases = newCases;
          remainingAmount = 0;
        }

        // Ensuite on vérifie si le cycle doit être clôturé (expiration ou retrait)
        const cycleEndDateLimit = new Date(currentCycleFirstDepositDate.getTime() + (31 * 24 * 60 * 60 * 1000));
        const withdrawalDuringCycle = allWithdrawals.find(w => {
          const wDate = new Date(w.date);
          const isSameDay = wDate.toDateString() === txDate.toDateString();
          const matches = w.description.match(/Cycles: ([\d, ]+)/);
          if (matches) {
            const indices = matches[1].split(',').map(s => parseInt(s.trim()));
            if (!indices.includes(cycleIdx)) return false;
            return (isSameDay || (wDate >= currentCycleFirstDepositDate! && wDate <= txDate));
          }
          return !usedWithdrawalIds.has(w.id) && (isSameDay || (wDate >= currentCycleFirstDepositDate! && wDate <= txDate));
        });

        if (txDate >= cycleEndDateLimit || withdrawalDuringCycle || currentCycleCases === 31) {
          if (withdrawalDuringCycle) usedWithdrawalIds.add(withdrawalDuringCycle.id);
          let isRetire = false;
          let retraitDate = null;
          let mRetire = 0;
          
          const comm = currentCycleAmount > 0 ? dailyMise : 0;
          const netCycleAmount = Math.max(0, currentCycleAmount - comm);
          
          specificWithdrawal = withdrawalDuringCycle || allWithdrawals.find(h => {
            const matches = h.description.match(/Cycles: ([\d, ]+)/);
            if (matches) {
              const indices = matches[1].split(',').map(s => parseInt(s.trim()));
              return indices.includes(cycleIdx);
            }
            return !usedWithdrawalIds.has(h.id);
          });

          if (specificWithdrawal) {
            usedWithdrawalIds.add(specificWithdrawal.id);
            isRetire = true;
            retraitDate = new Date(specificWithdrawal.date).toLocaleDateString('fr-FR');
            
            const matches = specificWithdrawal.description.match(/Cycles: ([\d, ]+)/);
            if (matches) {
              const indices = matches[1].split(',').map(s => parseInt(s.trim()));
              const isLast = indices[indices.length - 1] === cycleIdx;
              if (!isLast) usedWithdrawalIds.delete(specificWithdrawal.id);
              
              if (indices.length > 1) {
                const consumed = (specificWithdrawal as any).consumed || 0;
                mRetire = isLast ? (specificWithdrawal.amount - consumed) : Math.min(netCycleAmount, specificWithdrawal.amount - consumed);
                (specificWithdrawal as any).consumed = consumed + mRetire;
              } else {
                mRetire = specificWithdrawal.amount;
              }
            } else {
              mRetire = specificWithdrawal.amount;
            }
            
            remainingWithdrawals = Math.max(0, remainingWithdrawals - mRetire);
          } else if (remainingWithdrawals >= netCycleAmount && netCycleAmount > 0) {
            const fallbackWithdrawal = allWithdrawals.find(w => !usedWithdrawalIds.has(w.id) && !w.description.includes('Cycles:'));
            if (fallbackWithdrawal) {
              usedWithdrawalIds.add(fallbackWithdrawal.id);
              isRetire = true;
              mRetire = netCycleAmount;
              remainingWithdrawals -= netCycleAmount;
              retraitDate = new Date(fallbackWithdrawal.date).toLocaleDateString('fr-FR');
              
              const consumed = (fallbackWithdrawal as any).consumed || 0;
              (fallbackWithdrawal as any).consumed = consumed + mRetire;
              if ((fallbackWithdrawal as any).consumed < fallbackWithdrawal.amount) {
                usedWithdrawalIds.delete(fallbackWithdrawal.id);
              }
            }
          }

          cycleDetails.push({
            index: cycleIdx,
            amount: currentCycleAmount,
            disponible: Math.max(0, currentCycleAmount - mRetire),
            commission: comm,
            decaissable: Math.max(0, netCycleAmount - mRetire),
            cases: currentCycleCases,
            period: `${fmt(currentCycleFirstDepositDate)} au ${txDate >= cycleEndDateLimit ? fmt(cycleEndDateLimit) : fmt(txDate)}`,
            isRetire: isRetire,
            montantRetire: mRetire,
            dateRetrait: retraitDate,
            dates: [...currentCycleDates]
          });
          if (currentCycleAmount > 0) totalComm += comm;
          cycleIdx++;
          currentCycleFirstDepositDate = remainingAmount > 0 ? txDate : null;
          currentCycleCases = 0;
          currentCycleAmount = 0;
          currentCycleDates = [];
        }
      }
    }
    if (currentCycleFirstDepositDate) {
      const cycleEndDateLimit = new Date(currentCycleFirstDepositDate.getTime() + (31 * 24 * 60 * 60 * 1000));
      let isRetire = false;
      let retraitDate = null;
      let mRetire = 0;
      let withdrawalValue = 0;
      const comm = currentCycleAmount > 0 ? Math.min(currentCycleAmount, dailyMise) : 0;
      const netCycleAmount = Math.max(0, currentCycleAmount - comm);

      specificWithdrawal = allWithdrawals.find(h => {
        const matches = h.description.match(/Cycles: ([\d, ]+)/);
        if (matches) {
          const indices = matches[1].split(',').map(s => parseInt(s.trim()));
          return indices.includes(cycleIdx);
        }
        return !usedWithdrawalIds.has(h.id);
      });

      if (specificWithdrawal) {
        usedWithdrawalIds.add(specificWithdrawal.id);
        isRetire = true;
        retraitDate = new Date(specificWithdrawal.date).toLocaleDateString('fr-FR');
        
        const matches = specificWithdrawal.description.match(/Cycles: ([\d, ]+)/);
        if (matches) {
          const indices = matches[1].split(',').map(s => parseInt(s.trim()));
          const isLast = indices[indices.length - 1] === cycleIdx;
          if (!isLast) usedWithdrawalIds.delete(specificWithdrawal.id);
          
          if (indices.length > 1) {
            const consumed = (specificWithdrawal as any).consumed || 0;
            mRetire = isLast ? (specificWithdrawal.amount - consumed) : Math.min(netCycleAmount, specificWithdrawal.amount - consumed);
            (specificWithdrawal as any).consumed = consumed + mRetire;
          } else {
            mRetire = specificWithdrawal.amount;
          }
        } else {
          mRetire = specificWithdrawal.amount;
        }
        
        currentCycleCases = 0;
        remainingWithdrawals = Math.max(0, remainingWithdrawals - mRetire);
      } else if (remainingWithdrawals > 0) {
        const fallbackWithdrawal = allWithdrawals.find(w => !usedWithdrawalIds.has(w.id) && !w.description.includes('Cycles:'));
        if (fallbackWithdrawal) {
          usedWithdrawalIds.add(fallbackWithdrawal.id);
          isRetire = true;
          mRetire = Math.min(netCycleAmount, fallbackWithdrawal.amount - ((fallbackWithdrawal as any).consumed || 0));
          withdrawalValue = netCycleAmount;
          currentCycleCases = 0;
          remainingWithdrawals = Math.max(0, remainingWithdrawals - mRetire);
          retraitDate = new Date(fallbackWithdrawal.date).toLocaleDateString('fr-FR');
          
          const consumed = (fallbackWithdrawal as any).consumed || 0;
          (fallbackWithdrawal as any).consumed = consumed + mRetire;
          if ((fallbackWithdrawal as any).consumed < fallbackWithdrawal.amount) {
            usedWithdrawalIds.delete(fallbackWithdrawal.id);
          }
        } else {
          isRetire = true; 
          mRetire = remainingWithdrawals;
          withdrawalValue = netCycleAmount;
          currentCycleCases = 0; 
          remainingWithdrawals = 0;
        }
      }

      const now = new Date();
      const isExpired = now >= cycleEndDateLimit;

      cycleDetails.push({
        index: cycleIdx,
        amount: currentCycleAmount,
        disponible: Math.max(0, currentCycleAmount - mRetire),
        commission: comm,
        decaissable: Math.max(0, netCycleAmount - mRetire),
        cases: Math.floor(currentCycleAmount / dailyMise),
        period: `${fmt(currentCycleFirstDepositDate)} au ${specificWithdrawal ? fmt(new Date(specificWithdrawal.date)) : (isExpired ? fmt(cycleEndDateLimit) : fmt(today))}`,
        isRetire: isRetire,
        isExpired: isExpired,
        montantRetire: mRetire,
        dateRetrait: retraitDate,
        dates: [...currentCycleDates]
      });
      if (currentCycleAmount > 0) totalComm += comm;
      if (isRetire || isExpired) cycleIdx++;
    }

    // Gérer les retraits restants qui n'ont pas de dépôts associés
    while (remainingWithdrawals > 0 || allWithdrawals.some(w => !usedWithdrawalIds.has(w.id))) {
      const nextW = allWithdrawals.find(w => !usedWithdrawalIds.has(w.id));
      if (!nextW && remainingWithdrawals <= 0) break;
      
      const currentMRetire = nextW ? nextW.amount : remainingWithdrawals;
      if (nextW) usedWithdrawalIds.add(nextW.id);
      
      cycleDetails.push({
        index: cycleIdx,
        amount: 0,
        disponible: 0,
        commission: 0,
        decaissable: 0,
        cases: 0,
        period: `Cycle ${cycleIdx} (Retiré)`,
        isRetire: true,
        dateRetrait: nextW ? new Date(nextW.date).toLocaleDateString('fr-FR') : null,
        montantRetire: currentMRetire,
        dates: []
      });
      
      remainingWithdrawals = Math.max(0, remainingWithdrawals - currentMRetire);
      cycleIdx++;
    }

    const lastCycle = cycleDetails[cycleDetails.length - 1];
    let displayCycles = cycleIdx;
    let displayCycleCases = (lastCycle && lastCycle.index === cycleIdx) ? lastCycle.cases : 0;
    let displayCycleDates = currentCycleDates.slice(0, displayCycleCases);

    return { 
      netBalance: cycleDetails.reduce((sum, c) => sum + c.decaissable, 0), 
      cycles: displayCycles, 
      currentCycleCases: displayCycleCases, 
      currentCycleDates: displayCycleDates,
      cycleDetails: cycleDetails
    };
  };

  const loadData = () => {
    let saved = localStorage.getItem('microfox_members_data');
    let allMembers = [];
    
    if (saved) {
      allMembers = JSON.parse(saved).map((m: any) => {
        const updatedTontineAccounts = (m.tontineAccounts || []).map((acc: any, index: number) => ({
          ...acc,
          id: acc.id || `${m.id}_tn_${index + 1}`
        }));

        const savedHistory = localStorage.getItem(`microfox_history_${m.id}`);
        if (savedHistory) {
          return { ...m, tontineAccounts: updatedTontineAccounts, history: JSON.parse(savedHistory) };
        }
        return { ...m, tontineAccounts: updatedTontineAccounts };
      });
    } else {
      allMembers = [
        {
          id: '1',
          name: 'KOFFI Ama Gertrude',
          code: '41110A001254',
          epargneAccountNumber: 'EP-8829-01',
          balances: { epargne: 450000, tontine: 16500, credit: 1200000, garantie: 300000, partSociale: 10000 },
          tontineAccounts: [{ id: '1_tn_0', number: 'TN-8829-01', dailyMise: 500, balance: 16500 }],
          history: [
            { id: 't3', type: 'cotisation', account: 'tontine', tontineAccountId: '1_tn_0', amount: 2000, date: '2024-05-22T09:15:00Z', description: 'Collecte journalière - Agent J04' },
            { id: 't2', type: 'cotisation', account: 'tontine', tontineAccountId: '1_tn_0', amount: 500, date: '2024-05-20T10:00:00Z', description: 'Collecte journalière - Agent J04' },
            { id: 't_init', type: 'cotisation', account: 'tontine', tontineAccountId: '1_tn_0', amount: 14000, date: '2024-05-19T08:30:00Z', description: 'Report de solde cycle précédent - Système' }
          ]
        }
      ];
    }

    // Récupération des demandes en attente et validées pour filtrer les cycles déjà demandés
    const savedPending = localStorage.getItem('microfox_pending_withdrawals');
    let pending = savedPending ? JSON.parse(savedPending).filter((r: any) => !r.isDeleted) : [];
    
    // Filtrage des demandes en attente par zone pour l'agent commercial
    if (currentUser?.role === 'agent commercial') {
      const agentZones = currentUser.zonesCollecte || (currentUser.zoneCollecte ? [currentUser.zoneCollecte] : []);
      if (agentZones.length > 0) {
        pending = pending.filter((r: any) => {
          const client = allMembers.find((m: any) => m.id === r.clientId);
          return client && (agentZones.includes(client.zone) || agentZones.includes(client.zoneCollecte));
        });
      }
    }

    const savedValidated = localStorage.getItem('microfox_validated_withdrawals');
    const validated = savedValidated ? JSON.parse(savedValidated).filter((r: any) => !r.isDeleted) : [];
    const allRequests = [...pending, ...validated];

      const tontiniers: any[] = [];
      allMembers.forEach((m: any) => {
        const hasTontine = m.tontineAccounts && m.tontineAccounts.length > 0;
        if (!hasTontine) return;
        
        // Filtrage par zone pour l'agent commercial
        if (currentUser?.role === 'agent commercial') {
          const agentZones = currentUser.zonesCollecte || (currentUser.zoneCollecte ? [currentUser.zoneCollecte] : []);
          if (agentZones.length > 0) {
            if (!(agentZones.includes(m.zone) || agentZones.includes(m.zoneCollecte))) return;
          }
        }

        const visibleTontineAccounts = (currentUser?.role === 'caissier' || currentUser?.role === 'agent commercial')
          ? m.tontineAccounts.filter((acc: any) => !acc.isInvisible)
          : m.tontineAccounts;

        if (visibleTontineAccounts.length === 0) return;

        visibleTontineAccounts.forEach((acc: any) => {
          // On passe toutes les demandes (en attente et validées) à getTontineStats pour qu'il puisse scinder les cycles
          const clientRequests = allRequests.filter(r => r.clientId === m.id && (r.tontineAccountId === acc.id || r.tontineAccountNumber === acc.number));
          const isFirstAccount = m.tontineAccounts[0]?.id === acc.id;
          const stats = getTontineStats(acc.balance, acc.dailyMise, m.history, acc.id, clientRequests, isFirstAccount, acc.number);
          
          // Extraction des indices de cycles déjà présents dans des demandes
          const requestedCycleIndices: {idx: number, date: string, amount: number, status: string}[] = [];
          clientRequests.forEach(r => {
            const matches = r.reason.match(/Cycles: ([\d, ]+)/);
            if (matches) {
              matches[1].split(',').forEach(s => {
                const num = parseInt(s.trim());
                if (!isNaN(num)) requestedCycleIndices.push({idx: num, date: r.date, amount: r.amount, status: r.status});
              });
            }
          });

          // Marquer les cycles déjà demandés comme retirés pour empêcher une nouvelle demande
          const updatedCycleDetails = stats.cycleDetails.map(c => {
            const request = requestedCycleIndices.find(r => r.idx === c.index);
            // On ne bloque le cycle que s'il y a une demande EN ATTENTE ou VALIDÉE non encore en historique.
            // Les demandes VALIDÉES déjà en historique sont gérées par getTontineStats.
            const isPending = request?.status === 'En attente' || request?.status === 'Validé';
            
            return {
              ...c,
              isRetire: c.isRetire || isPending,
              montantRetire: c.isRetire ? c.montantRetire : (request ? request.amount : 0),
              dateRetrait: c.isRetire ? c.dateRetrait : (request ? new Date(request.date).toLocaleDateString('fr-FR') : null)
            };
          });

          tontiniers.push({
            ...m,
            id: `${m.id}_${acc.id}`,
            realClientId: m.id,
            tontineAccountId: acc.id,
            isFirstAccount: isFirstAccount,
            availableTontine: Math.max(0, stats.netBalance),
            cycles: stats.cycles,
            currentCycleCases: stats.currentCycleCases,
            currentCycleDates: stats.currentCycleDates,
            cycleDetails: updatedCycleDetails,
            accountNumber: acc.number
          });
        });
      });
    setClients(tontiniers);

    setPendingRequests(pending);
  };

  useEffect(() => {
    loadData();
    window.addEventListener('storage', loadData);
    window.addEventListener('microfox_storage' as any, loadData);
    return () => window.removeEventListener('storage', loadData);
      window.removeEventListener('microfox_storage' as any, loadData);
  }, []);

  useEffect(() => {
    setSelectedCycleIndices([]);
    setWithdrawalAmount('');
    setWithdrawalReason('Besoin personnel');
  }, [selectedClient?.id]);

  useEffect(() => {
    if (selectedClient && selectedCycleIndices.length > 0) {
      const selectedData = selectedClient.cycleDetails.filter((_: any, i: number) => selectedCycleIndices.includes(i));
      const total = selectedData.reduce((acc: number, curr: any) => acc + curr.decaissable, 0);
      const indices = selectedData.map((c: any) => c.index).sort((a: number, b: number) => a - b).join(', ');
      const periods = selectedData.map((c: any) => c.period).join(' | ');
      setWithdrawalAmount(total.toString());
      setWithdrawalReason(`Retrait Cycles: ${indices} (${periods})`);
    } else {
      setWithdrawalAmount('');
      setWithdrawalReason('Besoin personnel');
    }
  }, [selectedCycleIndices, selectedClient]);

  const handleCreateRequest = () => {
    if (!selectedClient || !withdrawalAmount) return;
    const amount = Number(withdrawalAmount);
    
    // Utilisation d'une marge de tolérance pour les comparaisons de nombres à virgule flottante (même si ici on attend des entiers)
    if (amount <= 0 || amount > (selectedClient.availableTontine + 0.1)) {
      setErrorMessage("Montant invalide ou supérieur au montant disponible.");
      setTimeout(() => setErrorMessage(null), 5000);
      return;
    }

    const newRequest = {
      id: `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      clientId: selectedClient.realClientId || selectedClient.id,
      tontineAccountId: selectedClient.tontineAccountId,
      clientName: selectedClient.name,
      clientCode: selectedClient.code,
      tontineAccountNumber: selectedClient.accountNumber,
      amount: amount,
      reason: withdrawalReason,
      date: new Date().toISOString(),
      status: 'En attente',
      userId: currentUser?.id,
      userName: currentUser?.identifiant || currentUser?.name || 'Inconnu'
    };

    const savedRequests = localStorage.getItem('microfox_pending_withdrawals');
    const requests = savedRequests ? JSON.parse(savedRequests) : [];
    const updatedRequests = [newRequest, ...requests];
    localStorage.setItem('microfox_pending_withdrawals', JSON.stringify(updatedRequests));

    // Mise à jour de l'historique du membre pour le Journal Global
    const savedMembers = localStorage.getItem('microfox_members_data');
    if (savedMembers) {
      const allMembers = JSON.parse(savedMembers);
      const clientId = selectedClient.realClientId || selectedClient.id;
      const updatedMembers = allMembers.map((m: any) => {
        if (m.id === clientId) {
          const savedHistory = localStorage.getItem(`microfox_history_${m.id}`);
          let fullHistory = savedHistory ? JSON.parse(savedHistory) : (m.history || []);
          
          const historyEntry = {
            id: `req_tn_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
            type: 'demande',
            account: 'tontine',
            amount: amount,
            date: new Date().toISOString(),
            description: `Demande de retrait Tontine enregistrée: ${withdrawalReason}`,
            operator: currentUser.identifiant || 'Inconnu',
            cashierName: currentUser.identifiant || 'Inconnu',
            tontineAccountId: selectedClient.tontineAccountId,
            tontineAccountNumber: selectedClient.accountNumber,
            userId: currentUser.id
          };
          
          const newHistory = [historyEntry, ...fullHistory];
          localStorage.setItem(`microfox_history_${m.id}`, JSON.stringify(newHistory));
          return { ...m, history: newHistory };
        }
        return m;
      });
      localStorage.setItem('microfox_members_data', JSON.stringify(updatedMembers));
    }

    setPendingRequests(updatedRequests);

    setSuccessMessage(`Demande de retrait de ${amount} F enregistrée pour ${selectedClient.name}.`);
    setTimeout(() => setSuccessMessage(null), 5000);
    
    setWithdrawalAmount('');
    setSelectedCycleIndices([]);
    setSelectedClient(null);
    loadData();
  };

  const handleCancelRequest = (requestId: string) => {
    const saved = localStorage.getItem('microfox_pending_withdrawals');
    const currentPending = saved ? JSON.parse(saved) : [];
    const updated = currentPending.map((r: any) => r.id === requestId ? { ...r, isDeleted: true } : r);
    localStorage.setItem('microfox_pending_withdrawals', JSON.stringify(updated));
    setPendingRequests(updated.filter((r: any) => !r.isDeleted));
    setSuccessMessage("Demande annulée avec succès.");
    setTimeout(() => setSuccessMessage(null), 3000);
    loadData();
  };

  const filteredClients = clients.filter(c => 
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    c.code.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12 px-4 lg:px-0">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-xl lg:text-2xl font-extrabold text-[#121c32] uppercase tracking-tight leading-tight">
            Retrait<br />Tontine
          </h1>
          <p className="text-gray-500 text-[10px] lg:text-[11px] font-bold uppercase tracking-widest mt-1">Gestion des demandes de retrait</p>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-50 text-emerald-600 rounded-lg border border-emerald-100 text-xs font-bold self-start">
          <Cloud size={16} />
          <span>CLOUD</span>
        </div>
      </div>

      {successMessage && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50 bg-emerald-500 text-white px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-3 animate-in fade-in slide-in-from-top-4 duration-300">
          <CheckCircle size={20} />
          <span className="font-black uppercase tracking-tight text-sm">{successMessage}</span>
        </div>
      )}

      {errorMessage && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50 bg-red-500 text-white px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-3 animate-in fade-in slide-in-from-top-4 duration-300">
          <AlertCircle size={20} />
          <span className="font-black uppercase tracking-tight text-sm">{errorMessage}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white p-4 rounded-[1.5rem] shadow-sm border border-gray-100">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
              <input 
                type="text" 
                placeholder="Rechercher un client..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-12 pr-4 py-4 bg-white border-2 border-[#00c896] rounded-2xl font-medium outline-none placeholder:text-gray-400 text-[#121c32]"
              />
            </div>
          </div>

          <div className="bg-white rounded-[1.5rem] shadow-sm border border-gray-100 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-gray-50 bg-gray-50/50">
                    <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Client</th>
                    <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Disponible</th>
                    <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filteredClients.map(client => (
                    <tr 
                      key={client.id} 
                      className={`hover:bg-emerald-50/30 transition-colors cursor-pointer ${selectedClient?.id === client.id ? 'bg-emerald-50' : ''}`} 
                      onClick={() => setSelectedClient(selectedClient?.id === client.id ? null : client)}
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-[#121c32] text-white flex items-center justify-center font-black text-[10px]">
                            {client.name.split(' ').map((n: string) => n[0]).join('')}
                          </div>
                          <div>
                            <p className="text-sm font-black text-[#121c32] uppercase">{client.name}</p>
                            <div className="flex flex-col gap-0.5">
                              <p className="text-[10px] font-bold text-gray-400 uppercase">{client.code}</p>
                              <div className="flex items-center gap-2">
                                <span className="text-[9px] font-bold text-blue-500 uppercase">Épargne: {client.epargneAccountNumber || 'N/A'}</span>
                                <span className="text-[9px] font-bold text-emerald-500 uppercase">Tontine: {client.accountNumber || 'N/A'}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col">
                          <span className="text-sm font-black text-blue-600">{client.availableTontine.toLocaleString()}</span>
                          <span className="text-[10px] font-black text-blue-600 uppercase">FCFA</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button className={`p-2 rounded-lg transition-all ${selectedClient?.id === client.id ? 'bg-emerald-500 text-white shadow-lg' : 'text-gray-300 hover:text-emerald-500'}`}>
                          <CheckCircle size={20} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {pendingRequests.length > 0 && (
            <div className="bg-white rounded-[1.5rem] shadow-sm border border-gray-100 overflow-hidden">
              <div className="p-4 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
                <h3 className="text-xs font-black text-[#121c32] uppercase tracking-widest">Demandes en attente</h3>
                <span className="bg-emerald-100 text-emerald-600 px-2 py-0.5 rounded-md text-[10px] font-black">{pendingRequests.length}</span>
              </div>
              <div className="divide-y divide-gray-50">
                {pendingRequests.map((req, idx) => (
                  <div key={`${req.id}-${idx}`} className="p-4 flex items-center justify-between hover:bg-gray-50/50 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center text-gray-400">
                        <FileText size={16} />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-[#121c32]">{req.clientName}</p>
                        <div className="flex items-center gap-2">
                          <p className="text-[9px] font-bold text-gray-400 uppercase">{new Date(req.date).toLocaleDateString()} • {req.amount.toLocaleString()} F • {req.reason}</p>
                          {req.userName && (
                            <span className="text-[8px] font-black bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded border border-blue-100 uppercase">
                              Par: {req.userName}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <button 
                      onClick={() => handleCancelRequest(req.id)}
                      className="p-2 text-red-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all flex items-center gap-1 text-[10px] font-black uppercase"
                    >
                      <Trash2 size={16} /> Annuler
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="space-y-6">
          <div className="bg-white rounded-[2rem] p-8 border border-gray-100 shadow-sm">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-black text-[#121c32] uppercase tracking-tight flex items-center gap-2">
                <RefreshCw size={20} className="text-emerald-500" /> Détails Demande
              </h3>
              {selectedClient && (
                <button 
                  onClick={() => setSelectedClient(null)} 
                  className="p-2 bg-gray-50 text-gray-400 rounded-xl hover:text-[#121c32] transition-colors"
                >
                  <X size={20} />
                </button>
              )}
            </div>
            
            {selectedClient ? (
              <div className="space-y-6">
                <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-100">
                  <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest mb-1">Client sélectionné</p>
                  <p className="text-sm font-bold text-[#121c32]">{selectedClient.name}</p>
                  <div className="flex gap-2 mt-1">
                    <span className="text-[8px] px-1.5 py-0.5 bg-emerald-500/20 text-emerald-600 rounded font-black uppercase">EP: {selectedClient.epargneAccountNumber || '---'}</span>
                    <span className="text-[8px] px-1.5 py-0.5 bg-blue-500/20 text-blue-600 rounded font-black uppercase">TN: {selectedClient.accountNumber || '---'}</span>
                  </div>
                  <div className="flex justify-between mt-2 pt-2 border-t border-emerald-100">
                    <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-tight">Disponible Net total</span>
                    <span className="text-sm font-black text-[#121c32]">{selectedClient.availableTontine.toLocaleString()} F</span>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-[10px] font-black text-[#121c32] uppercase tracking-widest">Choisir le cycle à retirer</h4>
                  </div>
                  <div className="space-y-3">
                    {selectedClient.cycleDetails.map((cycle: any, idx: number) => ({ cycle, idx })).reverse().map(({ cycle, idx }) => (
                      <button 
                        key={idx}
                        onClick={() => {
                          if (!cycle.isRetire && cycle.decaissable > 0) {
                            setSelectedCycleIndices(prev => 
                              prev.includes(idx) ? prev.filter(i => i !== idx) : [...prev, idx]
                            );
                          }
                        }}
                        disabled={cycle.isRetire || cycle.decaissable <= 0}
                        className={`w-full p-4 rounded-2xl border text-left transition-all relative overflow-hidden group ${selectedCycleIndices.includes(idx) ? 'bg-emerald-50 border-emerald-500 shadow-md ring-2 ring-emerald-500/20' : 'bg-white border-gray-100 hover:border-emerald-200'} ${cycle.isRetire ? 'opacity-50 grayscale cursor-not-allowed' : ''}`}
                      >
                         <div className="flex justify-between items-start">
                            <div className="space-y-1">
                               <p className="text-[10px] font-black text-[#121c32] uppercase">CYCLE {cycle.index} ({cycle.cases} CASES PAYÉES)</p>
                               <p className="text-[8px] font-bold text-gray-400 uppercase">{cycle.period}</p>
                            </div>
                            <div className="text-right space-y-1">
                               <div className="flex items-center gap-2">
                                  <span className="text-[8px] font-bold text-gray-400 uppercase">Disponible:</span>
                                  <span className="text-[9px] font-black text-[#121c32]">{cycle.disponible.toLocaleString()} F</span>
                               </div>
                               <div className="flex items-center gap-2">
                                  <span className="text-[8px] font-bold text-red-400 uppercase">Comm:</span>
                                  <span className="text-[9px] font-black text-red-400">-{cycle.commission.toLocaleString()} F</span>
                               </div>
                               <div className="flex items-center gap-2 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100 mt-1">
                                  <span className="text-[8px] font-bold text-emerald-600 uppercase">Décaissable:</span>
                                  <span className="text-xs font-black text-emerald-600">{cycle.decaissable.toLocaleString()} F</span>
                               </div>
                            </div>
                         </div>
                         
                         {cycle.isRetire && (
                            <div className="absolute inset-0 bg-white/60 flex items-center justify-center">
                               <div className="flex flex-col items-center gap-1 bg-white px-3 py-2 rounded-xl shadow-lg border border-gray-100 rotate-3">
                                  <span className="text-[8px] font-black text-red-500 uppercase">Déjà retiré</span>
                                  <span className="text-[10px] font-black text-[#121c32]">{cycle.montantRetire.toLocaleString()} F</span>
                                  <span className="text-[8px] font-bold text-gray-400 uppercase">{cycle.dateRetrait ? `Le ${cycle.dateRetrait}` : ''}</span>
                                  <span className="text-[7px] font-bold text-emerald-600 uppercase mt-0.5">{cycle.period}</span>
                               </div>
                            </div>
                         )}

                         {selectedCycleIndices.includes(idx) && !cycle.isRetire && (
                            <div className="mt-4 pt-4 border-t border-emerald-100 animate-in fade-in slide-in-from-top-2">
                               <div className="flex items-center gap-2 mb-3">
                                  <LayoutGrid size={14} className="text-emerald-500" />
                                  <span className="text-[9px] font-black text-emerald-600 uppercase tracking-widest">Grille des cases du cycle</span>
                               </div>
                               <div className="grid grid-cols-7 gap-1 max-w-sm">
                                  {Array.from({ length: 31 }).map((_, i) => {
                                    const caseNum = i + 1;
                                    const isPaid = caseNum <= cycle.cases;
                                    const isCommission = caseNum === 1;

                                    return (
                                      <div 
                                        key={i} 
                                        className={`aspect-square rounded-lg flex items-center justify-center text-[7px] lg:text-[8px] font-black transition-all border
                                          ${isPaid 
                                            ? (isCommission ? 'bg-indigo-600 border-indigo-700 text-white shadow-sm' : 'bg-[#00c896] border-[#00c896] text-white shadow-sm') 
                                            : isCommission 
                                              ? 'bg-amber-50 border-amber-200 text-amber-500' 
                                              : 'bg-white border-gray-100 text-gray-300'
                                          }
                                        `}
                                      >
                                        {isPaid 
                                          ? (cycle.dates?.[i] || caseNum) 
                                          : (isCommission ? 'COM' : caseNum)
                                        }
                                      </div>
                                    );
                                  })}
                               </div>
                            </div>
                         )}

                         {selectedCycleIndices.includes(idx) && !cycle.isRetire && (
                            <div className="absolute right-0 top-0 bottom-0 w-1 bg-emerald-500"></div>
                         )}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-4 pt-4 border-t border-gray-100">
                  <div className="flex items-center gap-2">
                    <HistoryIcon size={16} className="text-[#121c32]" />
                    <h4 className="text-[10px] font-black text-[#121c32] uppercase tracking-widest">Journal des cotisations</h4>
                  </div>
                  <div className="space-y-2 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
                    {selectedClient.history
                      .filter((tx: any) => 
                        tx.account === 'tontine' && 
                        (tx.type === 'cotisation' || tx.type === 'depot' || tx.type === 'retrait' || tx.type === 'transfert') && 
                        tx.description?.toLowerCase().includes('livret') !== true &&
                        (
                          tx.tontineAccountId === selectedClient.tontineAccountId || 
                          tx.tontineAccountNumber === selectedClient.accountNumber ||
                          (!tx.tontineAccountId && !tx.tontineAccountNumber && (
                            (selectedClient.isFirstAccount && !tx.description?.includes('Compte:')) ||
                            tx.description?.includes(selectedClient.accountNumber || '')
                          ))
                        )
                      )
                      .map((tx: any, idx: number) => (
                        <div key={`${tx.id}_${idx}`} className="bg-gray-50 p-3 rounded-xl border border-gray-100 flex items-center justify-between transition-all hover:border-emerald-100">
                          <div className="flex items-center gap-3">
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${tx.type === 'cotisation' || tx.type === 'depot' ? 'bg-emerald-100 text-emerald-600' : 'bg-red-100 text-red-600'}`}>
                              {tx.type === 'cotisation' || tx.type === 'depot' ? <ArrowDownLeft size={14} /> : <ArrowUpRight size={14} />}
                            </div>
                            <div>
                              <p className="text-[10px] font-black text-[#121c32] uppercase">{tx.description}</p>
                              <p className="text-[8px] font-bold text-gray-400 uppercase">{new Date(tx.date).toLocaleDateString()}</p>
                            </div>
                          </div>
                          <span className={`text-[10px] font-black ${tx.type === 'cotisation' || tx.type === 'depot' ? 'text-emerald-600' : 'text-red-600'}`}>
                            {tx.type === 'cotisation' || tx.type === 'depot' ? '+' : '-'}{tx.amount.toLocaleString()} F
                          </span>
                        </div>
                      ))}
                  </div>
                </div>

                <div className="bg-amber-50 p-3 rounded-xl border border-amber-100 flex gap-2 items-start">
                  <AlertCircle size={14} className="text-amber-600 shrink-0 mt-0.5" />
                  <p className="text-[10px] text-amber-700 font-bold uppercase leading-tight">
                    Le retrait d'un cycle entraîne sa clôture définitive. La commission est prélevée à l'entrée de chaque cycle. Un cycle ne peut être demandé qu'une seule fois.
                  </p>
                </div>

                <div className="space-y-2">
                  <label className="text-[11px] font-black text-gray-400 uppercase tracking-widest ml-1 text-center block">Montant validé pour le retrait</label>
                  <div className="relative">
                    <input 
                      type="number" 
                      value={withdrawalAmount}
                      readOnly
                      placeholder="0"
                      className="w-full p-4 bg-gray-50 border-2 border-[#00c896] rounded-2xl text-xl font-black outline-none text-[#121c32] text-center"
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 font-black text-gray-300">F</span>
                  </div>
                </div>

                <button 
                  onClick={handleCreateRequest}
                  disabled={!withdrawalAmount}
                  className={`w-full py-5 rounded-2xl font-black uppercase tracking-widest shadow-xl active:scale-95 transition-all flex items-center justify-center gap-2 ${withdrawalAmount ? 'bg-[#121c32] text-white' : 'bg-gray-100 text-gray-300 cursor-not-allowed'}`}
                >
                  <FileText size={20} /> Valider la demande
                </button>
              </div>
            ) : (
              <div className="py-12 text-center space-y-4">
                <div className="w-16 h-16 rounded-full bg-gray-50 flex items-center justify-center text-gray-200 mx-auto">
                  <User size={32} />
                </div>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest text-center">Veuillez sélectionner<br />un client dans la liste</p>
              </div>
            )}
          </div>

          <div className="bg-[#fef2f2] rounded-[2rem] p-6 border border-red-100">
            <div className="flex gap-3">
              <AlertCircle className="text-red-500 shrink-0" size={20} />
              <div>
                <h4 className="text-[10px] font-black text-red-600 uppercase tracking-widest mb-1">Règle de retrait</h4>
                <p className="text-[10px] text-red-500 font-medium leading-relaxed uppercase tracking-tighter">
                  Le montant retirable correspond aux cotisations moins la commission de gestion de cycle (1ère mise de 31 jours). Une fois un cycle demandé, il ne peut plus être sélectionné.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TontineWithdrawal;