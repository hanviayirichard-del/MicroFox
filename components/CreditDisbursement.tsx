import React, { useState, useEffect } from 'react';
import { 
  CreditCard, 
  Search, 
  CheckCircle,
  History,
  ArrowUpRight,
  ShieldCheck
} from 'lucide-react';

const CreditDisbursement: React.FC = () => {
  const [members, setMembers] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');

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

  const pendingRequests = members.filter(m => 
    m.epargneAccountNumber && m.lastCreditRequest && m.lastCreditRequest.status === 'En attente'
  ).filter(m => {
    const search = searchTerm.toLowerCase();
    return m.name.toLowerCase().includes(search) || m.code.toLowerCase().includes(search);
  });

  const handleDisburse = (memberId: string) => {
    const saved = localStorage.getItem('microfox_members_data');
    let clients = saved ? JSON.parse(saved) : [];
    const client = clients.find((c: any) => c.id === memberId);
    if (!client || !client.lastCreditRequest) return;

    const request = client.lastCreditRequest;
    const currentUser = JSON.parse(localStorage.getItem('microfox_current_user') || 'null');
    const targetCaisse = currentUser?.role === 'agent commercial' ? null : (currentUser?.caisse || (currentUser?.role === 'administrateur' ? 'CAISSE PRINCIPALE' : null));
    
    if (targetCaisse) {
      const cashKey = `microfox_cash_balance_${targetCaisse}`;
      const currentCashBalance = Number(localStorage.getItem(cashKey) || 0);
      if (currentCashBalance <= 0) {
        alert(`Opération impossible : Le solde de la ${targetCaisse} est de 0 F. Veuillez approvisionner la caisse.`);
        return;
      }
      // Mise à jour du solde de la caisse
      localStorage.setItem(cashKey, (currentCashBalance - request.capital).toString());
    }

    const updatedClients = clients.map((c: any) => {
      if (c.id === memberId) {
        let fullHistory = c.history || [];
        if (fullHistory.length === 0) {
          const savedHistory = localStorage.getItem(`microfox_history_${c.id}`);
          if (savedHistory) fullHistory = JSON.parse(savedHistory);
        }

        const currentCredit = c.balances?.credit || 0;
        const newTotal = currentCredit + request.capital + request.interest + request.penalty;
        
        const newTx = {
          id: Date.now().toString(),
          type: 'deblocage',
          account: 'credit',
          amount: request.capital,
          date: new Date().toISOString(),
          description: `Déblocage de crédit approuvé - Échéance: ${request.dueDate}`
        };

        const feesTx = request.fees > 0 ? {
          id: `fees-${Date.now()}`,
          type: 'depot',
          account: 'frais',
          amount: request.fees,
          date: new Date().toISOString(),
          description: `Frais de dossier crédit - Échéance: ${request.dueDate}`
        } : null;
        
        const addedHistory = [newTx];
        if (feesTx) addedHistory.push(feesTx);

        const newHistory = [...addedHistory, ...fullHistory];
        localStorage.setItem(`microfox_history_${c.id}`, JSON.stringify(newHistory));

        return {
          ...c,
          balances: { ...c.balances, credit: newTotal },
          history: newHistory,
          lastCreditRequest: {
            ...request,
            status: 'Débloqué',
            disbursementDate: new Date().toISOString()
          }
        };
      }
      return c;
    });
    
    localStorage.setItem('microfox_members_data', JSON.stringify(updatedClients));
    localStorage.setItem('microfox_pending_sync', 'true');
    window.dispatchEvent(new Event('storage'));
    loadData();
    alert("Crédit débloqué avec succès.");
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-[#121c32] uppercase tracking-tight">Déblocage de Crédit</h1>
          <p className="text-gray-700 text-sm font-medium mt-1">Validation et décaissement des fonds</p>
        </div>
        <div className="relative w-full md:w-96">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-600" size={20} />
          <input 
            type="text" 
            placeholder="Rechercher une demande..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-12 pr-4 py-3 bg-white border border-gray-200 rounded-2xl outline-none focus:border-emerald-500 font-medium transition-all shadow-sm"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {pendingRequests.length > 0 ? (
          pendingRequests.map((m) => (
            <div key={m.id} className="bg-white rounded-[2rem] p-6 border border-gray-100 shadow-sm hover:shadow-md transition-all">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-2xl bg-[#121c32] text-white flex items-center justify-center font-black text-lg">
                    {m.name.split(' ').map((n: string) => n[0]).join('')}
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-[#121c32] uppercase">{m.name}</h3>
                    <p className="text-xs font-bold text-gray-600 uppercase tracking-widest">{m.code}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-8 flex-1 lg:px-12">
                  <div>
                    <p className="text-[10px] font-black text-gray-600 uppercase tracking-widest mb-1">Capital</p>
                    <p className="text-lg font-black text-[#121c32]">{m.lastCreditRequest.capital.toLocaleString()} F</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-gray-600 uppercase tracking-widest mb-1">Intérêts</p>
                    <p className="text-lg font-black text-blue-600">{m.lastCreditRequest.interest.toLocaleString()} F</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-gray-600 uppercase tracking-widest mb-1">Frais/Pén.</p>
                    <p className="text-lg font-black text-amber-600">{(m.lastCreditRequest.fees + m.lastCreditRequest.penalty).toLocaleString()} F</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-gray-600 uppercase tracking-widest mb-1">Échéance</p>
                    <p className="text-lg font-black text-gray-700">{new Date(m.lastCreditRequest.dueDate).toLocaleDateString()}</p>
                  </div>
                </div>

                <button 
                  onClick={() => handleDisburse(m.id)}
                  className="px-8 py-4 bg-[#00c896] text-white rounded-2xl font-black uppercase tracking-widest shadow-lg hover:bg-[#00a87d] transition-all flex items-center justify-center gap-2 shrink-0"
                >
                  <ArrowUpRight size={20} />
                  Débloquer
                </button>
              </div>
            </div>
          ))
        ) : (
          <div className="bg-white rounded-[2.5rem] p-20 text-center border border-dashed border-gray-200">
            <div className="w-20 h-20 bg-gray-50 text-gray-500 rounded-full flex items-center justify-center mx-auto mb-6">
              <History size={40} />
            </div>
            <h3 className="text-xl font-black text-gray-600 uppercase tracking-tight">Aucune demande en attente</h3>
            <p className="text-gray-600 text-sm mt-2">Les nouvelles demandes de crédit apparaîtront ici pour validation.</p>
          </div>
        )}
      </div>

      {/* Recapitulatif des déblocages récents */}
      <div className="mt-12">
        <h3 className="text-lg font-black text-[#121c32] uppercase tracking-tight mb-6 flex items-center gap-2">
          <ShieldCheck size={20} className="text-emerald-500" /> Déblocages Récents
        </h3>
        <div className="bg-white rounded-[2.5rem] shadow-sm border border-gray-100 overflow-x-auto">
          <table className="w-full text-left min-w-[800px]">
            <thead>
              <tr className="bg-gray-50/50">
                <th className="px-6 py-4 text-[10px] font-black text-gray-600 uppercase tracking-widest">Membre</th>
                <th className="px-6 py-4 text-[10px] font-black text-gray-600 uppercase tracking-widest text-right">Capital</th>
                <th className="px-6 py-4 text-[10px] font-black text-gray-600 uppercase tracking-widest text-right">Intérêts</th>
                <th className="px-6 py-4 text-[10px] font-black text-gray-600 uppercase tracking-widest text-right">Frais/Pén.</th>
                <th className="px-6 py-4 text-[10px] font-black text-gray-600 uppercase tracking-widest">Date Débloc.</th>
                <th className="px-6 py-4 text-[10px] font-black text-gray-600 uppercase tracking-widest">Échéance</th>
                <th className="px-6 py-4 text-[10px] font-black text-gray-600 uppercase tracking-widest text-center">Statut</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {members.filter(m => m.lastCreditRequest && m.lastCreditRequest.status === 'Débloqué').length > 0 ? (
                members.filter(m => m.lastCreditRequest && m.lastCreditRequest.status === 'Débloqué').map((m) => (
                  <tr key={m.id} className="hover:bg-gray-50/30 transition-colors">
                    <td className="px-6 py-4">
                      <p className="text-sm font-black text-[#121c32] uppercase">{m.name}</p>
                      <p className="text-[10px] font-bold text-gray-600 uppercase tracking-tight">{m.code}</p>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <p className="text-sm font-black text-emerald-600">{m.lastCreditRequest.capital.toLocaleString()} F</p>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <p className="text-sm font-black text-blue-600">{m.lastCreditRequest.interest.toLocaleString()} F</p>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <p className="text-sm font-black text-amber-600">{(m.lastCreditRequest.fees + m.lastCreditRequest.penalty).toLocaleString()} F</p>
                    </td>
                    <td className="px-6 py-4 text-sm font-medium text-gray-700">
                      {new Date(m.lastCreditRequest.disbursementDate).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 text-sm font-medium text-gray-700">
                      {new Date(m.lastCreditRequest.dueDate).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className="px-2.5 py-1 bg-emerald-100 text-emerald-700 rounded-lg text-[10px] font-black uppercase tracking-tight">
                        Débloqué
                      </span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center text-gray-600 italic text-sm">
                    Aucun déblocage récent
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

export default CreditDisbursement;
