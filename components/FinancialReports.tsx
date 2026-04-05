
import React, { useState, useEffect } from 'react';
import { Search, Calendar, Download, Printer, FileText, TrendingUp, Wallet, CreditCard, BookOpen, MapPin, Calculator, CheckSquare, Square, UserPlus, Users, Lock, AlertTriangle, X, History as HistoryIcon, Landmark } from 'lucide-react';

const FinancialReports: React.FC = () => {
  const [startDate, setStartDate] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
  });

  const [currentUser, setCurrentUser] = useState<any>(null);
  const [selectedCaisse, setSelectedCaisse] = useState<string[]>(['all']);

  const savedUsers = localStorage.getItem('microfox_users');
  const allUsers = savedUsers ? JSON.parse(savedUsers) : [];
  
  const userStr = localStorage.getItem('microfox_current_user');
  const user = userStr ? JSON.parse(userStr) : null;
  const isAdminOrDirector = user?.role === 'administrateur' || user?.role === 'directeur';

  const availableCaisses = Array.from(new Set([
    ...(isAdminOrDirector ? ['CAISSE PRINCIPALE'] : []),
    ...allUsers.filter((u: any) => u.role === 'caissier' && u.caisse).map((u: any) => u.caisse), 
    'CAISSE 1', 'CAISSE 2', 'CAISSE 3', 'CAISSE 4'
  ])) as string[];

  const [data, setData] = useState<{
    epargneDepots: any[];
    epargneRetraits: any[];
    cashGaps: any[];
    tontineDepotsByZone: Record<string, any[]>;
    tontineRetraitsByZone: Record<string, any[]>;
    creditsAccordes: any[];
    remboursements: any[];
    livretsTontineByZone: Record<string, any[]>;
    livretsEpargne: any[];
    garantieDepots: any[];
    garantieRetraits: any[];
    adminExpenses: any[];
    agentPayments: any[];
    vaultTransactions: any[];
    validatedWithdrawals: any[];
    openingBalance: number;
  }>({
    epargneDepots: [],
    epargneRetraits: [],
    cashGaps: [],
    tontineDepotsByZone: {},
    tontineRetraitsByZone: {},
    creditsAccordes: [],
    remboursements: [],
    livretsTontineByZone: {},
    livretsEpargne: [],
    garantieDepots: [],
    garantieRetraits: [],
    adminExpenses: [],
    agentPayments: [],
    vaultTransactions: [],
    validatedWithdrawals: [],
    openingBalance: 0
  });

  const zones = ['01', '01A', '02', '02A', '03', '03A', '04', '04A', '05', '05A', '06', '06A', '07', '07A', '08', '08A', '09', '09A'];

  const getZoneFromCode = (code: string) => {
    if (!code) return 'Inconnue';
    for (const zone of zones) {
      if (code.includes(`-${zone}`) || code.includes(` ${zone}`) || code.endsWith(zone) || code.startsWith(zone)) {
        return zone;
      }
    }
    return 'Inconnue';
  };

  const loadData = () => {
    const userStr = localStorage.getItem('microfox_current_user');
    const user = userStr ? JSON.parse(userStr) : null;
    const isCaissier = user?.role === 'caissier';

    const newData: any = {
      epargneDepots: [],
      epargneRetraits: [],
      cashGaps: [],
      tontineDepotsByZone: {},
      tontineRetraitsByZone: {},
      creditsAccordes: [],
      remboursements: [],
      livretsTontineByZone: {},
      livretsEpargne: [],
      garantieDepots: [],
      garantieRetraits: [],
      adminExpenses: [],
      agentPayments: [],
      vaultTransactions: [],
      validatedWithdrawals: [],
      openingBalance: 0
    };

    const getCaisseDelta = (tx: any) => {
      if (tx.type === 'depot' || tx.type === 'cotisation' || tx.type === 'remboursement') return tx.amount;
      if (tx.type === 'retrait' || tx.type === 'deblocage') return -tx.amount;
      return 0;
    };

    zones.forEach(z => {
      newData.tontineDepotsByZone[z] = [];
      newData.tontineRetraitsByZone[z] = [];
      newData.livretsTontineByZone[z] = [];
    });
    newData.tontineDepotsByZone['Inconnue'] = [];
    newData.tontineRetraitsByZone['Inconnue'] = [];
    newData.livretsTontineByZone['Inconnue'] = [];

    const saved = localStorage.getItem('microfox_members_data');
    if (saved) {
      const allMembers = JSON.parse(saved);
      allMembers.forEach((member: any) => {
        const history = member.history || [];
        const memberZone = member.zone || getZoneFromCode(member.code || '');

        history.forEach((tx: any) => {
          const txUser = allUsers.find((u: any) => u.id === tx.userId);
          const txCaisse = tx.caisse || txUser?.caisse || 'N/A';
          
          if (isCaissier) {
            const isMyOp = tx.userId === user.id || (tx.cashierName && tx.cashierName === user.identifiant);
            if (!isMyOp) return;
          }
          if (!selectedCaisse.includes('all') && !selectedCaisse.some(c => c.toUpperCase() === txCaisse.toUpperCase())) return;
          
          const txDate = tx.date.split('T')[0];
          
          // Calculate opening balance
          if (txDate < startDate) {
            newData.openingBalance += getCaisseDelta(tx);
            return;
          }

          if (txDate > endDate) return;

          const desc = (tx.description || '').toLowerCase();
          let tontineAccountNumber = '';
          if (tx.tontineAccountId) {
            const acc = member.tontineAccounts?.find((a: any) => a.id === tx.tontineAccountId);
            if (acc) tontineAccountNumber = acc.number;
          }
          const txWithMember = { ...tx, memberName: member.name, memberCode: member.code, tontineAccountNumber };

          // Épargne & Frais & Part Sociale
          if (tx.account === 'epargne' || tx.account === 'frais' || tx.account === 'partSociale') {
            if (tx.type === 'depot') newData.epargneDepots.push(txWithMember);
            if (tx.type === 'retrait' || tx.type === 'transfert') newData.epargneRetraits.push(txWithMember);
          }

          // Tontine
          if (tx.account === 'tontine') {
            const txZone = tontineAccountNumber ? getZoneFromCode(tontineAccountNumber) : memberZone;
            if ((tx.type === 'depot' || tx.type === 'cotisation') && !desc.includes('livret')) {
              newData.tontineDepotsByZone[txZone].push(txWithMember);
            }
            if (tx.type === 'retrait' || tx.type === 'transfert') {
              newData.tontineRetraitsByZone[txZone].push(txWithMember);
            }
          }

          // Crédit
          if (tx.account === 'credit') {
            if (tx.type === 'deblocage') newData.creditsAccordes.push(txWithMember);
            if (tx.type === 'remboursement') newData.remboursements.push(txWithMember);
          }

          // Garantie
          if (tx.account === 'garantie') {
            if (tx.type === 'depot') newData.garantieDepots.push(txWithMember);
            if (tx.type === 'retrait' || tx.type === 'transfert') newData.garantieRetraits.push(txWithMember);
          }

          // Destination side of transfer
          if (tx.type === 'transfert' && tx.destinationAccount) {
            const destTx = { ...txWithMember, account: tx.destinationAccount, type: 'depot' };
            if (tx.destinationAccount === 'epargne' || tx.destinationAccount === 'frais' || tx.destinationAccount === 'partSociale') {
              newData.epargneDepots.push(destTx);
            } else if (tx.destinationAccount === 'garantie') {
              newData.garantieDepots.push(destTx);
            } else if (tx.destinationAccount === 'tontine') {
              const txZone = tontineAccountNumber ? getZoneFromCode(tontineAccountNumber) : memberZone;
              newData.tontineDepotsByZone[txZone].push(destTx);
            }
          }

          // Livrets
          if (desc.includes('livret')) {
            if (tx.account === 'tontine') {
              const txZone = tontineAccountNumber ? getZoneFromCode(tontineAccountNumber) : memberZone;
              newData.livretsTontineByZone[txZone].push(txWithMember);
            } else if (tx.account === 'epargne' || tx.account === 'frais') {
              newData.livretsEpargne.push(txWithMember);
            }
          }
        });
      });
    }

    // Load Administrative Expenses
    const savedExpenses = localStorage.getItem('microfox_admin_expenses');
    if (savedExpenses) {
      const allExpenses = JSON.parse(savedExpenses);
      allExpenses.forEach((e: any) => {
        const eDate = e.date.split('T')[0];
        const expUser = allUsers.find((u: any) => u.identifiant === e.recordedBy);
        const expCaisse = expUser?.caisse || 'N/A';

        if (isCaissier && e.recordedBy !== user.identifiant) return;
        if (!selectedCaisse.includes('all') && !selectedCaisse.includes(expCaisse)) return;

        if (eDate < startDate) {
          newData.openingBalance -= e.amount;
        } else if (eDate <= endDate) {
          newData.adminExpenses.push(e);
        }
      });
    }

    // Load Agent Payments
    const savedPayments = localStorage.getItem('microfox_agent_payments');
    if (savedPayments) {
      const allPayments = JSON.parse(savedPayments);
      allPayments.forEach((p: any) => {
        const pDate = p.date.split('T')[0];
        const amount = p.observedAmount || p.totalAmount;

        if (p.status !== 'Validé') return;
        if (isCaissier && p.validatorId !== user.id) return;
        if (!selectedCaisse.includes('all') && !selectedCaisse.some(c => c.toUpperCase() === (p.caisse || 'N/A').toUpperCase())) return;

        if (pDate < startDate) {
          newData.openingBalance += amount;
        } else if (pDate <= endDate) {
          newData.agentPayments.push(p);
        }
      });
    }

    // Load Vault Transactions
    const savedVault = localStorage.getItem('microfox_vault_transactions');
    if (savedVault) {
      const allVaultTxs = JSON.parse(savedVault);
      allVaultTxs.forEach((v: any) => {
        const vDate = v.date.split('T')[0];
        
        let isRelevant = false;
        let delta = 0;

        if (isCaissier) {
          if ((v.type === 'Approvisionnement Caisse' || v.type === 'Fonds de caisse') && v.to?.toUpperCase() === user.caisse?.toUpperCase()) {
            isRelevant = true;
            delta = v.amount;
          } else if ((v.type === 'Versement au Coffre' || v.type === 'Versement Fin de Journée' || v.type === 'Régularisation Écart') && v.from === user.caisse) {
            isRelevant = true;
            delta = -v.amount;
          } else if (v.userId === user.id) {
            isRelevant = true;
            delta = (v.type === 'Approvisionnement Caisse' || v.type === 'Fonds de caisse' || v.type.toLowerCase().includes('versement') || v.type === 'Régularisation Écart') ? v.amount : -v.amount;
          }
        } else if (!selectedCaisse.includes('all')) {
          if ((v.type === 'Approvisionnement Caisse' || v.type === 'Fonds de caisse') && selectedCaisse.some(c => c.toUpperCase() === v.to?.toUpperCase())) {
            isRelevant = true;
            delta = v.amount;
          } else if ((v.type === 'Versement au Coffre' || v.type === 'Versement Fin de Journée' || v.type === 'Régularisation Écart') && selectedCaisse.some(c => c.toUpperCase() === v.from?.toUpperCase())) {
            isRelevant = true;
            delta = -v.amount;
          } else {
            const vUser = allUsers.find((u: any) => u.id === v.userId);
            if (vUser?.caisse && selectedCaisse.some(c => c.toUpperCase() === vUser.caisse.toUpperCase())) {
              isRelevant = true;
              delta = (v.type === 'Approvisionnement Caisse' || v.type === 'Fonds de caisse' || v.type.toLowerCase().includes('versement') || v.type === 'Régularisation Écart') ? v.amount : -v.amount;
            }
          }
        } else {
          // All caisses
          if (v.type === 'Approvisionnement Caisse' || v.type === 'Fonds de caisse' || v.type === 'Régularisation Écart') {
            isRelevant = true;
            delta = v.amount;
          } else if (v.type === 'Versement au Coffre' || v.type === 'Versement Fin de Journée') {
            isRelevant = true;
            delta = -v.amount;
          }
        }

        if (isRelevant) {
          if (vDate < startDate) {
            newData.openingBalance += delta;
          } else if (vDate <= endDate) {
            newData.vaultTransactions.push({
              ...v,
              type: (v.type === 'Approvisionnement Caisse' || v.type === 'Fonds de caisse') ? 'Approvisionnement Caisse' : v.type
            });
          }
        }
      });
    }

    // Load Validated Withdrawals for Gaps
    const savedValidated = localStorage.getItem('microfox_validated_withdrawals');
    if (savedValidated) {
      const allValidated = JSON.parse(savedValidated).filter((w: any) => !w.isDeleted);
      allValidated.forEach((v: any) => {
        const vDate = v.validationDate.split('T')[0];
        const vUser = allUsers.find((u: any) => u.id === v.userId);
        const vCaisse = vUser?.caisse || 'N/A';
        const gap = v.gap || 0;

        if (isCaissier && v.userId !== user.id) return;
        if (!selectedCaisse.includes('all') && !selectedCaisse.some(c => c.toUpperCase() === (vCaisse || 'N/A').toUpperCase())) return;

        if (vDate < startDate) {
          newData.openingBalance -= gap;
        } else if (vDate <= endDate) {
          newData.validatedWithdrawals.push(v);
        }
      });
    }

    // Load Cash Gaps
    const savedGaps = localStorage.getItem('microfox_all_gaps');
    if (savedGaps) {
      const allGaps = JSON.parse(savedGaps);
      allGaps.forEach((g: any) => {
        const gDate = g.date.split('T')[0];
        const gUser = allUsers.find((u: any) => u.id === g.userId);
        const gCaisse = g.caisse || gUser?.caisse || 'N/A';

        if (isCaissier && g.userId !== user.id) return;
        if (!selectedCaisse.includes('all') && !selectedCaisse.some(c => c.toUpperCase() === (gCaisse || 'N/A').toUpperCase())) return;

        if (gDate < startDate) {
          // Removed redundant opening balance adjustment as it's handled by vault transactions
        } else if (gDate <= endDate) {
          newData.cashGaps.push(g);
        }
      });
    }

    // Sort all lists chronologically
    const sortFn = (a: any, b: any) => new Date(b.date || b.validationDate).getTime() - new Date(a.date || a.validationDate).getTime();
    
    newData.epargneDepots.sort(sortFn);
    newData.epargneRetraits.sort(sortFn);
    newData.creditsAccordes.sort(sortFn);
    newData.remboursements.sort(sortFn);
    newData.livretsEpargne.sort(sortFn);
    newData.garantieDepots.sort(sortFn);
    newData.garantieRetraits.sort(sortFn);
    newData.adminExpenses.sort(sortFn);
    newData.agentPayments.sort(sortFn);
    newData.vaultTransactions.sort(sortFn);
    newData.validatedWithdrawals.sort(sortFn);
    
    zones.forEach(z => {
      newData.tontineDepotsByZone[z].sort(sortFn);
      newData.tontineRetraitsByZone[z].sort(sortFn);
      newData.livretsTontineByZone[z].sort(sortFn);
    });
    newData.tontineDepotsByZone['Inconnue'].sort(sortFn);
    newData.tontineRetraitsByZone['Inconnue'].sort(sortFn);
    newData.livretsTontineByZone['Inconnue'].sort(sortFn);

    setData(newData);
  };

  useEffect(() => {
    loadData();
    window.addEventListener('storage', loadData);
    return () => window.removeEventListener('storage', loadData);
  }, [startDate, endDate, selectedCaisse]);

  const calculateTotal = (list: any[]) => list.reduce((sum, item) => sum + (item.amount || 0), 0);

  // Calculs pour le récapitulatif
  const totalDepotMemb = calculateTotal(data.epargneDepots);
  const totalRetraitMemb = calculateTotal(data.epargneRetraits);
  const totalDepotTont = Object.values(data.tontineDepotsByZone).reduce((acc: number, list) => acc + calculateTotal(list as any[]), 0) as number;
  const totalGapTontine = data.cashGaps
    .filter(g => g.type === 'TONTINE')
    .reduce((acc, g) => acc + (g.gapAmount || 0), 0);

  const totalRetraitTont = Object.values(data.tontineRetraitsByZone).reduce((acc: number, list) => acc + calculateTotal(list as any[]), 0) as number;
  const displayRetraitTont = totalRetraitTont - totalGapTontine;
  const totalCreditAccor = calculateTotal(data.creditsAccordes);
  
  const totalCapitalRemb = data.remboursements.reduce((acc, tx) => {
    const match = tx.description?.match(/Cap: (\d+)/);
    return acc + (match ? Number(match[1]) : tx.amount);
  }, 0);
  const totalInteretRemb = data.remboursements.reduce((acc, tx) => {
    const match = tx.description?.match(/Int: (\d+)/);
    return acc + (match ? Number(match[1]) : 0);
  }, 0);
  const totalPenaliteRemb = data.remboursements.reduce((acc, tx) => {
    const match = tx.description?.match(/Pen: (\d+)/);
    return acc + (match ? Number(match[1]) : 0);
  }, 0);
  
  const totalCreditRemb = totalCapitalRemb + totalInteretRemb + totalPenaliteRemb;
  
  const totalDepotGarantie = calculateTotal(data.garantieDepots);
  const totalRetraitGarantie = calculateTotal(data.garantieRetraits);

  const totalAdminExpenses = calculateTotal(data.adminExpenses);
  const totalVersementAgents = calculateTotal(data.agentPayments.map(p => ({ amount: p.observedAmount || p.totalAmount })));
  
  const totalPartSocialeDepot = data.epargneDepots.filter(tx => 
    tx.account === 'partSociale' || tx.description?.toLowerCase().includes('part sociale')
  ).reduce((acc, tx) => acc + tx.amount, 0);

  const totalPartSocialeRetrait = data.epargneRetraits.filter(tx => 
    tx.account === 'partSociale' || tx.description?.toLowerCase().includes('part sociale')
  ).reduce((acc, tx) => acc + tx.amount, 0);

  const totalPartSociale = totalPartSocialeDepot - totalPartSocialeRetrait;

  const totalAdhesion = data.epargneDepots.filter(tx => 
    tx.description?.toLowerCase().includes('adhésion') && 
    tx.account !== 'partSociale' &&
    !tx.description?.toLowerCase().includes('part sociale')
  ).reduce((acc, tx) => acc + tx.amount, 0);

  const totalVenteLivretCompte = calculateTotal(data.livretsEpargne);
  const totalVenteLivretTontine = Object.values(data.livretsTontineByZone).reduce((acc: number, list) => acc + calculateTotal(list as any[]), 0) as number;

  // Frais de dossier de crédit uniquement
  const totalFraisTenueCompte = data.epargneDepots.filter(tx => 
    tx.description?.toLowerCase().includes('tenue de compte')
  ).reduce((acc, tx) => acc + tx.amount, 0);

  const totalFraisDossierCredit = data.epargneDepots.filter(tx => 
    (tx.description?.toLowerCase().includes('frais de dossier crédit') || tx.account === 'frais') &&
    !tx.description?.toLowerCase().includes('adhésion') &&
    !tx.description?.toLowerCase().includes('adhesion') &&
    !tx.description?.toLowerCase().includes('livret') &&
    !tx.description?.toLowerCase().includes('part sociale') &&
    !tx.description?.toLowerCase().includes('tenue de compte')
  ).reduce((acc, tx) => acc + tx.amount, 0);

  // Identification des agents commerciaux
  const agentIds = allUsers.filter((u: any) => u.role === 'agent commercial').map((u: any) => u.id);

  // Filtrer les opérations pour exclure celles des agents (elles sont comptées via les versements validés)
  const filterNonAgentOps = (list: any[]) => list.filter(tx => !agentIds.includes(tx.userId));

  const totalDepotTontNonAgent = Object.values(data.tontineDepotsByZone).reduce((acc: number, list) => acc + calculateTotal(filterNonAgentOps(list as any[])), 0) as number;
  const totalVenteLivretTontineNonAgent = Object.values(data.livretsTontineByZone).reduce((acc: number, list) => acc + calculateTotal(filterNonAgentOps(list as any[])), 0) as number;

  const totalVaultInflow = data.vaultTransactions
    .filter(v => v.type === 'Approvisionnement Caisse' || v.type === 'Fonds de caisse')
    .reduce((acc, v) => acc + v.amount, 0);
  
  const startingBalance = data.openingBalance;
  
  const totalVaultOutflow = data.vaultTransactions
    .filter(v => v.type === 'Versement au Coffre' || v.type === 'Versement Fin de Journée')
    .reduce((acc, v) => acc + v.amount, 0);

  const totalPaidGaps = data.vaultTransactions
    .filter(v => v.type === 'Régularisation Écart')
    .reduce((acc, v) => acc + v.amount, 0);

  const pureDepotEpargne = data.epargneDepots.filter(tx => 
    tx.account !== 'partSociale' &&
    !tx.description?.toLowerCase().includes('part sociale') &&
    !tx.description?.toLowerCase().includes('adhésion') &&
    !tx.description?.toLowerCase().includes('adhesion') &&
    !tx.description?.toLowerCase().includes('livret') &&
    !tx.description?.toLowerCase().includes('frais de dossier crédit') &&
    tx.account !== 'frais' &&
    !tx.description?.toLowerCase().includes('tenue de compte')
  );

  const partSocialeList = data.epargneDepots.filter(tx => 
    tx.account === 'partSociale' || tx.description?.toLowerCase().includes('part sociale')
  );

  const adhesionList = data.epargneDepots.filter(tx => 
    tx.description?.toLowerCase().includes('adhésion') && 
    tx.account !== 'partSociale' &&
    !tx.description?.toLowerCase().includes('part sociale')
  );

  const fraisDossierList = data.epargneDepots.filter(tx => 
    (tx.description?.toLowerCase().includes('frais de dossier crédit') || tx.account === 'frais') &&
    tx.account !== 'partSociale' &&
    !tx.description?.toLowerCase().includes('adhésion') &&
    !tx.description?.toLowerCase().includes('adhesion') &&
    !tx.description?.toLowerCase().includes('livret') &&
    !tx.description?.toLowerCase().includes('part sociale') &&
    !tx.description?.toLowerCase().includes('tenue de compte')
  );

  const fraisTenueList = data.epargneDepots.filter(tx => 
    tx.description?.toLowerCase().includes('tenue de compte')
  );

  const displayDepotMemb = totalDepotMemb - (totalPartSocialeDepot + totalAdhesion + totalVenteLivretCompte + totalFraisDossierCredit + totalFraisTenueCompte);
  const displayRetraitMemb = totalRetraitMemb - totalPartSocialeRetrait;
  const displayDepotTont = totalDepotTontNonAgent - totalVenteLivretTontineNonAgent;

  const [physicalBalance, setPhysicalBalance] = useState(0);
  const [isPhysicalBalanceValidated, setIsPhysicalBalanceValidated] = useState(false);
  const [billetageHistory, setBilletageHistory] = useState<any[]>(() => {
    const saved = localStorage.getItem('microfox_physical_balance_history');
    return saved ? JSON.parse(saved) : [];
  });
  const [isBilletageModalOpen, setIsBilletageModalOpen] = useState(false);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [selectedHistoryItem, setSelectedHistoryItem] = useState<any>(null);
  const [denominations, setDenominations] = useState<Record<string, number>>({
    '10000': 0,
    '5000': 0,
    '2000': 0,
    '1000': 0,
    '500': 0,
    '250': 0,
    '200': 0,
    '100': 0,
    '50': 0,
    '25': 0,
    '10': 0,
    '5': 0,
    'monnaie': 0
  });

  const calculateTotalBilletage = () => {
    return (
      (denominations['10000'] || 0) * 10000 +
      (denominations['5000'] || 0) * 5000 +
      (denominations['2000'] || 0) * 2000 +
      (denominations['1000'] || 0) * 1000 +
      (denominations['500'] || 0) * 500 +
      (denominations['250'] || 0) * 250 +
      (denominations['200'] || 0) * 200 +
      (denominations['100'] || 0) * 100 +
      (denominations['50'] || 0) * 50 +
      (denominations['25'] || 0) * 25 +
      (denominations['10'] || 0) * 10 +
      (denominations['5'] || 0) * 5 +
      (denominations['monnaie'] || 0)
    );
  };

  const handleBilletageChange = (denom: string, value: string) => {
    const numValue = parseInt(value) || 0;
    setDenominations(prev => ({
      ...prev,
      [denom]: numValue
    }));
  };

  const confirmBilletage = () => {
    const total = calculateTotalBilletage();
    setPhysicalBalance(total);
    setIsPhysicalBalanceValidated(true);
    
    const newHistoryItem = {
      id: Date.now().toString(),
      date: new Date().toISOString(),
      theoreticalBalance: currentBalance,
      physicalBalance: total,
      gap: total - currentBalance,
      denominations: { ...denominations },
      validator: currentUser?.nom || currentUser?.username || 'Inconnu'
    };
    
    const updatedHistory = [newHistoryItem, ...billetageHistory];
    setBilletageHistory(updatedHistory);
    localStorage.setItem('microfox_physical_balance_history', JSON.stringify(updatedHistory));
    
    setIsBilletageModalOpen(false);
  };

  const [selectedReport, setSelectedReport] = useState('all');
  const [checkedReports, setCheckedReports] = useState<string[]>([]);

  const toggleReport = (id: string) => {
    setCheckedReports(prev => 
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const [selectedZone, setSelectedZone] = useState<string>(() => {
    const user = localStorage.getItem('microfox_current_user');
    if (user) {
      const parsed = JSON.parse(user);
      if (parsed.role === 'agent commercial' && parsed.zoneCollecte) {
        return parsed.zoneCollecte;
      }
    }
    return 'all';
  });

  useEffect(() => {
    const user = localStorage.getItem('microfox_current_user');
    if (user) setCurrentUser(JSON.parse(user));
  }, []);

  const reports = [
    { id: 'all', label: 'Tous les rapports' },
    { id: 'recapitulatif', label: 'État Récapitulatif Financier' },
    { id: 'epargne_depots', label: 'Dépôts Compte Épargne' },
    { id: 'epargne_retraits', label: 'Retraits Compte Épargne' },
    { id: 'tontine_depots', label: 'Dépôts Tontine par Zone' },
    { id: 'tontine_retraits', label: 'Retraits Tontine par Zone' },
    { id: 'credits_accordes', label: 'Crédits Accordés & Frais' },
    { id: 'remboursements', label: 'Remboursements & Intérêts' },
    { id: 'depenses_admin', label: 'Dépenses Administratives' },
    { id: 'versement_agents', label: 'Versement des Agents Commerciaux' },
    { id: 'vente_livrets', label: 'Vente de Livrets' },
    { id: 'garantie_depots', label: 'Dépôts Garantie' },
    { id: 'garantie_retraits', label: 'Retraits Garantie' },
    { id: 'frais_parts', label: 'Frais, Adhésions & Parts Sociales' },
    { id: 'vault_transactions', label: 'Mouvements de Coffre' },
    { id: 'tontine_gaps', label: 'Écarts sur retrait tontine' },
  ];

  const totalInflow = displayDepotMemb + displayDepotTont + totalDepotGarantie + totalCreditRemb + totalVersementAgents + totalFraisDossierCredit + totalFraisTenueCompte + totalPartSocialeDepot + totalAdhesion + totalVenteLivretCompte + totalVenteLivretTontineNonAgent + totalPaidGaps + totalVaultInflow;
  const totalOutflow = displayRetraitMemb + displayRetraitTont + totalRetraitGarantie + totalCreditAccor + totalAdminExpenses + totalPartSocialeRetrait + totalGapTontine + totalVaultOutflow;
  const currentBalance = startingBalance + totalInflow - totalOutflow;

  useEffect(() => {
    setIsPhysicalBalanceValidated(false);
    setPhysicalBalance(0);
  }, [startDate, endDate]);

  const generateHTMLReport = (isForPrint = false, reportIds?: string[]) => {
    const mfConfig = JSON.parse(localStorage.getItem('microfox_mf_config') || '{"nom": "MicroFoX", "adresse": "", "code": ""}');
    const dateRange = `DU ${new Date(startDate).toLocaleDateString()} AU ${new Date(endDate).toLocaleDateString()}`;
    
    const headerHtml = `
      <div style="text-align: center; margin-bottom: 40px; border-bottom: 2px solid #f1f5f9; padding-bottom: 20px;">
        <h1 style="font-size: 24px; font-weight: 900; text-transform: uppercase; margin: 0; color: #121c32;">${mfConfig.nom}</h1>
        <p style="font-size: 12px; font-weight: bold; color: #64748b; margin: 5px 0;">${mfConfig.adresse}</p>
        <p style="font-size: 12px; font-weight: bold; color: #64748b; margin: 5px 0;">Tél: ${mfConfig.telephone || 'N/A'} | Code: ${mfConfig.code}</p>
      </div>
    `;

    const ids = reportIds && reportIds.length > 0 ? reportIds : [selectedReport];
    let bodyContent = "";

    ids.forEach((id, index) => {
      if (index > 0) bodyContent += '<div style="page-break-before: always; margin-top: 40px; border-top: 1px dashed #ccc; padding-top: 20px;"></div>';

      if (id === 'all' || id === 'recapitulatif') {
        const rows = [
          ['SOLDE INITIAL', startingBalance],
          ['', ''],
          ['ENTRÉES', ''],
          ['DEPOT SUR COMPTE ÉPARGNE', displayDepotMemb],
          ['DEPOT TONTINE', displayDepotTont],
          ['DÉPÔT GARANTIE', totalDepotGarantie],
          ['CAPITAL REMBOURSÉ', totalCapitalRemb],
          ['INTERET REMBOURSÉ', totalInteretRemb],
          ['PÉNALITÉ REMBOURSÉ', totalPenaliteRemb],
          ['VERSEMENT DES AGENTS COMMERCIAUX', totalVersementAgents],
          ['FRAIS DE DOSSIER DE CRÉDIT', totalFraisDossierCredit],
          ['FRAIS DE TENUE DE COMPTE', totalFraisTenueCompte],
          ['DEPOT PART SOCIALE', totalPartSocialeDepot],
          ['ADHÉSION', totalAdhesion],
          ['VENTE LIVRET DE COMPTE', totalVenteLivretCompte],
          ['VENTE LIVRET TONTINE', totalVenteLivretTontineNonAgent],
          ['ÉCARTS PAYÉS', totalPaidGaps],
          ['APPROVISIONNEMENT CAISSE', totalVaultInflow],
          ['TOTAL ENTRÉES', totalInflow],
          ['', ''],
          ['SORTIES', ''],
          ['RETRAIT SUR COMPTE ÉPARGNE', displayRetraitMemb],
          ['RETRAIT TONTINE', displayRetraitTont],
          ['RETRAIT GARANTIE', totalRetraitGarantie],
          ['CRÉDIT ACCORDÉ', totalCreditAccor],
          ['DÉPENSES ADMINISTRATIVES', totalAdminExpenses],
          ['RETRAIT PART SOCIALE', totalPartSocialeRetrait],
          ['ÉCARTS SUR RETRAIT TONTINE', totalGapTontine],
          ['VERSEMENT AU COFFRE', totalVaultOutflow],
          ['TOTAL SORTIES', totalOutflow],
          ['', ''],
          ['FLUX NET', totalInflow - totalOutflow],
          ['', ''],
          ['SOLDE THÉORIQUE', currentBalance],
          ['SOLDE PHYSIQUE (RÉEL)', physicalBalance],
          ['ÉCART DE CAISSE', physicalBalance - currentBalance]
        ];

        bodyContent += `
          <h1 style="text-align: center; color: #121c32; margin-top: 20px;">ÉTAT RÉCAPITULATIF FINANCIER</h1>
          <h2 style="text-align: center; color: #666; font-size: 14px;">${dateRange}</h2>
          <table style="width: 100%; border-collapse: collapse; margin-top: 20px;">
            <thead>
              <tr>
                <th style="border: 1px solid #ddd; padding: 12px; text-align: center; background-color: #f8f9fa; font-weight: bold;">Libellé</th>
                <th style="border: 1px solid #ddd; padding: 12px; text-align: center; background-color: #f8f9fa; font-weight: bold;">Montant (F)</th>
              </tr>
            </thead>
            <tbody>
              ${rows.map(r => `
                <tr>
                  <td style="border: 1px solid #ddd; padding: 12px; text-align: center; ${r[0] === '' ? '' : 'font-weight: bold;'}">${r[0]}</td>
                  <td style="border: 1px solid #ddd; padding: 12px; text-align: center; font-weight: bold;">${r[1] !== '' ? Number(r[1]).toLocaleString() : ''}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        `;
      }

      if (id !== 'recapitulatif') {
        let listToExport: any[] = [];
        let reportName = "";

        if (id.startsWith('depot-zone-')) {
          const zone = id.replace('depot-zone-', '');
          listToExport = data.tontineDepotsByZone[zone] || [];
          reportName = `Dépôts Tontine - Zone ${zone}`;
        } else if (id.startsWith('retrait-zone-')) {
          const zone = id.replace('retrait-zone-', '');
          listToExport = data.tontineRetraitsByZone[zone] || [];
          reportName = `Retraits Tontine - Zone ${zone}`;
        } else if (id.startsWith('livret-zone-')) {
          const zone = id.replace('livret-zone-', '');
          listToExport = data.livretsTontineByZone[zone] || [];
          reportName = `Vente Livrets - Zone ${zone}`;
        } else {
          switch (id) {
            case 'epargne_depots':
              listToExport = pureDepotEpargne;
              reportName = "Dépôts Compte Épargne";
              break;
            case 'epargne_retraits':
              listToExport = data.epargneRetraits;
              reportName = "Retraits Compte Épargne";
              break;
            case 'credits_accordes':
              listToExport = data.creditsAccordes;
              reportName = "Crédits Accordés & Frais";
              break;
            case 'remboursements':
              listToExport = data.remboursements;
              reportName = "Remboursements & Intérêts";
              break;
            case 'depenses_admin':
              listToExport = data.adminExpenses;
              reportName = "Dépenses Administratives";
              break;
            case 'versement_agents':
              listToExport = data.agentPayments.map(p => ({
                date: p.date,
                label: p.agentName,
                amount: p.observedAmount || p.totalAmount,
                description: `Versement Validé - ${p.caisse}`
              }));
              reportName = "Versement des Agents Commerciaux";
              break;
            case 'tontine_depots':
              if (id === 'all') break;
              Object.entries(data.tontineDepotsByZone).forEach(([zone, list]) => {
                if (selectedZone === 'all' || selectedZone === zone) {
                  (list as any[]).forEach(tx => listToExport.push({ ...tx, zone }));
                }
              });
              reportName = "Dépôts Tontine par Zone";
              break;
            case 'tontine_retraits':
              if (id === 'all') break;
              Object.entries(data.tontineRetraitsByZone).forEach(([zone, list]) => {
                if (selectedZone === 'all' || selectedZone === zone) {
                  (list as any[]).forEach(tx => listToExport.push({ ...tx, zone }));
                }
              });
              reportName = "Retraits Tontine par Zone";
              break;
            case 'vente_livrets':
              if (id === 'all') break;
              listToExport = [...data.livretsEpargne];
              Object.entries(data.livretsTontineByZone).forEach(([zone, list]) => {
                if (selectedZone === 'all' || selectedZone === zone) {
                  (list as any[]).forEach(tx => listToExport.push({ ...tx, zone }));
                }
              });
              reportName = "Vente de Livrets";
              break;
            case 'livrets_epargne':
              listToExport = data.livretsEpargne;
              reportName = "Livrets Épargne Vendus";
              break;
            case 'garantie_depots':
              listToExport = data.garantieDepots;
              reportName = "Dépôts Garantie";
              break;
            case 'garantie_retraits':
              listToExport = data.garantieRetraits;
              reportName = "Retraits Garantie";
              break;
            case 'frais_parts':
              listToExport = [...adhesionList, ...partSocialeList, ...fraisDossierList, ...fraisTenueList];
              reportName = "Frais, Adhésions & Parts Sociales";
              break;
            case 'vault_transactions':
              listToExport = data.vaultTransactions.map(v => ({
                date: v.date,
                label: v.type,
                amount: v.amount,
                description: `Opération de Coffre - ${v.userId}`
              }));
              reportName = "Mouvements de Coffre";
              break;
            case 'tontine_gaps':
              listToExport = data.validatedWithdrawals.filter(v => (v.gap || 0) !== 0).map(v => ({
                date: v.validationDate,
                label: v.memberName,
                amount: v.gap || 0,
                description: `Écart constaté sur retrait - Zone ${v.zone}`
              }));
              reportName = "Écarts sur retrait tontine payé";
              break;
            case 'all':
              break;
          }
        }

        if (listToExport.length > 0) {
          bodyContent += `
            <h1 style="text-align: center; color: #121c32; margin-top: 20px;">${reportName}</h1>
            <h2 style="text-align: center; color: #666; font-size: 14px;">${dateRange}</h2>
            <table style="width: 100%; border-collapse: collapse; margin-top: 20px;">
              <thead>
                <tr>
                  <th style="border: 1px solid #ddd; padding: 12px; text-align: center; background-color: #f8f9fa; font-weight: bold;">Date</th>
                  <th style="border: 1px solid #ddd; padding: 12px; text-align: center; background-color: #f8f9fa; font-weight: bold;">Client</th>
                  <th style="border: 1px solid #ddd; padding: 12px; text-align: center; background-color: #f8f9fa; font-weight: bold;">Code</th>
                  <th style="border: 1px solid #ddd; padding: 12px; text-align: center; background-color: #f8f9fa; font-weight: bold;">N° Compte Tontine</th>
                  <th style="border: 1px solid #ddd; padding: 12px; text-align: center; background-color: #f8f9fa; font-weight: bold;">Montant (F)</th>
                  <th style="border: 1px solid #ddd; padding: 12px; text-align: center; background-color: #f8f9fa; font-weight: bold;">Description</th>
                </tr>
              </thead>
              <tbody>
                ${listToExport.map(tx => `
                  <tr>
                    <td style="border: 1px solid #ddd; padding: 12px; text-align: center;">${new Date(tx.date).toLocaleDateString()}</td>
                    <td style="border: 1px solid #ddd; padding: 12px; text-align: center;">${tx.memberName || tx.label || ''}</td>
                    <td style="border: 1px solid #ddd; padding: 12px; text-align: center;">${tx.memberCode || ''}</td>
                    <td style="border: 1px solid #ddd; padding: 12px; text-align: center;">${tx.tontineAccountNumber || ''}</td>
                    <td style="border: 1px solid #ddd; padding: 12px; text-align: center;">${Number(tx.amount).toLocaleString()}</td>
                    <td style="border: 1px solid #ddd; padding: 12px; text-align: center;">${tx.description || ''}</td>
                  </tr>
                `).join('')}
              </tbody>
              <tfoot>
                <tr>
                  <td colspan="4" style="border: 1px solid #ddd; padding: 12px; text-align: right; font-weight: bold; background-color: #f8f9fa;">TOTAL</td>
                  <td style="border: 1px solid #ddd; padding: 12px; text-align: right; font-weight: bold; background-color: #f8f9fa;">${calculateTotal(listToExport).toLocaleString()}</td>
                  <td style="border: 1px solid #ddd; padding: 12px; background-color: #f8f9fa;"></td>
                </tr>
              </tfoot>
            </table>
          `;
        }
      }
    });

    return `
      <!DOCTYPE html>
      <html lang="fr">
        <head>
          <meta charset="UTF-8">
          <title>Rapport Financier</title>
          <style>
            body { font-family: sans-serif; padding: 20px; color: #333; }
            @media print {
              .no-print { display: none; }
              body { padding: 0; }
            }
          </style>
        </head>
        <body>
          ${headerHtml}
          ${bodyContent}
          ${isForPrint ? `
            <script>
              window.onload = () => {
                window.print();
                setTimeout(() => window.close(), 500);
              };
            </script>
          ` : ''}
        </body>
      </html>
    `;
  };

  const handleExport = () => {
    const htmlContent = generateHTMLReport(false, checkedReports);
    const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `${checkedReports.length > 0 ? 'selection' : selectedReport}_${startDate}_${endDate}.html`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePrint = () => {
    const htmlContent = generateHTMLReport(true, checkedReports);
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(htmlContent);
      printWindow.document.close();
    }
  };

  const renderSection = (title: string, list: any[], icon: React.ReactNode, color: string, id: string) => (
    <div key={id} className="bg-white rounded-[2rem] border border-gray-100 shadow-sm overflow-hidden">
      <div className={`p-4 sm:p-6 flex items-center justify-between border-b border-gray-50 bg-${color}-50/30`}>
        <div className="flex items-center gap-3">
          <button 
            onClick={() => toggleReport(id)}
            className={`p-1 rounded-md transition-colors ${checkedReports.includes(id) ? 'text-blue-600' : 'text-gray-300'}`}
          >
            {checkedReports.includes(id) ? <CheckSquare size={18} /> : <Square size={18} />}
          </button>
          <div className={`w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-${color}-100 text-${color}-600 flex items-center justify-center shrink-0`}>
            {icon}
          </div>
          <div className="min-w-0">
            <h3 className="text-xs sm:text-sm font-black text-[#121c32] uppercase tracking-tight truncate">{title}</h3>
            <p className="text-[9px] sm:text-[10px] font-bold text-gray-400 uppercase tracking-widest">{list.length} opérations</p>
          </div>
        </div>
        <div className="text-right shrink-0">
          <p className="text-[9px] sm:text-[10px] font-black text-gray-400 uppercase tracking-widest">Total</p>
          <p className={`text-sm sm:text-xl font-black text-${color}-600`}>{calculateTotal(list).toLocaleString()} F</p>
        </div>
      </div>
      <div className="max-h-[300px] overflow-y-auto custom-scrollbar overflow-x-auto">
        <table className="w-full text-left min-w-[450px]">
          <thead className="sticky top-0 bg-white shadow-sm z-10">
            <tr>
              <th className="px-4 py-3 text-[9px] font-black text-gray-400 uppercase tracking-widest whitespace-nowrap">Date</th>
              <th className="px-4 py-3 text-[9px] font-black text-gray-400 uppercase tracking-widest whitespace-nowrap">Client</th>
              <th className="px-4 py-3 text-[9px] font-black text-gray-400 uppercase tracking-widest whitespace-nowrap">N° Compte Tontine</th>
              <th className="px-4 py-3 text-[9px] font-black text-gray-400 uppercase tracking-widest text-right whitespace-nowrap">Montant</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {list.map((tx, idx) => (
              <tr key={tx.id || idx} className="hover:bg-gray-50 transition-colors">
                <td className="px-4 py-4 text-[10px] sm:text-xs font-bold text-gray-500 whitespace-nowrap">{new Date(tx.date).toLocaleDateString()}</td>
                <td className="px-4 py-4">
                  <p className="text-[10px] sm:text-xs font-black text-[#121c32] uppercase">{tx.memberName}</p>
                  <p className="text-[8px] sm:text-[9px] font-bold text-gray-400">{tx.memberCode}</p>
                </td>
                <td className="px-4 py-4 text-[10px] sm:text-xs font-bold text-gray-500 whitespace-nowrap">{tx.tontineAccountNumber || '-'}</td>
                <td className="px-4 py-4 text-right text-[10px] sm:text-xs font-black text-[#121c32] whitespace-nowrap">{tx.amount.toLocaleString()} F</td>
              </tr>
            ))}
            {list.length > 0 && (
              <tr className="bg-gray-50 font-black">
                <td colSpan={3} className="px-4 py-3 text-right text-[10px] uppercase tracking-widest text-gray-500">Total</td>
                <td className="px-4 py-3 text-right text-[10px] sm:text-xs text-[#121c32]">{calculateTotal(list).toLocaleString()} F</td>
              </tr>
            )}
            {list.length === 0 && (
              <tr>
                <td colSpan={4} className="px-6 py-10 text-center text-[10px] font-bold text-gray-300 uppercase tracking-widest italic">Aucune donnée</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );

  return (
    <div className="space-y-8 pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-[#121c32] uppercase tracking-tight">Rapports Financiers Détaillés</h1>
          <p className="text-gray-700 text-sm font-medium mt-1">Analyse complète des flux de trésorerie par produit et par zone.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={handlePrint} className="p-3 bg-white border border-gray-200 rounded-xl text-gray-600 hover:text-blue-600 transition-all shadow-sm" title="Imprimer">
            <Printer size={20} />
          </button>
          <button 
            onClick={handleExport} 
            className="p-3 bg-white border border-gray-200 rounded-xl text-gray-600 hover:text-emerald-600 transition-all shadow-sm" 
            title="Exporter HTML"
          >
            <Download size={20} />
          </button>
        </div>
      </div>

      <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-gray-100 grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="space-y-1">
          <label className="text-[10px] font-black text-gray-600 uppercase tracking-widest ml-1">Date de début</label>
          <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-full p-3 bg-gray-50 border border-gray-100 rounded-2xl outline-none text-sm font-bold text-[#121c32]" />
        </div>
        <div className="space-y-1">
          <label className="text-[10px] font-black text-gray-600 uppercase tracking-widest ml-1">Date de fin</label>
          <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-full p-3 bg-gray-50 border border-gray-100 rounded-2xl outline-none text-sm font-bold text-[#121c32]" />
        </div>
        <div className="space-y-1">
          <label className="text-[10px] font-black text-gray-600 uppercase tracking-widest ml-1">Sélectionner un état</label>
          <select 
            value={selectedReport} 
            onChange={(e) => setSelectedReport(e.target.value)}
            className="w-full p-3 bg-gray-50 border border-gray-100 rounded-2xl outline-none text-sm font-bold text-[#121c32] appearance-none"
          >
            {reports.map(r => (
              <option key={r.id} value={r.id}>{r.label}</option>
            ))}
          </select>
        </div>
        {(selectedReport.includes('tontine') || selectedReport === 'vente_livrets') && (
          <div className="space-y-1 md:col-span-3">
            <label className="text-[10px] font-black text-gray-600 uppercase tracking-widest ml-1">Filtrer par Zone</label>
            <div className="relative">
              <select 
                value={selectedZone} 
                onChange={(e) => setSelectedZone(e.target.value)}
                disabled={currentUser?.role === 'agent commercial'}
                className="w-full p-3 bg-gray-50 border border-gray-100 rounded-2xl outline-none text-sm font-bold text-[#121c32] appearance-none disabled:opacity-50"
              >
                <option value="all">Toutes les zones</option>
                {zones.map(z => (
                  <option key={z} value={z}>Zone {z}</option>
                ))}
                <option value="Inconnue">Zone Inconnue</option>
              </select>
              <MapPin className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
            </div>
          </div>
        )}
        {(currentUser?.role === 'administrateur' || currentUser?.role === 'directeur' || currentUser?.role === 'superviseur') && (
          <div className="space-y-1 md:col-span-3">
            <label className="text-[10px] font-black text-gray-600 uppercase tracking-widest ml-1">Filtrer par Caisse (Plusieurs choix possibles)</label>
            <div className="flex flex-wrap gap-2 p-3 bg-gray-50 border border-gray-100 rounded-2xl">
              <button
                onClick={() => setSelectedCaisse(['all'])}
                className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${selectedCaisse.includes('all') ? 'bg-[#121c32] text-white' : 'bg-white text-gray-400 border border-gray-100'}`}
              >
                Toutes les caisses
              </button>
              {availableCaisses.map(c => (
                <button
                  key={c}
                  onClick={() => {
                    if (selectedCaisse.includes('all')) {
                      setSelectedCaisse([c]);
                    } else if (selectedCaisse.includes(c)) {
                      const next = selectedCaisse.filter(item => item !== c);
                      setSelectedCaisse(next.length === 0 ? ['all'] : next);
                    } else {
                      setSelectedCaisse([...selectedCaisse, c]);
                    }
                  }}
                  className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${selectedCaisse.includes(c) ? 'bg-[#121c32] text-white' : 'bg-white text-gray-400 border border-gray-100'}`}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* État Récapitulatif */}
      {(selectedReport === 'all' || selectedReport === 'recapitulatif') && (
        <div className="bg-white p-8 rounded-[2.5rem] shadow-xl border border-gray-100">
          <div className="flex items-center gap-3 mb-8 border-b border-gray-50 pb-4">
            <button 
              onClick={() => toggleReport('recapitulatif')}
              className={`p-1 rounded-md transition-colors ${checkedReports.includes('recapitulatif') ? 'text-blue-600' : 'text-gray-300'}`}
            >
              {checkedReports.includes('recapitulatif') ? <CheckSquare size={24} /> : <Square size={24} />}
            </button>
            <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <Calculator size={24} />
            </div>
            <h2 className="text-xl font-black text-[#121c32] uppercase tracking-tight">État Récapitulatif Financier</h2>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
            {/* Colonne Gauche: Flux */}
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-px bg-gray-100 rounded-2xl overflow-hidden border border-gray-100">
                <div className="bg-gray-50 p-4 text-[11px] font-black text-gray-600 uppercase tracking-widest">Libellé</div>
                <div className="bg-gray-50 p-4 text-[11px] font-black text-gray-600 uppercase tracking-widest text-right">Montant (F)</div>
                
                <div className="bg-amber-50 p-4 text-xs font-black text-amber-900 uppercase">Solde Initial</div>
                <div className="bg-amber-50 p-4 text-sm font-black text-amber-900 text-right">{startingBalance.toLocaleString()}</div>

                <div className="col-span-2 bg-gray-100 p-2 text-[10px] font-black text-gray-500 uppercase tracking-widest text-center">Entrées</div>

                <div className="bg-white p-4 text-xs font-bold text-gray-700">DEPOT SUR COMPTE ÉPARGNE</div>
                <div className="bg-white p-4 text-sm font-black text-[#121c32] text-right">{displayDepotMemb.toLocaleString()}</div>
                
                <div className="bg-white p-4 text-xs font-bold text-gray-700">DEPOT TONTINE</div>
                <div className="bg-white p-4 text-sm font-black text-[#121c32] text-right">{displayDepotTont.toLocaleString()}</div>
                
                <div className="bg-white p-4 text-xs font-bold text-gray-700 uppercase">Dépôt Garantie</div>
                <div className="bg-white p-4 text-sm font-black text-[#121c32] text-right">{totalDepotGarantie.toLocaleString()}</div>
                
                <div className="bg-white p-4 text-xs font-bold text-gray-700">CAPITAL REMBOURSÉ</div>
                <div className="bg-white p-4 text-sm font-black text-emerald-600 text-right">{totalCapitalRemb.toLocaleString()}</div>

                <div className="bg-white p-4 text-xs font-bold text-gray-700">INTERET REMBOURSÉ</div>
                <div className="bg-white p-4 text-sm font-black text-emerald-600 text-right">{totalInteretRemb.toLocaleString()}</div>

                <div className="bg-white p-4 text-xs font-bold text-gray-700">PÉNALITÉ REMBOURSÉ</div>
                <div className="bg-white p-4 text-sm font-black text-emerald-600 text-right">{totalPenaliteRemb.toLocaleString()}</div>

                <div className="bg-white p-4 text-xs font-bold text-gray-700 uppercase">Versement des Agents Commerciaux</div>
                <div className="bg-white p-4 text-sm font-black text-emerald-600 text-right">{totalVersementAgents.toLocaleString()}</div>

                <div className="bg-white p-4 text-xs font-bold text-gray-700">FRAIS DE DOSSIER DE CRÉDIT</div>
                <div className="bg-white p-4 text-sm font-black text-indigo-600 text-right">{totalFraisDossierCredit.toLocaleString()}</div>

                <div className="bg-white p-4 text-xs font-bold text-gray-700 uppercase">Frais de tenue de compte</div>
                <div className="bg-white p-4 text-sm font-black text-indigo-600 text-right">{totalFraisTenueCompte.toLocaleString()}</div>

                <div className="bg-white p-4 text-xs font-bold text-gray-700 uppercase">DEPOT PART SOCIALE</div>
                <div className="bg-white p-4 text-sm font-black text-indigo-600 text-right">{totalPartSocialeDepot.toLocaleString()}</div>

                <div className="bg-white p-4 text-xs font-bold text-gray-700">ADHÉSION</div>
                <div className="bg-white p-4 text-sm font-black text-indigo-600 text-right">{totalAdhesion.toLocaleString()}</div>

                <div className="bg-white p-4 text-xs font-bold text-gray-700">VENTE LIVRET DE COMPTE</div>
                <div className="bg-white p-4 text-sm font-black text-indigo-600 text-right">{totalVenteLivretCompte.toLocaleString()}</div>

                <div className="bg-white p-4 text-xs font-bold text-gray-700">VENTE LIVRET TONTINE</div>
                <div className="bg-white p-4 text-sm font-black text-indigo-600 text-right">{totalVenteLivretTontineNonAgent.toLocaleString()}</div>

                <div className="bg-white p-4 text-xs font-bold text-gray-700 uppercase">Écarts Payés</div>
                <div className="bg-white p-4 text-sm font-black text-emerald-600 text-right">{totalPaidGaps.toLocaleString()}</div>

                <div className="bg-white p-4 text-xs font-bold text-gray-700 uppercase">Approvisionnement Caisse</div>
                <div className="bg-white p-4 text-sm font-black text-emerald-600 text-right">{totalVaultInflow.toLocaleString()}</div>

                <div className="bg-emerald-50 p-4 text-xs font-black text-emerald-900 uppercase">Total Entrées</div>
                <div className="bg-emerald-50 p-4 text-sm font-black text-emerald-900 text-right">{totalInflow.toLocaleString()}</div>

                <div className="col-span-2 bg-gray-100 p-2 text-[10px] font-black text-gray-500 uppercase tracking-widest text-center">Sorties</div>

                <div className="bg-white p-4 text-xs font-bold text-gray-700">RETRAIT SUR COMPTE ÉPARGNE</div>
                <div className="bg-white p-4 text-sm font-black text-red-600 text-right">{displayRetraitMemb.toLocaleString()}</div>

                <div className="bg-white p-4 text-xs font-bold text-gray-700">RETRAIT TONTINE</div>
                <div className="bg-white p-4 text-sm font-black text-red-600 text-right">{displayRetraitTont.toLocaleString()}</div>
                
                <div className="bg-white p-4 text-xs font-bold text-gray-700 uppercase">Retrait Garantie</div>
                <div className="bg-white p-4 text-sm font-black text-red-600 text-right">{totalRetraitGarantie.toLocaleString()}</div>
                
                <div className="bg-white p-4 text-xs font-bold text-gray-700">CRÉDIT ACCORDÉ</div>
                <div className="bg-white p-4 text-sm font-black text-red-600 text-right">{totalCreditAccor.toLocaleString()}</div>
                
                <div className="bg-white p-4 text-xs font-bold text-gray-700">DÉPENSES ADMINISTRATIVES</div>
                <div className="bg-white p-4 text-sm font-black text-red-600 text-right">{totalAdminExpenses.toLocaleString()}</div>
                
                <div className="bg-white p-4 text-xs font-bold text-gray-700 uppercase">RETRAIT PART SOCIALE</div>
                <div className="bg-white p-4 text-sm font-black text-red-600 text-right">{totalPartSocialeRetrait.toLocaleString()}</div>

                <div className="bg-white p-4 text-xs font-bold text-gray-700 uppercase">Écarts sur retrait tontine</div>
                <div className="bg-white p-4 text-sm font-black text-amber-600 text-right">{totalGapTontine.toLocaleString()}</div>
                
                <div className="bg-white p-4 text-xs font-bold text-gray-700 uppercase">Versement au Coffre</div>
                <div className="bg-white p-4 text-sm font-black text-red-600 text-right">{totalVaultOutflow.toLocaleString()}</div>

                <div className="bg-red-50 p-4 text-xs font-black text-red-900 uppercase">Total Sorties</div>
                <div className="bg-red-50 p-4 text-sm font-black text-red-900 text-right">{totalOutflow.toLocaleString()}</div>

                <div className="col-span-2 bg-blue-50 p-4 flex justify-between items-center">
                  <span className="text-xs font-black text-blue-900 uppercase">Flux Net de la Période</span>
                  <span className={`text-lg font-black ${(totalInflow - totalOutflow) >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                    {(totalInflow - totalOutflow).toLocaleString()} F
                  </span>
                </div>
              </div>
            </div>

            {/* Colonne Droite: Soldes */}
            <div className="space-y-6">
              <div className="space-y-4">
                <div className="flex flex-col gap-1 p-6 bg-amber-50 rounded-3xl border border-amber-100">
                  <span className="text-[10px] font-black text-amber-800 uppercase tracking-widest">Approvisionnement caisse</span>
                  <span className="text-2xl font-black text-amber-900">{totalVaultInflow.toLocaleString()} F</span>
                </div>

                <div className="flex items-center justify-between p-6 bg-blue-600 rounded-3xl shadow-lg shadow-blue-200">
                  <span className="text-xs font-black text-white uppercase tracking-widest">Solde Actuel (Théorique)</span>
                  <span className="text-2xl font-black text-white">{currentBalance.toLocaleString()} F</span>
                </div>

                <div className="flex items-center justify-between p-6 bg-emerald-500 rounded-3xl shadow-lg shadow-emerald-200">
                  <span className="text-xs font-black text-white uppercase tracking-widest">Solde Physique (Réel)</span>
                  <div className="flex items-center gap-3">
                    <button 
                      onClick={() => {
                        const canModify = !isPhysicalBalanceValidated || 
                                        currentUser?.role === 'administrateur' || 
                                        currentUser?.role === 'Directeur';
                        if (canModify) {
                          setIsBilletageModalOpen(true);
                        } else {
                          alert("Seul l'administrateur ou le Directeur peut modifier le solde physique une fois validé.");
                        }
                      }}
                      className={`p-2 rounded-xl text-white transition-all ${(!isPhysicalBalanceValidated || currentUser?.role === 'administrateur' || currentUser?.role === 'Directeur') ? 'bg-white/20 hover:bg-white/30' : 'bg-white/10 cursor-not-allowed opacity-50'}`}
                      title="Saisir le billetage"
                    >
                      <Calculator size={20} />
                    </button>
                    <button 
                      onClick={() => setIsHistoryModalOpen(true)}
                      className="p-2 bg-white/20 hover:bg-white/30 rounded-xl text-white transition-all"
                      title="Voir l'historique des billetages"
                    >
                      <HistoryIcon size={20} />
                    </button>
                    <span className="text-2xl font-black text-white">{physicalBalance.toLocaleString()} F</span>
                  </div>
                </div>

                <div className={`flex items-center justify-between p-6 rounded-3xl border-2 ${physicalBalance - currentBalance === 0 ? 'bg-gray-50 border-gray-200' : 'bg-red-50 border-red-200'}`}>
                  <span className={`text-xs font-black uppercase tracking-widest ${physicalBalance - currentBalance === 0 ? 'text-gray-500' : 'text-red-600'}`}>Écart de Caisse</span>
                  <span className={`text-2xl font-black ${physicalBalance - currentBalance === 0 ? 'text-gray-700' : 'text-red-700'}`}>
                    {(physicalBalance - currentBalance).toLocaleString()} F
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Épargne */}
        {(selectedReport === 'all' || selectedReport === 'epargne_depots') && renderSection("Dépôts Compte Épargne", pureDepotEpargne, <TrendingUp size={20} />, "emerald", "epargne_depots")}
        {(selectedReport === 'all' || selectedReport === 'epargne_retraits') && renderSection("Retraits Compte Épargne", data.epargneRetraits, <Wallet size={20} />, "red", "epargne_retraits")}

        {/* Tontine Dépôts par Zone */}
        {(selectedReport === 'all' || selectedReport === 'tontine_depots') && (
          <div className="lg:col-span-2 space-y-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-100 text-indigo-600 flex items-center justify-center"><MapPin size={20} /></div>
              <h2 className="text-lg font-black text-[#121c32] uppercase tracking-tight">Dépôts Tontine par Zone</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {Object.entries(data.tontineDepotsByZone)
                .filter(([zone]) => selectedZone === 'all' || selectedZone === zone)
                .map(([zone, list]) => (
                  (list as any[]).length > 0 || zone !== 'Inconnue' ? renderSection(`Zone ${zone}`, list as any[], <TrendingUp size={16} />, "indigo", `depot-zone-${zone}`) : null
                ))}
            </div>
          </div>
        )}

        {/* Tontine Retraits par Zone */}
        {(selectedReport === 'all' || selectedReport === 'tontine_retraits') && (
          <div className="lg:col-span-2 space-y-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-orange-100 text-orange-600 flex items-center justify-center"><MapPin size={20} /></div>
              <h2 className="text-lg font-black text-[#121c32] uppercase tracking-tight">Retraits Tontine par Zone</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {Object.entries(data.tontineRetraitsByZone)
                .filter(([zone]) => selectedZone === 'all' || selectedZone === zone)
                .map(([zone, list]) => (
                  (list as any[]).length > 0 || zone !== 'Inconnue' ? renderSection(`Zone ${zone}`, list as any[], <Wallet size={16} />, "orange", `retrait-zone-${zone}`) : null
                ))}
            </div>
          </div>
        )}

        {/* Crédits */}
        {(selectedReport === 'all' || selectedReport === 'credits_accordes') && renderSection("Crédits Accordés & Frais", data.creditsAccordes, <CreditCard size={20} />, "blue", "credits_accordes")}
        {(selectedReport === 'all' || selectedReport === 'remboursements') && renderSection("Remboursements & Intérêts", data.remboursements, <TrendingUp size={20} />, "purple", "remboursements")}

        {/* Garantie */}
        {(selectedReport === 'all' || selectedReport === 'garantie_depots') && renderSection("Dépôts Garantie", data.garantieDepots, <TrendingUp size={20} />, "emerald", "garantie_depots")}
        {(selectedReport === 'all' || selectedReport === 'garantie_retraits') && renderSection("Retraits Garantie", data.garantieRetraits, <Wallet size={20} />, "red", "garantie_retraits")}

        {/* Dépenses Administratives */}
        {(selectedReport === 'all' || selectedReport === 'depenses_admin') && (
          <div className="lg:col-span-2">
            {renderSection("Détails des Dépenses Administratives", data.adminExpenses, <Calculator size={20} />, "red", "depenses_admin")}
          </div>
        )}

        {/* Versements Agents */}
        {(selectedReport === 'all' || selectedReport === 'versement_agents') && (
          <div className="lg:col-span-2">
            {renderSection("Versement des Agents Commerciaux", data.agentPayments.map(p => ({
              id: p.id,
              date: p.date,
              memberName: p.agentName,
              amount: p.observedAmount || p.totalAmount,
              description: `Versement Validé - ${p.caisse}`
            })), <Wallet size={20} />, "emerald", "versement_agents")}
          </div>
        )}

        {/* Livrets */}
        {(selectedReport === 'all' || selectedReport === 'vente_livrets') && (
          <div className="lg:col-span-2 space-y-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-600 flex items-center justify-center"><BookOpen size={20} /></div>
              <h2 className="text-lg font-black text-[#121c32] uppercase tracking-tight">Vente de Livrets</h2>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div className="space-y-4">
                <h3 className="text-xs font-black text-gray-500 uppercase tracking-widest ml-4">Livrets Tontine par Zone</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {Object.entries(data.livretsTontineByZone)
                    .filter(([zone]) => selectedZone === 'all' || selectedZone === zone)
                    .map(([zone, list]) => (
                      (list as any[]).length > 0 || zone !== 'Inconnue' ? renderSection(`Livrets Zone ${zone}`, list as any[], <BookOpen size={16} />, "amber", `livret-zone-${zone}`) : null
                    ))}
                </div>
              </div>
              {renderSection("Livrets Épargne Vendus", data.livretsEpargne, <BookOpen size={20} />, "amber", "livrets_epargne")}
            </div>
          </div>
        )}

        {/* Frais, Adhésions & Parts Sociales */}
        {(selectedReport === 'all' || selectedReport === 'frais_parts') && (
          <div className="lg:col-span-2 space-y-8">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-100 text-indigo-600 flex items-center justify-center"><CreditCard size={20} /></div>
              <h2 className="text-lg font-black text-[#121c32] uppercase tracking-tight">Frais, Adhésions & Parts Sociales</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {renderSection("Adhésions", adhesionList, <UserPlus size={20} />, "indigo", "adhesion_list")}
              {renderSection("Parts Sociales", partSocialeList, <Users size={20} />, "indigo", "part_sociale_list")}
              {renderSection("Frais de Dossier Crédit", fraisDossierList, <FileText size={20} />, "indigo", "frais_dossier_list")}
              {renderSection("Frais de Tenue de Compte", fraisTenueList, <FileText size={20} />, "indigo", "frais_tenue_list")}
            </div>
          </div>
        )}

        {/* Mouvements de Coffre */}
        {(selectedReport === 'all' || selectedReport === 'vault_transactions') && (
          <div className="lg:col-span-2">
            {renderSection("Mouvements de Coffre (Approvisionnements & Versements)", data.vaultTransactions.map(v => ({
              id: v.id,
              date: v.date,
              memberName: v.type,
              amount: v.amount,
              description: `Opération de Coffre - ${v.userId}`
            })), <Lock size={20} />, "emerald", "vault_transactions")}
          </div>
        )}

        {/* Écarts sur retrait tontine */}
        {(selectedReport === 'all' || selectedReport === 'tontine_gaps') && (
          <div className="lg:col-span-2">
            {renderSection("Écarts sur retrait tontine payé", data.validatedWithdrawals.filter(v => (v.gap || 0) !== 0).map(v => ({
              id: v.id,
              date: v.validationDate,
              memberName: v.memberName,
              amount: v.gap || 0,
              description: `Écart constaté sur retrait - Zone ${v.zone}`
            })), <AlertTriangle size={20} />, "amber", "tontine_gaps")}
          </div>
        )}
      </div>
      {/* Modal Historique des Billetages */}
      {isHistoryModalOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-[2.5rem] w-full max-w-2xl p-8 shadow-2xl animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center">
                  <HistoryIcon size={24} />
                </div>
                <div>
                  <h2 className="text-xl font-black text-[#121c32] uppercase tracking-tight">Historique des Billetages</h2>
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Validations du solde physique</p>
                </div>
              </div>
              <button 
                onClick={() => setIsHistoryModalOpen(false)}
                className="p-2 hover:bg-gray-100 rounded-full text-gray-400 transition-all"
              >
                <X size={24} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar pr-2">
              <table className="w-full text-left">
                <thead className="sticky top-0 bg-white shadow-sm z-10">
                  <tr className="bg-gray-50/50">
                    <th className="px-4 py-3 text-[10px] font-black text-gray-400 uppercase tracking-widest">Date</th>
                    <th className="px-4 py-3 text-[10px] font-black text-gray-400 uppercase tracking-widest text-right">Théorique</th>
                    <th className="px-4 py-3 text-[10px] font-black text-gray-400 uppercase tracking-widest text-right">Physique</th>
                    <th className="px-4 py-3 text-[10px] font-black text-gray-400 uppercase tracking-widest text-right">Écart</th>
                    <th className="px-4 py-3 text-[10px] font-black text-gray-400 uppercase tracking-widest text-center">Détails</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {billetageHistory.length > 0 ? (
                    billetageHistory.map((item) => (
                      <tr key={item.id} className="hover:bg-gray-50/50 transition-colors">
                        <td className="px-4 py-4">
                          <p className="text-xs font-black text-[#121c32]">{new Date(item.date).toLocaleDateString()}</p>
                          <p className="text-[10px] font-bold text-gray-400">{new Date(item.date).toLocaleTimeString()}</p>
                        </td>
                        <td className="px-4 py-4 text-right text-xs font-bold text-gray-600">{item.theoreticalBalance.toLocaleString()} F</td>
                        <td className="px-4 py-4 text-right text-xs font-black text-blue-600">{item.physicalBalance.toLocaleString()} F</td>
                        <td className={`px-4 py-4 text-right text-xs font-black ${item.gap === 0 ? 'text-gray-400' : 'text-red-600'}`}>
                          {item.gap > 0 ? '+' : ''}{item.gap.toLocaleString()} F
                        </td>
                        <td className="px-4 py-4 text-center">
                          <button 
                            onClick={() => setSelectedHistoryItem(item)}
                            className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                          >
                            <Calculator size={16} />
                          </button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5} className="px-4 py-10 text-center text-gray-300 italic text-xs font-bold uppercase tracking-widest">
                        Aucun historique disponible
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Modal Détails Billetage Historique */}
      {selectedHistoryItem && (
        <div className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-[2.5rem] w-full max-w-md p-8 shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                  <Calculator size={20} />
                </div>
                <div>
                  <h2 className="text-lg font-black text-[#121c32] uppercase tracking-tight">Détails Billetage</h2>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Validation du {new Date(selectedHistoryItem.date).toLocaleDateString()}</p>
                </div>
              </div>
              <button 
                onClick={() => setSelectedHistoryItem(null)}
                className="p-2 hover:bg-gray-100 rounded-full text-gray-400 transition-all"
              >
                <X size={20} />
              </button>
            </div>

            <div className="space-y-4">
              <div className="bg-gray-50 rounded-2xl border border-gray-100 overflow-hidden">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-gray-100/50 border-b border-gray-100">
                      <th className="px-4 py-2 font-black text-gray-400 uppercase text-left">Billet/Pièce</th>
                      <th className="px-4 py-2 font-black text-gray-400 uppercase text-center">Nombre</th>
                      <th className="px-4 py-2 font-black text-gray-400 uppercase text-right">Montant</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {[10000, 5000, 2000, 1000, 500, 250, 200, 100, 50, 25, 10, 5].map((denom) => (
                      <tr key={denom}>
                        <td className="px-4 py-2 font-bold text-gray-600">{denom.toLocaleString()} F</td>
                        <td className="px-4 py-2 text-center font-black text-[#121c32]">
                          {selectedHistoryItem.denominations[denom.toString()] || 0}
                        </td>
                        <td className="px-4 py-2 text-right font-black text-gray-400">
                          {((selectedHistoryItem.denominations[denom.toString()] || 0) * denom).toLocaleString()} F
                        </td>
                      </tr>
                    ))}
                    <tr>
                      <td className="px-4 py-2 font-bold text-gray-600 uppercase">Monnaie</td>
                      <td colSpan={2} className="px-4 py-2 text-right font-black text-[#121c32]">
                        {(selectedHistoryItem.denominations.monnaie || 0).toLocaleString()} F
                      </td>
                    </tr>
                  </tbody>
                  <tfoot>
                    <tr className="bg-blue-50 border-t border-blue-100">
                      <td colSpan={2} className="px-4 py-3 font-black text-[#121c32] uppercase tracking-widest">Total Physique</td>
                      <td className="px-4 py-3 text-right font-black text-blue-600">
                        {selectedHistoryItem.physicalBalance.toLocaleString()} F
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100 space-y-1">
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Validé par</p>
                <p className="text-xs font-black text-[#121c32] uppercase">{selectedHistoryItem.validator}</p>
              </div>

              <button 
                onClick={() => setSelectedHistoryItem(null)}
                className="w-full py-4 bg-[#121c32] text-white rounded-2xl font-black uppercase tracking-widest text-xs shadow-lg hover:bg-black transition-all active:scale-95"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Billetage pour Solde Physique */}
      {isBilletageModalOpen && (
        <div className="fixed inset-0 bg-black/60 z-[60] flex items-start justify-center p-4 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white rounded-[2.5rem] w-full max-w-md p-6 sm:p-8 shadow-2xl animate-in zoom-in-95 duration-200 my-4 sm:my-8">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                  <Calculator size={20} />
                </div>
                <div>
                  <h2 className="text-lg font-black text-[#121c32] uppercase tracking-tight">Saisie du Billetage</h2>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Détails des fonds physiques</p>
                </div>
              </div>
              <button 
                onClick={() => setIsBilletageModalOpen(false)}
                className="p-2 hover:bg-gray-100 rounded-full text-gray-400 transition-all"
              >
                <X size={20} />
              </button>
            </div>

            <div className="space-y-4">
              <div className="bg-gray-50 rounded-2xl border border-gray-100 overflow-hidden">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-gray-100/50 border-b border-gray-100">
                      <th className="px-3 py-2 font-black text-gray-400 uppercase text-left">Billet/Pièce</th>
                      <th className="px-3 py-2 font-black text-gray-400 uppercase text-center">Nombre</th>
                      <th className="px-3 py-2 font-black text-gray-400 uppercase text-right">Montant</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {[10000, 5000, 2000, 1000, 500, 250, 200, 100, 50, 25, 10, 5].map((denom) => (
                      <tr key={denom}>
                        <td className="px-3 py-2 font-bold text-gray-600">{denom.toLocaleString()} F</td>
                        <td className="px-3 py-2 text-center">
                          <input 
                            type="number" 
                            min="0"
                            value={denominations[denom.toString()] || ''}
                            onChange={(e) => handleBilletageChange(denom.toString(), e.target.value)}
                            className="w-16 p-1 bg-white border border-gray-200 rounded-lg text-center font-black text-[#121c32] outline-none focus:border-emerald-500"
                          />
                        </td>
                        <td className="px-3 py-2 text-right font-black text-gray-400">
                          {((denominations[denom.toString()] || 0) * denom).toLocaleString()} F
                        </td>
                      </tr>
                    ))}
                    <tr>
                      <td className="px-3 py-2 font-bold text-gray-600 uppercase">Monnaie</td>
                      <td colSpan={2} className="px-3 py-2 text-right">
                        <input 
                          type="number" 
                          min="0"
                          value={denominations.monnaie || ''}
                          onChange={(e) => handleBilletageChange('monnaie', e.target.value)}
                          className="w-full max-w-[120px] p-1 bg-white border border-gray-200 rounded-lg text-right font-black text-[#121c32] outline-none focus:border-emerald-500"
                          placeholder="Montant total"
                        />
                      </td>
                    </tr>
                  </tbody>
                  <tfoot className="bg-emerald-50">
                    <tr className="border-t border-emerald-100">
                      <td colSpan={2} className="px-3 py-3 font-black text-[#121c32] uppercase tracking-widest text-[10px] sm:text-xs">Total Physique</td>
                      <td className="px-3 py-3 text-right font-black text-emerald-600 text-base sm:text-lg whitespace-nowrap">
                        {calculateTotalBilletage().toLocaleString()} F
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            <div className="flex gap-3 pt-6">
                <button 
                  onClick={() => setIsBilletageModalOpen(false)}
                  className="flex-1 py-3 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all"
                >
                  Annuler
                </button>
                <button 
                  onClick={confirmBilletage}
                  className="flex-1 py-3 bg-emerald-500 hover:bg-emerald-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all shadow-lg shadow-emerald-900/20"
                >
                  Valider le Solde
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
  );
};

export default FinancialReports;
