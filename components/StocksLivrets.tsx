
import React, { useState, useEffect } from 'react';
import { dispatchStorageEvent } from '../utils/events';
import { Package, Plus, Send, History as HistoryIcon, ArrowDownCircle, ArrowUpCircle, User as UserIcon, Download, Search } from 'lucide-react';
import { User } from '../types';
import * as XLSX from 'xlsx';

interface StockDistribution {
  id: string;
  date: string;
  sender?: string;
  recipient: string;
  type: 'epargne' | 'tontine';
  quantity: number;
  status: 'En attente' | 'Validé';
}

interface StockReturn {
  id: string;
  date: string;
  from: string;
  to: string;
  type: 'epargne' | 'tontine';
  quantity: number;
  status: 'En attente' | 'Validé';
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
  returns?: StockReturn[];
}

const StocksLivrets: React.FC = () => {
  const [stocks, setStocks] = useState<LivretsStocks>({
    central: { epargne: 0, tontine: 0 },
    purchases: [],
    distributions: [],
    returns: []
  });

  const [purchaseForm, setPurchaseForm] = useState({ type: 'epargne' as 'epargne' | 'tontine', quantity: 0 });
  const [distribForm, setDistribForm] = useState({ recipient: '', type: 'epargne' as 'epargne' | 'tontine', quantity: 0 });
  const [returnForm, setReturnForm] = useState({ to: '', type: 'tontine' as 'epargne' | 'tontine', quantity: 0 });
  const [prices, setPrices] = useState({ epargne: 300, tontine: 500 });
  const [searchTerm, setSearchTerm] = useState('');
  const [historySearchTerm, setHistorySearchTerm] = useState('');
  const [historyStartDate, setHistoryStartDate] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
  });
  const [historyEndDate, setHistoryEndDate] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
  });
  const [salesData, setSalesData] = useState<any[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [currentUser, setCurrentUser] = useState<any>(() => JSON.parse(localStorage.getItem('microfox_current_user') || '{}'));

  const loadData = () => {
    const savedUser = localStorage.getItem('microfox_current_user');
    if (savedUser) {
      setCurrentUser(JSON.parse(savedUser));
    }
    const savedStocks = localStorage.getItem('microfox_livrets_stocks');
    if (savedStocks) {
      setStocks(JSON.parse(savedStocks));
    }

    const savedUsers = localStorage.getItem('microfox_users');
    if (savedUsers) {
      setUsers(JSON.parse(savedUsers));
    }

    const savedPrices = localStorage.getItem('microfox_livret_prices');
    if (savedPrices) {
      setPrices(JSON.parse(savedPrices));
    }

    const savedMembers = localStorage.getItem('microfox_members_data');
    if (savedMembers) {
      const members = JSON.parse(savedMembers);
      const allSales: any[] = [];
      members.forEach((m: any) => {
        let history = m.history || [];
        if (!history || history.length === 0) {
          const savedHistory = localStorage.getItem(`microfox_history_${m.id}`);
          if (savedHistory) history = JSON.parse(savedHistory);
        }
        
        (history || []).forEach((tx: any) => {
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
    window.addEventListener('microfox_storage' as any, loadData);
    return () => window.removeEventListener('storage', loadData);
      window.removeEventListener('microfox_storage' as any, loadData);
  }, []);

  const saveStocks = (newStocks: LivretsStocks) => {
    localStorage.setItem('microfox_livrets_stocks', JSON.stringify(newStocks));
    setStocks(newStocks);
    dispatchStorageEvent();
  };

  const handlePurchase = (e: React.FormEvent) => {
    e.preventDefault();
    if (purchaseForm.quantity <= 0) return;

    const newPurchase: StockPurchase = {
      id: `${Date.now()}_pur_${Math.random().toString(36).substr(2, 5)}`,
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

    const isCentral = currentUser.role === 'administrateur' || currentUser.role === 'directeur';
    const senderName = isCentral ? 'ADMIN' : currentUser.identifiant;

    if (isCentral) {
      if (stocks.central[distribForm.type] < distribForm.quantity) {
        alert("Stock central insuffisant !");
        return;
      }
    } else {
      const currentStocks = getAgentStocks();
      const myStock = currentStocks[senderName.toLowerCase()]?.[distribForm.type] || 0;
      if (myStock < distribForm.quantity) {
        alert("Votre stock est insuffisant !");
        return;
      }
    }

    const recipientUser = users.find(u => u.identifiant === distribForm.recipient);
    if (recipientUser?.role === 'agent commercial' && distribForm.type === 'epargne') {
      alert("Les agents commerciaux n'ont pas le droit de recevoir les livrets épargne.");
      return;
    }

    const newDistrib: StockDistribution = {
      id: `${Date.now()}_dist_${Math.random().toString(36).substr(2, 5)}`,
      date: new Date().toISOString(),
      sender: senderName,
      recipient: (distribForm.recipient || '').trim(),
      type: distribForm.type,
      quantity: distribForm.quantity,
      status: 'En attente'
    };

    const newStocks = {
      ...stocks,
      central: isCentral ? {
        ...stocks.central,
        [distribForm.type]: stocks.central[distribForm.type] - distribForm.quantity
      } : stocks.central,
      distributions: [newDistrib, ...stocks.distributions]
    };

    saveStocks(newStocks);
    setDistribForm({ ...distribForm, quantity: 0, recipient: '' });
  };

  const handleReturn = (e: React.FormEvent) => {
    e.preventDefault();
    if (returnForm.quantity <= 0 || !returnForm.to) return;

    const currentStocks = getAgentStocks();
    const myStock = currentStocks[currentUser.identifiant.toLowerCase()]?.[returnForm.type] || 0;

    if (myStock < returnForm.quantity) {
      alert("Votre stock est insuffisant pour effectuer ce retour !");
      return;
    }

    const newReturn: StockReturn = {
      id: `${Date.now()}_ret_${Math.random().toString(36).substr(2, 5)}`,
      date: new Date().toISOString(),
      from: currentUser.identifiant,
      to: returnForm.to,
      type: returnForm.type,
      quantity: returnForm.quantity,
      status: 'En attente'
    };

    const newStocks = {
      ...stocks,
      returns: [newReturn, ...(stocks.returns || [])]
    };

    saveStocks(newStocks);
    setReturnForm({ ...returnForm, quantity: 0, to: '' });
  };

  const handleConfirm = (id: string, mType: 'RÉPARTITION' | 'RETOUR') => {
    const newStocks = { ...stocks };
    
    if (mType === 'RÉPARTITION') {
      newStocks.distributions = stocks.distributions.map(d => 
        d.id === id ? { ...d, status: 'Validé' } : d
      );
    } else {
      newStocks.returns = (stocks.returns || []).map(r => {
        if (r.id === id) {
          const updated = { ...r, status: 'Validé' as const };
          if (r.to === 'ADMIN') {
            newStocks.central = {
              ...newStocks.central,
              [r.type]: newStocks.central[r.type] + r.quantity
            };
          }
          return updated;
        }
        return r;
      });
    }

    saveStocks(newStocks);
  };

  // Calculate current stock per user
  const getAgentStocks = () => {
    const userStocks: Record<string, { epargne: number, tontine: number }> = {};

    // Initialize for all relevant users
    users.forEach(u => {
      if (u.role === 'agent commercial' || u.role === 'caissier') {
        userStocks[u.identifiant.toLowerCase()] = { epargne: 0, tontine: 0 };
      }
    });

    // Distributions
    stocks.distributions.forEach(d => {
      const recipient = (d.recipient || '').trim().toLowerCase();
      const sender = (d.sender || 'ADMIN').trim().toLowerCase();

      // Recipient only gets stock if validated
      if (d.status === 'Validé' && userStocks[recipient]) {
        userStocks[recipient][d.type] += d.quantity;
      }
      // Sender loses stock immediately
      if (sender !== 'admin' && userStocks[sender]) {
        userStocks[sender][d.type] -= d.quantity;
      }
    });

    // Returns
    (stocks.returns || []).forEach(r => {
      const from = (r.from || '').trim().toLowerCase();
      const to = (r.to || 'ADMIN').trim().toLowerCase();

      // Sender loses stock immediately
      if (userStocks[from]) {
        userStocks[from][r.type] -= r.quantity;
      }
      // Recipient only gets stock if validated
      if (r.status === 'Validé' && to !== 'admin' && userStocks[to]) {
        userStocks[to][r.type] += r.quantity;
      }
    });

    salesData.forEach(s => {
      const desc = (s.description || '').toLowerCase();
      let agentName = "Inconnu";
      if (desc.includes('- agent ')) {
        agentName = (s.description.split(/ - Agent /i)[1] || "Inconnu").trim().toLowerCase();
      }

      if (userStocks[agentName]) {
        if (desc.includes('épargne')) userStocks[agentName].epargne -= 1;
        else if (desc.includes('tontine')) userStocks[agentName].tontine -= 1;
      }
    });

    return userStocks;
  };

  const agentStocks = getAgentStocks();

  const handleExportHistory = () => {
    const data = [
      ...stocks.purchases.map(p => ({ ...p, mType: 'ACHAT' })), 
      ...stocks.distributions.map(d => ({ ...d, mType: 'RÉPARTITION' })),
      ...(stocks.returns || []).map(r => ({ ...r, mType: 'RETOUR' }))
    ]
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .map((m: any) => ({
        'Date': new Date(m.date).toLocaleString(),
        'Type': m.mType,
        'Détails': m.mType === 'ACHAT' ? `Approvisionnement Livret ${m.type === 'epargne' ? 'Épargne' : 'Tontine'}` : 
                  m.mType === 'RÉPARTITION' ? `Remis à ${m.recipient} par ${m.sender || 'ADMIN'} (${m.type === 'epargne' ? 'Épargne' : 'Tontine'})` :
                  `Retourné par ${m.from} à ${m.to === 'ADMIN' ? 'Stock Central' : m.to} (${m.type === 'epargne' ? 'Épargne' : 'Tontine'})`,
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
            <h2 className="text-sm font-black text-white uppercase tracking-widest">
              {(currentUser.role === 'caissier' || currentUser.role === 'agent commercial') ? 'Votre Stock Épargne' : `Stock Central Épargne (${prices.epargne}F)`}
            </h2>
          </div>
          <div className="text-4xl font-black text-emerald-500">
            {(currentUser.role === 'caissier' || currentUser.role === 'agent commercial') 
              ? (agentStocks[currentUser.identifiant.toLowerCase()]?.epargne || 0)
              : stocks.central.epargne} 
            <span className="text-sm text-gray-400 uppercase"> Unités</span>
          </div>
        </div>

        <div className="bg-[#121c32] p-6 rounded-[2rem] border border-gray-800 shadow-xl">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center">
              <ArrowDownCircle size={20} />
            </div>
            <h2 className="text-sm font-black text-white uppercase tracking-widest">
              {(currentUser.role === 'caissier' || currentUser.role === 'agent commercial') ? 'Votre Stock Tontine' : `Stock Central Tontine (${prices.tontine}F)`}
            </h2>
          </div>
          <div className="text-4xl font-black text-amber-500">
            {(currentUser.role === 'caissier' || currentUser.role === 'agent commercial') 
              ? (agentStocks[currentUser.identifiant.toLowerCase()]?.tontine || 0)
              : stocks.central.tontine} 
            <span className="text-sm text-gray-400 uppercase"> Unités</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Approvisionnement Form - Only for Admin/Director */}
        {(currentUser.role === 'administrateur' || currentUser.role === 'directeur') && (
          <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-gray-100">
            <div className="flex items-center gap-3 mb-6">
              <Plus className="text-indigo-600" size={24} />
              <h2 className="text-lg font-black text-[#121c32] uppercase tracking-tight">Approvisionner le Stock Central</h2>
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
        )}

        {/* Répartition Form */}
        {(currentUser.role === 'administrateur' || currentUser.role === 'directeur' || currentUser.role === 'caissier') && (
          <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-gray-100">
            <div className="flex items-center gap-3 mb-2">
              <Send className="text-emerald-600" size={24} />
              <h2 className="text-lg font-black text-[#121c32] uppercase tracking-tight">Répartir les Livrets</h2>
            </div>
            <p className="text-[10px] text-gray-400 font-bold uppercase mb-6 italic">Utilisez ce formulaire pour donner des livrets aux agents commerciaux.</p>
            <form onSubmit={handleDistribution} className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Bénéficiaire</label>
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
                    .filter(u => !u.isBlocked && (
                      (currentUser.role === 'caissier' ? u.role === 'agent commercial' : (u.role === 'agent commercial' || u.role === 'caissier'))
                    ) && u.identifiant !== currentUser.identifiant)
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
        )}

        {/* Retour Form */}
        {(currentUser.role === 'agent commercial' || currentUser.role === 'caissier') && (
          <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-gray-100">
            <div className="flex items-center gap-3 mb-2">
              <ArrowUpCircle className="text-red-600" size={24} />
              <h2 className="text-lg font-black text-[#121c32] uppercase tracking-tight">Retourner des Livrets</h2>
            </div>
            <p className="text-[10px] text-gray-400 font-bold uppercase mb-6 italic">Utilisez ce formulaire pour retourner les livrets restants à l'administration.</p>
            <form onSubmit={handleReturn} className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Destinataire du Retour</label>
                <select 
                  value={returnForm.to}
                  onChange={(e) => setReturnForm({ ...returnForm, to: e.target.value })}
                  className="w-full p-3 bg-gray-50 border border-gray-100 rounded-2xl outline-none text-sm font-bold text-[#121c32]"
                >
                  <option value="">-- Sélectionner un destinataire --</option>
                  {currentUser.role === 'agent commercial' ? (
                    users
                      .filter(u => u.role === 'caissier' && !u.isBlocked)
                      .map(u => (
                        <option key={u.id} value={u.identifiant}>
                          {u.identifiant} ({u.caisse || 'Caisse'})
                        </option>
                      ))
                  ) : (
                    <option value="ADMIN">Administration (Stock Central)</option>
                  )}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Type de Livret</label>
                  <select 
                    value={returnForm.type}
                    onChange={(e) => setReturnForm({ ...returnForm, type: e.target.value as any })}
                    className="w-full p-3 bg-gray-50 border border-gray-100 rounded-2xl outline-none text-sm font-bold text-[#121c32]"
                  >
                    {currentUser.role === 'caissier' && <option value="epargne">Compte Épargne</option>}
                    <option value="tontine">Compte Tontine</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Quantité</label>
                  <input 
                    type="number" 
                    value={returnForm.quantity || ''}
                    onChange={(e) => setReturnForm({ ...returnForm, quantity: parseInt(e.target.value) || 0 })}
                    placeholder="Ex: 5"
                    className="w-full p-3 bg-gray-50 border border-gray-100 rounded-2xl outline-none text-sm font-bold text-[#121c32]"
                  />
                </div>
              </div>
              <button type="submit" className="w-full bg-red-600 text-white py-4 rounded-2xl font-black uppercase tracking-widest shadow-lg hover:bg-red-700 transition-all active:scale-95">
                Confirmer le Retour
              </button>
            </form>
          </div>
        )}
      </div>

      {/* Agent Stocks Table */}
      <div className="bg-white rounded-[2.5rem] shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-6 border-b border-gray-50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <UserIcon className="text-indigo-600" size={20} />
            <h2 className="text-lg font-black text-[#121c32] uppercase tracking-tight">Stocks Restants par Agent</h2>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative flex-1 sm:flex-none">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
              <input 
                type="text"
                placeholder="Rechercher un agent..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 pr-4 py-2 bg-gray-50 border border-gray-100 rounded-2xl outline-none text-xs font-bold text-[#121c32] w-full sm:w-64 focus:border-indigo-300 transition-all"
              />
            </div>
            <button 
              onClick={handleExportAgentStocks}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-50 text-indigo-600 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-100 transition-all"
            >
              <Download size={14} />
              Exporter
            </button>
          </div>
        </div>
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-left min-w-[600px]">
            <thead>
              <tr className="bg-gray-50">
                <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">AGENT / DESTINATION</th>
                <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest text-center">LIVRETS ÉPARGNE</th>
                <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest text-center">LIVRETS TONTINE</th>
                <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest text-right">STATUT</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {Object.entries(agentStocks).filter(([agent]) => {
                const matchesRole = currentUser.role !== 'agent commercial' || agent.toLowerCase() === currentUser.identifiant.toLowerCase();
                const matchesSearch = agent.toLowerCase().includes(searchTerm.toLowerCase());
                return matchesRole && matchesSearch;
              }).length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center text-gray-400 font-medium">Aucun résultat trouvé.</td>
                </tr>
              ) : (
                Object.entries(agentStocks)
                  .filter(([agent]) => {
                    const matchesRole = currentUser.role !== 'agent commercial' || agent.toLowerCase() === currentUser.identifiant.toLowerCase();
                    const matchesSearch = agent.toLowerCase().includes(searchTerm.toLowerCase());
                    return matchesRole && matchesSearch;
                  })
                  .map(([agent, s]) => (
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
      </div>

      {/* History Table */}
      <div className="bg-white rounded-[2.5rem] shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-6 border-b border-gray-50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <HistoryIcon className="text-indigo-600" size={20} />
            <h2 className="text-lg font-black text-[#121c32] uppercase tracking-tight">Historique des Mouvements</h2>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 bg-gray-50 px-3 py-1.5 rounded-2xl border border-gray-100">
              <span className="text-[10px] font-black text-gray-400 uppercase">Du</span>
              <input 
                type="date" 
                value={historyStartDate}
                onChange={(e) => setHistoryStartDate(e.target.value)}
                className="bg-transparent outline-none text-xs font-bold text-[#121c32]"
              />
              <span className="text-[10px] font-black text-gray-400 uppercase">Au</span>
              <input 
                type="date" 
                value={historyEndDate}
                onChange={(e) => setHistoryEndDate(e.target.value)}
                className="bg-transparent outline-none text-xs font-bold text-[#121c32]"
              />
            </div>
            <div className="relative flex-1 sm:flex-none">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
              <input 
                type="text"
                placeholder="Rechercher un agent..."
                value={historySearchTerm}
                onChange={(e) => setHistorySearchTerm(e.target.value)}
                className="pl-10 pr-4 py-2 bg-gray-50 border border-gray-100 rounded-2xl outline-none text-xs font-bold text-[#121c32] w-full sm:w-64 focus:border-indigo-300 transition-all"
              />
            </div>
            <button 
              onClick={handleExportHistory}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-50 text-indigo-600 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-100 transition-all"
            >
              <Download size={14} />
              Exporter
            </button>
          </div>
        </div>
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-left min-w-[800px]">
            <thead className="sticky top-0 bg-gray-50 z-10">
              <tr>
                <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">DATE</th>
                <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">TYPE</th>
                <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">DÉTAILS</th>
                <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest text-center">STATUT</th>
                <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest text-right">QUANTITÉ</th>
                <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest text-right">ACTION</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {[
                ...stocks.purchases.map(p => ({ ...p, mType: 'ACHAT' })), 
                ...stocks.distributions.map(d => ({ ...d, mType: 'RÉPARTITION' })),
                ...(stocks.returns || []).map(r => ({ ...r, mType: 'RETOUR' })),
                ...salesData.map(s => ({ ...s, mType: 'VENTE', type: s.description.toLowerCase().includes('épargne') ? 'epargne' : 'tontine', quantity: 1 }))
              ]
                .filter((m: any) => {
                  const mDate = new Date(m.date);
                  const start = historyStartDate ? new Date(historyStartDate) : null;
                  const end = historyEndDate ? new Date(historyEndDate) : null;
                  
                  if (start) {
                    start.setHours(0, 0, 0, 0);
                    if (mDate < start) return false;
                  }
                  if (end) {
                    end.setHours(23, 59, 59, 999);
                    if (mDate > end) return false;
                  }

                  const matchesRole = (() => {
                    const myId = (currentUser.identifiant || "").toLowerCase().trim();
                    if (currentUser.role === 'administrateur' || currentUser.role === 'directeur') return true;
                    if (m.mType === 'ACHAT') return false;
                    if (m.mType === 'RÉPARTITION') return (m.recipient || "").toLowerCase().trim() === myId || (m.sender && m.sender.toLowerCase().trim() === myId);
                    if (m.mType === 'RETOUR') return (m.from || "").toLowerCase().trim() === myId || (m.to || "").toLowerCase().trim() === myId;
                    if (m.mType === 'VENTE') {
                      const agentName = (m.description.split(/ - Agent /i)[1] || "").trim().toLowerCase();
                      return agentName === myId;
                    }
                    return false;
                  })();

                  const matchesSearch = (() => {
                    if (!historySearchTerm) return true;
                    const search = historySearchTerm.toLowerCase();
                    if (m.mType === 'ACHAT') return false;
                    if (m.mType === 'RÉPARTITION') return m.recipient.toLowerCase().includes(search) || (m.sender && m.sender.toLowerCase().includes(search));
                    if (m.mType === 'RETOUR') return m.from.toLowerCase().includes(search) || m.to.toLowerCase().includes(search);
                    if (m.mType === 'VENTE') {
                      const agentName = (m.description.split(/ - Agent /i)[1] || "").trim().toLowerCase();
                      return agentName.includes(search) || m.memberName.toLowerCase().includes(search);
                    }
                    return false;
                  })();

                  return matchesRole && matchesSearch;
                })
                .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                .map((m: any, idx: number) => {
                  const isPositive = (() => {
                    const myId = currentUser.identifiant.toLowerCase();
                    if (m.mType === 'ACHAT') return true;
                    if (m.mType === 'RÉPARTITION') return m.recipient.toLowerCase() === myId || (currentUser.role !== 'agent commercial' && m.sender === 'ADMIN');
                    if (m.mType === 'RETOUR') return m.to.toLowerCase() === myId || (currentUser.role !== 'agent commercial' && m.to === 'ADMIN');
                    if (m.mType === 'VENTE') return false;
                    return false;
                  })();

                  return (
                    <tr key={`${m.id}_${idx}`} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4">
                        <span className="text-xs font-bold text-gray-500">{new Date(m.date).toLocaleString()}</span>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-1 rounded-lg text-[10px] font-black uppercase ${
                          m.mType === 'ACHAT' ? 'bg-indigo-100 text-indigo-700' : 
                          m.mType === 'RÉPARTITION' ? 'bg-emerald-100 text-emerald-700' : 
                          m.mType === 'VENTE' ? 'bg-amber-100 text-amber-700' :
                          'bg-red-100 text-red-700'
                        }`}>
                          {m.mType}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm font-bold text-[#121c32]">
                          {m.mType === 'ACHAT' ? `Approvisionnement Livret ${m.type === 'epargne' ? 'Épargne' : 'Tontine'}` : 
                           m.mType === 'RÉPARTITION' ? `Remis à ${m.recipient} par ${m.sender || 'ADMIN'} (${m.type === 'epargne' ? 'Épargne' : 'Tontine'})` :
                           m.mType === 'VENTE' ? `Vendu à ${m.memberName} (${m.type === 'epargne' ? 'Épargne' : 'Tontine'})` :
                           `Retourné par ${m.from} à ${m.to === 'ADMIN' ? 'Stock Central' : m.to} (${m.type === 'epargne' ? 'Épargne' : 'Tontine'})`}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        {m.mType !== 'ACHAT' && m.mType !== 'VENTE' && (
                          <span className={`px-2 py-1 rounded-lg text-[10px] font-black uppercase ${
                            m.status === 'Validé' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                          }`}>
                            {m.status}
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <span className={`text-sm font-black ${isPositive ? 'text-emerald-600' : 'text-red-600'}`}>
                          {isPositive ? '+' : '-'}{m.quantity}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        {m.mType !== 'ACHAT' && m.mType !== 'VENTE' && m.status === 'En attente' && (
                          (m.mType === 'RÉPARTITION' && (m.recipient || "").toLowerCase().trim() === (currentUser.identifiant || "").toLowerCase().trim()) ||
                          (m.mType === 'RETOUR' && (
                            (m.to === 'ADMIN' && (currentUser.role === 'administrateur' || currentUser.role === 'directeur')) ||
                            ((m.to || "").toLowerCase().trim() === (currentUser.identifiant || "").toLowerCase().trim())
                          ))
                        ) && (
                          <button 
                            onClick={() => handleConfirm(m.id, m.mType)}
                            className="px-3 py-1 bg-emerald-600 text-white rounded-lg text-xs font-black uppercase tracking-widest hover:bg-emerald-700 transition-all active:scale-95 shadow-lg border-2 border-emerald-400/30"
                          >
                            Confirmer
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default StocksLivrets;
