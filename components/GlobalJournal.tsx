import React, { useState, useEffect } from 'react';
import { Search, History, ArrowDownLeft, ArrowUpRight, Cloud, Calendar, Download, Printer, CheckSquare, Square } from 'lucide-react';

const GlobalJournal: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [startDate, setStartDate] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
  });
  const [transactions, setTransactions] = useState<any[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const loadData = () => {
    const saved = localStorage.getItem('microfox_members_data');
    if (saved) {
      const allMembers = JSON.parse(saved);
      
      const savedUser = localStorage.getItem('microfox_current_user');
      const user = savedUser ? JSON.parse(savedUser) : {};

      let allTxs: any[] = [];
      allMembers.forEach((member: any) => {
        if (member.history) {
          member.history.forEach((tx: any) => {
            // Filter by user if caissier
            if (user.role === 'caissier') {
              if (tx.userId !== user.id) return;
            }
            
            // Filter by zone if agent commercial
            if (user.role === 'agent commercial') {
              if (member.zone !== user.zoneCollecte) return;
            }

            allTxs.push({
              ...tx,
              memberName: member.name,
              memberCode: member.code
            });
          });
        }
      });

      // Load Caisse operations for caissiers, admins and directors
      if (user.role === 'caissier' || user.role === 'administrateur' || user.role === 'directeur') {
        const savedPayments = localStorage.getItem('microfox_agent_payments');
        if (savedPayments) {
          const payments = JSON.parse(savedPayments);
          payments.forEach((p: any) => {
            if (p.status === 'Validé') {
              if (user.role === 'caissier' && p.validatorId !== user.id) return;
              
              allTxs.push({
                id: p.id,
                date: p.date,
                type: 'depot',
                amount: p.observedAmount || p.totalAmount,
                description: `Versement Agent: ${p.agentName}`,
                memberName: 'CAISSE',
                memberCode: p.caisse || 'N/A',
                account: 'caisse'
              });
            }
          });
        }

        const savedVault = localStorage.getItem('microfox_vault_transactions');
        if (savedVault) {
          const vaultTxs = JSON.parse(savedVault);
          vaultTxs.forEach((v: any) => {
            if (user.role === 'caissier' && v.userId !== user.id) return;

            allTxs.push({
              id: v.id,
              date: v.date,
              type: 'retrait',
              amount: v.amount,
              description: v.type,
              memberName: 'COFFRE',
              memberCode: v.from,
              account: 'coffre'
            });
          });
        }

        // Load Administrative Expenses
        const savedExpenses = localStorage.getItem('microfox_admin_expenses');
        if (savedExpenses) {
          const expenses = JSON.parse(savedExpenses);
          expenses.forEach((e: any) => {
            // Filter by user if caissier
            if (user.role === 'caissier' && e.recordedBy !== user.identifiant) return;

            allTxs.push({
              id: e.id,
              date: e.date,
              type: 'retrait',
              amount: e.amount,
              description: `Dépense: ${e.description} (${e.category})`,
              memberName: 'ADMIN',
              memberCode: e.recordedBy,
              account: 'dépense'
            });
          });
        }
      }

      // Sort by date desc
      allTxs.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      setTransactions(allTxs);
    }
  };

  const generateHTMLContent = (isForPrint = false) => {
    if (filteredTxs.length === 0) return null;
    const headers = ["Date", "Client", "Code", "Opération", "Compte", "Type", "Montant"];
    
    const mfConfig = JSON.parse(localStorage.getItem('microfox_mf_config') || '{"nom": "MicroFoX", "adresse": "", "code": ""}');

    const htmlContent = `
      <!DOCTYPE html>
      <html lang="fr">
      <head>
        <meta charset="UTF-8">
        <title>Journal Global - ${mfConfig.nom}</title>
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
          .credit { color: #059669; font-weight: bold; }
          .debit { color: #dc2626; font-weight: bold; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1 class="mf-name">${mfConfig.nom}</h1>
          <p class="mf-address">${mfConfig.adresse}</p>
          <p class="mf-address">Tél: ${mfConfig.telephone || 'N/A'} | Code: ${mfConfig.code}</p>
        </div>
        <h2>Journal Global des Opérations</h2>
        <div style="margin-bottom: 20px;">
          <p>Extraits de compte consolidés</p>
          <p>Période: ${startDate || 'Début'} au ${endDate || 'Aujourd\'hui'}</p>
        </div>
        <table>
          <thead>
            <tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr>
          </thead>
          <tbody>
            ${filteredTxs.map(tx => {
              const isCredit = tx.type === 'depot' || tx.type === 'cotisation' || tx.type === 'remboursement';
              const isDebit = tx.type === 'retrait' || tx.type === 'transfert' || tx.type === 'deblocage';
              const typeLabel = isCredit ? 'Entrée' : (isDebit ? 'Sortie' : 'Autre');
              return `
              <tr>
                <td>${new Date(tx.date).toLocaleDateString()} ${new Date(tx.date).toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'})}</td>
                <td>${tx.memberName}</td>
                <td>${tx.memberCode}</td>
                <td>${tx.description}</td>
                <td>${tx.account.toUpperCase()}</td>
                <td class="${isCredit ? 'credit' : (isDebit ? 'debit' : '')}">${typeLabel}</td>
                <td class="${isCredit ? 'credit' : (isDebit ? 'debit' : '')}">${isCredit ? '+' : (isDebit ? '-' : '')}${tx.amount.toLocaleString()} F</td>
              </tr>
            `}).join('')}
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
    if (!htmlContent) return alert("Aucune donnée à exporter.");
    const blob = new Blob([htmlContent], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `journal_global_${new Date().toISOString().split('T')[0]}.html`;
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
    loadData();
    window.addEventListener('storage', loadData);
    return () => window.removeEventListener('storage', loadData);
  }, []);

  const filteredTxs = transactions.filter(tx => {
    const matchesSearch = tx.memberName.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          tx.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          tx.memberCode.toLowerCase().includes(searchTerm.toLowerCase());
    const txDate = tx.date.split('T')[0];
    const matchesStartDate = !startDate || txDate >= startDate;
    const matchesEndDate = !endDate || txDate <= endDate;
    return matchesSearch && matchesStartDate && matchesEndDate;
  });

  const totals = filteredTxs.reduce((acc, tx) => {
    const isCredit = tx.type === 'depot' || tx.type === 'cotisation' || tx.type === 'remboursement';
    const isDebit = tx.type === 'retrait' || tx.type === 'transfert' || tx.type === 'deblocage';
    if (isCredit) acc.credit += tx.amount;
    else if (isDebit) acc.debit += tx.amount;
    return acc;
  }, { credit: 0, debit: 0 });

  const selectedSum = filteredTxs
    .filter(tx => selectedIds.includes(tx.id))
    .reduce((acc, tx) => acc + tx.amount, 0);

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === filteredTxs.length && filteredTxs.length > 0) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredTxs.map(tx => tx.id));
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-8 pb-12 px-4 sm:px-6 lg:px-8">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-extrabold text-white uppercase tracking-tight">Journal Global</h1>
          <p className="text-gray-400 text-sm font-medium mt-1">Historique consolidé de toutes les opérations</p>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-50 text-emerald-600 rounded-lg border border-emerald-100 text-xs font-bold">
          <Cloud size={16} />
          <span>SYNC LIVE</span>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4 sm:p-6 rounded-[2rem] border border-gray-100 shadow-sm">
          <p className="text-[10px] sm:text-xs font-black text-gray-600 uppercase tracking-widest">Total Entrées</p>
          <p className="text-lg sm:text-2xl font-black text-emerald-600 mt-1">{totals.credit.toLocaleString()} F</p>
        </div>
        <div className="bg-white p-4 sm:p-6 rounded-[2rem] border border-gray-100 shadow-sm">
          <p className="text-[10px] sm:text-xs font-black text-gray-600 uppercase tracking-widest">Total Sorties</p>
          <p className="text-lg sm:text-2xl font-black text-red-600 mt-1">{totals.debit.toLocaleString()} F</p>
        </div>
        <div className="bg-[#121c32] p-4 sm:p-6 rounded-[2rem] text-white shadow-xl">
          <p className="text-[10px] sm:text-xs font-bold text-gray-400 uppercase tracking-widest">Flux Net</p>
          <p className="text-lg sm:text-2xl font-black text-amber-400 mt-1">{(totals.credit - totals.debit).toLocaleString()} F</p>
        </div>
        <div className={`p-4 sm:p-6 rounded-[2rem] transition-all shadow-xl ${selectedIds.length > 0 ? 'bg-blue-600 text-white animate-in zoom-in-95' : 'bg-gray-100 text-gray-400'}`}>
          <p className="text-[10px] sm:text-xs font-black uppercase tracking-widest">Cumul ({selectedIds.length})</p>
          <p className={`text-lg sm:text-2xl font-black mt-1 ${selectedIds.length > 0 ? 'text-white' : 'text-gray-300'}`}>{selectedSum.toLocaleString()} F</p>
        </div>
      </div>

      <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-gray-100 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
           <div className="space-y-1">
            <label className="text-xs font-black text-gray-600 uppercase tracking-widest ml-1">Début</label>
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-full p-3 bg-gray-50 border border-gray-100 rounded-2xl outline-none text-sm font-bold text-[#121c32] shadow-sm" />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-black text-gray-600 uppercase tracking-widest ml-1">Fin</label>
            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-full p-3 bg-gray-50 border border-gray-100 rounded-2xl outline-none text-sm font-bold text-[#121c32] shadow-sm" />
          </div>
        </div>
        
        <div className="flex flex-col sm:flex-row gap-4 items-center">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
            <input 
              type="text" 
              placeholder="Rechercher par client, code ou libellé..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-12 pr-4 py-4 bg-gray-50 border border-transparent focus:border-[#00c896] rounded-2xl outline-none text-sm font-medium transition-all"
            />
          </div>
          <div className="flex gap-2 w-full sm:w-auto">
            <button 
              onClick={handleExport}
              className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-3 bg-white border border-gray-200 rounded-xl text-xs font-black text-gray-400 hover:text-emerald-500 transition-all shadow-sm active:scale-95 uppercase tracking-widest"
            >
              <Download size={16} /> Exporter
            </button>
            <button 
              onClick={handlePrint}
              className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-3 bg-white border border-gray-200 rounded-xl text-xs font-black text-gray-400 hover:text-blue-500 transition-all shadow-sm active:scale-95 uppercase tracking-widest"
            >
              <Printer size={16} /> Imprimer
            </button>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-[2rem] shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto scrollbar-hide">
          <table className="w-full text-left min-w-[850px]">
            <thead>
              <tr className="border-b border-gray-50 bg-gray-50/50">
                <th className="px-4 py-4 w-10">
                  <button onClick={toggleSelectAll} className="text-gray-400 hover:text-[#00c896] transition-colors">
                    {selectedIds.length === filteredTxs.length && filteredTxs.length > 0 ? <CheckSquare size={20} className="text-[#00c896]" /> : <Square size={20} />}
                  </button>
                </th>
                <th className="px-4 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest whitespace-nowrap">Date / Opération</th>
                <th className="px-4 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest whitespace-nowrap">Client</th>
                <th className="px-4 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest whitespace-nowrap">Compte</th>
                <th className="px-4 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest text-right whitespace-nowrap">Montant</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filteredTxs.length > 0 ? (
                filteredTxs.map((tx) => (
                  <tr 
                    key={tx.id} 
                    className={`hover:bg-gray-50 transition-colors cursor-pointer group ${selectedIds.includes(tx.id) ? 'bg-blue-50/30' : ''}`}
                    onClick={() => toggleSelect(tx.id)}
                  >
                    <td className="px-4 py-5" onClick={(e) => e.stopPropagation()}>
                      <button onClick={() => toggleSelect(tx.id)} className="text-gray-300 hover:text-blue-500 transition-colors">
                        {selectedIds.includes(tx.id) ? <CheckSquare size={18} className="text-blue-600" /> : <Square size={18} />}
                      </button>
                    </td>
                    <td className="px-4 py-5">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 shrink-0 rounded-xl flex items-center justify-center ${tx.type === 'depot' || tx.type === 'cotisation' || tx.type === 'remboursement' ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}`}>
                          {tx.type === 'depot' || tx.type === 'cotisation' || tx.type === 'remboursement' ? <ArrowDownLeft size={18} /> : <ArrowUpRight size={18} />}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-black text-[#121c32] uppercase truncate max-w-[200px]">{tx.description}</p>
                          <p className="text-[10px] font-bold text-gray-400 uppercase">{new Date(tx.date).toLocaleDateString()} {new Date(tx.date).toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'})}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-5">
                      <p className="text-sm font-black text-[#121c32] uppercase whitespace-nowrap">{tx.memberName}</p>
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{tx.memberCode}</p>
                    </td>
                    <td className="px-4 py-5">
                      <span className="px-2 py-1 bg-gray-100 rounded-lg text-[10px] font-black text-gray-500 uppercase tracking-widest whitespace-nowrap">{tx.account}</span>
                    </td>
                    <td className="px-4 py-5 text-right">
                      <span className={`text-sm font-black whitespace-nowrap ${tx.type === 'depot' || tx.type === 'cotisation' || tx.type === 'remboursement' ? 'text-emerald-600' : 'text-red-600'}`}>
                        {tx.type === 'depot' || tx.type === 'cotisation' || tx.type === 'remboursement' ? '+' : '-'}{tx.amount.toLocaleString()} F
                      </span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="px-6 py-20 text-center">
                    <div className="flex flex-col items-center gap-3 opacity-20">
                      <History size={48} />
                      <p className="text-sm font-black uppercase tracking-widest">Aucune opération trouvée</p>
                    </div>
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

export default GlobalJournal;