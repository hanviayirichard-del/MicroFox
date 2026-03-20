import React, { useState, useEffect } from 'react';
import { 
  Search, 
  AlertCircle, 
  CheckCircle,
  User,
  CreditCard,
  History
} from 'lucide-react';

const OtherCreditOperations: React.FC = () => {
  const [members, setMembers] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedMemberId, setSelectedMemberId] = useState('');
  const [penaltyAmount, setPenaltyAmount] = useState('');
  const [rebateAmount, setRebateAmount] = useState('');
  const [operationType, setOperationType] = useState<'penalty' | 'rebate'>('penalty');

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
    if (!m.epargneAccountNumber) return false;
    const search = searchTerm.toLowerCase();
    const hasCredit = (m.balances?.credit || 0) > 0;
    return hasCredit && (
      m.name.toLowerCase().includes(search) ||
      m.code.toLowerCase().includes(search)
    );
  });

  const selectedMember = members.find(m => m.id === selectedMemberId);

  const handleApplyPenalty = () => {
    if (!selectedMemberId || !penaltyAmount) return alert("Veuillez sélectionner un membre et saisir un montant.");

    const amount = Number(penaltyAmount);
    if (isNaN(amount) || amount <= 0) return alert("Veuillez saisir un montant valide.");

    const updatedMembers = members.map(m => {
      if (m.id === selectedMemberId) {
        const currentCredit = m.balances.credit || 0;
        const newTotal = currentCredit + amount;
        
        const lastRequest = m.lastCreditRequest || {};
        const lastDetails = m.lastCreditDetails || {};
        
        const updatedRequest = {
          ...lastRequest,
          penalty: (lastRequest.penalty || 0) + amount
        };

        const newTx = {
          id: Date.now().toString(),
          type: 'deblocage', // On utilise deblocage pour augmenter l'encours (pénalité)
          account: 'credit',
          amount: amount,
          date: new Date().toISOString(),
          description: `Application de pénalité de retard`
        };

        return {
          ...m,
          balances: { ...m.balances, credit: newTotal },
          lastCreditRequest: updatedRequest,
          history: [newTx, ...(m.history || [])]
        };
      }
      return m;
    });

    localStorage.setItem('microfox_members_data', JSON.stringify(updatedMembers));
    localStorage.setItem('microfox_pending_sync', 'true');
    window.dispatchEvent(new Event('storage'));
    
    alert("Pénalité appliquée avec succès.");
    setPenaltyAmount('');
    setSelectedMemberId('');
    setSearchTerm('');
    loadData();
  };

  const handleApplyRebate = () => {
    if (!selectedMemberId || !rebateAmount) return alert("Veuillez sélectionner un membre et saisir un montant.");

    const amount = Number(rebateAmount);
    if (isNaN(amount) || amount <= 0) return alert("Veuillez saisir un montant valide.");

    const updatedMembers = members.map(m => {
      if (m.id === selectedMemberId) {
        const currentCredit = m.balances.credit || 0;
        // La ristourne diminue l'encours
        const newTotal = Math.max(0, currentCredit - amount);
        
        const lastRequest = m.lastCreditRequest || {};
        const updatedRequest = {
          ...lastRequest,
          rebate: (lastRequest.rebate || 0) + amount
        };

        const newTx = {
          id: Date.now().toString(),
          type: 'remboursement', // On utilise remboursement pour diminuer l'encours
          account: 'credit',
          amount: amount,
          date: new Date().toISOString(),
          description: `Application de ristourne de fidélité`
        };

        return {
          ...m,
          balances: { ...m.balances, credit: newTotal },
          lastCreditRequest: updatedRequest,
          history: [newTx, ...(m.history || [])]
        };
      }
      return m;
    });

    localStorage.setItem('microfox_members_data', JSON.stringify(updatedMembers));
    localStorage.setItem('microfox_pending_sync', 'true');
    window.dispatchEvent(new Event('storage'));
    
    alert("Ristourne appliquée avec succès.");
    setRebateAmount('');
    setSelectedMemberId('');
    setSearchTerm('');
    loadData();
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="bg-white rounded-[2.5rem] shadow-sm border border-gray-100 overflow-hidden">
        <div className="bg-[#121c32] p-6 text-white flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <AlertCircle size={24} className={operationType === 'penalty' ? "text-amber-400" : "text-emerald-400"} />
            <h3 className="text-lg font-black uppercase tracking-tight">
              {operationType === 'penalty' ? "Pénalités de Retard" : "Ristournes de Fidélité"}
            </h3>
          </div>
          <div className="flex bg-white/10 p-1 rounded-xl w-full sm:w-auto">
            <button 
              onClick={() => setOperationType('penalty')}
              className={`flex-1 sm:flex-none px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${operationType === 'penalty' ? 'bg-amber-500 text-white shadow-lg' : 'text-gray-400 hover:text-white'}`}
            >
              Pénalité
            </button>
            <button 
              onClick={() => setOperationType('rebate')}
              className={`flex-1 sm:flex-none px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${operationType === 'rebate' ? 'bg-emerald-500 text-white shadow-lg' : 'text-gray-400 hover:text-white'}`}
            >
              Ristourne
            </button>
          </div>
        </div>

        <div className="p-8 space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-6">
              <div className="space-y-2">
                <label className="text-[11px] font-black text-gray-600 uppercase tracking-widest">Rechercher un membre avec crédit actif</label>
                <div className="relative">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-600" size={18} />
                  <input 
                    type="text" 
                    placeholder="Nom ou Code client..." 
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-12 pr-4 py-4 bg-gray-50 border border-gray-200 rounded-2xl outline-none focus:border-amber-500 font-bold text-black text-sm"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[11px] font-black text-gray-600 uppercase tracking-widest">Sélectionner le Membre</label>
                <div className="grid grid-cols-1 gap-2 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                  {filteredMembers.length > 0 ? (
                    filteredMembers.map(m => (
                      <button
                        key={m.id}
                        onClick={() => setSelectedMemberId(m.id)}
                        className={`w-full p-4 rounded-2xl border flex items-center gap-3 transition-all ${selectedMemberId === m.id ? 'bg-amber-50 border-amber-500 shadow-sm' : 'bg-white border-gray-100 hover:bg-gray-50'}`}
                      >
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-xs ${selectedMemberId === m.id ? 'bg-amber-500 text-white' : 'bg-gray-100 text-gray-600'}`}>
                          {m.name.split(' ').map((n: string) => n[0]).join('')}
                        </div>
                        <div className="text-left">
                          <p className="text-sm font-black text-[#121c32] uppercase">{m.name}</p>
                          <p className="text-[10px] font-bold text-gray-600 uppercase">{m.code}</p>
                        </div>
                      </button>
                    ))
                  ) : (
                    <p className="text-center py-8 text-gray-400 italic text-sm uppercase">Aucun membre avec crédit actif trouvé</p>
                  )}
                </div>
              </div>
            </div>

            <div className="space-y-6">
              {selectedMember ? (
                <div className="bg-gray-50 rounded-3xl p-6 border border-gray-100 space-y-6">
                  <div className="flex items-center gap-3 border-b border-gray-200 pb-4">
                    <div className="w-12 h-12 rounded-2xl bg-white flex items-center justify-center text-amber-500 shadow-sm">
                      <User size={24} />
                    </div>
                    <div>
                      <h4 className="text-base font-black text-[#121c32] uppercase">{selectedMember.name}</h4>
                      <p className="text-[10px] font-bold text-gray-600 uppercase tracking-widest">Détails du crédit en cours</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100">
                      <p className="text-[9px] font-black text-gray-600 uppercase tracking-widest mb-1">Encours Total</p>
                      <p className="text-lg font-black text-[#121c32]">{selectedMember.balances.credit.toLocaleString()} F</p>
                    </div>
                    <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100">
                      <p className="text-[9px] font-black text-gray-600 uppercase tracking-widest mb-1">Échéance</p>
                      <p className="text-sm font-black text-red-500">
                        {selectedMember.lastCreditRequest?.dueDate 
                          ? new Date(selectedMember.lastCreditRequest.dueDate).toLocaleDateString()
                          : 'N/A'}
                      </p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[11px] font-black text-gray-600 uppercase tracking-widest">
                      {operationType === 'penalty' ? "Montant de la pénalité à ajouter (F)" : "Montant de la ristourne à déduire (F)"}
                    </label>
                    <input 
                      type="number" 
                      value={operationType === 'penalty' ? penaltyAmount : rebateAmount}
                      onChange={(e) => operationType === 'penalty' ? setPenaltyAmount(e.target.value) : setRebateAmount(e.target.value)}
                      placeholder="Saisir le montant..."
                      className={`w-full p-5 bg-white border-2 border-transparent focus:border-${operationType === 'penalty' ? 'amber' : 'emerald'}-500 rounded-2xl text-2xl font-black outline-none transition-all text-[#121c32]`}
                    />
                  </div>

                  <button 
                    onClick={operationType === 'penalty' ? handleApplyPenalty : handleApplyRebate}
                    className={`w-full py-5 ${operationType === 'penalty' ? 'bg-amber-500' : 'bg-emerald-500'} text-white rounded-2xl font-black uppercase tracking-widest shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2`}
                  >
                    <CheckCircle size={20} />
                    {operationType === 'penalty' ? "Appliquer la pénalité" : "Appliquer la ristourne"}
                  </button>
                </div>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-center p-8 border-2 border-dashed border-gray-200 rounded-3xl text-gray-500">
                  <CreditCard size={48} strokeWidth={1} className="mb-4 opacity-20" />
                  <p className="text-sm font-bold uppercase tracking-widest">Sélectionnez un membre pour appliquer une pénalité</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Historique récent des pénalités */}
      <div className="bg-white rounded-[2.5rem] shadow-sm border border-gray-100 overflow-hidden">
        <div className="bg-[#121c32] p-6 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <History size={24} className="text-blue-400" />
            <h3 className="text-lg font-black uppercase tracking-tight">Historique des Opérations</h3>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-gray-50/50">
                <th className="px-6 py-4 text-[10px] font-black text-gray-600 uppercase tracking-widest">Client</th>
                <th className="px-6 py-4 text-[10px] font-black text-gray-600 uppercase tracking-widest">Opération</th>
                <th className="px-6 py-4 text-[10px] font-black text-gray-600 uppercase tracking-widest">Montant</th>
                <th className="px-6 py-4 text-[10px] font-black text-gray-600 uppercase tracking-widest">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {members.some(m => m.history?.some((tx: any) => tx.description.includes('pénalité') || tx.description.includes('ristourne'))) ? (
                members.flatMap(m => (m.history || [])
                  .filter((tx: any) => tx.description.includes('pénalité') || tx.description.includes('ristourne'))
                  .map((tx: any) => ({ ...tx, clientName: m.name, clientCode: m.code }))
                )
                .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                .slice(0, 10)
                .map((tx, idx) => (
                  <tr key={idx} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4">
                      <p className="text-sm font-black text-[#121c32] uppercase">{tx.clientName}</p>
                      <p className="text-[10px] font-bold text-gray-600 uppercase tracking-tight">{tx.clientCode}</p>
                    </td>
                    <td className="px-6 py-4">
                      <p className={`text-xs font-bold uppercase ${tx.description.includes('pénalité') ? 'text-amber-600' : 'text-emerald-600'}`}>{tx.description}</p>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-sm font-black text-[#121c32]">{tx.amount.toLocaleString()} F</p>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-xs font-medium text-gray-700">{new Date(tx.date).toLocaleDateString()}</p>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center text-gray-600 italic text-sm uppercase tracking-widest">
                    Aucune opération appliquée récemment
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

export default OtherCreditOperations;
