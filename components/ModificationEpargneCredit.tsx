import React, { useState, useEffect } from 'react';
import { dispatchStorageEvent } from '../utils/events';
import { recordAuditLog } from '../utils/audit';
import { 
  Search, 
  Edit3, 
  Filter,
  ArrowDownLeft,
  ArrowUpRight,
  History as HistoryIcon,
  CheckCircle,
  AlertCircle,
  Save,
  RefreshCw,
  X
} from 'lucide-react';
import { ClientAccount, Transaction } from '../types';

interface OperationWithMember extends Transaction {
  memberName: string;
  memberCode: string;
  memberId: string;
}

const ModificationEpargneCredit: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [members, setMembers] = useState<ClientAccount[]>([]);
  const [allOperations, setAllOperations] = useState<OperationWithMember[]>([]);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [editingOp, setEditingOp] = useState<OperationWithMember | null>(null);
  const [newAmount, setNewAmount] = useState<number>(0);

  const loadData = () => {
    const savedMembers = localStorage.getItem('microfox_members_data');
    if (savedMembers) {
      const parsedMembers: ClientAccount[] = JSON.parse(savedMembers);
      const withHistory = parsedMembers.map(member => {
        let history = member.history || [];
        const savedHistory = localStorage.getItem(`microfox_history_${member.id}`);
        if (savedHistory) {
          try {
            history = JSON.parse(savedHistory);
          } catch (e) {
            console.error("Error parsing history for", member.id);
          }
        }
        return { ...member, history };
      });

      setMembers(withHistory);

      const ops: OperationWithMember[] = [];
      withHistory.forEach(member => {
        (member.history || []).forEach(tx => {
          // Uniquement les opérations de dépôt, retrait sur épargne, part sociale, garantie, frais ou remboursement crédit
          const isSavingsOp = tx.account === 'epargne' && (tx.type === 'depot' || tx.type === 'retrait');
          const isCreditOp = tx.account === 'credit' && tx.type === 'remboursement';
          const isPartSocialeOp = tx.account === 'partSociale' && tx.type === 'depot';
          const isGarantieOp = tx.account === 'garantie' && (tx.type === 'depot' || tx.type === 'retrait');
          const isFraisOp = tx.account === 'frais' && tx.type === 'depot';

          if (isSavingsOp || isCreditOp || isPartSocialeOp || isGarantieOp || isFraisOp) {
            ops.push({
              ...tx,
              memberId: member.id,
              memberName: member.name,
              memberCode: member.code
            });
          }
        });
      });

      ops.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      setAllOperations(ops);
    }
  };

  useEffect(() => {
    loadData();
    const handleStorage = () => loadData();
    window.addEventListener('storage', handleStorage);
    window.addEventListener('microfox_storage' as any, handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
      window.removeEventListener('microfox_storage' as any, handleStorage);
  }, []);

  const handleEdit = (op: OperationWithMember) => {
    setEditingOp(op);
    setNewAmount(op.amount);
  };

  const handleSaveModification = () => {
    if (!editingOp) return;
    if (newAmount === editingOp.amount) {
      setEditingOp(null);
      return;
    }

    const diff = newAmount - editingOp.amount;
    
    // Mise à jour des soldes de caisse ou d'agent
    if (editingOp.caisse && editingOp.caisse !== 'AGENT' && editingOp.caisse !== 'N/A') {
      const cashKey = `microfox_cash_balance_${editingOp.caisse}`;
      const currentCash = Number(localStorage.getItem(cashKey) || '0');
      // Si c'est une entrée (dépôt ou remboursement), l'augmentation du montant augmente la caisse
      // Si c'est une sortie (retrait), l'augmentation du montant diminue la caisse
      const isOutflow = editingOp.type === 'retrait';
      const cashDelta = isOutflow ? -diff : diff;
      localStorage.setItem(cashKey, (currentCash + cashDelta).toString());
    } else if (editingOp.userId && editingOp.caisse === 'AGENT') {
      const agentBalanceKey = `microfox_agent_balance_${editingOp.userId}`;
      const currentAgentBal = Number(localStorage.getItem(agentBalanceKey) || '0');
      const isOutflow = editingOp.type === 'retrait';
      const agentDelta = isOutflow ? -diff : diff;
      localStorage.setItem(agentBalanceKey, (currentAgentBal + agentDelta).toString());
    }

    const updatedMembers = members.map(m => {
      if (m.id === editingOp.memberId) {
        const newHistory = m.history.map(tx => {
          if (tx.id === editingOp.id) {
            let updatedTx = { ...tx, amount: newAmount, modifiedAt: new Date().toISOString() };
            
            // Ajustement proportionnel pour les crédits
            if (tx.account === 'credit' && tx.type === 'remboursement' && tx.amount > 0) {
              const capRatio = (tx.rembCapital || 0) / tx.amount;
              const intRatio = (tx.rembInterest || 0) / tx.amount;
              updatedTx.rembCapital = Math.floor(newAmount * capRatio);
              updatedTx.rembInterest = newAmount - updatedTx.rembCapital;
            }
            
            return updatedTx;
          }
          return tx;
        });

        // Ajustement du solde du membre
        const newBalances = { ...m.balances };
        const opAccount = editingOp.account as keyof typeof m.balances;

        if (opAccount && opAccount in newBalances) {
          if (opAccount === 'epargne' || opAccount === 'garantie' || opAccount === 'partSociale') {
            if (editingOp.type === 'depot') {
              (newBalances as any)[opAccount] += diff;
            } else if (editingOp.type === 'retrait') {
              (newBalances as any)[opAccount] -= diff;
            }
          } else if (opAccount === 'credit') {
            if (editingOp.type === 'remboursement') {
              // Un remboursement plus élevé diminue la dette (solde de crédit)
              (newBalances as any)[opAccount] -= diff;
            }
          }
        }

        localStorage.setItem(`microfox_history_${m.id}`, JSON.stringify(newHistory));
        return { ...m, history: newHistory, balances: newBalances };
      }
      return m;
    });

    recordAuditLog('MODIFICATION', 'EXCEPTIONS', `Modification montant opération ${editingOp.id} de ${editingOp.amount} F à ${newAmount} F pour ${editingOp.memberName}`);
    localStorage.setItem('microfox_members_data', JSON.stringify(updatedMembers));
    localStorage.setItem('microfox_pending_sync', 'true');
    setMembers(updatedMembers);
    
    const newOps = allOperations.map(o => o.id === editingOp.id ? { ...o, amount: newAmount } : o);
    setAllOperations(newOps);

    setSuccessMessage("Montant mis à jour avec succès.");
    setEditingOp(null);
    setTimeout(() => setSuccessMessage(null), 3000);
    dispatchStorageEvent();
  };

  const filteredOps = allOperations.filter(op => {
    const matchesSearch = op.memberName.toLowerCase().includes(searchTerm.toLowerCase()) || 
                         op.memberCode.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = filterType === 'all' || 
                       (filterType === 'depot' && op.type === 'depot' && op.account === 'epargne') ||
                       (filterType === 'retrait' && op.type === 'retrait' && op.account === 'epargne') ||
                       (filterType === 'remboursement' && op.type === 'remboursement') ||
                       (filterType === 'partSociale' && op.account === 'partSociale') ||
                       (filterType === 'garantie' && op.account === 'garantie') ||
                       (filterType === 'frais' && op.account === 'frais');
    
    return matchesSearch && matchesType;
  });

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-12 px-4 sm:px-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-[#121c32] uppercase tracking-tight">
            Modifications Epargne & Crédit
          </h1>
          <p className="text-gray-500 font-medium text-sm">Gestion des corrections d'opérations et écritures comptables</p>
        </div>
        <button 
          onClick={loadData}
          className="w-fit p-3 bg-white border border-gray-100 rounded-2xl text-[#121c32] hover:bg-gray-50 transition-all shadow-sm flex items-center gap-2 font-black text-[10px] uppercase tracking-widest"
        >
          <RefreshCw size={16} />
          Actualiser
        </button>
      </div>

      {successMessage && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center pointer-events-none">
          <div className="bg-emerald-600 text-white px-12 py-6 rounded-3xl shadow-2xl flex flex-col items-center gap-4 animate-in zoom-in duration-300 pointer-events-auto border-4 border-white/20">
            <CheckCircle size={48} className="animate-bounce" />
            <span className="font-black text-xl uppercase tracking-tighter text-center">{successMessage}</span>
          </div>
        </div>
      )}

      {errorMessage && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 bg-red-500 text-white px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-3 animate-in fade-in slide-in-from-top-4 duration-300">
          <AlertCircle size={20} />
          <span className="font-black text-sm uppercase tracking-widest">{errorMessage}</span>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
          <input 
            type="text" 
            placeholder="Rechercher par client..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-12 pr-4 py-4 bg-white border border-gray-100 rounded-2xl font-bold outline-none focus:border-blue-500 transition-all text-sm"
          />
        </div>
        <div className="relative">
          <Filter className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
          <select 
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="w-full pl-12 pr-4 py-4 bg-white border border-gray-100 rounded-2xl font-black text-xs text-[#121c32] outline-none appearance-none focus:border-blue-500 transition-all"
          >
            <option value="all">Tous types d'opérations</option>
            <option value="depot">Dépôts Epargne</option>
            <option value="retrait">Retraits Epargne</option>
            <option value="partSociale">Parts Sociales</option>
            <option value="garantie">Garanties</option>
            <option value="frais">Frais (Adhésion/Livret)</option>
            <option value="remboursement">Remboursements Crédit</option>
          </select>
        </div>
      </div>

      <div className="bg-white rounded-[2.5rem] shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50/50">
                <th className="px-6 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest border-b border-gray-100">Date</th>
                <th className="px-6 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest border-b border-gray-100">Client</th>
                <th className="px-6 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest border-b border-gray-100">Type</th>
                <th className="px-6 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest border-b border-gray-100 text-right">Montant</th>
                <th className="px-6 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest border-b border-gray-100 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filteredOps.length > 0 ? (
                filteredOps.map((op, idx) => (
                  <tr key={`${op.id}-${idx}`} className="hover:bg-gray-50/50 transition-colors group">
                    <td className="px-6 py-4">
                      <span className="text-xs font-black text-[#121c32]">{new Date(op.date).toLocaleDateString()}</span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="text-xs font-black text-[#121c32] uppercase">{op.memberName}</span>
                        <span className="text-[10px] font-bold text-gray-400">{op.memberCode}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <div className={`w-6 h-6 rounded-lg flex items-center justify-center ${op.type === 'depot' || op.type === 'remboursement' ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}`}>
                          {op.type === 'depot' || op.type === 'remboursement' ? <ArrowDownLeft size={14} /> : <ArrowUpRight size={14} />}
                        </div>
                        <span className="text-[10px] font-black text-[#121c32] uppercase">{op.type}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      {editingOp?.id === op.id ? (
                        <input 
                          type="number"
                          value={newAmount}
                          onChange={(e) => setNewAmount(Number(e.target.value))}
                          className="w-32 p-2 bg-blue-50 border border-blue-200 rounded-lg text-right font-black text-sm text-[#121c32] outline-none"
                        />
                      ) : (
                        <span className={`text-sm font-black ${op.type === 'depot' || op.type === 'remboursement' ? 'text-emerald-600' : 'text-red-600'}`}>
                          {op.amount.toLocaleString()} F
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-center gap-2">
                        {editingOp?.id === op.id ? (
                          <>
                            <button 
                              onClick={handleSaveModification}
                              className="p-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 transition-all shadow-sm"
                              title="Enregistrer"
                            >
                              <Save size={16} />
                            </button>
                            <button 
                              onClick={() => setEditingOp(null)}
                              className="p-2 bg-gray-100 text-gray-400 rounded-lg hover:bg-gray-200 transition-all"
                              title="Annuler"
                            >
                              <X size={16} />
                            </button>
                          </>
                        ) : (
                          <button 
                            onClick={() => handleEdit(op)}
                            className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                            title="Modifier le montant"
                          >
                            <Edit3 size={18} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="px-6 py-24 text-center">
                    <div className="opacity-20 flex flex-col items-center gap-4">
                      <HistoryIcon size={48} />
                      <p className="text-xs font-black uppercase tracking-widest">Aucune opération détectée</p>
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

export default ModificationEpargneCredit;
