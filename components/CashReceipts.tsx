import React, { useState, useEffect } from 'react';
import { Search, History as HistoryIcon, ArrowDownLeft, ArrowUpRight, Cloud, Calendar, Download, Printer, CheckSquare, Square, User, Landmark, Wallet } from 'lucide-react';

const CashReceipts: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [startDate, setStartDate] = useState(() => {
    const now = new Date();
    return now.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => {
    const now = new Date();
    return now.toISOString().split('T')[0];
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
      const isRestricted = user.role !== 'administrateur' && user.role !== 'superviseur';

      allMembers.forEach((member: any) => {
        if (member.history) {
          member.history.forEach((tx: any) => {
            // Strict filter for user: only their own operations
            if (isRestricted && String(tx.userId) !== String(user.id)) return;
            
            let tontineAccountNumber = tx.tontineAccountNumber || '';
            if (!tontineAccountNumber && tx.tontineAccountId) {
              const acc = member.tontineAccounts?.find((a: any) => a.id === tx.tontineAccountId);
              if (acc) tontineAccountNumber = acc.number;
            }

            allTxs.push({
              ...tx,
              tontineAccountNumber,
              epargneAccountNumber: member.epargneAccountNumber || '',
              zone: tx.zone || member.zone || '',
              memberName: member.name,
              memberCode: member.code,
              category: 'CLIENT'
            });
          });
        }
      });

      // Load Agent payments
      const savedPayments = localStorage.getItem('microfox_agent_payments');
      if (savedPayments) {
        const payments = JSON.parse(savedPayments);
        payments.forEach((p: any) => {
          if (p.status === 'Validé') {
            // Strict filter for user: only their own operations (as agent or validator)
            if (isRestricted && String(p.agentId) !== String(user.id) && String(p.validatorId) !== String(user.id)) return;
            
            allTxs.push({
              id: p.id,
              date: p.date,
              type: 'depot',
              amount: p.observedAmount || p.totalAmount,
              description: `Versement Agent: ${p.agentName}`,
              memberName: p.agentName,
              memberCode: p.agentId || 'AGENT',
              account: 'caisse',
              category: 'AGENT',
              zone: p.zone,
              amountCotisations: p.amountCotisations,
              amountLivrets: p.amountLivrets,
              nbLivrets: p.nbLivrets
            });
          }
        });
      }

      // Load Caisse/Vault operations
      const savedVault = localStorage.getItem('microfox_vault_transactions');
      if (savedVault) {
        const vaultTxs = JSON.parse(savedVault);
        vaultTxs.forEach((v: any) => {
          // Strict filter for user: only their own vault operations
          if (isRestricted && String(v.userId) !== String(user.id)) return;

          allTxs.push({
            id: v.id,
            date: v.date,
            type: v.type.toLowerCase().includes('versement') ? 'depot' : 'retrait',
            amount: v.amount,
            description: v.type,
            memberName: 'COFFRE/BANQUE',
            memberCode: v.from || 'N/A',
            account: 'coffre',
            category: 'AUTRE'
          });
        });
      }

      // Load Administrative Expenses
      const savedExpenses = localStorage.getItem('microfox_admin_expenses');
      if (savedExpenses) {
        const expenses = JSON.parse(savedExpenses);
        expenses.forEach((e: any) => {
          // Respect soft delete flag
          if (e.isDeleted) return;
          
          // Strict filter for user: only their own recorded expenses
          if (isRestricted && String(e.recordedBy) !== String(user.identifiant)) return;

          allTxs.push({
            id: e.id,
            date: e.date,
            type: 'retrait',
            amount: e.amount,
            description: `Dépense: ${e.description}`,
            memberName: 'ADMINISTRATION',
            memberCode: e.recordedBy,
            account: 'dépense',
            category: 'AUTRE'
          });
        });
      }

      allTxs.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      setTransactions(allTxs);
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

  const generateReceiptHTML = (isForPrint = false) => {
    const selectedTxs = filteredTxs.filter(tx => selectedIds.includes(tx.id));
    if (selectedTxs.length === 0) return null;

    const mfConfig = JSON.parse(localStorage.getItem('microfox_mf_config') || '{"nom": "MicroFoX", "adresse": "", "code": ""}');
    const currentUser = JSON.parse(localStorage.getItem('microfox_current_user') || '{}');

    const htmlContent = `
      <!DOCTYPE html>
      <html lang="fr">
      <head>
        <meta charset="UTF-8">
        <title>Reçus de Caisse - ${mfConfig.nom}</title>
        <style>
          @media print {
            .no-print { display: none; }
            body { margin: 0; padding: 0; }
            .page-break { page-break-after: always; }
          }
          body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; color: #121c32; background: #fff; }
          .receipt-container { 
            width: 210mm; 
            min-height: 297mm; 
            padding: 10mm; 
            box-sizing: border-box;
            display: flex;
            flex-direction: column;
            gap: 10mm;
          }
          .receipt { 
            border: 1px dashed #ccc; 
            padding: 15px; 
            flex: 1;
            display: flex;
            flex-direction: column;
            position: relative;
            overflow: hidden;
          }
          .receipt-header { display: flex; justify-content: space-between; border-bottom: 2px solid #121c32; padding-bottom: 10px; margin-bottom: 15px; }
          .mf-info { flex: 1; }
          .mf-name { font-size: 18px; font-weight: 900; text-transform: uppercase; margin: 0; color: #00c896; }
          .mf-details { font-size: 10px; font-weight: bold; color: #666; margin: 2px 0; }
          .receipt-title { font-size: 16px; font-weight: 900; text-align: right; text-transform: uppercase; }
          .receipt-body { flex: 1; font-size: 12px; }
          .info-row { display: flex; margin-bottom: 8px; border-bottom: 1px solid #f0f0f0; padding-bottom: 4px; }
          .info-label { font-weight: 800; width: 120px; text-transform: uppercase; font-size: 10px; color: #666; }
          .info-value { font-weight: 700; flex: 1; }
          .amount-box { background: #f8f9fa; border: 2px solid #121c32; padding: 10px; text-align: center; font-size: 20px; font-weight: 900; margin: 15px 0; }
          .signatures { display: flex; justify-content: space-between; margin-top: 30px; }
          .signature-box { text-align: center; width: 45%; }
          .signature-label { font-size: 10px; font-weight: 900; text-transform: uppercase; margin-bottom: 40px; border-bottom: 1px solid #eee; padding-bottom: 5px; }
          .signature-space { height: 60px; border: 1px solid #f0f0f0; border-radius: 8px; }
          .copy-label { position: absolute; top: 50%; right: -20px; transform: rotate(-90deg) translateY(-50%); font-size: 10px; font-weight: 900; color: #ccc; text-transform: uppercase; letter-spacing: 2px; }
          .divider { border-top: 1px dashed #000; margin: 20px 0; position: relative; }
          .divider::after { content: '✂'; position: absolute; top: -10px; left: 50%; background: white; padding: 0 10px; }
        </style>
      </head>
      <body>
        ${selectedTxs.map((tx, index) => {
          const isCredit = tx.type === 'depot' || tx.type === 'cotisation' || tx.type === 'remboursement';
          const typeLabel = isCredit ? 'REÇU DE VERSEMENT' : 'REÇU DE RETRAIT';
          const clientLabel = tx.category === 'CLIENT' ? 'Client' : (tx.category === 'AGENT' ? 'Agent' : 'Bénéficiaire');
          
          const receiptContent = `
            <div class="receipt">
              <div class="copy-label">EXEMPLAIRE ${index % 2 === 0 ? 'CAISSE' : 'CLIENT'}</div>
              <div class="receipt-header">
                <div class="mf-info">
                  <h1 class="mf-name">${mfConfig.nom}</h1>
                  <p class="mf-details">${mfConfig.adresse}</p>
                  <p class="mf-details">Tél: ${mfConfig.telephone || 'N/A'} | Code: ${mfConfig.code}</p>
                </div>
                <div class="receipt-title">
                  ${typeLabel}<br>
                  <span style="font-size: 10px; color: #666;">N° ${tx.id.substring(0, 8).toUpperCase()}</span>
                </div>
              </div>
              <div class="receipt-body">
                <div class="info-row">
                  <span class="info-label">Date & Heure</span>
                  <span class="info-value">${new Date(tx.date).toLocaleString('fr-FR')}</span>
                </div>
                <div class="info-row">
                  <span class="info-label">${clientLabel}</span>
                  <span class="info-value">${tx.memberName} (${tx.memberCode})</span>
                </div>
                <div class="info-row">
                  <span class="info-label">Opération</span>
                  <span class="info-value">${tx.description}</span>
                </div>
                <div class="info-row">
                  <span class="info-label">Compte</span>
                  <span class="info-value">${tx.account.toUpperCase()}</span>
                </div>
                <div class="info-row">
                  <span class="info-label">Caissier</span>
                  <span class="info-value">${tx.cashierName || 'Système'}</span>
                </div>
                ${(tx.amountCotisations !== undefined || tx.amountLivrets !== undefined) ? `
                <div style="margin-top: 10px; border: 1px solid #f0f0f0; border-radius: 8px; padding: 8px; background: #fafafa;">
                  <p style="font-size: 9px; font-weight: 900; text-transform: uppercase; color: #121c32; margin: 0 0 8px 0; border-bottom: 1px solid #eee; padding-bottom: 4px;">Détails du Versement</p>
                  <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
                    <span style="font-size: 10px; font-weight: 800; color: #666; text-transform: uppercase;">Montant Cotisation:</span>
                    <span style="font-size: 10px; font-weight: 900; color: #121c32;">${(tx.amountCotisations || 0).toLocaleString()} F</span>
                  </div>
                  <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
                    <span style="font-size: 10px; font-weight: 800; color: #666; text-transform: uppercase;">Montant Livrets:</span>
                    <span style="font-size: 10px; font-weight: 900; color: #121c32;">${(tx.amountLivrets || 0).toLocaleString()} F</span>
                  </div>
                  <div style="display: flex; justify-content: space-between;">
                    <span style="font-size: 10px; font-weight: 800; color: #666; text-transform: uppercase;">Nombre Livrets:</span>
                    <span style="font-size: 10px; font-weight: 900; color: #121c32;">${tx.nbLivrets || 0}</span>
                  </div>
                </div>
                ` : ''}
                ${isCredit && tx.zone ? `
                <div class="info-row">
                  <span class="info-label">Zone</span>
                  <span class="info-value">${tx.zone}</span>
                </div>
                ` : ''}
                ${tx.tontineAccountNumber ? `
                <div class="info-row">
                  <span class="info-label">N° Tontine</span>
                  <span class="info-value">${tx.tontineAccountNumber}</span>
                </div>
                ` : ''}
                ${tx.epargneAccountNumber ? `
                <div class="info-row">
                  <span class="info-label">N° Compte Épargne</span>
                  <span class="info-value">${tx.epargneAccountNumber}</span>
                </div>
                ` : ''}
                <div class="amount-box">
                  ${tx.amount.toLocaleString()} FCFA
                </div>
                <p style="font-size: 10px; font-style: italic; text-align: center; margin: 0;">Arrêté le présent reçu à la somme de: <strong>${numberToLetter(tx.amount)} Francs CFA</strong></p>
              </div>
              <div class="signatures">
                <div class="signature-box">
                  <div class="signature-label">Signature Caissier</div>
                  <div class="signature-space"></div>
                  <p style="font-size: 9px; margin-top: 5px;">${tx.cashierName || currentUser.identifiant || 'Caissier'}</p>
                </div>
                <div class="signature-box">
                  <div class="signature-label">Signature ${clientLabel}</div>
                  <div class="signature-space"></div>
                  <p style="font-size: 9px; margin-top: 5px;">${tx.memberName}</p>
                </div>
              </div>
            </div>
          `;

          return `
            <div class="receipt-container ${index < selectedTxs.length - 1 ? 'page-break' : ''}">
              ${receiptContent}
              <div class="divider"></div>
              ${receiptContent}
            </div>
          `;
        }).join('')}
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

  const numberToLetter = (amount: number) => {
    // Basic implementation or placeholder
    return amount.toLocaleString(); 
  };

  const handlePrint = () => {
    const html = generateReceiptHTML(true);
    if (!html) return alert("Veuillez cocher au moins une opération.");
    const win = window.open('', '_blank');
    if (win) {
      win.document.write(html);
      win.document.close();
    }
  };

  const handleExport = () => {
    const html = generateReceiptHTML();
    if (!html) return alert("Veuillez cocher au moins une opération.");
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `recus_caisse_${new Date().getTime()}.html`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="max-w-7xl mx-auto space-y-8 pb-12 px-4 sm:px-6 lg:px-8">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-extrabold text-white uppercase tracking-tight">Reçu de caisse</h1>
          <p className="text-gray-400 text-sm font-medium mt-1">Impression et export des reçus d'opérations</p>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-50 text-emerald-600 rounded-lg border border-emerald-100 text-xs font-bold">
          <Printer size={16} />
          <span>ÉDITION REÇUS</span>
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
              className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-6 py-4 bg-white border border-gray-200 rounded-2xl text-xs font-black text-gray-400 hover:text-emerald-500 transition-all shadow-sm active:scale-95 uppercase tracking-widest"
            >
              <Download size={18} /> Exporter
            </button>
            <button 
              onClick={handlePrint}
              className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-6 py-4 bg-blue-600 rounded-2xl text-xs font-black text-white hover:bg-blue-700 transition-all shadow-xl active:scale-95 uppercase tracking-widest"
            >
              <Printer size={18} /> Imprimer ({selectedIds.length})
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
                <th className="px-4 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest whitespace-nowrap">Client / Agent</th>
                <th className="px-4 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest whitespace-nowrap">Catégorie</th>
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
                          <p className="text-sm font-black text-[#121c32] uppercase">{tx.description}</p>
                          <p className="text-[10px] font-bold text-gray-400 uppercase">{new Date(tx.date).toLocaleDateString()} {new Date(tx.date).toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'})}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-5">
                      <p className="text-sm font-black text-[#121c32] uppercase whitespace-nowrap">{tx.memberName}</p>
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{tx.memberCode}</p>
                    </td>
                    <td className="px-4 py-5">
                      <div className="flex items-center gap-2">
                        {tx.category === 'CLIENT' && <User size={14} className="text-blue-500" />}
                        {tx.category === 'AGENT' && <Wallet size={14} className="text-emerald-500" />}
                        {tx.category === 'AUTRE' && <Landmark size={14} className="text-amber-500" />}
                        <span className="px-2 py-1 bg-gray-100 rounded-lg text-[10px] font-black text-gray-500 uppercase tracking-widest whitespace-nowrap">{tx.category}</span>
                      </div>
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
                      <HistoryIcon size={48} />
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

export default CashReceipts;
