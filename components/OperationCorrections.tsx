import React, { useState, useEffect } from 'react';
import { recordAuditLog } from '../utils/audit';
import { 
  Search, 
  RefreshCw, 
  Trash2, 
  Edit3, 
  AlertCircle, 
  CheckCircle, 
  Filter,
  ArrowDownLeft,
  ArrowUpRight,
  User,
  Calendar,
  History,
  ShieldAlert
} from 'lucide-react';
import { ClientAccount, Transaction } from '../types';

interface OperationWithMember extends Transaction {
  memberName: string;
  memberCode: string;
  memberId: string;
}

const OperationCorrections: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [members, setMembers] = useState<ClientAccount[]>([]);
  const [allOperations, setAllOperations] = useState<OperationWithMember[]>([]);
  const [editingOp, setEditingOp] = useState<OperationWithMember | null>(null);
  const [editAmount, setEditAmount] = useState<string>('');
  const [editDescription, setEditDescription] = useState<string>('');
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadData = () => {
    const savedMembers = localStorage.getItem('microfox_members_data');
    if (savedMembers) {
      const parsedMembers: ClientAccount[] = JSON.parse(savedMembers);
      
      // Ensure history is loaded for each client if it's empty in the saved array
      const withHistory = parsedMembers.map(member => {
        let history = member.history || [];
        if (history.length === 0) {
          const savedHistory = localStorage.getItem(`microfox_history_${member.id}`);
          if (savedHistory) history = JSON.parse(savedHistory);
        }
        return { ...member, history };
      });

      setMembers(withHistory);

      const ops: OperationWithMember[] = [];
      withHistory.forEach(member => {
        const history = member.history || [];
        history.forEach(tx => {
          ops.push({
            ...tx,
            memberId: member.id,
            memberName: member.name,
            memberCode: member.code
          });
        });
      });

      // Sort by date descending
      ops.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      setAllOperations(ops);
    }
  };

  useEffect(() => {
    loadData();
    window.addEventListener('storage', loadData);
    return () => window.removeEventListener('storage', loadData);
  }, []);

  const handleDelete = (op: OperationWithMember) => {
    if (!window.confirm(`Voulez-vous vraiment supprimer cette opération de ${op.amount.toLocaleString()} F pour ${op.memberName} ? Cette action est irréversible.`)) {
      return;
    }

    const updatedMembers = members.map(m => {
      if (m.id === op.memberId) {
        const newHistory = m.history.filter(tx => tx.id !== op.id);
        localStorage.setItem(`microfox_history_${m.id}`, JSON.stringify(newHistory));
        
        // Reverse balance impact
        const newBalances = { ...m.balances };
        
        if (op.type === 'transfert') {
          const from = op.account;
          const to = op.destinationAccount;
          if (from === 'tontine' && op.tontineAccountId) {
            const accIdx = m.tontineAccounts.findIndex(a => a.id === op.tontineAccountId || a.number === op.tontineAccountId);
            if (accIdx !== -1) {
              m.tontineAccounts[accIdx].balance += op.amount;
              newBalances.tontine += op.amount;
            }
          } else {
            (newBalances as any)[from] += op.amount;
          }
          if (to) (newBalances as any)[to] -= op.amount;
        } else {
          const isAddition = op.type === 'depot' || op.type === 'cotisation' || op.type === 'deblocage';
          const isSubtraction = op.type === 'retrait' || op.type === 'remboursement';

          if (isAddition) {
            newBalances[op.account] -= op.amount;
          } else if (isSubtraction) {
            newBalances[op.account] += op.amount;
          }

          // Update tontine account if applicable
          if (op.account === 'tontine' && op.tontineAccountId) {
            m.tontineAccounts = m.tontineAccounts.map(ta => {
              if (ta.id === op.tontineAccountId || ta.number === op.tontineAccountId) {
                return { ...ta, balance: isAddition ? ta.balance - op.amount : ta.balance + op.amount };
              }
              return ta;
            });
          }
        }

        return { ...m, history: newHistory, balances: newBalances, tontineAccounts: m.tontineAccounts };
      }
      return m;
    });

    recordAuditLog('SUPPRESSION', 'CORRECTIONS', `Suppression de l'opération ${op.id} (${op.type}) du membre ${op.memberName}`);
    saveAndUpdate(updatedMembers, "Opération supprimée avec succès.");
  };

  const handleEdit = (op: OperationWithMember) => {
    setEditingOp(op);
    setEditAmount(op.amount.toString());
    setEditDescription(op.description);
  };

  const saveEdit = () => {
    if (!editingOp) return;
    const newAmount = Number(editAmount);
    if (isNaN(newAmount) || newAmount < 0) {
      setErrorMessage("Montant invalide.");
      return;
    }

    const diff = newAmount - editingOp.amount;

    const updatedMembers = members.map(m => {
      if (m.id === editingOp.memberId) {
        const newHistory = m.history.map(tx => {
          if (tx.id === editingOp.id) {
            return { ...tx, amount: newAmount, description: editDescription };
          }
          return tx;
        });
        localStorage.setItem(`microfox_history_${m.id}`, JSON.stringify(newHistory));

        // Update balances
        const newBalances = { ...m.balances };
        
        if (editingOp.type === 'transfert') {
          const from = editingOp.account;
          const to = editingOp.destinationAccount;
          if (from === 'tontine' && editingOp.tontineAccountId) {
            const accIdx = m.tontineAccounts.findIndex(a => a.id === editingOp.tontineAccountId || a.number === editingOp.tontineAccountId);
            if (accIdx !== -1) {
              m.tontineAccounts[accIdx].balance += diff;
              newBalances.tontine += diff;
            }
          } else {
            (newBalances as any)[from] += diff;
          }
          if (to) (newBalances as any)[to] -= diff;
        } else {
          const isAddition = editingOp.type === 'depot' || editingOp.type === 'cotisation' || editingOp.type === 'deblocage';
          const isSubtraction = editingOp.type === 'retrait' || editingOp.type === 'remboursement';

          if (isAddition) {
            newBalances[editingOp.account] += diff;
          } else if (isSubtraction) {
            newBalances[editingOp.account] -= diff;
          }

          // Update tontine account if applicable
          if (editingOp.account === 'tontine' && editingOp.tontineAccountId) {
            m.tontineAccounts = m.tontineAccounts.map(ta => {
              if (ta.id === editingOp.tontineAccountId || ta.number === editingOp.tontineAccountId) {
                return { ...ta, balance: isAddition ? ta.balance + diff : ta.balance - diff };
              }
              return ta;
            });
          }
        }

        return { ...m, history: newHistory, balances: newBalances, tontineAccounts: m.tontineAccounts };
      }
      return m;
    });

    recordAuditLog('MODIFICATION', 'CORRECTIONS', `Modification de l'opération ${editingOp.id} du membre ${editingOp.memberName}. Nouveau montant: ${editingOp.amount}`);
    saveAndUpdate(updatedMembers, "Opération modifiée avec succès.");
    setEditingOp(null);
  };

  const saveAndUpdate = (updatedMembers: ClientAccount[], msg: string) => {
    localStorage.setItem('microfox_members_data', JSON.stringify(updatedMembers));
    localStorage.setItem('microfox_pending_sync', 'true');
    setMembers(updatedMembers);
    
    // Refresh local list
    const ops: OperationWithMember[] = [];
    updatedMembers.forEach(member => {
      member.history.forEach(tx => {
        ops.push({
          ...tx,
          memberId: member.id,
          memberName: member.name,
          memberCode: member.code
        });
      });
    });
    ops.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    setAllOperations(ops);

    setSuccessMessage(msg);
    setTimeout(() => setSuccessMessage(null), 3000);
    window.dispatchEvent(new Event('storage'));
  };

  const filteredOps = allOperations.filter(op => {
    const matchesSearch = op.memberName.toLowerCase().includes(searchTerm.toLowerCase()) || 
                         op.memberCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         op.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = filterType === 'all' || op.type === filterType || op.account === filterType;
    return matchesSearch && matchesType;
  });

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-12">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-extrabold text-[#121c32] uppercase tracking-tight leading-tight">
            Corrections d'opération
          </h1>
          <p className="text-gray-700 text-sm font-medium mt-1">Modification et suppression des écritures comptables</p>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 bg-red-50 text-red-600 rounded-lg border border-red-100 text-xs font-bold self-start">
          <ShieldAlert size={16} />
          <span>ADMINISTRATION</span>
        </div>
      </div>

      {successMessage && (
        <div className="bg-emerald-50 border border-emerald-100 text-emerald-600 p-4 rounded-2xl flex items-center gap-3 animate-in fade-in slide-in-from-top-2">
          <CheckCircle size={20} />
          <span className="font-bold text-sm uppercase tracking-tight">{successMessage}</span>
        </div>
      )}

      {errorMessage && (
        <div className="bg-red-50 border border-red-100 text-red-600 p-4 rounded-2xl flex items-center gap-3 animate-in fade-in slide-in-from-top-2">
          <AlertCircle size={20} />
          <span className="font-bold text-sm uppercase tracking-tight">{errorMessage}</span>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="md:col-span-2 relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
          <input 
            type="text" 
            placeholder="Rechercher par client ou description..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-12 pr-4 py-4 bg-white border-2 border-gray-100 rounded-2xl font-medium outline-none focus:border-[#121c32] transition-all"
          />
        </div>
        <div className="relative">
          <Filter className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
          <select 
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="w-full pl-12 pr-4 py-4 bg-white border-2 border-gray-100 rounded-2xl font-bold text-[#121c32] outline-none appearance-none focus:border-[#121c32] transition-all"
          >
            <option value="all">Tous les types</option>
            <option value="cotisation">Tontine (Cotisation)</option>
            <option value="depot">Dépôts</option>
            <option value="retrait">Retraits</option>
            <option value="deblocage">Déblocage Crédit</option>
            <option value="remboursement">Remboursement</option>
            <option value="epargne">Compte Épargne</option>
            <option value="tontine">Compte Tontine</option>
          </select>
        </div>
      </div>

      <div className="bg-white rounded-[2rem] shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-gray-50 bg-gray-50/50">
                <th className="px-6 py-4 text-[10px] font-black text-gray-500 uppercase tracking-widest">Date & Heure</th>
                <th className="px-6 py-4 text-[10px] font-black text-gray-500 uppercase tracking-widest">Client</th>
                <th className="px-6 py-4 text-[10px] font-black text-gray-500 uppercase tracking-widest">Type / Compte</th>
                <th className="px-6 py-4 text-[10px] font-black text-gray-500 uppercase tracking-widest">Description</th>
                <th className="px-6 py-4 text-[10px] font-black text-gray-500 uppercase tracking-widest text-right">Montant</th>
                <th className="px-6 py-4 text-[10px] font-black text-gray-500 uppercase tracking-widest text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filteredOps.length > 0 ? (
                filteredOps.map((op) => (
                  <tr key={op.id} className="hover:bg-gray-50 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="text-xs font-black text-[#121c32]">{new Date(op.date).toLocaleDateString()}</span>
                        <span className="text-[10px] font-bold text-gray-500">{new Date(op.date).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="text-xs font-black text-[#121c32] uppercase">{op.memberName}</span>
                        <span className="text-[10px] font-bold text-gray-500">{op.memberCode}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <div className={`w-6 h-6 rounded-lg flex items-center justify-center ${op.type === 'depot' || op.type === 'cotisation' || op.type === 'remboursement' ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}`}>
                          {op.type === 'depot' || op.type === 'cotisation' || op.type === 'remboursement' ? <ArrowDownLeft size={14} /> : <ArrowUpRight size={14} />}
                        </div>
                        <div className="flex flex-col">
                          <span className="text-[10px] font-black text-[#121c32] uppercase">{op.type}</span>
                          <span className="text-[9px] font-bold text-gray-500 uppercase tracking-tighter">{op.account}</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-[10px] font-medium text-gray-700" title={op.description}>{op.description}</p>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <span className={`text-sm font-black ${op.type === 'depot' || op.type === 'cotisation' || op.type === 'remboursement' ? 'text-emerald-600' : 'text-red-600'}`}>
                        {op.amount.toLocaleString()} F
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-center gap-2">
                        <button 
                          onClick={() => handleEdit(op)}
                          className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all"
                          title="Modifier"
                        >
                          <Edit3 size={18} />
                        </button>
                        <button 
                          onClick={() => handleDelete(op)}
                          className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all"
                          title="Supprimer"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="px-6 py-20 text-center">
                    <div className="flex flex-col items-center gap-3 opacity-20">
                      <History size={48} />
                      <p className="text-sm font-black uppercase tracking-widest text-gray-600">Aucune opération trouvée</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal de modification */}
      {editingOp && (
        <div className="fixed inset-0 z-[100] bg-[#121c32]/80 backdrop-blur-sm flex items-start justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-[2.5rem] w-full max-w-md p-8 shadow-2xl animate-in zoom-in-95 duration-200 my-4 sm:my-8">
            <div className="flex items-center gap-3 mb-8">
              <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600">
                <Edit3 size={20} />
              </div>
              <div>
                <h3 className="text-lg font-black uppercase tracking-tight text-[#121c32]">Modifier l'opération</h3>
                <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">{editingOp.memberName}</p>
              </div>
            </div>

            <div className="space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-600 uppercase tracking-widest ml-1">Nouveau Montant (F)</label>
                <input 
                  type="number" 
                  value={editAmount}
                  onChange={(e) => setEditAmount(e.target.value)}
                  className="w-full p-4 bg-gray-50 border border-transparent focus:border-blue-200 rounded-2xl outline-none text-sm font-bold text-[#121c32] transition-all"
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-600 uppercase tracking-widest ml-1">Description / Motif</label>
                <textarea 
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  rows={3}
                  className="w-full p-4 bg-gray-50 border border-transparent focus:border-blue-200 rounded-2xl outline-none text-sm font-bold text-[#121c32] transition-all resize-none"
                />
              </div>

              <div className="bg-amber-50 border border-amber-100 p-4 rounded-2xl flex gap-3">
                <AlertCircle className="text-amber-600 shrink-0" size={20} />
                <p className="text-[10px] text-amber-700 font-bold leading-relaxed uppercase">
                  Attention: La modification du montant ajustera automatiquement le solde du compte {editingOp.account} du client.
                </p>
              </div>

              <div className="flex gap-4 pt-4">
                <button 
                  onClick={() => setEditingOp(null)}
                  className="flex-1 py-4 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-2xl font-black uppercase tracking-widest transition-all"
                >
                  Annuler
                </button>
                <button 
                  onClick={saveEdit}
                  className="flex-1 py-4 bg-[#121c32] text-white rounded-2xl font-black uppercase tracking-widest shadow-xl shadow-[#121c32]/20 transition-all active:scale-95"
                >
                  Enregistrer
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default OperationCorrections;
