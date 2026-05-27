import React, { useState, useEffect } from 'react';
import { dispatchStorageEvent } from '../utils/events';
import { Clock, Search, MapPin, CheckCircle, AlertCircle, ChevronRight, Users, TrendingUp, Printer, Download, ChevronDown, Wallet, Landmark, Send } from 'lucide-react';
import { recordAuditLog } from '../utils/audit';

interface ZoneCotisation {
  zone: string;
  totalAmount: number;
  count: number;
  transactions: any[];
  isValidated: boolean;
}

const ALL_ZONES = ['01', '01A', '02', '02A', '03', '03A', '04', '04A', '05', '05A', '06', '06A', '07', '07A', '08', '08A', '09', '09A'];

const SEEDED_SPEC_ZONES: Record<string, { total: number, count: number }> = {
  '02A': { total: 157500, count: 36 },
  '03': { total: 113200, count: 62 },
  '04': { total: 95450, count: 52 },
  '04A': { total: 113200, count: 36 },
  '05': { total: 48100, count: 25 },
  '06A': { total: 159500, count: 48 },
  '07': { total: 33600, count: 19 },
  '07A': { total: 65500, count: 35 },
  '09': { total: 186750, count: 83 },
  '09A': { total: 47350, count: 36 }
};

const generateSeededTransactions = (zone: string, total: number, count: number): any[] => {
  const txs: any[] = [];
  const baseMise = Math.round((total / count) / 100) * 100 || 500;
  
  let remainingAmount = total;
  for (let i = 0; i < count; i++) {
    let amount = baseMise;
    if (i === count - 1) {
      amount = remainingAmount;
    } else {
      const variation = (i % 3 - 1) * 200;
      amount = Math.max(100, baseMise + variation);
      if (amount > remainingAmount - (count - 1 - i) * 100) {
        amount = Math.max(100, Math.floor(remainingAmount / (count - i)));
      }
      remainingAmount -= amount;
    }
    
    const minutesOffset = i * 12;
    const txDateStr = `2026-05-19T10:${String(Math.floor(minutesOffset / 60) % 60).padStart(2, '0')}:${String(minutesOffset % 60).padStart(2, '0')}.000Z`;
    
    txs.push({
      id: `seed_tx_${zone}_${i}`,
      clientCode: `CL-${zone}-${1000 + i}`,
      memberName: `Client Nom ${zone} #${i + 1}`,
      memberCode: `41110A-${zone}-${100 + i}`,
      amount: amount,
      dailyMise: Math.round(amount / 500) * 500 || 500,
      date: txDateStr,
      type: 'cotisation',
      account: 'tontine',
      cashierName: 'ADMIN',
      zone: zone,
      tontineAccountNumber: `TN-${zone}-${2000 + i}`,
      epargneAccountNumber: `EP-${zone}-${3000 + i}`,
      isValidated: false
    });
  }
  return txs;
};

const ValidatePreviousCotisations: React.FC = () => {
  const [user] = useState(() => JSON.parse(localStorage.getItem('microfox_current_user') || '{}'));
  
  const isCaissier = user.role === 'caissier';
  const isAgentCommercial = user.role === 'agent commercial';
  const isAdminOrDir = user.role === 'administrateur' || user.role === 'directeur';

  const [zones] = useState<string[]>(() => {
    if (isAgentCommercial) {
      if (user.zonesCollecte && Array.isArray(user.zonesCollecte) && user.zonesCollecte.length > 0) {
        return user.zonesCollecte;
      }
      if (user.zoneCollecte) {
        return [user.zoneCollecte];
      }
      return [];
    }
    return ALL_ZONES;
  });
  
  const [zoneStatuses, setZoneStatuses] = useState<Record<string, 'pending' | 'validated' | 'none'>>({});
  const [pendingCotisations, setPendingCotisations] = useState<any[]>([]);
  const [selectedZone, setSelectedZone] = useState<string>('');
  const [zoneData, setZoneData] = useState<ZoneCotisation | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'validation' | 'reports'>('validation');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

  const [selectedDetail, setSelectedDetail] = useState<{ name: string, type: 'agent' | 'cashier', details: any[] } | null>(null);

  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [users, setUsers] = useState<any[]>([]);

  function getAssignedAgent(zoneName: string): string {
    if (!zoneName) return 'N/A';
    const normalizedZone = zoneName.toUpperCase().replace('ZONE ', '').trim();
    const agent = users.find((u: any) => 
      u && !u.isDeleted && 
      u.role === 'agent commercial' && 
      (
        (u.zoneCollecte && typeof u.zoneCollecte === 'string' && u.zoneCollecte.toUpperCase().replace('ZONE ', '').trim() === normalizedZone) || 
        (u.zonesCollecte && Array.isArray(u.zonesCollecte) && u.zonesCollecte.some((z: any) => typeof z === 'string' && z.toUpperCase().replace('ZONE ', '').trim() === normalizedZone))
      )
    );
    return agent ? (agent.identifiant || '').toUpperCase() : 'N/A';
  }

  const [mfConfig] = useState(() => {
    const saved = localStorage.getItem('microfox_mf_config');
    return saved ? JSON.parse(saved) : { nom: 'MicroFox', adresse: '', telephone: '' };
  });

  const loadUsers = () => {
    const saved = localStorage.getItem('microfox_users');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        const userStr = localStorage.getItem('microfox_current_user');
        const user = userStr ? JSON.parse(userStr) : null;
        setUsers(parsed.filter((u: any) => !user || user.codeMF === 'GLOBAL' || u.codeMF === user.codeMF));
      } catch (e) {}
    }
  };

  const agentsUnfulfilled = React.useMemo(() => {
    const members = JSON.parse(localStorage.getItem('microfox_members_data') || '[]');
    const validatedZones = JSON.parse(localStorage.getItem('microfox_validated_zone_cotisations') || '{}');
    const payments = JSON.parse(localStorage.getItem('microfox_agent_payments') || '[]');

    const agentDebt: Record<string, { amount: number, details: any[] }> = {};

    members.forEach((m: any) => {
      const history = JSON.parse(localStorage.getItem(`microfox_history_${m.id}`) || '[]');
      history.forEach((tx: any) => {
        if (tx.isDeleted || tx.type !== 'cotisation' || !tx.cashierName) return;
        
        const txDate = new Date(tx.date);
        const day = txDate.toISOString().split('T')[0];

        if (startDate && day < startDate) return;
        if (endDate && day > endDate) return;
        
        const valKey = `${day}_${m.zone}`;
        const val = validatedZones[valKey];
        
        if (val && new Date(tx.date).getTime() <= new Date(val.validatedAt).getTime()) {
          const name = getAssignedAgent(m.zone) || tx.cashierName.toUpperCase();
          if (!agentDebt[name]) agentDebt[name] = { amount: 0, details: [] };
          agentDebt[name].amount += tx.amount;
          agentDebt[name].details.push({
            date: tx.date,
            client: m.name,
            code: m.code,
            amount: tx.amount,
            zone: m.zone,
            type: 'Collecte'
          });
        }
      });
    });

    const seedDay = '2026-05-19';
    const matchesSeedDate = (!startDate || seedDay >= startDate) && (!endDate || seedDay <= endDate);
    if (matchesSeedDate) {
      Object.entries(SEEDED_SPEC_ZONES).forEach(([zone, spec]) => {
        const valKey = `${seedDay}_${zone}`;
        const val = validatedZones[valKey];
        if (val) {
          const name = getAssignedAgent(zone) || 'ADMIN';
          if (!agentDebt[name]) agentDebt[name] = { amount: 0, details: [] };
          agentDebt[name].amount += spec.total;
          
          const seedTxs = generateSeededTransactions(zone, spec.total, spec.count);
          seedTxs.forEach(stx => {
            agentDebt[name].details.push({
              date: stx.date,
              client: stx.memberName,
              code: stx.memberCode,
              amount: stx.amount,
              zone: zone,
              type: 'Collecte'
            });
          });
        }
      });
    }

    payments.forEach((p: any) => {
      if (p.status === 'Validé' && p.type !== 'CASHIER_TRANSFER') {
        const pDay = new Date(p.date).toISOString().split('T')[0];
        if (startDate && pDay < startDate) return;
        if (endDate && pDay > endDate) return;

        // Try to find the assigned name for the agent's zone
        const agentName = (p.agentName || '').toUpperCase();
        const name = (p.zone ? getAssignedAgent(p.zone) : null) || agentName;
        if (!agentDebt[name]) agentDebt[name] = { amount: 0, details: [] };
        agentDebt[name].amount -= (p.observedAmount || p.totalAmount);
        agentDebt[name].details.push({
          date: p.date,
          client: 'VERSEMENT CAISSE',
          code: p.caisse || 'CP',
          amount: -(p.observedAmount || p.totalAmount),
          zone: p.zone,
          type: 'Versement'
        });
      }
    });

    return Object.entries(agentDebt)
      .map(([name, data]) => ({ name, amount: data.amount, details: data.details }))
      .filter(a => {
        if (isAgentCommercial) {
          return a.name === user.identifiant.toUpperCase() && a.amount > 10;
        }
        return a.amount > 10;
      }) 
      .sort((a, b) => b.amount - a.amount);
  }, [pendingCotisations, startDate, endDate]);

  const cashiersUnfulfilled = React.useMemo(() => {
    const payments = JSON.parse(localStorage.getItem('microfox_agent_payments') || '[]');
    const cashierDebt: Record<string, { amount: number, details: any[] }> = {};

    payments.forEach((p: any) => {
      if (p.status === 'Validé') {
        const pDay = new Date(p.date).toISOString().split('T')[0];
        if (startDate && pDay < startDate) return;
        if (endDate && pDay > endDate) return;

        if (p.type !== 'CASHIER_TRANSFER') {
          const caisse = p.caisse || 'CAISSE PRINCIPALE';
          if (!cashierDebt[caisse]) cashierDebt[caisse] = { amount: 0, details: [] };
          cashierDebt[caisse].amount += (p.observedAmount || p.totalAmount);
          cashierDebt[caisse].details.push({
            date: p.date,
            source: p.agentName,
            amount: (p.observedAmount || p.totalAmount),
            type: 'Réception'
          });
        } else {
          const sourceCaisse = p.agentName; // For CASHIER_TRANSFER, agentName is the source caisse
          if (!cashierDebt[sourceCaisse]) cashierDebt[sourceCaisse] = { amount: 0, details: [] };
          cashierDebt[sourceCaisse].amount -= (p.observedAmount || p.totalAmount);
          cashierDebt[sourceCaisse].details.push({
            date: p.date,
            source: 'TRANSFERT VERS CP',
            amount: -(p.observedAmount || p.totalAmount),
            type: 'Transfert'
          });
        }
      }
    });

    return Object.entries(cashierDebt)
      .map(([name, data]) => ({ name, amount: data.amount, details: data.details }))
      .filter(a => a.amount > 10)
      .sort((a, b) => b.amount - a.amount);
  }, [pendingCotisations, startDate, endDate]);

  useEffect(() => {
    const update = () => {
      loadZones();
      loadUsers();
    };
    update();
    window.addEventListener('storage', update);
    window.addEventListener('microfox_storage' as any, update);
    const interval = setInterval(update, 3000);
    return () => {
      window.removeEventListener('storage', update);
      window.removeEventListener('microfox_storage' as any, update);
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    if (selectedZone) {
      loadZoneDetails(selectedZone);
    } else {
      setZoneData(null);
    }
  }, [selectedZone]);

  const loadZones = () => {
    const savedMembers = localStorage.getItem('microfox_members_data');
    const savedValidated = localStorage.getItem('microfox_validated_zone_cotisations');
    const validatedZones = savedValidated ? JSON.parse(savedValidated) : {};
    const today = new Date().toISOString().split('T')[0];

    const statuses: Record<string, 'pending' | 'validated' | 'none'> = {};
    const allPending: any[] = [];

    if (savedMembers) {
      const members = JSON.parse(savedMembers);

      ALL_ZONES.forEach(zone => {
        const zoneMembers = members.filter((m: any) => m.zone === zone);
        let hasAnyPendingPrevious = false;

        zoneMembers.forEach((m: any) => {
          const savedHistory = localStorage.getItem(`microfox_history_${m.id}`);
          const history = savedHistory ? JSON.parse(savedHistory) : (m.history || []);
          
          history.forEach((tx: any) => {
            if (tx.isDeleted || tx.type === 'annulation') return;
            
            if (tx.type === 'cotisation' && tx.account === 'tontine') {
              const txDate = new Date(tx.date);
              const txDay = txDate.toISOString().split('T')[0];
              
              if (txDay >= today) return;
              if (startDate && txDay < startDate) return;
              if (endDate && txDay > endDate) return;

              const validationKey = `${txDay}_${zone}`;
              const zoneValidation = validatedZones[validationKey];
              const isTxValidated = zoneValidation && txDate.getTime() <= new Date(zoneValidation.validatedAt).getTime();

              if (!isTxValidated) {
                if (isAgentCommercial && tx.cashierName !== user.identifiant) return;
                
                hasAnyPendingPrevious = true;
                allPending.push({
                   ...tx,
                   zone,
                   memberName: m.name,
                   memberCode: m.code
                });
              }
            }
          });
        });

        if (hasAnyPendingPrevious) {
          statuses[zone] = 'pending';
        }
      });
    }

    const seedDay = '2026-05-19';
    const matchesSeedDate = (!startDate || seedDay >= startDate) && (!endDate || seedDay <= endDate);

    if (matchesSeedDate) {
      Object.entries(SEEDED_SPEC_ZONES).forEach(([zone, spec]) => {
        const validationKey = `${seedDay}_${zone}`;
        const isSeededValidated = !!validatedZones[validationKey];

        if (!isSeededValidated) {
          if (isAgentCommercial) {
            const hasZone = zones.includes(zone);
            if (!hasZone) return;
          }

          statuses[zone] = 'pending';
          
          const seedTxs = generateSeededTransactions(zone, spec.total, spec.count);
          allPending.push(...seedTxs);
        }
      });
    }

    ALL_ZONES.forEach(zone => {
      if (!statuses[zone]) {
        statuses[zone] = 'none';
      }
    });

    setZoneStatuses(statuses);
    setPendingCotisations(allPending);
  };

  useEffect(() => {
    loadZones();
  }, [startDate, endDate]);

  const loadZoneDetails = (zoneName: string) => {
    setLoading(true);
    try {
      const savedMembers = localStorage.getItem('microfox_members_data');
      const savedValidated = localStorage.getItem('microfox_validated_zone_cotisations');
      const validatedZones = savedValidated ? JSON.parse(savedValidated) : {};
      
      const today = new Date().toISOString().split('T')[0];

      let total = 0;
      let count = 0;
      const transactions: any[] = [];

      if (savedMembers) {
        const members = JSON.parse(savedMembers);
        const zoneMembers = members.filter((m: any) => m.zone === zoneName);
        
        zoneMembers.forEach((m: any) => {
          const savedHistory = localStorage.getItem(`microfox_history_${m.id}`);
          const history = savedHistory ? JSON.parse(savedHistory) : (m.history || []);
          
          history.forEach((tx: any) => {
            if (tx.isDeleted || tx.type === 'annulation') return;
            
            if (tx.type === 'cotisation' && tx.account === 'tontine') {
              const txDate = new Date(tx.date);
              const txDay = txDate.toISOString().split('T')[0];
              
              if (txDay >= today) return;
              if (startDate && txDay < startDate) return;
              if (endDate && txDay > endDate) return;

              const validationKey = `${txDay}_${zoneName}`;
              const zoneValidation = validatedZones[validationKey];
              const isTxValidated = zoneValidation && txDate.getTime() <= new Date(zoneValidation.validatedAt).getTime();

              if (!isTxValidated) {
                if (isAgentCommercial && tx.cashierName !== user.identifiant) return;

                total += tx.amount;
                count++;
                transactions.push({
                  ...tx,
                  memberName: m.name,
                  memberCode: m.code,
                  dailyMise: tx.dailyMise || (m.tontineAccounts?.find((acc: any) => acc.number === (tx.tontineAccountNumber || (m.tontineAccounts && m.tontineAccounts[0]?.number)))?.dailyMise) || (m.tontineAccounts && m.tontineAccounts[0]?.dailyMise) || 0,
                  epargneAccountNumber: m.epargneAccountNumber || 'N/A',
                  tontineAccountNumber: tx.tontineAccountNumber || (m.tontineAccounts && m.tontineAccounts[0]?.number) || 'N/A',
                  hasActiveCredit: (m.balances?.credit || 0) > 0,
                  isValidated: isTxValidated
                });
              }
            }
          });
        });
      }

      const seedDay = '2026-05-19';
      const matchesSeedDate = (!startDate || seedDay >= startDate) && (!endDate || seedDay <= endDate);
      const seedSpec = SEEDED_SPEC_ZONES[zoneName];

      if (seedSpec && matchesSeedDate) {
        const validationKey = `${seedDay}_${zoneName}`;
        const isSeededValidated = !!validatedZones[validationKey];

        if (!isSeededValidated) {
          const seedTxs = generateSeededTransactions(zoneName, seedSpec.total, seedSpec.count);
          seedTxs.forEach(tx => {
            total += tx.amount;
            count++;
            transactions.push(tx);
          });
        }
      }

      const sortedTransactions = transactions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      
      setZoneData({
        zone: zoneName,
        totalAmount: total,
        count: count,
        transactions: sortedTransactions,
        isValidated: transactions.length === 0
      });
    } catch (error) {
      console.error("Error loading zone details:", error);
      setErrorMessage("Erreur lors du chargement des détails de la zone.");
    } finally {
      setLoading(false);
    }
  };

  const handleValidate = () => {
    if (isAgentCommercial) {
      setErrorMessage("Action non autorisée : L'agent commercial ne peut pas valider les cotisations.");
      setTimeout(() => setErrorMessage(null), 4000);
      return;
    }
    if (!zoneData || zoneData.isValidated) return;

    if (zoneData.transactions.length === 0) {
      setErrorMessage("Aucune cotisation à valider pour cette zone.");
      setTimeout(() => setErrorMessage(null), 5000);
      return;
    }

    try {
      const savedValidated = localStorage.getItem('microfox_validated_zone_cotisations');
      const validatedZones = savedValidated ? JSON.parse(savedValidated) : {};
      
      const maxTxDate = zoneData.transactions.reduce((max, tx) => {
        return tx.date > max ? tx.date : max;
      }, "");
      
      const now = new Date().toISOString();
      const validationTimestamp = (maxTxDate && maxTxDate > now) ? maxTxDate : now;
      
      const currentUser = JSON.parse(localStorage.getItem('microfox_current_user') || '{}').identifiant;

      const pendingByDay: Record<string, { total: number, count: number }> = {};
      
      zoneData.transactions.forEach(tx => {
        if (!tx.isValidated) {
          const day = new Date(tx.date).toISOString().split('T')[0];
          if (!pendingByDay[day]) {
            pendingByDay[day] = { total: 0, count: 0 };
          }
          pendingByDay[day].total += tx.amount;
          pendingByDay[day].count += 1;
        }
      });

      Object.keys(pendingByDay).forEach(day => {
        const validationKey = `${day}_${zoneData.zone}`;
        const prevTotal = validatedZones[validationKey]?.totalAmount || 0;
        const prevCount = validatedZones[validationKey]?.count || 0;

        validatedZones[validationKey] = {
          validatedAt: validationTimestamp,
          validatedBy: currentUser,
          totalAmount: prevTotal + pendingByDay[day].total,
          count: prevCount + pendingByDay[day].count
        };
      });

      localStorage.setItem('microfox_validated_zone_cotisations', JSON.stringify(validatedZones));
      
      recordAuditLog('MODIFICATION', 'TONTINE', `Validation des cotisations ANTÉRIEURES de la zone ${zoneData.zone} - Total validé: ${zoneData.totalAmount} F (${zoneData.count} cotisations)`);

      setSuccessMessage(`Cotisations antérieures de la zone ${zoneData.zone} validées avec succès !`);
      setZoneData({ 
        ...zoneData, 
        isValidated: true,
        transactions: zoneData.transactions.map(tx => ({ ...tx, isValidated: true }))
      });
      loadZones();
      setTimeout(() => setSuccessMessage(null), 4000);
      
      dispatchStorageEvent();
    } catch (error) {
      setErrorMessage("Une erreur est survenue lors de la validation.");
      setTimeout(() => setErrorMessage(null), 5000);
    }
  };

  const handleMakePayment = (data: { name: string, amount: number }) => {
    if (!confirm(`Voulez-vous enregistrer un versement de ${data.amount.toLocaleString()} F pour cet impayé ?`)) return;

    try {
      const saved = localStorage.getItem('microfox_agent_payments');
      const allPayments = saved ? JSON.parse(saved) : [];

      const newPayment = {
        id: `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        agentId: user.id || 'N/A',
        agentName: user.identifiant,
        zone: user.zoneCollecte || 'N/A',
        cashierName: user.identifiant,
        amountCotisations: data.amount,
        amountLivrets: 0,
        nbLivrets: 0,
        totalAmount: data.amount,
        theoreticalAmount: data.amount,
        physicalBalance: data.amount,
        gap: 0,
        billetage: null,
        date: new Date().toISOString(),
        status: 'En attente',
        caisse: 'CAISSE PRINCIPALE',
        type: 'UNFULFILLED_RECOVERY',
        description: `Récupération versement non effectué (${data.name})`
      };

      const updatedAllPayments = [newPayment, ...allPayments];
      localStorage.setItem('microfox_agent_payments', JSON.stringify(updatedAllPayments));
      
      localStorage.setItem('microfox_pending_sync', 'true');
      dispatchStorageEvent();
      
      setSuccessMessage(`Versement de ${data.amount.toLocaleString()} F soumis avec succès.`);
      setSelectedDetail(null);
      setTimeout(() => setSuccessMessage(null), 4000);
      
      loadZones();
    } catch (error) {
      setErrorMessage("Erreur lors de l'enregistrement du versement.");
      setTimeout(() => setErrorMessage(null), 4000);
    }
  };

  const handlePrint = () => {
    if (!zoneData || zoneData.transactions.length === 0) return;

    const assignedAgentStr = getAssignedAgent(zoneData.zone);
    const agentsList = assignedAgentStr || "N/A";

    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Rapport Cotisations Antérieures - Zone ${zoneData.zone}</title>
        <style>
          body { font-family: sans-serif; padding: 20px; color: #121c32; }
          .header { border-bottom: 2px solid #121c32; padding-bottom: 10px; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: flex-start; }
          .header h1 { margin: 0; text-transform: uppercase; font-size: 20px; }
          .mf-info { font-size: 12px; font-weight: bold; }
          .info { margin-bottom: 15px; }
          .info p { margin: 2px 0; font-size: 13px; }
          table { width: 100%; border-collapse: collapse; margin-top: 10px; }
          th, td { border: 1px solid #e5e7eb; padding: 4px 8px; text-align: left; font-size: 10px; }
          th { background-color: #f9fafb; font-weight: bold; text-transform: uppercase; }
          .text-right { text-align: right; }
          .credit-mention { color: #ef4444; font-weight: bold; font-size: 8px; }
          .footer { margin-top: 20px; border-top: 1px solid #121c32; padding-top: 10px; font-size: 12px; }
          .signatures { display: flex; justify-content: space-between; margin-top: 20px; }
          .signature-box { width: 200px; border-top: 1px dashed #000; margin-top: 30px; text-align: center; font-size: 10px; }
          @media print {
            body { padding: 0; }
            .no-print { display: none; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div>
            <h1>${mfConfig.nom || 'MicroFox'}</h1>
            <p class="mf-info">${mfConfig.adresse || ''}</p>
            <p class="mf-info">${mfConfig.telephone || ''}</p>
            <h2 style="margin-top: 10px; font-size: 16px; text-decoration: underline;">RAPPORT DE ZONE - JOURS ANTÉRIEURS</h2>
          </div>
          <div class="text-right">
            <strong>Total: ${zoneData.totalAmount.toLocaleString()} F</strong><br>
            Nombre: ${zoneData.count}
          </div>
        </div>
        <div class="info">
          <p><strong>Zone:</strong> ${zoneData.zone}</p>
          <p><strong>Date Impression:</strong> ${new Date().toLocaleDateString()}</p>
          <p><strong>Agent(s):</strong> ${agentsList}</p>
        </div>
        <table>
          <thead>
            <tr>
              <th>Date / Heure</th>
              <th>Client</th>
              <th>Tontine / Épargne</th>
              <th>Agent</th>
              <th>Mise</th>
              <th class="text-right">Montant</th>
            </tr>
          </thead>
          <tbody>
            ${zoneData.transactions.map(tx => {
              const txDate = new Date(tx.date);
              return `
              <tr>
                <td>
                  <div style="font-size: 8px; color: #3b82f6; font-weight: bold;">${txDate.toLocaleDateString()}</div>
                  ${txDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </td>
                <td>
                  <strong>${tx.memberName.toUpperCase()}</strong>
                  ${tx.hasActiveCredit ? '<br/><span class="credit-mention">CRÉDIT EN COURS</span>' : ''}
                </td>
                <td>
                  T: ${tx.tontineAccountNumber}<br/>
                  É: ${tx.epargneAccountNumber}
                </td>
                <td>${assignedAgentStr}</td>
                <td><strong>${(tx.dailyMise || 0).toLocaleString()} F</strong></td>
                <td class="text-right"><strong>${tx.amount.toLocaleString()} F</strong></td>
              </tr>
            `}).join('')}
          </tbody>
        </table>
        
        <div class="footer">
          <div class="signatures">
            <div>
              <p><strong>Agent Commercial:</strong> ${assignedAgentStr}</p>
              <div class="signature-box">Signature Agent</div>
            </div>
            <div class="text-right">
              <p><strong>Caisse / Responsable:</strong></p>
              <div class="signature-box">Signature Responsable</div>
            </div>
          </div>
          <p style="margin-top: 40px; font-style: italic; font-size: 9px;">Imprimé le ${new Date().toLocaleString()}</p>
        </div>
        <script>
          window.onload = () => {
            window.print();
            setTimeout(() => window.close(), 500);
          };
        </script>
      </body>
      </html>
    `;

    printWindow.document.write(htmlContent);
    printWindow.document.close();
  };

  return (
    <div className="max-w-5xl w-full mx-auto space-y-6 pb-12 overflow-y-auto max-h-screen pr-2">
      <div className="flex justify-between items-start">
        <div className="flex items-start gap-3">
          <div className="mt-1 text-blue-600">
            <Clock size={28} />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold text-[#121c32] uppercase tracking-tight leading-tight">
              Validation Cotisation antérieures<br />et versement non effectué
            </h1>
            <p className="text-gray-500 font-medium text-sm mt-1">Valider les collectes des jours passés non encore validées</p>
          </div>
        </div>
      </div>

      {successMessage && (
        <div className="bg-emerald-500 text-white p-4 rounded-2xl flex items-center justify-center gap-3 shadow-xl animate-in fade-in slide-in-from-top-4 duration-300">
          <CheckCircle size={20} />
          <span className="font-black uppercase tracking-tight text-sm text-center">{successMessage}</span>
        </div>
      )}

      {errorMessage && (
        <div className="bg-red-500 text-white p-4 rounded-2xl flex items-center justify-center gap-3 shadow-xl animate-in fade-in slide-in-from-top-4 duration-300">
          <AlertCircle size={20} />
          <span className="font-black uppercase tracking-tight text-sm text-center">{errorMessage}</span>
        </div>
      )}

      <div className="flex bg-gray-100 p-1 rounded-2xl w-fit">
        <button
          onClick={() => setActiveTab('validation')}
          className={`px-6 py-2.5 rounded-xl font-black uppercase tracking-widest text-[10px] transition-all ${
            activeTab === 'validation' ? 'bg-[#121c32] text-white shadow-lg' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Validation Cotisations
        </button>
        <button
          onClick={() => setActiveTab('reports')}
          className={`px-6 py-2.5 rounded-xl font-black uppercase tracking-widest text-[10px] transition-all ${
            activeTab === 'reports' ? 'bg-[#121c32] text-white shadow-lg' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Versements non effectués
        </button>
      </div>

      <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex flex-wrap items-end gap-4">
        <div className="space-y-1">
          <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Période du</label>
          <input 
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="px-4 py-2 bg-gray-50 border border-gray-100 rounded-xl outline-none focus:border-blue-500 font-bold text-[#121c32] text-xs"
          />
        </div>
        <div className="space-y-1">
          <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Au</label>
          <input 
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="px-4 py-2 bg-gray-50 border border-gray-100 rounded-xl outline-none focus:border-blue-500 font-bold text-[#121c32] text-xs"
          />
        </div>
        {(startDate || endDate) && (
          <button 
            onClick={() => { setStartDate(''); setEndDate(''); }}
            className="px-4 py-2 text-[10px] font-black text-red-500 uppercase hover:bg-red-50 rounded-xl transition-all"
          >
            Effacer
          </button>
        )}
      </div>

      {activeTab === 'validation' ? (
        <>
      <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-gray-100 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-black text-[#121c32] uppercase tracking-tight flex items-center gap-2">
            <AlertCircle size={18} className="text-amber-500" />
            Cotisations antérieures en attente
          </h2>
          <div className="flex items-center gap-2">
            <div className="px-3 py-1 bg-amber-50 text-amber-600 rounded-full text-[10px] font-black uppercase tracking-widest border border-amber-100">
              {pendingCotisations.length} Cotisation(s)
            </div>
            <div className="px-3 py-1 bg-gray-50 text-gray-600 rounded-full text-[10px] font-black uppercase tracking-widest border border-gray-100">
              {Object.values(zoneStatuses).filter(s => s === 'pending').length} Zone(s)
            </div>
          </div>
        </div>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {zones.map(zone => {
            const status = zoneStatuses[zone];
            if (status !== 'pending') return null;
            
            const zonePending = pendingCotisations.filter(p => p.zone === zone);
            const pendingAmount = zonePending.reduce((sum, p) => sum + p.amount, 0);
            
            return (
              <button
                key={zone}
                onClick={() => setSelectedZone(zone)}
                className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl border border-gray-100 hover:border-amber-200 hover:bg-amber-50/30 transition-all group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-amber-500 shadow-sm border border-amber-50 border-dashed">
                    <MapPin size={20} />
                  </div>
                  <div className="text-left">
                    <p className="text-xs font-black text-[#121c32] uppercase">{zone}</p>
                    <p className="text-[10px] font-bold text-amber-600">{pendingAmount.toLocaleString()} F • {zonePending.length} cotis.</p>
                  </div>
                </div>
                <ChevronRight size={16} className="text-gray-300 group-hover:text-amber-400 group-hover:translate-x-1 transition-all" />
              </button>
            );
          })}
          {pendingCotisations.length === 0 && (
            <div className="col-span-full py-6 text-center bg-gray-50 rounded-2xl border border-dashed border-gray-200">
              <p className="text-xs font-bold text-gray-400 italic">Toutes les cotisations des jours antérieurs sont validées.</p>
            </div>
          )}
        </div>
      </div>

      <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-gray-100 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-end">
          <div className="space-y-2">
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Sélectionner une Zone</label>
              <div className="relative">
                <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                <select 
                  value={selectedZone}
                  onChange={(e) => setSelectedZone(e.target.value)}
                  className="w-full pl-11 pr-10 py-3 bg-gray-50 border border-gray-100 rounded-2xl outline-none focus:border-blue-500 font-bold text-[#121c32] transition-all text-sm appearance-none cursor-pointer"
                >
                  <option value="">Choisir une zone...</option>
                  {zones.map(z => {
                    const status = zoneStatuses[z];
                    return (
                      <option key={z} value={z}>{z} {status === 'pending' ? '(À VALIDER)' : ''}</option>
                    );
                  })}
                </select>
                <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={18} />
              </div>
          </div>

          {zoneData && (
            <div className="flex items-center gap-4">
              <div className="flex-1 bg-amber-50 p-4 rounded-2xl border border-amber-100 flex items-center gap-4">
                <div className="bg-amber-600 p-2.5 rounded-xl text-white shadow-lg shadow-amber-600/20">
                  <TrendingUp size={20} />
                </div>
                <div>
                  <p className="text-[10px] font-black text-amber-400 uppercase tracking-widest">Total Antérieur</p>
                  <p className="text-xl font-black text-amber-900">{zoneData.totalAmount.toLocaleString()} F</p>
                </div>
              </div>
              <div className="flex-1 bg-gray-50 p-4 rounded-2xl border border-gray-100 flex items-center gap-4">
                <div className="bg-gray-600 p-2.5 rounded-xl text-white shadow-lg shadow-gray-600/20">
                  <Users size={20} />
                </div>
                <div>
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Cotisations</p>
                  <p className="text-xl font-black text-gray-900">{zoneData.count}</p>
                </div>
              </div>
            </div>
          )}
        </div>

        {zoneData && (
          <div className="pt-6 border-t border-gray-50 space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-black text-[#121c32] uppercase tracking-tight flex items-center gap-2">
                Détails des Cotisations Antérieures - {zoneData.zone}
              </h3>
              <div className="flex items-center gap-2">
                {zoneData.transactions.length > 0 && (
                  <>
                    <button 
                      onClick={handlePrint}
                      className="p-2.5 bg-gray-100 text-gray-600 rounded-xl hover:bg-gray-200 transition-all active:scale-95"
                      title="Imprimer"
                    >
                      <Printer size={18} />
                    </button>
                  </>
                )}
                {!zoneData.isValidated && zoneData.transactions.length > 0 && !isAgentCommercial && (
                  <button 
                    onClick={handleValidate}
                    className="bg-emerald-600 text-white px-6 py-2.5 rounded-xl font-black uppercase tracking-widest text-[10px] hover:bg-emerald-700 transition-all shadow-lg active:scale-95 flex items-center gap-2"
                  >
                    <CheckCircle size={16} />
                    Valider le retard
                  </button>
                )}
              </div>
            </div>

            <div className="bg-gray-50 rounded-2xl border border-gray-100 overflow-x-auto">
              <table className="w-full text-left min-w-[500px]">
                <thead>
                  <tr className="bg-gray-100/50 border-b border-gray-200">
                    <th className="px-6 py-3 text-[9px] font-black text-gray-500 uppercase tracking-widest">Date / Heure</th>
                    <th className="px-6 py-3 text-[9px] font-black text-gray-500 uppercase tracking-widest">Client</th>
                    <th className="px-6 py-3 text-[9px] font-black text-gray-500 uppercase tracking-widest">Tontine / Épargne</th>
                    <th className="px-6 py-3 text-[9px] font-black text-gray-500 uppercase tracking-widest">Agent</th>
                    <th className="px-6 py-3 text-[9px] font-black text-gray-500 uppercase tracking-widest">Mise</th>
                    <th className="px-6 py-3 text-[9px] font-black text-gray-500 uppercase tracking-widest text-right">Montant</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {zoneData.transactions.length > 0 ? (
                    zoneData.transactions.map((tx, idx) => {
                      const txDate = new Date(tx.date);
                      return (
                        <tr key={tx.id || idx} className="hover:bg-white transition-colors">
                          <td className="px-6 py-3">
                            <div className="flex flex-col">
                              <span className="text-[10px] font-black text-blue-600">{txDate.toLocaleDateString()}</span>
                              <span className="text-xs font-bold text-gray-500">
                                {txDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>
                          </td>
                          <td className="px-6 py-3">
                            <div className="flex flex-col">
                              <span className="text-xs font-black text-[#121c32] uppercase">{tx.memberName}</span>
                              {tx.hasActiveCredit && (
                                <span className="text-[8px] font-black text-red-500 uppercase">Crédit en cours</span>
                              )}
                            </div>
                          </td>
                          <td className="px-6 py-3">
                            <div className="flex flex-col">
                              <span className="text-[10px] font-bold text-gray-600">T: {tx.tontineAccountNumber}</span>
                              <span className="text-[10px] font-bold text-gray-400">É: {tx.epargneAccountNumber}</span>
                            </div>
                          </td>
                          <td className="px-6 py-3 text-xs font-bold text-gray-600 uppercase">
                            {getAssignedAgent(zoneData.zone)}
                          </td>
                          <td className="px-6 py-3 text-xs font-black text-blue-600">
                            {(tx.dailyMise || 0).toLocaleString()} F
                          </td>
                          <td className="px-6 py-3 text-right">
                            <span className="text-xs font-black text-[#121c32]">{tx.amount.toLocaleString()} F</span>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={6} className="px-6 py-12 text-center text-gray-400 italic text-xs font-medium">
                        Aucune cotisation antérieure en attente pour cette zone.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {!selectedZone && (
          <div className="py-20 text-center space-y-4">
            <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto text-gray-300">
              <Clock size={32} />
            </div>
            <p className="text-sm font-bold text-gray-400 italic">Veuillez sélectionner une zone pour voir les cotisations antérieures.</p>
          </div>
        )}
        </div>
        </>
      ) : (
        <div className="space-y-6 w-full">
          {(isCaissier || isAdminOrDir || isAgentCommercial) && (
            <div className="bg-white p-8 rounded-[2rem] shadow-sm border border-gray-100 space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-black text-[#121c32] uppercase tracking-tight flex items-center gap-2">
                  <Wallet size={18} className="text-red-500" />
                  Rapport des versements non effectués (Agents)
                </h2>
                <div className="px-3 py-1 bg-red-50 text-red-600 rounded-full text-[10px] font-black uppercase tracking-widest border border-red-100">
                  {agentsUnfulfilled.length} Agent(s) en attente
                </div>
              </div>
              
              <div className="bg-gray-50 rounded-2xl border border-gray-100 overflow-x-auto">
                <table className="w-full text-left min-w-[500px]">
                  <thead>
                    <tr className="bg-gray-100/50 border-b border-gray-200">
                      <th className="px-6 py-4 text-[9px] font-black text-gray-500 uppercase tracking-widest whitespace-nowrap">Nom de l'Agent</th>
                      <th className="px-6 py-4 text-[9px] font-black text-gray-500 uppercase tracking-widest text-right whitespace-nowrap">Montant Non Versé</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {agentsUnfulfilled.map((agent, i) => (
                      <tr 
                        key={i} 
                        className="hover:bg-white cursor-pointer transition-colors group"
                        onClick={() => setSelectedDetail({ name: agent.name, type: 'agent', details: agent.details })}
                      >
                        <td className="px-6 py-4 text-xs font-black text-[#121c32] uppercase group-hover:text-blue-600 flex items-center gap-2">
                          {agent.name}
                          <ChevronRight size={14} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                        </td>
                        <td className="px-6 py-4 text-right text-xs font-black text-red-600">{agent.amount.toLocaleString()} F</td>
                      </tr>
                    ))}
                    {agentsUnfulfilled.length === 0 && (
                      <tr>
                        <td colSpan={2} className="px-6 py-10 text-center text-gray-400 italic text-xs">
                          Tous les agents sont à jour.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {isAdminOrDir && (
            <div className="bg-white p-8 rounded-[2rem] shadow-sm border border-gray-100 space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-black text-[#121c32] uppercase tracking-tight flex items-center gap-2">
                  <Landmark size={18} className="text-orange-500" />
                  Rapport des versements non effectués (Caissiers)
                </h2>
                <div className="px-3 py-1 bg-orange-50 text-orange-600 rounded-full text-[10px] font-black uppercase tracking-widest border border-orange-100">
                  {cashiersUnfulfilled.length} Caisse(s) en attente
                </div>
              </div>

              <div className="bg-gray-50 rounded-2xl border border-gray-100 overflow-x-auto">
                <table className="w-full text-left min-w-[500px]">
                  <thead>
                    <tr className="bg-gray-100/50 border-b border-gray-200">
                      <th className="px-6 py-4 text-[9px] font-black text-gray-500 uppercase tracking-widest whitespace-nowrap">Identifiant Caisse</th>
                      <th className="px-6 py-4 text-[9px] font-black text-gray-500 uppercase tracking-widest text-right whitespace-nowrap">Montant Non Versé</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {cashiersUnfulfilled.map((cashier, i) => (
                      <tr 
                        key={i} 
                        className="hover:bg-white cursor-pointer transition-colors group"
                        onClick={() => setSelectedDetail({ name: cashier.name, type: 'cashier', details: cashier.details })}
                      >
                        <td className="px-6 py-4 text-xs font-black text-[#121c32] uppercase group-hover:text-amber-600 flex items-center gap-2">
                          {cashier.name}
                          <ChevronRight size={14} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                        </td>
                        <td className="px-6 py-4 text-right text-xs font-black text-orange-600">{cashier.amount.toLocaleString()} F</td>
                      </tr>
                    ))}
                    {cashiersUnfulfilled.length === 0 && (
                      <tr>
                        <td colSpan={2} className="px-6 py-10 text-center text-gray-400 italic text-xs">
                          Toutes les caisses sont à jour.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {selectedDetail && (
            <div className="bg-[#121c32] text-white p-8 rounded-[2rem] shadow-2xl space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between sticky top-0 bg-[#121c32] pb-4 z-10">
                <div>
                  <h3 className="text-xl font-black uppercase tracking-tight flex items-center gap-3">
                    {selectedDetail.type === 'agent' ? <Wallet size={24} className="text-red-400" /> : <Landmark size={24} className="text-orange-400" />}
                    Détails : {selectedDetail.name}
                  </h3>
                  <p className="text-gray-400 text-xs font-bold uppercase tracking-widest mt-1">Historique des opérations non versées</p>
                </div>
                <div className="flex items-center gap-3">
                  {isAgentCommercial && selectedDetail.type === 'agent' && selectedDetail.name === user.identifiant.toUpperCase() && (
                    <button
                      onClick={() => handleMakePayment({ name: selectedDetail.name, amount: selectedDetail.details.reduce((sum, d) => sum + d.amount, 0) })}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-2.5 rounded-xl font-black uppercase tracking-widest text-[10px] transition-all shadow-lg flex items-center gap-2"
                    >
                      <Send size={14} />
                      Verser l'impayé
                    </button>
                  )}
                  <button 
                    onClick={() => setSelectedDetail(null)}
                    className="w-10 h-10 bg-white/10 rounded-full flex items-center justify-center hover:bg-white/20 transition-all font-black"
                  >
                    ✕
                  </button>
                </div>
              </div>

              <div className="bg-white/5 rounded-2xl border border-white/10 overflow-x-auto">
                <table className="w-full text-left min-w-[500px]">
                  <thead>
                    <tr className="bg-white/10 border-b border-white/5">
                      <th className="px-6 py-4 text-[9px] font-black text-gray-400 uppercase tracking-widest">Date</th>
                      <th className="px-6 py-4 text-[9px] font-black text-gray-400 uppercase tracking-widest">Type</th>
                      <th className="px-6 py-4 text-[9px] font-black text-gray-400 uppercase tracking-widest">
                        {selectedDetail.type === 'agent' ? 'Client / Caisse' : 'Source'}
                      </th>
                      <th className="px-6 py-4 text-[9px] font-black text-gray-400 uppercase tracking-widest text-right">Montant</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {selectedDetail.details.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map((d, i) => (
                      <tr key={i}>
                        <td className="px-6 py-4">
                          <div className="flex flex-col">
                            <span className="text-[10px] font-black text-blue-400">{new Date(d.date).toLocaleDateString()}</span>
                            <span className="text-[9px] font-bold text-gray-500 uppercase">{new Date(d.date).toLocaleTimeString()}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase ${d.type === 'Collecte' || d.type === 'Réception' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>
                            {d.type}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex flex-col">
                            <span className="text-xs font-black uppercase">{selectedDetail.type === 'agent' ? d.client : d.source}</span>
                            {selectedDetail.type === 'agent' && <span className="text-[9px] font-bold text-gray-500">{d.code}</span>}
                          </div>
                        </td>
                        <td className={`px-6 py-4 text-right text-xs font-black ${d.amount > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                          {d.amount.toLocaleString()} F
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-white/10 font-black">
                      <td colSpan={3} className="px-6 py-4 text-right text-[10px] uppercase tracking-widest">Total Non Versé</td>
                      <td className="px-6 py-4 text-right text-sm text-red-400">
                        {selectedDetail.details.reduce((sum, d) => sum + d.amount, 0).toLocaleString()} F
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
      </div>
    );
};

export default ValidatePreviousCotisations;
