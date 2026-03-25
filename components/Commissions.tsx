import React, { useState, useEffect } from 'react';
import { Cloud, Search, BarChart3, Calendar, Coins, TrendingUp, User, ChevronDown, Download, Printer, Navigation } from 'lucide-react';

const Commissions: React.FC = () => {
  // Initialisation des dates sur le mois en cours pour assurer l'affichage immédiat des données
  const getInitialDates = () => {
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    const formatDate = (date: Date) => {
      const y = date.getFullYear();
      const m = String(date.getMonth() + 1).padStart(2, '0');
      const d = String(date.getDate()).padStart(2, '0');
      return `${y}-${m}-${d}`;
    };
    return { start: formatDate(firstDay), end: formatDate(lastDay) };
  };

  const dates = getInitialDates();
  const [startDate, setStartDate] = useState(dates.start);
  const [endDate, setEndDate] = useState(dates.end);
  const [searchTerm, setSearchTerm] = useState('');
  const currentUser = JSON.parse(localStorage.getItem('microfox_current_user') || '{}');
  const [selectedZone, setSelectedZone] = useState(currentUser?.role === 'agent commercial' ? (currentUser?.zonesCollecte?.[0] || currentUser?.zoneCollecte || '') : '');
  
  const agentZones = currentUser?.zonesCollecte || (currentUser?.zoneCollecte ? [currentUser.zoneCollecte] : []);
  const zones = currentUser?.role === 'agent commercial' ? agentZones : ['01','01A','02','02A','03','03A','04','04A','05','05A','06','06A','07','07A','08','08A','09','09A'];
  
  const [stats, setStats] = useState({
    totalCommissions: 0,
    cyclesEntames: 0,
    list: [] as any[]
  });

  const calculateCommissions = () => {
    const savedMembers = localStorage.getItem('microfox_members_data');
    if (savedMembers) {
      const allMembers = JSON.parse(savedMembers);
      let totalComm = 0;
      let totalCyc = 0;
      const commissionList: any[] = [];

      allMembers.forEach((member: any) => {
        if (!member.tontineAccounts || member.tontineAccounts.length === 0) return;

        member.tontineAccounts.forEach((acc: any) => {
          const dailyMise = Number(acc.dailyMise) || 500;
          if (dailyMise <= 0) return;

          // Récupération des transactions tontine pour cet utilisateur et ce compte
          const tontineTxs = (member.history || [])
            .filter((t: any) => t.account === 'tontine' && (t.type === 'cotisation' || t.type === 'depot') && (t.tontineAccountId === acc.id || !t.tontineAccountId))
            .sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime());

          const accountWithdrawals = (member.history || [])
            .filter((h: any) => h.account === 'tontine' && (h.tontineAccountId === acc.id || !h.tontineAccountId) && h.type === 'retrait')
            .sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime());

          if (tontineTxs.length === 0) return;

          let currentCycleFirstDepositDate: Date | null = null;
          let currentCycleCases = 0;
          let cycleIdx = 1;

          const recordCommissionIfInRange = (triggerDate: Date, idx: number, agentName: string) => {
            const y = triggerDate.getFullYear();
            const m = String(triggerDate.getMonth() + 1).padStart(2, '0');
            const d = String(triggerDate.getDate()).padStart(2, '0');
            const dateStr = `${y}-${m}-${d}`;

            if (dateStr >= startDate && dateStr <= endDate) {
              totalComm += dailyMise;
              totalCyc++;
              commissionList.push({
                id: member.id + acc.id + idx + triggerDate.getTime() + Math.random(),
                name: member.name,
                code: member.code,
                accountNumber: acc.number,
                cycle: idx,
                date: dateStr,
                amount: dailyMise,
                mise: dailyMise,
                agent: agentName,
                zone: acc.zone || member.zone || 'N/A'
              });
            }
          };

          for (const tx of tontineTxs) {
            const txDate = new Date(tx.date);
            let remainingAmount = tx.amount;
            
            const agentParts = tx.description.split(' - Agent ');
            const currentAgent = agentParts.length > 1 ? `Agent ${agentParts[1]}` : 'Agent J04';

            while (remainingAmount > 0) {
              // Nouveau cycle temporel (début de tontine)
              if (currentCycleFirstDepositDate === null) {
                currentCycleFirstDepositDate = txDate;
                recordCommissionIfInRange(txDate, cycleIdx, currentAgent);
              }

              const cycleEndDateLimit = new Date(currentCycleFirstDepositDate.getTime() + (31 * 24 * 60 * 60 * 1000));

              // Vérifier s'il y a eu un retrait entre le début du cycle et cette transaction
              const withdrawalDuringCycle = accountWithdrawals.find((w: any) => {
                const wDate = new Date(w.date);
                return wDate >= currentCycleFirstDepositDate! && wDate < txDate;
              });

              // Le cycle temporel est dépassé par la date de la transaction ou un retrait a eu lieu
              if (txDate >= cycleEndDateLimit || withdrawalDuringCycle) {
                cycleIdx++;
                currentCycleFirstDepositDate = txDate;
                currentCycleCases = 0;
                recordCommissionIfInRange(txDate, cycleIdx, currentAgent);
                continue;
              }

              let casesToAdd = Math.floor(remainingAmount / dailyMise);
              let space = 31 - currentCycleCases;
              if (space <= 0) space = 31;

              // La transaction complète un cycle de 31 cases
              if (casesToAdd >= space) {
                const amountUsed = space * dailyMise;
                remainingAmount -= amountUsed;
                currentCycleCases = 0;
                cycleIdx++;
                // Si il reste de l'argent, cela déclenche un nouveau cycle immédiat
                currentCycleFirstDepositDate = remainingAmount > 0 ? txDate : null;
                if (remainingAmount > 0) recordCommissionIfInRange(txDate, cycleIdx, currentAgent);
              } else {
                // Reste d'argent ne complétant pas un cycle
                currentCycleCases += casesToAdd;
                remainingAmount = 0;
              }
            }
          }
        });
      });
      
      setStats({ 
        totalCommissions: totalComm, 
        cyclesEntames: totalCyc, 
        list: commissionList.sort((a, b) => b.date.localeCompare(a.date)) 
      });
    }
  };

  const generateHTMLContent = (isForPrint = false) => {
    if (filteredList.length === 0) return null;
    const mfConfig = JSON.parse(localStorage.getItem('microfox_mf_config') || '{"nom": "MicroFoX", "adresse": "", "code": ""}');
    const headers = ["Date", "Client", "Code", "Compte", "Zone", "Cycle", "Mise", "Montant Commission", "Agent de collecte"];
    
    const htmlContent = `
      <!DOCTYPE html>
      <html lang="fr">
      <head>
        <meta charset="UTF-8">
        <title>Export Commissions - ${mfConfig.nom}</title>
        <style>
          body { font-family: sans-serif; padding: 20px; color: #121c32; }
          .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #121c32; padding-bottom: 10px; }
          .mf-name { font-size: 24px; font-weight: 900; text-transform: uppercase; margin: 0; }
          .mf-address { font-size: 12px; font-weight: bold; color: #666; margin: 5px 0; }
          h2 { color: #00c896; margin-top: 20px; text-transform: uppercase; }
          table { width: 100%; border-collapse: collapse; margin-top: 20px; }
          th { background-color: #121c32; color: white; text-align: left; padding: 12px 8px; font-size: 11px; text-transform: uppercase; }
          td { border-bottom: 1px solid #eee; padding: 10px 8px; font-size: 13px; }
          tr:nth-child(even) { background-color: #f9fafb; }
          .summary { margin-bottom: 20px; font-weight: bold; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1 class="mf-name">${mfConfig.nom}</h1>
          <p class="mf-address">${mfConfig.adresse}</p>
          <p class="mf-address">Tél: ${mfConfig.telephone || 'N/A'} | Code: ${mfConfig.code}</p>
        </div>
        <h2>Rapport de Commissions Tontine</h2>
        <div class="summary">
          <p>Période : Du ${startDate} au ${endDate}</p>
          ${selectedZone ? `<p>Zone : ${selectedZone}</p>` : ''}
          <p>Total : ${displayTotal.toLocaleString()} FCFA (${displayCycles} prélèvements)</p>
        </div>
        <table>
          <thead>
            <tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr>
          </thead>
          <tbody>
            ${filteredList.map(item => `
              <tr>
                <td>${item.date}</td>
                <td>${item.name}</td>
                <td>${item.code}</td>
                <td>${item.accountNumber}</td>
                <td>${item.zone}</td>
                <td>${item.cycle}</td>
                <td>${item.mise.toLocaleString()} F</td>
                <td>${item.amount.toLocaleString()} F</td>
                <td>${item.agent}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
        ${isForPrint ? '<script>window.print();</script>' : ''}
      </body>
      </html>
    `;
    return htmlContent;
  };

  const handleExport = () => {
    const htmlContent = generateHTMLContent();
    if (!htmlContent) return alert("Aucune donnée à exporter.");
    const blob = new Blob([htmlContent], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `commissions_${startDate}_au_${endDate}.html`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handlePrint = () => {
    const htmlContent = generateHTMLContent(true);
    if (!htmlContent) return alert("Aucune donnée à imprimer.");
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(htmlContent);
      printWindow.document.close();
    }
  };

  useEffect(() => {
    calculateCommissions();
    window.addEventListener('storage', calculateCommissions);
    return () => window.removeEventListener('storage', calculateCommissions);
  }, [startDate, endDate, selectedZone]);

  const filteredList = stats.list.filter(item => {
    const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
      (item.accountNumber && item.accountNumber.toLowerCase().includes(searchTerm.toLowerCase())) ||
      item.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (item.agent && item.agent.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesZone = currentUser?.role === 'agent commercial' 
      ? (selectedZone !== '' && item.zone === selectedZone)
      : (selectedZone === '' || item.zone === selectedZone);
    
    return matchesSearch && matchesZone;
  });

  const displayTotal = filteredList.reduce((acc, curr) => acc + curr.amount, 0);
  const displayCycles = filteredList.length;

  return (
    <div className="max-w-md mx-auto space-y-6 sm:space-y-8 pb-12 px-2">
      <div className="space-y-1 pt-4">
        <h1 className="text-3xl sm:text-[40px] font-extrabold text-[#121c32] tracking-tight leading-tight">
          Commissions<br />Tontine
        </h1>
        <p className="text-gray-500 font-medium text-xs sm:text-sm leading-relaxed max-w-[280px]">
          Revenus détaillés par prélèvement de cycle
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:gap-4">
        <div className="space-y-1 sm:space-y-2">
          <label className="text-[9px] sm:text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] ml-1">Du</label>
          <div className="relative group">
            <input 
              type="date" 
              value={startDate} 
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full pl-9 sm:pl-12 pr-6 sm:pr-10 py-3 sm:py-4 bg-white border border-gray-100 rounded-[1.2rem] sm:rounded-[1.5rem] text-xs sm:text-sm font-bold text-[#121c32] outline-none shadow-sm appearance-none cursor-pointer"
            />
            <Calendar className="absolute left-3 sm:left-4 top-1/2 -translate-y-1/2 text-emerald-500" size={16} />
            <ChevronDown className="absolute right-3 sm:right-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={14} />
          </div>
        </div>
        <div className="space-y-1 sm:space-y-2">
          <label className="text-[9px] sm:text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] ml-1">Au</label>
          <div className="relative group">
            <input 
              type="date" 
              value={endDate} 
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full pl-9 sm:pl-12 pr-6 sm:pr-10 py-3 sm:py-4 bg-white border border-gray-100 rounded-[1.2rem] sm:rounded-[1.5rem] text-xs sm:text-sm font-bold text-[#121c32] outline-none shadow-sm appearance-none cursor-pointer"
            />
            <Calendar className="absolute left-3 sm:left-4 top-1/2 -translate-y-1/2 text-emerald-500" size={16} />
            <ChevronDown className="absolute right-3 sm:right-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={14} />
          </div>
        </div>
      </div>

      <div className="space-y-1 sm:space-y-2">
        <label className="text-[9px] sm:text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] ml-1">Zone de collecte</label>
        <div className="relative group">
          <select 
            value={selectedZone} 
            onChange={(e) => setSelectedZone(e.target.value)}
            disabled={currentUser?.role === 'agent commercial'}
            className={`w-full pl-9 sm:pl-12 pr-6 sm:pr-10 py-3 sm:py-4 bg-white border border-gray-100 rounded-[1.2rem] sm:rounded-[1.5rem] text-xs sm:text-sm font-bold text-[#121c32] outline-none shadow-sm appearance-none cursor-pointer ${currentUser?.role === 'agent commercial' ? 'opacity-70 cursor-not-allowed' : ''}`}
          >
            <option value="">Toutes les zones</option>
            {zones.map(z => <option key={z} value={z}>{z}</option>)}
          </select>
          <Navigation className="absolute left-3 sm:left-4 top-1/2 -translate-y-1/2 text-blue-500" size={16} />
          <ChevronDown className="absolute right-3 sm:right-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={14} />
        </div>
      </div>

      <div className="flex justify-end gap-2 px-1">
        <button 
          onClick={handleExport}
          className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-100 rounded-xl text-[10px] font-black text-gray-400 hover:text-emerald-500 transition-all shadow-sm active:scale-95 uppercase tracking-widest"
        >
          <Download size={14} /> Exporter
        </button>
        <button 
          onClick={handlePrint}
          className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-100 rounded-xl text-[10px] font-black text-gray-400 hover:text-blue-500 transition-all shadow-sm active:scale-95 uppercase tracking-widest"
        >
          <Printer size={14} /> Imprimer
        </button>
      </div>

      <div className="bg-[#121c32] rounded-[2rem] sm:rounded-[2.5rem] p-6 sm:p-10 text-white relative overflow-hidden shadow-2xl">
        <div className="relative z-10">
          <p className="text-[9px] sm:text-[10px] font-bold uppercase tracking-[0.2em] text-gray-400 mb-4 sm:mb-6">
            TOTAL COMMISSIONS PRÉLEVÉES {selectedZone ? `(ZONE ${selectedZone})` : ''}
          </p>
          <div className="flex items-baseline gap-2 sm:gap-3 mb-6 sm:mb-10">
            <span className="text-5xl sm:text-[80px] font-black text-amber-400 leading-none">{displayTotal.toLocaleString()}</span>
            <span className="text-xl sm:text-3xl font-black text-amber-400">FCFA</span>
          </div>
          
          <div className="flex items-center gap-2 sm:gap-3 text-emerald-400 font-bold">
            <TrendingUp size={20} className="sm:w-6 sm:h-6" />
            <span className="text-sm sm:text-lg">{displayCycles} prélèvements effectués</span>
          </div>
        </div>

        <div className="absolute top-1/2 right-4 sm:right-6 -translate-y-1/2 w-24 h-24 sm:w-32 sm:h-32 bg-white/5 rounded-full flex items-center justify-center">
          <BarChart3 size={40} className="sm:w-[50px] sm:h-[50px] text-white opacity-20" />
        </div>
      </div>

      <div className="space-y-6">
        <div className="relative">
          <Search className="absolute left-5 sm:left-6 top-1/2 -translate-y-1/2 text-gray-400 sm:w-7 sm:h-7" size={24} />
          <input 
            type="text" 
            placeholder="Rechercher un agent ou client" 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-14 sm:pl-16 pr-6 sm:pr-8 py-5 sm:py-7 bg-[#121c32] text-white rounded-[1.5rem] sm:rounded-[2rem] font-medium outline-none placeholder:text-gray-500 shadow-xl text-lg sm:text-xl"
          />
        </div>

        <div className="space-y-4">
          {filteredList.length > 0 ? (
            filteredList.map((item) => (
              <div key={item.id} className="bg-white p-4 sm:p-6 rounded-[1.5rem] sm:rounded-[2rem] border border-gray-100 shadow-sm flex items-center justify-between transition-all hover:shadow-md">
                <div className="flex items-center gap-3 sm:gap-4 min-w-0 flex-1">
                  <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-600 font-black text-xs sm:text-sm shrink-0">
                    {item.name.split(' ').map((n: string) => n[0]).join('')}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm sm:text-base font-black text-[#121c32] uppercase truncate">{item.name}</p>
                    <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 mt-1">
                       <span className="text-[9px] sm:text-[10px] font-bold text-gray-400 uppercase tracking-wider">{item.date}</span>
                       <span className="text-[8px] sm:text-[10px] font-black text-emerald-600 bg-emerald-50 px-1.5 sm:px-2 py-0.5 rounded-md border border-emerald-100/50 uppercase">
                         {item.accountNumber}
                       </span>
                       <span className="text-[8px] sm:text-[10px] font-black text-amber-600 bg-amber-50 px-1.5 sm:px-2 py-0.5 rounded-md border border-amber-100/50 uppercase">
                         CYCLE {item.cycle}
                       </span>
                       <span className="text-[8px] sm:text-[10px] font-black text-blue-600 bg-blue-50 px-1.5 sm:px-2 py-0.5 rounded-md border border-blue-100/50 uppercase">
                         ZONE {item.zone}
                       </span>
                    </div>
                  </div>
                </div>
                <div className="text-right shrink-0 ml-2">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-tight">Mise: {item.mise.toLocaleString()} F</p>
                  <p className="text-lg sm:text-xl font-black text-[#121c32]">Comm: {item.amount.toLocaleString()} F</p>
                  <p className="text-[8px] sm:text-[9px] font-bold text-gray-400 uppercase tracking-[0.1em]">{item.agent}</p>
                </div>
              </div>
            ))
          ) : (
            <div className="py-16 sm:py-20 text-center">
              <p className="text-xl sm:text-2xl font-medium text-gray-400 italic">
                Aucun prélèvement trouvé<br />pour cette période.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Commissions;