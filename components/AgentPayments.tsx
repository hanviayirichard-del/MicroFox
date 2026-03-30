
import React, { useState, useEffect } from 'react';
import { Wallet, Send, CheckCircle, Clock, AlertCircle, TrendingUp, BookOpen } from 'lucide-react';

const AgentPayments: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [totalCotisations, setTotalCotisations] = useState(0);
  const [totalLivrets, setTotalLivrets] = useState(0);
  const [agentBalance, setAgentBalance] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [paymentsHistory, setPaymentsHistory] = useState<any[]>([]);
  const [caisses] = useState(['CAISSE PRINCIPALE', 'CAISSE 1', 'CAISSE 2']);
  const [selectedCaisse, setSelectedCaisse] = useState('CAISSE 1');
  const [billetage, setBilletage] = useState<any>({
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
  const [authCode, setAuthCode] = useState('');

  const physicalBalance = (Number(billetage['10000']) * 10000) + 
                         (Number(billetage['5000']) * 5000) + 
                         (Number(billetage['2000']) * 2000) + 
                         (Number(billetage['1000']) * 1000) + 
                         (Number(billetage['500']) * 500) + 
                         (Number(billetage['250']) * 250) + 
                         (Number(billetage['200']) * 200) + 
                         (Number(billetage['100']) * 100) + 
                         (Number(billetage['50']) * 50) + 
                         (Number(billetage['25']) * 25) + 
                         (Number(billetage['10']) * 10) + 
                         (Number(billetage['5']) * 5) + 
                         Number(billetage['monnaie']);

  const theoreticalTotal = totalCotisations + totalLivrets;
  const gap = physicalBalance - theoreticalTotal;

  useEffect(() => {
    const userStr = localStorage.getItem('microfox_current_user');
    if (userStr) {
      const user = JSON.parse(userStr);
      setCurrentUser(user);
      if (user.role !== 'agent commercial') {
        setSelectedCaisse('CAISSE PRINCIPALE');
      }
    }

    const loadDailyStats = () => {
      const userStr = localStorage.getItem('microfox_current_user');
      const user = userStr ? JSON.parse(userStr) : null;
      if (!user) return;

      const agentBalanceKey = `microfox_agent_balance_${user.id}`;
      const currentAgentBalance = Number(localStorage.getItem(agentBalanceKey) || 0);
      setAgentBalance(currentAgentBalance);

      const todayStr = new Date().toISOString().split('T')[0];
      const savedMembers = localStorage.getItem('microfox_members_data');
      let cotisations = 0;
      let livrets = 0;

      if (savedMembers) {
        const allMembers = JSON.parse(savedMembers);
        allMembers.forEach((m: any) => {
          const agentZones = user.zonesCollecte || (user.zoneCollecte ? [user.zoneCollecte] : []);
          if (user?.role === 'agent commercial' && agentZones.length > 0 && !agentZones.includes(m.zone)) {
            return;
          }
          const history = m.history || [];
          history.forEach((tx: any) => {
            if (tx.date.startsWith(todayStr)) {
              const desc = (tx.description || '').toLowerCase();
              if (tx.account === 'tontine' && (tx.type === 'cotisation' || tx.type === 'depot')) {
                if (desc.includes('livret')) {
                  livrets += tx.amount;
                } else {
                  cotisations += tx.amount;
                }
              }
            }
          });
        });
      }
      const savedPayments = localStorage.getItem('microfox_agent_payments');
      let paidCotisations = 0;
      let paidLivrets = 0;
      if (savedPayments) {
        const allPayments = JSON.parse(savedPayments);
        allPayments.forEach((p: any) => {
          if (p.agentId === user.id && p.date.startsWith(todayStr) && p.status !== 'Annulé') {
            paidCotisations += p.amountCotisations || 0;
            paidLivrets += p.amountLivrets || 0;
          }
        });
      }

      setTotalCotisations(Math.max(0, cotisations - paidCotisations));
      setTotalLivrets(Math.max(0, livrets - paidLivrets));
    };

    const loadHistory = () => {
      const saved = localStorage.getItem('microfox_agent_payments');
      if (saved) {
        const allPayments = JSON.parse(saved);
        const userStr = localStorage.getItem('microfox_current_user');
        const user = userStr ? JSON.parse(userStr) : null;
        if (user && user.role === 'agent commercial') {
          setPaymentsHistory(allPayments.filter((p: any) => p.agentId === user.id));
        } else {
          setPaymentsHistory(allPayments);
        }
      }
    };

    const handleStorage = () => {
      loadDailyStats();
      loadHistory();
    };

    loadDailyStats();
    loadHistory();
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  const handleVersement = () => {
    const totalAmount = physicalBalance; // Use physical balance as the amount to deposit
    if (totalAmount <= 0) {
      setErrorMessage("Votre solde agent est vide.");
      setTimeout(() => setErrorMessage(null), 4000);
      return;
    }

    // Prevent duplicate payments (same amount, same agent, pending, same day)
    const isDuplicate = paymentsHistory.some(p => 
      p.agentId === currentUser?.id && 
      p.totalAmount === totalAmount && 
      p.status === 'En attente' &&
      new Date(p.date).toDateString() === new Date().toDateString()
    );

    if (isDuplicate) {
      setErrorMessage("Un versement identique est déjà en attente pour aujourd'hui.");
      setTimeout(() => setErrorMessage(null), 4000);
      return;
    }

    setIsSubmitting(true);
    setTimeout(() => {
      const saved = localStorage.getItem('microfox_agent_payments');
      const allPayments = saved ? JSON.parse(saved) : [];

      const newPayment = {
        id: Date.now().toString(),
        agentId: currentUser?.id,
        agentName: currentUser?.identifiant,
        zone: currentUser?.zoneCollecte || currentUser?.zone,
        cashierName: currentUser?.identifiant,
        amountCotisations: totalCotisations,
        amountLivrets: totalLivrets,
        totalAmount: totalAmount,
        theoreticalAmount: theoreticalTotal,
        physicalBalance: physicalBalance,
        gap: gap,
        billetage: billetage,
        date: new Date().toISOString(),
        status: 'En attente',
        caisse: selectedCaisse,
        authorizedBy: gap < 0 ? 'Directeur/Admin (Code: ' + authCode + ')' : null
      };

      const updatedAllPayments = [newPayment, ...allPayments];
      localStorage.setItem('microfox_agent_payments', JSON.stringify(updatedAllPayments));
      window.dispatchEvent(new Event('storage'));
      
      // Deduct from agent balance
      const agentBalanceKey = `microfox_agent_balance_${currentUser.id}`;
      const currentAgentBalance = Number(localStorage.getItem(agentBalanceKey) || 0);
      localStorage.setItem(agentBalanceKey, (currentAgentBalance - totalAmount).toString());
      
      localStorage.setItem('microfox_pending_sync', 'true');
      
      if (currentUser?.role === 'agent commercial') {
        setPaymentsHistory(updatedAllPayments.filter((p: any) => p.agentId === currentUser.id));
      } else {
        setPaymentsHistory(updatedAllPayments);
      }
      
      setAgentBalance(0);
      setTotalCotisations(0);
      setTotalLivrets(0);
      setBilletage({
        '10000': 0, '5000': 0, '2000': 0, '1000': 0, '500': 0, '250': 0, '200': 0, '100': 0, '50': 0, '25': 0, '10': 0, '5': 0, 'monnaie': 0
      });
      setAuthCode('');
      
      setSuccessMessage(`Versement de ${totalAmount} FCFA soumis à la ${selectedCaisse} avec succès.`);
      alert("Versement effectué avec succès.");
      setIsSubmitting(false);
      setTimeout(() => setSuccessMessage(null), 4000);
    }, 1500);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-20">
      <div className="flex items-start gap-4">
        <div className="p-3 bg-emerald-100 text-emerald-600 rounded-2xl">
          <Wallet size={32} />
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl font-black text-[#121c32] uppercase tracking-tight">Versement de Fin de Journée</h1>
          <p className="text-gray-500 font-medium">Récapitulatif et versement des collectes aux caisses.</p>
        </div>
      </div>

      {successMessage && (
        <div className="bg-emerald-500 text-white p-4 rounded-2xl flex items-center justify-center gap-3 shadow-lg animate-in fade-in slide-in-from-top-4">
          <CheckCircle size={20} />
          <span className="font-bold uppercase tracking-tight text-sm">{successMessage}</span>
        </div>
      )}

      {errorMessage && (
        <div className="bg-red-500 text-white p-4 rounded-2xl flex items-center justify-center gap-3 shadow-lg animate-in shake duration-300">
          <AlertCircle size={20} />
          <span className="font-bold uppercase tracking-tight text-sm">{errorMessage}</span>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-gray-100 space-y-6">
          <div className="flex justify-between items-center">
            <h2 className="text-sm font-black text-gray-400 uppercase tracking-widest">Solde Agent à Verser</h2>
            <span className="text-2xl font-black text-emerald-600">{theoreticalTotal.toLocaleString()} FCFA</span>
          </div>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-gray-600 uppercase tracking-widest ml-1">Choisir la Caisse de versement</label>
              <select 
                value={selectedCaisse}
                onChange={(e) => setSelectedCaisse(e.target.value)}
                className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl outline-none text-sm font-black text-[#121c32] focus:border-emerald-500 transition-all appearance-none uppercase tracking-tight"
              >
                {caisses
                  .filter(c => currentUser?.role !== 'agent commercial' || c !== 'CAISSE PRINCIPALE')
                  .map(c => <option key={c} value={c}>{c}</option>)
                }
              </select>
            </div>

            <div className="flex items-center justify-between p-4 bg-indigo-50 rounded-2xl border border-indigo-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-100 text-indigo-600 flex items-center justify-center">
                  <TrendingUp size={20} />
                </div>
                <span className="text-xs font-black text-indigo-900 uppercase">Cotisations Tontine</span>
              </div>
              <span className="text-lg font-black text-indigo-600">{totalCotisations.toLocaleString()} F</span>
            </div>

            <div className="flex items-center justify-between p-4 bg-amber-50 rounded-2xl border border-amber-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-600 flex items-center justify-center">
                  <BookOpen size={20} />
                </div>
                <span className="text-xs font-black text-amber-900 uppercase">Vente Livrets</span>
              </div>
              <span className="text-lg font-black text-amber-600">{totalLivrets.toLocaleString()} F</span>
            </div>

          <div className="pt-4 border-t border-gray-100 flex items-center justify-between">
            <span className="text-sm font-black text-[#121c32] uppercase">Total Théorique</span>
            <span className="text-2xl font-black text-[#00c896]">{theoreticalTotal.toLocaleString()} F</span>
          </div>

          <div className="pt-6 border-t border-gray-100 space-y-4">
            <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-4">Détails du Billetage</h3>
            <div className="overflow-x-auto border border-gray-100 rounded-2xl max-h-[300px] overflow-y-auto custom-scrollbar">
              <table className="w-full text-left text-[10px]">
                <thead className="bg-gray-50 border-b border-gray-100 sticky top-0 z-10">
                  <tr>
                    <th className="p-2 font-black text-gray-500 uppercase whitespace-nowrap">Billet/Pièce</th>
                    <th className="p-2 font-black text-gray-500 uppercase whitespace-nowrap text-center">Nombre</th>
                    <th className="p-2 font-black text-gray-500 uppercase text-right whitespace-nowrap">Montant</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {[10000, 5000, 2000, 1000, 500, 250, 200, 100, 50, 25, 10, 5].map(val => (
                    <tr key={val}>
                      <td className="p-2 font-bold text-gray-700 whitespace-nowrap">{val.toLocaleString()}</td>
                      <td className="p-2 flex justify-center">
                        <input 
                          type="number"
                          min="0"
                          value={billetage[val] || ''}
                          onChange={(e) => setBilletage({...billetage, [val]: e.target.value})}
                          className="w-16 p-1 bg-white border border-gray-300 rounded-lg outline-none text-center font-black text-[#121c32] focus:border-emerald-500 transition-all"
                        />
                      </td>
                      <td className="p-2 font-black text-gray-900 text-right whitespace-nowrap">{(Number(billetage[val] || 0) * val).toLocaleString()}</td>
                    </tr>
                  ))}
                  <tr>
                    <td className="p-2 font-bold text-gray-700 uppercase whitespace-nowrap">Monnaie</td>
                    <td className="p-2 flex justify-center">
                      <input 
                        type="number"
                        min="0"
                        value={billetage['monnaie'] || ''}
                        onChange={(e) => setBilletage({...billetage, 'monnaie': e.target.value})}
                        className="w-24 p-1 bg-white border border-gray-300 rounded-lg outline-none text-center font-black text-[#121c32] focus:border-emerald-500 transition-all"
                        placeholder="Montant total"
                      />
                    </td>
                    <td className="p-2 font-black text-gray-900 text-right whitespace-nowrap">{Number(billetage['monnaie'] || 0).toLocaleString()}</td>
                  </tr>
                </tbody>
                <tfoot className="bg-emerald-50 sticky bottom-0 z-10">
                  <tr>
                    <td colSpan={2} className="p-2 font-black text-emerald-900 uppercase whitespace-nowrap">Total Billetage (Physique)</td>
                    <td className="p-2 font-black text-emerald-600 text-right text-sm whitespace-nowrap">{physicalBalance.toLocaleString()} F</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          <div className={`p-4 rounded-2xl border ${
            gap === 0 ? 'bg-emerald-50 border-emerald-100' : 
            gap > 0 ? 'bg-blue-50 border-blue-100' : 'bg-red-50 border-red-100'
          }`}>
            <div className="flex justify-between items-center">
              <span className="text-[10px] font-black uppercase tracking-widest text-gray-600">Écart (Physique - Théorique)</span>
              <span className={`text-sm font-black ${
                gap === 0 ? 'text-emerald-600' : 
                gap > 0 ? 'text-blue-600' : 'text-red-600'
              }`}>
                {gap > 0 ? '+' : ''}{gap.toLocaleString()} F
              </span>
            </div>
            {gap < 0 && (
              <div className="mt-4 space-y-3">
                <div className="flex items-center gap-2 text-red-600">
                  <AlertCircle size={14} />
                  <span className="text-[9px] font-black uppercase tracking-tight">Autorisation requise pour écart négatif</span>
                </div>
                <input 
                  type="password"
                  placeholder="CODE D'AUTORISATION (DIRECTEUR/ADMIN)"
                  value={authCode}
                  onChange={(e) => setAuthCode(e.target.value)}
                  className="w-full p-3 bg-white border border-red-200 rounded-xl outline-none text-[10px] font-black text-[#121c32] focus:border-red-500 placeholder:text-red-200 uppercase tracking-widest"
                />
              </div>
            )}
          </div>
        </div>

          <button
            onClick={handleVersement}
            disabled={isSubmitting || (totalCotisations + totalLivrets === 0) || gap < 0}
            className={`w-full py-4 rounded-2xl flex items-center justify-center gap-3 font-black uppercase tracking-widest text-sm transition-all shadow-lg active:scale-95 ${
              isSubmitting || (totalCotisations + totalLivrets === 0) || gap < 0
                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                : 'bg-[#121c32] text-white hover:bg-[#1d2d4d]'
            }`}
          >
            {isSubmitting ? (
              <Clock size={20} className="animate-spin" />
            ) : (
              <Send size={20} />
            )}
            {isSubmitting ? 'Traitement...' : 'Effectuer le versement'}
          </button>
          {gap < 0 && (
            <p className="mt-2 text-[10px] font-black text-red-500 text-center uppercase tracking-tight animate-pulse">
              Validation impossible : le montant physique est inférieur au montant théorique.
            </p>
          )}
          {(totalCotisations + totalLivrets === 0) && (
            <p className="mt-2 text-[10px] font-black text-gray-400 text-center uppercase tracking-tight">
              Validation impossible : aucun montant à verser aujourd'hui.
            </p>
          )}
        </div>

        <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-gray-100 space-y-6">
          <h2 className="text-sm font-black text-gray-400 uppercase tracking-widest">Historique des Versements</h2>
          
          <div className="space-y-3 max-h-[400px] overflow-y-auto custom-scrollbar pr-2">
            {paymentsHistory.length > 0 ? (
              paymentsHistory.map((p) => (
                <div key={p.id} className="p-4 bg-gray-50 rounded-2xl border border-gray-100 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-black text-[#121c32] uppercase">
                        {new Date(p.date).toLocaleDateString()} - {new Date(p.date).toLocaleTimeString()}
                        {p.zone && <span className="ml-2 text-blue-600">(ZONE {p.zone})</span>}
                      </p>
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Total: {p.totalAmount.toLocaleString()} F</p>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${
                      p.status === 'Validé' ? 'bg-emerald-100 text-emerald-600' : 'bg-amber-100 text-amber-600'
                    }`}>
                      {p.status}
                    </span>
                  </div>
                  
                  {p.billetage && (
                    <div className="pt-2 border-t border-gray-200">
                      <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-2">Détails Billetage</p>
                      <div className="grid grid-cols-3 gap-2">
                        {[10000, 5000, 2000, 1000, 500, 250, 200, 100, 50, 25, 10, 5].map(val => p.billetage[val] > 0 && (
                          <div key={val} className="bg-white p-1.5 rounded-lg border border-gray-100 text-center">
                            <p className="text-[8px] font-bold text-gray-400">{val.toLocaleString()}</p>
                            <p className="text-[10px] font-black text-[#121c32]">x{p.billetage[val]}</p>
                          </div>
                        ))}
                        {p.billetage.monnaie > 0 && (
                          <div className="bg-white p-1.5 rounded-lg border border-gray-100 text-center">
                            <p className="text-[8px] font-bold text-gray-400">MONNAIE</p>
                            <p className="text-[10px] font-black text-[#121c32]">{Number(p.billetage.monnaie).toLocaleString()} F</p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))
            ) : (
              <div className="text-center py-10">
                <AlertCircle size={32} className="mx-auto text-gray-200 mb-2" />
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest italic">Aucun versement effectué</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AgentPayments;
