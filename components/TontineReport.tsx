import React, { useState, useEffect } from 'react';
import { 
  FileText, 
  Calendar, 
  Download, 
  Printer, 
  Search, 
  Users, 
  Coins, 
  ClipboardList,
  Filter,
  RefreshCw
} from 'lucide-react';

const isSameDay = (dateStr1: any, dateStr2: any): boolean => {
  if (!dateStr1 || !dateStr2) return false;
  
  const parseToYYYYMMDD = (input: any): string => {
    if (!input) return '';
    const str = String(input).trim();
    
    // 1. If it's pure date in YYYY-MM-DD format (no time/T/:)
    if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
      return str;
    }

    // 2. Format ISO/standard YYYY-MM-DD ... (Extract directly from string to avoid timezone shifts)
    if (str.includes('-')) {
      const parts = str.split('T')[0].split(' ')[0].split('-');
      if (parts.length === 3) {
        const year = parts[0];
        const month = parts[1].padStart(2, '0');
        const day = parts[2].padStart(2, '0');
        if (year.length === 4) {
          return `${year}-${month}-${day}`;
        }
      }
    }

    // 3. Format standard DD/MM/YYYY hh:mm:ss or DD/MM/YYYY
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

    // 4. Try parsing with native Date using UTC to avoid local timezone shifts
    try {
      const d = new Date(input);
      if (!isNaN(d.getTime())) {
        const year = d.getUTCFullYear();
        const month = String(d.getUTCMonth() + 1).padStart(2, '0');
        const day = String(d.getUTCDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
      }
    } catch (e) {}

    return '';
  };

  const d1 = parseToYYYYMMDD(dateStr1);
  const d2 = parseToYYYYMMDD(dateStr2);
  return d1 !== '' && d1 === d2;
};

const TontineReport: React.FC = () => {
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  });

  const [selectedZone, setSelectedZone] = useState<string>('Toutes les zones');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [zonesList, setZonesList] = useState<string[]>([]);
  const [reportData, setReportData] = useState<any[]>([]);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isFullySynced, setIsFullySynced] = useState<boolean | null>(null);

  useEffect(() => {
    const checkSync = () => {
      const mfCode = localStorage.getItem('microfox_current_mf') || '';
      const prefix = mfCode ? `mf_${mfCode.toLowerCase().replace(/\s+/g, '_')}_` : '';
      
      const pendingGlobal = localStorage.getItem('microfox_pending_sync') === 'true';
      const pendingTenant = prefix ? localStorage.getItem(prefix + 'microfox_pending_sync') === 'true' : false;
      const isPulling = localStorage.getItem('microfox_pull_in_progress') === 'true';
      
      let globalDirty: string[] = [];
      try {
        globalDirty = JSON.parse(localStorage.getItem('microfox_dirty_keys') || '[]');
      } catch (e) {}
      
      let tenantDirty: string[] = [];
      try {
        tenantDirty = prefix ? JSON.parse(localStorage.getItem(prefix + 'microfox_dirty_keys') || '[]') : [];
      } catch (e) {}
      
      const hasDirty = (Array.isArray(globalDirty) && globalDirty.length > 0) || 
                       (Array.isArray(tenantDirty) && tenantDirty.length > 0);
                       
      setIsFullySynced(!(pendingGlobal || pendingTenant || hasDirty || isPulling));
    };

    checkSync();
    const interval = setInterval(checkSync, 1000);
    
    window.addEventListener('microfox_pull_status_change', checkSync);
    window.addEventListener('microfox_storage' as any, checkSync);
    window.addEventListener('storage', checkSync);
    
    return () => {
      clearInterval(interval);
      window.removeEventListener('microfox_pull_status_change', checkSync);
      window.removeEventListener('microfox_storage' as any, checkSync);
      window.removeEventListener('storage', checkSync);
    };
  }, [isSyncing]);

  const historyCacheRef = React.useRef<Record<string, { data: any[], raw: string | null }>>({});

  useEffect(() => {
    // Request immediate background sync on mount to ensure fresh database state is loaded
    window.dispatchEvent(new CustomEvent('request_supabase_sync'));
  }, []);

  const handleManualSync = () => {
    setIsSyncing(true);
    window.dispatchEvent(new CustomEvent('request_supabase_sync'));
    
    let checkCount = 0;
    const maxChecks = 100; // up to 10 seconds (100 * 100ms)
    
    const checkInterval = setInterval(() => {
      checkCount++;
      const isPulling = localStorage.getItem('microfox_pull_in_progress') === 'true';
      const pendingGlobal = localStorage.getItem('microfox_pending_sync') === 'true';
      const mfCode = localStorage.getItem('microfox_current_mf') || '';
      const prefix = mfCode ? `mf_${mfCode.toLowerCase().replace(/\s+/g, '_')}_` : '';
      const pendingTenant = prefix ? localStorage.getItem(prefix + 'microfox_pending_sync') === 'true' : false;
      
      let globalDirty: string[] = [];
      try {
        globalDirty = JSON.parse(localStorage.getItem('microfox_dirty_keys') || '[]');
      } catch (e) {}
      
      let tenantDirty: string[] = [];
      try {
        tenantDirty = prefix ? JSON.parse(localStorage.getItem(prefix + 'microfox_dirty_keys') || '[]') : [];
      } catch (e) {}
      
      const hasDirty = (Array.isArray(globalDirty) && globalDirty.length > 0) || 
                       (Array.isArray(tenantDirty) && tenantDirty.length > 0);
      
      const stillSyncing = isPulling || pendingGlobal || pendingTenant || hasDirty;
      
      if ((!stillSyncing && checkCount > 5) || checkCount >= maxChecks) {
        clearInterval(checkInterval);
        loadData();
        setIsSyncing(false);
      }
    }, 100);
  };

  const loadData = () => {
    const savedUser = localStorage.getItem('microfox_current_user');
    const userObj = savedUser ? JSON.parse(savedUser) : null;
    setCurrentUser(userObj);

    if (!userObj) return;

    const savedMembers = localStorage.getItem('microfox_members_data');
    const allMembers = savedMembers ? JSON.parse(savedMembers) : [];
    const results: any[] = [];

    // Extract all unique zones from active members
    const uniqueZones = Array.from(
      new Set(allMembers.map((m: any) => m.zone).filter(Boolean))
    ) as string[];
    const standardZones = [
      '01', '01A', '02', '02A', '03', '03A', '04', '04A', '05', '05A',
      '06', '06A', '07', '07A', '08', '08A', '09', '09A'
    ];
    let combinedZones = Array.from(new Set([...standardZones, ...uniqueZones]));

    const agentZones = userObj.zonesCollecte || (userObj.zoneCollecte ? [userObj.zoneCollecte] : []);
    const normalizeZone = (z: string | undefined | null) => {
      if (!z) return '';
      return z.toString().toUpperCase().replace('ZONE', '').replace(/\s+/g, '').replace(/_/g, '').trim();
    };
    const normalizedAgentZones = agentZones.map((az: string) => normalizeZone(az));

    // If user is agent commercial, they should only see their assigned zones
    if (userObj.role === 'agent commercial') {
      if (normalizedAgentZones.length > 0) {
        combinedZones = combinedZones.filter(z => normalizedAgentZones.includes(normalizeZone(z)));
      }
    }

    setZonesList(combinedZones.sort());

    allMembers.forEach((m: any) => {
      if (!m || m.isDeleted) return;

      // Filter by agent zones if user is agent commercial
      if (userObj.role === 'agent commercial') {
        const mZoneNormalized = normalizeZone(m.zone);
        if (normalizedAgentZones.length > 0 && !normalizedAgentZones.includes(mZoneNormalized)) {
          return;
        }
      }

      // Fetch the history from cache or localStorage
      const savedHistoryStr = localStorage.getItem(`microfox_history_${m.id}`);
      let history = [];
      const cacheKey = m.id;
      const cached = historyCacheRef.current[cacheKey];
      if (cached && cached.raw === savedHistoryStr) {
        history = cached.data;
      } else {
        if (savedHistoryStr) {
          try {
            history = JSON.parse(savedHistoryStr);
          } catch (err) {
            history = Array.isArray(m.history) ? m.history : [];
          }
        } else {
          history = Array.isArray(m.history) ? m.history : [];
        }
        historyCacheRef.current[cacheKey] = { data: history, raw: savedHistoryStr };
      }

      if (Array.isArray(history)) {
        history.forEach((tx: any) => {
          if (!tx) return;
          // Must be tontine cotisation/depot
          const isTontineCotisation = tx.account === 'tontine' && (tx.type === 'cotisation' || tx.type === 'depot' || tx.type === 'deposit');
          if (!isTontineCotisation) return;

          // Must match the selected date
          if (!isSameDay(tx.date, selectedDate)) return;

          // Resolve account details (like dailyMise)
          const targetAccount = m.tontineAccounts?.find((acc: any) => acc.id === tx.tontineAccountId || acc.number === tx.tontineAccountNumber);
          const dailyMise = targetAccount ? targetAccount.dailyMise : 0;
          const accountNumber = targetAccount ? targetAccount.number : (tx.tontineAccountNumber || 'N/A');

          results.push({
            txId: tx.id,
            clientId: m.id,
            clientName: m.name,
            clientCode: m.code,
            clientPhone: m.phoneNumber || 'N/A',
            clientZone: m.zone || 'N/A',
            accountNumber,
            dailyMise,
            amount: tx.amount,
            date: tx.date,
            cashierName: tx.cashierName || 'N/A'
          });
        });
      }
    });

    // Filtering by zone
    let filteredResults = results;
    if (selectedZone !== 'Toutes les zones' && selectedZone !== 'TOUTES ZONES') {
      filteredResults = results.filter(r => normalizeZone(r.clientZone) === normalizeZone(selectedZone));
    }

    // Sort by date (oldest first for chronological order)
    filteredResults.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    setReportData(filteredResults);
  };

  useEffect(() => {
    loadData();
    window.addEventListener('storage', loadData);
    window.addEventListener('microfox_storage' as any, loadData);
    return () => {
      window.removeEventListener('storage', loadData);
      window.removeEventListener('microfox_storage' as any, loadData);
    };
  }, [selectedDate, selectedZone]);

  // Apply visual search input filter
  const displayedData = reportData.filter((r: any) => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      r.clientName.toLowerCase().includes(term) ||
      r.clientCode.toLowerCase().includes(term) ||
      r.accountNumber.toLowerCase().includes(term) ||
      r.cashierName.toLowerCase().includes(term)
    );
  });

  // Calculate stats
  const totalAmount = displayedData.reduce((sum, r) => sum + r.amount, 0);
  const totalTransactions = displayedData.length;
  const uniqueContributors = new Set(displayedData.map(r => r.clientId)).size;

  const getMFConfig = () => {
    try {
      const activeMf = localStorage.getItem('microfox_current_mf');
      if (activeMf) {
        const mfs = JSON.parse(localStorage.getItem('microfox_institutions') || '[]');
        const current = mfs.find((m: any) => m.code === activeMf);
        if (current) return current;
      }
    } catch (e) {}
    return { nom: 'MicroFox Premium', adresse: '', telephone: '' };
  };

  const generateReportHTML = (isForPrinting: boolean = false) => {
    const mfConfig = getMFConfig();
    const formattedDate = new Date(selectedDate).toLocaleDateString('fr-FR');

    const rowsHtml = displayedData.map((r, idx) => {
      const dateObj = new Date(r.date);
      const timeStr = !isNaN(dateObj.getTime()) 
        ? dateObj.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) 
        : 'N/A';

      return `
        <tr>
          <td style="text-align: center; padding: 6px 8px; border: 1px solid #cbd5e1;">${idx + 1}</td>
          <td style="padding: 6px 8px; border: 1px solid #cbd5e1; font-weight: bold; text-transform: uppercase;">
            ${r.clientName}<br/>
            <span style="font-size: 8px; color: #64748b; font-weight: normal;">Code: ${r.clientCode}</span>
          </td>
          <td style="padding: 6px 8px; border: 1px solid #cbd5e1; text-align: center;">${r.clientPhone}</td>
          <td style="padding: 6px 8px; border: 1px solid #cbd5e1; text-align: center; font-weight: bold; color: #1e3a8a;">${r.clientZone}</td>
          <td style="padding: 6px 8px; border: 1px solid #cbd5e1; text-align: center; font-family: monospace;">${r.accountNumber}</td>
          <td style="padding: 6px 8px; border: 1px solid #cbd5e1; text-align: right;">${Number(r.dailyMise).toLocaleString()} F</td>
          <td style="padding: 6px 8px; border: 1px solid #cbd5e1; text-align: right; font-weight: bold; color: #047857;">${Number(r.amount).toLocaleString()} F</td>
          <td style="padding: 6px 8px; border: 1px solid #cbd5e1; text-align: center;">${timeStr}</td>
          <td style="padding: 6px 8px; border: 1px solid #cbd5e1; font-weight: 500;">${r.cashierName}</td>
        </tr>
      `;
    }).join('');

    return `
      <!DOCTYPE html>
      <html lang="fr">
      <head>
        <meta charset="utf-8">
        <title>Rapport de Tontine du ${formattedDate}</title>
        <style>
          @page {
            size: A4 landscape;
            margin: 10mm;
          }
          body {
            font-family: Arial, sans-serif;
            color: #111827;
            margin: 0;
            padding: 0;
            line-height: 1.3;
            font-size: 10px;
          }
          .header {
            border-bottom: 2px solid #111827;
            padding-bottom: 8px;
            margin-bottom: 15px;
            display: flex;
            justify-content: space-between;
            align-items: flex-end;
          }
          .header-left h1 {
            font-size: 18px;
            margin: 0;
            text-transform: uppercase;
            font-weight: 800;
          }
          .header-left p {
            margin: 2px 0 0 0;
            font-size: 10px;
            color: #4b5563;
          }
          .header-right {
            text-align: right;
          }
          .header-right h2 {
            font-size: 14px;
            margin: 0;
            text-transform: uppercase;
            font-weight: bold;
            color: #1e3a8a;
          }
          .header-right p {
            margin: 2px 0 0 0;
            font-size: 10px;
            color: #374151;
          }
          .summary-banner {
            background-color: #f8fafc;
            border: 1px solid #e2e8f0;
            border-radius: 6px;
            padding: 8px 12px;
            margin-bottom: 15px;
            display: flex;
            justify-content: space-between;
            font-size: 11px;
          }
          .summary-item strong {
            font-size: 12px;
            color: #111827;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            font-size: 9.5px;
          }
          th {
            background-color: #f1f5f9;
            font-weight: bold;
            color: #334155;
            text-transform: uppercase;
            font-size: 9px;
            border: 1px solid #cbd5e1;
            padding: 6px 8px;
            text-align: left;
          }
          tr:nth-child(even) {
            background-color: #f8fafc;
          }
          .footer {
            margin-top: 25px;
            font-size: 8.5px;
            color: #64748b;
            display: flex;
            justify-content: space-between;
            border-top: 1px solid #e2e8f0;
            padding-top: 6px;
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
            <h2>Rapport Journalier des Cotisations Tontine</h2>
            <p>Date : <strong>${formattedDate}</strong> ${selectedZone !== 'Toutes les zones' ? `| Zone : <strong>${selectedZone}</strong>` : ''}</p>
          </div>
        </div>

        <div class="summary-banner">
          <div class="summary-item">Généré le: <strong>${new Date().toLocaleString('fr-FR')}</strong></div>
          <div class="summary-item">Membres Cotisants: <strong>${uniqueContributors}</strong></div>
          <div class="summary-item">Total Écritures: <strong>${totalTransactions}</strong></div>
          <div class="summary-item">Total Collecté: <strong style="color: #047857; font-size: 13px;">${totalAmount.toLocaleString()} FCFA</strong></div>
        </div>

        <table>
          <thead>
            <tr>
              <th style="width: 4%; text-align: center;">N°</th>
              <th style="width: 24%;">Nom Complet & Code</th>
              <th style="width: 11%; text-align: center;">Téléphone</th>
              <th style="width: 8%; text-align: center;">Zone</th>
              <th style="width: 11%; text-align: center;">N° Compte</th>
              <th style="width: 10%; text-align: right;">Mise Jour.</th>
              <th style="width: 12%; text-align: right;">Montant Cotisé</th>
              <th style="width: 9%; text-align: center;">Heure</th>
              <th style="width: 11%;">Enregistré Par</th>
            </tr>
          </thead>
          <tbody>
            ${displayedData.length > 0 ? rowsHtml : '<tr><td colspan="9" style="text-align: center; padding: 25px; color: #64748b; font-style: italic; font-size: 11px;">Aucune cotisation trouvée pour ce jour.</td></tr>'}
          </tbody>
        </table>

        <div class="footer">
          <span>Système de Gestion MicroFoX Premium</span>
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
    if (displayedData.length === 0) {
      alert("Aucune donnée à exporter.");
      return;
    }
    const htmlContent = generateReportHTML(false);
    const blob = new Blob([htmlContent], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Rapport_Tontine_${selectedDate}.html`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const isAdminOrDirector = currentUser?.role === 'administrateur' || currentUser?.role === 'directeur';

  return (
    <div className="space-y-6 pb-12" id="tontine-report-section">
      {/* Header Panel */}
      <div className="bg-[#121c32] rounded-[2.5rem] border border-gray-800 p-6 lg:p-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-emerald-500/20 to-teal-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
            <FileText size={28} />
          </div>
          <div>
            <h1 className="text-xl lg:text-2xl font-black text-white uppercase tracking-tight">Rapport Tontine</h1>
            <p className="text-xs font-bold text-gray-400">Consultez, imprimez et exportez les cotisations de tontine journalières</p>
          </div>
        </div>

        {/* Top-Right Action Buttons */}
        <div className="flex items-center gap-3 w-full md:w-auto">
          <button 
            onClick={handleManualSync}
            disabled={isSyncing}
            className="flex-1 md:flex-none py-3.5 px-5 bg-blue-500/10 hover:bg-blue-500/20 border-2 border-blue-500/30 hover:border-blue-500/50 text-blue-400 hover:text-blue-300 rounded-2xl font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-55"
          >
            <RefreshCw size={16} className={isSyncing ? "animate-spin text-blue-400" : ""} />
            <span>{isSyncing ? "Mise à jour..." : "Synchroniser"}</span>
          </button>
          <button 
            onClick={handlePrint}
            className="flex-1 md:flex-none py-3.5 px-5 bg-white/5 hover:bg-white/10 border-2 border-transparent text-gray-200 hover:text-white rounded-2xl font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer"
          >
            <Printer size={16} />
            <span>Imprimer</span>
          </button>
          <button 
            onClick={handleExport}
            className="flex-1 md:flex-none py-3.5 px-5 bg-emerald-500/10 hover:bg-emerald-500/20 border-2 border-emerald-500/30 hover:border-emerald-500/50 text-emerald-400 hover:text-emerald-300 rounded-2xl font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer"
          >
            <Download size={16} />
            <span>Exporter</span>
          </button>
        </div>
      </div>

      {isFullySynced !== null && (
        <div className="print:hidden">
          {isFullySynced ? (
            <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 p-4 rounded-2xl flex items-center gap-3">
              <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="font-bold text-sm">Tous les éléments sont synchronisés : tout s'affiche.</span>
            </div>
          ) : (
            <div className="bg-amber-500/10 border border-amber-500/30 text-amber-400 p-4 rounded-2xl flex items-center gap-3">
              <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
              <span className="font-bold text-sm">Certains éléments ne sont pas encore prêts (synchronisation en cours ou en attente).</span>
            </div>
          )}
        </div>
      )}

      {/* Filters Area */}
      <div className="bg-[#121c32] rounded-[2.5rem] border border-gray-800 p-6 lg:p-8 space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Date Picker */}
          <div>
            <label className="text-[11px] font-black text-gray-500 uppercase tracking-widest ml-1 flex items-center gap-1.5 mb-2">
              <Calendar size={12} />
              Choisir la date
            </label>
            <input 
              type="date" 
              value={selectedDate} 
              onChange={(e) => setSelectedDate(e.target.value)}
              className="w-full p-4 bg-white/5 border-2 border-transparent focus:border-emerald-500 rounded-2xl font-bold text-white outline-none transition-all text-sm [color-scheme:dark]"
            />
          </div>

          {/* Zone Selector */}
          <div>
            <label className="text-[11px] font-black text-gray-500 uppercase tracking-widest ml-1 flex items-center gap-1.5 mb-2">
              <Filter size={12} />
              Filtrer par Zone
            </label>
            <select 
              value={selectedZone}
              onChange={(e) => setSelectedZone(e.target.value)}
              className="w-full p-4 bg-white/5 border-2 border-transparent focus:border-emerald-500 rounded-2xl font-bold text-white outline-none transition-all text-sm appearance-none"
            >
              <option value="Toutes les zones" className="bg-[#121c32]">TOUTES ZONES</option>
              {zonesList.map((z) => (
                <option key={z} value={z} className="bg-[#121c32]">ZONE {z.toString().toUpperCase().replace('ZONE', '').trim()}</option>
              ))}
            </select>
          </div>

          {/* Search Input Filter */}
          <div>
            <label className="text-[11px] font-black text-gray-500 uppercase tracking-widest ml-1 flex items-center gap-1.5 mb-2">
              <Search size={12} />
              Recherche rapide
            </label>
            <div className="relative">
              <input 
                type="text" 
                placeholder="Rechercher client, code, n° compte..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-12 pr-4 p-4 bg-white/5 border-2 border-transparent focus:border-emerald-500 rounded-2xl font-bold text-white outline-none transition-all text-sm"
              />
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
            </div>
          </div>
        </div>
      </div>

      {/* Summary Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        {/* Contributors count card */}
        <div className="bg-[#121c32] rounded-[2rem] border border-gray-800 p-6 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
            <Users size={22} />
          </div>
          <div>
            <p className="text-[10px] font-black text-gray-500 uppercase tracking-wider">Membres Cotisants</p>
            <p className="text-xl font-black text-white">{uniqueContributors}</p>
          </div>
        </div>

        {/* Writing/Transactions count card */}
        <div className="bg-[#121c32] rounded-[2rem] border border-gray-800 p-6 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
            <ClipboardList size={22} />
          </div>
          <div>
            <p className="text-[10px] font-black text-gray-500 uppercase tracking-wider">Total Écritures</p>
            <p className="text-xl font-black text-white">{totalTransactions}</p>
          </div>
        </div>

        {/* Sum of amounts card */}
        <div className="bg-[#121c32] rounded-[2rem] border border-gray-800 p-6 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
            <Coins size={22} />
          </div>
          <div>
            <p className="text-[10px] font-black text-gray-500 uppercase tracking-wider">Total Collecté</p>
            <p className="text-xl font-black text-emerald-400">{totalAmount.toLocaleString()} FCFA</p>
          </div>
        </div>
      </div>

      {/* Main Table / Mobile List Block */}
      <div className="bg-[#121c32] rounded-[2.5rem] border border-gray-800 overflow-hidden">
        {/* Desktop Table View */}
        <div className="hidden lg:block overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-gray-800 bg-white/5">
                <th className="p-5 font-black text-[10px] text-gray-400 uppercase tracking-wider text-center w-12">N°</th>
                <th className="p-5 font-black text-[10px] text-gray-400 uppercase tracking-wider">Membre & Code</th>
                <th className="p-5 font-black text-[10px] text-gray-400 uppercase tracking-wider text-center">Téléphone</th>
                <th className="p-5 font-black text-[10px] text-gray-400 uppercase tracking-wider text-center">Zone</th>
                <th className="p-5 font-black text-[10px] text-gray-400 uppercase tracking-wider text-center">N° Compte</th>
                <th className="p-5 font-black text-[10px] text-gray-400 uppercase tracking-wider text-right">Mise Jour.</th>
                <th className="p-5 font-black text-[10px] text-gray-400 uppercase tracking-wider text-right">Montant</th>
                <th className="p-5 font-black text-[10px] text-gray-400 uppercase tracking-wider text-center">Heure</th>
                <th className="p-5 font-black text-[10px] text-gray-400 uppercase tracking-wider">Enregistré par</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-850">
              {displayedData.length > 0 ? (
                displayedData.map((row: any, idx: number) => {
                  const dateObj = new Date(row.date);
                  const timeStr = !isNaN(dateObj.getTime()) 
                    ? dateObj.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) 
                    : 'N/A';

                  return (
                    <tr key={row.txId} className="hover:bg-white/2 transition-colors">
                      <td className="p-5 text-center text-xs font-bold text-gray-500">{idx + 1}</td>
                      <td className="p-5">
                        <div className="font-bold text-white text-sm uppercase">{row.clientName}</div>
                        <div className="text-xs font-semibold text-gray-500">{row.clientCode}</div>
                      </td>
                      <td className="p-5 text-center text-xs font-bold text-gray-400">{row.clientPhone}</td>
                      <td className="p-5 text-center">
                        <span className="px-2.5 py-1 bg-blue-500/10 text-blue-400 font-bold text-xs rounded-lg border border-blue-500/20">
                          {row.clientZone}
                        </span>
                      </td>
                      <td className="p-5 text-center text-xs font-mono font-bold text-gray-300">{row.accountNumber}</td>
                      <td className="p-5 text-right text-xs font-bold text-gray-300">{Number(row.dailyMise).toLocaleString()} F</td>
                      <td className="p-5 text-right text-sm font-black text-emerald-400">{Number(row.amount).toLocaleString()} F</td>
                      <td className="p-5 text-center text-xs font-bold text-gray-400">{timeStr}</td>
                      <td className="p-5 text-xs font-semibold text-white">{row.cashierName}</td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={9} className="p-12 text-center text-sm font-medium text-gray-500 italic">
                    Aucune cotisation de tontine trouvée pour ce jour.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile Grid/List View */}
        <div className="block lg:hidden divide-y divide-gray-850 p-4 space-y-4">
          {displayedData.length > 0 ? (
            displayedData.map((row: any, idx: number) => {
              const dateObj = new Date(row.date);
              const timeStr = !isNaN(dateObj.getTime()) 
                ? dateObj.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) 
                : 'N/A';

              return (
                <div key={row.txId} className="bg-white/5 border border-gray-800 rounded-3xl p-5 space-y-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="text-[10px] font-black text-gray-500 uppercase tracking-widest">{idx + 1}. Client</div>
                      <div className="font-bold text-white text-base uppercase leading-tight mt-1">{row.clientName}</div>
                      <div className="text-xs font-bold text-emerald-400/80 mt-0.5">{row.clientCode}</div>
                    </div>
                    <span className="px-3 py-1 bg-blue-500/10 text-blue-400 font-bold text-xs rounded-lg border border-blue-500/15">
                      {row.clientZone}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-4 pt-2 border-t border-gray-800/60 text-xs">
                    <div>
                      <span className="block text-[10px] font-black text-gray-500 uppercase">Téléphone</span>
                      <span className="font-bold text-gray-300 mt-1 block">{row.clientPhone}</span>
                    </div>
                    <div>
                      <span className="block text-[10px] font-black text-gray-500 uppercase">Compte</span>
                      <span className="font-bold text-gray-300 mt-1 block font-mono">{row.accountNumber}</span>
                    </div>
                    <div>
                      <span className="block text-[10px] font-black text-gray-500 uppercase">Mise Jour.</span>
                      <span className="font-bold text-gray-300 mt-1 block">{Number(row.dailyMise).toLocaleString()} F</span>
                    </div>
                    <div>
                      <span className="block text-[10px] font-black text-gray-500 uppercase">Heure</span>
                      <span className="font-bold text-gray-300 mt-1 block">{timeStr}</span>
                    </div>
                  </div>

                  <div className="flex justify-between items-center pt-3 border-t border-gray-800/60">
                    <div>
                      <span className="block text-[10px] font-black text-gray-500 uppercase">Enregistré par</span>
                      <span className="text-xs font-bold text-white mt-1 block">{row.cashierName}</span>
                    </div>
                    <div className="text-right">
                      <span className="block text-[10px] font-black text-emerald-400/60 uppercase">Montant</span>
                      <span className="text-lg font-black text-emerald-400 mt-0.5 block">{Number(row.amount).toLocaleString()} F</span>
                    </div>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="p-10 text-center text-sm font-medium text-gray-500 italic">
              Aucune cotisation de tontine trouvée pour ce jour.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TontineReport;
