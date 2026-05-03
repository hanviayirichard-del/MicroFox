import React, { useState, useEffect } from 'react';
import { TrendingUp, Search, History, FileText } from 'lucide-react';

interface Member {
  id: string;
  name: string;
  code: string;
  zone: string;
  epargneAccountNumber?: string;
  tontineAccounts?: { number: string }[];
  balances: {
    epargne: number;
    tontine: number;
    credit: number;
  };
  lastCreditRequest?: any;
  lastCreditDetails?: any;
}

const CreditGranted: React.FC = () => {
  const [members, setMembers] = useState<Member[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  const loadData = () => {
    const data = localStorage.getItem('microfox_members_data');
    if (data) {
      setMembers(JSON.parse(data));
    }
  };

  useEffect(() => {
    loadData();
    window.addEventListener('storage', loadData);
    window.addEventListener('microfox_storage' as any, loadData);
    return () => {
      window.removeEventListener('storage', loadData);
      window.removeEventListener('microfox_storage' as any, loadData);
    };
  }, []);

  const activeCredits = members.filter(m => {
    const userStr = localStorage.getItem('microfox_current_user');
    const currentUser = userStr ? JSON.parse(userStr) : {};
    
    // Filter by agent zones if agent
    if (currentUser.role === 'agent commercial') {
      const allowedZones = currentUser.zonesCollecte || (currentUser.zoneCollecte ? [currentUser.zoneCollecte] : []);
      if (allowedZones.length > 0) {
        return allowedZones.includes(m.zone);
      }
    }
    return true;
  }).filter(m => (m.balances?.credit || 0) > 0)
    .filter(m => {
      const search = searchTerm.toLowerCase();
      return m.name.toLowerCase().includes(search) || m.code.toLowerCase().includes(search);
    });

  const sortedCredits = [...activeCredits].sort((a, b) => {
    let valA = '';
    let valB = '';
    
    if (sortBy === 'zone') {
      valA = a.zone || '';
      valB = b.zone || '';
    } else if (sortBy === 'type') {
      valA = a.lastCreditRequest?.creditType || '';
      valB = b.lastCreditRequest?.creditType || '';
    } else {
      valA = a.name || '';
      valB = b.name || '';
    }
    
    return sortOrder === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
  });

  const totalOutstanding = activeCredits.reduce((sum, m) => sum + (m.balances?.credit || 0), 0);

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-[#121c32] uppercase tracking-tight">Suivi des Crédits</h1>
          <p className="text-gray-700 text-sm font-medium mt-1">Recherche et suivi des crédits accordés en cours</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          <div className="relative flex-1 md:w-64">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-600" size={20} />
            <input
              type="text"
              placeholder="Rechercher par nom ou code..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-12 pr-4 py-3 bg-white border border-gray-200 rounded-2xl outline-none focus:border-emerald-500 font-medium text-[#121c32] transition-all shadow-sm"
            />
          </div>
          <div className="flex items-center gap-2">
            <select 
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="p-3 bg-white border border-gray-200 rounded-2xl text-[10px] font-black text-[#121c32] outline-none focus:border-emerald-500 uppercase tracking-tight shadow-sm appearance-none"
            >
              <option value="name">Trier par Nom</option>
              <option value="zone">Trier par Zone</option>
              <option value="type">Trier par Type</option>
            </select>
            <button 
              onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
              className="p-3 bg-white border border-gray-200 rounded-2xl text-[10px] font-black text-[#121c32] uppercase tracking-tight hover:bg-gray-50 shadow-sm"
            >
              {sortOrder === 'asc' ? '↑ ASC' : '↓ DESC'}
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-[2rem] border border-gray-100 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <TrendingUp size={24} />
          </div>
          <div>
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Total Encours</p>
            <p className="text-xl font-black text-[#121c32]">{totalOutstanding.toLocaleString()} F</p>
          </div>
        </div>
        
        <div className="bg-white p-6 rounded-[2rem] border border-gray-100 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center">
            <FileText size={24} />
          </div>
          <div>
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Nombre de Dossiers</p>
            <p className="text-xl font-black text-[#121c32]">{activeCredits.length}</p>
          </div>
        </div>

        <div className="bg-white p-6 rounded-[2rem] border border-gray-100 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center">
            <History size={24} />
          </div>
          <div>
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Moyenne / Dossier</p>
            <p className="text-xl font-black text-[#121c32]">{activeCredits.length > 0 ? Math.round(totalOutstanding / activeCredits.length).toLocaleString() : 0} F</p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-[2.5rem] shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left min-w-[800px]">
            <thead>
              <tr className="bg-gray-50/50">
                <th className="px-6 py-4 text-[10px] font-black text-gray-600 uppercase tracking-widest">Membre</th>
                <th className="px-6 py-4 text-[10px] font-black text-gray-600 uppercase tracking-widest">Zone & Type</th>
                <th className="px-6 py-4 text-[10px] font-black text-gray-600 uppercase tracking-widest text-right">Solde Crédit</th>
                <th className="px-6 py-4 text-[10px] font-black text-gray-600 uppercase tracking-widest">Dernier Déblocage</th>
                <th className="px-6 py-4 text-[10px] font-black text-gray-600 uppercase tracking-widest">Échéance</th>
                <th className="px-6 py-4 text-[10px] font-black text-gray-600 uppercase tracking-widest text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {sortedCredits.length > 0 ? sortedCredits.map((member, idx) => (
                <tr key={`${member.id}-${idx}`} className="hover:bg-gray-50/30 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-[#121c32] text-white flex items-center justify-center font-black text-sm">
                        {member.name.split(' ').map(n => n[0]).join('')}
                      </div>
                      <div>
                        <p className="text-sm font-black text-[#121c32] uppercase">{member.name}</p>
                        <p className="text-[10px] font-bold text-gray-600 uppercase tracking-tight">{member.code}</p>
                        <div className="mt-1 space-y-0.5">
                          <p className="text-[9px] font-bold text-blue-600 uppercase tracking-tight">
                            EP: {member.epargneAccountNumber || '---'}
                          </p>
                          <p className="text-[9px] font-bold text-amber-600 uppercase tracking-tight">
                            Tontine: {member.tontineAccounts && member.tontineAccounts.length > 0 ? member.tontineAccounts.map(a => a.number).join(', ') : '---'}
                          </p>
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <p className="text-xs font-black text-blue-600 uppercase tracking-tight">Zone: {member.zone || '---'}</p>
                    <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mt-1">{member.lastCreditRequest?.creditType || '---'}</p>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <p className="text-sm font-black text-red-600">{(member.balances?.credit || 0).toLocaleString()} F</p>
                    <div className="mt-1 space-y-0.5">
                      <p className="text-[9px] font-bold text-gray-500 uppercase tracking-tight">Cap: {(member.lastCreditDetails?.capital || member.lastCreditRequest?.capital || 0).toLocaleString()} F</p>
                      <p className="text-[9px] font-bold text-gray-500 uppercase tracking-tight">Int: {(member.lastCreditDetails?.interest || member.lastCreditRequest?.interest || 0).toLocaleString()} F</p>
                      <p className="text-[9px] font-bold text-gray-500 uppercase tracking-tight">Pén: {(member.lastCreditDetails?.penalty || member.lastCreditRequest?.penalty || 0).toLocaleString()} F</p>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm font-medium text-gray-700">
                    {member.lastCreditRequest?.disbursementDate ? new Date(member.lastCreditRequest.disbursementDate).toLocaleDateString() : 'N/A'}
                  </td>
                  <td className="px-6 py-4 text-sm font-medium text-gray-700">
                    {member.lastCreditRequest?.dueDate ? new Date(member.lastCreditRequest.dueDate).toLocaleDateString() : 'N/A'}
                  </td>
                  <td className="px-6 py-4 text-center">
                    <button className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="Voir l'historique">
                      <History size={18} />
                    </button>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={6} className="px-6 py-20 text-center">
                    <div className="w-16 h-16 bg-gray-50 text-gray-300 rounded-full flex items-center justify-center mx-auto mb-4">
                      <TrendingUp size={32} />
                    </div>
                    <p className="text-gray-500 font-medium italic">Aucun crédit actif trouvé.</p>
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

export default CreditGranted;
