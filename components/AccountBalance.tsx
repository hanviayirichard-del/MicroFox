import React, { useState, useEffect } from 'react';
import { Search, Landmark, Wallet, Gem, CreditCard, TrendingUp, History, Download, Printer, User } from 'lucide-react';
import { ClientAccount } from '../types';

const AccountBalance: React.FC = () => {
  const [members, setMembers] = useState<ClientAccount[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'name' | 'code'>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  const loadData = () => {
    const saved = localStorage.getItem('microfox_members_data');
    if (saved) {
      setMembers(JSON.parse(saved));
    }
  };

  useEffect(() => {
    loadData();
    window.addEventListener('storage', loadData);
    return () => window.removeEventListener('storage', loadData);
  }, []);

  const filteredMembers = members.filter(m => {
    const search = searchTerm.toLowerCase();
    return m.name.toLowerCase().includes(search) || m.code.toLowerCase().includes(search);
  });

  const sortedMembers = [...filteredMembers].sort((a, b) => {
    let valA = sortBy === 'name' ? a.name : a.code;
    let valB = sortBy === 'name' ? b.name : b.code;
    return sortOrder === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
  });

  const calculateCreditDetails = (m: ClientAccount) => {
    const total = m.balances?.credit || 0;
    if (total === 0) return { capital: 0, interest: 0 };

    const initialCap = m.lastCreditDetails?.capital || m.lastCreditRequest?.capital || (total * 0.9);
    const initialInt = m.lastCreditDetails?.interest || m.lastCreditRequest?.interest || (total * 0.1);
    const initialTot = Number(initialCap) + Number(initialInt);

    if (Math.abs(total - initialTot) < 1) {
      return { capital: Number(initialCap), interest: Number(initialInt) };
    } else {
      const capRatio = initialTot > 0 ? Number(initialCap) / initialTot : 0.9;
      const intRatio = initialTot > 0 ? Number(initialInt) / initialTot : 0.1;
      return {
        capital: Math.floor(total * capRatio),
        interest: Math.floor(total * intRatio)
      };
    }
  };

  const stats = {
    totalClients: members.length,
    totalEpargne: members.reduce((sum, m) => sum + (m.balances?.epargne || 0), 0),
    totalTontine: members.reduce((sum, m) => sum + (m.balances?.tontine || 0), 0),
    totalGarantie: members.reduce((sum, m) => sum + (m.balances?.garantie || 0), 0),
    totalPartSociale: members.reduce((sum, m) => sum + (m.balances?.partSociale || 0), 0),
    totalCreditCap: members.reduce((sum, m) => sum + calculateCreditDetails(m).capital, 0),
    totalCreditInt: members.reduce((sum, m) => sum + calculateCreditDetails(m).interest, 0),
    both: members.filter(m => (m.tontineAccounts?.length || 0) > 0 && m.epargneAccountNumber).length,
    savingsOnly: members.filter(m => (!m.tontineAccounts?.length) && m.epargneAccountNumber).length,
    tontineOnly: members.filter(m => (m.tontineAccounts?.length || 0) > 0 && !m.epargneAccountNumber).length,
  };

  const generateHTMLContent = (isForPrint = false) => {
    if (members.length === 0) return null;
    const mfConfig = JSON.parse(localStorage.getItem('microfox_mf_config') || '{"nom": "MicroFoX", "adresse": "", "code": ""}');
    
    const htmlContent = `
      <!DOCTYPE html>
      <html lang="fr">
      <head>
        <meta charset="UTF-8">
        <title>Balance des Comptes - ${mfConfig.nom}</title>
        <style>
          body { font-family: sans-serif; padding: 20px; color: #121c32; }
          .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #f1f5f9; padding-bottom: 15px; }
          .mf-name { font-size: 20px; font-weight: 900; text-transform: uppercase; margin: 0; }
          .report-title { font-size: 16px; font-weight: 800; margin: 15px 0; text-transform: uppercase; text-align: center; }
          table { width: 100%; border-collapse: collapse; margin-top: 15px; font-size: 10px; }
          th { background: #f8fafc; padding: 8px; text-align: left; text-transform: uppercase; color: #64748b; border-bottom: 1px solid #e2e8f0; }
          td { padding: 8px; border-bottom: 1px solid #f1f5f9; }
          .text-right { text-align: right; }
          .font-bold { font-weight: bold; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1 class="mf-name">${mfConfig.nom}</h1>
          <h2 class="report-title">Balance des Comptes Clients</h2>
          <p style="font-size: 10px; color: #64748b;">Généré le ${new Date().toLocaleString()}</p>
        </div>
        <table>
          <thead>
            <tr>
              <th>Client</th>
              <th>N° Tontine</th>
              <th>N° Épargne</th>
              <th class="text-right">Épargne</th>
              <th class="text-right">Tontine</th>
              <th class="text-right">Garanties</th>
              <th class="text-right">Part Sociale</th>
              <th class="text-right">Crédit (Cap)</th>
              <th class="text-right">Crédit (Int)</th>
            </tr>
          </thead>
          <tbody>
            ${sortedMembers.map(m => {
              const credit = calculateCreditDetails(m);
              return `
                <tr>
                  <td><span class="font-bold">${m.name}</span><br/>${m.code}</td>
                  <td>${m.tontineAccounts?.map(t => t.number).join(', ') || '---'}</td>
                  <td>${m.epargneAccountNumber || '---'}</td>
                  <td class="text-right">${(m.balances?.epargne || 0).toLocaleString()}</td>
                  <td class="text-right">${(m.balances?.tontine || 0).toLocaleString()}</td>
                  <td class="text-right">${(m.balances?.garantie || 0).toLocaleString()}</td>
                  <td class="text-right">${(m.balances?.partSociale || 0).toLocaleString()}</td>
                  <td class="text-right">${(credit.capital).toLocaleString()}</td>
                  <td class="text-right">${(credit.interest).toLocaleString()}</td>
                </tr>
              `;
            }).join('')}
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
    if (!htmlContent) return;
    const blob = new Blob([htmlContent], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `balance_comptes_${new Date().toISOString().split('T')[0]}.html`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePrint = () => {
    const htmlContent = generateHTMLContent(true);
    if (!htmlContent) return;
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(htmlContent);
      printWindow.document.close();
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-12">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-white uppercase tracking-tight">Balance des Comptes</h1>
          <p className="text-gray-400 text-sm font-medium mt-1">État global des soldes par client</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative w-full md:w-64">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input 
              type="text" 
              placeholder="Rechercher..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-[#121c32] border border-gray-800 rounded-xl outline-none focus:border-emerald-500 text-sm font-medium text-white transition-all"
            />
          </div>
          <button onClick={handlePrint} className="p-2.5 bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white rounded-xl transition-all border border-white/5">
            <Printer size={20} />
          </button>
          <button onClick={handleExport} className="p-2.5 bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white rounded-xl transition-all border border-white/5">
            <Download size={20} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="bg-[#121c32] p-6 rounded-[2rem] border border-gray-800 shadow-sm">
          <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">Nombre de Clients</p>
          <p className="text-xl font-black text-white">
            {stats.totalClients.toLocaleString()}
          </p>
        </div>
        <div className="bg-[#121c32] p-6 rounded-[2rem] border border-gray-800 shadow-sm">
          <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">Total Épargne</p>
          <p className="text-xl font-black text-emerald-500">
            {stats.totalEpargne.toLocaleString()} F
          </p>
        </div>
        <div className="bg-[#121c32] p-6 rounded-[2rem] border border-gray-800 shadow-sm">
          <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">Total Tontine</p>
          <p className="text-xl font-black text-amber-500">
            {stats.totalTontine.toLocaleString()} F
          </p>
        </div>
        <div className="bg-[#121c32] p-6 rounded-[2rem] border border-gray-800 shadow-sm">
          <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">Total Garanties</p>
          <p className="text-xl font-black text-blue-500">
            {stats.totalGarantie.toLocaleString()} F
          </p>
        </div>
        <div className="bg-[#121c32] p-6 rounded-[2rem] border border-gray-800 shadow-sm">
          <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">Total Crédits (Cap)</p>
          <p className="text-xl font-black text-red-500">
            {stats.totalCreditCap.toLocaleString()} F
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-[#121c32] p-6 rounded-[2rem] border border-gray-800 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
            <User size={24} />
          </div>
          <div>
            <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Épargne & Tontine</p>
            <p className="text-xl font-black text-white">{stats.both}</p>
          </div>
        </div>
        <div className="bg-[#121c32] p-6 rounded-[2rem] border border-gray-800 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-blue-500/10 text-blue-500 flex items-center justify-center">
            <Landmark size={24} />
          </div>
          <div>
            <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Épargne Uniquement</p>
            <p className="text-xl font-black text-white">{stats.savingsOnly}</p>
          </div>
        </div>
        <div className="bg-[#121c32] p-6 rounded-[2rem] border border-gray-800 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-500 flex items-center justify-center">
            <Wallet size={24} />
          </div>
          <div>
            <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Tontine Uniquement</p>
            <p className="text-xl font-black text-white">{stats.tontineOnly}</p>
          </div>
        </div>
      </div>

      <div className="bg-[#121c32] rounded-[2.5rem] shadow-sm border border-gray-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-black/20">
                <th className="px-6 py-4 text-[10px] font-black text-gray-500 uppercase tracking-widest">Client</th>
                <th className="px-6 py-4 text-[10px] font-black text-gray-500 uppercase tracking-widest">Comptes</th>
                <th className="px-6 py-4 text-[10px] font-black text-gray-500 uppercase tracking-widest text-right">Épargne</th>
                <th className="px-6 py-4 text-[10px] font-black text-gray-500 uppercase tracking-widest text-right">Tontine</th>
                <th className="px-6 py-4 text-[10px] font-black text-gray-500 uppercase tracking-widest text-right">Garanties</th>
                <th className="px-6 py-4 text-[10px] font-black text-gray-500 uppercase tracking-widest text-right">Part Sociale</th>
                <th className="px-6 py-4 text-[10px] font-black text-gray-500 uppercase tracking-widest text-right">Crédit (Cap)</th>
                <th className="px-6 py-4 text-[10px] font-black text-gray-500 uppercase tracking-widest text-right">Crédit (Int)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {sortedMembers.map((m) => {
                const credit = calculateCreditDetails(m);
                return (
                  <tr key={m.id} className="hover:bg-white/5 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-500 flex items-center justify-center font-black text-xs">
                          {m.name.charAt(0)}
                        </div>
                        <div>
                          <p className="text-sm font-black text-white uppercase">{m.name}</p>
                          <p className="text-[10px] font-bold text-gray-500 uppercase tracking-tight">{m.code}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="space-y-1">
                        <p className="text-[9px] font-bold text-blue-400 uppercase tracking-tight">ÉP: {m.epargneAccountNumber || '---'}</p>
                        <p className="text-[9px] font-bold text-amber-400 uppercase tracking-tight">
                          TN: {m.tontineAccounts?.length > 0 ? m.tontineAccounts.map(t => t.number).join(', ') : '---'}
                        </p>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <p className="text-sm font-black text-emerald-500">{(m.balances?.epargne || 0).toLocaleString()}</p>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <p className="text-sm font-black text-amber-500">{(m.balances?.tontine || 0).toLocaleString()}</p>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <p className="text-sm font-black text-blue-500">{(m.balances?.garantie || 0).toLocaleString()}</p>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <p className="text-sm font-black text-purple-500">{(m.balances?.partSociale || 0).toLocaleString()}</p>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <p className="text-sm font-black text-red-500">{(credit.capital).toLocaleString()}</p>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <p className="text-sm font-black text-orange-500">{(credit.interest).toLocaleString()}</p>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot className="bg-black/40 border-t border-gray-700">
              <tr>
                <td colSpan={2} className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Totaux</td>
                <td className="px-6 py-4 text-right">
                  <p className="text-sm font-black text-emerald-500">{stats.totalEpargne.toLocaleString()}</p>
                </td>
                <td className="px-6 py-4 text-right">
                  <p className="text-sm font-black text-amber-500">{stats.totalTontine.toLocaleString()}</p>
                </td>
                <td className="px-6 py-4 text-right">
                  <p className="text-sm font-black text-blue-500">{stats.totalGarantie.toLocaleString()}</p>
                </td>
                <td className="px-6 py-4 text-right">
                  <p className="text-sm font-black text-purple-500">{stats.totalPartSociale.toLocaleString()}</p>
                </td>
                <td className="px-6 py-4 text-right">
                  <p className="text-sm font-black text-red-500">{stats.totalCreditCap.toLocaleString()}</p>
                </td>
                <td className="px-6 py-4 text-right">
                  <p className="text-sm font-black text-orange-500">{stats.totalCreditInt.toLocaleString()}</p>
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
};

export default AccountBalance;
