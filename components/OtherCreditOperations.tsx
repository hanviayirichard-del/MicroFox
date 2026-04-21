import React, { useState, useEffect, useRef } from 'react';
import { 
  Search, 
  AlertCircle, 
  CheckCircle,
  User,
  CreditCard,
  History,
  ChevronDown
} from 'lucide-react';

const OtherCreditOperations: React.FC = () => {
  const [members, setMembers] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedMemberId, setSelectedMemberId] = useState('');
  const [penaltyAmount, setPenaltyAmount] = useState('');
  const [rebateAmount, setRebateAmount] = useState('');
  const [operationType, setOperationType] = useState<'penalty' | 'rebate'>('penalty');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const loadData = () => {
    const saved = localStorage.getItem('microfox_members_data');
    if (saved) {
      const parsed = JSON.parse(saved);
      // Ensure history is loaded for each client if it's empty in the saved array
      const withHistory = parsed.map((c: any) => {
        if (!c.history || c.history.length === 0) {
          const savedHistory = localStorage.getItem(`microfox_history_${c.id}`);
          if (savedHistory) {
            return { ...c, history: JSON.parse(savedHistory) };
          }
        }
        return c;
      });
      setMembers(withHistory);
    }
  };

  useEffect(() => {
    loadData();
    window.addEventListener('storage', loadData);

    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);

    return () => {
      window.removeEventListener('storage', loadData);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const filteredMembers = members.filter(m => {
    if (!m.epargneAccountNumber) return false;
    const search = searchTerm.toLowerCase();
    // Un crédit en cours (balance > 0) OU un crédit soldé (a eu une demande de crédit)
    const hasCredit = (m.balances?.credit || 0) > 0 || m.lastCreditRequest !== undefined;
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

    const userStr = localStorage.getItem('microfox_current_user');
    const currentUser = JSON.parse(userStr || '{}');

    const updatedMembers = members.map(m => {
      if (m.id === selectedMemberId) {
        const currentCredit = m.balances.credit || 0;
        const newTotal = currentCredit + amount;
        
        const lastRequest = m.lastCreditRequest || {};
        const updatedRequest = {
          ...lastRequest,
          penalty: (lastRequest.penalty || 0) + amount
        };

        const lastDetails = m.lastCreditDetails || {};
        const updatedDetails = {
          ...lastDetails,
          penalty: (lastDetails.penalty || 0) + amount
        };

        const newTx = {
          id: Date.now().toString(),
          type: 'deblocage', // On utilise deblocage pour augmenter l'encours (pénalité)
          account: 'credit',
          amount: amount,
          date: new Date().toISOString(),
          description: `Application de pénalité de retard (PEN: ${amount})`,
          author: currentUser.identifiant,
          cashierName: currentUser.identifiant,
          balance: newTotal
        };

        const newHistory = [newTx, ...(m.history || [])];
        localStorage.setItem(`microfox_history_${m.id}`, JSON.stringify(newHistory));

        return {
          ...m,
          balances: { ...m.balances, credit: newTotal },
          lastCreditRequest: updatedRequest,
          lastCreditDetails: updatedDetails,
          history: newHistory
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

    const userStr = localStorage.getItem('microfox_current_user');
    const currentUser = JSON.parse(userStr || '{}');

    const updatedMembers = members.map(m => {
      if (m.id === selectedMemberId) {
        const currentCredit = m.balances.credit || 0;
        // La ristourne diminue l'encours
        const rebateForCredit = Math.min(currentCredit, amount);
        const surplusForEpargne = amount - rebateForCredit;
        const newTotal = currentCredit - rebateForCredit;
        
        const lastRequest = m.lastCreditRequest || {};
        const lastDetails = m.lastCreditDetails || {};

        // Déduire d'abord des intérêts, puis du capital
        let remainingRebate = rebateForCredit;
        
        const updatedRequest = { ...lastRequest, rebate: (lastRequest.rebate || 0) + amount };
        const updatedDetails = { ...lastDetails, rebate: (lastDetails.rebate || 0) + amount };

        const deductFromParams = (params: any) => {
          let rem = remainingRebate;
          const int = params.interest || 0;
          const cap = params.capital || 0;
          
          if (rem <= int) {
            params.interest = int - rem;
            rem = 0;
          } else {
            params.interest = 0;
            rem -= int;
            params.capital = Math.max(0, cap - rem);
          }
        };

        deductFromParams(updatedRequest);
        deductFromParams(updatedDetails);

        const newHistory = [...(m.history || [])];
        
        const creditTx = {
          id: `${Date.now()}_rebate_${Math.random().toString(36).substr(2, 5)}`,
          type: 'remboursement' as const,
          account: 'credit' as const,
          amount: rebateForCredit,
          date: new Date().toISOString(),
          description: `APPLICATION DE RISTOURNE POUR REMBOURSEMENT ANTICIPÉ (RIST: ${rebateForCredit})`,
          author: currentUser.identifiant,
          cashierName: currentUser.identifiant,
          balance: newTotal
        };
        newHistory.unshift(creditTx);

        let finalEpargneBalance = m.balances.epargne || 0;
        if (surplusForEpargne > 0 && m.epargneAccountNumber) {
          finalEpargneBalance += surplusForEpargne;
          const epargneTx = {
            id: `${Date.now()}_rebate_alt_${Math.random().toString(36).substr(2, 5)}`,
            type: 'depot' as const,
            account: 'epargne' as const,
            amount: surplusForEpargne,
            date: new Date().toISOString(),
            description: `Ristourne crédit versée sur compte épargne`,
            author: currentUser.identifiant,
            cashierName: currentUser.identifiant,
            balance: finalEpargneBalance
          };
          newHistory.unshift(epargneTx);
        }

        localStorage.setItem(`microfox_history_${m.id}`, JSON.stringify(newHistory));

        return {
          ...m,
          balances: { 
            ...m.balances, 
            credit: newTotal,
            epargne: finalEpargneBalance
          },
          lastCreditRequest: updatedRequest,
          lastCreditDetails: updatedDetails,
          history: newHistory
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

  const handleCancelOperation = (memberId: string, txId: string) => {
    const userStr = localStorage.getItem('microfox_current_user');
    const currentUser = JSON.parse(userStr || '{}');
    
    if (!['administrateur', 'directeur'].includes(currentUser.role)) {
      return alert("Seul l'administrateur ou le directeur peut annuler cette opération.");
    }

    if (!window.confirm("Voulez-vous vraiment annuler cette opération ?")) return;

    const updatedMembers = members.map(m => {
      if (m.id === memberId) {
        const txIndex = (m.history || []).findIndex((tx: any) => tx.id === txId);
        if (txIndex === -1) return m;

        const tx = m.history[txIndex];
        if (tx.cancelled) return m;

        const amount = tx.amount;
        let newTotal = m.balances.credit || 0;
        let newEpargneTotal = m.balances.epargne || 0;
        const updatedRequest = { ...(m.lastCreditRequest || {}) };
        const updatedDetails = { ...(m.lastCreditDetails || {}) };

        if (tx.description.includes('pénalité')) {
          newTotal = Math.max(0, newTotal - amount);
          updatedRequest.penalty = Math.max(0, (updatedRequest.penalty || 0) - amount);
          updatedDetails.penalty = Math.max(0, (updatedDetails.penalty || 0) - amount);
        } else if (tx.description.includes('ristourne')) {
          // Si c'était une ristourne crédit, on rajoute à l'encours
          if (tx.account === 'credit') {
            newTotal = newTotal + amount;
            updatedRequest.rebate = Math.max(0, (updatedRequest.rebate || 0) - amount);
            updatedDetails.rebate = Math.max(0, (updatedDetails.rebate || 0) - amount);
            
            // On restaure le capital/intérêt (simplifié: on rajoute au capital d'abord si on peut pas être précis)
            // Mais on peut essayer d'être cohérent avec la déduction
            updatedRequest.capital = (updatedRequest.capital || 0) + amount;
            updatedDetails.capital = (updatedDetails.capital || 0) + amount;
          } else if (tx.account === 'epargne') {
            newEpargneTotal = Math.max(0, newEpargneTotal - amount);
            updatedRequest.rebate = Math.max(0, (updatedRequest.rebate || 0) - amount);
            updatedDetails.rebate = Math.max(0, (updatedDetails.rebate || 0) - amount);
          }
        }

        const updatedTx = { 
          ...tx, 
          cancelled: true, 
          cancelledAt: new Date().toISOString(), 
          cancelledBy: currentUser.identifiant,
          description: tx.description + " (ANNULÉ)"
        };
        
        const newHistory = [...m.history];
        newHistory[txIndex] = updatedTx;
        
        localStorage.setItem(`microfox_history_${m.id}`, JSON.stringify(newHistory));

        return {
          ...m,
          balances: { 
            ...m.balances, 
            credit: newTotal,
            epargne: newEpargneTotal
          },
          lastCreditRequest: updatedRequest,
          lastCreditDetails: updatedDetails,
          history: newHistory
        };
      }
      return m;
    });

    localStorage.setItem('microfox_members_data', JSON.stringify(updatedMembers));
    localStorage.setItem('microfox_pending_sync', 'true');
    window.dispatchEvent(new Event('storage'));
    
    alert("Opération annulée avec succès.");
    loadData();
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="bg-white rounded-[2.5rem] shadow-sm border border-gray-100 overflow-hidden">
        <div className="bg-[#121c32] p-6 text-white flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <AlertCircle size={24} className={operationType === 'penalty' ? "text-amber-400" : "text-emerald-400"} />
            <h3 className="text-lg font-black uppercase tracking-tight">
              {operationType === 'penalty' ? "Pénalités de Retard" : "Ristournes pour Remboursement Anticipé"}
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
                <label className="text-[11px] font-black text-gray-600 uppercase tracking-widest">Rechercher un membre (Crédit actif ou soldé)</label>
                <div className="relative" ref={dropdownRef}>
                  <div 
                    onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                    className="w-full pl-4 pr-10 py-4 bg-gray-50 border border-gray-200 rounded-2xl outline-none cursor-pointer flex items-center justify-between"
                  >
                    <div className="flex items-center gap-3">
                      <Search className="text-gray-600" size={18} />
                      <span className={`font-bold text-sm ${selectedMember ? 'text-black' : 'text-gray-400'}`}>
                        {selectedMember ? `${selectedMember.name} (${selectedMember.code})` : "Sélectionner un membre..."}
                      </span>
                    </div>
                    <ChevronDown size={20} className={`text-gray-400 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} />
                  </div>

                  {isDropdownOpen && (
                    <div className="absolute z-50 w-full mt-2 bg-white border border-gray-100 rounded-2xl shadow-xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                      <div className="p-3 border-b border-gray-50 bg-gray-50/50">
                        <div className="relative">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
                          <input 
                            type="text" 
                            placeholder="Filtrer par nom ou code..." 
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-9 pr-4 py-2 bg-white border border-gray-200 rounded-xl outline-none focus:border-amber-500 text-xs font-bold text-[#121c32]"
                            onClick={(e) => e.stopPropagation()}
                          />
                        </div>
                      </div>
                      <div className="max-h-[250px] overflow-y-auto custom-scrollbar">
                        {filteredMembers.length > 0 ? (
                          filteredMembers.map(m => (
                            <button
                              key={m.id}
                              onClick={() => {
                                setSelectedMemberId(m.id);
                                setIsDropdownOpen(false);
                                setSearchTerm('');
                              }}
                              className={`w-full p-4 hover:bg-gray-50 flex items-center gap-3 transition-colors border-b border-gray-50 last:border-0 ${selectedMemberId === m.id ? 'bg-amber-50' : ''}`}
                            >
                              <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center font-black text-[10px] text-gray-600">
                                {m.name.split(' ').map((n: string) => n[0]).join('')}
                              </div>
                              <div className="text-left">
                                <p className="text-xs font-black text-[#121c32] uppercase">{m.name}</p>
                                <p className="text-[9px] font-bold text-gray-500 uppercase">{m.code}</p>
                                <p className="text-[8px] font-bold text-blue-500 uppercase mt-0.5">
                                  EP: {m.epargneAccountNumber || '---'} | TN: {m.tontineAccounts?.[0]?.number || '---'}
                                </p>
                              </div>
                            </button>
                          ))
                        ) : (
                          <div className="p-8 text-center text-gray-400 italic text-xs uppercase">Aucun membre trouvé</div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {selectedMember && (
                <div className="bg-amber-50/50 rounded-2xl p-4 border border-amber-100 space-y-3">
                  <div className="flex justify-between items-center">
                    <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Numéro du Crédit</p>
                    <p className="text-xs font-black text-amber-600 uppercase">{selectedMember.lastCreditRequest?.creditNumber || '---'}</p>
                  </div>
                  <div className="flex justify-between items-center">
                    <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Statut</p>
                    <p className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${selectedMember.balances.credit > 0 ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>
                      {selectedMember.balances.credit > 0 ? 'En cours' : 'Soldé'}
                    </p>
                  </div>
                </div>
              )}
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
                  <p className="text-sm font-bold uppercase tracking-widest">
                    {operationType === 'penalty' ? "Sélectionnez un membre pour appliquer une pénalité" : "Sélectionnez un membre pour appliquer une ristourne"}
                  </p>
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
                <th className="px-6 py-4 text-[10px] font-black text-gray-600 uppercase tracking-widest">Auteur</th>
                <th className="px-6 py-4 text-[10px] font-black text-gray-600 uppercase tracking-widest">Montant</th>
                <th className="px-6 py-4 text-[10px] font-black text-gray-600 uppercase tracking-widest">Date</th>
                <th className="px-6 py-4 text-[10px] font-black text-gray-600 uppercase tracking-widest">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {members.some(m => m.history?.some((tx: any) => tx.description.includes('pénalité') || tx.description.includes('ristourne'))) ? (
                members.flatMap(m => (m.history || [])
                  .filter((tx: any) => tx.description.includes('pénalité') || tx.description.includes('ristourne'))
                  .map((tx: any) => ({ ...tx, clientName: m.name, clientCode: m.code, memberId: m.id }))
                )
                .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                .slice(0, 10)
                .map((tx, idx) => {
                  const currentUser = JSON.parse(localStorage.getItem('microfox_current_user') || '{}');
                  const canCancel = ['administrateur', 'directeur'].includes(currentUser.role);
                  
                  return (
                    <tr key={idx} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4">
                        <p className="text-sm font-black text-[#121c32] uppercase">{tx.clientName}</p>
                        <p className="text-[10px] font-bold text-gray-600 uppercase tracking-tight">{tx.clientCode}</p>
                      </td>
                      <td className="px-6 py-4">
                        <p className={`text-xs font-bold uppercase ${tx.description.includes('pénalité') ? 'text-amber-600' : 'text-emerald-600'}`}>{tx.description}</p>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-[10px] font-black text-gray-600 uppercase">{tx.author || '---'}</p>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-sm font-black text-[#121c32]">{tx.amount.toLocaleString()} F</p>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-xs font-medium text-gray-700">{new Date(tx.date).toLocaleDateString()}</p>
                      </td>
                      <td className="px-6 py-4">
                        {!tx.cancelled && canCancel && (
                          <button 
                            onClick={() => handleCancelOperation(tx.memberId, tx.id)}
                            className="text-[10px] font-black text-red-500 uppercase hover:underline"
                          >
                            Annuler
                          </button>
                        )}
                        {tx.cancelled && (
                          <span className="text-[10px] font-black text-gray-400 uppercase italic">Annulé</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-gray-600 italic text-sm uppercase tracking-widest">
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
