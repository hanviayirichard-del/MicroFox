import React, { useState, useEffect } from 'react';
import { dispatchStorageEvent } from '../utils/events';
import { RotateCcw, Search, Calendar, User, AlertCircle, CheckCircle, Trash2, Download, Printer } from 'lucide-react';
import { recordAuditLog } from '../utils/audit';

interface TontineTransaction {
  id: string;
  clientId: string;
  clientName: string;
  clientCode: string;
  amount: number;
  date: string;
  description: string;
  tontineAccountId: string;
  userId: string;
  caisse: string;
  tontineAccountNumber?: string;
  recordedBy: string;
  isValidated: boolean; // true if already deposited at the main desk
}

const CancelCotisation: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [transactions, setTransactions] = useState<TontineTransaction[]>([]);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const user = localStorage.getItem('microfox_current_user');
    if (user) setCurrentUser(JSON.parse(user));
    loadTransactions();
    window.addEventListener('storage', loadTransactions);
    window.addEventListener('microfox_storage' as any, loadTransactions);
    return () => window.removeEventListener('storage', loadTransactions);
      window.removeEventListener('microfox_storage' as any, loadTransactions);
  }, []);

  const loadTransactions = () => {
    const savedMembers = localStorage.getItem('microfox_members_data');
    const savedUser = localStorage.getItem('microfox_current_user');
    const user = savedUser ? JSON.parse(savedUser) : null;
    
    if (!savedMembers || !user) return;

    const allMembers = JSON.parse(savedMembers);
    const allTransactions: TontineTransaction[] = [];

    // Get validated deposits to check if transaction is already "poured" to main desk
    const savedDeposits = localStorage.getItem('microfox_agent_deposits');
    const validatedDeposits = savedDeposits ? JSON.parse(savedDeposits).filter((d: any) => d.status === 'Validé') : [];
    
    // Get validated zones to check if transaction is already "locked"
    const savedValidatedZones = localStorage.getItem('microfox_validated_zone_cotisations');
    const validatedZones = savedValidatedZones ? JSON.parse(savedValidatedZones) : {};
    
    allMembers.forEach((m: any) => {
      const savedHistory = localStorage.getItem(`microfox_history_${m.id}`);
      const history = savedHistory ? JSON.parse(savedHistory) : (m.history || []);
      
      history.forEach((tx: any) => {
        // Can only cancel cotisations recorded by the person OR anyone if admin/director
        const isOwner = tx.userId === user.id;
        const isAdmin = user.role === 'admin' || user.role === 'directeur';

        if (tx.type === 'cotisation' && tx.account === 'tontine' && (isOwner || isAdmin)) {
          
          // Check if this specific transaction was part of a validated deposit
          const isPoured = validatedDeposits.some((d: any) => 
            d.agentId === tx.userId && 
            new Date(tx.date) <= new Date(d.date) // Simplification: if deposit happened after tx
          );

          // Check if the zone is validated for this date and if the transaction was made before the validation
          const txDate = new Date(tx.date).toISOString().split('T')[0];
          const validationKey = `${txDate}_${m.zone}`;
          const zoneValidation = validatedZones[validationKey];
          const isZoneValidated = zoneValidation && new Date(tx.date) <= new Date(zoneValidation.validatedAt);

          allTransactions.push({
            id: tx.id,
            clientId: m.id,
            clientName: m.name,
            clientCode: m.code,
            amount: tx.amount,
            date: tx.date,
            description: tx.description,
            tontineAccountId: tx.tontineAccountId,
            tontineAccountNumber: tx.tontineAccountNumber,
            userId: tx.userId,
            caisse: tx.caisse || 'AGENT',
            recordedBy: tx.cashierName || 'N/A',
            isValidated: isPoured || isZoneValidated
          });
        }
      });
    });

    // Sort by date descending
    setTransactions(allTransactions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
  };

  const handleCancel = (tx: TontineTransaction) => {
    if (tx.isValidated) {
      setErrorMessage("Impossible d'annuler : Cette cotisation a déjà été versée à la caisse.");
      setTimeout(() => setErrorMessage(null), 5000);
      return;
    }

    try {
      // 1. Update member history and balance
      const savedMembers = localStorage.getItem('microfox_members_data');
      if (savedMembers) {
        const allMembers = JSON.parse(savedMembers);
        const updatedMembers = allMembers.map((m: any) => {
          if (m.id === tx.clientId) {
            // Update history: Mark as cancelled instead of deleting
            const savedHistory = localStorage.getItem(`microfox_history_${m.id}`);
            let history = savedHistory ? JSON.parse(savedHistory) : (m.history || []);
            const updatedHistory = history.map((h: any) => {
              if (h.id === tx.id) {
                return { 
                  ...h, 
                  type: 'annulation', 
                  description: `ANNULÉ: ${h.description}`,
                  cancelledAt: new Date().toISOString(),
                  cancelledBy: currentUser.identifiant,
                  originalAmount: h.amount,
                  amount: 0 // Set amount to 0 so it doesn't affect totals if logic is simple
                };
              }
              return h;
            });
            localStorage.setItem(`microfox_history_${m.id}`, JSON.stringify(updatedHistory));

            // Update tontine account balance
            const updatedTontineAccounts = (m.tontineAccounts || []).map((acc: any) => {
              if (acc.id === tx.tontineAccountId) {
                return { ...acc, balance: Math.max(0, (acc.balance || 0) - tx.amount) };
              }
              return acc;
            });

            return {
              ...m,
              balances: { ...m.balances, tontine: Math.max(0, (m.balances?.tontine || 0) - tx.amount) },
              tontineAccounts: updatedTontineAccounts,
              history: updatedHistory
            };
          }
          return m;
        });
        localStorage.setItem('microfox_members_data', JSON.stringify(updatedMembers));
      }

      // 2. Update Correct Balance (Caisse or Agent)
      if (tx.caisse && tx.caisse !== 'AGENT' && tx.caisse !== 'N/A') {
        // Update Caisse balance
        const cashKey = `microfox_cash_balance_${tx.caisse}`;
        const currentCashBalance = Number(localStorage.getItem(cashKey) || 0);
        localStorage.setItem(cashKey, Math.max(0, currentCashBalance - tx.amount).toString());
      } else {
        // Update Agent balance
        const agentBalanceKey = `microfox_agent_balance_${tx.userId}`;
        const currentAgentBalance = Number(localStorage.getItem(agentBalanceKey) || 0);
        localStorage.setItem(agentBalanceKey, Math.max(0, currentAgentBalance - tx.amount).toString());
      }

      // 3. Record Audit Log
      recordAuditLog('MODIFICATION', 'TONTINE', `Annulation cotisation ${tx.amount} F - Client: ${tx.clientName} (${tx.clientCode})`);

      setSuccessMessage("Cotisation annulée avec succès.");
      setTimeout(() => setSuccessMessage(null), 4000);
      
      // Force immediate UI update
      loadTransactions();
      dispatchStorageEvent();
    } catch (error) {
      setErrorMessage("Une erreur est survenue lors de l'annulation.");
      setTimeout(() => setErrorMessage(null), 5000);
    }
  };

  const filteredTransactions = transactions.filter(tx => {
    const txDateString = new Date(tx.date).toISOString().split('T')[0];
    const matchesSearch = tx.clientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      tx.clientCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (tx.tontineAccountNumber && tx.tontineAccountNumber.toLowerCase().includes(searchTerm.toLowerCase())) ||
      tx.description.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesDate = txDateString >= startDate && txDateString <= endDate;
    
    return matchesSearch && matchesDate;
  });

  const totalFilteredAmount = filteredTransactions.reduce((sum, tx) => sum + tx.amount, 0);

  const handlePrint = () => {
    window.print();
  };

  const handleExport = () => {
    if (filteredTransactions.length === 0) return;
    
    const headers = ["Date", "Client", "Code", "Description", "Montant", "Statut"];
    const rows = filteredTransactions.map(tx => [
      new Date(tx.date).toLocaleDateString(),
      tx.clientName,
      tx.clientCode,
      tx.description.replace(/,/g, ' '),
      tx.amount.toString(),
      tx.isValidated ? "Versé" : "En attente"
    ]);
    
    const csvContent = "\ufeff" + [headers, ...rows].map(e => e.join(";")).join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `annulations_cotisations_${startDate}_au_${endDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-start gap-3">
          <div className="mt-1 text-red-500">
            <RotateCcw size={24} />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold text-[#121c32] uppercase tracking-tight leading-tight">
              Annulation de<br />Cotisation
            </h1>
            <p className="text-gray-500 font-medium text-sm mt-1">Gérer les erreurs de saisie avant versement</p>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto print:hidden">
          <button 
            onClick={handlePrint}
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-gray-50 transition-all active:scale-95 shadow-sm"
          >
            <Printer size={16} />
            Imprimer
          </button>
          <button 
            onClick={handleExport}
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-[#121c32] text-white rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-[#121c32]/90 transition-all active:scale-95 shadow-lg shadow-[#121c32]/10"
          >
            <Download size={16} />
            Exporter
          </button>
        </div>
      </div>

      {/* Messages */}
      {(successMessage || errorMessage) && (
        <div className="print:hidden space-y-4">
          {successMessage && (
            <div className="bg-emerald-500 text-white p-4 rounded-2xl flex items-center justify-center gap-3 shadow-xl animate-in fade-in slide-in-from-top-4 duration-300">
              <CheckCircle size={20} />
              <span className="font-black uppercase tracking-tight text-sm text-center">{successMessage}</span>
            </div>
          )}

          {errorMessage && (
            <div className="bg-red-500 text-white p-4 rounded-2xl flex items-center justify-center gap-3 shadow-xl animate-in fade-in slide-in-from-top-4 duration-300">
              <AlertCircle size={20} />
              <span className="font-black uppercase tracking-tight text-sm text-center">{errorMessage}</span>
            </div>
          )}
        </div>
      )}

      {/* Search & Filters */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 print:hidden">
        <div className="bg-white p-4 rounded-[1.5rem] shadow-sm border border-gray-100 flex-1">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
            <input 
              type="text" 
              placeholder="Rechercher par client ou description..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-12 pr-4 py-4 bg-gray-50 text-[#121c32] rounded-2xl font-medium outline-none placeholder:text-gray-400 border border-gray-100 focus:border-red-500 transition-all"
            />
          </div>
        </div>

        <div className="bg-white p-4 rounded-[1.5rem] shadow-sm border border-gray-100">
          <div className="flex items-center gap-3">
            <div className="flex-1 space-y-1">
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Du</label>
              <input 
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-4 py-3 bg-gray-50 text-[#121c32] rounded-xl font-bold outline-none border border-gray-100 focus:border-red-500 transition-all text-sm"
              />
            </div>
            <div className="flex-1 space-y-1">
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Au</label>
              <input 
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-4 py-3 bg-gray-50 text-[#121c32] rounded-xl font-bold outline-none border border-gray-100 focus:border-red-500 transition-all text-sm"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Summary Stat */}
      <div className="bg-white p-6 rounded-[1.5rem] shadow-sm border border-gray-100 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-red-50 flex items-center justify-center text-red-500">
            <Calendar size={24} />
          </div>
          <div>
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Total des cotisations filtrées</p>
            <p className="text-2xl font-black text-[#121c32]">{totalFilteredAmount.toLocaleString()} FCFA</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Transactions</p>
          <p className="text-lg font-bold text-[#121c32]">{filteredTransactions.length}</p>
        </div>
      </div>

      {/* Transactions List */}
      <div className="bg-white rounded-[1.5rem] shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left min-w-[800px]">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="px-6 py-4 text-[10px] font-black text-gray-500 uppercase tracking-widest">Date & Heure</th>
                <th className="px-6 py-4 text-[10px] font-black text-gray-500 uppercase tracking-widest">Client</th>
                <th className="px-6 py-4 text-[10px] font-black text-gray-500 uppercase tracking-widest">Description</th>
                <th className="px-6 py-4 text-[10px] font-black text-gray-500 uppercase tracking-widest text-right">Montant</th>
                <th className="px-6 py-4 text-[10px] font-black text-gray-500 uppercase tracking-widest text-center">Statut</th>
                <th className="px-6 py-4 text-[10px] font-black text-gray-500 uppercase tracking-widest text-right print:hidden">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filteredTransactions.length > 0 ? (
                filteredTransactions.map((tx) => (
                  <tr key={tx.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="text-sm font-bold text-[#121c32]">{new Date(tx.date).toLocaleDateString()}</span>
                        <span className="text-[10px] font-medium text-gray-400">{new Date(tx.date).toLocaleTimeString()}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="text-sm font-black text-[#121c32] uppercase">{tx.clientName}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-bold text-gray-500">{tx.clientCode}</span>
                          {tx.tontineAccountNumber && (
                            <span className="text-[9px] font-black text-blue-500 bg-blue-50 px-1.5 rounded uppercase">{tx.tontineAccountNumber}</span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-xs font-medium text-gray-600 max-w-[200px] truncate">{tx.description}</p>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <span className="text-sm font-black text-[#121c32]">{tx.amount.toLocaleString()} F</span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      {tx.isValidated ? (
                        <span className="px-3 py-1 bg-emerald-50 text-emerald-600 rounded-lg text-[10px] font-black uppercase tracking-tight">Versé</span>
                      ) : (
                        <span className="px-3 py-1 bg-amber-50 text-amber-600 rounded-lg text-[10px] font-black uppercase tracking-tight">En attente</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right print:hidden">
                      {!tx.isValidated ? (
                        <button 
                          onClick={() => handleCancel(tx)}
                          className="p-2 text-red-500 hover:bg-red-50 rounded-xl transition-all active:scale-90"
                          title="Annuler la cotisation"
                        >
                          <Trash2 size={20} />
                        </button>
                      ) : (
                        <div className="p-2 text-gray-300 cursor-not-allowed">
                          <Trash2 size={20} />
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="px-6 py-20 text-center">
                    <p className="text-sm font-bold text-gray-400 italic">Aucune cotisation annulable trouvée.</p>
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

export default CancelCotisation;
