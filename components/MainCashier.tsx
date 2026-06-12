
import React, { useState, useEffect } from 'react';
import { dispatchStorageEvent } from '../utils/events';
import { Landmark, CheckCircle, XCircle, Clock, Search, Filter, TrendingUp, Wallet, ArrowDownCircle, Send, ShieldCheck } from 'lucide-react';
import { recordAuditLog } from '../utils/audit';
import ConfirmModal from './ConfirmModal';

const calculateTheoreticalBalanceForCaisse = (caisseName: string) => {
  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];
  const startDate = todayStr;
  const endDate = todayStr;

  const savedUsers = localStorage.getItem('microfox_users');
  const rawUsers = savedUsers ? JSON.parse(savedUsers) : [];
  
  const userStr = localStorage.getItem('microfox_current_user');
  const user = userStr ? JSON.parse(userStr) : null;
  const isCaissier = user?.role === 'caissier';
  
  const allUsers = rawUsers.filter((u: any) => !user || user.codeMF === 'GLOBAL' || u.codeMF === user.codeMF);
  const agentIds = allUsers.filter((u: any) => u.role === 'agent commercial').map((u: any) => u.id);

  const selectedCaisseArr = [caisseName];

  let openingBalance = 0;
  
  // Transactions
  let epargneDepots: any[] = [];
  let epargneRetraits: any[] = [];
  let tontineDepotsByZone: Record<string, any[]> = {};
  let tontineRetraitsByZone: Record<string, any[]> = {};
  let creditsAccordes: any[] = [];
  let remboursements: any[] = [];
  let garantieDepots: any[] = [];
  let garantieRetraits: any[] = [];
  let adminExpenses: any[] = [];
  let agentPayments: any[] = [];
  let agentOutflowPayments: any[] = [];
  let vaultTransactions: any[] = [];
  let cashGaps: any[] = [];

  const getCaisseDelta = (tx: any) => {
    const desc = (tx.description || '').toLowerCase();
    const isAgent = agentIds.includes(tx.userId);
    
    let inflow = 0;
    let outflow = 0;

    if (tx.account === 'epargne' || tx.account === 'frais' || tx.account === 'partSociale') {
      if (tx.type === 'depot') inflow = tx.amount || 0;
      if (tx.type === 'retrait' || tx.type === 'transfert') outflow = tx.amount || 0;
    } else if (tx.account === 'tontine') {
      if (tx.type === 'depot' || tx.type === 'cotisation') {
        if (!isAgent) inflow = tx.amount || 0;
      }
      if (tx.type === 'retrait' || tx.type === 'transfert') outflow = tx.amount || 0;
    } else if (tx.account === 'credit') {
      if (tx.type === 'deblocage' && !desc.includes('pénalité') && !desc.includes('penalite')) outflow = tx.amount || 0;
      if (tx.type === 'remboursement') inflow = tx.amount || 0;
    } else if (tx.account === 'garantie') {
      if (tx.type === 'depot') inflow = tx.amount || 0;
      if (tx.type === 'retrait' || tx.type === 'transfert') outflow = tx.amount || 0;
    }

    if (tx.type === 'transfert' && tx.destinationAccount) {
      if (tx.destinationAccount === 'tontine') {
        if (!isAgent) inflow = tx.amount || 0;
      } else {
        inflow = tx.amount || 0;
      }
    }

    return inflow - outflow;
  };

  // Load Member transactions
  const savedMembers = localStorage.getItem('microfox_members_data');
  const seenTxIds = new Set<string>();

  if (savedMembers) {
    const allMembers = JSON.parse(savedMembers);
    allMembers.forEach((member: any) => {
      const history = member.history || [];
      history.forEach((tx: any) => {
        const txKey = tx.id || `${tx.date}_${tx.type}_${tx.amount}_${member.id}_${tx.description}`;
        if (seenTxIds.has(txKey)) return;

        if (tx.type === 'deblocage') {
          const deblocageKey = `debloc_strict_${tx.date.split('T')[0]}_${Math.round(tx.amount)}_${member.id}`;
          if (seenTxIds.has(deblocageKey)) return;
          seenTxIds.add(deblocageKey);
        }

        seenTxIds.add(txKey);

        const txUser = allUsers.find((u: any) => u.id === tx.userId);
        const txCaisse = tx.caisse || txUser?.caisse || 'N/A';
        
        if (isCaissier) {
          const isMyOp = tx.userId === user.id || (tx.cashierName && tx.cashierName === user.identifiant);
          if (!isMyOp) return;
        }
        if (!selectedCaisseArr.some(c => c.toUpperCase() === txCaisse.toUpperCase())) return;
        
        const txDate = tx.date.split('T')[0];
        
        if (txDate < startDate) {
          openingBalance += getCaisseDelta(tx);
          return;
        }

        if (txDate > endDate) return;

        if (tx.account === 'epargne' || tx.account === 'frais' || tx.account === 'partSociale') {
          if (tx.type === 'depot') epargneDepots.push(tx);
          if (tx.type === 'retrait' || tx.type === 'transfert') epargneRetraits.push(tx);
        }

        if (tx.account === 'tontine') {
          if (tx.type === 'depot' || tx.type === 'cotisation') {
            const desc = (tx.description || '').toLowerCase();
            if (!desc.includes('livret')) {
              const zone = member.zone || 'Inconnue';
              if (!tontineDepotsByZone[zone]) tontineDepotsByZone[zone] = [];
              tontineDepotsByZone[zone].push(tx);
            }
          }
          if (tx.type === 'retrait' || tx.type === 'transfert') {
            const zone = member.zone || 'Inconnue';
            if (!tontineRetraitsByZone[zone]) tontineRetraitsByZone[zone] = [];
            tontineRetraitsByZone[zone].push(tx);
          }
        }

        if (tx.account === 'credit') {
          const desc = (tx.description || '').toLowerCase();
          if (tx.type === 'deblocage' && !desc.includes('pénalité') && !desc.includes('penalite')) creditsAccordes.push(tx);
          if (tx.type === 'remboursement') remboursements.push(tx);
        }

        if (tx.account === 'garantie') {
          if (tx.type === 'depot') garantieDepots.push(tx);
          if (tx.type === 'retrait' || tx.type === 'transfert') garantieRetraits.push(tx);
        }

        if (tx.type === 'transfert' && tx.destinationAccount) {
          const destTx = { ...tx, account: tx.destinationAccount, type: 'depot' };
          if (tx.destinationAccount === 'epargne' || tx.destinationAccount === 'frais' || tx.destinationAccount === 'partSociale') {
            epargneDepots.push(destTx);
          } else if (tx.destinationAccount === 'garantie') {
            garantieDepots.push(destTx);
          } else if (tx.destinationAccount === 'tontine') {
            const zone = member.zone || 'Inconnue';
            if (!tontineDepotsByZone[zone]) tontineDepotsByZone[zone] = [];
            tontineDepotsByZone[zone].push(destTx);
          }
        }
      });
    });
  }

  // Load Admin Expenses
  const savedExpenses = localStorage.getItem('microfox_admin_expenses');
  if (savedExpenses) {
    const allExpenses = JSON.parse(savedExpenses);
    allExpenses.forEach((e: any) => {
      if (e.isDeleted) return;
      
      const eDate = e.date.split('T')[0];
      const expUser = allUsers.find((u: any) => u.identifiant === e.recordedBy);
      const expCaisse = expUser?.caisse || 'N/A';

      if (isCaissier && e.recordedBy !== user.identifiant) return;
      if (!selectedCaisseArr.includes(expCaisse)) return;

      if (eDate < startDate) {
        openingBalance -= e.amount;
      } else if (eDate <= endDate) {
        adminExpenses.push(e);
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

      const isSender = (isCaissier && user?.caisse && String(p.agentId).toUpperCase() === String(user.caisse).toUpperCase()) ||
                      (!isCaissier && selectedCaisseArr.some(c => c.toUpperCase() === (p.agentId || '').toUpperCase()));

      const isReceiver = (isCaissier && user?.caisse && p.caisse?.toUpperCase() === user.caisse.toUpperCase()) ||
                        (!isCaissier && selectedCaisseArr.some(c => c.toUpperCase() === (p.caisse || '').toUpperCase()));

      if (isSender) {
        if (p.status === 'Validé' || p.status === 'En attente') {
          if (pDate < startDate) {
            openingBalance -= amount;
          } else if (pDate <= endDate) {
            agentOutflowPayments.push(p);
          }
        }
      }

      if (isReceiver && p.status === 'Validé') {
        if (pDate < startDate) {
          openingBalance += amount;
        } else if (pDate <= endDate) {
          agentPayments.push(p);
        }
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
        if ((v.type === 'Approvisionnement Caisse' || v.type === 'Fonds de caisse' || v.type === 'Versement Caisse') && v.to?.toUpperCase() === user.caisse?.toUpperCase()) {
          isRelevant = true;
          delta = v.amount;
        } else if ((v.type === 'Versement au Coffre' || v.type === 'Versement Fin de Journée' || v.type === 'Versement Caisse' || v.type === 'Régularisation Écart') && v.from === user.caisse) {
          isRelevant = true;
          delta = -v.amount;
        } else if (v.userId === user.id) {
          isRelevant = true;
          delta = (v.type === 'Approvisionnement Caisse' || v.type === 'Fonds de caisse' || v.type.toLowerCase().includes('versement') || v.type === 'Régularisation Écart') ? v.amount : -v.amount;
        }
      } else {
        if ((v.type === 'Approvisionnement Caisse' || v.type === 'Fonds de caisse' || v.type === 'Versement Caisse') && selectedCaisseArr.some(c => c.toUpperCase() === v.to?.toUpperCase())) {
          isRelevant = true;
          delta = v.amount;
        } else if ((v.type === 'Versement au Coffre' || v.type === 'Versement Fin de Journée' || v.type === 'Versement Caisse' || v.type === 'Régularisation Écart') && selectedCaisseArr.some(c => c.toUpperCase() === v.from?.toUpperCase())) {
          isRelevant = true;
          delta = -v.amount;
        } else {
          const vUser = allUsers.find((u: any) => u.id === v.userId);
          if (vUser?.caisse && selectedCaisseArr.some(c => c.toUpperCase() === vUser.caisse.toUpperCase())) {
            isRelevant = true;
            delta = (v.type === 'Approvisionnement Caisse' || v.type === 'Fonds de caisse' || v.type.toLowerCase().includes('versement') || v.type === 'Régularisation Écart') ? v.amount : -v.amount;
          }
        }
      }

      if (isRelevant) {
        if (vDate < startDate) {
          openingBalance += delta;
        } else if (vDate <= endDate) {
          vaultTransactions.push(v);
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
      if (!selectedCaisseArr.some(c => c.toUpperCase() === (vCaisse || 'N/A').toUpperCase())) return;

      if (vDate < startDate) {
        openingBalance -= gap;
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
      if (!selectedCaisseArr.some(c => c.toUpperCase() === (gCaisse || 'N/A').toUpperCase())) return;

      if (g.type === 'CAISSIER') return;

      if (gDate < startDate) {
        openingBalance -= (g.gapAmount || 0);
      } else if (gDate <= endDate) {
        cashGaps.push(g);
      }
    });
  }

  const calculateTotal = (list: any[]) => list.reduce((sum, item) => sum + (item.amount || 0), 0);

  const totalDepotMemb = calculateTotal(epargneDepots);
  const totalRetraitMemb = calculateTotal(epargneRetraits);
  const totalDepotTont = Object.values(tontineDepotsByZone).reduce((acc: number, list) => acc + calculateTotal(list as any[]), 0) as number;
  const totalGapTontine = cashGaps
    .filter(g => g.type === 'TONTINE')
    .reduce((acc, g) => acc + (g.gapAmount || 0), 0);

  const totalRetraitTont = Object.values(tontineRetraitsByZone).reduce((acc: number, list) => acc + calculateTotal(list as any[]), 0) as number;
  const displayRetraitTont = totalRetraitTont - totalGapTontine;
  const totalCreditAccor = calculateTotal(creditsAccordes);
  
  const totalCapitalRemb = remboursements.reduce((acc, tx) => {
    const match = tx.description?.match(/Cap: (\d+)/);
    if (match) return acc + Number(match[1]);
    
    const intMatch = tx.description?.match(/Int: (\d+)/);
    const penMatch = tx.description?.match(/Pen: (\d+)/);
    
    if (intMatch || penMatch) {
      const otherAmounts = (intMatch ? Number(intMatch[1]) : 0) + (penMatch ? Number(penMatch[1]) : 0);
      return acc + Math.max(0, tx.amount - otherAmounts);
    }
    
    return acc + tx.amount;
  }, 0);
  const totalInteretRemb = remboursements.reduce((acc, tx) => {
    const match = tx.description?.match(/Int: (\d+)/);
    return acc + (match ? Number(match[1]) : 0);
  }, 0);
  const totalPenaliteRemb = remboursements.reduce((acc, tx) => {
    const match = tx.description?.match(/Pen: (\d+)/);
    return acc + (match ? Number(match[1]) : 0);
  }, 0);
  
  const totalCreditRemb = totalCapitalRemb + totalInteretRemb + totalPenaliteRemb;

  const totalDepotGarantie = calculateTotal(garantieDepots);
  const totalRetraitGarantie = calculateTotal(garantieRetraits);

  const totalAdminExpenses = calculateTotal(adminExpenses);
  const totalObservedVersementAgents = calculateTotal(agentPayments.map(p => ({ amount: p.observedAmount || p.totalAmount })));
  const totalVersementAgents = totalObservedVersementAgents;
  const totalAgentOutflow = calculateTotal(agentOutflowPayments.map((p: any) => ({ amount: p.observedAmount || p.totalAmount })));
  
  const totalPartSocialeDepot = epargneDepots.filter(tx => 
    tx.account === 'partSociale' || tx.description?.toLowerCase().includes('part sociale')
  ).reduce((acc, tx) => acc + tx.amount, 0);

  const totalPartSocialeRetrait = epargneRetraits.filter(tx => 
    tx.account === 'partSociale' || tx.description?.toLowerCase().includes('part sociale')
  ).reduce((acc, tx) => acc + tx.amount, 0);

  const totalAdhesion = epargneDepots.filter(tx => 
    tx.description?.toLowerCase().includes('adhésion') && 
    tx.account !== 'partSociale' &&
    !tx.description?.toLowerCase().includes('part sociale')
  ).reduce((acc, tx) => acc + tx.amount, 0);

  const tontineAgentsCollected = Object.values(tontineDepotsByZone).reduce((acc: number, list) => {
    return acc + calculateTotal(list.filter((tx: any) => agentIds.includes(tx.userId)));
  }, 0);

  const totalDepotTontNonAgent = totalDepotTont - tontineAgentsCollected;
  
  const totalVaultInflow = vaultTransactions
    .filter(v => v.type === 'Approvisionnement Caisse' || v.type === 'Fonds de caisse')
    .reduce((acc, v) => acc + v.amount, 0);
  
  const totalVaultOutflow = vaultTransactions
    .filter(v => v.type === 'Versement au Coffre' || v.type === 'Versement Fin de Journée')
    .reduce((acc, v) => acc + v.amount, 0);

  const totalPaidGaps = vaultTransactions
    .filter(v => v.type === 'Régularisation Écart')
    .reduce((acc, v) => acc + v.amount, 0);

  const displayDepotMemb = totalDepotMemb - (totalPartSocialeDepot + totalAdhesion);
  const displayRetraitMemb = totalRetraitMemb - totalPartSocialeRetrait;
  const displayDepotTont = totalDepotTontNonAgent;

  const totalInflow = displayDepotMemb + displayDepotTont + totalDepotGarantie + totalCreditRemb + totalVersementAgents + totalPartSocialeDepot + totalAdhesion + totalPaidGaps + totalVaultInflow;
  const totalOutflow = displayRetraitMemb + displayRetraitTont + totalRetraitGarantie + totalCreditAccor + totalAdminExpenses + totalPartSocialeRetrait + totalGapTontine + totalVaultOutflow + totalAgentOutflow;

  return openingBalance + totalInflow - totalOutflow;
};

const MainCashier: React.FC = () => {
  const [payments, setPayments] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('En attente');
  const [paymentCaisseFilter, setPaymentCaisseFilter] = useState(() => {
    const userStr = localStorage.getItem('microfox_current_user');
    if (userStr) {
      const u = JSON.parse(userStr);
      if (u.role === 'caissier' && u.caisse) {
        return u.caisse.trim();
      }
    }
    return 'Tous';
  });
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [transferType, setTransferType] = useState<'total' | 'partial'>('total');
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    type: 'confirm' | 'alert' | 'success' | 'error';
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
    type: 'confirm'
  });

  const showAlert = (title: string, message: string, type: 'alert' | 'success' | 'error' = 'alert') => {
    setConfirmModal({
      isOpen: true,
      title,
      message,
      onConfirm: () => setConfirmModal(prev => ({ ...prev, isOpen: false })),
      type
    });
  };

  const showConfirm = (title: string, message: string, onConfirm: () => void) => {
    setConfirmModal({
      isOpen: true,
      title,
      message,
      onConfirm: onConfirm,
      type: 'confirm'
    });
  };
  const [caisses, setCaisses] = useState(() => {
    const userStr = localStorage.getItem('microfox_current_user');
    if (userStr) {
      const user = JSON.parse(userStr);
      if (user.role === 'caissier' && user.caisse) {
        return [user.caisse];
      }
    }
    return ['CAISSE PRINCIPALE', 'CAISSE 1', 'CAISSE 2', 'CAISSE 3', 'CAISSE 4'];
  });
  const [selectedCaisse, setSelectedCaisse] = useState(() => {
    const userStr = localStorage.getItem('microfox_current_user');
    if (userStr) {
      const user = JSON.parse(userStr);
      if (user.role === 'caissier' && user.caisse) {
        return user.caisse.trim();
      }
    }
    return 'CAISSE PRINCIPALE';
  });
  const [cashBalance, setCashBalance] = useState(() => {
    const userStr = localStorage.getItem('microfox_current_user');
    let initialCaisse = 'CAISSE PRINCIPALE';
    if (userStr) {
      const user = JSON.parse(userStr);
      if (user.role === 'caissier' && user.caisse) {
        initialCaisse = user.caisse.trim();
      }
    }
    return calculateTheoreticalBalanceForCaisse(initialCaisse);
  });
  const [denominations, setDenominations] = useState<any>({
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
    return (Number(denominations['10000']) * 10000) +
           (Number(denominations['5000']) * 5000) +
           (Number(denominations['2000']) * 2000) +
           (Number(denominations['1000']) * 1000) +
           (Number(denominations['500']) * 500) +
           (Number(denominations['250']) * 250) +
           (Number(denominations['200']) * 200) +
           (Number(denominations['100']) * 100) +
           (Number(denominations['50']) * 50) +
           (Number(denominations['25']) * 25) +
           (Number(denominations['10']) * 10) +
           (Number(denominations['5']) * 5) +
           Number(denominations['monnaie']);
  };

  const [observedAmounts, setObservedAmounts] = useState<{[key: string]: string}>({});
  const [gapObservations, setGapObservations] = useState<{[key: string]: string}>({});
  const [validationErrors, setValidationErrors] = useState<{[key: string]: string}>({});
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const [expandedPaymentId, setExpandedPaymentId] = useState<string | null>(null);

  const [activePage, setActivePage] = useState<'versements' | 'details'>('versements');

  const getCaisseTransactionsDetails = () => {
    const details: any[] = [];
    const targetCaisseUpper = selectedCaisse.toUpperCase();

    // 1. Initialisations from vault transactions
    const savedVault = localStorage.getItem('microfox_vault_transactions');
    const vaultTxs = savedVault ? JSON.parse(savedVault) : [];
    
    // 2. Member history transactions
    const savedMembers = localStorage.getItem('microfox_members_data');
    const members = savedMembers ? JSON.parse(savedMembers) : [];
    
    // 3. Admin expenses
    const savedExpenses = localStorage.getItem('microfox_admin_expenses');
    const expenses = savedExpenses ? JSON.parse(savedExpenses) : [];
    
    // 4. Cashier transfers
    const savedPayments = localStorage.getItem('microfox_agent_payments');
    const payments = savedPayments ? JSON.parse(savedPayments) : [];

    // Initialisation
    vaultTxs.forEach((tx: any) => {
      if (tx.type === "Initialisation Caisse Principale" && targetCaisseUpper === 'CAISSE PRINCIPALE') {
        details.push({
          id: tx.id || `init_cp_${tx.date}`,
          date: tx.date,
          type: "Initialisation Caisse Principale",
          description: "Solde initial d'ouverture",
          amount: tx.amount,
          category: 'credit',
          rawTx: tx
        });
      }
    });

    // Member transactions
    members.forEach((m: any) => {
      const savedHistory = localStorage.getItem(`microfox_history_${m.id}`);
      const history = savedHistory ? JSON.parse(savedHistory) : (m.history || []);
      
      history.forEach((tx: any) => {
        if (tx.isDeleted || tx.type === 'annulation' || tx.status === 'deleted') {
          return;
        }
        const txCaisse = (tx.caisse || '').toUpperCase();
        if (txCaisse === targetCaisseUpper) {
          const isCredit = [
            'deposit', 'depot', 'cotisation', 'remboursement',
            'parts_sociales_frais', 'frais_adhesion', 'adhesion',
            'part_sociale', 'vente_livret', 'credit'
          ].includes(tx.type);
          const isDebit = [
            'retrait', 'transfert', 'deblocage', 'debit',
            'dépense', 'depense'
          ].includes(tx.type);
          if (isCredit || isDebit) {
            let label = tx.type;
            if (tx.type === 'deposit' || tx.type === 'depot') label = "Dépôt Épargne";
            else if (tx.type === 'cotisation') label = "Cotisation Tontine";
            else if (tx.type === 'remboursement') label = "Remboursement Crédit";
            else if (tx.type === 'retrait') label = "Retrait";
            else if (tx.type === 'transfert') label = "Transfert";
            else if (tx.type === 'deblocage') label = "Déblocage Crédit";
            else if (tx.type === 'parts_sociales_frais' || tx.type === 'frais_adhesion') label = "Frais d'Adhésion / Parts Sociales";

            details.push({
              id: tx.id || `m_tx_${tx.date || Date.now()}_${Math.random()}`,
              date: tx.date || new Date().toISOString(),
              type: label,
              description: `Membre: ${m.nom || ''} ${m.prenom || ''} (${m.codeAdherent || m.id || ''})`,
              amount: tx.amount,
              category: isCredit ? 'credit' : 'debit',
              rawTx: tx
            });
          }
        }
      });
    });

    // Vault transactions
    const chronoVaultTxs = [...vaultTxs].sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime());
    chronoVaultTxs.forEach((tx: any) => {
      if (tx.type === "Initialisation Coffre Fort" || tx.type === "Initialisation Caisse Principale") {
        return;
      }
      if (tx.type === "Versement Agent") {
        return;
      }
      const fromCaisse = (tx.from || '').toUpperCase();
      const toCaisse = (tx.to || '').toUpperCase();

      const isCashierTransfer = tx.type === "Versement Caisse Principale" && fromCaisse !== 'COFFRE';
      const isRegularVersement = tx.type === "Versement Caisse";
      if (isCashierTransfer || isRegularVersement) {
        return;
      }

      if (fromCaisse === targetCaisseUpper) {
        details.push({
          id: tx.id || `v_tx_from_${tx.date}`,
          date: tx.date,
          type: tx.type,
          description: `Vers: ${tx.to} ${tx.observation ? `(${tx.observation})` : ''}`,
          amount: tx.amount,
          category: 'debit',
          rawTx: tx
        });
      }

      if (toCaisse === targetCaisseUpper) {
        details.push({
          id: tx.id || `v_tx_to_${tx.date}`,
          date: tx.date,
          type: tx.type,
          description: `De: ${tx.from} ${tx.observation ? `(${tx.observation})` : ''}`,
          amount: tx.amount,
          category: 'credit',
          rawTx: tx
        });
      }
    });

    // Expenses
    expenses.forEach((e: any) => {
      if (!e.isDeleted) {
        const caisse = (e.caisse || 'CAISSE PRINCIPALE').toUpperCase();
        if (caisse === targetCaisseUpper) {
          details.push({
            id: e.id || `exp_${e.date || Date.now()}`,
            date: e.date || new Date().toISOString(),
            type: "Dépense Administrative",
            description: `${e.motif || 'Dépense'} ${e.beneficiaire ? `- Récipiendaire: ${e.beneficiaire}` : ''}`,
            amount: e.amount,
            category: 'debit',
            rawTx: e
          });
        }
      }
    });

    // Cashier transfers
    payments.forEach((p: any) => {
      if (p.type === 'CASHIER_TRANSFER') {
        if (p.status !== 'Rejeté' && p.status !== 'Annulé' && p.status !== 'Extourné') {
          const sourceCaisse = (p.agentId || '').toUpperCase();
          const targetCaisse = (p.caisse || 'CAISSE PRINCIPALE').toUpperCase();

          if (sourceCaisse === targetCaisseUpper) {
            const theoreticalAmt = p.totalAmount - (p.gap || 0);
            details.push({
              id: p.id || `ct_src_${p.date || Date.now()}`,
              date: p.date || new Date().toISOString(),
              type: "Versement Caisse Principale",
              description: `Versement vers ${targetCaisse} (${p.status})`,
              amount: theoreticalAmt,
              category: 'debit',
              rawTx: p
            });
          }

          if (p.status === 'Validé' && targetCaisse === targetCaisseUpper) {
            details.push({
              id: p.id || `ct_tgt_${p.date || Date.now()}`,
              date: p.date || new Date().toISOString(),
              type: "Entrée versement Caisse",
              description: `Reçu de la caisse subordonnée ${sourceCaisse}`,
              amount: p.observedAmount || p.totalAmount,
              category: 'credit',
              rawTx: p
            });
          }
        }
      }
    });

    // Sort chronologically (oldest first) to compute running balances correctly
    details.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    let running = 0;
    details.forEach(item => {
      if (item.category === 'credit') {
        running += item.amount;
      } else {
        running -= item.amount;
      }
      item.runningBalance = running;
    });

    // Show newest first
    details.reverse();
    return details;
  };

  useEffect(() => {
    const loadData = () => {
      const savedPayments = localStorage.getItem('microfox_agent_payments');
      if (savedPayments) setPayments(JSON.parse(savedPayments));
      
      setCashBalance(calculateTheoreticalBalanceForCaisse(selectedCaisse));
    };
    
    loadData();

    // Trigger immediate pull from Supabase to fetch freshest agent payments
    window.dispatchEvent(new CustomEvent('request_supabase_sync'));

    // Regularly poll Supabase every 45 seconds to get freshest agent payments
    const syncInterval = setInterval(() => {
      window.dispatchEvent(new CustomEvent('request_supabase_sync'));
    }, 45000);

    window.addEventListener('storage', loadData);
    window.addEventListener('microfox_storage' as any, loadData);
    return () => {
      clearInterval(syncInterval);
      window.removeEventListener('storage', loadData);
      window.removeEventListener('microfox_storage' as any, loadData);
    };
  }, [selectedCaisse]);

  const handleAction = (paymentId: string, action: 'Validé' | 'Rejeté') => {
    const observed = observedAmounts[paymentId];
    const observation = gapObservations[paymentId] || '';

    const processAction = () => {
      const saved = localStorage.getItem('microfox_agent_payments');
      const currentPayments = saved ? JSON.parse(saved) : [];
      const updatedPayments = currentPayments.map((p: any) => {
        if (p.id === paymentId) {
          const finalAmount = (observed !== undefined && observed !== '') ? Number(observed) : p.totalAmount;
          const theoretical = p.theoreticalAmount ?? p.totalAmount;
          const gap = finalAmount - theoretical;

          if (action === 'Validé' && p.status !== 'Validé') {
            const targetCaisse = p.type === 'CASHIER_TRANSFER' ? 'CAISSE PRINCIPALE' : (p.caisse || selectedCaisse); // The destination caisse physically receiving the money
            const balanceKey = `microfox_cash_balance_${targetCaisse}`;
            const savedBal = localStorage.getItem(balanceKey);
            const currentBal = savedBal !== null ? Number(savedBal) : 0;
            const newBal = currentBal + finalAmount;
            localStorage.setItem(balanceKey, newBal.toString());
            
            if (targetCaisse === selectedCaisse) {
              setCashBalance(newBal); // Update cashier balance immediately
            }

            // Record in general history
            const txsSaved = localStorage.getItem('microfox_vault_transactions');
            const allTxs = txsSaved ? JSON.parse(txsSaved) : [];
            const newTx = {
              id: `${Date.now()}_${Math.random().toString(36).substr(2, 9)}_pay`,
              type: 'Versement Agent',
              from: p.agentName,
              to: targetCaisse,
              amount: finalAmount,
              date: new Date().toISOString(),
              userId: p.agentId,
              cashierName: JSON.parse(localStorage.getItem('microfox_current_user') || '{}').identifiant,
              observation: `Versement ${p.type} - ${p.agentName}`
            };
            localStorage.setItem('microfox_vault_transactions', JSON.stringify([newTx, ...allTxs]));

            // Automatic validation of client cotisations/conditions of concerned clients
            try {
              const savedMembers = localStorage.getItem('microfox_members_data');
              if (savedMembers) {
                const members = JSON.parse(savedMembers);
                const validatedZonesSaved = localStorage.getItem('microfox_validated_zone_cotisations');
                const validatedZones = validatedZonesSaved ? JSON.parse(validatedZonesSaved) : {};
                const validationTimestamp = new Date().toISOString();
                const currentUserIdent = JSON.parse(localStorage.getItem('microfox_current_user') || '{}').identifiant || 'System';

                const pendingByDay: Record<string, { total: number, count: number, zone: string }> = {};

                members.forEach((m: any) => {
                  const savedHistory = localStorage.getItem(`microfox_history_${m.id}`);
                  let history = savedHistory ? JSON.parse(savedHistory) : (m.history || []);
                  
                  let historyChanged = false;

                  history = history.map((tx: any) => {
                    const isCotisation = (tx.type === 'cotisation' || tx.type === 'depot' || tx.type === 'deposit') && tx.account === 'tontine';
                    if (isCotisation && !tx.isDeleted && tx.type !== 'annulation') {
                      const isCollectedByAgent = String(tx.userId) === String(p.agentId) || 
                                                 (tx.description && tx.description.toLowerCase().includes(`agent ${p.agentName.toLowerCase()}`)) ||
                                                 (tx.cashierName === p.agentName);
                      const isInAgentZone = p.zone && m.zone === p.zone;

                      if (isCollectedByAgent || isInAgentZone) {
                        const txDate = tx.date ? new Date(tx.date) : null;
                        if (txDate && !isNaN(txDate.getTime())) {
                          const txDay = txDate.toISOString().split('T')[0];
                          const targetZone = m.zone || p.zone || 'N/A';
                          const validationKey = `${txDay}_${targetZone}`;
                          const zoneValidation = validatedZones[validationKey];
                          const isTxValidated = tx.isValidated === true || (zoneValidation && txDate.getTime() <= new Date(zoneValidation.validatedAt).getTime());

                          if (!isTxValidated) {
                            tx.isValidated = true;
                            historyChanged = true;

                            if (!pendingByDay[validationKey]) {
                              pendingByDay[validationKey] = { total: 0, count: 0, zone: targetZone };
                            }
                            pendingByDay[validationKey].total += tx.amount;
                            pendingByDay[validationKey].count += 1;
                          }
                        }
                      }
                    }
                    return tx;
                  });

                  if (historyChanged) {
                    localStorage.setItem(`microfox_history_${m.id}`, JSON.stringify(history));
                  }
                });

                let zonesValidatedCount = 0;
                Object.keys(pendingByDay).forEach(key => {
                  const { total, count } = pendingByDay[key];
                  const prevTotal = validatedZones[key]?.totalAmount || 0;
                  const prevCount = validatedZones[key]?.count || 0;

                  validatedZones[key] = {
                    validatedAt: validationTimestamp,
                    validatedBy: currentUserIdent,
                    totalAmount: prevTotal + total,
                    count: prevCount + count
                  };
                  zonesValidatedCount++;
                });

                if (zonesValidatedCount > 0) {
                  localStorage.setItem('microfox_validated_zone_cotisations', JSON.stringify(validatedZones));
                }
              }
            } catch (e) {
              console.error("Error auto-validating cotisations:", e);
            }
            
            if (gap !== 0) {
              const savedGaps = localStorage.getItem('microfox_all_gaps');
              const allGaps = savedGaps ? JSON.parse(savedGaps) : [];
              
              // Find agent zone
              const savedUsers = localStorage.getItem('microfox_users');
              const allUsers = savedUsers ? JSON.parse(savedUsers) : [];
              const agent = allUsers.find((u: any) => String(u.id) === String(p.agentId));
              const agentZone = agent?.zoneCollecte || agent?.zone;

              const agentCode = agent?.code || p.agentId;

              const newGapEntry = {
          id: `gap_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
                date: new Date().toISOString(),
                opDate: p.date, // Original operation date
                type: 'AGENT',
                sourceId: p.id,
                sourceName: p.agentName,
                sourceCode: agentCode,
                userId: p.agentId,
                declaredAmount: p.theoreticalAmount ?? p.totalAmount,
                observedAmount: finalAmount,
                gapAmount: gap,
                status: 'En attente',
                zone: agentZone,
                caisse: selectedCaisse,
                observation: observation,
                validatorId: JSON.parse(localStorage.getItem('microfox_current_user') || '{}').id
              };
              localStorage.setItem('microfox_all_gaps', JSON.stringify([newGapEntry, ...allGaps]));
            }
          } else if (action === 'Rejeté' && p.status !== 'Rejeté') {
            if (p.type === 'CASHIER_TRANSFER') {
              const sourceCaisseKey = `microfox_cash_balance_${p.agentId}`;
              const currentSourceBal = Number(localStorage.getItem(sourceCaisseKey) || 0);
              localStorage.setItem(sourceCaisseKey, (currentSourceBal + p.totalAmount).toString());
            } else {
              // Return money to agent balance
              const agentBalanceKey = `microfox_agent_balance_${p.agentId}`;
              const currentAgentBalance = Number(localStorage.getItem(agentBalanceKey) || 0);
              localStorage.setItem(agentBalanceKey, (currentAgentBalance + p.totalAmount).toString());
            }
            
            recordAuditLog('MODIFICATION', 'CAISSE', `Versement de ${p.agentName} REJETÉ (${p.totalAmount} FCFA)`);
          }
          return { 
            ...p, 
            status: action, 
            caisse: p.type === 'CASHIER_TRANSFER' ? (p.caisse || 'CAISSE PRINCIPALE') : (action === 'Validé' ? selectedCaisse : (p.caisse || 'CAISSE PRINCIPALE')), 
            observedAmount: finalAmount, 
            gap: gap, 
            validatorId: JSON.parse(localStorage.getItem('microfox_current_user') || '{}').id,
            updatedAt: new Date().toISOString()
          };
        }
        return p;
      });

      localStorage.setItem('microfox_agent_payments', JSON.stringify(updatedPayments));
      localStorage.setItem('microfox_pending_sync', 'true');
      setPayments(updatedPayments);
      dispatchStorageEvent();
      
      setConfirmModal(prev => ({ ...prev, isOpen: false }));
      setStatusMessage({ 
        type: 'success', 
        text: `Versement de ${currentPayments.find((p: any) => p.id === paymentId)?.agentName} ${action.toLowerCase()} avec succès.` 
      });
      setTimeout(() => setStatusMessage(null), 4000);
    };

    if (action === 'Validé') {
      const paymentItem = payments.find((p: any) => p.id === paymentId);
      const displayAmt = (observed !== undefined && observed !== '') ? Number(observed) : (paymentItem ? paymentItem.totalAmount : 0);
      showConfirm("Validation de versement", `Voulez-vous valider le versement de ${displayAmt.toLocaleString()} F ?`, processAction);
    } else {
      showConfirm("Rejet de versement", "Voulez-vous rejeter ce versement ? L'argent sera retourné au solde de l'agent.", processAction);
    }
  };

  const currentUser = JSON.parse(localStorage.getItem('microfox_current_user') || '{}');
  const isAdminOrDirector = currentUser.role === 'admin' || currentUser.role === 'directeur';

  const handleTransferToVault = () => {
    const physicalAmount = calculateTotalBilletage();
    const theoreticalAmount = transferType === 'total' ? cashBalance : physicalAmount;
    const gap = physicalAmount - theoreticalAmount;

    if (theoreticalAmount <= 0) {
      showAlert("Montant invalide", "Le montant à verser doit être supérieur à 0.", "error");
      return;
    }

    if (physicalAmount <= 0) {
      showAlert("Billetage vide", "Le montant du billetage doit être supérieur à 0.", "error");
      return;
    }

    const isMainCaisse = selectedCaisse === 'CAISSE PRINCIPALE';
    const targetDestination = isMainCaisse ? 'Coffre' : 'CAISSE PRINCIPALE';
    
    if (isMainCaisse) {
      if (!isAdminOrDirector) {
        showAlert("Accès restreint", "Seul l'administrateur ou le Directeur peut effectuer un versement au coffre depuis la caisse principale.", "error");
        return;
      }
      const vaultSaved = localStorage.getItem('microfox_vault_balance');
      const vaultBalance = vaultSaved ? Number(vaultSaved) : 10000000;
      localStorage.setItem('microfox_vault_balance', (vaultBalance + physicalAmount).toString());
    } else {
      // Versement à la Caisse Principale - Doit être validé par Admin/Directeur
      const savedPayments = localStorage.getItem('microfox_agent_payments');
      const allPayments = savedPayments ? JSON.parse(savedPayments) : [];
      
      const transferPayment = {
        id: `transfer_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
        agentId: selectedCaisse,
        agentName: selectedCaisse,
        cashierName: currentUser.identifiant,
        amountCotisations: 0,
        amountLivrets: 0,
        totalAmount: physicalAmount,
        physicalBalance: physicalAmount,
        gap: gap,
        billetage: denominations,
        date: new Date().toISOString(),
        status: 'En attente',
        caisse: 'CAISSE PRINCIPALE',
        type: 'CASHIER_TRANSFER'
      };
      
      localStorage.setItem('microfox_agent_payments', JSON.stringify([transferPayment, ...allPayments]));
    }
    
    const newCashBalance = cashBalance - theoreticalAmount;
    localStorage.setItem(`microfox_cash_balance_${selectedCaisse}`, newCashBalance.toString());
    
    // Enregistrer l'écart si présent
    if (gap !== 0) {
      const savedGaps = localStorage.getItem('microfox_all_gaps');
      const allGaps = savedGaps ? JSON.parse(savedGaps) : [];
      
      const savedUsersList = localStorage.getItem('microfox_users');
      const allUsersList = savedUsersList ? JSON.parse(savedUsersList) : [];
      const cashier = allUsersList.find((u: any) => u.caisse === selectedCaisse);
      const responsibleUserId = cashier?.id || JSON.parse(localStorage.getItem('microfox_current_user') || '{}').id;

      const newGapEntry = {
        id: `gap_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
        date: new Date().toISOString(),
        opDate: new Date().toISOString(), // Transfer date is now
        type: 'CAISSIER',
        sourceId: selectedCaisse,
        sourceName: selectedCaisse,
        sourceCode: selectedCaisse,
        declaredAmount: theoreticalAmount,
        observedAmount: physicalAmount,
        gapAmount: gap,
        status: 'En attente',
        zone: 'SIÈGE',
        caisse: selectedCaisse,
        observation: `Écart de versement (${selectedCaisse})`,
        userId: responsibleUserId,
        validatorId: JSON.parse(localStorage.getItem('microfox_current_user') || '{}').id
      };
      localStorage.setItem('microfox_all_gaps', JSON.stringify([newGapEntry, ...allGaps]));
    }

    // Enregistrer la transaction
    const newTxs = [];
    if (isMainCaisse) {
      const newTx = {
        id: `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        type: 'Versement Caisse',
        from: selectedCaisse,
        to: targetDestination,
        amount: physicalAmount,
        theoreticalAmount: theoreticalAmount,
        gap: gap,
        date: new Date().toISOString(),
        userId: currentUser.id,
        cashierName: currentUser.identifiant
      };
      newTxs.push(newTx);

      if (transferType === 'total' && gap !== 0) {
        const gapTx = {
          id: `${Date.now() + 1}_${Math.random().toString(36).substr(2, 9)}`,
          type: 'Régularisation Écart',
          from: selectedCaisse,
          to: 'ÉCART',
          amount: -gap,
          date: new Date().toISOString(),
          userId: currentUser.id,
          cashierName: currentUser.identifiant,
          observation: `Régularisation automatique lors du versement total (${selectedCaisse})`
        };
        newTxs.push(gapTx);
      }
    }

    if (newTxs.length > 0) {
      const transactionsSaved = localStorage.getItem('microfox_vault_transactions');
      const transactions = transactionsSaved ? JSON.parse(transactionsSaved) : [];
      localStorage.setItem('microfox_vault_transactions', JSON.stringify([...newTxs, ...transactions]));
    }
    localStorage.setItem('microfox_pending_sync', 'true');

    setCashBalance(newCashBalance);
    setIsTransferModalOpen(false);
    setDenominations({
      '10000': 0, '5000': 0, '2000': 0, '1000': 0, '500': 0,
      '250': 0, '200': 0, '100': 0, '50': 0, '25': 0, '10': 0, '5': 0,
      'monnaie': 0
    });
    dispatchStorageEvent();
    showAlert("Succès", `Versement de ${physicalAmount.toLocaleString()} F effectué. Écart: ${gap.toLocaleString()} F.`, "success");
  };

    const filteredPayments = payments.filter(p => {
    if (currentUser.role === 'caissier' && p.type === 'CASHIER_TRANSFER') {
      return false;
    }
    const matchesSearch = (p.agentName || '').toLowerCase().includes(searchTerm.toLowerCase());
    const matchesFilter = filterStatus === 'Tous' || p.status === filterStatus;
    
    const itemCaisse = (p.caisse || 'CAISSE PRINCIPALE').trim();
    const matchesCaisse = 
      paymentCaisseFilter.trim().toLowerCase() === 'tous' ||
      (itemCaisse.toLowerCase() === paymentCaisseFilter.trim().toLowerCase()) || 
      (p.type === 'CASHIER_TRANSFER' && p.agentName?.trim().toLowerCase() === paymentCaisseFilter.trim().toLowerCase());
    
    const txDate = p.date ? p.date.split('T')[0].split(' ')[0] : '';
    const matchesDate = (!startDate || txDate >= startDate) && (!endDate || txDate <= endDate);
    
    return matchesSearch && matchesFilter && matchesCaisse && matchesDate;
  }).sort((a, b) => {
    if (a.status === 'En attente' && b.status !== 'En attente') return -1;
    if (a.status !== 'En attente' && b.status === 'En attente') return 1;
    return new Date(b.date).getTime() - new Date(a.date).getTime();
  });

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-20">
      {statusMessage && (
        <div className={`p-4 rounded-2xl font-black uppercase tracking-widest text-sm shadow-lg animate-in fade-in slide-in-from-top-4 duration-300 ${
          statusMessage.type === 'success' ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white'
        }`}>
          {statusMessage.text}
        </div>
      )}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-start gap-4">
          <div className="p-3 bg-blue-100 text-blue-600 rounded-2xl">
            <Landmark size={32} />
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-black text-[#121c32] uppercase tracking-tight">Gestion des Caisses</h1>
            <div className="relative">
              <select 
                value={selectedCaisse}
                onChange={(e) => {
                  const val = e.target.value;
                  setSelectedCaisse(val);
                  setPaymentCaisseFilter(val);
                }}
                disabled={JSON.parse(localStorage.getItem('microfox_current_user') || '{}').role === 'caissier'}
                className="appearance-none bg-gray-50 border border-gray-200 text-[#121c32] text-sm font-black rounded-xl px-4 py-2 pr-10 outline-none focus:border-blue-400 transition-all uppercase tracking-tight disabled:opacity-70"
              >
                {caisses.map(c => {
                  const bal = calculateTheoreticalBalanceForCaisse(c);
                  return <option key={c} value={c}>{c} ({bal.toLocaleString()} F)</option>;
                })}
              </select>
              <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">
                <Filter size={14} />
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {(selectedCaisse !== 'CAISSE PRINCIPALE' || isAdminOrDirector) && (
            <button 
              onClick={() => {
                setTransferType('total');
                setIsTransferModalOpen(true);
              }}
              className="flex items-center gap-2 px-6 py-4 bg-amber-600 text-white rounded-2xl font-black uppercase tracking-tight shadow-lg hover:bg-amber-700 transition-all active:scale-95"
            >
              <ShieldCheck size={20} />
              {isAdminOrDirector ? 'Versement au Coffre' : 'Versement au Caisse principale'}
            </button>
          )}
          
          <div className="bg-[#121c32] p-6 rounded-[2rem] text-white flex items-center gap-6 shadow-xl">
            <div>
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Solde Actuel Caisse</p>
              <p className="text-3xl font-black">{cashBalance.toLocaleString()} F</p>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
              <TrendingUp size={24} />
            </div>
          </div>
        </div>
      </div>

      {/* Modal de Transfert */}
      {isTransferModalOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-[2.5rem] w-full max-w-md max-h-[90vh] overflow-y-auto p-8 shadow-2xl animate-in zoom-in-95 duration-200 custom-scrollbar">
            <div className="flex items-center gap-3 mb-6 sticky top-0 bg-white pb-4 z-10">
              <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-600 flex items-center justify-center">
                <Send size={24} />
              </div>
              <div>
                <h2 className="text-xl font-black text-[#121c32] uppercase tracking-tight">
                  {isAdminOrDirector ? 'Versement au Coffre' : 'Versement au Caisse principale'}
                </h2>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Fin de journée</p>
              </div>
            </div>

            <div className="space-y-6">
              <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100 space-y-4">
                <div className="flex justify-between items-center">
                  <div>
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Solde Théorique (Système)</p>
                    <p className="text-xl font-black text-[#121c32]">{cashBalance.toLocaleString()} F</p>
                  </div>
                </div>

                <div className="flex gap-2 p-1 bg-gray-200/50 rounded-xl">
                  <button 
                    onClick={() => {
                      setTransferType('total');
                    }}
                    className={`flex-1 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${transferType === 'total' ? 'bg-white text-amber-600 shadow-sm' : 'text-gray-400'}`}
                  >
                    Total
                  </button>
                  <button 
                    onClick={() => setTransferType('partial')}
                    className={`flex-1 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${transferType === 'partial' ? 'bg-white text-amber-600 shadow-sm' : 'text-gray-400'}`}
                  >
                    Partiel
                  </button>
                </div>

                <div className="pt-4 border-t border-gray-200">
                  <label className="text-[10px] font-black text-gray-600 uppercase tracking-widest ml-1">Montant à verser</label>
                  <div className="relative mt-1">
                    <input 
                      type="number" 
                      value={calculateTotalBilletage()}
                      readOnly
                      className="w-full p-4 bg-gray-50 border border-gray-200 rounded-2xl text-xl font-black text-[#121c32] outline-none transition-all opacity-70 cursor-not-allowed"
                      placeholder="0"
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 font-black text-gray-400">F</span>
                  </div>
                  <div className="flex justify-between items-center mt-2 px-1">
                    <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">
                      {transferType === 'total' ? 'Écart de clôture' : 'Reste en caisse'}
                    </p>
                    <p className={`text-xs font-black ${transferType === 'total' && calculateTotalBilletage() - cashBalance < 0 ? 'text-red-600' : 'text-amber-600'}`}>
                      {transferType === 'total' 
                        ? (calculateTotalBilletage() - cashBalance).toLocaleString() + ' F'
                        : (cashBalance - calculateTotalBilletage()).toLocaleString() + ' F'}
                    </p>
                  </div>
                  {transferType === 'total' && (
                    <p className="text-[10px] text-gray-400 font-bold mt-1 italic">* Versement de la totalité du solde pour clôture</p>
                  )}
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Détails du Billetage (Physique)</h3>
                <div className="bg-gray-50 rounded-2xl p-4 space-y-3 border border-gray-100">
                  <div className="grid grid-cols-3 gap-4 text-[9px] font-black text-gray-400 uppercase tracking-widest mb-2 px-2">
                    <span>Billet/Pièce</span>
                    <span className="text-center">Nombre</span>
                    <span className="text-right">Montant</span>
                  </div>
                  {[10000, 5000, 2000, 1000, 500, 250, 200, 100, 50, 25, 10, 5].map(val => (
                    <div key={val} className="grid grid-cols-3 gap-4 items-center">
                      <span className="text-xs font-black text-[#121c32] px-2">{val.toLocaleString()}</span>
                      <input 
                        type="number" 
                        min="0"
                        value={denominations[val.toString()] || ''}
                        onChange={(e) => setDenominations({...denominations, [val.toString()]: e.target.value})}
                        className="w-full p-2 bg-white border border-gray-300 rounded-xl text-center text-xs font-black text-[#121c32] outline-none focus:border-amber-500 transition-all"
                        placeholder="0"
                      />
                      <span className="text-xs font-bold text-gray-400 text-right px-2">
                        {((denominations[val.toString()] || 0) * val).toLocaleString()}
                      </span>
                    </div>
                  ))}
                  <div className="grid grid-cols-3 gap-4 items-center pt-2 border-t border-gray-200">
                    <span className="text-xs font-black text-[#121c32] px-2 uppercase">Monnaie</span>
                    <div className="col-span-2 relative">
                      <input 
                        type="number" 
                        min="0"
                        value={denominations.monnaie || ''}
                        onChange={(e) => setDenominations({...denominations, monnaie: e.target.value})}
                        className="w-full p-2 bg-white border border-gray-300 rounded-xl text-right pr-8 text-xs font-black text-[#121c32] outline-none focus:border-amber-500 transition-all"
                        placeholder="0"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-black text-gray-300">F</span>
                    </div>
                  </div>
                  <div className="pt-3 border-t border-gray-200 flex justify-between items-center px-2">
                    <span className="text-[10px] font-black text-indigo-600 uppercase tracking-widest">Total Billetage</span>
                    <span className="text-lg font-black text-indigo-600">{calculateTotalBilletage().toLocaleString()} F</span>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-600 uppercase tracking-widest ml-1">Montant de la transaction</label>
                <div className="p-4 bg-gray-50 border border-gray-100 rounded-2xl text-center">
                  <span className="text-2xl font-black text-[#121c32]">{calculateTotalBilletage().toLocaleString()}</span>
                  <span className="ml-2 font-black text-gray-400">F</span>
                </div>
              </div>

              <div className="p-4 bg-amber-50 rounded-2xl border border-amber-100 flex justify-between items-center">
                <div>
                  <p className="text-[10px] font-black text-amber-600 uppercase tracking-widest mb-1">Écart Constaté</p>
                  <p className={`text-xl font-black ${calculateTotalBilletage() - cashBalance < 0 ? 'text-red-600' : calculateTotalBilletage() - cashBalance > 0 ? 'text-emerald-600' : 'text-amber-600'}`}>
                    {calculateTotalBilletage() - cashBalance > 0 ? '+' : ''}{(calculateTotalBilletage() - cashBalance).toLocaleString()} F
                  </p>
                </div>
                {calculateTotalBilletage() - cashBalance !== 0 && (
                  <div className="px-3 py-1 bg-white/50 rounded-lg text-[9px] font-black uppercase tracking-widest text-amber-700">
                    {calculateTotalBilletage() - cashBalance < 0 ? 'Déficit' : 'Surplus'}
                  </div>
                )}
              </div>

              <div className="flex gap-3 pt-4">
                <button 
                  onClick={() => setIsTransferModalOpen(false)}
                  className="flex-1 py-4 rounded-2xl font-black uppercase tracking-widest text-xs text-gray-500 hover:bg-gray-50 transition-all"
                >
                  Annuler
                </button>
                <button 
                  onClick={handleTransferToVault}
                  className="flex-1 py-4 bg-amber-600 text-white rounded-2xl font-black uppercase tracking-widest text-xs shadow-lg shadow-amber-200 hover:bg-amber-700 transition-all active:scale-95"
                >
                  Confirmer le Versement
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="flex bg-white p-2 rounded-2xl border border-gray-100 shadow-sm gap-2">
        <button 
          onClick={() => setActivePage('versements')}
          className={`px-6 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${
            activePage === 'versements' 
              ? 'bg-blue-600 text-white shadow-md' 
              : 'text-gray-500 hover:text-[#121c32]'
          }`}
        >
          Versements Agents
        </button>
        <button 
          onClick={() => setActivePage('details')}
          className={`px-6 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${
            activePage === 'details' 
              ? 'bg-blue-600 text-white shadow-md' 
              : 'text-gray-500 hover:text-[#121c32]'
          }`}
        >
          Justificatif du Solde Caisse
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-gray-100 space-y-4">
            <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest">Filtres</h3>
            
            {activePage === 'versements' && (
              <>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                  <input 
                    type="text" 
                    placeholder="Rechercher Agent..." 
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-xs font-bold outline-none focus:border-blue-400 transition-all"
                  />
                </div>

                <div className="space-y-2">
                  {['Tous', 'En attente', 'Validé', 'Rejeté'].map((status) => (
                    <button
                      key={status}
                      onClick={() => setFilterStatus(status)}
                      className={`w-full text-left px-4 py-3 rounded-xl text-xs font-black uppercase tracking-tight transition-all ${
                        filterStatus === status 
                          ? 'bg-blue-600 text-white shadow-md' 
                          : 'bg-gray-50 text-gray-500 hover:bg-gray-100'
                      }`}
                    >
                      {status}
                    </button>
                  ))}
                </div>
              </>
            )}

            <div className="space-y-2 pt-2">
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Filtrer par Caisse</p>
              <select
                value={paymentCaisseFilter}
                onChange={(e) => {
                  const val = e.target.value;
                  setPaymentCaisseFilter(val);
                  if (val !== 'Tous') {
                    setSelectedCaisse(val);
                  }
                }}
                className="w-full px-3 py-2 bg-gray-50 border border-gray-100 rounded-xl text-xs font-bold text-[#121c32] outline-none focus:border-blue-400 transition-all uppercase tracking-tight"
              >
                <option value="Tous">Toutes les caisses</option>
                {['CAISSE PRINCIPALE', 'CAISSE 1', 'CAISSE 2', 'CAISSE 3', 'CAISSE 4'].map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            <div className="space-y-2 pt-2">
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Intervalle de Date</p>
              <div className="grid grid-cols-1 gap-2">
                <input 
                  type="date" 
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-100 rounded-xl text-[10px] font-bold text-[#121c32] outline-none focus:border-blue-400 transition-all"
                />
                <input 
                  type="date" 
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-100 rounded-xl text-[10px] font-bold text-[#121c32] outline-none focus:border-blue-400 transition-all"
                />
              </div>
              {(startDate || endDate) && (
                <button 
                  onClick={() => { setStartDate(''); setEndDate(''); }}
                  className="w-full py-2 text-[9px] font-black text-blue-600 uppercase tracking-widest hover:underline"
                >
                  Réinitialiser Dates
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="lg:col-span-3">
          {activePage === 'versements' ? (
            <div className="bg-white rounded-[2.5rem] shadow-sm border border-gray-100 overflow-hidden">
              <div className="overflow-x-auto custom-scrollbar">
                <table className="w-full min-w-[1000px] text-left">
                  <thead>
                    <tr className="bg-gray-50/50 border-b border-gray-100">
                      <th className="px-6 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest cursor-pointer">Agent / Date</th>
                      <th className="px-6 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest text-right">Cotisations</th>
                      <th className="px-6 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest text-right">Livrets</th>
                      <th className="px-6 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest text-right">Écart</th>
                      <th className="px-6 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest text-right">Total</th>
                      <th className="px-6 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest text-center">Solde Observé</th>
                      <th className="px-6 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest text-center">Statut</th>
                      <th className="px-6 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {filteredPayments.length > 0 ? (
                      filteredPayments.map((p, idx) => (
                        <tr 
                          key={`${p.id}_${idx}`} 
                          className="hover:bg-gray-50/50 transition-colors cursor-pointer"
                          onClick={() => setExpandedPaymentId(expandedPaymentId === p.id ? null : p.id)}
                        >
                          <td className="px-6 py-5">
                            <p className="text-xs font-black text-[#121c32] uppercase">
                              {p.agentName} {p.zone ? `(ZONE ${p.zone})` : ''} - VERSEMENT
                              {p.cashierName && <span className="block text-[9px] text-gray-400 lowercase italic">par {p.cashierName}</span>}
                            </p>
                            <p className="text-[10px] font-bold text-gray-400 mb-2">{new Date(p.date).toLocaleString()}</p>
                            {p.billetage && (p.status === 'En attente' || expandedPaymentId === p.id) && (
                              <div className="mt-2 p-3 bg-gray-50 rounded-2xl border border-gray-100">
                                <div className="mb-2 border-b border-gray-200 pb-2">
                                  <p className="text-[9px] font-black text-blue-600 uppercase tracking-widest">Détails du Versement</p>
                                  <p className="text-[10px] font-bold text-[#121c32] mt-1">Agent: {p.agentName}</p>
                                  <p className="text-[10px] font-bold text-[#121c32]">Date: {new Date(p.date).toLocaleString()}</p>
                                </div>
                                <p className="text-[9px] font-black text-gray-400 uppercase mb-2 tracking-widest">Billetage Agent</p>
                                <div className="space-y-1.5">
                                  {[10000, 5000, 2000, 1000, 500, 250, 200, 100, 50, 25, 10, 5].map(val => p.billetage[val] > 0 && (
                                    <div key={val} className="flex justify-between items-center text-[10px] whitespace-nowrap">
                                      <span className="text-gray-400 font-bold">{val.toLocaleString()} :</span>
                                      <span className="font-black text-[#121c32] ml-2">x{p.billetage[val]}</span>
                                    </div>
                                  ))}
                                  {p.billetage.monnaie > 0 && (
                                    <div className="flex justify-between items-center text-[10px] whitespace-nowrap border-t border-gray-200 mt-2 pt-2">
                                      <span className="text-gray-400 font-bold uppercase">Monnaie :</span>
                                      <span className="font-black text-[#121c32] ml-2">{Number(p.billetage.monnaie).toLocaleString()} F</span>
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}
                          </td>
                          <td className="px-6 py-5 text-right text-xs font-bold text-indigo-600">{p.amountCotisations.toLocaleString()} F</td>
                          <td className="px-6 py-5 text-right text-xs font-bold text-amber-600">{p.amountLivrets.toLocaleString()} F</td>
                          <td className="px-6 py-5 text-right">
                            <span className={`text-xs font-bold ${(p.totalAmount - (p.amountCotisations + p.amountLivrets)) < 0 ? 'text-red-600' : (p.totalAmount - (p.amountCotisations + p.amountLivrets)) > 0 ? 'text-emerald-600' : 'text-gray-300'}`}>
                              {(p.totalAmount - (p.amountCotisations + p.amountLivrets)) > 0 ? '+' : ''}{(p.totalAmount - (p.amountCotisations + p.amountLivrets)).toLocaleString()} F
                            </span>
                          </td>
                          <td className="px-6 py-5 text-right text-sm font-black text-[#121c32]">{p.totalAmount.toLocaleString()} F</td>
                          <td className="px-6 py-5">
                            {p.status === 'En attente' ? (
                              <div className="flex flex-col gap-1">
                                <input 
                                  type="number" 
                                  placeholder="Observé"
                                  value={observedAmounts[p.id] || ''}
                                  onChange={(e) => {
                                    setObservedAmounts({...observedAmounts, [p.id]: e.target.value});
                                    if (validationErrors[p.id]) {
                                      const newErrors = {...validationErrors};
                                      delete newErrors[p.id];
                                      setValidationErrors(newErrors);
                                    }
                                  }}
                                  className={`w-24 p-2 bg-white border ${validationErrors[p.id] ? 'border-red-500 animate-pulse' : 'border-gray-300'} rounded-xl text-xs font-black text-[#121c32] outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400 transition-all`}
                                />
                                {validationErrors[p.id] && (
                                  <p className="text-[8px] font-black text-red-500 uppercase leading-tight max-w-[100px] mt-0.5">
                                    {validationErrors[p.id]}
                                  </p>
                                )}
                                <input 
                                  type="text" 
                                  placeholder="Obs..."
                                  value={gapObservations[p.id] || ''}
                                  onChange={(e) => setGapObservations({...gapObservations, [p.id]: e.target.value})}
                                  className="w-24 p-1 bg-white border border-gray-300 rounded-lg text-[9px] font-bold text-[#121c32] outline-none focus:border-blue-400 transition-all"
                                />
                              </div>
                            ) : (
                              <div className="text-center">
                                <p className="text-xs font-black text-[#121c32]">{p.observedAmount?.toLocaleString() || p.totalAmount.toLocaleString()} F</p>
                                {p.gap !== undefined && p.gap !== 0 && (
                                  <span className={`text-[9px] font-black uppercase ${p.gap < 0 ? 'text-red-500' : 'text-emerald-500'}`}>
                                    Écart: {p.gap > 0 ? '+' : ''}{p.gap.toLocaleString()} F
                                  </span>
                                )}
                              </div>
                            )}
                          </td>
                          <td className="px-6 py-5 text-center">
                            <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${
                              p.status === 'Validé' ? 'bg-emerald-100 text-emerald-600' : 
                              p.status === 'Rejeté' ? 'bg-red-100 text-red-600' : 
                              'bg-amber-100 text-amber-600'
                            }`}>
                              {p.status}
                            </span>
                          </td>
                          <td className="px-6 py-5 text-right">
                            {p.status === 'En attente' && (
                              p.type === 'CASHIER_TRANSFER'
                                ? ['administrateur', 'directeur'].includes(JSON.parse(localStorage.getItem('microfox_current_user') || '{}').role)
                                : ['administrateur', 'directeur', 'caissier'].includes(JSON.parse(localStorage.getItem('microfox_current_user') || '{}').role)
                            ) && (
                              <div className="flex items-center justify-end gap-2">
                                <button
                                  onClick={() => handleAction(p.id, 'Validé')}
                                  className="p-2 bg-emerald-50 text-emerald-600 rounded-lg hover:bg-emerald-600 hover:text-white transition-all shadow-sm"
                                  title="Valider le versement"
                                >
                                  <CheckCircle size={18} />
                                </button>
                                <button
                                  onClick={() => handleAction(p.id, 'Rejeté')}
                                  className="p-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-600 hover:text-white transition-all shadow-sm"
                                  title="Rejeter le versement"
                                >
                                  <XCircle size={18} />
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={8} className="px-6 py-20 text-center">
                          <div className="flex flex-col items-center gap-2 opacity-20">
                            <ArrowDownCircle size={48} />
                            <p className="text-xs font-black uppercase tracking-widest">Aucun versement à traiter</p>
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-[2.5rem] shadow-sm border border-gray-100 overflow-hidden">
              <div className="overflow-x-auto custom-scrollbar">
                <table className="w-full min-w-[1000px] text-left">
                  <thead>
                    <tr className="bg-gray-50/50 border-b border-gray-100">
                      <th className="px-6 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">Date / Heure</th>
                      <th className="px-6 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">Type d'opération</th>
                      <th className="px-6 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">Description / Tiers</th>
                      <th className="px-6 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest text-right">Débit / Sortie</th>
                      <th className="px-6 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest text-right">Crédit / Entrée</th>
                      <th className="px-6 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest text-right">Solde Progressif</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {(() => {
                      const detailsList = getCaisseTransactionsDetails().filter(item => {
                        const itemDateStr = item.date ? item.date.split('T')[0] : '';
                        const matchesStartDate = !startDate || itemDateStr >= startDate;
                        const matchesEndDate = !endDate || itemDateStr <= endDate;
                        return matchesStartDate && matchesEndDate;
                      });

                      return detailsList.length > 0 ? (
                        detailsList.map((item) => (
                          <tr key={item.id} className="hover:bg-gray-50/50 transition-colors">
                            <td className="px-6 py-5 text-xs font-bold text-gray-500 whitespace-nowrap">
                              {new Date(item.date).toLocaleString()}
                            </td>
                            <td className="px-6 py-5">
                              <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest whitespace-nowrap ${
                                item.category === 'credit' 
                                  ? 'bg-emerald-100 text-emerald-600' 
                                  : 'bg-rose-100 text-rose-600'
                              }`}>
                                {item.type}
                              </span>
                            </td>
                            <td className="px-6 py-5 text-xs font-bold text-[#121c32]">
                              {item.description}
                            </td>
                            <td className="px-6 py-5 text-right text-xs font-bold text-rose-600 whitespace-nowrap">
                              {item.category === 'debit' ? `-${item.amount.toLocaleString()} F` : '-'}
                            </td>
                            <td className="px-6 py-5 text-right text-xs font-bold text-emerald-600 whitespace-nowrap">
                              {item.category === 'credit' ? `+${item.amount.toLocaleString()} F` : '-'}
                            </td>
                            <td className="px-6 py-5 text-right text-xs font-black text-[#121c32] whitespace-nowrap">
                              {item.runningBalance.toLocaleString()} F
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={6} className="px-6 py-20 text-center">
                            <div className="flex flex-col items-center gap-2 opacity-20">
                              <ArrowDownCircle size={48} />
                              <p className="text-xs font-black uppercase tracking-widest">Aucune transaction trouvée</p>
                            </div>
                          </td>
                        </tr>
                      );
                    })()}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>

      <ConfirmModal
        isOpen={confirmModal.isOpen}
        title={confirmModal.title}
        message={confirmModal.message}
        onConfirm={confirmModal.onConfirm}
        onCancel={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
        type={confirmModal.type}
      />
    </div>
  );
};

export default MainCashier;
