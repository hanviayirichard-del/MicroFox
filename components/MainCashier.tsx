
import React, { useState, useEffect } from 'react';
import { Landmark, CheckCircle, XCircle, Clock, Search, Filter, TrendingUp, Wallet, ArrowDownCircle, Send, ShieldCheck } from 'lucide-react';
import { recordAuditLog } from '../utils/audit';

const MainCashier: React.FC = () => {
  const [payments, setPayments] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('Tous');
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [transferAmount, setTransferAmount] = useState('');
  const [caisses, setCaisses] = useState(() => {
    const userStr = localStorage.getItem('microfox_current_user');
    if (userStr) {
      const user = JSON.parse(userStr);
      if (user.role === 'caissier' && user.caisse) {
        return [user.caisse];
      }
    }
    return ['CAISSE PRINCIPALE', 'CAISSE 1', 'CAISSE 2'];
  });
  const [selectedCaisse, setSelectedCaisse] = useState(() => {
    const userStr = localStorage.getItem('microfox_current_user');
    if (userStr) {
      const user = JSON.parse(userStr);
      if (user.role === 'caissier' && user.caisse) {
        return user.caisse;
      }
    }
    return 'CAISSE PRINCIPALE';
  });
  const [cashBalance, setCashBalance] = useState(() => {
    const userStr = localStorage.getItem('microfox_current_user');
    let initialCaisse = 'CAISSE PRINCIPALE';
    if (userStr) {
      const user = JSON.parse(userStr);
      if (user.role === 'caissier' && user.caisse) {
        initialCaisse = user.caisse;
      }
    }
    const saved = localStorage.getItem(`microfox_cash_balance_${initialCaisse}`);
    return saved !== null ? Number(saved) : (initialCaisse === 'CAISSE PRINCIPALE' ? 5000000 : 0);
  });
  const [denominations, setDenominations] = useState<any>({
    '10000': 0,
    '5000': 0,
    '2000': 0,
    '1000': 0,
    '500': 0,
    '250': 0,
    '200': 0,
    '100': 0,
    '50': 0,
    '25': 0,
    '10': 0,
    '5': 0,
    'monnaie': 0
  });

  const calculateTotalBilletage = () => {
    return (Number(denominations['10000']) * 10000) +
           (Number(denominations['5000']) * 5000) +
           (Number(denominations['2000']) * 2000) +
           (Number(denominations['1000']) * 1000) +
           (Number(denominations['500']) * 500) +
           (Number(denominations['250']) * 250) +
           (Number(denominations['200']) * 200) +
           (Number(denominations['100']) * 100) +
           (Number(denominations['50']) * 50) +
           (Number(denominations['25']) * 25) +
           (Number(denominations['10']) * 10) +
           (Number(denominations['5']) * 5) +
           Number(denominations['monnaie']);
  };

  const [observedAmounts, setObservedAmounts] = useState<{[key: string]: string}>({});
  const [gapObservations, setGapObservations] = useState<{[key: string]: string}>({});
  const [validationErrors, setValidationErrors] = useState<{[key: string]: string}>({});
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  useEffect(() => {
    const loadData = () => {
      const savedPayments = localStorage.getItem('microfox_agent_payments');
      if (savedPayments) setPayments(JSON.parse(savedPayments));
      
      const savedBalance = localStorage.getItem(`microfox_cash_balance_${selectedCaisse}`);
      setCashBalance(savedBalance !== null ? Number(savedBalance) : (selectedCaisse === 'CAISSE PRINCIPALE' ? 5000000 : 0));
    };
    
    loadData();
    window.addEventListener('storage', loadData);
    return () => window.removeEventListener('storage', loadData);
  }, [selectedCaisse]);

  const handleAction = (paymentId: string, action: 'Validé' | 'Rejeté') => {
    const observed = observedAmounts[paymentId];
    const observation = gapObservations[paymentId] || '';

    if (action === 'Validé' && !observed) {
      setValidationErrors({...validationErrors, [paymentId]: "Saisie du montant reçu obligatoire"});
      return;
    }
    
    if (validationErrors[paymentId]) {
      const newErrors = {...validationErrors};
      delete newErrors[paymentId];
      setValidationErrors(newErrors);
    }
    
    const saved = localStorage.getItem('microfox_agent_payments');
    const currentPayments = saved ? JSON.parse(saved) : [];
    const updatedPayments = currentPayments.map((p: any) => {
      if (p.id === paymentId) {
        const finalAmount = observed ? Number(observed) : p.totalAmount;
        const theoretical = p.theoreticalAmount ?? p.totalAmount;
        const gap = finalAmount - theoretical;

        if (action === 'Validé' && p.status !== 'Validé') {
          const targetCaisse = selectedCaisse;
          const balanceKey = `microfox_cash_balance_${targetCaisse}`;
          const savedBal = localStorage.getItem(balanceKey);
          const currentBal = savedBal !== null ? Number(savedBal) : (targetCaisse === 'CAISSE PRINCIPALE' ? 5000000 : 0);
          const newBal = currentBal + finalAmount;
          localStorage.setItem(balanceKey, newBal.toString());
          
          setCashBalance(newBal);
          
          if (gap !== 0) {
            const savedGaps = localStorage.getItem('microfox_all_gaps');
            const allGaps = savedGaps ? JSON.parse(savedGaps) : [];
            
            // Find agent zone
            const savedUsers = localStorage.getItem('microfox_users');
            const allUsers = savedUsers ? JSON.parse(savedUsers) : [];
            const agent = allUsers.find((u: any) => u.id === p.agentId);
            const agentZone = agent?.zoneCollecte || agent?.zone;

            const agentCode = agent?.code || p.agentId;

            const newGapEntry = {
              id: `gap_${Date.now()}`,
              date: new Date().toISOString(),
              type: 'AGENT',
              sourceId: p.id,
              sourceName: p.agentName,
              sourceCode: agentCode,
              userId: p.agentId,
              declaredAmount: p.theoreticalAmount ?? p.totalAmount,
              observedAmount: finalAmount,
              gapAmount: gap,
              status: 'En attente',
              zone: agentZone,
              observation: observation,
              validatorId: JSON.parse(localStorage.getItem('microfox_current_user') || '{}').id
            };
            localStorage.setItem('microfox_all_gaps', JSON.stringify([newGapEntry, ...allGaps]));
          }
        } else if (action === 'Rejeté' && p.status !== 'Rejeté') {
          if (p.type === 'CASHIER_TRANSFER') {
            const sourceCaisseKey = `microfox_cash_balance_${p.agentId}`;
            const currentSourceBal = Number(localStorage.getItem(sourceCaisseKey) || 0);
            localStorage.setItem(sourceCaisseKey, (currentSourceBal + p.totalAmount).toString());
          } else {
            // Return money to agent balance
            const agentBalanceKey = `microfox_agent_balance_${p.agentId}`;
            const currentAgentBalance = Number(localStorage.getItem(agentBalanceKey) || 0);
            localStorage.setItem(agentBalanceKey, (currentAgentBalance + p.totalAmount).toString());
          }
          
          recordAuditLog('MODIFICATION', 'CAISSE', `Versement de ${p.agentName} REJETÉ (${p.totalAmount} FCFA)`);
        }
        return { ...p, status: action, caisse: selectedCaisse, observedAmount: finalAmount, gap: gap, validatorId: JSON.parse(localStorage.getItem('microfox_current_user') || '{}').id };
      }
      return p;
    });

    localStorage.setItem('microfox_agent_payments', JSON.stringify(updatedPayments));
    localStorage.setItem('microfox_pending_sync', 'true');
    setPayments(updatedPayments);
    window.dispatchEvent(new Event('storage'));
  };

  const currentUser = JSON.parse(localStorage.getItem('microfox_current_user') || '{}');
  const isAdminOrDirector = currentUser.role === 'admin' || currentUser.role === 'directeur';

  const handleTransferToVault = () => {
    const physicalAmount = calculateTotalBilletage();
    const theoreticalAmount = cashBalance;
    const gap = physicalAmount - theoreticalAmount;

    if (cashBalance === 0) {
      alert(`Opération impossible : Le solde de la ${selectedCaisse} est à zéro.`);
      return;
    }

    if (physicalAmount <= 0) {
      alert("Le montant du billetage doit être supérieur à 0.");
      return;
    }

    const isMainCaisse = selectedCaisse === 'CAISSE PRINCIPALE';
    const targetDestination = isMainCaisse ? 'Coffre' : 'CAISSE PRINCIPALE';
    
    if (isMainCaisse) {
      if (!isAdminOrDirector) {
        alert("Seul l'administrateur ou le Directeur peut effectuer un versement au coffre depuis la caisse principale.");
        return;
      }
      const vaultSaved = localStorage.getItem('microfox_vault_balance');
      const vaultBalance = vaultSaved ? Number(vaultSaved) : 10000000;
      localStorage.setItem('microfox_vault_balance', (vaultBalance + physicalAmount).toString());
    } else {
      // Versement à la Caisse Principale - Doit être validé par Admin/Directeur
      const savedPayments = localStorage.getItem('microfox_agent_payments');
      const allPayments = savedPayments ? JSON.parse(savedPayments) : [];
      
      const transferPayment = {
        id: `transfer_${Date.now()}`,
        agentId: selectedCaisse,
        agentName: selectedCaisse,
        amountCotisations: 0,
        amountLivrets: 0,
        totalAmount: physicalAmount,
        physicalBalance: physicalAmount,
        gap: gap,
        billetage: denominations,
        date: new Date().toISOString(),
        status: 'En attente',
        caisse: 'CAISSE PRINCIPALE',
        type: 'CASHIER_TRANSFER'
      };
      
      localStorage.setItem('microfox_agent_payments', JSON.stringify([transferPayment, ...allPayments]));
    }
    
    const newCashBalance = 0; // On vide la caisse après versement
    localStorage.setItem(`microfox_cash_balance_${selectedCaisse}`, newCashBalance.toString());
    
    // Enregistrer l'écart si présent
    if (gap !== 0) {
      const savedGaps = localStorage.getItem('microfox_all_gaps');
      const allGaps = savedGaps ? JSON.parse(savedGaps) : [];
      
      const savedUsersList = localStorage.getItem('microfox_users');
      const allUsersList = savedUsersList ? JSON.parse(savedUsersList) : [];
      const cashier = allUsersList.find((u: any) => u.caisse === selectedCaisse);
      const responsibleUserId = cashier?.id || JSON.parse(localStorage.getItem('microfox_current_user') || '{}').id;

      const newGapEntry = {
        id: `gap_${Date.now()}`,
        date: new Date().toISOString(),
        type: 'CAISSIER',
        sourceId: selectedCaisse,
        sourceName: selectedCaisse,
        sourceCode: selectedCaisse,
        declaredAmount: theoreticalAmount,
        observedAmount: physicalAmount,
        gapAmount: gap,
        status: 'En attente',
        zone: 'SIÈGE',
        observation: `Écart de versement fin de journée (${selectedCaisse})`,
        userId: responsibleUserId
      };
      localStorage.setItem('microfox_all_gaps', JSON.stringify([newGapEntry, ...allGaps]));
    }

    // Enregistrer la transaction
    const transactionsSaved = localStorage.getItem('microfox_vault_transactions');
    const transactions = transactionsSaved ? JSON.parse(transactionsSaved) : [];
    const newTx = {
      id: Date.now().toString(),
      type: 'Versement Fin de Journée',
      from: selectedCaisse,
      to: targetDestination,
      amount: physicalAmount,
      theoreticalAmount: theoreticalAmount,
      gap: gap,
      date: new Date().toISOString(),
      userId: JSON.parse(localStorage.getItem('microfox_current_user') || '{}').id
    };
    localStorage.setItem('microfox_vault_transactions', JSON.stringify([newTx, ...transactions]));
    localStorage.setItem('microfox_pending_sync', 'true');

    setCashBalance(newCashBalance);
    setIsTransferModalOpen(false);
    setDenominations({
      '10000': 0,
      '5000': 0,
      '2000': 0,
      '1000': 0,
      '500': 0,
      'monnaie': 0
    });
    window.dispatchEvent(new Event('storage'));
    alert(`Versement de ${physicalAmount.toLocaleString()} F effectué. Écart: ${gap.toLocaleString()} F.`);
  };

  const filteredPayments = payments.filter(p => {
    const matchesSearch = p.agentName.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesFilter = filterStatus === 'Tous' || p.status === filterStatus;
    const matchesCaisse = (p.caisse?.toLowerCase() === selectedCaisse?.toLowerCase()) || (!p.caisse && selectedCaisse === 'CAISSE PRINCIPALE');
    
    const txDate = p.date.split('T')[0];
    const matchesDate = (!startDate || txDate >= startDate) && (!endDate || txDate <= endDate);
    
    return matchesSearch && matchesFilter && matchesCaisse && matchesDate;
  });

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-start gap-4">
          <div className="p-3 bg-blue-100 text-blue-600 rounded-2xl">
            <Landmark size={32} />
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-black text-[#121c32] uppercase tracking-tight">Gestion des Caisses</h1>
            <div className="relative">
              <select 
                value={selectedCaisse}
                onChange={(e) => setSelectedCaisse(e.target.value)}
                disabled={JSON.parse(localStorage.getItem('microfox_current_user') || '{}').role === 'caissier'}
                className="appearance-none bg-gray-50 border border-gray-200 text-[#121c32] text-sm font-black rounded-xl px-4 py-2 pr-10 outline-none focus:border-blue-400 transition-all uppercase tracking-tight disabled:opacity-70"
              >
                {caisses.map(c => {
                  const saved = localStorage.getItem(`microfox_cash_balance_${c}`);
                  const bal = saved !== null ? Number(saved) : (c === 'CAISSE PRINCIPALE' ? 5000000 : 0);
                  return <option key={c} value={c}>{c} ({bal.toLocaleString()} F)</option>;
                })}
              </select>
              <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">
                <Filter size={14} />
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {(selectedCaisse !== 'CAISSE PRINCIPALE' || isAdminOrDirector) && (
            <button 
              onClick={() => {
                setTransferAmount(cashBalance.toString());
                setIsTransferModalOpen(true);
              }}
              className="flex items-center gap-2 px-6 py-4 bg-amber-600 text-white rounded-2xl font-black uppercase tracking-tight shadow-lg hover:bg-amber-700 transition-all active:scale-95"
            >
              <ShieldCheck size={20} />
              {isAdminOrDirector ? 'Versement au Coffre' : 'Versement au Caisse principale'}
            </button>
          )}
          
          <div className="bg-[#121c32] p-6 rounded-[2rem] text-white flex items-center gap-6 shadow-xl">
            <div>
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Solde Actuel Caisse</p>
              <p className="text-3xl font-black">{cashBalance.toLocaleString()} F</p>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
              <TrendingUp size={24} />
            </div>
          </div>
        </div>
      </div>

      {/* Modal de Transfert */}
      {isTransferModalOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-start justify-center p-4 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white rounded-[2.5rem] w-full max-w-md p-8 shadow-2xl animate-in zoom-in-95 duration-200 my-4 sm:my-8">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-600 flex items-center justify-center">
                <Send size={24} />
              </div>
              <div>
                <h2 className="text-xl font-black text-[#121c32] uppercase tracking-tight">
                  {isAdminOrDirector ? 'Versement au Coffre' : 'Versement au Caisse principale'}
                </h2>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Fin de journée</p>
              </div>
            </div>

            <div className="space-y-6">
              <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100 flex justify-between items-center">
                <div>
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Solde Théorique (Système)</p>
                  <p className="text-xl font-black text-[#121c32]">{cashBalance.toLocaleString()} F</p>
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Détails du Billetage (Physique)</h3>
                <div className="bg-gray-50 rounded-2xl p-4 space-y-3 border border-gray-100">
                  <div className="grid grid-cols-3 gap-4 text-[9px] font-black text-gray-400 uppercase tracking-widest mb-2 px-2">
                    <span>Billet/Pièce</span>
                    <span className="text-center">Nombre</span>
                    <span className="text-right">Montant</span>
                  </div>
                  {[10000, 5000, 2000, 1000, 500, 250, 200, 100, 50, 25, 10, 5].map(val => (
                    <div key={val} className="grid grid-cols-3 gap-4 items-center">
                      <span className="text-xs font-black text-[#121c32] px-2">{val.toLocaleString()}</span>
                      <input 
                        type="number" 
                        min="0"
                        value={denominations[val.toString()] || ''}
                        onChange={(e) => setDenominations({...denominations, [val.toString()]: e.target.value})}
                        className="w-full p-2 bg-white border border-gray-300 rounded-xl text-center text-xs font-black text-[#121c32] outline-none focus:border-amber-500 transition-all"
                        placeholder="0"
                      />
                      <span className="text-xs font-bold text-gray-400 text-right px-2">
                        {((denominations[val.toString()] || 0) * val).toLocaleString()}
                      </span>
                    </div>
                  ))}
                  <div className="grid grid-cols-3 gap-4 items-center pt-2 border-t border-gray-200">
                    <span className="text-xs font-black text-[#121c32] px-2 uppercase">Monnaie</span>
                    <div className="col-span-2 relative">
                      <input 
                        type="number" 
                        min="0"
                        value={denominations.monnaie || ''}
                        onChange={(e) => setDenominations({...denominations, monnaie: e.target.value})}
                        className="w-full p-2 bg-white border border-gray-300 rounded-xl text-right pr-8 text-xs font-black text-[#121c32] outline-none focus:border-amber-500 transition-all"
                        placeholder="0"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-black text-gray-300">F</span>
                    </div>
                  </div>
                  <div className="pt-3 border-t border-gray-200 flex justify-between items-center px-2">
                    <span className="text-[10px] font-black text-indigo-600 uppercase tracking-widest">Total Billetage</span>
                    <span className="text-lg font-black text-indigo-600">{calculateTotalBilletage().toLocaleString()} F</span>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-600 uppercase tracking-widest ml-1">Montant de la transaction</label>
                <div className="p-4 bg-gray-50 border border-gray-100 rounded-2xl text-center">
                  <span className="text-2xl font-black text-[#121c32]">{calculateTotalBilletage().toLocaleString()}</span>
                  <span className="ml-2 font-black text-gray-400">F</span>
                </div>
              </div>

              <div className="p-4 bg-amber-50 rounded-2xl border border-amber-100 flex justify-between items-center">
                <div>
                  <p className="text-[10px] font-black text-amber-600 uppercase tracking-widest mb-1">Écart Constaté</p>
                  <p className={`text-xl font-black ${calculateTotalBilletage() - cashBalance < 0 ? 'text-red-600' : calculateTotalBilletage() - cashBalance > 0 ? 'text-emerald-600' : 'text-amber-600'}`}>
                    {calculateTotalBilletage() - cashBalance > 0 ? '+' : ''}{(calculateTotalBilletage() - cashBalance).toLocaleString()} F
                  </p>
                </div>
                {calculateTotalBilletage() - cashBalance !== 0 && (
                  <div className="px-3 py-1 bg-white/50 rounded-lg text-[9px] font-black uppercase tracking-widest text-amber-700">
                    {calculateTotalBilletage() - cashBalance < 0 ? 'Déficit' : 'Surplus'}
                  </div>
                )}
              </div>

              <div className="flex gap-3 pt-4">
                <button 
                  onClick={() => setIsTransferModalOpen(false)}
                  className="flex-1 py-4 rounded-2xl font-black uppercase tracking-widest text-xs text-gray-500 hover:bg-gray-50 transition-all"
                >
                  Annuler
                </button>
                <button 
                  onClick={handleTransferToVault}
                  className="flex-1 py-4 bg-amber-600 text-white rounded-2xl font-black uppercase tracking-widest text-xs shadow-lg shadow-amber-200 hover:bg-amber-700 transition-all active:scale-95"
                >
                  Confirmer le Versement
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-gray-100 space-y-4">
            <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest">Filtres</h3>
            
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
              <input 
                type="text" 
                placeholder="Rechercher Agent..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-xs font-bold outline-none focus:border-blue-400 transition-all"
              />
            </div>

            <div className="space-y-2">
              {['Tous', 'En attente', 'Validé', 'Rejeté'].map((status) => (
                <button
                  key={status}
                  onClick={() => setFilterStatus(status)}
                  className={`w-full text-left px-4 py-3 rounded-xl text-xs font-black uppercase tracking-tight transition-all ${
                    filterStatus === status 
                      ? 'bg-blue-600 text-white shadow-md' 
                      : 'bg-gray-50 text-gray-500 hover:bg-gray-100'
                  }`}
                >
                  {status}
                </button>
              ))}
            </div>

            <div className="space-y-2 pt-2">
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Intervalle de Date</p>
              <div className="grid grid-cols-1 gap-2">
                <input 
                  type="date" 
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-100 rounded-xl text-[10px] font-bold text-[#121c32] outline-none focus:border-blue-400 transition-all"
                />
                <input 
                  type="date" 
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-100 rounded-xl text-[10px] font-bold text-[#121c32] outline-none focus:border-blue-400 transition-all"
                />
              </div>
              {(startDate || endDate) && (
                <button 
                  onClick={() => { setStartDate(''); setEndDate(''); }}
                  className="w-full py-2 text-[9px] font-black text-blue-600 uppercase tracking-widest hover:underline"
                >
                  Réinitialiser Dates
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="lg:col-span-3">
          <div className="bg-white rounded-[2.5rem] shadow-sm border border-gray-100 overflow-hidden">
            <div className="overflow-x-auto custom-scrollbar">
              <table className="w-full min-w-[1000px] text-left">
                <thead>
                  <tr className="bg-gray-50/50 border-b border-gray-100">
                    <th className="px-6 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">Agent / Date</th>
                    <th className="px-6 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest text-right">Cotisations</th>
                    <th className="px-6 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest text-right">Livrets</th>
                    <th className="px-6 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest text-right">Écart</th>
                    <th className="px-6 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest text-right">Total</th>
                    <th className="px-6 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest text-center">Solde Observé</th>
                    <th className="px-6 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest text-center">Statut</th>
                    <th className="px-6 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filteredPayments.length > 0 ? (
                    filteredPayments.map((p) => (
                      <tr key={p.id} className="hover:bg-gray-50/50 transition-colors">
                        <td className="px-6 py-5">
                          <p className="text-xs font-black text-[#121c32] uppercase">{p.agentName}</p>
                          <p className="text-[10px] font-bold text-gray-400 mb-2">{new Date(p.date).toLocaleString()}</p>
                          {p.billetage && p.status === 'En attente' && (
                            <div className="mt-2 p-3 bg-gray-50 rounded-2xl border border-gray-100">
                              <p className="text-[9px] font-black text-gray-400 uppercase mb-2 tracking-widest">Billetage Agent</p>
                              <div className="space-y-1.5">
                                {[10000, 5000, 2000, 1000, 500].map(val => p.billetage[val] > 0 && (
                                  <div key={val} className="flex justify-between items-center text-[10px] whitespace-nowrap">
                                    <span className="text-gray-400 font-bold">{val.toLocaleString()} :</span>
                                    <span className="font-black text-[#121c32] ml-2">x{p.billetage[val]}</span>
                                  </div>
                                ))}
                                {p.billetage.monnaie > 0 && (
                                  <div className="flex justify-between items-center text-[10px] whitespace-nowrap border-t border-gray-200 mt-2 pt-2">
                                    <span className="text-gray-400 font-bold uppercase">Monnaie :</span>
                                    <span className="font-black text-[#121c32] ml-2">{Number(p.billetage.monnaie).toLocaleString()} F</span>
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-5 text-right text-xs font-bold text-indigo-600">{p.amountCotisations.toLocaleString()} F</td>
                        <td className="px-6 py-5 text-right text-xs font-bold text-amber-600">{p.amountLivrets.toLocaleString()} F</td>
                        <td className="px-6 py-5 text-right">
                          <span className={`text-xs font-bold ${(p.totalAmount - (p.amountCotisations + p.amountLivrets)) < 0 ? 'text-red-600' : (p.totalAmount - (p.amountCotisations + p.amountLivrets)) > 0 ? 'text-emerald-600' : 'text-gray-300'}`}>
                            {(p.totalAmount - (p.amountCotisations + p.amountLivrets)) > 0 ? '+' : ''}{(p.totalAmount - (p.amountCotisations + p.amountLivrets)).toLocaleString()} F
                          </span>
                        </td>
                        <td className="px-6 py-5 text-right text-sm font-black text-[#121c32]">{p.totalAmount.toLocaleString()} F</td>
                        <td className="px-6 py-5">
                          {p.status === 'En attente' ? (
                            <div className="flex flex-col gap-1">
                              <input 
                                type="number" 
                                placeholder="Observé"
                                value={observedAmounts[p.id] || ''}
                                onChange={(e) => {
                                  setObservedAmounts({...observedAmounts, [p.id]: e.target.value});
                                  if (validationErrors[p.id]) {
                                    const newErrors = {...validationErrors};
                                    delete newErrors[p.id];
                                    setValidationErrors(newErrors);
                                  }
                                }}
                                className={`w-24 p-2 bg-white border ${validationErrors[p.id] ? 'border-red-500 animate-pulse' : 'border-gray-300'} rounded-xl text-xs font-black text-[#121c32] outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400 transition-all`}
                              />
                              {validationErrors[p.id] && (
                                <p className="text-[8px] font-black text-red-500 uppercase leading-tight max-w-[100px] mt-0.5">
                                  {validationErrors[p.id]}
                                </p>
                              )}
                              <input 
                                type="text" 
                                placeholder="Obs..."
                                value={gapObservations[p.id] || ''}
                                onChange={(e) => setGapObservations({...gapObservations, [p.id]: e.target.value})}
                                className="w-24 p-1 bg-white border border-gray-300 rounded-lg text-[9px] font-bold text-[#121c32] outline-none focus:border-blue-400 transition-all"
                              />
                            </div>
                          ) : (
                            <div className="text-center">
                              <p className="text-xs font-black text-[#121c32]">{p.observedAmount?.toLocaleString() || p.totalAmount.toLocaleString()} F</p>
                              {p.gap !== undefined && p.gap !== 0 && (
                                <span className={`text-[9px] font-black uppercase ${p.gap < 0 ? 'text-red-500' : 'text-emerald-500'}`}>
                                  Écart: {p.gap > 0 ? '+' : ''}{p.gap.toLocaleString()} F
                                </span>
                              )}
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-5 text-center">
                          <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${
                            p.status === 'Validé' ? 'bg-emerald-100 text-emerald-600' : 
                            p.status === 'Rejeté' ? 'bg-red-100 text-red-600' : 
                            'bg-amber-100 text-amber-600'
                          }`}>
                            {p.status}
                          </span>
                        </td>
                        <td className="px-6 py-5 text-right">
                          {p.status === 'En attente' && (['administrateur', 'directeur', 'caissier'].includes(JSON.parse(localStorage.getItem('microfox_current_user') || '{}').role)) && (
                            <div className="flex items-center justify-end gap-2">
                              <button
                                onClick={() => handleAction(p.id, 'Validé')}
                                className="p-2 bg-emerald-50 text-emerald-600 rounded-lg hover:bg-emerald-600 hover:text-white transition-all shadow-sm"
                                title="Valider le versement"
                              >
                                <CheckCircle size={18} />
                              </button>
                              <button
                                onClick={() => handleAction(p.id, 'Rejeté')}
                                className="p-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-600 hover:text-white transition-all shadow-sm"
                                title="Rejeter le versement"
                              >
                                <XCircle size={18} />
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6} className="px-6 py-20 text-center">
                        <div className="flex flex-col items-center gap-2 opacity-20">
                          <ArrowDownCircle size={48} />
                          <p className="text-xs font-black uppercase tracking-widest">Aucun versement à traiter</p>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MainCashier;
