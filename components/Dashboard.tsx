import React, { useState, useEffect } from 'react';
import { 
  Users, 
  Landmark, 
  CreditCard, 
  Gem, 
  Scale, 
  ShieldCheck, 
  Sparkles,
  Cloud,
  ChevronRight,
  Loader2,
  Package
} from 'lucide-react';
import { GoogleGenAI } from "@google/genai";

const Dashboard: React.FC = () => {
  const [startDate, setStartDate] = useState<string>(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState<string>(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
  });

  const getBalanceAtDate = (history: any[], account: string, date: Date) => {
    return history.reduce((sum, tx) => {
      const txDate = new Date(tx.date);
      if (txDate > date) return sum;
      
      // Exclure les ventes de livrets des soldes de dépôts réguliers
      const desc = (tx.description || '').toLowerCase();
      if (desc.includes('vente de livret')) return sum;

      if (tx.account === account) {
        if (tx.type === 'depot' || tx.type === 'cotisation' || tx.type === 'deblocage') return sum + tx.amount;
        if (tx.type === 'retrait' || tx.type === 'remboursement' || tx.type === 'transfert') return sum - tx.amount;
      }
      if (tx.destinationAccount === account && tx.type === 'transfert') return sum + tx.amount;
      return sum;
    }, 0);
  };

  const getBookletSalesAtDate = (history: any[], type: 'Tontine' | 'Épargne', date: Date) => {
    return history.reduce((sum, tx) => {
      const txDate = new Date(tx.date);
      if (txDate > date) return sum;
      const desc = (tx.description || '').toLowerCase();
      if (desc.includes('vente de livret') && desc.includes(type.toLowerCase())) {
        return sum + tx.amount;
      }
      return sum;
    }, 0);
  };

  const calculateNetTontine = (clients: any[], atDate: Date = new Date()) => {
    return clients.reduce((acc, c) => {
      const grossTontine = getBalanceAtDate(c.history || [], 'tontine', atDate);
      if (grossTontine <= 0) return acc;

      const accountHistory = (c.history || [])
        .filter((h: any) => h.account === 'tontine' && h.type === 'cotisation' && new Date(h.date) <= atDate && !h.description?.toLowerCase().includes('livret'))
        .sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime());

      const accountWithdrawals = (c.history || [])
        .filter((h: any) => h.account === 'tontine' && h.type === 'retrait' && new Date(h.date) <= atDate)
        .sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime());

      if (accountHistory.length === 0) return acc;

      const dailyMise = Number(c.tontineAccounts?.[0]?.dailyMise) || 500;
      if (dailyMise <= 0) return acc;

      const accountWithdrawalsAmount = accountWithdrawals.reduce((sum, h) => sum + h.amount, 0);
      let remainingWithdrawals = accountWithdrawalsAmount;
      let totalDecaissable = 0;
      let totalComm = 0;

      let currentCycleFirstDepositDate: Date | null = null;
      let currentCycleCases = 0;
      let currentCycleAmount = 0;
      let cycleIdx = 1;

      for (const tx of accountHistory) {
        const txDate = new Date(tx.date);
        let remainingAmount = Number(tx.amount);

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
            const comm = currentCycleAmount > 0 ? Number(dailyMise) : 0;
            const netCycleAmount = Math.max(0, currentCycleAmount - comm);
            totalComm += comm;
            
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

          const amountToCompleteCycle = (31 * Number(dailyMise)) - currentCycleAmount;
          const oldCases = currentCycleCases;

          if (remainingAmount >= amountToCompleteCycle) {
            currentCycleAmount = Number(currentCycleAmount) + amountToCompleteCycle;
            currentCycleCases = 31;
            remainingAmount -= amountToCompleteCycle;
            
            const comm = currentCycleAmount > 0 ? Number(dailyMise) : 0;
            const netCycleAmount = Math.max(0, currentCycleAmount - comm);
            totalComm += comm;
            
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
            currentCycleAmount = Number(currentCycleAmount) + remainingAmount;
            currentCycleCases = Math.floor(currentCycleAmount / Number(dailyMise));
            remainingAmount = 0;
          }
        }
      }

      if (currentCycleFirstDepositDate) {
        const comm = currentCycleAmount > 0 ? Math.min(currentCycleAmount, dailyMise) : 0;
        const netCycleAmount = Math.max(0, currentCycleAmount - comm);
        totalComm += comm;
        
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
      }

      acc.netBalance += totalDecaissable;
      acc.totalCommissions += totalComm;
      return acc;
    }, { netBalance: 0, totalCommissions: 0 });
  };

  const [stats, setStats] = useState(() => {
    const saved = localStorage.getItem('microfox_members_data');
    let clients: any[] = [];
    try {
      clients = saved ? JSON.parse(saved) : [];
      if (!Array.isArray(clients)) clients = [];
    } catch (e) {
      console.error("Error parsing members data:", e);
      clients = [];
    }

    const savedUser = localStorage.getItem('microfox_current_user');
    const user = savedUser ? JSON.parse(savedUser) : {};
    
    if (user.role === 'agent commercial') {
      const agentZones = user.zonesCollecte || (user.zoneCollecte ? [user.zoneCollecte] : []);
      if (agentZones.length > 0) {
        clients = clients.filter((c: any) => agentZones.includes(c.zone));
      }
    }

    const targetDate = new Date();
    
    const totalEpargne = clients.reduce((acc: number, c: any) => acc + getBalanceAtDate(c.history || [], 'epargne', targetDate), 0);
    const tontineData = calculateNetTontine(clients, targetDate);
    const totalTontineNet = tontineData.netBalance;
    const totalTontineCommission = tontineData.totalCommissions;
    const totalCredit = clients.reduce((acc: number, c: any) => acc + getBalanceAtDate(c.history || [], 'credit', targetDate), 0);
    const totalPartSociale = clients.reduce((acc: number, c: any) => acc + getBalanceAtDate(c.history || [], 'partSociale', targetDate), 0);
    const totalGarantie = clients.reduce((acc: number, c: any) => acc + getBalanceAtDate(c.history || [], 'garantie', targetDate), 0);
    const totalFrais = clients.reduce((acc: number, c: any) => acc + getBalanceAtDate(c.history || [], 'frais', targetDate), 0);
    
    // Calculer les ventes de livrets séparément
    const totalVentesTontine = clients.reduce((acc: number, c: any) => acc + getBookletSalesAtDate(c.history || [], 'Tontine', targetDate), 0);
    const totalVentesEpargne = clients.reduce((acc: number, c: any) => acc + getBookletSalesAtDate(c.history || [], 'Épargne', targetDate), 0);

    // Les ressources totales sont la somme de tous les comptes qui ont reçu de l'argent
    // Note: Les ventes de livrets et commissions sont déjà incluses dans les soldes des comptes (frais, epargne ou tontine)
    const deposits = totalEpargne + totalTontineNet + totalTontineCommission + totalPartSociale + totalGarantie + totalFrais;
    
    const liquidite = (totalEpargne + totalTontineNet) > 0 ? (totalCredit / (totalEpargne + totalTontineNet)) * 100 : 0;
    const solvabilite = totalCredit > 0 ? (totalPartSociale / totalCredit) * 100 : 0;

    return {
      membresActifs: clients.length,
      tontiniers: clients.filter((c: any) => (c.tontineAccounts?.length || 0) > 0).length,
      epargnants: clients.filter((c: any) => (c.balances?.epargne || 0) > 0).length,
      nouveauxTontiniers: 0,
      nouveauxEpargnants: 0,
      encoursDepots: deposits,
      epargneVue: totalEpargne,
      tontineStables: totalTontineNet,
      tontineCommission: totalTontineCommission,
      ventesLivretsTontine: totalVentesTontine,
      ventesLivretsEpargne: totalVentesEpargne,
      fraisAdhesion: totalFrais,
      garanties: totalGarantie,
      encoursCredits: totalCredit,
      par: 0.00,
      creancesSouffrance: 0,
      solvabilite: solvabilite,
      liquidite: liquidite,
      capitalSocial: totalPartSociale
    };
  });

  const [aiAnalysis, setAiAnalysis] = useState<string>("Analyse des indicateurs en cours...");
  const [isLoadingAi, setIsLoadingAi] = useState<boolean>(true);
  const [agentStocks, setAgentStocks] = useState({ epargne: 0, tontine: 0 });
  const [centralStocks, setCentralStocks] = useState({ epargne: 0, tontine: 0 });
  const [currentUser, setCurrentUser] = useState<any>(null);

  const calculateAgentStocks = () => {
    const savedUser = localStorage.getItem('microfox_current_user');
    if (!savedUser) return;
    const user = JSON.parse(savedUser);
    setCurrentUser(user);
    
    const savedStocks = localStorage.getItem('microfox_livrets_stocks');
    const stocks = savedStocks ? JSON.parse(savedStocks) : { central: { epargne: 0, tontine: 0 }, distributions: [] };
    setCentralStocks(stocks.central || { epargne: 0, tontine: 0 });

    if (user.role !== 'agent commercial' && user.role !== 'caissier') return;
    
    const agentName = user.identifiant || "Inconnu";
    const savedMembers = localStorage.getItem('microfox_members_data');
    const membersData = savedMembers ? JSON.parse(savedMembers) : [];
    
    let epargne = 0;
    let tontine = 0;

    (stocks.distributions || []).forEach((d: any) => {
      if ((d.recipient || '').trim().toLowerCase() === agentName.trim().toLowerCase()) {
        if (d.type === 'epargne') epargne += d.quantity;
        else tontine += d.quantity;
      }
    });

    membersData.forEach((m: any) => {
      (m.history || []).forEach((tx: any) => {
        const desc = (tx.description || '').toLowerCase();
        if (desc.includes(`vente de livret`) && 
            desc.includes(`- agent ${agentName.trim().toLowerCase()}`)) {
          if (desc.includes('épargne')) epargne -= 1;
          else if (desc.includes('tontine')) tontine -= 1;
        }
      });
    });

    setAgentStocks({ epargne, tontine });
  };

  const syncStats = () => {
    calculateAgentStocks();
    const saved = localStorage.getItem('microfox_members_data');
    let allClients: any[] = [];
    try {
      allClients = saved ? JSON.parse(saved) : [];
      if (!Array.isArray(allClients)) allClients = [];
    } catch (e) {
      console.error("Error parsing members data during sync:", e);
      allClients = [];
    }
    const start = startDate ? new Date(startDate) : new Date(0);
    const end = endDate ? new Date(endDate) : new Date();
    const targetDate = end;
    
    const isPeriodDefined = !!(startDate && endDate);

    const savedUser = localStorage.getItem('microfox_current_user');
    const user = savedUser ? JSON.parse(savedUser) : {};
    
    let filteredAllClients = allClients;
    if (user.role === 'agent commercial') {
      const agentZones = user.zonesCollecte || (user.zoneCollecte ? [user.zoneCollecte] : []);
      if (agentZones.length > 0) {
        filteredAllClients = allClients.filter((c: any) => agentZones.includes(c.zone));
      }
    }

    const clients = filteredAllClients.filter((c: any) => {
      const history = c.history || [];
      if (history.length === 0) return true;
      const firstTxDate = new Date(Math.min(...history.map((h: any) => new Date(h.date).getTime())));
      return firstTxDate <= targetDate;
    });

    const tontiniers = clients.filter((c: any) => c.tontineAccounts && c.tontineAccounts.length > 0);
    const epargnants = clients.filter((c: any) => c.epargneAccountNumber);
    const membresActifs = clients.filter((c: any) => (c.tontineAccounts && c.tontineAccounts.length > 0) || c.epargneAccountNumber);

    const totalEpargne = clients.reduce((acc: number, c: any) => acc + getBalanceAtDate(c.history || [], 'epargne', targetDate), 0);
    const tontineData = calculateNetTontine(clients, targetDate);
    const totalTontineNet = tontineData.netBalance;
    const totalTontineCommission = tontineData.totalCommissions;
    const totalCredit = clients.reduce((acc: number, c: any) => acc + getBalanceAtDate(c.history || [], 'credit', targetDate), 0);
    const totalPartSociale = clients.reduce((acc: number, c: any) => acc + getBalanceAtDate(c.history || [], 'partSociale', targetDate), 0);
    const totalGarantie = clients.reduce((acc: number, c: any) => acc + getBalanceAtDate(c.history || [], 'garantie', targetDate), 0);
    const totalFrais = clients.reduce((acc: number, c: any) => acc + getBalanceAtDate(c.history || [], 'frais', targetDate), 0);
    
    const totalVentesTontine = clients.reduce((acc: number, c: any) => acc + getBookletSalesAtDate(c.history || [], 'Tontine', targetDate), 0);
    const totalVentesEpargne = clients.reduce((acc: number, c: any) => acc + getBookletSalesAtDate(c.history || [], 'Épargne', targetDate), 0);

    const deposits = totalEpargne + totalTontineNet + totalTontineCommission + totalPartSociale + totalGarantie + totalFrais;
    const liquidite = (totalEpargne + totalTontineNet) > 0 ? (totalCredit / (totalEpargne + totalTontineNet)) * 100 : 0;
    const solvabilite = totalCredit > 0 ? (totalPartSociale / totalCredit) * 100 : 0;

    setStats({
      membresActifs: membresActifs.length,
      tontiniers: tontiniers.length,
      epargnants: epargnants.length,
      nouveauxTontiniers: allClients.filter((c: any) => {
        const tontineHistory = (c.history || []).filter((h: any) => h.account === 'tontine');
        if (tontineHistory.length === 0) return false;
        const firstTxDate = new Date(Math.min(...tontineHistory.map((h: any) => new Date(h.date).getTime())));
        return firstTxDate >= start && firstTxDate <= end;
      }).length,
      nouveauxEpargnants: allClients.filter((c: any) => {
        const epargneHistory = (c.history || []).filter((h: any) => h.account === 'epargne');
        if (epargneHistory.length === 0) return false;
        const firstTxDate = new Date(Math.min(...epargneHistory.map((h: any) => new Date(h.date).getTime())));
        return firstTxDate >= start && firstTxDate <= end;
      }).length,
      encoursDepots: deposits,
      epargneVue: totalEpargne,
      tontineStables: totalTontineNet,
      tontineCommission: totalTontineCommission,
      ventesLivretsTontine: totalVentesTontine,
      ventesLivretsEpargne: totalVentesEpargne,
      fraisAdhesion: totalFrais,
      garanties: totalGarantie,
      encoursCredits: totalCredit,
      par: 0.00,
      creancesSouffrance: 0,
      solvabilite: solvabilite,
      liquidite: liquidite,
      capitalSocial: totalPartSociale
    });
  };

  useEffect(() => {
    syncStats();
  }, [startDate, endDate]);

  useEffect(() => {
    window.addEventListener('storage', syncStats);
    return () => window.removeEventListener('storage', syncStats);
  }, []);

  useEffect(() => {
    const generateAiAdvice = async () => {
      setIsLoadingAi(true);
      try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        const response = await ai.models.generateContent({
          model: 'gemini-3-flash-preview',
          contents: `Analyse ces indicateurs de microfinance (SFD Togo, normes UMOA) ${startDate && endDate ? `pour la période du ${startDate} au ${endDate}` : `au ${new Date().toLocaleDateString()}`} :
            - Membres: ${stats.membresActifs}
            - Dépôts: ${stats.encoursDepots} F
            - Crédits: ${stats.encoursCredits} F
            - PAR: ${stats.par}%
            - Solvabilité: ${stats.solvabilite}%
            - Liquidité: ${stats.liquidite}%
            Donne une analyse très brève (max 15 mots) et un conseil direct.`,
          config: {
            systemInstruction: "Tu es un expert en réglementation bancaire SFD/UMOA. Ton ton est institutionnel, bref et précis."
          }
        });
        setAiAnalysis(response.text || "Analyse indisponible.");
      } catch (error) {
        setAiAnalysis("Erreur lors de la génération de l'analyse.");
      } finally {
        setIsLoadingAi(false);
      }
    };

    generateAiAdvice();
  }, [stats]);

  const periodDisplay = startDate && endDate 
    ? `PÉRIODE DU ${new Date(startDate).toLocaleDateString('fr-FR')} AU ${new Date(endDate).toLocaleDateString('fr-FR')}`
    : new Date().toLocaleDateString('fr-FR', {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
      }).toUpperCase();

  return (
    <div className="max-w-7xl mx-auto space-y-8 pb-12 px-4 sm:px-6 lg:px-8">
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-white uppercase tracking-tight">
            Tableau de Bord<br />Réglementaire
          </h1>
          <div className="flex items-center gap-2 mt-1 text-gray-400 text-sm font-medium">
            <ShieldCheck size={14} className="text-emerald-500" />
            <p>Rapport de conformité conforme aux exigences de l'UMOA</p>
          </div>
          <div className="mt-4 inline-block px-4 py-2 bg-[#121c32] rounded-full border border-gray-800 text-gray-400 font-bold text-xs uppercase tracking-widest shadow-sm">
            {periodDisplay}
          </div>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-500/10 text-emerald-400 rounded-lg border border-emerald-500/20 text-xs font-bold self-start">
          <Cloud size={16} />
          <span>CLOUD</span>
        </div>
      </div>

      <div className="bg-[#121c32] p-6 rounded-[2rem] shadow-sm border border-gray-800 flex flex-wrap gap-4 items-end">
        <div className="space-y-1">
          <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Période du</label>
          <input 
            type="date" 
            value={startDate} 
            onChange={(e) => setStartDate(e.target.value)}
            className="block w-full p-2 bg-[#0a1226] border border-gray-800 rounded-xl text-sm font-bold outline-none focus:border-emerald-500 text-white"
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-black text-gray-500 uppercase tracking-widest">Au</label>
          <input 
            type="date" 
            value={endDate} 
            onChange={(e) => setEndDate(e.target.value)}
            className="block w-full p-2 bg-[#0a1226] border border-gray-800 rounded-xl text-sm font-bold outline-none focus:border-emerald-500 text-white"
          />
        </div>
        <button 
          onClick={() => { setStartDate(''); setEndDate(''); }}
          className="px-4 py-2 text-xs font-black text-gray-500 uppercase tracking-widest hover:text-red-400 transition-colors"
        >
          Réinitialiser
        </button>
      </div>

      <div className="bg-[#121c32] rounded-[2rem] p-6 text-white relative overflow-hidden shadow-xl border-b-4 border-emerald-500">
        <div className="flex items-start gap-4">
          <div className="bg-[#1a2b4a] p-3 rounded-2xl text-emerald-400 border border-emerald-500/30">
            {isLoadingAi ? <Loader2 size={24} className="animate-spin" /> : <Sparkles size={24} />}
          </div>
          <div>
            <h3 className="text-xs font-bold uppercase tracking-widest text-emerald-400 mb-1">Analyseur Prudentiel IA</h3>
            <p className="text-lg font-medium leading-tight">
              {aiAnalysis}
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {(currentUser?.role === 'administrateur' || currentUser?.role === 'directeur') && (
          <div className="md:col-span-2 bg-white p-6 rounded-[2rem] shadow-sm border border-gray-100 flex flex-wrap items-center justify-between gap-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center shadow-sm border border-indigo-100">
                <Package size={24} />
              </div>
              <div>
                <h3 className="text-sm font-black text-[#121c32] uppercase tracking-tight">Stock Central (Siège)</h3>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Total disponible pour distribution</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-4 sm:gap-8">
              <div className="text-center">
                <p className="text-[10px] font-black text-emerald-500 uppercase tracking-widest mb-1">Épargne</p>
                <p className="text-3xl font-black text-[#121c32]">{centralStocks.epargne}</p>
              </div>
              <div className="text-center border-l border-gray-100 pl-8">
                <p className="text-[10px] font-black text-amber-500 uppercase tracking-widest mb-1">Tontine</p>
                <p className="text-3xl font-black text-[#121c32]">{centralStocks.tontine}</p>
              </div>
            </div>
          </div>
        )}

        {(currentUser?.role === 'agent commercial' || currentUser?.role === 'caissier') && (
          <div className="md:col-span-2 bg-white p-6 rounded-[2rem] shadow-sm border border-gray-100 flex items-center justify-between animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center shadow-sm border border-amber-100">
                <Package size={24} />
              </div>
              <div>
                <h3 className="text-sm font-black text-[#121c32] uppercase tracking-tight">Votre Stock de Livrets</h3>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Unités disponibles en main</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-4 sm:gap-8">
              <div className="text-center">
                <p className="text-[10px] font-black text-emerald-500 uppercase tracking-widest mb-1">Épargne</p>
                <p className="text-3xl font-black text-[#121c32]">{agentStocks.epargne}</p>
              </div>
              <div className="text-center border-l border-gray-100 pl-8">
                <p className="text-[10px] font-black text-amber-500 uppercase tracking-widest mb-1">Tontine</p>
                <p className="text-3xl font-black text-[#121c32]">{agentStocks.tontine}</p>
              </div>
            </div>
          </div>
        )}

        <div className="bg-[#121c32] rounded-[2rem] p-8 shadow-sm border border-gray-800 relative group transition-all hover:shadow-md">
          <div className="absolute top-8 right-8 text-blue-400">
            <Users size={24} strokeWidth={1.5} />
          </div>
          <p className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-4">Inclusion Financière</p>
          <div className="flex items-baseline gap-1">
            <span className="text-6xl font-black text-white">{stats.membresActifs}</span>
          </div>
          <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mt-1">Membres Actifs</p>
          
          <div className="grid grid-cols-2 gap-3 mt-8">
            <div className="bg-emerald-500/5 p-4 rounded-2xl border border-emerald-500/10">
              <div className="flex justify-between items-start mb-1">
                <p className="text-xs font-bold text-emerald-400 uppercase tracking-tighter">Tontiniers</p>
                {stats.nouveauxTontiniers > 0 && <span className="text-[10px] font-black text-white bg-emerald-500 px-1.5 py-0.5 rounded-full">+{stats.nouveauxTontiniers} NOUV.</span>}
              </div>
              <p className="text-xl font-black text-emerald-400">{stats.tontiniers}</p>
            </div>
            <div className="bg-purple-500/5 p-4 rounded-2xl border border-purple-500/10">
              <div className="flex justify-between items-start mb-1">
                <p className="text-xs font-bold text-purple-400 uppercase tracking-tighter">Épargnants</p>
                {stats.nouveauxEpargnants > 0 && <span className="text-[10px] font-black text-white bg-purple-500 px-1.5 py-0.5 rounded-full">+{stats.nouveauxEpargnants} NOUV.</span>}
              </div>
              <p className="text-xl font-black text-purple-400">{stats.epargnants}</p>
            </div>
          </div>
        </div>

        <div className="bg-[#121c32] rounded-[2rem] p-8 shadow-sm border border-gray-800 relative">
          <div className="absolute top-8 right-8 text-emerald-400">
            <Landmark size={24} strokeWidth={1.5} />
          </div>
          <p className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-4">Ressources (Total Inflows)</p>
          <div className="flex items-baseline gap-2">
            <span className="text-6xl font-black text-emerald-400">{stats.encoursDepots.toLocaleString()}</span>
            <span className="text-2xl font-black text-emerald-400">F</span>
          </div>
          <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mt-1 text-balance">Total des ressources collectées (Dépôts, Parts, Frais)</p>
          
          <div className="mt-8 space-y-4">
            <div className="flex items-center justify-between border-b border-gray-800 pb-2">
              <span className="text-xs font-bold text-gray-500 uppercase">Épargne à vue</span>
              <span className="text-sm font-black text-white">{stats.epargneVue.toLocaleString()} F</span>
            </div>
            <div className="flex items-center justify-between border-b border-gray-800 pb-2">
              <span className="text-xs font-bold text-gray-500 uppercase">Tontine (Net commissionné)</span>
              <span className="text-sm font-black text-white">{stats.tontineStables.toLocaleString()} F</span>
            </div>
            <div className="flex items-center justify-between border-b border-gray-800 pb-2">
              <span className="text-xs font-bold text-gray-500 uppercase tracking-tighter">Parts Sociales</span>
              <span className="text-sm font-black text-white">{(stats as any).capitalSocial.toLocaleString()} F</span>
            </div>
            <div className="flex items-center justify-between border-b border-gray-800 pb-2">
              <span className="text-xs font-bold text-gray-500 uppercase tracking-tighter">Garanties</span>
              <span className="text-sm font-black text-white">{(stats as any).garanties.toLocaleString()} F</span>
            </div>
            <div className="flex items-center justify-between border-b border-gray-800 pb-2">
              <span className="text-xs font-bold text-gray-500 uppercase tracking-tighter">Frais d'Adhésion</span>
              <span className="text-sm font-black text-white">{(stats as any).fraisAdhesion.toLocaleString()} F</span>
            </div>
            <div className="flex items-center justify-between border-b border-gray-800 pb-2 pt-2">
              <span className="text-xs font-bold text-blue-400 uppercase tracking-tighter">Commission Tontine</span>
              <span className="text-sm font-black text-blue-400">{stats.tontineCommission.toLocaleString()} F</span>
            </div>
            <div className="flex items-center justify-between pt-2">
              <span className="text-xs font-bold text-amber-500 uppercase tracking-tighter">Ventes Livrets Tontine</span>
              <span className="text-sm font-black text-amber-500">{stats.ventesLivretsTontine.toLocaleString()} F</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-emerald-500 uppercase tracking-tighter">Ventes Livrets Épargne</span>
              <span className="text-sm font-black text-emerald-500">{stats.ventesLivretsEpargne.toLocaleString()} F</span>
            </div>
          </div>
        </div>

        <div className="bg-[#0f172a] rounded-[2.5rem] p-8 text-white shadow-xl relative overflow-hidden group border border-gray-800">
          <div className="absolute top-8 right-8 text-emerald-400 opacity-50">
            <CreditCard size={24} strokeWidth={1.5} />
          </div>
          <p className="text-xs font-bold uppercase tracking-widest text-emerald-400 mb-4">Emplois (Crédits)</p>
          <div className="flex items-baseline gap-2">
            <span className="text-6xl font-black">{stats.encoursCredits.toLocaleString()}</span>
            <span className="text-2xl font-black">F</span>
          </div>
          <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mt-1">Encours Brut de Crédit</p>
          
          <div className="grid grid-cols-2 gap-3 mt-8">
            <div className="bg-white/5 p-4 rounded-2xl border border-white/10">
              <p className="text-xs font-bold text-emerald-400 uppercase tracking-tighter mb-1">PAR (90+)</p>
              <p className="text-xl font-black text-white">{stats.par.toFixed(2)}%</p>
            </div>
            <div className="bg-white/5 p-4 rounded-2xl border border-white/10">
              <p className="text-xs font-bold text-red-400 uppercase tracking-tighter mb-1">Souffrance</p>
              <p className="text-xl font-black text-white">{stats.creancesSouffrance.toLocaleString()} F</p>
            </div>
          </div>
        </div>

        <div className="bg-[#121c32] rounded-[2rem] p-8 shadow-sm border border-gray-800 relative">
          <div className="absolute top-8 right-8 text-purple-400">
            <Scale size={24} strokeWidth={1.5} />
          </div>
          <p className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-4">Ratios Prudentiels</p>
          <div className="space-y-6 mt-4">
            <div>
              <div className="flex justify-between mb-2">
                <span className="text-xs font-black text-gray-500 uppercase">Solvabilité (Fonds Propres)</span>
                <span className="text-xs font-black text-white">{stats.solvabilite.toFixed(1)}%</span>
              </div>
              <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                <div className="h-full bg-purple-500 rounded-full" style={{ width: `${Math.min(stats.solvabilite, 100)}%` }}></div>
              </div>
            </div>
            <div>
              <div className="flex justify-between mb-2">
                <span className="text-xs font-black text-gray-500 uppercase">Liquidité</span>
                <span className="text-xs font-black text-white">{stats.liquidite.toFixed(1)}%</span>
              </div>
              <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                <div className="h-full bg-blue-500 rounded-full" style={{ width: `${Math.min(stats.liquidite, 100)}%` }}></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;