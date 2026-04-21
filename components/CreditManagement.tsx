import React, { useState, useEffect } from 'react';
import { 
  CreditCard, 
  Search, 
  TrendingUp, 
  AlertCircle, 
  ChevronRight, 
  Wallet, 
  Clock, 
  ShieldCheck,
  History,
  Filter,
  Download,
  Printer,
  MoreVertical,
  ArrowUpRight,
  Calendar,
  X,
  UserPlus,
  CheckCircle
} from 'lucide-react';


export default function CreditManagement() {
  const [searchTerm, setSearchTerm] = useState('');
  const [credits, setCredits] = useState<any[]>([]);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [showArchives, setShowArchives] = useState(false);
  const [showPenaltyModal, setShowPenaltyModal] = useState(false);
  const [selectedCreditId, setSelectedCreditId] = useState<string | null>(null);
  const [penaltyAmount, setPenaltyAmount] = useState('');
  const [stats, setStats] = useState({
    encoursBrut: 0,
    interetsAttendus: 0,
    penalitesCumulees: 0,
    par: 0
  });

  const loadData = () => {
    const saved = localStorage.getItem('microfox_members_data');
    let clients = [];
    if (saved) {
      clients = JSON.parse(saved);
    } else {
      clients = [
        {
          id: '1',
          name: 'KOFFI Ama Gertrude',
          code: '4111001254',
          balances: { credit: 1200000 }
        },
        { id: '2', name: 'MENSAH Yao Jean', code: '4111001289', balances: { credit: 0 } }
      ];
    }

    const allCredits = clients.filter((c: any) => {
      const hasCreditBalance = (c.balances?.credit || 0) > 0;
      const hasCreditHistory = c.history?.some((tx: any) => tx.account === 'credit');
      return hasCreditBalance || hasCreditHistory;
    }).map((c: any) => {
      const total = c.balances.credit || 0;
      const dueDateStr = c.lastCreditRequest?.dueDate || c.lastCreditDetails?.dueDate || '2025-06-15';
      const dueDate = new Date(dueDateStr);
      const now = new Date();
      const diffTime = now.getTime() - dueDate.getTime();
      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

      let status = 'Sain';
      if (total === 0) status = 'Clôturé';
      else if (diffDays >= 30) status = 'Contentieux';
      else if (diffDays >= 1) status = 'Retard';

      const initialCap = c.lastCreditDetails?.capital || c.lastCreditRequest?.capital || (total * 0.9);
      const initialInt = c.lastCreditDetails?.interest || c.lastCreditRequest?.interest || (total * 0.1);
      const initialTot = Number(initialCap) + Number(initialInt);
      
      let interet = 0;
      let capital = 0;
      
      if (Math.abs(total - initialTot) < 1) {
        interet = Number(initialInt);
        capital = Number(initialCap);
      } else {
        const capRatio = initialTot > 0 ? Number(initialCap) / initialTot : 0.9;
        const intRatio = initialTot > 0 ? Number(initialInt) / initialTot : 0.1;
        interet = Math.floor(total * intRatio);
        capital = Math.floor(total * capRatio);
      }

      return {
        id: c.id,
        name: c.name,
        code: c.code,
        capital: capital,
        interet: interet,
        penalite: c.lastCreditRequest?.penalty || c.lastCreditDetails?.penalty || 0,
        status: status,
        dateEcheance: dueDateStr,
        duration: c.lastCreditDetails?.duration || c.lastCreditRequest?.duration || 'N/A',
        creditNumber: c.lastCreditDetails?.creditNumber || c.lastCreditRequest?.creditNumber || '---',
        totalCredit: initialTot,
        requestedBy: c.lastCreditDetails?.requestedBy || c.lastCreditRequest?.requestedBy || 'N/A',
        validatedBy: c.lastCreditDetails?.validatedBy || c.lastCreditRequest?.validatedBy || 'N/A',
        disbursedBy: c.lastCreditDetails?.disbursedBy || c.lastCreditRequest?.disbursedBy || 'N/A'
      };
    });

    setCredits(allCredits);

    const activeCredits = allCredits.filter((c: any) => c.status !== 'Clôturé');
    const eb = activeCredits.reduce((acc: number, c: any) => acc + (c.capital || 0) + (c.interet || 0) + (c.penalite || 0), 0);
    const int = activeCredits.reduce((acc: number, c: any) => acc + (c.interet || 0), 0);
    const pen = activeCredits.reduce((acc: number, c: any) => acc + (c.penalite || 0), 0);

    setStats({
      encoursBrut: eb,
      interetsAttendus: int,
      penalitesCumulees: pen,
      par: 0
    });
  };

  useEffect(() => {
    loadData();
    window.addEventListener('storage', loadData);
    return () => window.removeEventListener('storage', loadData);
  }, []);

  const generateHTMLContent = (isForPrint = false) => {
    if (credits.length === 0) return null;
    const mfConfig = JSON.parse(localStorage.getItem('microfox_mf_config') || '{"nom": "MicroFoX", "adresse": "", "code": ""}');
    const headers = ["Nom", "Code", "Capital restant dû", "Intérêt", "Pénalité", "Demandé par", "Validé par", "Décaissé par", "Durée", "Status"];
    
    const htmlContent = `
      <!DOCTYPE html>
      <html lang="fr">
      <head>
        <meta charset="UTF-8">
        <title>Portefeuille Crédits - ${mfConfig.nom}</title>
        <style>
          body { font-family: sans-serif; padding: 40px; color: #121c32; }
          .header { text-align: center; margin-bottom: 40px; border-bottom: 2px solid #f1f5f9; padding-bottom: 20px; }
          .mf-name { font-size: 24px; font-weight: 900; text-transform: uppercase; margin: 0; color: #121c32; }
          .mf-info { font-size: 12px; font-weight: bold; color: #64748b; margin: 5px 0; }
          .report-title { font-size: 18px; font-weight: 800; margin: 20px 0; text-transform: uppercase; text-align: center; }
          .period { font-size: 12px; color: #64748b; text-align: center; margin-bottom: 30px; font-weight: bold; }
          table { width: 100%; border-collapse: collapse; margin-top: 20px; }
          th { background: #f8fafc; padding: 12px; text-align: center; font-size: 10px; text-transform: uppercase; letter-spacing: 0.05em; color: #64748b; border-bottom: 1px solid #e2e8f0; }
          td { padding: 12px; border-bottom: 1px solid #f1f5f9; font-size: 13px; text-align: center; }
          tr:nth-child(even) { background-color: #f9fafb; }
          .text-right { text-align: center; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1 class="mf-name">${mfConfig.nom}</h1>
          <p class="mf-info">${mfConfig.adresse}</p>
          <p class="mf-info">Tél: ${mfConfig.telephone || 'N/A'} | Code: ${mfConfig.code}</p>
        </div>
        <h2 class="report-title">Dossiers Crédit Actuels / Archives des Crédits</h2>
        <p class="period">Généré le ${new Date().toLocaleDateString()}</p>
        <table>
          <thead>
            <tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr>
          </thead>
          <tbody>
            ${filteredCredits.map(c => `
              <tr>
                <td>${c.name}</td>
                <td>${c.code}</td>
                <td class="text-right">${(c.capital || 0).toLocaleString()} F</td>
                <td class="text-right">${(c.interet || 0).toLocaleString()} F</td>
                <td class="text-right">${(c.penalite || 0).toLocaleString()} F</td>
                <td>${c.requestedBy || 'N/A'}</td>
                <td>${c.validatedBy || 'N/A'}</td>
                <td>${c.disbursedBy || 'N/A'}</td>
                <td>${c.duration || 'N/A'}</td>
                <td>${c.status}</td>
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
    link.download = `portefeuille_credits_${new Date().toISOString().split('T')[0]}.html`;
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

  const handleAddPenalty = () => {
    if (!selectedCreditId || !penaltyAmount) return;

    const saved = localStorage.getItem('microfox_members_data');
    let clients = saved ? JSON.parse(saved) : [];

    const updatedClients = clients.map((c: any) => {
      if (c.id === selectedCreditId) {
        const amount = Number(penaltyAmount);
        const currentCredit = c.balances?.credit || 0;
        const newTotal = currentCredit + amount;
        
        let fullHistory = c.history || [];
        if (fullHistory.length === 0) {
          const savedHistory = localStorage.getItem(`microfox_history_${c.id}`);
          if (savedHistory) fullHistory = JSON.parse(savedHistory);
        }

        const currentUser = JSON.parse(localStorage.getItem('microfox_current_user') || '{}');
        const newTx = {
          id: Date.now().toString(),
          type: 'frais',
          account: 'credit',
          amount: amount,
          date: new Date().toISOString(),
          description: `Application d'une pénalité sur crédit par ${currentUser.identifiant || 'Inconnu'}`,
          operator: currentUser.identifiant || 'Inconnu',
          cashierName: currentUser.identifiant || 'Inconnu'
        };

        const newHistory = [newTx, ...fullHistory];
        localStorage.setItem(`microfox_history_${c.id}`, JSON.stringify(newHistory));

        return {
          ...c,
          balances: { ...c.balances, credit: newTotal },
          history: newHistory,
          lastCreditDetails: {
            ...(c.lastCreditDetails || {}),
            penalty: (c.lastCreditDetails?.penalty || 0) + amount
          }
        };
      }
      return c;
    });

    localStorage.setItem('microfox_members_data', JSON.stringify(updatedClients));
    localStorage.setItem('microfox_pending_sync', 'true');
    window.dispatchEvent(new Event('storage'));
    loadData();
    setShowPenaltyModal(false);
    setPenaltyAmount('');
    alert("Pénalité appliquée avec succès.");
  };

  const filteredCredits = credits.filter(c => 
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    c.code.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-12">
      {showPenaltyModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-[2rem] w-full max-w-md overflow-hidden shadow-2xl">
            <div className="bg-[#121c32] p-6 text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <AlertCircle size={24} className="text-red-400" />
                <h3 className="text-lg font-black uppercase tracking-tight">Appliquer une Pénalité</h3>
              </div>
              <button onClick={() => setShowPenaltyModal(false)} className="p-2 hover:bg-white/10 rounded-full"><X size={20} /></button>
            </div>
            <div className="p-8 space-y-6">
              <div className="space-y-2">
                <label className="text-[11px] font-black text-gray-400 uppercase tracking-widest">Montant de la Pénalité (F)</label>
                <input 
                  type="number" 
                  value={penaltyAmount} 
                  onChange={(e) => setPenaltyAmount(e.target.value)}
                  placeholder="0"
                  className="w-full p-4 bg-gray-50 border border-gray-200 rounded-2xl outline-none focus:border-red-500 font-black text-2xl text-[#121c32]"
                />
              </div>
              <button 
                onClick={handleAddPenalty}
                className="w-full py-5 bg-red-500 text-white rounded-2xl font-black uppercase tracking-widest shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2"
              >
                <CheckCircle size={20} />
                Confirmer la Pénalité
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header & Stats Cards */}
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-6 mb-2">
        <div>
          <h1 className="text-2xl font-black text-white uppercase tracking-tight">Portefeuille Crédit</h1>
          <p className="text-gray-400 text-sm font-medium mt-1">Suivi du portefeuille et recouvrement</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button 
            onClick={() => setShowArchives(!showArchives)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all shadow-sm ${showArchives ? 'bg-amber-500 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}
          >
            <History size={18} /> {showArchives ? 'Retour aux crédits actifs' : 'Archives des crédits'}
          </button>
          <button 
            onClick={handlePrint}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-xl text-sm font-bold text-gray-600 hover:bg-gray-50 transition-all shadow-sm"
          >
            <Printer size={18} /> Imprimer
          </button>
          <button 
            onClick={handleExport}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-xl text-sm font-bold text-gray-600 hover:bg-gray-50 transition-all shadow-sm"
          >
            <Download size={18} /> Exporter HTML
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-[#0f172a] rounded-[2rem] p-6 text-white shadow-xl relative overflow-hidden group">
          <div className="absolute top-4 right-4 text-emerald-400/20 group-hover:scale-110 transition-transform">
            <TrendingUp size={48} strokeWidth={1} />
          </div>
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-400 mb-2">Encours Brut Total</p>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black">{(stats.encoursBrut || 0).toLocaleString()}</span>
            <span className="text-sm font-bold opacity-70">F</span>
          </div>
        </div>

        <div className="bg-white rounded-[2rem] p-6 border border-gray-100 shadow-sm relative group">
          <div className="absolute top-4 right-4 text-blue-500/10">
            <Wallet size={48} strokeWidth={1} />
          </div>
          <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2">Intérêts attendus</p>
          <div className="flex items-baseline gap-1">
            <span className="text-3xl font-black text-[#121c32]">{(stats.interetsAttendus || 0).toLocaleString()}</span>
            <span className="text-sm font-bold text-gray-400">F</span>
          </div>
        </div>

        <div className="bg-white rounded-[2rem] p-6 border border-gray-100 shadow-sm relative group">
          <div className="absolute top-4 right-4 text-red-500/10">
            <AlertCircle size={48} strokeWidth={1} />
          </div>
          <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2">Pénalités cumulées</p>
          <div className="flex items-baseline gap-1">
            <span className="text-3xl font-black text-red-500">{(stats.penalitesCumulees || 0).toLocaleString()}</span>
            <span className="text-sm font-bold text-gray-400">F</span>
          </div>
        </div>

        <div className="bg-emerald-50 rounded-[2rem] p-6 border border-emerald-100 shadow-sm relative group">
          <div className="absolute top-4 right-4 text-emerald-600/10">
            <ShieldCheck size={48} strokeWidth={1} />
          </div>
          <p className="text-[10px] font-black uppercase tracking-widest text-emerald-600 mb-2 opacity-70">Portefeuille Sain (PAR)</p>
          <div className="flex items-baseline gap-1">
            <span className="text-3xl font-black text-emerald-700">{stats.par.toFixed(2)}</span>
            <span className="text-sm font-bold text-emerald-700">%</span>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-[2.5rem] shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-6 border-b border-gray-50 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <h2 className="text-lg font-black text-[#121c32] uppercase tracking-tight">
              Dossiers Crédit Actuels / Archives des Crédits
            </h2>
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              <input 
                type="text" 
                placeholder="Rechercher..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-transparent focus:border-emerald-500 rounded-xl outline-none text-sm font-medium transition-all"
              />
            </div>
          </div>
          <div className="flex gap-2 self-end sm:self-center">
            <button 
              onClick={() => setShowArchives(!showArchives)}
              className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${showArchives ? 'bg-[#121c32] text-white shadow-lg' : 'bg-gray-50 text-gray-500 hover:bg-gray-100'}`}
            >
              {showArchives ? 'Voir Actifs' : 'Voir Archives'}
            </button>
            <button className="p-3 bg-gray-50 text-gray-500 rounded-xl hover:bg-gray-100 transition-all"><Filter size={20} /></button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-gray-50/50">
                <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">N° Crédit</th>
                <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Membre</th>
                <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Capital restant dû</th>
                <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Intérêts</th>
                <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Pénalités</th>
                {showArchives && (
                  <>
                    <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Demandé par</th>
                    <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Validé par</th>
                    <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Décaissé par</th>
                  </>
                )}
                <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Durée</th>
                <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Échéance</th>
                <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Status</th>
                <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filteredCredits.filter(c => showArchives ? c.status === 'Clôturé' : c.status !== 'Clôturé').length > 0 ? (
                filteredCredits.filter(c => showArchives ? c.status === 'Clôturé' : c.status !== 'Clôturé').map((credit) => (
                  <tr key={credit.id} className="group hover:bg-emerald-50/30 transition-all cursor-pointer">
                    <td className="px-6 py-5">
                      <p className="text-xs font-black text-amber-600 uppercase">{credit.creditNumber || '---'}</p>
                    </td>
                    <td className="px-6 py-5">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-[#121c32] text-white flex items-center justify-center font-black text-xs">
                          {credit.name.split(' ').map((n: string) => n[0]).join('')}
                        </div>
                        <div>
                          <p className="text-sm font-black text-[#121c32] uppercase truncate">{credit.name}</p>
                          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-tight">{credit.code}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      <p className="text-sm font-black text-[#121c32]">{(credit.capital || 0).toLocaleString()} F</p>
                    </td>
                    <td className="px-6 py-5">
                      <p className="text-sm font-black text-blue-600">{(credit.interet || 0).toLocaleString()} F</p>
                    </td>
                    <td className="px-6 py-5">
                      <p className="text-sm font-black text-red-500">{(credit.penalite || 0).toLocaleString()} F</p>
                    </td>
                    {showArchives && (
                      <>
                        <td className="px-6 py-5">
                          <p className="text-sm font-black text-gray-600 uppercase">{credit.requestedBy}</p>
                        </td>
                        <td className="px-6 py-5">
                          <p className="text-sm font-black text-gray-600 uppercase">{credit.validatedBy}</p>
                        </td>
                        <td className="px-6 py-5">
                          <p className="text-sm font-black text-gray-600 uppercase">{credit.disbursedBy}</p>
                        </td>
                      </>
                    )}
                    <td className="px-6 py-5">
                      <p className="text-sm font-black text-gray-600">{credit.duration || 'N/A'}</p>
                    </td>
                    <td className="px-6 py-5">
                      <p className="text-sm font-black text-gray-700">{new Date(credit.dateEcheance).toLocaleDateString()}</p>
                    </td>
                    <td className="px-6 py-5">
                      <span className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-tight ${
                        credit.status === 'Sain' ? 'bg-emerald-100 text-emerald-700' : 
                        credit.status === 'Retard' ? 'bg-amber-100 text-amber-700' : 
                        credit.status === 'Clôturé' ? 'bg-gray-100 text-gray-600' : 'bg-red-100 text-red-700'
                      }`}>
                        {credit.status}
                      </span>
                    </td>
                    <td className="px-6 py-5 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button className="p-2 text-gray-300 hover:text-emerald-500 hover:bg-white rounded-lg transition-all shadow-none hover:shadow-sm">
                          <ChevronRight size={20} />
                        </button>
                        <div className="relative">
                          <button 
                            onClick={(e) => { e.stopPropagation(); setOpenMenuId(openMenuId === credit.id ? null : credit.id); }}
                            className="p-2 text-gray-300 hover:text-gray-600 rounded-lg transition-colors"
                          >
                            <MoreVertical size={18} />
                          </button>
                          {openMenuId === credit.id && (
                            <div className="absolute right-0 mt-1 w-40 bg-white rounded-xl shadow-xl border border-gray-100 z-50 py-2">
                              <button onClick={() => setOpenMenuId(null)} className="w-full text-left px-4 py-2 text-[10px] font-black text-gray-600 hover:bg-gray-50 uppercase">Détails</button>
                              <button onClick={() => setOpenMenuId(null)} className="w-full text-left px-4 py-2 text-[10px] font-black text-gray-600 hover:bg-gray-50 uppercase">Rembourser</button>
                              <button 
                                onClick={() => { 
                                  setSelectedCreditId(credit.id); 
                                  setShowPenaltyModal(true); 
                                  setOpenMenuId(null); 
                                }} 
                                className="w-full text-left px-4 py-2 text-[10px] font-black text-amber-600 hover:bg-amber-50 uppercase"
                              >
                                Ajouter Pénalité
                              </button>
                              <div className="h-px bg-gray-100 my-1"></div>
                              <button onClick={() => setOpenMenuId(null)} className="w-full text-left px-4 py-2 text-[10px] font-black text-red-500 hover:bg-red-50 uppercase">Clôturer</button>
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="px-6 py-20 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-16 h-16 rounded-full bg-gray-50 flex items-center justify-center text-gray-300">
                        <History size={32} strokeWidth={1} />
                      </div>
                      <p className="text-gray-400 font-bold text-sm uppercase italic">Aucun crédit actif trouvé</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-[2.5rem] p-8 border border-gray-100 shadow-sm h-full">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-black text-[#121c32] uppercase tracking-tight flex items-center gap-2">
              <Clock size={20} className="text-amber-500" /> Échéances à venir
            </h3>
            <button className="text-[10px] font-bold text-emerald-600 uppercase">Voir tout</button>
          </div>
          <div className="space-y-4">
            {filteredCredits.slice(0, 3).map((c, i) => (
              <div key={i} className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl">
                <div className="flex items-center gap-4">
                  <div className="bg-white p-2.5 rounded-xl text-gray-400 border border-gray-100">
                    <Calendar size={20} />
                  </div>
                  <div>
                    <p className="text-sm font-black text-[#121c32] uppercase">{c.name}</p>
                    <p className="text-[10px] font-bold text-gray-400">Échéance le {new Date(c.dateEcheance).toLocaleDateString()}</p>
                  </div>
                </div>
                <p className="text-sm font-black text-amber-600">{((c.capital || 0) / 10).toLocaleString()} F</p>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-[#121c32] rounded-[2.5rem] p-8 text-white shadow-xl h-full relative overflow-hidden">
          <div className="absolute -bottom-10 -right-10 w-48 h-48 bg-emerald-500/10 rounded-full blur-3xl"></div>
          <h3 className="text-lg font-black uppercase tracking-tight mb-8">Analyse Prudentielle</h3>
          <div className="space-y-6 relative z-10">
            <div>
              <div className="flex justify-between mb-2">
                <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-400">Solvabilité Globale</span>
                <span className="text-xs font-black">92%</span>
              </div>
              <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                <div className="h-full bg-emerald-500 rounded-full w-[92%]"></div>
              </div>
            </div>
            <div>
              <div className="flex justify-between mb-2">
                <span className="text-[10px] font-bold uppercase tracking-widest text-blue-400">Taux de Recouvrement</span>
                <span className="text-xs font-black">98.5%</span>
              </div>
              <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                <div className="h-full bg-blue-500 rounded-full w-[98.5%]"></div>
              </div>
            </div>
          </div>
          <div className="mt-8 pt-8 border-t border-white/10">
            <p className="text-[10px] font-medium text-gray-400 leading-relaxed uppercase">
              Les ratios de concentration des risques par client sont maintenus sous la limite réglementaire de 25% des fonds propres.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}