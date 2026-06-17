import React, { useState, useEffect } from 'react';
import { dispatchStorageEvent } from '../utils/events';
import { RotateCcw, Search, Calendar, User, AlertCircle, CheckCircle, Trash2, Download, Printer } from 'lucide-react';
import { recordAuditLog } from '../utils/audit';

interface TontineTransaction {
  id: string;
  clientId: string;
  clientName: string;
  clientCode: string;
  amount: number;
  date: string;
  description: string;
  tontineAccountId: string;
  userId: string;
  caisse: string;
  tontineAccountNumber?: string;
  recordedBy: string;
  isValidated: boolean; // true if already deposited at the main desk
  zone?: string;
  dateSortTime?: number;
}

const safeParseDate = (dateStr: any): Date | null => {
  if (!dateStr) return null;
  if (dateStr instanceof Date) return isNaN(dateStr.getTime()) ? null : dateStr;
  const str = String(dateStr).trim();
  
  // Format standard DD/MM/YYYY hh:mm:ss or DD/MM/YYYY
  if (str.includes('/')) {
    try {
      const parts = str.split(' ');
      const dateParts = parts[0].split('/');
      if (dateParts.length === 3) {
        const day = parseInt(dateParts[0], 10);
        const month = parseInt(dateParts[1], 10) - 1; // months are 0-indexed
        const year = parseInt(dateParts[2], 10);
        
        let hours = 0, minutes = 0, seconds = 0;
        if (parts[1]) {
          const timeParts = parts[1].split(':');
          hours = parseInt(timeParts[0] || '0', 10);
          minutes = parseInt(timeParts[1] || '0', 10);
          seconds = parseInt(timeParts[2] || '0', 10);
        }
        
        const d = new Date(year, month, day, hours, minutes, seconds);
        if (!isNaN(d.getTime())) {
          return d;
        }
      }
    } catch (e) {}
  }

  // Fallback to native parsing
  const d = new Date(dateStr);
  if (!isNaN(d.getTime())) return d;
  
  return null;
};

const getLocalDateString = (dateInput: any): string => {
  if (!dateInput) return '';
  const str = String(dateInput).trim();
  
  // Format standard DD/MM/YYYY hh:mm:ss or DD/MM/YYYY
  if (str.includes('/')) {
    const parts = str.split(' ')[0].split('/');
    if (parts.length === 3) {
      const day = parts[0].padStart(2, '0');
      const month = parts[1].padStart(2, '0');
      const year = parts[2];
      if (year.length === 4) {
        return `${year}-${month}-${day}`;
      }
    }
  }
  
  // Format ISO/standard YYYY-MM-DD ...
  if (str.includes('-')) {
    const parts = str.split('T')[0].split('-');
    if (parts.length === 3) {
      const year = parts[0];
      const month = parts[1].padStart(2, '0');
      const day = parts[2].padStart(2, '0');
      if (year.length === 4) {
        return `${year}-${month}-${day}`;
      }
    }
  }
  
  // Fallback to native properties format
  try {
    const d = new Date(dateInput);
    if (!isNaN(d.getTime())) {
      if (typeof dateInput === 'string' && dateInput.includes('T')) {
        return d.toISOString().split('T')[0];
      }
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    }
  } catch (e) {}
  
  return '';
};

const CancelCotisation: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [transactions, setTransactions] = useState<TontineTransaction[]>([]);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [selectedZone, setSelectedZone] = useState<string>('all');
  const [zonesList, setZonesList] = useState<string[]>([]);
  const [mfConfig] = useState(() => {
    const saved = localStorage.getItem('microfox_mf_config');
    return saved ? JSON.parse(saved) : { nom: 'MicroFox', adresse: '', telephone: '' };
  });

  const historyCacheRef = React.useRef<Record<string, { data: any[], raw: string | null }>>({});

  useEffect(() => {
    const user = localStorage.getItem('microfox_current_user');
    if (user) setCurrentUser(JSON.parse(user));
    loadTransactions();

    let debounceTimer: any = null;
    const triggerLoad = () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        loadTransactions();
      }, 200);
    };

    const handleStorageChange = (e: StorageEvent) => {
      if (!e.key) {
        triggerLoad();
        return;
      }
      const key = e.key;
      if (
        key === 'microfox_members_data' ||
        key.endsWith('microfox_members_data') ||
        key.includes('microfox_history_') ||
        key === 'microfox_agent_deposits' ||
        key.endsWith('microfox_agent_deposits') ||
        key === 'microfox_validated_zone_cotisations' ||
        key.endsWith('microfox_validated_zone_cotisations')
      ) {
        triggerLoad();
      }
    };

    const handleMicrofoxStorage = (e: CustomEvent<{ key?: string }>) => {
      const key = e.detail?.key;
      if (
        !key ||
        key === 'microfox_members_data' ||
        key.endsWith('microfox_members_data') ||
        key.includes('microfox_history_') ||
        key === 'microfox_agent_deposits' ||
        key.endsWith('microfox_agent_deposits') ||
        key === 'microfox_validated_zone_cotisations' ||
        key.endsWith('microfox_validated_zone_cotisations')
      ) {
        triggerLoad();
      }
    };

    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('microfox_storage' as any, handleMicrofoxStorage);
    return () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('microfox_storage' as any, handleMicrofoxStorage);
    };
  }, []);

  const loadTransactions = () => {
    const savedMembers = localStorage.getItem('microfox_members_data');
    const savedUser = localStorage.getItem('microfox_current_user');
    const user = savedUser ? JSON.parse(savedUser) : null;
    
    if (!savedMembers || !user) return;

    const allMembers = JSON.parse(savedMembers);
    const allTransactions: TontineTransaction[] = [];

    // Extract zones list dynamically
    const uniqueZones = Array.from(new Set(allMembers.map((m: any) => m.zone).filter(Boolean))) as string[];
    const sortedZones = uniqueZones.sort();
    setZonesList(prev => {
      if (JSON.stringify(prev) === JSON.stringify(sortedZones)) return prev;
      return sortedZones;
    });

    // Get validated deposits to check if transaction is already "poured" to main desk
    const savedDeposits = localStorage.getItem('microfox_agent_deposits');
    const validatedDeposits = savedDeposits ? JSON.parse(savedDeposits).filter((d: any) => d.status === 'Validé') : [];
    
    // Pre-parse validated deposits dates to optimize lookup inside nested some loops
    const parsedDeposits = validatedDeposits.map((d: any) => {
      let time = 0;
      try {
        if (d.date) {
          const parsed = safeParseDate(d.date);
          if (parsed) {
            time = parsed.getTime();
          }
        }
      } catch (e) {}
      return {
        agentId: d.agentId,
        time
      };
    }).filter((d: any) => d.time > 0);

    // Get validated zones to check if transaction is already "locked"
    const savedValidatedZones = localStorage.getItem('microfox_validated_zone_cotisations');
    const validatedZones = savedValidatedZones ? JSON.parse(savedValidatedZones) : {};
    
    // Pre-parse validated zones dates
    const parsedValidatedZones: Record<string, { validatedAtTime: number }> = {};
    if (validatedZones) {
      Object.entries(validatedZones).forEach(([key, val]: [string, any]) => {
        if (val && val.validatedAt) {
          try {
            const parsed = safeParseDate(val.validatedAt);
            if (parsed) {
              parsedValidatedZones[key] = {
                validatedAtTime: parsed.getTime()
              };
            }
          } catch (e) {}
        }
      });
    }

    allMembers.forEach((m: any) => {
      if (!m || m.isDeleted) return;
      
      const cacheKey = m.id;
      const savedHistory = localStorage.getItem(`microfox_history_${m.id}`);
      let history = [];
      const cached = historyCacheRef.current[cacheKey];
      if (cached && cached.raw === savedHistory) {
        history = cached.data;
      } else {
        if (savedHistory) {
          try {
            history = JSON.parse(savedHistory);
          } catch (err) {
            history = Array.isArray(m.history) ? m.history : [];
          }
        } else {
          history = Array.isArray(m.history) ? m.history : [];
        }
        historyCacheRef.current[cacheKey] = { data: history, raw: savedHistory };
      }
      if (!Array.isArray(history)) return;
      
      history.forEach((tx: any) => {
        if (!tx) return;
        const isOwner = String(tx.userId) === String(user.id) || 
                        (tx.description && tx.description.toLowerCase().includes(`agent ${user.identifiant.toLowerCase()}`)) ||
                        (tx.cashierName === user.identifiant);
        const isAuthorizedRole = user.role !== 'agent commercial';

        let isAllowed = false;
        if (user.role === 'agent commercial') {
          const agentZones = user.zonesCollecte || (user.zoneCollecte ? [user.zoneCollecte] : []);
          const normalizeZone = (z: string | undefined | null) => {
            if (!z) return '';
            return z.toString().toUpperCase().replace('ZONE', '').replace(/\s+/g, '').replace(/_/g, '').trim();
          };
          const normalizedTxZone = normalizeZone(m.zone);
          const hasMatchingZone = agentZones.some((az: string) => normalizeZone(az) === normalizedTxZone);

          isAllowed = isOwner && hasMatchingZone;
        } else {
          isAllowed = isOwner || isAuthorizedRole;
        }

        if (isAllowed && (tx.type === 'cotisation' || tx.type === 'depot' || tx.type === 'deposit') && tx.account === 'tontine') {
          // Pre-evaluate date times for quick comparison
          let txTime = 0;
          let txDate = '';
          try {
            if (tx.date) {
              const dParsed = safeParseDate(tx.date);
              if (dParsed) {
                txTime = dParsed.getTime();
              }
              txDate = getLocalDateString(tx.date);
            }
          } catch (e) {}

          // Check if this specific transaction was part of a validated deposit using numeric checks
          const isPoured = parsedDeposits.some((d: any) => 
            String(d.agentId) === String(tx.userId) && txTime <= d.time
          );

          // Check if the zone is validated for this date and if the transaction was made before the validation using pre-parsed timestamps
          const validationKey = txDate ? `${txDate}_${m.zone || ''}` : '';
          const zoneValidation = validationKey ? parsedValidatedZones[validationKey] : null;
          let isZoneValidated = false;
          if (zoneValidation && txTime > 0) {
            isZoneValidated = txTime <= zoneValidation.validatedAtTime;
          }

          allTransactions.push({
            id: tx.id,
            clientId: m.id,
            clientName: m.name,
            clientCode: m.code,
            amount: tx.amount || 0,
            date: tx.date,
            description: tx.description || '',
            tontineAccountId: tx.tontineAccountId,
            tontineAccountNumber: tx.tontineAccountNumber,
            userId: tx.userId,
            caisse: tx.caisse || 'AGENT',
            recordedBy: tx.cashierName || 'N/A',
            isValidated: !!(isPoured || isZoneValidated),
            zone: m.zone,
            dateSortTime: txTime
          });
        }
      });
    });

    // Sort by descending date using pre-calculated numeric timestamps
    setTransactions(allTransactions.sort((a, b) => {
      const timeB = b.dateSortTime || 0;
      const timeA = a.dateSortTime || 0;
      return timeB - timeA;
    }));
  };

  const handleCancel = (tx: TontineTransaction) => {
    const userObj = currentUser || JSON.parse(localStorage.getItem('microfox_current_user') || '{}');
    if (userObj.role === 'caissier') {
      setErrorMessage("Action interdite : Le caissier n'a pas la possibilité de supprimer ou d'annuler une cotisation.");
      setTimeout(() => setErrorMessage(null), 5000);
      return;
    }

    if (tx.isValidated) {
      setErrorMessage("Impossible d'annuler : Cette cotisation a déjà été versée à la caisse.");
      setTimeout(() => setErrorMessage(null), 5000);
      return;
    }

    try {
      // 1. Update member history and balance
      const savedMembers = localStorage.getItem('microfox_members_data');
      if (savedMembers) {
        const allMembers = JSON.parse(savedMembers);
        const updatedMembers = allMembers.map((m: any) => {
          if (m.id === tx.clientId) {
            // Update history: Mark as cancelled instead of deleting
            const savedHistory = localStorage.getItem(`microfox_history_${m.id}`);
            let history = savedHistory ? JSON.parse(savedHistory) : (m.history || []);
            const updatedHistory = history.map((h: any) => {
              if (h.id === tx.id) {
                return { 
                  ...h, 
                  type: 'annulation', 
                  description: `ANNULÉ: ${h.description}`,
                  cancelledAt: new Date().toISOString(),
                  cancelledBy: currentUser.identifiant,
                  originalAmount: h.amount,
                  amount: 0 // Set amount to 0 so it doesn't affect totals if logic is simple
                };
              }
              return h;
            });
            localStorage.setItem(`microfox_history_${m.id}`, JSON.stringify(updatedHistory));

            // Update tontine account balance
            const updatedTontineAccounts = (m.tontineAccounts || []).map((acc: any) => {
              if (acc.id === tx.tontineAccountId) {
                return { ...acc, balance: Math.max(0, (acc.balance || 0) - tx.amount) };
              }
              return acc;
            });

            return {
              ...m,
              balances: { ...m.balances, tontine: Math.max(0, (m.balances?.tontine || 0) - tx.amount) },
              tontineAccounts: updatedTontineAccounts,
              history: updatedHistory
            };
          }
          return m;
        });
        localStorage.setItem('microfox_members_data', JSON.stringify(updatedMembers));
      }

      // 2. Update Correct Balance (Caisse or Agent)
      if (tx.caisse && tx.caisse !== 'AGENT' && tx.caisse !== 'N/A') {
        // Update Caisse balance
        const cashKey = `microfox_cash_balance_${tx.caisse}`;
        const currentCashBalance = Number(localStorage.getItem(cashKey) || 0);
        localStorage.setItem(cashKey, Math.max(0, currentCashBalance - tx.amount).toString());
      } else {
        // Update Agent balance
        const agentBalanceKey = `microfox_agent_balance_${tx.userId}`;
        const currentAgentBalance = Number(localStorage.getItem(agentBalanceKey) || 0);
        localStorage.setItem(agentBalanceKey, Math.max(0, currentAgentBalance - tx.amount).toString());
      }

      // 3. Record Audit Log
      recordAuditLog('MODIFICATION', 'TONTINE', `Annulation cotisation ${tx.amount} F - Client: ${tx.clientName} (${tx.clientCode})`);

      setSuccessMessage("Cotisation annulée avec succès.");
      setTimeout(() => setSuccessMessage(null), 4000);
      
      // Force immediate UI update
      loadTransactions();
      dispatchStorageEvent();
    } catch (error) {
      setErrorMessage("Une erreur est survenue lors de l'annulation.");
      setTimeout(() => setErrorMessage(null), 5000);
    }
  };

  const handleValidateZone = (zoneName: string) => {
    if (!zoneName || zoneName === 'all') return;

    try {
      const savedMembers = localStorage.getItem('microfox_members_data');
      if (!savedMembers) return;

      const members = JSON.parse(savedMembers);
      const savedValidated = localStorage.getItem('microfox_validated_zone_cotisations');
      const validatedZones = savedValidated ? JSON.parse(savedValidated) : {};

      let totalAmount = 0;
      let count = 0;
      const now = new Date().toISOString();
      const userObj = currentUser || JSON.parse(localStorage.getItem('microfox_current_user') || '{}');

      const normalizeZone = (z: string | undefined | null) => {
        if (!z) return '';
        return z.toString().toUpperCase().replace('ZONE', '').replace(/\s+/g, '').replace(/_/g, '').trim();
      };

      const updatedMembers = members.map((m: any) => {
        if (normalizeZone(m.zone) !== normalizeZone(zoneName)) return m;

        // Load and update history
        const savedHistory = localStorage.getItem(`microfox_history_${m.id}`);
        let history = savedHistory ? JSON.parse(savedHistory) : (m.history || []);
        let historyChanged = false;

        const updatedHistory = history.map((tx: any) => {
          const isCotisation = (tx.type === 'cotisation' || tx.type === 'depot' || tx.type === 'deposit') && tx.account === 'tontine';
          if (isCotisation && !tx.isDeleted && tx.type !== 'annulation') {
            const txDate = tx.date ? safeParseDate(tx.date) : null;
            if (txDate) {
              const txDay = getLocalDateString(tx.date);
              const validationKey = `${txDay}_${zoneName}`;
              const zoneValidation = validatedZones[validationKey];
              const validatedAtParsed = zoneValidation ? safeParseDate(zoneValidation.validatedAt) : null;
              const isTxValidated = tx.isValidated === true || (zoneValidation && !!validatedAtParsed && txDate.getTime() <= validatedAtParsed.getTime());

              if (!isTxValidated) {
                tx.isValidated = true;
                historyChanged = true;
                totalAmount += tx.amount;
                count += 1;

                // Create/update day validation entry in validatedZones
                if (!validatedZones[validationKey]) {
                  validatedZones[validationKey] = {
                    validatedAt: now,
                    validatedBy: userObj.identifiant || 'SYSTEM',
                    totalAmount: 0,
                    count: 0
                  };
                }
                validatedZones[validationKey].validatedAt = now;
                validatedZones[validationKey].totalAmount += tx.amount;
                validatedZones[validationKey].count += 1;
              }
            }
          }
          return tx;
        });

        if (historyChanged) {
          localStorage.setItem(`microfox_history_${m.id}`, JSON.stringify(updatedHistory));
          return {
            ...m,
            history: updatedHistory
          };
        }
        return m;
      });

      if (count === 0) {
        setErrorMessage("Aucune cotisation en attente à valider pour cette zone.");
        setTimeout(() => setErrorMessage(null), 5000);
        return;
      }

      // Save updated validated records and updated members
      localStorage.setItem('microfox_validated_zone_cotisations', JSON.stringify(validatedZones));
      localStorage.setItem('microfox_members_data', JSON.stringify(updatedMembers));

      // Record Audit Log
      recordAuditLog('MODIFICATION', 'TONTINE', `Validation des cotisations de la zone ${zoneName} - Total validé: ${totalAmount} F (${count} cotisations)`);

      // 4. "L'administrateur qui valide la cotisation doit avoir ce versement dans ses opérations."
      const isAdmin = userObj.role === 'admin' || userObj.role === 'administrateur';
      if (isAdmin) {
        const txsSaved = localStorage.getItem('microfox_vault_transactions');
        const allTxs = txsSaved ? JSON.parse(txsSaved) : [];
        const newAdminTx = {
          id: `val_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          type: 'Validation Cotisations',
          amount: totalAmount,
          date: now,
          cashierName: userObj.identifiant || 'ADMIN',
          observation: `Validation Cotisations Zone ${zoneName} - ${totalAmount} FCFA (${count} cotisations)`
        };
        localStorage.setItem('microfox_vault_transactions', JSON.stringify([newAdminTx, ...allTxs]));
      }

      setSuccessMessage(`Validation réussie de ${totalAmount.toLocaleString()} FCFA pour la zone ${zoneName} !`);
      setTimeout(() => setSuccessMessage(null), 4000);

      // Refresh
      loadTransactions();
      dispatchStorageEvent();
    } catch (error) {
      console.error(error);
      setErrorMessage("Une erreur est survenue lors de la validation.");
      setTimeout(() => setErrorMessage(null), 5000);
    }
  };

  const filteredTransactions = transactions.filter(tx => {
    let txDateString = '';
    try {
      if (tx.date) {
        txDateString = getLocalDateString(tx.date);
      }
    } catch (e) {}
    const matchesSearch = tx.clientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      tx.clientCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (tx.tontineAccountNumber && tx.tontineAccountNumber.toLowerCase().includes(searchTerm.toLowerCase())) ||
      tx.description.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesDate = txDateString >= startDate && txDateString <= endDate;
    
    const normalizeZone = (z: string | undefined | null) => {
      if (!z) return '';
      return z.toString().toUpperCase().replace('ZONE', '').replace(/\s+/g, '').replace(/_/g, '').trim();
    };
    
    const matchesZone = selectedZone === 'all' || normalizeZone(tx.zone) === normalizeZone(selectedZone);
    
    return matchesSearch && matchesDate && matchesZone;
  });

  const totalFilteredAmount = filteredTransactions.reduce((sum, tx) => sum + tx.amount, 0);

  const generateReportHTML = (isForPrinting: boolean = false) => {
    const listHtml = filteredTransactions.map((tx, index) => {
      const dateObj = tx.date ? safeParseDate(tx.date) : null;
      const isValidDate = dateObj !== null;
      const formattedDate = isValidDate ? dateObj.toLocaleDateString('fr-FR') : 'N/A';
      const formattedTime = isValidDate ? dateObj.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '';
      return `
        <tr>
          <td style="text-align: center; font-weight: bold; padding: 3px 5px; border: 1px solid #cbd5e1;">${index + 1}</td>
          <td style="padding: 3px 5px; border: 1px solid #cbd5e1;">${formattedDate} ${formattedTime}</td>
          <td style="padding: 3px 5px; border: 1px solid #cbd5e1;">
            <strong style="text-transform: uppercase;">${tx.clientName}</strong><br/>
            <span style="color: #64748b; font-size: 7.5px;">Code: ${tx.clientCode} ${tx.tontineAccountNumber ? `| Compte: ${tx.tontineAccountNumber}` : ''}</span>
          </td>
          <td style="padding: 3px 5px; border: 1px solid #cbd5e1; max-width: 250px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${tx.description || 'N/A'}</td>
          <td style="padding: 3px 5px; border: 1px solid #cbd5e1;">${tx.recordedBy && tx.recordedBy.toLowerCase() === 'sena' ? 'SENA KOFFI' : (tx.recordedBy || 'N/A')}</td>
          <td style="text-align: center; padding: 3px 5px; border: 1px solid #cbd5e1;">
            <span style="display: inline-block; padding: 1px 4px; border-radius: 2px; font-size: 7.5px; font-weight: bold; text-transform: uppercase; ${
              tx.isValidated ? 'background-color: #d1fae5; color: #065f46;' : 'background-color: #fef3c7; color: #92400e;'
            }">
              ${tx.isValidated ? 'Versé' : 'En attente'}
            </span>
          </td>
          <td style="text-align: right; font-weight: bold; padding: 3px 5px; border: 1px solid #cbd5e1;">${tx.amount.toLocaleString()} F</td>
        </tr>
      `;
    }).join('');

    return `
      <!DOCTYPE html>
      <html lang="fr">
      <head>
        <meta charset="utf-8">
        <title>Rapport d'Annulation de Cotisations</title>
        <style>
          @page {
            size: A4 portrait;
            margin: 6mm 6mm 8mm 6mm;
          }
          body {
            font-family: Arial, Helvetica, sans-serif;
            color: #111827;
            margin: 0;
            padding: 0;
            line-height: 1.15;
            font-size: 9px;
            background-color: #ffffff;
          }
          .header {
            border-bottom: 2px solid #111827;
            padding-bottom: 5px;
            margin-bottom: 10px;
            display: flex;
            justify-content: space-between;
            align-items: flex-end;
          }
          .header-left h1 {
            font-size: 15px;
            margin: 0 0 1px 0;
            text-transform: uppercase;
            font-weight: 800;
          }
          .header-left p {
            margin: 0;
            font-size: 8.5px;
            color: #4b5563;
          }
          .header-right {
            text-align: right;
          }
          .header-right h2 {
            font-size: 11px;
            margin: 0 0 3px 0;
            text-transform: uppercase;
            font-weight: bold;
            color: #b91c1c;
          }
          .header-right p {
            margin: 0;
            font-size: 8px;
            color: #374151;
          }
          .summary-banner {
            background-color: #f8fafc;
            border: 1px solid #e2e8f0;
            border-radius: 4px;
            padding: 5px 8px;
            margin-bottom: 10px;
            display: flex;
            justify-content: space-between;
            font-size: 8.5px;
          }
          .summary-item strong {
            font-size: 9.5px;
            color: #111827;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            font-size: 8px;
          }
          th {
            background-color: #f1f5f9;
            font-weight: bold;
            color: #334155;
            text-transform: uppercase;
            font-size: 7.5px;
            border: 1px solid #cbd5e1;
            padding: 3px 5px;
            text-align: left;
          }
          tr:nth-child(even) {
            background-color: #f8fafc;
          }
          .signatures {
            display: flex;
            justify-content: space-between;
            margin-top: 15px;
            page-break-inside: avoid;
          }
          .signature-box {
            width: 180px;
            border-top: 1px dashed #64748b;
            margin-top: 25px;
            text-align: center;
            font-size: 7.5px;
            padding-top: 2px;
            color: #475569;
          }
          .footer {
            margin-top: 15px;
            font-size: 7.5px;
            color: #64748b;
            display: flex;
            justify-content: space-between;
            border-top: 1px solid #e2e8f0;
            padding-top: 4px;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="header-left">
            <h1>${mfConfig.nom || 'MicroFox'}</h1>
            <p>${mfConfig.adresse || ''} ${mfConfig.telephone ? `| Tél: ${mfConfig.telephone}` : ''}</p>
          </div>
          <div class="header-right">
            <h2>Annulation de Cotisations</h2>
            <p>Période du <strong>${new Date(startDate).toLocaleDateString('fr-FR')}</strong> au <strong>${new Date(endDate).toLocaleDateString('fr-FR')}</strong></p>
          </div>
        </div>

        <div class="summary-banner">
          <div class="summary-item">Généré le: <strong>${new Date().toLocaleString('fr-FR')}</strong></div>
          <div class="summary-item">Nombre de transactions: <strong>${filteredTransactions.length}</strong></div>
          <div class="summary-item">Total des cotisations: <strong style="color: #b91c1c; font-size: 10px;">${totalFilteredAmount.toLocaleString()} FCFA</strong></div>
        </div>

        <table>
          <thead>
            <tr>
              <th style="width: 3%; text-align: center;">N°</th>
              <th style="width: 14%;">Date & Heure</th>
              <th style="width: 25%;">Client</th>
              <th style="width: 28%;">Description / Motif</th>
              <th style="width: 15%;">Enregistré par</th>
              <th style="width: 7%; text-align: center;">Statut</th>
              <th style="width: 8%; text-align: right;">Montant</th>
            </tr>
          </thead>
          <tbody>
            ${filteredTransactions.length > 0 ? listHtml : '<tr><td colspan="7" style="text-align: center; padding: 15px; color: #64748b; font-style: italic;">Aucune cotisation trouvée pour cette période.</td></tr>'}
          </tbody>
        </table>

        ${filteredTransactions.length > 0 ? `
        <div class="signatures">
          <div>
            <p><strong>Caisse de Saisie / Agent:</strong></p>
            <div class="signature-box">Nom et Signature</div>
          </div>
          <div style="text-align: right;">
            <p><strong>Agent commercial:</strong></p>
            <div class="signature-box" style="margin-left: auto;">Nom, Date et Signature</div>
          </div>
        </div>
        ` : ''}

        <div class="footer">
          <span>Système de Gestion MicroFox Premium</span>
          <span>© MicroFox</span>
        </div>
        ${isForPrinting ? `
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

  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    const htmlContent = generateReportHTML(true);
    printWindow.document.write(htmlContent);
    printWindow.document.close();
  };

  const handleExport = () => {
    if (filteredTransactions.length === 0) return;
    const htmlContent = generateReportHTML(false);
    const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `annulations_cotisations_${startDate}_au_${endDate}.html`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-start gap-3">
          <div className="mt-1 text-red-500">
            <RotateCcw size={24} />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold text-[#121c32] uppercase tracking-tight leading-tight">
              Annulation de<br />Cotisation
            </h1>
            <p className="text-gray-500 font-medium text-sm mt-1">Gérer les erreurs de saisie avant versement</p>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto print:hidden">
          <button 
            onClick={handlePrint}
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-gray-50 transition-all active:scale-95 shadow-sm"
          >
            <Printer size={16} />
            Imprimer
          </button>
          <button 
            onClick={handleExport}
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-[#121c32] text-white rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-[#121c32]/90 transition-all active:scale-95 shadow-lg shadow-[#121c32]/10"
          >
            <Download size={16} />
            Exporter
          </button>
        </div>
      </div>

      {/* Messages */}
      {(successMessage || errorMessage) && (
        <div className="print:hidden space-y-4">
          {successMessage && (
            <div className="bg-emerald-500 text-white p-4 rounded-2xl flex items-center justify-center gap-3 shadow-xl animate-in fade-in slide-in-from-top-4 duration-300">
              <CheckCircle size={20} />
              <span className="font-black uppercase tracking-tight text-sm text-center">{successMessage}</span>
            </div>
          )}

          {errorMessage && (
            <div className="bg-red-500 text-white p-4 rounded-xl flex items-center justify-center gap-3 shadow-sm animate-in fade-in duration-300">
              <AlertCircle size={20} />
              <span className="font-bold text-sm text-center">{errorMessage}</span>
            </div>
          )}
        </div>
      )}

      {/* Search & Filters */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 print:hidden">
        <div className="bg-white p-4 rounded-[1.5rem] shadow-sm border border-gray-100 flex-1">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
            <input 
              type="text" 
              placeholder="Rechercher par client ou description..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-12 pr-4 py-4 bg-gray-50 text-[#121c32] rounded-2xl font-medium outline-none placeholder:text-gray-400 border border-gray-100 focus:border-red-500 transition-all"
            />
          </div>
        </div>

        <div className="bg-white p-4 rounded-[1.5rem] shadow-sm border border-gray-100">
          <div className="flex items-center gap-3">
            <div className="flex-1 space-y-1">
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Du</label>
              <input 
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-4 py-3 bg-gray-50 text-[#121c32] rounded-xl font-bold outline-none border border-gray-100 focus:border-red-500 transition-all text-sm"
              />
            </div>
            <div className="flex-1 space-y-1">
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Au</label>
              <input 
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-4 py-3 bg-gray-50 text-[#121c32] rounded-xl font-bold outline-none border border-gray-100 focus:border-red-500 transition-all text-sm"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Zone Selector and validation for Admin, Directeur, Caissier */}
      {currentUser && (currentUser.role === 'administrateur' || currentUser.role === 'admin' || currentUser.role === 'directeur' || currentUser.role === 'caissier') && (
        <div className="bg-white p-5 rounded-[1.5rem] shadow-sm border border-gray-100 flex flex-col sm:flex-row items-end sm:items-center justify-between gap-4 print:hidden">
          <div className="flex-1 space-y-1 w-full sm:w-auto">
            <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Sélectionner une Zone (Filtrer)</label>
            <select 
              value={selectedZone}
              onChange={(e) => setSelectedZone(e.target.value)}
              className="w-full px-4 py-3 bg-gray-50 border border-gray-100 text-[#121c32] rounded-xl font-bold outline-none focus:border-red-500 transition-all text-sm cursor-pointer"
            >
              <option value="all">Toutes les Zones</option>
              {zonesList.map(zone => (
                <option key={zone} value={zone}>Zone {zone}</option>
              ))}
            </select>
          </div>
          {selectedZone !== 'all' && (
            <button 
              onClick={() => handleValidateZone(selectedZone)}
              className="w-full sm:w-auto px-6 py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs uppercase tracking-widest transition-all active:scale-95 shadow-md shadow-emerald-600/10 flex items-center justify-center gap-2"
            >
              <CheckCircle size={16} />
              Valider les cotisations
            </button>
          )}
        </div>
      )}

      {/* Summary Stat */}
      <div className="bg-white p-6 rounded-[1.5rem] shadow-sm border border-gray-100 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-red-50 flex items-center justify-center text-red-500">
            <Calendar size={24} />
          </div>
          <div>
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Total des cotisations filtrées</p>
            <p className="text-2xl font-black text-[#121c32]">{totalFilteredAmount.toLocaleString()} FCFA</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Transactions</p>
          <p className="text-lg font-bold text-[#121c32]">{filteredTransactions.length}</p>
        </div>
      </div>

      {/* Transactions List */}
      <div className="bg-white rounded-[1.5rem] shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left min-w-[800px]">
            <thead>
              <tr className="bg-gray-55 border-b border-gray-100">
                <th className="px-6 py-4 text-[10px] font-black text-gray-500 uppercase tracking-widest">Date & Heure</th>
                <th className="px-6 py-4 text-[10px] font-black text-gray-500 uppercase tracking-widest">Client</th>
                <th className="px-6 py-4 text-[10px] font-black text-gray-500 uppercase tracking-widest">Description</th>
                <th className="px-6 py-4 text-[10px] font-black text-gray-500 uppercase tracking-widest text-right">Montant</th>
                <th className="px-6 py-4 text-[10px] font-black text-gray-500 uppercase tracking-widest text-center">Statut</th>
                <th className="px-6 py-4 text-[10px] font-black text-gray-500 uppercase tracking-widest text-right print:hidden">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filteredTransactions.length > 0 ? (
                filteredTransactions.map((tx) => (
                  <tr key={tx.id} className="hover:bg-gray-55/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="text-sm font-bold text-[#121c32]">
                          {tx.date && safeParseDate(tx.date) ? safeParseDate(tx.date)!.toLocaleDateString('fr-FR') : 'N/A'}
                        </span>
                        <span className="text-[10px] font-medium text-gray-400">
                          {tx.date && safeParseDate(tx.date) ? safeParseDate(tx.date)!.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : ''}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="text-sm font-black text-[#121c32] uppercase">{tx.clientName}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-bold text-gray-500">{tx.clientCode}</span>
                          {tx.tontineAccountNumber && (
                            <span className="text-[9px] font-black text-blue-500 bg-blue-50 px-1.5 rounded uppercase">{tx.tontineAccountNumber}</span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-xs font-medium text-gray-600 max-w-[200px] truncate">{tx.description}</p>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <span className="text-sm font-black text-[#121c32]">{tx.amount.toLocaleString()} F</span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      {tx.isValidated ? (
                        <span className="px-3 py-1 bg-emerald-50 text-emerald-600 rounded-lg text-[10px] font-black uppercase tracking-tight">Versé</span>
                      ) : (
                        <span className="px-3 py-1 bg-amber-50 text-amber-600 rounded-lg text-[10px] font-black uppercase tracking-tight">En attente</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right print:hidden">
                      {currentUser?.role === 'caissier' ? (
                        <div className="text-[10px] text-gray-400 font-bold uppercase italic select-none">Non autorisé</div>
                      ) : !tx.isValidated ? (
                        <button 
                          onClick={() => handleCancel(tx)}
                          className="p-2 text-red-500 hover:bg-red-50 rounded-xl transition-all active:scale-95"
                          title="Annuler la cotisation"
                        >
                          <Trash2 size={20} />
                        </button>
                      ) : (
                        <div className="p-2 text-gray-300 cursor-not-allowed">
                          <Trash2 size={20} />
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="px-6 py-20 text-center">
                    <p className="text-sm font-bold text-gray-400 italic">Aucune cotisation annulable trouvée.</p>
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

export default CancelCotisation;
