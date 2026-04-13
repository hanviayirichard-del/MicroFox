
import React, { useState, useEffect } from 'react';
import { Vault, Landmark, ArrowRightLeft, TrendingUp, History, Send, ShieldCheck, Filter, Landmark as BankIcon, Calculator, X } from 'lucide-react';

const VaultAndBank: React.FC = () => {
  const [vaultBalance, setVaultBalance] = useState(() => {
    const saved = localStorage.getItem('microfox_vault_balance');
    return saved ? Number(saved) : 0;
  });

  const [bankBalance, setBankBalance] = useState(() => {
    const saved = localStorage.getItem('microfox_bank_balance');
    return saved ? Number(saved) : 0;
  });

  const [transactions, setTransactions] = useState<any[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalType, setModalType] = useState<'VtoB' | 'BtoV' | 'VtoC' | 'CtoV' | 'INIT_BANK'>('VtoB');
  const [amount, setAmount] = useState('');
  const [observedAmount, setObservedAmount] = useState('');
  const [observation, setObservation] = useState('');
  const [caisses, setCaisses] = useState(['CAISSE PRINCIPALE', 'CAISSE 1', 'CAISSE 2', 'CAISSE 3', 'CAISSE 4']);
  const [selectedCaisse, setSelectedCaisse] = useState('CAISSE PRINCIPALE');
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

  const calculateTotalFromDenominations = (newDenoms: any) => {
    const total = 
      (Number(newDenoms['10000'] || 0) * 10000) +
      (Number(newDenoms['5000'] || 0) * 5000) +
      (Number(newDenoms['2000'] || 0) * 2000) +
      (Number(newDenoms['1000'] || 0) * 1000) +
      (Number(newDenoms['500'] || 0) * 500) +
      (Number(newDenoms['250'] || 0) * 250) +
      (Number(newDenoms['200'] || 0) * 200) +
      (Number(newDenoms['100'] || 0) * 100) +
      (Number(newDenoms['50'] || 0) * 50) +
      (Number(newDenoms['25'] || 0) * 25) +
      (Number(newDenoms['10'] || 0) * 10) +
      (Number(newDenoms['5'] || 0) * 5) +
      Number(newDenoms['monnaie'] || 0);
    return total;
  };

  const handleDenominationChange = (key: string, value: string) => {
    const numValue = key === 'monnaie' ? Number(value) : parseInt(value) || 0;
    const newDenoms = { ...denominations, [key]: numValue };
    setDenominations(newDenoms);
    const total = calculateTotalFromDenominations(newDenoms);
    setAmount(total.toString());
  };

  useEffect(() => {
    const loadData = () => {
      const vBal = localStorage.getItem('microfox_vault_balance');
      if (vBal) setVaultBalance(Number(vBal));
      
      const bBal = localStorage.getItem('microfox_bank_balance');
      if (bBal) setBankBalance(Number(bBal));

      const txs = localStorage.getItem('microfox_vault_transactions');
      if (txs) setTransactions(JSON.parse(txs));

      const savedUsers = localStorage.getItem('microfox_users');
      if (savedUsers) {
        const parsedUsers = JSON.parse(savedUsers);
        const userCaisses = parsedUsers
          .filter((u: any) => u.role === 'caissier' && u.caisse)
          .map((u: any) => u.caisse.toUpperCase());
        
        const allCaisses = ['CAISSE PRINCIPALE', 'CAISSE 1', 'CAISSE 2', 'CAISSE 3', 'CAISSE 4'];
        setCaisses(allCaisses);
        if (!allCaisses.includes(selectedCaisse.toUpperCase())) {
          setSelectedCaisse(allCaisses[0]);
        }
      }
    };

    loadData();
    window.addEventListener('storage', loadData);
    return () => window.removeEventListener('storage', loadData);
  }, []);

  const handleTransaction = () => {
    const val = Number(amount);
    if (val <= 0) {
      alert("Montant invalide.");
      return;
    }

    const savedVault = localStorage.getItem('microfox_vault_balance');
    const savedBank = localStorage.getItem('microfox_bank_balance');
    let newVault = savedVault ? Number(savedVault) : 10000000;
    let newBank = savedBank ? Number(savedBank) : 0;
    const cashKey = `microfox_cash_balance_${selectedCaisse}`;
    const savedCash = localStorage.getItem(cashKey);
    let cashBalance = savedCash !== null ? Number(savedCash) : (selectedCaisse === 'CAISSE PRINCIPALE' ? 40000000 : 0);
    let typeLabel = "";
    let to = "";
    let from = "";

    if (modalType === 'INIT_BANK') {
      newBank = val;
      typeLabel = "Initialisation Solde Banque";
      from = "Système";
      to = "Banque";
    } else if (modalType === 'VtoB') {
      if (val > vaultBalance) { alert("Solde coffre insuffisant."); return; }
      newVault -= val;
      newBank += val;
      typeLabel = "Dépôt en Banque";
      from = "Coffre";
      to = "Banque";
    } else if (modalType === 'BtoV') {
      if (val > bankBalance) { alert("Solde banque insuffisant."); return; }
      newBank -= val;
      newVault += val;
      typeLabel = "Retrait de Banque";
      from = "Banque";
      to = "Coffre";
    } else if (modalType === 'VtoC') {
      if (val > vaultBalance) { alert("Solde coffre insuffisant."); return; }
      newVault -= val;
      cashBalance += val;
      typeLabel = "Approvisionnement Caisse";
      from = "Coffre";
      to = selectedCaisse;
    } else if (modalType === 'CtoV') {
      const observed = observedAmount ? Number(observedAmount) : val;
      const gap = val - observed;
      
      if (cashBalance === 0) {
        alert(`Opération impossible : Le solde de la ${selectedCaisse} est à zéro.`);
        return;
      }

      if (val > cashBalance) { alert("Solde caisse insuffisant."); return; }
      cashBalance -= val;
      
      const isMainCaisse = selectedCaisse === 'CAISSE PRINCIPALE';
      if (isMainCaisse) {
        if (destination === 'Banque') {
          newBank += observed;
          to = "Banque";
        } else {
          newVault += observed;
          to = "Coffre";
        }
      } else {
        const mainCaisseKey = 'microfox_cash_balance_CAISSE PRINCIPALE';
        const mainCaisseBalance = Number(localStorage.getItem(mainCaisseKey) || 40000000);
        localStorage.setItem(mainCaisseKey, (mainCaisseBalance + observed).toString());
        to = "CAISSE PRINCIPALE";
      }
      
      typeLabel = "Versement Fin de Journée";
      from = selectedCaisse;

      if (gap !== 0) {
        const savedGaps = localStorage.getItem('microfox_all_gaps');
        const allGaps = savedGaps ? JSON.parse(savedGaps) : [];
        
        const savedUsers = localStorage.getItem('microfox_users');
        const allUsersList = savedUsers ? JSON.parse(savedUsers) : [];
        const cashier = allUsersList.find((u: any) => u.caisse === selectedCaisse);
        const responsibleUserId = cashier?.id || JSON.parse(localStorage.getItem('microfox_current_user') || '{}').id;

        const newGapEntry = {
          id: `gap_${Date.now()}`,
          date: new Date().toISOString(),
          type: 'CAISSIER',
          sourceId: Date.now().toString(),
          sourceName: selectedCaisse,
          sourceCode: selectedCaisse,
          declaredAmount: val,
          observedAmount: observed,
          gapAmount: gap,
          status: 'En attente',
          caisse: selectedCaisse,
          observation: observation,
          userId: responsibleUserId
        };
        localStorage.setItem('microfox_all_gaps', JSON.stringify([newGapEntry, ...allGaps]));
      }
    }

    setVaultBalance(newVault);
    setBankBalance(newBank);
    localStorage.setItem('microfox_vault_balance', newVault.toString());
    localStorage.setItem('microfox_bank_balance', newBank.toString());
    localStorage.setItem(cashKey, cashBalance.toString());

    const currentUser = JSON.parse(localStorage.getItem('microfox_current_user') || '{}');
    const newTx = {
      id: Date.now().toString(),
      type: typeLabel,
      from,
      to,
      amount: val,
      denominations: { ...denominations },
      date: new Date().toISOString(),
      userId: currentUser?.id,
      cashierName: currentUser?.identifiant
    };

    const updatedTxs = [newTx, ...transactions];
    setTransactions(updatedTxs);
    localStorage.setItem('microfox_vault_transactions', JSON.stringify(updatedTxs));
    localStorage.setItem('microfox_pending_sync', 'true');

    setIsModalOpen(false);
    setAmount('');
    setObservedAmount('');
    setObservation('');
    setDenominations({
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
    window.dispatchEvent(new Event('storage'));
  };

  const [selectedTxForBilletage, setSelectedTxForBilletage] = useState<any>(null);

  const [destination, setDestination] = useState<'Coffre' | 'Banque'>('Coffre');

  const openModal = (type: 'VtoB' | 'BtoV' | 'VtoC' | 'CtoV' | 'INIT_BANK', defaultDest?: 'Coffre' | 'Banque') => {
    setModalType(type);
    if (type === 'CtoV') {
      setSelectedCaisse('CAISSE PRINCIPALE');
    } else if (type === 'VtoC') {
      setSelectedCaisse('CAISSE 1');
    }
    setAmount('');
    setObservedAmount('');
    setObservation('');
    setDenominations({
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
    setDestination(defaultDest || 'Coffre');
    setIsModalOpen(true);
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-20">
      <div className="flex items-start gap-4">
        <div className="p-3 bg-indigo-100 text-indigo-600 rounded-2xl">
          <Vault size={32} />
        </div>
        <div>
          <h1 className="text-2xl font-black text-[#121c32] uppercase tracking-tight">Coffre & Banque</h1>
          <p className="text-gray-500 font-medium">Gestion des réserves de fonds et mouvements inter-comptes.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Carte Coffre */}
        <div className="bg-[#121c32] p-8 rounded-[2.5rem] text-white space-y-6 shadow-xl relative overflow-hidden group">
          <div className="absolute -right-10 -top-10 w-40 h-40 bg-white/5 rounded-full blur-3xl group-hover:bg-white/10 transition-all"></div>
          
          <div className="flex items-center justify-between relative z-10">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center">
                <ShieldCheck size={24} className="text-emerald-400" />
              </div>
              <div>
                <h2 className="text-sm font-black text-gray-400 uppercase tracking-widest">Solde Coffre Fort</h2>
                <p className="text-3xl font-black tracking-tight">{vaultBalance.toLocaleString()} F</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 relative z-10">
            <button 
              onClick={() => openModal('VtoB')}
              className="flex items-center justify-center gap-2 py-4 bg-white/10 hover:bg-white/20 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all"
            >
              <BankIcon size={16} />
              Vers Banque
            </button>
            <button 
              onClick={() => openModal('VtoC')}
              className="flex items-center justify-center gap-2 py-4 bg-emerald-500 text-white hover:bg-emerald-600 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all shadow-lg shadow-emerald-900/20"
            >
              <Send size={16} />
              Vers Caisse
            </button>
          </div>
        </div>

        {/* Carte Banque */}
        <div className="bg-white p-8 rounded-[2.5rem] border border-gray-100 space-y-6 shadow-sm relative overflow-hidden group">
          <div className="absolute -right-10 -top-10 w-40 h-40 bg-blue-50 rounded-full blur-3xl group-hover:bg-blue-100 transition-all"></div>
          
          <div className="flex items-center justify-between relative z-10">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-blue-50 flex items-center justify-center">
                <BankIcon size={24} className="text-blue-600" />
              </div>
              <div>
                <h2 className="text-sm font-black text-gray-400 uppercase tracking-widest">Solde Bancaire Global</h2>
                <div className="flex items-center gap-2">
                  <p className="text-3xl font-black text-[#121c32] tracking-tight">{bankBalance.toLocaleString()} F</p>
                  <button 
                    onClick={() => openModal('INIT_BANK')}
                    className="p-1 text-gray-300 hover:text-indigo-600 transition-colors"
                    title="Initialiser le solde"
                  >
                    <ArrowRightLeft size={16} />
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 relative z-10">
            <button 
              onClick={() => openModal('BtoV')}
              className="flex items-center justify-center gap-2 py-4 bg-blue-600 text-white hover:bg-blue-700 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all shadow-lg shadow-blue-200"
            >
              <Vault size={16} />
              Vers Coffre
            </button>
            <button 
              onClick={() => openModal('CtoV', 'Banque')}
              className="flex items-center justify-center gap-2 py-4 bg-gray-100 text-gray-500 hover:bg-gray-200 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all"
            >
              <ArrowRightLeft size={16} />
              Versement Fin de Journée
            </button>
          </div>
        </div>
      </div>

      {/* Historique des mouvements */}
      <div className="bg-white rounded-[2.5rem] shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-6 border-b border-gray-50 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <History size={20} className="text-gray-400" />
            <h2 className="text-sm font-black text-[#121c32] uppercase tracking-widest">Historique des Mouvements</h2>
          </div>
          <TrendingUp size={20} className="text-emerald-500" />
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-gray-50/50">
                <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Date & Heure</th>
                <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Type de Mouvement</th>
                <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Origine</th>
                <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Destination</th>
                <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest text-right">Montant</th>
                <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest text-center">Billetage</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {(() => {
                const currentUser = JSON.parse(localStorage.getItem('microfox_current_user') || '{}');
                const isCaissier = currentUser?.role === 'caissier';
                
                const filteredTxs = transactions
                  .filter(tx => {
                    if (isCaissier) {
                      const isToMyCaisse = tx.to && currentUser.caisse && tx.to.toUpperCase() === currentUser.caisse.toUpperCase();
                      const isFromMyCaisse = tx.from && currentUser.caisse && tx.from.toUpperCase() === currentUser.caisse.toUpperCase();
                      return tx.userId === currentUser.id || isToMyCaisse || isFromMyCaisse;
                    }
                    return true;
                  })
                  .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

                if (filteredTxs.length > 0) {
                  return filteredTxs.map((tx) => (
                    <tr key={tx.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-6 py-4">
                        <p className="text-xs font-black text-[#121c32]">{new Date(tx.date).toLocaleDateString()}</p>
                        <p className="text-[10px] font-bold text-gray-400">{new Date(tx.date).toLocaleTimeString()}</p>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-[10px] font-black uppercase tracking-tight text-indigo-600 bg-indigo-50 px-2 py-1 rounded">
                          {tx.type}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-xs font-bold text-gray-600 uppercase">{tx.from}</td>
                      <td className="px-6 py-4 text-xs font-bold text-gray-600 uppercase">{tx.to}</td>
                      <td className="px-6 py-4 text-right text-sm font-black text-[#121c32]">{tx.amount.toLocaleString()} F</td>
                      <td className="px-6 py-4 text-center">
                        {tx.denominations && (
                          <button 
                            onClick={() => setSelectedTxForBilletage(tx)}
                            className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                            title="Voir le billetage"
                          >
                            <Calculator size={16} />
                          </button>
                        )}
                      </td>
                    </tr>
                  ));
                } else {
                  return (
                    <tr>
                      <td colSpan={6} className="px-6 py-20 text-center text-gray-300 italic text-xs font-bold uppercase tracking-widest">
                        Aucun mouvement enregistré
                      </td>
                    </tr>
                  );
                }
              })()}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Historique Billetage */}
      {selectedTxForBilletage && (
        <div className="fixed inset-0 bg-black/60 z-[60] flex items-start justify-center p-4 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white rounded-[2.5rem] w-full max-w-md p-8 shadow-2xl animate-in zoom-in-95 duration-200 my-8">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                  <Calculator size={20} />
                </div>
                <div>
                  <h2 className="text-lg font-black text-[#121c32] uppercase tracking-tight">Détails Billetage</h2>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Mouvement du {new Date(selectedTxForBilletage.date).toLocaleDateString()}</p>
                </div>
              </div>
              <button 
                onClick={() => setSelectedTxForBilletage(null)}
                className="p-2 hover:bg-gray-100 rounded-full text-gray-400 transition-all"
              >
                <X size={20} />
              </button>
            </div>

            <div className="space-y-4">
              <div className="bg-gray-50 rounded-2xl border border-gray-100 overflow-y-auto max-h-[60vh] custom-scrollbar">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-gray-100/50 border-b border-gray-100">
                      <th className="px-4 py-2 font-black text-gray-400 uppercase text-left">Billet/Pièce</th>
                      <th className="px-4 py-2 font-black text-gray-400 uppercase text-center">Nombre</th>
                      <th className="px-4 py-2 font-black text-gray-400 uppercase text-right">Montant</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {[10000, 5000, 2000, 1000, 500, 250, 200, 100, 50, 25, 10, 5].map((denom) => (
                      <tr key={denom}>
                        <td className="px-4 py-2 font-bold text-gray-600">{denom.toLocaleString()} F</td>
                        <td className="px-4 py-2 text-center font-black text-[#121c32]">
                          {selectedTxForBilletage.denominations[denom.toString()] || 0}
                        </td>
                        <td className="px-4 py-2 text-right font-black text-gray-400">
                          {((selectedTxForBilletage.denominations[denom.toString()] || 0) * denom).toLocaleString()} F
                        </td>
                      </tr>
                    ))}
                    <tr>
                      <td className="px-4 py-2 font-bold text-gray-600 uppercase">Monnaie</td>
                      <td colSpan={2} className="px-4 py-2 text-right font-black text-[#121c32]">
                        {(selectedTxForBilletage.denominations.monnaie || 0).toLocaleString()} F
                      </td>
                    </tr>
                  </tbody>
                  <tfoot>
                    <tr className="bg-indigo-50 border-t border-indigo-100">
                      <td colSpan={2} className="px-4 py-3 font-black text-[#121c32] uppercase tracking-widest">Total</td>
                      <td className="px-4 py-3 text-right font-black text-indigo-600">
                        {selectedTxForBilletage.amount.toLocaleString()} F
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              <div className="p-4 bg-indigo-50/50 rounded-2xl border border-indigo-100 space-y-2">
                <div className="flex justify-between text-[10px] font-black uppercase tracking-widest text-gray-400">
                  <span>Origine</span>
                  <span>Destination</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs font-black text-[#121c32] uppercase">{selectedTxForBilletage.from}</span>
                  <ArrowRightLeft size={14} className="text-indigo-400" />
                  <span className="text-xs font-black text-[#121c32] uppercase">{selectedTxForBilletage.to}</span>
                </div>
              </div>

              <button 
                onClick={() => setSelectedTxForBilletage(null)}
                className="w-full py-4 bg-[#121c32] text-white rounded-2xl font-black uppercase tracking-widest text-xs shadow-lg hover:bg-black transition-all active:scale-95"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Transaction */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-[2rem] w-full max-w-lg max-h-[90vh] overflow-y-auto p-5 sm:p-8 shadow-2xl animate-in zoom-in-95 duration-200 custom-scrollbar">
            <div className="flex items-center gap-3 mb-6 sticky top-0 bg-white pb-4 z-10">
              <div className="w-12 h-12 rounded-2xl bg-indigo-100 text-indigo-600 flex items-center justify-center">
                <ArrowRightLeft size={24} />
              </div>
              <div>
                <h2 className="text-xl font-black text-[#121c32] uppercase tracking-tight">
                  {modalType === 'VtoB' ? 'Coffre vers Banque' : 
                   modalType === 'BtoV' ? 'Banque vers Coffre' : 
                   modalType === 'VtoC' ? 'Coffre vers Caisse' : 
                   modalType === 'INIT_BANK' ? 'Initialisation Banque' : 'Versement Fin de Journée'}
                </h2>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Transaction Interne</p>
              </div>
            </div>

            <div className="space-y-4 sm:space-y-6">
              {(modalType === 'VtoC' || modalType === 'CtoV') && (
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-gray-600 uppercase tracking-widest ml-1">Sélectionner la Caisse</label>
                  <div className="relative">
                    <select 
                      value={selectedCaisse}
                      onChange={(e) => setSelectedCaisse(e.target.value)}
                      className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl outline-none text-sm font-black text-[#121c32] focus:border-indigo-500 transition-all appearance-none uppercase tracking-tight"
                    >
                      {caisses.filter(c => modalType === 'CtoV' ? c === 'CAISSE PRINCIPALE' : (c === 'CAISSE 1' || c === 'CAISSE 2' || c === 'CAISSE 3' || c === 'CAISSE 4')).map(c => {
                        const saved = localStorage.getItem(`microfox_cash_balance_${c}`);
                        const bal = saved !== null ? Number(saved) : (c === 'CAISSE PRINCIPALE' ? 40000000 : 0);
                        return <option key={c} value={c}>{c} ({bal.toLocaleString()} F)</option>;
                      })}
                    </select>
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">
                      <Filter size={16} />
                    </div>
                  </div>
                  <div className="mt-2 px-1 flex justify-between items-center">
                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Solde actuel de la caisse</span>
                    <span className="text-xs font-black text-indigo-600">
                      {(() => {
                        const saved = localStorage.getItem(`microfox_cash_balance_${selectedCaisse}`);
                        return (saved !== null ? Number(saved) : (selectedCaisse === 'CAISSE PRINCIPALE' ? 40000000 : 0)).toLocaleString();
                      })()} F
                    </span>
                  </div>
                </div>
              )}

              <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100">
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">
                  Solde Source
                </p>
                <p className="text-xl font-black text-[#121c32]">
                  {modalType === 'VtoB' || modalType === 'VtoC' ? vaultBalance.toLocaleString() : 
                   modalType === 'BtoV' ? bankBalance.toLocaleString() : 
                   (() => {
                     const saved = localStorage.getItem(`microfox_cash_balance_${selectedCaisse}`);
                     return (saved !== null ? Number(saved) : (selectedCaisse === 'CAISSE PRINCIPALE' ? 40000000 : 0)).toLocaleString();
                   })()} F
                </p>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-600 uppercase tracking-widest ml-1">Détails du Billetage</label>
                <div className="border border-gray-100 rounded-2xl overflow-y-auto max-h-[400px] custom-scrollbar">
                  <table className="w-full text-[10px]">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-100">
                        <th className="px-2 py-1 font-black text-gray-400 uppercase text-left">Billet/Pièce</th>
                        <th className="px-2 py-1 font-black text-gray-400 uppercase text-center">Nombre</th>
                        <th className="px-2 py-1 font-black text-gray-400 uppercase text-right">Montant</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {[10000, 5000, 2000, 1000, 500, 250, 200, 100, 50, 25, 10, 5].map((denom) => (
                        <tr key={denom}>
                          <td className="px-2 py-1 font-bold text-gray-600">{denom.toLocaleString()}</td>
                          <td className="px-2 py-1">
                            <input 
                              type="number" 
                              min="0"
                              value={denominations[denom.toString()] || ''}
                              onChange={(e) => handleDenominationChange(denom.toString(), e.target.value)}
                              className="w-full bg-gray-50 border border-gray-100 rounded-lg px-2 py-0.5 text-center font-black text-[#121c32] outline-none focus:border-indigo-500"
                              placeholder="0"
                            />
                          </td>
                          <td className="px-2 py-1 text-right font-black text-gray-400">
                            {((denominations[denom.toString()] || 0) * denom).toLocaleString()}
                          </td>
                        </tr>
                      ))}
                      <tr>
                        <td className="px-2 py-1 font-bold text-gray-600 uppercase text-[9px]">Monnaie</td>
                        <td className="px-2 py-1" colSpan={2}>
                          <input 
                            type="number" 
                            min="0"
                            value={denominations.monnaie || ''}
                            onChange={(e) => handleDenominationChange('monnaie', e.target.value)}
                            className="w-full bg-gray-50 border border-gray-100 rounded-lg px-2 py-0.5 text-right font-black text-[#121c32] outline-none focus:border-indigo-500"
                            placeholder="0"
                          />
                        </td>
                      </tr>
                    </tbody>
                    <tfoot>
                      <tr className="bg-indigo-50/50">
                        <td colSpan={2} className="px-2 py-2 font-black text-[#121c32] uppercase tracking-widest text-[9px]">Total Billetage</td>
                        <td className="px-2 py-2 text-right font-black text-indigo-600 text-xs">
                          {calculateTotalFromDenominations(denominations).toLocaleString()} F
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-600 uppercase tracking-widest ml-1">Montant de la transaction</label>
                <div className="relative">
                  <input 
                    type="number" 
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0"
                    className="w-full p-4 bg-gray-50 border border-gray-200 rounded-2xl outline-none text-lg font-black text-[#121c32] focus:border-indigo-500 transition-all"
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 font-black text-gray-300">F</span>
                </div>
              </div>

              {modalType === 'CtoV' && (
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-gray-600 uppercase tracking-widest ml-1">Destination</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => setDestination('Coffre')}
                      className={`py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${destination === 'Coffre' ? 'bg-[#121c32] text-white' : 'bg-gray-100 text-gray-400'}`}
                    >
                      Coffre
                    </button>
                    <button
                      onClick={() => setDestination('Banque')}
                      className={`py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${destination === 'Banque' ? 'bg-[#121c32] text-white' : 'bg-gray-100 text-gray-400'}`}
                    >
                      Banque
                    </button>
                  </div>
                </div>
              )}

              {modalType === 'CtoV' && (
                <>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-gray-600 uppercase tracking-widest ml-1">Montant Observé (Livret/Caisse)</label>
                    <div className="relative">
                      <input 
                        type="number" 
                        value={observedAmount}
                        onChange={(e) => setObservedAmount(e.target.value)}
                        placeholder="Si différent du total..."
                        className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl outline-none text-lg font-black text-[#121c32] focus:border-indigo-500 transition-all"
                      />
                      <span className="absolute right-4 top-1/2 -translate-y-1/2 font-black text-gray-300">F</span>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-gray-600 uppercase tracking-widest ml-1">Observation / Rapport d'écart</label>
                    <textarea 
                      value={observation}
                      onChange={(e) => setObservation(e.target.value)}
                      placeholder="Détails sur l'écart constaté..."
                      className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl outline-none text-xs font-bold text-[#121c32] focus:border-indigo-500 transition-all h-20 resize-none"
                    />
                  </div>
                </>
              )}

              <div className="flex gap-3 pt-4">
                <button 
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 py-4 rounded-2xl font-black uppercase tracking-widest text-xs text-gray-500 hover:bg-gray-50 transition-all"
                >
                  Annuler
                </button>
                <button 
                  onClick={handleTransaction}
                  className="flex-1 py-4 bg-indigo-600 text-white rounded-2xl font-black uppercase tracking-widest text-xs shadow-lg shadow-indigo-200 hover:bg-indigo-700 transition-all active:scale-95"
                >
                  Confirmer
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default VaultAndBank;
