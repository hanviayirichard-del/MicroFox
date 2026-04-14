import React, { useState, useEffect } from 'react';
import { 
  Search, 
  ShieldCheck, 
  CheckCircle, 
  XCircle, 
  FileText, 
  Clock, 
  User, 
  AlertCircle,
  History,
  LayoutGrid,
  ChevronDown,
  ChevronUp,
  ArrowDownLeft,
  ArrowUpRight,
  Check,
  Square,
  CheckSquare,
  Printer,
  Download
} from 'lucide-react';

const TontineVerification: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [pendingRequests, setPendingRequests] = useState<any[]>([]);
  const [validatedHistory, setValidatedHistory] = useState<any[]>([]);
  const [members, setMembers] = useState<any[]>([]);
  const [observedBalances, setObservedBalances] = useState<{[key: string]: string}>({});
  const [disburseAmounts, setDisburseAmounts] = useState<{[key: string]: string}>({});
  const [reports, setReports] = useState<{[key: string]: string}>({});
  const [expandedRequestId, setExpandedRequestId] = useState<string | null>(null);
  const [selectedTxIds, setSelectedTxIds] = useState<string[]>([]);
  const [errorModal, setErrorModal] = useState<string | null>(null);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedZone, setSelectedZone] = useState('all');

  const getTontineStats = (grossBalance: number, dailyMise: number, history: any[], accountId: string, pendingWithdrawals: any[] = [], isFirstAccount: boolean = true, accountNumber?: string) => {
    if (dailyMise <= 0) dailyMise = 500;
    
    const accountHistory = (history || [])
      .filter(h => h.account === 'tontine' && (
        h.tontineAccountId === accountId || 
        h.tontineAccountNumber === accountNumber ||
        (!h.tontineAccountId && !h.tontineAccountNumber && (
          (isFirstAccount && (!h.description?.includes('Compte:') || (accountNumber && h.description?.includes(accountNumber)))) ||
          (accountNumber && h.description?.includes(accountNumber))
        ))
      ) && (h.type === 'cotisation' || h.type === 'depot') && h.description?.toLowerCase().includes('livret') !== true)
      .sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    
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
    const usedWithdrawalIds = new Set<string>();

    for (const tx of accountHistory) {
      const txDate = new Date(tx.date);
      let remainingAmount = Number(tx.amount);

      while (remainingAmount > 0) {
        if (currentCycleFirstDepositDate === null) {
          let priorWithdrawal;
          while (priorWithdrawal = allWithdrawals.find(w => {
            if (usedWithdrawalIds.has(w.id)) return false;
            if (new Date(w.date) >= txDate) return false;
            const matches = w.description.match(/Cycles: ([\d, ]+)/);
            if (matches) {
              const indices = matches[1].split(',').map(s => parseInt(s.trim()));
              return indices.includes(cycleIdx);
            }
            return true;
          })) {
            usedWithdrawalIds.add(priorWithdrawal.id);
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
              montantRetire: priorWithdrawal.amount,
              dates: []
            });
            cycleIdx++;
          }
          currentCycleFirstDepositDate = txDate;
        }

        const amountToCompleteCycle = (31 * Number(dailyMise)) - currentCycleAmount;
        const oldCases = currentCycleCases;

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

        const cycleEndDateLimit = new Date(currentCycleFirstDepositDate.getTime() + (31 * 24 * 60 * 60 * 1000));
        const withdrawalDuringCycle = allWithdrawals.find(w => {
          const wDate = new Date(w.date);
          const isSameDay = wDate.toDateString() === txDate.toDateString();
          const matches = w.description.match(/Cycles: ([\d, ]+)/);
          if (matches) {
            const indices = matches[1].split(',').map(s => parseInt(s.trim()));
            if (!indices.includes(cycleIdx)) return false;
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

          let specificWithdrawal = withdrawalDuringCycle || allWithdrawals.find(h => {
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
            retraitDate = new Date(specificWithdrawal.date).toLocaleDateString('fr-FR');
            mRetire = specificWithdrawal.amount;
            remainingWithdrawals = Math.max(0, remainingWithdrawals - specificWithdrawal.amount);
          } else if (remainingWithdrawals >= netCycleAmount && netCycleAmount > 0) {
            const fallbackWithdrawal = allWithdrawals.find(w => !usedWithdrawalIds.has(w.id) && !w.description.includes('Cycles:'));
            if (fallbackWithdrawal) {
              usedWithdrawalIds.add(fallbackWithdrawal.id);
              isRetire = true;
              mRetire = netCycleAmount;
              remainingWithdrawals -= netCycleAmount;
              retraitDate = new Date(fallbackWithdrawal.date).toLocaleDateString('fr-FR');
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
            dateRetrait: retraitDate,
            montantRetire: mRetire,
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
      let isRetire = false;
      let retraitDate = null;
      let mRetire = 0;
      const comm = currentCycleAmount > 0 ? Math.min(currentCycleAmount, dailyMise) : 0;
      const netCycleAmount = Math.max(0, currentCycleAmount - comm);

      let specificWithdrawal = allWithdrawals.find(h => {
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
        retraitDate = new Date(specificWithdrawal.date).toLocaleDateString('fr-FR');
        mRetire = specificWithdrawal.amount;
        remainingWithdrawals = Math.max(0, remainingWithdrawals - specificWithdrawal.amount);
      } else if (remainingWithdrawals > 0) {
        const fallbackWithdrawal = allWithdrawals.find(w => !usedWithdrawalIds.has(w.id) && !w.description.includes('Cycles:'));
        if (fallbackWithdrawal) {
          usedWithdrawalIds.add(fallbackWithdrawal.id);
          isRetire = true;
          mRetire = Math.min(remainingWithdrawals, netCycleAmount);
          remainingWithdrawals -= mRetire;
          retraitDate = new Date(fallbackWithdrawal.date).toLocaleDateString('fr-FR');
        } else if (remainingWithdrawals > 0) {
          isRetire = true;
          mRetire = remainingWithdrawals;
          remainingWithdrawals = 0;
        }
      }

      cycleDetails.push({
        index: cycleIdx,
        amount: currentCycleAmount,
        disponible: Math.max(0, currentCycleAmount - mRetire),
        commission: comm,
        decaissable: Math.max(0, netCycleAmount - mRetire),
        cases: currentCycleCases,
        period: `${fmt(currentCycleFirstDepositDate)} au ${fmt(today)}`,
        isRetire: isRetire,
        dateRetrait: retraitDate,
        montantRetire: mRetire,
        dates: [...currentCycleDates]
      });
      if (currentCycleAmount > 0) totalComm += comm;
    }

    const lastCycle = cycleDetails[cycleDetails.length - 1];
    let displayCycles = cycleIdx;
    let displayCycleCases = lastCycle ? lastCycle.cases : 0;
    let displayCycleDates = lastCycle ? lastCycle.dates : [];

    if (lastCycle && (lastCycle.isRetire || lastCycle.cases === 31)) {
      displayCycles = cycleIdx + 1;
      displayCycleCases = 0;
      displayCycleDates = [];
    }

    return { 
      netBalance: cycleDetails.reduce((sum, c) => sum + c.decaissable, 0), 
      cycles: displayCycles, 
      currentCycleCases: displayCycleCases, 
      currentCycleDates: displayCycleDates,
      cycleDetails: cycleDetails
    };
  };

  const [selectedRequestIds, setSelectedRequestIds] = useState<string[]>([]);
  const [isBulkApproving, setIsBulkApproving] = useState(false);

  const toggleSelectRequest = (id: string) => {
    setSelectedRequestIds(prev => 
      prev.includes(id) ? prev.filter(rid => rid !== id) : [...prev, id]
    );
  };

  const handleBulkApprove = async () => {
    if (selectedRequestIds.length === 0) return;
    
    const requestsToApprove = pendingRequests.filter(r => selectedRequestIds.includes(r.id));
    
    // Check if all selected requests belong to the same client
    const clientIds = new Set(requestsToApprove.map(r => r.clientId));
    if (clientIds.size > 1) {
      if (!confirm("Vous avez sélectionné des demandes de clients différents. Voulez-vous vraiment continuer ?")) {
        return;
      }
    }

    setIsBulkApproving(true);
    try {
      for (const req of requestsToApprove) {
        await handleApprove(req);
      }
      setSelectedRequestIds([]);
      alert(`${selectedRequestIds.length} demande(s) validée(s) avec succès.`);
    } catch (error) {
      console.error("Erreur lors de la validation groupée:", error);
      alert("Une erreur est survenue lors de la validation groupée.");
    } finally {
      setIsBulkApproving(false);
    }
  };

  const loadData = () => {
    const currentUser = JSON.parse(localStorage.getItem('microfox_current_user') || '{}');
    const savedRequests = localStorage.getItem('microfox_pending_withdrawals');
    const savedMembers = localStorage.getItem('microfox_members_data');
    let allMembers = savedMembers ? JSON.parse(savedMembers) : [];
    
    // Charger l'historique complet pour chaque membre si stocké séparément
    allMembers = allMembers.map((m: any) => {
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

    if (savedRequests) {
      let requests = JSON.parse(savedRequests).filter((r: any) => !r.isDeleted);
      
      // Filtrage par zone pour l'agent commercial
      if (currentUser?.role === 'agent commercial') {
        const agentZones = currentUser.zonesCollecte || (currentUser.zoneCollecte ? [currentUser.zoneCollecte] : []);
        if (agentZones.length > 0) {
          requests = requests.filter((r: any) => {
            const client = allMembers.find((m: any) => m.id === r.clientId);
            return client && (agentZones.includes(client.zone) || agentZones.includes(client.zoneCollecte));
          });
        }
      }
      setPendingRequests(requests);
    }
    const savedValidated = localStorage.getItem('microfox_validated_withdrawals');
    if (savedValidated) {
      let validated = JSON.parse(savedValidated).filter((r: any) => !r.isDeleted);
      // Filtrage par zone pour l'agent commercial
      if (currentUser?.role === 'agent commercial') {
        const agentZones = currentUser.zonesCollecte || (currentUser.zoneCollecte ? [currentUser.zoneCollecte] : []);
        if (agentZones.length > 0) {
          validated = validated.filter((r: any) => {
            const client = allMembers.find((m: any) => m.id === r.clientId);
            return client && (agentZones.includes(client.zone) || agentZones.includes(client.zoneCollecte));
          });
        }
      }
      setValidatedHistory(validated);
    }
    if (savedMembers) {
      setMembers(allMembers);
    } else {
      // Données par défaut si localStorage vide
      const defaultMembers = [
        {
          id: '1',
          name: 'KOFFI Ama Gertrude',
          code: 'CLT-001254',
          balances: { epargne: 0, tontine: 0, credit: 0, garantie: 0, partSociale: 0 },
          tontineAccounts: [{ id: '1_tn_0', number: 'TN-8829-01', dailyMise: 500, balance: 0 }],
          history: []
        }
      ];
      setMembers(defaultMembers);
      localStorage.setItem('microfox_members_data', JSON.stringify(defaultMembers));
    }
  };

  useEffect(() => {
    loadData();
    window.addEventListener('storage', loadData);
    return () => window.removeEventListener('storage', loadData);
  }, []);

  const handleApprove = (request: any) => {
    const currentUser = JSON.parse(localStorage.getItem('microfox_current_user') || '{}');
    const observed = observedBalances[request.id];
    const disburse = disburseAmounts[request.id];
    const report = reports[request.id] || '';
    const client = members.find(m => m.id === request.clientId);
    
    const activeTontineAccount = client?.tontineAccounts?.find((acc: any) => 
      (request.tontineAccountId && acc.id === request.tontineAccountId) || 
      (request.tontineAccountNumber && acc.number === request.tontineAccountNumber)
    ) || client?.tontineAccounts?.[0];

    let clientHistory = client?.history || [];
    if (clientHistory.length === 0 && client?.id) {
      const savedHistory = localStorage.getItem(`microfox_history_${client.id}`);
      if (savedHistory) clientHistory = JSON.parse(savedHistory);
    }

    const requestTime = new Date(request.date).getTime();
    const historyAtRequest = clientHistory.filter((h: any) => new Date(h.date).getTime() <= requestTime);
    
    const balanceAtRequest = historyAtRequest.length > 0 
      ? [...historyAtRequest].sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime())[0].balance 
      : (activeTontineAccount?.balance || 0);

    const clientPending = [...pendingRequests, ...validatedHistory].filter(r => 
      r.clientId === request.clientId && 
      r.id !== request.id && 
      (r.tontineAccountId === request.tontineAccountId || r.tontineAccountNumber === request.tontineAccountNumber) &&
      new Date(r.date).getTime() <= requestTime
    );
    const isFirstAccount = client?.tontineAccounts?.[0]?.id === activeTontineAccount?.id;
    const tontineStats = (activeTontineAccount && client) ? getTontineStats(balanceAtRequest, activeTontineAccount.dailyMise, historyAtRequest, activeTontineAccount.id, clientPending, isFirstAccount, activeTontineAccount.number) : null;
    const disponible = tontineStats?.netBalance || 0;
    
    const referenceAmount = request.amount;
    const finalAmount = disburse ? Number(disburse) : referenceAmount;
    const livretAmount = observed ? Number(observed) : 0;

    if (isNaN(finalAmount) || finalAmount <= 0) {
      setErrorModal("Le montant à décaisser doit être un nombre valide supérieur à 0.");
      return;
    }

    if (observed && isNaN(Number(observed))) {
      setErrorModal("Le montant dans le livret doit être un nombre valide.");
      return;
    }

    const tontineNumber = request.tontineAccountNumber || activeTontineAccount?.number || request.clientCode;
    let clientZone = request.clientZone || client?.zoneCollecte || client?.zone;

    if (tontineNumber) {
      const cleanNum = tontineNumber.replace('TN-', '');
      if (cleanNum.length >= 3 && /[A-Z]/i.test(cleanNum[2])) {
        clientZone = cleanNum.substring(0, 3);
      } else if (cleanNum.length >= 2) {
        clientZone = cleanNum.substring(0, 2);
      }
    }

    const gap = observed ? (referenceAmount - Number(observed)) : (disburse ? (referenceAmount - Number(disburse)) : 0);

    if (gap !== 0 && !report.trim()) {
      setErrorModal("La raison de la différence est obligatoire en cas d'écart.");
      return;
    }

    const validatedRequest = {
      ...request,
      tontineAccountId: activeTontineAccount?.id,
      tontineAccountNumber: tontineNumber,
      amount: finalAmount,
      originalAmount: request.amount,
      status: 'Validé',
      validationDate: new Date().toISOString(),
      observedBalance: livretAmount,
      disponibleAtValidation: disponible,
      gap: gap,
      report: report,
      zone: clientZone
    };

    const savedValidated = localStorage.getItem('microfox_validated_withdrawals');
    const validatedList = savedValidated ? JSON.parse(savedValidated) : [];
    const updatedValidatedList = [validatedRequest, ...validatedList];
    localStorage.setItem('microfox_validated_withdrawals', JSON.stringify(updatedValidatedList));
    setValidatedHistory(updatedValidatedList);

    // Record in unified gaps if there's a gap
    if (gap !== 0) {
      const savedGaps = localStorage.getItem('microfox_all_gaps');
      const allGaps = savedGaps ? JSON.parse(savedGaps) : [];
      
      // Find the agent currently assigned to this zone
      const tontineNumber = request.tontineAccountNumber || activeTontineAccount?.number || request.clientCode;
      let clientZone = request.clientZone || client?.zoneCollecte || client?.zone;
      
      if (tontineNumber) {
        const cleanNum = tontineNumber.replace('TN-', '');
        if (cleanNum.length >= 3 && /[A-Z]/i.test(cleanNum[2])) {
          clientZone = cleanNum.substring(0, 3);
        } else if (cleanNum.length >= 2) {
          clientZone = cleanNum.substring(0, 2);
        }
      }

      const savedUsers = localStorage.getItem('microfox_users');
      const allUsers = savedUsers ? JSON.parse(savedUsers) : [];
      const zoneAgent = allUsers.find((u: any) => {
        if (u.role !== 'agent commercial') return false;
        const agentZones = u.zonesCollecte || (u.zoneCollecte ? [u.zoneCollecte] : []);
        return agentZones.includes(clientZone);
      });
      const responsibleUserId = zoneAgent?.id || request.userId;

      const currentUser = JSON.parse(localStorage.getItem('microfox_current_user') || '{}');
      const newGapEntry = {
        id: `gap_${Date.now()}`,
        date: new Date().toISOString(),
        type: 'TONTINE',
        sourceId: request.id,
        sourceName: request.clientName,
        sourceCode: tontineNumber,
        userId: responsibleUserId,
        caisse: zoneAgent?.caisse || currentUser?.caisse,
        declaredAmount: referenceAmount,
        observedAmount: observed ? livretAmount : (disburse ? finalAmount : referenceAmount),
        disbursedAmount: finalAmount,
        gapAmount: gap,
        status: 'En attente',
        zone: clientZone,
        observation: `Détails: Décaissé=${finalAmount}F, Livret=${livretAmount}F | Raison: ${report}`,
        validatorId: currentUser.id
      };
      localStorage.setItem('microfox_all_gaps', JSON.stringify([newGapEntry, ...allGaps]));
    }

    // Update pending withdrawals (Soft Delete)
    const savedPending = localStorage.getItem('microfox_pending_withdrawals');
    const allPending = savedPending ? JSON.parse(savedPending) : [];
    const updatedPending = allPending.map((r: any) => r.id === request.id ? { ...r, isDeleted: true } : r);
    localStorage.setItem('microfox_pending_withdrawals', JSON.stringify(updatedPending));
    
    // Update local state (filtering out deleted and applying zone filter)
    setPendingRequests(updatedPending.filter((r: any) => {
      if (r.isDeleted) return false;
      if (currentUser.role === 'agent commercial') {
        const agentZones = currentUser.zonesCollecte || (currentUser.zoneCollecte ? [currentUser.zoneCollecte] : []);
        if (agentZones.length > 0) {
          return agentZones.includes(r.zone) || agentZones.includes(r.zone);
        }
      }
      return true;
    }));

    // Note: Member data and history are NOT updated here. 
    // They will be updated by the cashier during the final disbursement (decaissement).

    localStorage.setItem('microfox_pending_sync', 'true');
    window.dispatchEvent(new Event('storage'));
    setErrorModal(`Demande de ${finalAmount} F validée par le contrôle.`);
  };

  const handleReject = (requestId: string) => {
    const saved = localStorage.getItem('microfox_pending_withdrawals');
    const currentPending = saved ? JSON.parse(saved) : [];
    const updatedRequests = currentPending.map((r: any) => r.id === requestId ? { ...r, isDeleted: true } : r);
    localStorage.setItem('microfox_pending_withdrawals', JSON.stringify(updatedRequests));
    setPendingRequests(updatedRequests.filter((r: any) => !r.isDeleted));
    alert("Demande rejetée.");
  };

  const toggleSelectTx = (txId: string) => {
    setSelectedTxIds(prev => 
      prev.includes(txId) ? prev.filter(id => id !== txId) : [...prev, txId]
    );
  };

  const generateHistoryHTML = () => {
    const filtered = validatedHistory
      .filter(item => {
        const itemDate = new Date(item.validationDate).toISOString().split('T')[0];
        if (startDate && itemDate < startDate) return false;
        if (endDate && itemDate > endDate) return false;
        
        if (selectedZone !== 'all') {
          let itemZone = item.zone;
          if (!itemZone) {
            const tontineNumber = item.tontineAccountNumber || item.clientCode;
            if (tontineNumber) {
              const cleanNum = tontineNumber.replace('TN-', '');
              if (cleanNum.length >= 3 && /[A-Z]/i.test(cleanNum[2])) {
                itemZone = cleanNum.substring(0, 3);
              } else if (cleanNum.length >= 2) {
                itemZone = cleanNum.substring(0, 2);
              }
            }
          }
          if (itemZone !== selectedZone) return false;
        }
        return true;
      });

    const totalDisbursed = filtered.reduce((sum, item) => sum + item.amount, 0);
    const mfConfig = JSON.parse(localStorage.getItem('microfox_mf_config') || '{}');

    return `
      <!DOCTYPE html>
      <html lang="fr">
      <head>
        <meta charset="UTF-8">
        <title>Historique des Vérifications</title>
        <style>
          body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 40px; color: #121c32; }
          .header { text-align: center; margin-bottom: 40px; border-bottom: 2px solid #121c32; padding-bottom: 20px; }
          .mf-name { font-size: 24px; font-weight: 900; text-transform: uppercase; margin: 0; }
          h2 { text-transform: uppercase; font-size: 18px; margin-top: 10px; color: #666; }
          .meta { font-size: 12px; color: #888; margin-top: 5px; }
          table { width: 100%; border-collapse: collapse; margin-top: 20px; }
          th { background-color: #121c32; color: white; text-align: left; padding: 12px 8px; font-size: 10px; text-transform: uppercase; letter-spacing: 1px; }
          td { border-bottom: 1px solid #eee; padding: 12px 8px; font-size: 11px; font-weight: 500; }
          .gap-neg { color: #dc2626; font-weight: 900; }
          .gap-pos { color: #059669; font-weight: 900; }
          .footer { margin-top: 40px; font-size: 10px; text-align: center; color: #aaa; }
          @media print {
            body { padding: 0; }
            .no-print { display: none; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="mf-name">${mfConfig.nom || 'MicroFox'}</div>
          <h2>Historique des Vérifications de Retrait Tontine</h2>
          <div class="meta">
            Période: ${startDate || 'Début'} au ${endDate || 'Fin'} | 
            Zone: ${selectedZone === 'all' ? 'Toutes les zones' : selectedZone} |
            Généré le: ${new Date().toLocaleString()}
          </div>
        </div>
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Client</th>
              <th>Compte</th>
              <th>Intervalle</th>
              <th>Demandé</th>
              <th>Livret</th>
              <th>Validé</th>
              <th>Écart</th>
              <th>Raison</th>
            </tr>
          </thead>
          <tbody>
            ${filtered.map(item => `
              <tr>
                <td>${new Date(item.validationDate).toLocaleDateString()}</td>
                <td>${item.clientName}</td>
                <td>${item.tontineAccountNumber || item.clientCode}</td>
                <td>${item.reason || ''}</td>
                <td>${(item.originalAmount || item.amount).toLocaleString()} F</td>
                <td>${(item.observedBalance || 0).toLocaleString()} F</td>
                <td>${item.amount.toLocaleString()} F</td>
                <td class="${(item.gap || 0) < 0 ? 'gap-neg' : 'gap-pos'}">
                  ${item.gap ? (item.gap > 0 ? '+' : '') + item.gap.toLocaleString() + ' F' : '0 F'}
                </td>
                <td>${item.report || ''}</td>
              </tr>
            `).join('')}
          </tbody>
          <tfoot>
            <tr style="background-color: #f8fafc; font-weight: 900;">
              <td colspan="6" style="text-align: right; padding: 12px 8px; border-top: 2px solid #121c32;">TOTAL DÉCAISSÉ:</td>
              <td style="padding: 12px 8px; border-top: 2px solid #121c32; font-size: 12px;">${totalDisbursed.toLocaleString()} F</td>
              <td colspan="2" style="border-top: 2px solid #121c32;"></td>
            </tr>
          </tfoot>
        </table>
        
        <div style="margin-top: 60px; display: flex; justify-content: space-between; padding: 0 40px;">
          <div style="text-align: center;">
            <p style="font-weight: 900; text-transform: uppercase; font-size: 12px; margin-bottom: 60px;">Signature de l'Auditeur</p>
            <div style="border-top: 1px solid #121c32; width: 200px;"></div>
          </div>
          <div style="text-align: center;">
            <p style="font-weight: 900; text-transform: uppercase; font-size: 12px; margin-bottom: 60px;">Signature de l'Agent Commercial</p>
            <div style="border-top: 1px solid #121c32; width: 200px;"></div>
          </div>
        </div>

        <div class="footer">
          Document généré par MicroFox - Système de Gestion de Microfinance
        </div>
      </body>
      </html>
    `;
  };

  const handlePrintHistory = () => {
    const html = generateHistoryHTML();
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(html);
      printWindow.document.close();
      setTimeout(() => {
        printWindow.print();
      }, 500);
    }
  };

  const handleExportHistory = () => {
    const html = generateHistoryHTML();
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `historique_verifications_${new Date().toISOString().split('T')[0]}.html`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const filteredRequests = pendingRequests.filter(r => 
    r.clientName.toLowerCase().includes(searchTerm.toLowerCase()) || 
    r.clientCode.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12">
      <div className="flex justify-between items-start px-4 lg:px-0">
        <div>
          <h1 className="text-xl lg:text-2xl font-extrabold text-white uppercase tracking-tight leading-tight">
            Vérification<br />de retrait tontine
          </h1>
          <p className="text-white/60 text-[10px] lg:text-[11px] font-bold uppercase tracking-widest mt-1">Validation des demandes de retrait</p>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 text-blue-600 rounded-lg border border-blue-100 text-xs font-bold self-start">
          <ShieldCheck size={16} />
          <span>CONTRÔLE</span>
        </div>
      </div>

      <div className="bg-white p-4 rounded-[1.5rem] shadow-sm border border-gray-100 mx-4 lg:mx-0 flex flex-col md:flex-row gap-4 items-center">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-600" size={20} />
          <input 
            type="text" 
            placeholder="Rechercher une demande par client..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-12 pr-4 py-4 bg-white border-2 border-[#00c896] rounded-2xl font-medium outline-none placeholder:text-gray-500 text-[#121c32] text-sm lg:text-base"
          />
        </div>
        {selectedRequestIds.length > 0 && (
          <button
            onClick={handleBulkApprove}
            disabled={isBulkApproving}
            className="flex items-center gap-2 px-6 py-4 bg-blue-600 text-white rounded-2xl font-black uppercase tracking-tight shadow-lg hover:bg-blue-700 transition-all active:scale-95 disabled:opacity-50 whitespace-nowrap"
          >
            {isBulkApproving ? <Clock className="animate-spin" size={20} /> : <CheckCircle size={20} />}
            Valider ({selectedRequestIds.length})
          </button>
        )}
      </div>

      <div className="bg-white rounded-[1.5rem] shadow-sm border border-gray-100 overflow-hidden mx-4 lg:mx-0">
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-gray-50 bg-gray-50/50">
                <th className="px-4 py-4 text-[10px] font-black text-gray-600 uppercase tracking-widest w-10">
                  <input 
                    type="checkbox" 
                    checked={selectedRequestIds.length === filteredRequests.length && filteredRequests.length > 0}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedRequestIds(filteredRequests.map(r => r.id));
                      } else {
                        setSelectedRequestIds([]);
                      }
                    }}
                    className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                </th>
                <th className="px-4 py-4 text-[10px] font-black text-gray-600 uppercase tracking-widest w-10"></th>
                <th className="px-2 py-4 text-[10px] font-black text-gray-600 uppercase tracking-widest">Client</th>
                <th className="px-4 py-4 text-[10px] font-black text-gray-600 uppercase tracking-widest">Montant Demande</th>
                <th className="hidden lg:table-cell px-4 py-4 text-[10px] font-black text-gray-600 uppercase tracking-widest">Intervalle</th>
                <th className="px-4 py-4 text-[10px] font-black text-gray-600 uppercase tracking-widest">Solde Dispo</th>
                <th className="px-4 py-4 text-[10px] font-black text-gray-600 uppercase tracking-widest text-center">Montant dans livret tontine</th>
                <th className="px-4 py-4 text-[10px] font-black text-gray-600 uppercase tracking-widest text-center">Montant à décaisser</th>
                <th className="px-4 py-4 text-[10px] font-black text-gray-600 uppercase tracking-widest">Raison de la différence</th>
                <th className="px-4 py-4 text-[10px] font-black text-gray-600 uppercase tracking-widest text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filteredRequests.length > 0 ? (
                filteredRequests.map(request => {
                  const client = members.find(m => m.id === request.clientId);
                  const observed = observedBalances[request.id];
                  const disburse = disburseAmounts[request.id];
                  const report = reports[request.id];
                  
                  const activeTontineAccount = client?.tontineAccounts?.find((acc: any) => 
                    (request.tontineAccountId && acc.id === request.tontineAccountId) || 
                    (request.tontineAccountNumber && acc.number === request.tontineAccountNumber)
                  ) || client?.tontineAccounts?.[0];

                  let clientHistory = client?.history || [];
                  if (clientHistory.length === 0 && client?.id) {
                    const savedHistory = localStorage.getItem(`microfox_history_${client.id}`);
                    if (savedHistory) clientHistory = JSON.parse(savedHistory);
                  }

                  const requestTime = new Date(request.date).getTime();
                  const historyAtRequest = clientHistory.filter((h: any) => new Date(h.date).getTime() <= requestTime);
                  
                  const balanceAtRequest = historyAtRequest.length > 0 
                    ? [...historyAtRequest].sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime())[0].balance 
                    : (activeTontineAccount?.balance || 0);

                  const clientPending = [...pendingRequests, ...validatedHistory].filter(r => 
                    r.clientId === client.id && 
                    r.id !== request.id && 
                    (r.tontineAccountId === request.tontineAccountId || r.tontineAccountNumber === request.tontineAccountNumber) &&
                    new Date(r.date).getTime() <= requestTime
                  );

                  const isFirstAccount = client?.tontineAccounts?.[0]?.id === activeTontineAccount?.id;
                  const tontineStats = (activeTontineAccount && client) ? getTontineStats(balanceAtRequest, activeTontineAccount.dailyMise, historyAtRequest, activeTontineAccount.id, clientPending, isFirstAccount, activeTontineAccount.number) : null;
                  const isExpanded = expandedRequestId === request.id;

                  const referenceAmount = request.amount;
                  const currentDisburse = Number(disburse || referenceAmount);
                  const currentLivret = Number(observed || 0);
                  const gapValue = observed ? (referenceAmount - currentLivret) : (disburse ? (referenceAmount - currentDisburse) : 0);

                  const filteredClientHistory = historyAtRequest.filter((tx: any) => 
                    tx.account === 'tontine' && (
                      tx.tontineAccountId === activeTontineAccount?.id || 
                      tx.tontineAccountNumber === activeTontineAccount?.number ||
                      (!tx.tontineAccountId && !tx.tontineAccountNumber && (
                        (isFirstAccount && !tx.description?.includes('Compte:')) ||
                        tx.description?.includes(activeTontineAccount?.number || '')
                      ))
                    )
                  );
                  const selectedSum = filteredClientHistory
                    .filter((tx: any) => selectedTxIds.includes(tx.id))
                    .reduce((acc: number, tx: any) => acc + tx.amount, 0);

                    return (
                      <React.Fragment key={request.id}>
                        <tr 
                          className={`hover:bg-gray-50 transition-colors cursor-pointer ${isExpanded ? 'bg-gray-50/50' : ''} ${selectedRequestIds.includes(request.id) ? 'bg-blue-50/50' : ''}`} 
                          onClick={() => {
                            setExpandedRequestId(isExpanded ? null : request.id);
                            setSelectedTxIds([]);
                          }}
                        >
                          <td className="px-4 py-4" onClick={(e) => e.stopPropagation()}>
                            <input 
                              type="checkbox" 
                              checked={selectedRequestIds.includes(request.id)}
                              onChange={() => toggleSelectRequest(request.id)}
                              className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                            />
                          </td>
                          <td className="px-4 py-4">
                            {isExpanded ? <ChevronUp size={18} className="text-gray-600" /> : <ChevronDown size={18} className="text-gray-600" />}
                          </td>
                          <td className="px-2 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 lg:w-10 lg:h-10 rounded-full bg-[#121c32] text-white flex items-center justify-center font-black text-[9px] lg:text-[10px] shrink-0">
                              {request.clientName.split(' ').map((n: string) => n[0]).join('')}
                            </div>
                            <div className="min-w-0">
                              <p className="text-xs lg:text-sm font-black text-[#121c32] uppercase truncate">{request.clientName}</p>
                              <p className="text-[9px] lg:text-[10px] font-bold text-gray-600 uppercase">
                                {request.tontineAccountNumber ? `Compte: ${request.tontineAccountNumber}` : request.clientCode}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex flex-col">
                            <span className="text-xs lg:text-sm font-black text-red-600">{referenceAmount.toLocaleString()}</span>
                            <span className="text-[9px] lg:text-[10px] font-black text-red-600 uppercase">FCFA</span>
                          </div>
                        </td>
                        <td className="hidden lg:table-cell px-4 py-4">
                          <div className="flex flex-col gap-1 items-center">
                            <span className="text-[10px] font-black text-amber-600 bg-amber-50 px-2 py-1 rounded border border-amber-100 uppercase block text-center">
                              {request.reason}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <span className="text-xs lg:text-sm font-black text-blue-600">{(tontineStats?.netBalance || 0).toLocaleString()} F</span>
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex flex-col gap-1" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center gap-2 bg-white px-2 py-1 rounded-xl border border-gray-100 focus-within:border-[#00c896] transition-all">
                              <input 
                                type="number" 
                                placeholder="Livret"
                                value={observed || ''}
                                onChange={(e) => setObservedBalances({...observedBalances, [request.id]: e.target.value})}
                                className="w-20 bg-transparent text-xs font-black text-[#121c32] outline-none"
                              />
                            </div>
                            {gapValue !== 0 && (
                              <span className={`text-[9px] font-black uppercase text-center ${gapValue < 0 ? 'text-red-500' : 'text-emerald-500'}`}>
                                Écart {gapValue < 0 ? 'négatif' : 'positif'}: {gapValue > 0 ? '+' : ''}{gapValue.toLocaleString()} F
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex flex-col gap-1" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center gap-2 bg-emerald-50 px-2 py-1 rounded-xl border border-emerald-100 focus-within:border-[#00c896] transition-all">
                              <input 
                                type="number" 
                                placeholder="À payer"
                                value={disburse || referenceAmount}
                                onChange={(e) => setDisburseAmounts({...disburseAmounts, [request.id]: e.target.value})}
                                className="w-20 lg:w-24 bg-transparent text-xs font-black text-emerald-700 outline-none text-center"
                              />
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex items-center gap-2 bg-white px-2 py-1 rounded-xl border border-gray-100 focus-within:border-[#00c896] transition-all" onClick={(e) => e.stopPropagation()}>
                            <input 
                              type="text" 
                              placeholder="Raison..."
                              value={report || ''}
                              onChange={(e) => setReports({...reports, [request.id]: e.target.value})}
                              className={`w-24 lg:w-full bg-transparent text-xs font-black text-[#121c32] outline-none ${gapValue !== 0 && !report ? 'placeholder:text-red-400' : ''}`}
                            />
                          </div>
                        </td>
                        <td className="px-4 py-4 text-right">
                          <div className="flex items-center justify-end gap-1 lg:gap-2" onClick={(e) => e.stopPropagation()}>
                            <button 
                              onClick={() => handleReject(request.id)}
                              className="p-1.5 lg:p-2 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                              title="Rejeter"
                            >
                              <XCircle size={18} lg:size={22} />
                            </button>
                            <button 
                              onClick={() => handleApprove(request)}
                              className="p-1.5 lg:p-2 text-gray-300 hover:text-emerald-500 hover:bg-emerald-50 rounded-lg transition-all"
                              title="Valider pour paiement"
                            >
                              <CheckCircle size={18} lg:size={22} />
                            </button>
                          </div>
                        </td>
                      </tr>
                      
                      {isExpanded && (
                        <tr className="bg-gray-50/30">
                          <td colSpan={9} className="px-4 py-6 lg:px-8 lg:py-8 border-b border-gray-100">
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                              <div className="space-y-4">
                                <div className="flex items-center justify-between mb-2">
                                  <div className="flex items-center gap-2">
                                    <History size={18} className="text-[#121c32]" />
                                    <h4 className="text-xs font-black text-[#121c32] uppercase tracking-widest">Journal des cotisations</h4>
                                  </div>
                                  {selectedSum > 0 && (
                                    <div className="bg-blue-600 text-white px-3 py-1 rounded-lg text-[10px] font-black animate-in zoom-in-95 flex items-center gap-1.5 shadow-sm">
                                      <CheckSquare size={12} />
                                      CUMUL: {selectedSum.toLocaleString()} F
                                    </div>
                                  )}
                                </div>
                                <div className="space-y-2 max-h-[250px] lg:max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                                  {filteredClientHistory.length > 0 ? (
                                    filteredClientHistory.map((tx: any) => (
                                      <div 
                                        key={tx.id} 
                                        onClick={() => toggleSelectTx(tx.id)}
                                        className={`p-3 rounded-xl border flex items-center justify-between shadow-sm cursor-pointer transition-all ${selectedTxIds.includes(tx.id) ? 'bg-blue-50 border-blue-200' : 'bg-white border-gray-100 hover:bg-gray-50'}`}
                                      >
                                        <div className="flex items-center gap-3">
                                          <div className={`shrink-0 w-5 h-5 rounded border flex items-center justify-center transition-colors ${selectedTxIds.includes(tx.id) ? 'bg-blue-600 border-blue-600 text-white' : 'bg-gray-50 border-gray-300'}`}>
                                            {selectedTxIds.includes(tx.id) ? <Check size={14} /> : null}
                                          </div>
                                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${tx.type === 'cotisation' || tx.type === 'depot' ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}`}>
                                            {tx.type === 'cotisation' || tx.type === 'depot' ? <ArrowDownLeft size={14} /> : <ArrowUpRight size={14} />}
                                          </div>
                                          <div>
                                            <p className="text-[10px] font-black text-[#121c32] uppercase">{tx.description}</p>
                                            <p className="text-[8px] font-bold text-gray-600 uppercase">{new Date(tx.date).toLocaleDateString()} • {new Date(tx.date).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</p>
                                          </div>
                                        </div>
                                        <div className="text-right">
                                          <span className={`text-[10px] font-black block ${tx.type === 'cotisation' || tx.type === 'depot' ? 'text-emerald-600' : 'text-red-600'}`}>
                                            {tx.type === 'cotisation' || tx.type === 'depot' ? '+' : '-'}{tx.amount.toLocaleString()} F
                                          </span>
                                          <div className="flex flex-col items-end gap-0.5 mt-0.5">
                                            <p className="text-[8px] font-bold text-gray-500 uppercase">Avant: {tx.balanceBefore?.toLocaleString() || '---'} F</p>
                                            <p className="text-[8px] font-black text-blue-400 uppercase">Solde: {tx.balance?.toLocaleString() || '---'} F</p>
                                          </div>
                                        </div>
                                      </div>
                                    ))
                                  ) : (
                                    <p className="text-[10px] text-gray-600 italic">Aucun historique disponible.</p>
                                  )}
                                </div>
                              </div>

                              <div className="space-y-4">
                                <div className="flex items-center gap-2 mb-2">
                                  <LayoutGrid size={18} className="text-[#00c896]" />
                                  <h4 className="text-xs font-black text-[#121c32] uppercase tracking-widest">Grille des cases</h4>
                                </div>
                                
                                {tontineStats ? (
                                  <div className="space-y-6 max-w-sm">
                                    {(() => {
                                      const requestedCycles = request.reason?.includes('Cycles:') 
                                        ? request.reason.split('Cycles:')[1].split(',').map((s: string) => parseInt(s.trim())).filter((n: number) => !isNaN(n))
                                        : [];
                                      
                                      if (requestedCycles.length > 0) {
                                        return [...requestedCycles].reverse().map((cycleIdx: number) => {
                                          const cycleData = tontineStats.cycleDetails.find((c: any) => c.index === cycleIdx);
                                          if (!cycleData) return null;
                                          return (
                                            <div key={cycleIdx} className="space-y-2 pb-4 border-b border-gray-50 last:border-0">
                                              <div className="flex items-center justify-between mb-1">
                                                <span className="text-[10px] font-black text-[#121c32] uppercase">Cycle {cycleIdx}</span>
                                                <span className="text-[9px] font-bold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-100 uppercase">
                                                  {cycleData.period}
                                                </span>
                                              </div>
                                              <div className="grid grid-cols-7 gap-1 lg:gap-1.5">
                                                {Array.from({ length: 31 }).map((_, i) => {
                                                  const caseNum = i + 1;
                                                  const isPaid = i < cycleData.dates.length;
                                                  const isCommission = caseNum === 1;
                                                  return (
                                                    <div 
                                                      key={i} 
                                                      className={`aspect-square rounded-lg flex items-center justify-center text-[8px] lg:text-[9px] font-black transition-all border
                                                        ${isPaid 
                                                          ? (isCommission ? 'bg-indigo-600 border-indigo-700 text-white shadow-sm' : 'bg-[#00c896] border-[#00c896] text-white shadow-sm') 
                                                          : isCommission 
                                                            ? 'bg-amber-50 border-amber-200 text-amber-500' 
                                                            : 'bg-white border-gray-100 text-gray-500'
                                                        }
                                                      `}
                                                    >
                                                      {isPaid ? cycleData.dates[i] : (isCommission ? 'COM' : caseNum)}
                                                    </div>
                                                  );
                                                })}
                                              </div>
                                            </div>
                                          );
                                        });
                                      }

                                      return (
                                        <div className="space-y-4">
                                          <div className="flex items-center justify-between mb-1">
                                            <span className="text-[10px] font-black text-[#121c32] uppercase">Cycle {tontineStats.cycles} (En cours)</span>
                                          </div>
                                          <div className="grid grid-cols-7 gap-1 lg:gap-1.5">
                                            {Array.from({ length: 31 }).map((_, i) => {
                                              const caseNum = i + 1;
                                              const isPaid = caseNum <= tontineStats.currentCycleCases;
                                              const isCommission = caseNum === 1;
                                              const isEmptyCycle = tontineStats.currentCycleCases === 0;
                                              const isCurrentCycleRetire = tontineStats.cycleDetails[tontineStats.cycleDetails.length - 1]?.isRetire;

                                              return (
                                                <div 
                                                  key={i} 
                                                  className={`aspect-square rounded-lg flex items-center justify-center text-[8px] lg:text-[9px] font-black transition-all border
                                                    ${isPaid 
                                                      ? (isCommission ? 'bg-indigo-600 border-indigo-700 text-white shadow-sm' : 'bg-[#00c896] border-[#00c896] text-white shadow-sm') 
                                                      : isCommission 
                                                        ? (isEmptyCycle ? 'bg-amber-400 border-amber-500 text-white animate-pulse' : 'bg-amber-50 border-amber-200 text-amber-500') 
                                                        : 'bg-white border-gray-100 text-gray-500'
                                                    }
                                                  `}
                                                >
                                                  {isPaid 
                                                    ? tontineStats.currentCycleDates[i] 
                                                    : (isCommission ? 'COM' : caseNum)
                                                  }
                                                </div>
                                              );
                                            })}
                                          </div>
                                        </div>
                                      );
                                    })()}

                                    <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm space-y-3">
                                      <div className="flex justify-between items-center">
                                        <span className="text-[9px] font-black text-gray-600 uppercase">Cycle actuel:</span>
                                        <span className="text-[10px] font-black text-[#121c32]">CYCLE {tontineStats.cycles}</span>
                                      </div>
                                      <div className="flex justify-between items-center">
                                        <span className="text-[9px] font-black text-gray-600 uppercase">Mise:</span>
                                        <span className="text-[10px] font-black text-[#121c32]">{activeTontineAccount?.dailyMise} F</span>
                                      </div>
                                      <div className="flex justify-between items-center pt-2 border-t border-gray-50">
                                        <span className="text-[9px] font-black text-emerald-600 uppercase">Net décaissable (Total):</span>
                                        <span className="text-xs font-black text-emerald-600">{tontineStats.netBalance.toLocaleString()} F</span>
                                      </div>
                                    </div>
                                  </div>
                                ) : (
                                  <p className="text-[10px] text-gray-600 italic">Données de cycle indisponibles.</p>
                                )}
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={9} className="px-6 py-20 text-center">
                    <div className="flex flex-col items-center gap-3 opacity-20">
                      <FileText size={48} />
                      <p className="text-sm font-black uppercase tracking-widest text-gray-600">Aucune demande en attente</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {validatedHistory.length > 0 && (
        <div className="bg-white rounded-[1.5rem] shadow-sm border border-gray-100 overflow-hidden mx-4 lg:mx-0">
          <div className="p-4 bg-gray-50 border-b border-gray-100 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="flex items-center justify-between w-full lg:w-auto">
              <h3 className="text-xs font-black text-[#121c32] uppercase tracking-widest flex items-center gap-2">
                <History size={16} /> Historique des vérifications
              </h3>
              <div className="flex lg:hidden items-center gap-2">
                <button onClick={handlePrintHistory} className="p-2 text-gray-400 hover:text-[#121c32] transition-colors" title="Imprimer">
                  <Printer size={18} />
                </button>
                <button onClick={handleExportHistory} className="p-2 text-gray-400 hover:text-[#121c32] transition-colors" title="Exporter">
                  <Download size={18} />
                </button>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <select
                  value={selectedZone}
                  onChange={(e) => setSelectedZone(e.target.value)}
                  className="text-[10px] font-black uppercase border border-gray-200 rounded-md px-2 py-1 outline-none focus:border-blue-500 bg-white text-[#121c32]"
                >
                  <option value="all">Toutes les zones</option>
                  {['01','01A','02','02A','03','03A','04','04A','05','05A','06','06A','07','07A','08','08A','09','09A'].map(zone => (
                    <option key={zone} value={zone}>{zone}</option>
                  ))}
                </select>
                <input 
                  type="date" 
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="text-[10px] font-black uppercase border border-gray-200 rounded-md px-2 py-1 outline-none focus:border-blue-500 bg-white text-[#121c32]"
                />
                <span className="text-[10px] font-black text-gray-400">AU</span>
                <input 
                  type="date" 
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="text-[10px] font-black uppercase border border-gray-200 rounded-md px-2 py-1 outline-none focus:border-blue-500 bg-white text-[#121c32]"
                />
              </div>
              <div className="hidden lg:flex items-center gap-1 border-l border-gray-200 pl-3">
                <button onClick={handlePrintHistory} className="p-2 text-gray-400 hover:text-[#121c32] transition-colors" title="Imprimer">
                  <Printer size={18} />
                </button>
                <button onClick={handleExportHistory} className="p-2 text-gray-400 hover:text-[#121c32] transition-colors" title="Exporter">
                  <Download size={18} />
                </button>
              </div>
              <div className="flex items-center gap-2">
                {validatedHistory.filter(item => {
                  const itemDate = new Date(item.validationDate).toISOString().split('T')[0];
                  if (startDate && itemDate < startDate) return false;
                  if (endDate && itemDate > endDate) return false;
                  
                  if (selectedZone !== 'all') {
                    let itemZone = item.zone;
                    if (!itemZone) {
                      const tontineNumber = item.tontineAccountNumber || item.clientCode;
                      if (tontineNumber) {
                        const cleanNum = tontineNumber.replace('TN-', '');
                        if (cleanNum.length >= 3 && /[A-Z]/i.test(cleanNum[2])) {
                          itemZone = cleanNum.substring(0, 3);
                        } else if (cleanNum.length >= 2) {
                          itemZone = cleanNum.substring(0, 2);
                        }
                      }
                    }
                    if (itemZone !== selectedZone) return false;
                  }
                  return true;
                }).reduce((sum, item) => sum + item.amount, 0) > 0 && (
                  <span className="bg-blue-600 text-white px-2 py-0.5 rounded-md text-[10px] font-black uppercase">
                    Total: {validatedHistory.filter(item => {
                      const itemDate = new Date(item.validationDate).toISOString().split('T')[0];
                      if (startDate && itemDate < startDate) return false;
                      if (endDate && itemDate > endDate) return false;
                      
                      if (selectedZone !== 'all') {
                        let itemZone = item.zone;
                        if (!itemZone) {
                          const tontineNumber = item.tontineAccountNumber || item.clientCode;
                          if (tontineNumber) {
                            const cleanNum = tontineNumber.replace('TN-', '');
                            if (cleanNum.length >= 3 && /[A-Z]/i.test(cleanNum[2])) {
                              itemZone = cleanNum.substring(0, 3);
                            } else if (cleanNum.length >= 2) {
                              itemZone = cleanNum.substring(0, 2);
                            }
                          }
                        }
                        if (itemZone !== selectedZone) return false;
                      }
                      return true;
                    }).reduce((sum, item) => sum + item.amount, 0).toLocaleString()} F
                  </span>
                )}
                {validatedHistory.filter(item => item.gap && item.gap > 0).length > 0 && (
                  <span className="bg-emerald-600 text-white px-2 py-0.5 rounded-md text-[10px] font-black flex items-center gap-1">
                    <ArrowUpRight size={10} />
                    {validatedHistory.filter(item => item.gap && item.gap > 0).length} ÉCARTS POSITIFS
                  </span>
                )}
                <span className="bg-emerald-100 text-emerald-600 px-2 py-0.5 rounded-md text-[10px] font-black">{validatedHistory.length}</span>
              </div>
            </div>
          </div>
          <div className="divide-y divide-gray-50 max-h-[300px] lg:max-h-[400px] overflow-y-auto custom-scrollbar">
            {validatedHistory
              .filter(item => {
                const itemDate = new Date(item.validationDate).toISOString().split('T')[0];
                if (startDate && itemDate < startDate) return false;
                if (endDate && itemDate > endDate) return false;
                
                if (selectedZone !== 'all') {
                  let itemZone = item.zone;
                  if (!itemZone) {
                    const tontineNumber = item.tontineAccountNumber || item.clientCode;
                    if (tontineNumber) {
                      const cleanNum = tontineNumber.replace('TN-', '');
                      if (cleanNum.length >= 3 && /[A-Z]/i.test(cleanNum[2])) {
                        itemZone = cleanNum.substring(0, 3);
                      } else if (cleanNum.length >= 2) {
                        itemZone = cleanNum.substring(0, 2);
                      }
                    }
                  }
                  if (itemZone !== selectedZone) return false;
                }
                return true;
              })
              .map(item => (
              <div key={item.id} className="p-4 flex items-center justify-between hover:bg-gray-50 transition-colors">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center">
                    <Check size={20} />
                  </div>
                  <div>
                    <p className="text-sm font-black text-[#121c32] uppercase">{item.clientName}</p>
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-2">
                        <p className="text-[10px] font-bold text-gray-600 uppercase">
                          {new Date(item.validationDate).toLocaleDateString()} • {item.tontineAccountNumber || item.clientCode} • Demandé: {item.originalAmount?.toLocaleString() || item.amount.toLocaleString()} F • Livret: {item.observedBalance?.toLocaleString() || 0} F • Validé: {item.amount.toLocaleString()} F • {item.reason}
                        </p>
                        {item.gap !== undefined && (
                          <span className={`text-[9px] font-black px-1.5 py-0.5 rounded ${item.gap < 0 ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-600'} uppercase`}>
                            Écart {item.gap < 0 ? 'négatif' : 'positif'}: {item.gap > 0 ? '+' : ''}{item.gap.toLocaleString()} F
                          </span>
                        )}
                      </div>
                      {item.report && (
                        <p className="text-[11px] font-black text-gray-700 uppercase tracking-tight break-words">
                          <span className="text-[#121c32]">Raison:</span> {item.report}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <span className="bg-emerald-50 text-emerald-600 px-2.5 py-1 rounded-lg text-[10px] font-black uppercase">
                    Validé
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="bg-[#eff6ff] rounded-[2rem] p-6 border border-blue-100 flex gap-4 mx-4 lg:mx-0">
        <AlertCircle className="text-blue-500 shrink-0" size={24} />
        <div>
          <h4 className="text-[10px] font-black text-blue-600 uppercase tracking-widest mb-1">Rôle du vérificateur</h4>
          <p className="text-[11px] text-blue-500 font-medium leading-relaxed">
            Avant toute validation, le contrôleur doit s'assurer de la présence physique du membre, de la vérification de son livret de tontine et de la conformité de sa signature.
          </p>
        </div>
      </div>

      {/* Modal d'Erreur / Information */}
      {errorModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[110] flex items-center justify-center p-4">
          <div className="bg-white rounded-[2rem] w-full max-w-md p-8 shadow-2xl animate-in fade-in zoom-in duration-200">
            <div className="flex flex-col items-center text-center space-y-4">
              <div className={`w-16 h-16 rounded-full flex items-center justify-center ${errorModal.includes('validée') ? 'bg-emerald-50 text-emerald-500' : 'bg-red-50 text-red-500'}`}>
                {errorModal.includes('validée') ? <CheckCircle size={32} /> : <AlertCircle size={32} />}
              </div>
              <h3 className="text-xl font-black text-[#121c32] uppercase tracking-tight">
                {errorModal.includes('validée') ? 'Succès' : 'Validation impossible'}
              </h3>
              <p className="text-gray-500 font-medium leading-relaxed">{errorModal}</p>
              <button 
                onClick={() => setErrorModal(null)}
                className="w-full px-6 py-3 bg-[#121c32] text-white rounded-2xl font-black uppercase text-xs tracking-widest hover:bg-[#1a2947] transition-all active:scale-95 shadow-lg shadow-[#121c32]/20"
              >
                Continuer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TontineVerification;