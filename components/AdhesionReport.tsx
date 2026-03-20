import React, { useState, useEffect } from 'react';
import { Search, History, Cloud, Calendar, Download, Printer, UserCheck, FileText } from 'lucide-react';

const AdhesionReport: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [startDate, setStartDate] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
  });
  const [adhesions, setAdhesions] = useState<any[]>([]);

  const loadData = () => {
    const userStr = localStorage.getItem('microfox_current_user');
    const user = userStr ? JSON.parse(userStr) : null;
    const isCaissier = user?.role === 'caissier';

    const saved = localStorage.getItem('microfox_members_data');
    if (saved) {
      const allMembers = JSON.parse(saved);
      let allAdhesions: any[] = [];
      allMembers.forEach((member: any) => {
        const paidPS = member.balances?.partSociale || 0;
        const restePS = Math.max(0, 5000 - paidPS);
        
        if (member.history) {
          member.history.forEach((tx: any) => {
            if (isCaissier && tx.userId !== user.id) return;
            const desc = (tx.description || '').toLowerCase();
            if (desc.includes('adhésion')) {
              allAdhesions.push({
                ...tx,
                memberName: member.name,
                memberCode: member.code,
                restePartSociale: restePS
              });
            }
          });
        }
      });
      // Sort by date desc
      allAdhesions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      setAdhesions(allAdhesions);
    }
  };

  useEffect(() => {
    loadData();
    window.addEventListener('storage', loadData);
    return () => window.removeEventListener('storage', loadData);
  }, []);

  const filteredAdhesions = adhesions.filter(tx => {
    const matchesSearch = tx.memberName.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          tx.memberCode.toLowerCase().includes(searchTerm.toLowerCase());
    const txDate = tx.date.split('T')[0];
    const matchesStartDate = !startDate || txDate >= startDate;
    const matchesEndDate = !endDate || txDate <= endDate;
    return matchesSearch && matchesStartDate && matchesEndDate;
  });

  const totalAmount = filteredAdhesions.reduce((acc, tx) => acc + tx.amount, 0);

  const generateHTMLContent = (isForPrint = false) => {
    if (filteredAdhesions.length === 0) return null;
    const mfConfig = JSON.parse(localStorage.getItem('microfox_mf_config') || '{"nom": "MicroFoX", "adresse": "", "code": ""}');
    const headers = ["Date", "Client", "Code", "Libellé", "Montant"];
    
    const htmlContent = `
      <!DOCTYPE html>
      <html lang="fr">
      <head>
        <meta charset="UTF-8">
        <title>Rapport des Adhésions - ${mfConfig.nom}</title>
        <style>
          body { font-family: sans-serif; padding: 20px; color: #121c32; }
          .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #00c896; padding-bottom: 10px; }
          .mf-name { font-size: 24px; font-weight: 900; text-transform: uppercase; margin: 0; }
          .mf-address { font-size: 12px; font-weight: bold; color: #666; margin: 5px 0; }
          h2 { color: #121c32; margin-top: 20px; text-transform: uppercase; }
          table { width: 100%; border-collapse: collapse; margin-top: 20px; }
          th { background-color: #121c32; color: white; text-align: left; padding: 12px 8px; font-size: 11px; text-transform: uppercase; }
          td { border-bottom: 1px solid #eee; padding: 10px 8px; font-size: 13px; }
          tr:nth-child(even) { background-color: #f9fafb; }
          .amount { font-weight: bold; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1 class="mf-name">${mfConfig.nom}</h1>
          <p class="mf-address">${mfConfig.adresse}</p>
          <p class="mf-address">Tél: ${mfConfig.telephone || 'N/A'} | Code: ${mfConfig.code}</p>
        </div>
        <h2>Rapport des Frais d'Adhésion</h2>
        <div style="margin-bottom: 20px;">
          <p>Période: ${startDate || 'Début'} au ${endDate || 'Aujourd\'hui'}</p>
          <p>Total cumulé: <strong>${totalAmount.toLocaleString()} F</strong></p>
        </div>
        <table>
          <thead>
            <tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr>
          </thead>
          <tbody>
            ${filteredAdhesions.map(tx => `
              <tr>
                <td>${new Date(tx.date).toLocaleDateString()}</td>
                <td>${tx.memberName}</td>
                <td>${tx.memberCode}${tx.restePartSociale > 0 && tx.description?.toLowerCase().includes('part sociale') ? `<br><small style="color: #d97706">Reste PS: ${tx.restePartSociale.toLocaleString()} F</small>` : ''}</td>
                <td>${tx.description}</td>
                <td class="amount">${tx.amount.toLocaleString()} F</td>
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
    link.download = `rapport_adhesions_${new Date().toISOString().split('T')[0]}.html`;
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

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-12">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-extrabold text-[#121c32] uppercase tracking-tight">Rapport Adhésions</h1>
          <p className="text-gray-500 text-sm font-medium mt-1">Suivi des frais d'adhésion des membres</p>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 text-blue-600 rounded-lg border border-blue-100 text-xs font-bold">
          <Cloud size={16} />
          <span>SYNC LIVE</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-[#121c32] p-6 rounded-[2rem] text-white shadow-xl relative overflow-hidden group">
          <div className="absolute top-4 right-4 text-emerald-400/20 group-hover:scale-110 transition-transform">
            <UserCheck size={48} strokeWidth={1} />
          </div>
          <p className="text-[10px] font-bold text-gray-600 uppercase tracking-widest">Total Adhésions</p>
          <p className="text-3xl font-black text-emerald-400 mt-1">{totalAmount.toLocaleString()} F</p>
        </div>
        <div className="bg-white p-6 rounded-[2rem] border border-gray-100 shadow-sm">
          <p className="text-[10px] font-black text-gray-600 uppercase tracking-widest">Nombre d'Adhésions</p>
          <p className="text-3xl font-black text-[#121c32] mt-1">{filteredAdhesions.length}</p>
        </div>
        <div className="bg-white p-6 rounded-[2rem] border border-gray-100 shadow-sm flex items-center justify-center">
           <div className="text-center">
             <p className="text-[10px] font-black text-gray-600 uppercase tracking-widest mb-2">Période Active</p>
             <div className="flex items-center gap-2 text-xs font-bold text-[#121c32]">
               <Calendar size={14} className="text-emerald-500" />
               <span>{new Date(startDate).toLocaleDateString()} - {new Date(endDate).toLocaleDateString()}</span>
             </div>
           </div>
        </div>
      </div>

      <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-gray-100 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
           <div className="space-y-1">
            <label className="text-[10px] font-black text-gray-600 uppercase tracking-widest ml-1">Du</label>
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-full p-3 bg-gray-50 border border-gray-100 rounded-2xl outline-none text-sm font-bold text-[#121c32] shadow-sm" />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-black text-gray-600 uppercase tracking-widest ml-1">Au</label>
            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-full p-3 bg-gray-50 border border-gray-100 rounded-2xl outline-none text-sm font-bold text-[#121c32] shadow-sm" />
          </div>
        </div>
        
        <div className="flex flex-col sm:flex-row gap-4 items-center">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
            <input 
              type="text" 
              placeholder="Rechercher par nom ou code client..." 
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
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-gray-50 bg-gray-50/50">
                <th className="px-6 py-4 text-[10px] font-black text-gray-600 uppercase tracking-widest">Date</th>
                <th className="px-6 py-4 text-[10px] font-black text-gray-600 uppercase tracking-widest">Client</th>
                <th className="px-6 py-4 text-[10px] font-black text-gray-600 uppercase tracking-widest">Libellé</th>
                <th className="px-6 py-4 text-[10px] font-black text-gray-600 uppercase tracking-widest text-right">Montant</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filteredAdhesions.length > 0 ? (
                filteredAdhesions.map((tx) => (
                  <tr key={tx.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-5">
                      <p className="text-sm font-bold text-[#121c32]">{new Date(tx.date).toLocaleDateString()}</p>
                      <p className="text-[10px] text-gray-400">{new Date(tx.date).toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'})}</p>
                    </td>
                    <td className="px-6 py-5">
                      <p className="text-sm font-black text-[#121c32] uppercase">{tx.memberName}</p>
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{tx.memberCode}</p>
                      {tx.restePartSociale > 0 && tx.description?.toLowerCase().includes('part sociale') && (
                        <p className="text-[9px] font-black text-amber-600 uppercase tracking-tighter mt-1">
                          Reste Part Sociale: {tx.restePartSociale.toLocaleString()} F
                        </p>
                      )}
                    </td>
                    <td className="px-6 py-5">
                      <span className="px-2 py-1 bg-blue-50 text-blue-600 rounded-lg text-[10px] font-black uppercase tracking-widest">{tx.description}</span>
                    </td>
                    <td className="px-6 py-5 text-right">
                      <span className="text-sm font-black text-[#121c32]">
                        {tx.amount.toLocaleString()} F
                      </span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={4} className="px-6 py-20 text-center">
                    <div className="flex flex-col items-center gap-3 opacity-20">
                      <FileText size={48} />
                      <p className="text-sm font-black uppercase tracking-widest">Aucun frais d'adhésion trouvé</p>
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

export default AdhesionReport;
