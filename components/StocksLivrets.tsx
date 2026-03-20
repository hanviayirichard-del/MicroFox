
import React, { useState, useEffect } from 'react';
import { Package, Plus, Send, History, ArrowDownCircle, ArrowUpCircle, User as UserIcon, Download } from 'lucide-react';
import { User } from '../types';
import * as XLSX from 'xlsx';

interface StockDistribution {
  id: string;
  date: string;
  recipient: string;
  type: 'epargne' | 'tontine';
  quantity: number;
}

interface StockPurchase {
  id: string;
  date: string;
  type: 'epargne' | 'tontine';
  quantity: number;
}

interface LivretsStocks {
  central: {
    epargne: number;
    tontine: number;
  };
  purchases: StockPurchase[];
  distributions: StockDistribution[];
}

const StocksLivrets: React.FC = () => {
  const [stocks, setStocks] = useState<LivretsStocks>({
    central: { epargne: 0, tontine: 0 },
    purchases: [],
    distributions: []
  });

  const [purchaseForm, setPurchaseForm] = useState({ type: 'epargne' as 'epargne' | 'tontine', quantity: 0 });
  const [distribForm, setDistribForm] = useState({ recipient: '', type: 'epargne' as 'epargne' | 'tontine', quantity: 0 });
  const [salesData, setSalesData] = useState<any[]>([]);
  const [users, setUsers] = useState<User[]>([]);

  const loadData = () => {
    const savedStocks = localStorage.getItem('microfox_livrets_stocks');
    if (savedStocks) {
      setStocks(JSON.parse(savedStocks));
    }

    const savedUsers = localStorage.getItem('microfox_users');
    if (savedUsers) {
      setUsers(JSON.parse(savedUsers));
    }

    const savedMembers = localStorage.getItem('microfox_members_data');
    if (savedMembers) {
      const members = JSON.parse(savedMembers);
      const allSales: any[] = [];
      members.forEach((m: any) => {
        (m.history || []).forEach((tx: any) => {
          if (tx.description?.toLowerCase().includes('vente de livret')) {
            allSales.push({ ...tx, memberName: m.name });
          }
        });
      });
      setSalesData(allSales);
    }
  };

  useEffect(() => {
    loadData();
    window.addEventListener('storage', loadData);
    return () => window.removeEventListener('storage', loadData);
  }, []);

  const saveStocks = (newStocks: LivretsStocks) => {
    localStorage.setItem('microfox_livrets_stocks', JSON.stringify(newStocks));
    setStocks(newStocks);
    window.dispatchEvent(new Event('storage'));
  };

  const handlePurchase = (e: React.FormEvent) => {
    e.preventDefault();
    if (purchaseForm.quantity <= 0) return;

    const newPurchase: StockPurchase = {
      id: Date.now().toString(),
      date: new Date().toISOString(),
      type: purchaseForm.type,
      quantity: purchaseForm.quantity
    };

    const newStocks = {
      ...stocks,
      central: {
        ...stocks.central,
        [purchaseForm.type]: stocks.central[purchaseForm.type] + purchaseForm.quantity
      },
      purchases: [newPurchase, ...stocks.purchases]
    };

    saveStocks(newStocks);
    setPurchaseForm({ ...purchaseForm, quantity: 0 });
  };

  const handleDistribution = (e: React.FormEvent) => {
    e.preventDefault();
    if (distribForm.quantity <= 0 || !distribForm.recipient) return;
    if (stocks.central[distribForm.type] < distribForm.quantity) {
      alert("Stock central insuffisant !");
      return;
    }

    const recipientUser = users.find(u => u.identifiant === distribForm.recipient);
    if (recipientUser?.role === 'agent commercial' && distribForm.type === 'epargne') {
      alert("Les agents commerciaux n'ont pas le droit de recevoir les livrets épargne.");
      return;
    }

    const newDistrib: StockDistribution = {
      id: Date.now().toString(),
      date: new Date().toISOString(),
      recipient: (distribForm.recipient || '').trim(),
      type: distribForm.type,
      quantity: distribForm.quantity
    };

    const newStocks = {
      ...stocks,
      central: {
        ...stocks.central,
        [distribForm.type]: stocks.central[distribForm.type] - distribForm.quantity
      },
      distributions: [newDistrib, ...stocks.distributions]
    };

    saveStocks(newStocks);
    setDistribForm({ ...distribForm, quantity: 0, recipient: '' });
  };

  // Calculate current stock per agent
  const getAgentStocks = () => {
    const agents: Record<string, { epargne: number, tontine: number }> = {};

    stocks.distributions.forEach(d => {
      const recipient = (d.recipient || '').trim().toLowerCase();
      if (!agents[recipient]) agents[recipient] = { epargne: 0, tontine: 0 };
      agents[recipient][d.type] += d.quantity;
    });

    salesData.forEach(s => {
      const desc = (s.description || '').toLowerCase();
      let agentName = "Inconnu";
      if (desc.includes('- agent ')) {
        agentName = (s.description.split(/ - Agent /i)[1] || "Inconnu").trim().toLowerCase();
      }

      if (agents[agentName]) {
        if (desc.includes('épargne')) agents[agentName].epargne -= 1;
        else if (desc.includes('tontine')) agents[agentName].tontine -= 1;
      }
    });

    return agents;
  };

  const agentStocks = getAgentStocks();

  const handleExportHistory = () => {
    const data = [...stocks.purchases.map(p => ({ ...p, mType: 'ACHAT' })), ...stocks.distributions.map(d => ({ ...d, mType: 'RÉPARTITION' }))]
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .map((m: any) => ({
        'Date': new Date(m.date).toLocaleString(),
        'Type': m.mType,
        'Détails': m.mType === 'ACHAT' ? `Approvisionnement Livret ${m.type === 'epargne' ? 'Épargne' : 'Tontine'}` : `Remis à ${m.recipient} (${m.type === 'epargne' ? 'Épargne' : 'Tontine'})`,
        'Quantité': m.quantity
      }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Historique Stocks");
    XLSX.writeFile(wb, `historique_stocks_${new Date().getTime()}.xlsx`);
  };

  const handleExportAgentStocks = () => {
    const data = Object.entries(agentStocks).map(([agent, s]) => ({
      'Agent': agent,
      'Livrets Épargne': s.epargne,
      'Livrets Tontine': s.tontine,
      'Total': s.epargne + s.tontine,
      'Statut': s.epargne + s.tontine > 0 ? 'En Stock' : 'Rupture'
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Stocks Agents");
    XLSX.writeFile(wb, `stocks_agents_${new Date().getTime()}.xlsx`);
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-20">
      <div className="flex items-start gap-4">
        <div className="p-3 bg-indigo-100 text-indigo-600 rounded-2xl">
          <Package size={32} />
        </div>
        <div>
          <h1 className="text-2xl font-black text-white uppercase tracking-tight">Gestion des Stocks de Livrets</h1>
          <p className="text-gray-400 font-medium">Suivi des approvisionnements, répartitions et ventes.</p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-[#121c32] p-6 rounded-[2rem] border border-gray-800 shadow-xl">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
              <ArrowDownCircle size={20} />
            </div>
            <h2 className="text-sm font-black text-white uppercase tracking-widest">Stock Central Épargne (500F)</h2>
          </div>
          <div className="text-4xl font-black text-emerald-500">{stocks.central.epargne} <span className="text-sm text-gray-400 uppercase">Unités</span></div>
        </div>

        <div className="bg-[#121c32] p-6 rounded-[2rem] border border-gray-800 shadow-xl">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center">
              <ArrowDownCircle size={20} />
            </div>
            <h2 className="text-sm font-black text-white uppercase tracking-widest">Stock Central Tontine (300F)</h2>
          </div>
          <div className="text-4xl font-black text-amber-500">{stocks.central.tontine} <span className="text-sm text-gray-400 uppercase">Unités</span></div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Approvisionnement Form */}
        <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-gray-100">
          <div className="flex items-center gap-3 mb-6">
            <Plus className="text-indigo-600" size={24} />
            <h2 className="text-lg font-black text-[#121c32] uppercase tracking-tight">Approvisionner le Stock</h2>
          </div>
          <form onSubmit={handlePurchase} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Type de Livret</label>
                <select 
                  value={purchaseForm.type}
                  onChange={(e) => setPurchaseForm({ ...purchaseForm, type: e.target.value as any })}
                  className="w-full p-3 bg-gray-50 border border-gray-100 rounded-2xl outline-none text-sm font-bold text-[#121c32]"
                >
                  <option value="epargne">Compte Épargne</option>
                  <option value="tontine">Compte Tontine</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Quantité</label>
                <input 
                  type="number" 
                  value={purchaseForm.quantity || ''}
                  onChange={(e) => setPurchaseForm({ ...purchaseForm, quantity: parseInt(e.target.value) || 0 })}
                  placeholder="Ex: 500"
                  className="w-full p-3 bg-gray-50 border border-gray-100 rounded-2xl outline-none text-sm font-bold text-[#121c32]"
                />
              </div>
            </div>
            <button type="submit" className="w-full bg-indigo-600 text-white py-4 rounded-2xl font-black uppercase tracking-widest shadow-lg hover:bg-indigo-700 transition-all active:scale-95">
              Enregistrer l'Achat
            </button>
          </form>
        </div>

        {/* Répartition Form */}
        <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-gray-100">
          <div className="flex items-center gap-3 mb-6">
            <Send className="text-emerald-600" size={24} />
            <h2 className="text-lg font-black text-[#121c32] uppercase tracking-tight">Répartir aux Agents</h2>
          </div>
          <form onSubmit={handleDistribution} className="space-y-4">
            <div className="space-y-1">
              <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Bénéficiaire (Agent / Caissière)</label>
              <select 
                value={distribForm.recipient}
                onChange={(e) => {
                  const recipientId = e.target.value;
                  const user = users.find(u => u.identifiant === recipientId);
                  const newType = (user?.role === 'agent commercial' && distribForm.type === 'epargne') ? 'tontine' : distribForm.type;
                  setDistribForm({ ...distribForm, recipient: recipientId, type: newType as any });
                }}
                className="w-full p-3 bg-gray-50 border border-gray-100 rounded-2xl outline-none text-sm font-bold text-[#121c32]"
              >
                <option value="">-- Sélectionner un bénéficiaire --</option>
                {users
                  .filter(u => !u.isBlocked && (u.role === 'agent commercial' || u.role === 'caissier'))
                  .map(u => (
                    <option key={u.id} value={u.identifiant}>
                      {u.identifiant} ({u.role === 'caissier' ? u.caisse || 'Caisse' : `Zone ${u.zoneCollecte || 'N/A'}`})
                    </option>
                  ))
                }
              </select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Type de Livret</label>
                <select 
                  value={distribForm.type}
                  onChange={(e) => setDistribForm({ ...distribForm, type: e.target.value as any })}
                  className="w-full p-3 bg-gray-50 border border-gray-100 rounded-2xl outline-none text-sm font-bold text-[#121c32]"
                >
                  {(() => {
                    const selectedUser = users.find(u => u.identifiant === distribForm.recipient);
                    const isAgent = selectedUser?.role === 'agent commercial';
                    return (
                      <>
                        {!isAgent && <option value="epargne">Compte Épargne</option>}
                        <option value="tontine">Compte Tontine</option>
                      </>
                    );
                  })()}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Quantité</label>
                <input 
                  type="number" 
                  value={distribForm.quantity || ''}
                  onChange={(e) => setDistribForm({ ...distribForm, quantity: parseInt(e.target.value) || 0 })}
                  placeholder="Ex: 10"
                  className="w-full p-3 bg-gray-50 border border-gray-100 rounded-2xl outline-none text-sm font-bold text-[#121c32]"
                />
              </div>
            </div>
            <button type="submit" className="w-full bg-emerald-600 text-white py-4 rounded-2xl font-black uppercase tracking-widest shadow-lg hover:bg-emerald-700 transition-all active:scale-95">
              Confirmer la Répartition
            </button>
          </form>
        </div>
      </div>

      {/* Agent Stocks Table */}
      <div className="bg-white rounded-[2.5rem] shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-6 border-b border-gray-50 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <UserIcon className="text-indigo-600" size={20} />
            <h2 className="text-lg font-black text-[#121c32] uppercase tracking-tight">Stocks Restants par Agent</h2>
          </div>
          <button 
            onClick={handleExportAgentStocks}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-50 text-indigo-600 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-100 transition-all"
          >
            <Download size={14} />
            Exporter
          </button>
        </div>
        <table className="w-full text-left">
          <thead>
            <tr className="bg-gray-50">
              <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">AGENT / DESTINATION</th>
              <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest text-center">LIVRETS ÉPARGNE</th>
              <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest text-center">LIVRETS TONTINE</th>
              <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest text-right">STATUT</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {Object.entries(agentStocks).length === 0 ? (
              <tr>
                <td colSpan={4} className="px-6 py-12 text-center text-gray-400 font-medium">Aucune répartition effectuée pour le moment.</td>
              </tr>
            ) : (
              Object.entries(agentStocks).map(([agent, s]) => (
                <tr key={agent} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4">
                    <span className="text-sm font-black text-[#121c32] uppercase">{agent}</span>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className={`text-sm font-black ${s.epargne <= 2 ? 'text-red-600' : 'text-emerald-600'}`}>{s.epargne}</span>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className={`text-sm font-black ${s.tontine <= 5 ? 'text-red-600' : 'text-amber-600'}`}>{s.tontine}</span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-tighter ${s.epargne + s.tontine > 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                      {s.epargne + s.tontine > 0 ? 'En Stock' : 'Rupture'}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* History Table */}
      <div className="bg-white rounded-[2.5rem] shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-6 border-b border-gray-50 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <History className="text-indigo-600" size={20} />
            <h2 className="text-lg font-black text-[#121c32] uppercase tracking-tight">Historique des Mouvements</h2>
          </div>
          <button 
            onClick={handleExportHistory}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-50 text-indigo-600 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-100 transition-all"
          >
            <Download size={14} />
            Exporter
          </button>
        </div>
        <div className="max-h-[400px] overflow-y-auto custom-scrollbar">
          <table className="w-full text-left">
            <thead className="sticky top-0 bg-gray-50 z-10">
              <tr>
                <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">DATE</th>
                <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">TYPE</th>
                <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">DÉTAILS</th>
                <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest text-right">QUANTITÉ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {[...stocks.purchases.map(p => ({ ...p, mType: 'ACHAT' })), ...stocks.distributions.map(d => ({ ...d, mType: 'RÉPARTITION' }))]
                .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                .map((m: any) => (
                  <tr key={m.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4">
                      <span className="text-xs font-bold text-gray-500">{new Date(m.date).toLocaleString()}</span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded-lg text-[10px] font-black uppercase ${m.mType === 'ACHAT' ? 'bg-indigo-100 text-indigo-700' : 'bg-emerald-100 text-emerald-700'}`}>
                        {m.mType}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm font-bold text-[#121c32]">
                        {m.mType === 'ACHAT' ? `Approvisionnement Livret ${m.type === 'epargne' ? 'Épargne' : 'Tontine'}` : `Remis à ${m.recipient} (${m.type === 'epargne' ? 'Épargne' : 'Tontine'})`}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <span className={`text-sm font-black ${m.mType === 'ACHAT' ? 'text-indigo-600' : 'text-emerald-600'}`}>
                        {m.mType === 'ACHAT' ? '+' : '-'}{m.quantity}
                      </span>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default StocksLivrets;
