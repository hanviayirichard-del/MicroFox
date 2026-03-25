
import React, { useState, useEffect } from 'react';
import { ShoppingCart, Search, BookOpen, Plus, CheckCircle, AlertCircle, User, Download } from 'lucide-react';
import * as XLSX from 'xlsx';

const VenteLivrets: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [members, setMembers] = useState<any[]>([]);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [selectedType, setSelectedType] = useState<'epargne' | 'tontine'>('tontine');
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [agentStocks, setAgentStocks] = useState<any>(null);
  const [centralStocks, setCentralStocks] = useState<any>({ epargne: 0, tontine: 0 });
  const [salesJournal, setSalesJournal] = useState<any[]>([]);

  const loadData = () => {
    const saved = localStorage.getItem('microfox_members_data');
    const membersData = saved ? JSON.parse(saved) : [];

    const savedUser = localStorage.getItem('microfox_current_user');
    if (!savedUser) return;
    const user = JSON.parse(savedUser);
    setCurrentUser(user);
    const agentName = user.identifiant;
    if (!agentName) return;

    if (user.role === 'agent commercial' && selectedType === 'epargne') {
      setSelectedType('tontine');
    }

    let filteredMembersData = membersData.map((m: any) => {
      let history = m.history || [];
      if (history.length === 0) {
        const savedHistory = localStorage.getItem(`microfox_history_${m.id}`);
        if (savedHistory) history = JSON.parse(savedHistory);
      }
      return { ...m, history };
    });

    if (user.role === 'agent commercial') {
      const agentZones = user.zonesCollecte || (user.zoneCollecte ? [user.zoneCollecte] : []);
      if (agentZones.length > 0) {
        filteredMembersData = filteredMembersData.filter((m: any) => agentZones.includes(m.zone));
      }
    }
    setMembers(filteredMembersData);

    const savedStocks = localStorage.getItem('microfox_livrets_stocks');
    let epargne = 0;
    let tontine = 0;
    let centralEpargne = 0;
    let centralTontine = 0;

    if (savedStocks) {
      const stocks = JSON.parse(savedStocks);
      centralEpargne = stocks.central?.epargne || 0;
      centralTontine = stocks.central?.tontine || 0;
      
      stocks.distributions.forEach((d: any) => {
        if ((d.recipient || '').trim().toLowerCase() === agentName.trim().toLowerCase()) {
          if (d.type === 'epargne') epargne += d.quantity;
          else tontine += d.quantity;
        }
      });
    }

    // Subtract sales - look at ALL members to find sales by this agent
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
    setCentralStocks({ epargne: centralEpargne, tontine: centralTontine });

    // Build Sales Journal - show all sales by the current agent or all sales if admin/caissier
    const allSales: any[] = [];
    membersData.forEach((m: any) => {
      (m.history || []).forEach((tx: any) => {
        const desc = (tx.description || '').toLowerCase();
        if (desc.includes('vente de livret')) {
          // If agent, only show their own sales
          if (user.role === 'agent commercial') {
            if (!desc.includes(`- agent ${agentName.trim().toLowerCase()}`)) return;
          }
          
          allSales.push({
            ...tx,
            memberName: m.name,
            memberCode: m.code
          });
        }
      });
    });
    setSalesJournal(allSales.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
  };

  useEffect(() => {
    loadData();
    window.addEventListener('storage', loadData);
    return () => window.removeEventListener('storage', loadData);
  }, [selectedType, currentUser?.id]);

  const handleVendreLivret = (member: any) => {
    if (!member) return;
    
    if (currentUser?.role === 'agent commercial' && selectedType === 'epargne') {
      setErrorMessage("Action non autorisée : L'agent commercial ne peut pas vendre de livret épargne.");
      setTimeout(() => setErrorMessage(null), 4000);
      return;
    }

    const price = selectedType === 'epargne' ? 300 : 500;
    const agentName = currentUser?.identifiant || "Inconnu";

    // Check stock
    if (!agentStocks || agentStocks[selectedType] <= 0) {
      setErrorMessage(`Stock insuffisant pour les livrets ${selectedType === 'epargne' ? 'épargne' : 'tontine'}.`);
      setTimeout(() => setErrorMessage(null), 4000);
      return;
    }
    
    const saved = localStorage.getItem('microfox_members_data');
    const allMembers = saved ? JSON.parse(saved) : [];
    
    const updatedMembers = allMembers.map((m: any) => {
      if (m.id === member.id) {
        let fullHistory = m.history || [];
        if (fullHistory.length === 0) {
          const savedHistory = localStorage.getItem(`microfox_history_${m.id}`);
          if (savedHistory) fullHistory = JSON.parse(savedHistory);
        }

        const newTx = {
          id: Date.now().toString(),
          type: 'depot',
          account: selectedType === 'tontine' ? 'tontine' : 'epargne',
          amount: price,
          date: new Date().toISOString(),
          description: `Vente de Livret ${selectedType === 'epargne' ? 'Épargne' : 'Tontine'} - Agent ${agentName.trim()}`,
          userId: currentUser?.id
        };
        
        const newHistory = [newTx, ...fullHistory];
        localStorage.setItem(`microfox_history_${m.id}`, JSON.stringify(newHistory));

        return {
          ...m,
          history: newHistory
        };
      }
      return m;
    });

    localStorage.setItem('microfox_members_data', JSON.stringify(updatedMembers));
    localStorage.setItem('microfox_pending_sync', 'true');

    // 3. Update caisse or agent balance
    const targetCaisse = currentUser?.role === 'agent commercial' ? null : (currentUser?.caisse || (currentUser?.role === 'administrateur' ? 'CAISSE PRINCIPALE' : null));
    if (targetCaisse) {
      const cashKey = `microfox_cash_balance_${targetCaisse}`;
      const currentCashBalance = Number(localStorage.getItem(cashKey) || 0);
      localStorage.setItem(cashKey, (currentCashBalance + price).toString());
    } else if (currentUser?.role === 'agent commercial') {
      const agentBalanceKey = `microfox_agent_balance_${currentUser.id}`;
      const currentAgentBalance = Number(localStorage.getItem(agentBalanceKey) || 0);
      localStorage.setItem(agentBalanceKey, (currentAgentBalance + price).toString());
    }

    loadData(); // Update journal and stocks immediately
    setSuccessMessage(`Vente réussie : Livret ${selectedType === 'epargne' ? 'Épargne' : 'Tontine'} pour ${member.name}`);
    setSearchTerm(''); // Réinitialiser pour fermer la carte de vente et afficher le message clairement
    setTimeout(() => setSuccessMessage(null), 5000);
    window.dispatchEvent(new Event('storage'));
  };

  const filteredMembers = members.filter(m => 
    m.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    m.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
    m.epargneAccountNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    m.tontineAccounts?.some((t: any) => t.number.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const handleExport = () => {
    const data = salesJournal.map(sale => ({
      'Date': new Date(sale.date).toLocaleDateString('fr-FR'),
      'Heure': new Date(sale.date).toLocaleTimeString('fr-FR'),
      'Membre': sale.memberName,
      'Code Membre': sale.memberCode,
      'Description': sale.description,
      'Montant': sale.amount
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Ventes Livrets");
    XLSX.writeFile(wb, `ventes_livrets_${new Date().getTime()}.xlsx`);
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-20">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          <div className="p-3 bg-amber-100 text-amber-600 rounded-2xl">
            <ShoppingCart size={32} />
          </div>
          <div>
            <h1 className="text-2xl font-black text-white uppercase tracking-tight">Vente de Livrets</h1>
            <p className="text-gray-400 font-medium">Enregistrement des ventes de livrets aux membres.</p>
          </div>
        </div>
        
        <div className="flex flex-col md:flex-row gap-4">
          {(currentUser?.role === 'administrateur' || currentUser?.role === 'directeur') && (
            <div className="bg-[#121c32] p-4 rounded-2xl border border-gray-800 flex flex-col items-center min-w-[160px]">
              <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2">Stock Central (Siège)</span>
              <div className="flex gap-6 w-full justify-center">
                <div className="text-center">
                  <p className="text-[10px] text-emerald-400 font-black uppercase tracking-tighter">Épargne</p>
                  <p className="text-3xl font-black text-white leading-none mt-1">{centralStocks.epargne}</p>
                </div>
                <div className="text-center border-l border-gray-800 pl-6">
                  <p className="text-[10px] text-amber-400 font-black uppercase tracking-tighter">Tontine</p>
                  <p className="text-3xl font-black text-white leading-none mt-1">{centralStocks.tontine}</p>
                </div>
              </div>
            </div>
          )}
          
          <div className="bg-[#121c32] p-4 rounded-2xl border border-gray-800 flex flex-col items-center min-w-[160px]">
            <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2">Votre Stock Disponible</span>
            <div className="flex gap-6 w-full justify-center">
              <div className="text-center">
                <p className="text-[10px] text-emerald-400 font-black uppercase tracking-tighter">Épargne</p>
                <p className="text-3xl font-black text-white leading-none mt-1">{agentStocks?.epargne || 0}</p>
              </div>
              <div className="text-center border-l border-gray-800 pl-6">
                <p className="text-[10px] text-amber-400 font-black uppercase tracking-tighter">Tontine</p>
                <p className="text-3xl font-black text-white leading-none mt-1">{agentStocks?.tontine || 0}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {successMessage && (
        <div className="bg-emerald-500 text-white p-4 rounded-2xl flex items-center justify-center gap-3 shadow-lg animate-in zoom-in duration-300">
          <CheckCircle size={24} />
          <span className="font-black uppercase tracking-widest text-sm">{successMessage}</span>
        </div>
      )}

      {errorMessage && (
        <div className="bg-red-500 text-white p-4 rounded-2xl flex items-center justify-center gap-3 shadow-lg animate-in shake duration-300">
          <AlertCircle size={24} />
          <span className="font-black uppercase tracking-widest text-sm">{errorMessage}</span>
        </div>
      )}

      {/* Quick Sell Card for Selected Member */}
      {searchTerm && members.find(m => 
        m.code === searchTerm || 
        m.epargneAccountNumber === searchTerm || 
        m.tontineAccounts?.some((t: any) => t.number === searchTerm)
      ) && (
        <div className="bg-white p-6 rounded-[2rem] shadow-xl border-2 border-amber-500 animate-in fade-in slide-in-from-top-4 duration-300">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center text-amber-600">
                <User size={24} />
              </div>
              <div>
                <h3 className="text-lg font-black text-[#121c32] uppercase">
                  {members.find(m => 
                    m.code === searchTerm || 
                    m.epargneAccountNumber === searchTerm || 
                    m.tontineAccounts?.some((t: any) => t.number === searchTerm)
                  )?.name}
                </h3>
                <p className="text-xs font-bold text-gray-400">
                  Code: {members.find(m => 
                    m.code === searchTerm || 
                    m.epargneAccountNumber === searchTerm || 
                    m.tontineAccounts?.some((t: any) => t.number === searchTerm)
                  )?.code}
                </p>
                {members.find(m => 
                  m.code === searchTerm || 
                  m.epargneAccountNumber === searchTerm || 
                  m.tontineAccounts?.some((t: any) => t.number === searchTerm)
                )?.epargneAccountNumber && (
                  <p className="text-[10px] font-black text-emerald-600 uppercase mt-1">
                    Épargne: {members.find(m => 
                      m.code === searchTerm || 
                      m.epargneAccountNumber === searchTerm || 
                      m.tontineAccounts?.some((t: any) => t.number === searchTerm)
                    )?.epargneAccountNumber}
                  </p>
                )}
                {members.find(m => 
                  m.code === searchTerm || 
                  m.epargneAccountNumber === searchTerm || 
                  m.tontineAccounts?.some((t: any) => t.number === searchTerm)
                )?.tontineAccounts?.length > 0 && (
                  <p className="text-[10px] font-black text-amber-600 uppercase mt-0.5">
                    Tontine: {members.find(m => 
                      m.code === searchTerm || 
                      m.epargneAccountNumber === searchTerm || 
                      m.tontineAccounts?.some((t: any) => t.number === searchTerm)
                    )?.tontineAccounts.map((t: any) => t.number).join(', ')}
                  </p>
                )}
              </div>
            </div>
            <div className="text-right">
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Prix à payer</p>
              <p className="text-2xl font-black text-amber-600">{selectedType === 'epargne' ? '300 F' : '500 F'}</p>
            </div>
          </div>
          <button
            onClick={() => {
              const member = members.find(m => 
                m.code === searchTerm || 
                m.epargneAccountNumber === searchTerm || 
                m.tontineAccounts?.some((t: any) => t.number === searchTerm)
              );
              if (member) handleVendreLivret(member);
            }}
            className={`w-full mt-6 py-4 rounded-2xl font-black uppercase tracking-widest shadow-lg transition-all active:scale-95 flex items-center justify-center gap-3 ${
              (!agentStocks || agentStocks[selectedType] <= 0)
              ? 'bg-gray-400 text-white opacity-80' 
              : selectedType === 'epargne' ? 'bg-emerald-600 text-white hover:bg-emerald-700' : 'bg-amber-600 text-white hover:bg-amber-700'
            }`}
          >
            <ShoppingCart size={20} />
            Vendre le Livret {selectedType === 'epargne' ? 'Épargne' : 'Tontine'}
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white p-6 rounded-[1.5rem] shadow-sm border border-gray-100 flex-1 space-y-4">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
            <input 
              type="text" 
              placeholder="Rechercher un membre..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-12 pr-4 py-4 bg-[#121c32] text-white rounded-2xl font-medium outline-none placeholder:text-gray-500"
            />
          </div>
          
          <div className="space-y-1">
            <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Ou sélectionner dans la liste</label>
            <select 
              className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl outline-none text-sm font-bold text-[#121c32]"
              onChange={(e) => setSearchTerm(e.target.value)}
              value={searchTerm}
            >
              <option value="">-- Sélectionner un client --</option>
              {filteredMembers.sort((a, b) => a.name.localeCompare(b.name)).map(m => (
                <option key={m.id} value={m.code}>
                  {m.name} ({m.code}) 
                  {m.epargneAccountNumber ? ` | EP: ${m.epargneAccountNumber}` : ''}
                  {m.tontineAccounts?.length > 0 ? ` | TN: ${m.tontineAccounts.map((t: any) => t.number).join(', ')}` : ''}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="bg-white p-4 rounded-[1.5rem] shadow-sm border border-gray-100 flex items-center gap-4">
          <div className="flex-1">
            <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Type de Livret à Vendre</label>
            <div className="flex gap-2 mt-1">
              <button 
                onClick={() => setSelectedType('epargne')}
                disabled={currentUser?.role === 'agent commercial'}
                className={`flex-1 py-3 rounded-xl font-bold text-xs uppercase transition-all ${selectedType === 'epargne' ? 'bg-emerald-600 text-white shadow-lg' : 'bg-gray-100 text-gray-400'} ${currentUser?.role === 'agent commercial' ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                Épargne (300F)
              </button>
              <button 
                onClick={() => setSelectedType('tontine')}
                className={`flex-1 py-3 rounded-xl font-bold text-xs uppercase transition-all ${selectedType === 'tontine' ? 'bg-amber-600 text-white shadow-lg' : 'bg-gray-100 text-gray-400'}`}
              >
                Tontine (500F)
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-[1.5rem] shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-6 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-sm font-black text-[#121c32] uppercase tracking-tight flex items-center gap-2">
            <BookOpen size={18} className="text-amber-500" />
            Journal des Ventes de Livrets
          </h2>
          <div className="flex items-center gap-3">
            <button 
              onClick={handleExport}
              className="flex items-center gap-2 px-3 py-1.5 bg-emerald-50 text-emerald-600 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-emerald-100 transition-all"
            >
              <Download size={14} />
              Exporter
            </button>
            <span className="text-[10px] font-black text-gray-400 uppercase bg-gray-50 px-3 py-1 rounded-full">
              {salesJournal.length} Ventes au total
            </span>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left min-w-[700px]">
            <thead>
              <tr className="bg-gray-50/50 border-b border-gray-100">
                <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">DATE</th>
                <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">MEMBRE</th>
                <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">DESCRIPTION</th>
                <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest text-right">MONTANT</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {salesJournal.map((sale) => (
                <tr key={sale.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex flex-col">
                      <span className="text-xs font-black text-[#121c32]">
                        {new Date(sale.date).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                      </span>
                      <span className="text-[10px] font-bold text-gray-400">
                        {new Date(sale.date).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-col">
                      <span className="text-sm font-black text-[#121c32] uppercase">{sale.memberName}</span>
                      <span className="text-[10px] font-bold text-gray-400">{sale.memberCode}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-xs font-bold text-gray-500 italic">{sale.description}</span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <span className={`text-sm font-black ${sale.description.toLowerCase().includes('épargne') ? 'text-emerald-600' : 'text-amber-600'}`}>
                      {sale.amount} F
                    </span>
                  </td>
                </tr>
              ))}
              {salesJournal.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center text-gray-400 font-bold uppercase text-xs">
                    Aucune vente enregistrée
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

export default VenteLivrets;
