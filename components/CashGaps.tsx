import React, { useState, useEffect } from 'react';
import { Search, AlertTriangle, TrendingUp, TrendingDown, Cloud, FileText, Download, Printer, Calendar, User, ChevronDown, CheckCircle2, XCircle, AlertCircle, CreditCard, Landmark } from 'lucide-react';
import { Gap } from '../types';

const CashGaps: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [startDate, setStartDate] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
  });
  const [gaps, setGaps] = useState<Gap[]>([]);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [selectedCaisse, setSelectedCaisse] = useState('all');
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [alertMessage, setAlertMessage] = useState<string | null>(null);
  const [confirmModal, setConfirmModal] = useState<{ message: string; onConfirm: () => void } | null>(null);
  const currentUser = JSON.parse(localStorage.getItem('microfox_current_user') || '{}');
  const [stats, setStats] = useState({
    totalGapsCount: 0,
    totalGapsAmount: 0,
    negativeGaps: 0,
    positiveGaps: 0
  });

  const loadGaps = () => {
    const savedUsers = localStorage.getItem('microfox_users');
    const usersList = savedUsers ? JSON.parse(savedUsers) : [];
    setAllUsers(usersList);

    const selectedUser = usersList.find((u: any) => u.id === selectedUserId);
    const selectedUserName = selectedUser?.identifiant;
    const selectedUserCaisse = selectedUser?.caisse;
    const selectedUserZone = selectedUser?.zoneCollecte || selectedUser?.zone;

    const saved = localStorage.getItem('microfox_all_gaps');
    if (saved) {
      const allGaps: Gap[] = JSON.parse(saved);
      const gapsList = allGaps.filter((item: Gap) => {
        if (!item.date) return false;
        const date = item.date.split('T')[0];
        const matchesStartDate = !startDate || date >= startDate;
        const matchesEndDate = !endDate || date <= endDate;
        
        // Match by userId if available, otherwise fallback to name/caisse/zone for legacy data
        const matchesUser = !selectedUserId || 
          (item.userId === selectedUserId) || 
          (!item.userId && (
            (item.type === 'AGENT' && item.sourceName === selectedUserName) ||
            (item.type === 'CAISSIER' && item.sourceName === selectedUserCaisse) ||
            (item.type === 'TONTINE' && item.zone === selectedUserZone)
          ));

        const matchesCaisse = selectedCaisse === 'all' || 
          item.caisse === selectedCaisse ||
          (item.type === 'CAISSIER' && item.sourceName === selectedCaisse) ||
          (item.userId && usersList.find((u: any) => u.id === item.userId)?.caisse === selectedCaisse);
        
        // Filtrage par zone pour l'agent commercial
        if (currentUser?.role === 'agent commercial') {
          const agentZones = currentUser.zonesCollecte || (currentUser.zoneCollecte ? [currentUser.zoneCollecte] : []);
          if (agentZones.length > 0) {
            return matchesStartDate && matchesEndDate && agentZones.includes(item.zone) && matchesUser && matchesCaisse;
          }
        }
        
        return matchesStartDate && matchesEndDate && matchesUser && matchesCaisse;
      });
      
      setGaps(gapsList);

      const activeGaps = gapsList.filter((g: Gap) => g.status !== 'Annulé' && g.status !== 'Payé');
      const totalAmount = activeGaps.reduce((acc: number, curr: Gap) => acc + (curr.gapAmount || 0), 0);
      const negative = activeGaps.filter((g: Gap) => g.gapAmount < 0).length;
      const positive = activeGaps.filter((g: Gap) => g.gapAmount > 0).length;

      setStats({
        totalGapsCount: activeGaps.length,
        totalGapsAmount: totalAmount,
        negativeGaps: negative,
        positiveGaps: positive
      });
    } else {
      setGaps([]);
      setStats({
        totalGapsCount: 0,
        totalGapsAmount: 0,
        negativeGaps: 0,
        positiveGaps: 0
      });
    }
  };

  const handleGapAction = (gap: Gap, newStatus: Gap['status']) => {
    // Une fois qu'une action est choisie (différente de 'En attente'), le statut est verrouillé et ne peut plus être modifié
    if (gap.status && gap.status !== 'En attente') return;
    if (newStatus === 'En attente') return;
    
    const confirmMsg = newStatus === 'Payé' || newStatus === 'Régularisé'
      ? `Confirmer la régularisation de l'écart de ${Math.abs(gap.gapAmount).toLocaleString()} F ?`
      : newStatus === 'Annulé'
        ? `Confirmer l'annulation de l'écart ? ${(gap.gapAmount > 0 ? "Le surplus sera retiré de votre caisse." : "")}`
        : `Confirmer le changement de statut en ${newStatus} ?`;

    setConfirmModal({
      message: confirmMsg,
      onConfirm: () => {
        const targetCaisse = 'CAISSE PRINCIPALE';
        const balanceKey = `microfox_cash_balance_${targetCaisse}`;
        const currentBal = Number(localStorage.getItem(balanceKey) || 5000000);
        let newBal = currentBal;
        let amountAffected = 0;
        let txType = '';
        let txDetails = '';

        if (newStatus === 'Payé' || newStatus === 'Régularisé') {
          if (gap.gapAmount < 0) {
            amountAffected = Math.abs(gap.gapAmount);
            newBal = currentBal + amountAffected;
            txType = 'Régularisation Écart';
            txDetails = `Régularisation ${gap.type} du ${new Date(gap.date).toLocaleDateString()} (${gap.sourceName})`;
          }
        } else if (newStatus === 'Annulé') {
          if (gap.gapAmount > 0) {
            amountAffected = gap.gapAmount;
            newBal = currentBal - amountAffected;
            txType = 'Annulation Surplus';
            txDetails = `Annulation surplus ${gap.type} du ${new Date(gap.date).toLocaleDateString()} (${gap.sourceName})`;
          }
        }

        // 1. Mise à jour de la caisse et du journal si nécessaire
        if (amountAffected !== 0) {
          localStorage.setItem(balanceKey, newBal.toString());

          const transactionsSaved = localStorage.getItem('microfox_vault_transactions');
          const transactions = transactionsSaved ? JSON.parse(transactionsSaved) : [];
          const newTx = {
            id: `gap_tx_${Date.now()}`,
            type: txType,
            from: newStatus === 'Annulé' ? targetCaisse : gap.sourceName,
            to: newStatus === 'Annulé' ? 'AJUSTEMENT' : targetCaisse,
            amount: amountAffected,
            date: new Date().toISOString(),
            details: txDetails,
            userId: currentUser.id
          };
          localStorage.setItem('microfox_vault_transactions', JSON.stringify([newTx, ...transactions]));
        }

        // 2. Mise à jour du statut de l'écart dans localStorage
        const saved = localStorage.getItem('microfox_all_gaps');
        if (saved) {
          const allGaps: Gap[] = JSON.parse(saved);
          const updatedList = allGaps.map((item: Gap) => {
            if (String(item.id) === String(gap.id)) {
              return { 
                ...item, 
                status: newStatus,
                regDate: new Date().toLocaleDateString('fr-FR'),
                regMode: newStatus
              };
            }
            return item;
          });
          localStorage.setItem('microfox_all_gaps', JSON.stringify(updatedList));
        }

        // 3. Rafraîchissement immédiat de l'interface et notification aux autres composants
        loadGaps();
        window.dispatchEvent(new Event('storage'));

        if (amountAffected !== 0) {
          setAlertMessage(`Opération terminée. La caisse ${targetCaisse} a été mise à jour.`);
        }
        setConfirmModal(null);
      }
    });
  };

  useEffect(() => {
    loadGaps();
    window.addEventListener('storage', loadGaps);
    return () => window.removeEventListener('storage', loadGaps);
  }, [startDate, endDate, selectedUserId, selectedCaisse]);

  const generateHTMLContent = (isForPrint = false) => {
    if (gaps.length === 0) return null;
    const mfConfig = JSON.parse(localStorage.getItem('microfox_mf_config') || '{"nom": "MicroFoX", "adresse": "", "code": ""}');
    const headers = ["Date", "Type", "Source", "Code", "Déclaré", "Observé", "Écart", "Statut", "Date Régul.", "Observation"];
    
    const htmlContent = `
      <!DOCTYPE html>
      <html lang="fr">
      <head>
        <meta charset="UTF-8">
        <title>Rapport d'Écarts - ${mfConfig.nom}</title>
        <style>
          body { font-family: sans-serif; padding: 20px; color: #121c32; }
          .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #121c32; padding-bottom: 10px; }
          .mf-name { font-size: 24px; font-weight: 900; text-transform: uppercase; margin: 0; }
          .mf-address { font-size: 12px; font-weight: bold; color: #666; margin: 5px 0; }
          h2 { color: #dc2626; margin-top: 20px; text-transform: uppercase; }
          table { width: 100%; border-collapse: collapse; margin-top: 20px; }
          th { background-color: #121c32; color: white; text-align: left; padding: 12px 8px; font-size: 11px; text-transform: uppercase; }
          td { border-bottom: 1px solid #eee; padding: 10px 8px; font-size: 13px; }
          tr:nth-child(even) { background-color: #f9fafb; }
          .negative { color: #dc2626; font-weight: bold; }
          .positive { color: #059669; font-weight: bold; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1 class="mf-name">${mfConfig.nom}</h1>
          <p class="mf-address">${mfConfig.adresse}</p>
          <p class="mf-address">Tél: ${mfConfig.telephone || 'N/A'} | Code: ${mfConfig.code}</p>
        </div>
        <h2>Suivi des Écarts de Caisse - Global</h2>
        <table>
          <thead>
            <tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr>
          </thead>
          <tbody>
            ${gaps.map(g => `
              <tr>
                <td>${new Date(g.date).toLocaleDateString()}</td>
                <td>${g.type}</td>
                <td>${g.sourceName}</td>
                <td>${g.sourceCode || '-'}</td>
                <td>${g.declaredAmount.toLocaleString()} F</td>
                <td>${g.observedAmount.toLocaleString()} F</td>
                <td class="${g.gapAmount < 0 ? 'negative' : 'positive'}">${g.gapAmount > 0 ? '+' : ''}${g.gapAmount.toLocaleString()} F</td>
                <td>${g.status || 'En attente'}</td>
                <td>${g.regDate || '-'}</td>
                <td>${g.observation || '-'}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
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
    return htmlContent;
  };

  const handleExport = () => {
    const htmlContent = generateHTMLContent();
    if (!htmlContent) return setAlertMessage("Aucune donnée à exporter.");
    const blob = new Blob([htmlContent], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `suivi_ecarts_${new Date().toISOString().split('T')[0]}.html`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handlePrint = () => {
    const htmlContent = generateHTMLContent(true);
    if (!htmlContent) return setAlertMessage("Aucune donnée à imprimer.");
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(htmlContent);
      printWindow.document.close();
    }
  };

  const filteredGaps = gaps.filter(g => 
    g.sourceName.toLowerCase().includes(searchTerm.toLowerCase()) || 
    (g.sourceCode && g.sourceCode.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (g.observation && g.observation.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <>
      <div className="max-w-6xl mx-auto space-y-6 pb-12">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-extrabold text-white uppercase tracking-tight leading-tight">
            Écarts de<br />Caisse
          </h1>
          <p className="text-gray-400 text-sm font-medium mt-1">Gestion des écarts des caissiers</p>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 bg-red-50 text-red-600 rounded-lg border border-red-100 text-xs font-bold self-start">
          <Cloud size={16} />
          <span>SYNC LIVE</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-[#121c32] rounded-[2rem] p-6 text-white shadow-xl relative overflow-hidden group">
          <div className="absolute top-4 right-4 text-red-500/20 group-hover:scale-110 transition-transform">
            <AlertTriangle size={48} strokeWidth={1} />
          </div>
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-red-400 mb-2">Total Écarts (Net)</p>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black">{stats.totalGapsAmount.toLocaleString()}</span>
            <span className="text-sm font-bold opacity-70">FCFA</span>
          </div>
        </div>

        <div className="bg-white rounded-[2rem] p-6 border border-gray-100 shadow-sm relative group">
          <div className="absolute top-4 right-4 text-emerald-500/10">
            <TrendingUp size={48} strokeWidth={1} />
          </div>
          <p className="text-[10px] font-black uppercase tracking-widest text-gray-600 mb-2">Écarts Positifs</p>
          <div className="flex items-baseline gap-1">
            <span className="text-3xl font-black text-emerald-600">{stats.positiveGaps}</span>
            <span className="text-xs font-bold text-gray-400 uppercase ml-1">Dossiers</span>
          </div>
        </div>

        <div className="bg-white rounded-[2rem] p-6 border border-gray-100 shadow-sm relative group">
          <div className="absolute top-4 right-4 text-red-500/10">
            <TrendingDown size={48} strokeWidth={1} />
          </div>
          <p className="text-[10px] font-black uppercase tracking-widest text-gray-600 mb-2">Écarts Négatifs</p>
          <div className="flex items-baseline gap-1">
            <span className="text-3xl font-black text-red-500">{stats.negativeGaps}</span>
            <span className="text-xs font-bold text-gray-400 uppercase ml-1">Dossiers</span>
          </div>
        </div>
      </div>

      <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-gray-100 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="text-[10px] font-black text-gray-600 uppercase tracking-widest ml-1">Période du</label>
            <div className="relative group">
              <input 
                type="date" 
                value={startDate} 
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full pl-12 pr-4 py-3 bg-gray-50 border border-transparent focus:border-red-500 rounded-2xl outline-none text-sm font-bold text-[#121c32] shadow-sm appearance-none cursor-pointer transition-all"
              />
              <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-red-500" size={18} />
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-black text-gray-600 uppercase tracking-widest ml-1">Au</label>
            <div className="relative group">
              <input 
                type="date" 
                value={endDate} 
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full pl-12 pr-4 py-3 bg-gray-50 border border-transparent focus:border-red-500 rounded-2xl outline-none text-sm font-bold text-[#121c32] shadow-sm appearance-none cursor-pointer transition-all"
              />
              <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-red-500" size={18} />
            </div>
          </div>
        </div>

        <div className="flex flex-col md:flex-row gap-4 items-center pt-2">
          <div className="relative w-full md:w-64">
            <User className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <select
              value={selectedUserId}
              onChange={(e) => setSelectedUserId(e.target.value)}
              className="w-full pl-12 pr-4 py-3 bg-gray-50 border border-transparent focus:border-red-500 rounded-2xl outline-none text-sm font-bold text-[#121c32] shadow-sm appearance-none cursor-pointer transition-all"
            >
              <option value="">Tous les utilisateurs</option>
              {allUsers.map(u => (
                <option key={u.id} value={u.id}>
                  {u.identifiant} ({u.role === 'caissier' ? u.caisse : u.zoneCollecte || u.zone})
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={16} />
          </div>
          {(currentUser?.role === 'administrateur' || currentUser?.role === 'directeur' || currentUser?.role === 'superviseur') && (
            <div className="relative w-full md:w-64">
              <Landmark className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              <select
                value={selectedCaisse}
                onChange={(e) => setSelectedCaisse(e.target.value)}
                className="w-full pl-12 pr-4 py-3 bg-gray-50 border border-transparent focus:border-red-500 rounded-2xl outline-none text-sm font-bold text-[#121c32] shadow-sm appearance-none cursor-pointer transition-all"
              >
                <option value="all">Toutes les caisses</option>
                {Array.from(new Set([...allUsers.filter((u: any) => u.role === 'caissier' && u.caisse).map((u: any) => u.caisse), 'CAISSE 1', 'CAISSE 2'])).map(c => (
                  <option key={c as string} value={c as string}>{c as string}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={16} />
            </div>
          )}
          <div className="relative flex-1 w-full">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
            <input 
              type="text" 
              placeholder="Rechercher par client ou rapport..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-12 pr-4 py-3 bg-gray-50 border border-transparent focus:border-red-500 rounded-2xl outline-none text-sm font-medium transition-all"
            />
          </div>
          <div className="flex gap-2 w-full md:w-auto">
            <button onClick={handleExport} className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-3 bg-white border border-gray-200 rounded-xl text-xs font-black text-gray-400 hover:text-red-500 transition-all shadow-sm active:scale-95 uppercase tracking-widest">
              <Download size={16} /> Exporter
            </button>
            <button onClick={handlePrint} className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-3 bg-white border border-gray-200 rounded-xl text-xs font-black text-gray-400 hover:text-blue-500 transition-all shadow-sm active:scale-95 uppercase tracking-widest">
              <Printer size={16} /> Imprimer
            </button>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-[1.5rem] shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-gray-50 bg-gray-50/50">
                <th className="px-6 py-4 text-[10px] font-black text-gray-600 uppercase tracking-widest">Type / Source</th>
                <th className="px-6 py-4 text-[10px] font-black text-gray-600 uppercase tracking-widest">Déclaré</th>
                <th className="px-6 py-4 text-[10px] font-black text-gray-600 uppercase tracking-widest">Observé</th>
                <th className="px-6 py-4 text-[10px] font-black text-gray-600 uppercase tracking-widest">Écart</th>
                <th className="px-6 py-4 text-[10px] font-black text-gray-600 uppercase tracking-widest text-center">Statut</th>
                <th className="px-6 py-4 text-[10px] font-black text-gray-600 uppercase tracking-widest">Observation</th>
                <th className="px-6 py-4 text-[10px] font-black text-gray-600 uppercase tracking-widest text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filteredGaps.length > 0 ? (
                filteredGaps.map(item => (
                  <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-5">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center font-black text-[10px] ${
                          item.type === 'TONTINE' ? 'bg-blue-50 text-blue-600' :
                          item.type === 'AGENT' ? 'bg-emerald-50 text-emerald-600' :
                          'bg-amber-50 text-amber-600'
                        }`}>
                          {item.type[0]}
                        </div>
                        <div>
                          <p className="text-sm font-black text-[#121c32] uppercase">
                            {item.type === 'TONTINE' ? 'RETRAIT: ' : item.type === 'AGENT' ? 'VERSEMENT: ' : ''}
                            {item.sourceName}
                          </p>
                          <div className="flex flex-col gap-0.5">
                            <div className="flex items-center gap-2">
                              <span className="text-[9px] font-black text-gray-400 uppercase tracking-tighter">
                                {item.type === 'TONTINE' && item.sourceCode && !item.sourceCode.startsWith('Compte:') ? `Compte: ${item.sourceCode}` : (item.sourceCode || '-')}
                              </span>
                              <span className={`text-[8px] font-bold px-1 rounded ${
                                item.type === 'TONTINE' ? 'bg-blue-100 text-blue-600' :
                                item.type === 'AGENT' ? 'bg-emerald-100 text-emerald-600' :
                                'bg-gray-100 text-gray-500'
                              }`}>{item.type}</span>
                            </div>
                            {item.type === 'TONTINE' && (
                              <p className="text-[8px] font-black text-red-500 uppercase tracking-widest">
                                Agent: {allUsers.find(u => u.id === item.userId)?.identifiant || 'Inconnu'}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-5 text-xs font-bold text-gray-600">
                      {item.declaredAmount.toLocaleString()} F
                    </td>
                    <td className="px-6 py-5 text-xs font-bold text-[#121c32]">
                      {item.observedAmount.toLocaleString()} F
                    </td>
                    <td className="px-6 py-5">
                      <div className={`inline-flex px-2 py-1 rounded-lg text-[10px] font-black uppercase ${item.gapAmount < 0 ? 'bg-red-50 text-red-600' : (item.gapAmount > 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-gray-50 text-gray-400')}`}>
                        {item.gapAmount > 0 ? '+' : ''}{item.gapAmount?.toLocaleString() || 0} F
                      </div>
                    </td>
                    <td className="px-6 py-5 text-center">
                       <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[9px] font-black uppercase border ${
                         item.status === 'Régularisé' || item.status === 'Payé' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' :
                         item.status === 'Litige' ? 'bg-red-50 text-red-600 border-red-100' :
                         item.status === 'Annulé' ? 'bg-gray-100 text-gray-600 border-gray-200' :
                         'bg-amber-50 text-amber-600 border-amber-100'
                       }`}>
                         {item.status === 'Régularisé' || item.status === 'Payé' ? '🟢' : item.status === 'Litige' ? '🔴' : item.status === 'Annulé' ? '⚫' : '🟡'}
                         {item.status || 'En attente'}
                       </span>
                    </td>
                    <td className="px-6 py-5">
                      {item.observation ? (
                        <div className="flex items-start gap-2 max-w-[150px]">
                          <FileText size={14} className="text-gray-300 shrink-0 mt-0.5" />
                          <p className="text-[10px] font-black text-gray-500 uppercase leading-relaxed line-clamp-4">{item.observation}</p>
                        </div>
                      ) : (
                        <span className="text-[10px] text-gray-300 italic">N/A</span>
                      )}
                    </td>
                    <td className="px-6 py-5 text-right">
                       <div className="flex justify-end gap-1">
                          {item.gapAmount < 0 && item.status === 'En attente' && currentUser?.role !== 'agent commercial' && (
                            <button 
                              onClick={() => handleGapAction(item, 'Payé')}
                              className="flex items-center gap-1 px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-[9px] font-black uppercase tracking-widest hover:bg-emerald-700 transition-all active:scale-95 shadow-sm"
                            >
                              <CreditCard size={12} />
                              Payer
                            </button>
                          )}
                          <select 
                            value={item.status || 'En attente'}
                            disabled={currentUser?.role === 'agent commercial' || (item.status && item.status !== 'En attente')}
                            onChange={(e) => handleGapAction(item, e.target.value as any)}
                            className="p-1 bg-gray-50 border border-gray-200 rounded text-[9px] font-black uppercase outline-none focus:border-[#121c32] text-[#121c32] disabled:opacity-50"
                          >
                             <option value="En attente">En attente</option>
                             <option value="Régularisé">Régularisé</option>
                             <option value="Payé" disabled={item.gapAmount >= 0}>Payé</option>
                             <option value="Litige">Litige</option>
                             <option value="Annulé">Annulé</option>
                          </select>
                       </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="px-6 py-24 text-center">
                    <div className="flex flex-col items-center gap-3 opacity-20">
                      <AlertTriangle size={48} />
                      <p className="text-sm font-black uppercase tracking-widest">Aucun écart constaté</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>

    {/* Modal de Confirmation */}
    {confirmModal && (
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
        <div className="bg-white rounded-[2rem] w-full max-w-md p-8 shadow-2xl animate-in fade-in zoom-in duration-200">
          <div className="flex flex-col items-center text-center space-y-4">
            <div className="w-16 h-16 bg-amber-50 text-amber-500 rounded-full flex items-center justify-center">
              <AlertCircle size={32} />
            </div>
            <h3 className="text-xl font-black text-[#121c32] uppercase tracking-tight">Confirmation</h3>
            <p className="text-gray-500 font-medium leading-relaxed">{confirmModal.message}</p>
            <div className="flex gap-3 w-full pt-4">
              <button 
                onClick={() => {
                  setConfirmModal(null);
                  loadGaps();
                }}
                className="flex-1 px-6 py-3 bg-gray-100 text-gray-600 rounded-2xl font-black uppercase text-xs tracking-widest hover:bg-gray-200 transition-all active:scale-95"
              >
                Annuler
              </button>
              <button 
                onClick={confirmModal.onConfirm}
                className="flex-1 px-6 py-3 bg-[#121c32] text-white rounded-2xl font-black uppercase text-xs tracking-widest hover:bg-[#1a2947] transition-all active:scale-95 shadow-lg shadow-[#121c32]/20"
              >
                Confirmer
              </button>
            </div>
          </div>
        </div>
      </div>
    )}

    {/* Modal d'Alerte */}
    {alertMessage && (
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[110] flex items-center justify-center p-4">
        <div className="bg-white rounded-[2rem] w-full max-w-md p-8 shadow-2xl animate-in fade-in zoom-in duration-200">
          <div className="flex flex-col items-center text-center space-y-4">
            <div className="w-16 h-16 bg-emerald-50 text-emerald-500 rounded-full flex items-center justify-center">
              <CheckCircle2 size={32} />
            </div>
            <h3 className="text-xl font-black text-[#121c32] uppercase tracking-tight">Information</h3>
            <p className="text-gray-500 font-medium leading-relaxed">{alertMessage}</p>
            <button 
              onClick={() => setAlertMessage(null)}
              className="w-full px-6 py-3 bg-[#121c32] text-white rounded-2xl font-black uppercase text-xs tracking-widest hover:bg-[#1a2947] transition-all active:scale-95 shadow-lg shadow-[#121c32]/20"
            >
              OK
            </button>
          </div>
        </div>
      </div>
    )}
    </>
  );
};

export default CashGaps;
