import React, { useState, useEffect } from 'react';
import { 
  CreditCard, 
  Search, 
  CheckCircle,
  History,
  ArrowUpRight,
  ShieldCheck,
  X
} from 'lucide-react';
import ConfirmModal from './ConfirmModal';

const CreditDisbursement: React.FC = () => {
  const [members, setMembers] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    type: 'confirm' | 'alert' | 'success' | 'error';
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
    type: 'confirm'
  });

  const showAlert = (title: string, message: string, type: 'alert' | 'success' | 'error' = 'alert') => {
    setConfirmModal({
      isOpen: true,
      title,
      message,
      onConfirm: () => setConfirmModal(prev => ({ ...prev, isOpen: false })),
      type
    });
  };

  const showConfirm = (title: string, message: string, onConfirm: () => void) => {
    setConfirmModal({
      isOpen: true,
      title,
      message,
      onConfirm: onConfirm,
      type: 'confirm'
    });
  };

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
    m.epargneAccountNumber && m.lastCreditRequest && m.lastCreditRequest.status === 'Validé'
  ).filter(m => {
    const search = searchTerm.toLowerCase();
    return m.name.toLowerCase().includes(search) || m.code.toLowerCase().includes(search);
  });

  const handleDisburse = (memberId: string) => {
    const currentUser = JSON.parse(localStorage.getItem('microfox_current_user') || 'null');
    if (!currentUser) {
      setStatusMessage({ type: 'error', text: "Session expirée. Veuillez vous reconnecter." });
      setTimeout(() => setStatusMessage(null), 6000);
      return;
    }

    const saved = localStorage.getItem('microfox_members_data');
    let clients = saved ? JSON.parse(saved) : [];
    const client = clients.find((c: any) => c.id === memberId);
    if (!client || !client.lastCreditRequest) return;

    const request = client.lastCreditRequest;
    const capital = Number(request.capital || 0);
    const interest = Number(request.interest || 0);
    const fees = Number(request.fees || 0);
    const penalty = Number(request.penalty || 0);

    if (request.status !== 'Validé') {
      showAlert("Erreur", "Le crédit doit être validé avant d'être décaissé.", "error");
      return;
    }

    showConfirm(
      "Confirmation de déblocage",
      `Voulez-vous vraiment débloquer ce crédit de ${capital.toLocaleString()} F pour ${client.name} ?`,
      () => {
        const targetCaisse = currentUser.role === 'agent commercial' ? null : (currentUser.caisse || (currentUser.role === 'administrateur' ? 'CAISSE PRINCIPALE' : null));
        
        if (targetCaisse) {
          const cashKey = `microfox_cash_balance_${targetCaisse}`;
          const currentCashBalance = Number(localStorage.getItem(cashKey) || 0);
          if (currentCashBalance < capital) {
            showAlert("Solde insuffisant", `Opération impossible : Le solde de la ${targetCaisse} est de ${currentCashBalance.toLocaleString()} F. Solde insuffisant pour décaisser ${capital.toLocaleString()} F.`, "error");
            return;
          }
          // Mise à jour du solde de la caisse : on décaisse le capital et on encaisse les frais
          localStorage.setItem(cashKey, (currentCashBalance - capital + fees).toString());
        } else if (currentUser.role === 'agent commercial') {
          const agentBalanceKey = `microfox_agent_balance_${currentUser.id}`;
          const currentAgentBalance = Number(localStorage.getItem(agentBalanceKey) || 0);
          // Pour un agent, on impacte aussi son solde
          localStorage.setItem(agentBalanceKey, (currentAgentBalance - capital + fees).toString());
        }

        const updatedClients = clients.map((c: any) => {
          if (c.id === memberId) {
            let fullHistory = c.history || [];
            if (fullHistory.length === 0) {
              const savedHistory = localStorage.getItem(`microfox_history_${c.id}`);
              if (savedHistory) fullHistory = JSON.parse(savedHistory);
            }

            const currentCredit = Number(c.balances?.credit || 0);
            const newTotal = currentCredit + capital + interest + penalty;
            
            const newTx = {
              id: Date.now().toString(),
              type: 'deblocage',
              account: 'credit',
              amount: capital,
              date: new Date().toISOString(),
              description: `Déblocage de crédit approuvé par ${currentUser.identifiant || 'Inconnu'} - Échéance: ${request.dueDate}`,
              operator: currentUser.identifiant || 'Inconnu',
              cashierName: currentUser.identifiant || 'Inconnu'
            };

            const feesTx = fees > 0 ? {
              id: `fees-${Date.now()}`,
              type: 'depot',
              account: 'frais',
              amount: fees,
              date: new Date().toISOString(),
              description: `Frais de dossier crédit encaissés par ${currentUser.identifiant || 'Inconnu'} - Échéance: ${request.dueDate}`,
              operator: currentUser.identifiant || 'Inconnu',
              cashierName: currentUser.identifiant || 'Inconnu'
            } : null;
            
            const addedHistory = [newTx];
            if (feesTx) addedHistory.push(feesTx);

            const newHistory = [...addedHistory, ...fullHistory];
            localStorage.setItem(`microfox_history_${c.id}`, JSON.stringify(newHistory));

            return {
              ...c,
              balances: { ...c.balances, credit: newTotal },
              history: newHistory,
              dureeCredit: request.duration,
              lastCreditDetails: {
                capital: capital,
                interest: interest,
                penalty: penalty,
                duration: request.duration,
                dueDate: request.dueDate,
                requestedBy: request.requestedBy,
                validatedBy: request.validatedBy,
                disbursedBy: currentUser.identifiant || 'Inconnu'
              },
              lastCreditRequest: {
                ...request,
                status: 'Débloqué',
                disbursedBy: currentUser.identifiant || 'Inconnu',
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
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
        setStatusMessage({ 
          type: 'success', 
          text: `Le crédit de ${capital.toLocaleString()} F pour ${client.name} a été débloqué avec succès.` 
        });
        setTimeout(() => setStatusMessage(null), 6000);
      }
    );
  };

  const handleCancelDisbursement = (memberId: string) => {
    const currentUser = JSON.parse(localStorage.getItem('microfox_current_user') || 'null');
    if (!currentUser) {
      showAlert("Session expirée", "Veuillez vous reconnecter.", "error");
      return;
    }

    if (!['administrateur', 'directeur', 'caissier'].includes(currentUser.role)) {
      showAlert("Accès refusé", "Seul l'administrateur, le directeur ou le caissier peut annuler un décaissement.", "error");
      return;
    }

    showConfirm(
      "Annulation de décaissement",
      "Voulez-vous vraiment annuler ce décaissement ? Les soldes seront rétablis.",
      () => {
        const saved = localStorage.getItem('microfox_members_data');
        let clients = saved ? JSON.parse(saved) : [];
        const client = clients.find((c: any) => c.id === memberId);
        if (!client || !client.lastCreditRequest || client.lastCreditRequest.status !== 'Débloqué') return;

        const request = client.lastCreditRequest;
        const capital = Number(request.capital || 0);
        const fees = Number(request.fees || 0);
        const interest = Number(request.interest || 0);
        const penalty = Number(request.penalty || 0);
        
        // Revert Caisse/Agent balance
        const targetCaisse = currentUser.role === 'agent commercial' ? null : (currentUser.caisse || (currentUser.role === 'administrateur' ? 'CAISSE PRINCIPALE' : null));
        if (targetCaisse) {
          const cashKey = `microfox_cash_balance_${targetCaisse}`;
          const currentCashBalance = Number(localStorage.getItem(cashKey) || 0);
          localStorage.setItem(cashKey, (currentCashBalance + capital - fees).toString());
        } else if (currentUser.role === 'agent commercial') {
          const agentBalanceKey = `microfox_agent_balance_${currentUser.id}`;
          const currentAgentBalance = Number(localStorage.getItem(agentBalanceKey) || 0);
          localStorage.setItem(agentBalanceKey, (currentAgentBalance + capital - fees).toString());
        }

        const updatedClients = clients.map((c: any) => {
          if (c.id === memberId) {
            let fullHistory = c.history || [];
            if (fullHistory.length === 0) {
              const savedHistory = localStorage.getItem(`microfox_history_${c.id}`);
              if (savedHistory) fullHistory = JSON.parse(savedHistory);
            }

            // Remove the disbursement transactions (deblocage and fees)
            // We look for the most recent ones related to this credit
            const newHistory = fullHistory.filter((tx: any) => 
              !(tx.type === 'deblocage' && tx.account === 'credit' && Number(tx.amount) === capital && tx.date === request.disbursementDate) &&
              !(tx.type === 'depot' && tx.account === 'frais' && Number(tx.amount) === fees && tx.date === request.disbursementDate)
            );
            
            localStorage.setItem(`microfox_history_${c.id}`, JSON.stringify(newHistory));

            const currentCredit = Number(c.balances?.credit || 0);
            const revertedTotal = currentCredit - (capital + interest + penalty);

            return {
              ...c,
              balances: { ...c.balances, credit: revertedTotal },
              history: newHistory,
              lastCreditRequest: {
                ...request,
                status: 'Validé',
                disbursedBy: null,
                disbursementDate: null
              }
            };
          }
          return c;
        });

        localStorage.setItem('microfox_members_data', JSON.stringify(updatedClients));
        localStorage.setItem('microfox_pending_sync', 'true');
        window.dispatchEvent(new Event('storage'));
        loadData();
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
        showAlert("Succès", "Décaissement annulé. Le crédit est de nouveau en attente de déblocage.", "success");
      }
    );
  };

  const handleCancelRequest = (memberId: string) => {
    const currentUser = JSON.parse(localStorage.getItem('microfox_current_user') || 'null');
    if (!currentUser) {
      showAlert("Session expirée", "Veuillez vous reconnecter.", "error");
      return;
    }

    if (!['administrateur', 'directeur', 'gestionnaire de crédit'].includes(currentUser.role)) {
      showAlert("Accès refusé", "Seul l'administrateur, le directeur ou le gestionnaire de crédit peut annuler une demande de crédit.", "error");
      return;
    }

    showConfirm(
      "Annulation de demande",
      "Voulez-vous vraiment annuler cette demande de crédit ?",
      () => {
        const saved = localStorage.getItem('microfox_members_data');
        let clients = saved ? JSON.parse(saved) : [];
        
        const updatedClients = clients.map((c: any) => {
          if (c.id === memberId) {
            return {
              ...c,
              lastCreditRequest: {
                ...c.lastCreditRequest,
                status: 'Annulé',
                cancelledBy: currentUser.identifiant || 'Inconnu',
                cancelledAt: new Date().toISOString()
              }
            };
          }
          return c;
        });

        localStorage.setItem('microfox_members_data', JSON.stringify(updatedClients));
        localStorage.setItem('microfox_pending_sync', 'true');
        window.dispatchEvent(new Event('storage'));
        loadData();
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
        showAlert("Succès", "Demande de crédit annulée avec succès.", "success");
      }
    );
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {statusMessage && (
        <div className={`p-4 rounded-2xl font-black uppercase tracking-widest text-sm shadow-lg animate-in fade-in slide-in-from-top-4 duration-300 ${
          statusMessage.type === 'success' ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white'
        }`}>
          {statusMessage.text}
        </div>
      )}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-white uppercase tracking-tight">Déblocage de Crédit</h1>
          <p className="text-gray-500 text-sm font-medium mt-1">Validation et décaissement des fonds</p>
        </div>
        <div className="relative w-full md:w-96">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
          <input 
            type="text" 
            placeholder="Rechercher une demande..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-12 pr-4 py-3 bg-white/5 border border-gray-800 rounded-2xl outline-none focus:border-emerald-500 font-medium transition-all shadow-sm text-white"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {pendingRequests.length > 0 ? (
          pendingRequests.map((m) => (
            <div key={m.id} className="bg-[#121c32] rounded-[2rem] p-6 border border-white/5 shadow-sm hover:shadow-md transition-all">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-2xl bg-white/5 text-white flex items-center justify-center font-black text-lg">
                    {m.name.split(' ').map((n: string) => n[0]).join('')}
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-white uppercase">{m.name}</h3>
                    <p className="text-xs font-bold text-gray-500 uppercase tracking-widest">{m.code}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-8 flex-1 lg:px-12">
                  <div>
                    <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">Capital</p>
                    <p className="text-lg font-black text-white">{m.lastCreditRequest.capital.toLocaleString()} F</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">Intérêts</p>
                    <p className="text-lg font-black text-blue-400">{m.lastCreditRequest.interest.toLocaleString()} F</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">Frais/Pén.</p>
                    <p className="text-lg font-black text-amber-400">{((m.lastCreditRequest.fees || 0) + (m.lastCreditRequest.penalty || 0)).toLocaleString()} F</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">Échéance</p>
                    <p className="text-lg font-black text-gray-400">{new Date(m.lastCreditRequest.dueDate).toLocaleDateString()}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button 
                    onClick={() => handleCancelRequest(m.id)}
                    className="p-4 text-red-400 hover:bg-red-500/10 rounded-2xl transition-all"
                    title="Annuler la demande"
                  >
                    <X size={24} />
                  </button>
                  <button 
                    onClick={() => handleDisburse(m.id)}
                    className="px-8 py-4 bg-[#00c896] text-white rounded-2xl font-black uppercase tracking-widest shadow-lg hover:bg-[#00a87d] transition-all flex items-center justify-center gap-2"
                  >
                    <ArrowUpRight size={20} />
                    Débloquer
                  </button>
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="bg-[#121c32] rounded-[2.5rem] p-20 text-center border border-dashed border-white/5">
            <div className="w-20 h-20 bg-white/5 text-gray-500 rounded-full flex items-center justify-center mx-auto mb-6">
              <History size={40} />
            </div>
            <h3 className="text-xl font-black text-gray-500 uppercase tracking-tight">Aucun crédit à débloquer</h3>
            <p className="text-gray-600 text-sm mt-2">Les crédits validés apparaîtront ici pour déblocage.</p>
          </div>
        )}
      </div>

      {/* Recapitulatif des déblocages récents */}
      <div className="mt-12">
        <h3 className="text-lg font-black text-white uppercase tracking-tight mb-6 flex items-center gap-2">
          <ShieldCheck size={20} className="text-emerald-500" /> Déblocages Récents
        </h3>
        <div className="bg-[#121c32] rounded-[2.5rem] shadow-sm border border-white/5 overflow-x-auto">
          <table className="w-full text-left min-w-[800px]">
            <thead>
              <tr className="bg-white/5">
                <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Membre</th>
                <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Opérateurs (Req/Val/Déc)</th>
                <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest text-right">Capital</th>
                <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest text-right">Intérêts</th>
                <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest text-right">Frais/Pén.</th>
                <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Date Débloc.</th>
                <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Échéance</th>
                <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest text-center">Statut</th>
                <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {members.filter(m => m.lastCreditRequest && m.lastCreditRequest.status === 'Débloqué').length > 0 ? (
                members.filter(m => m.lastCreditRequest && m.lastCreditRequest.status === 'Débloqué').map((m) => (
                  <tr key={m.id} className="hover:bg-white/5 transition-colors">
                    <td className="px-6 py-4">
                      <p className="text-sm font-black text-white uppercase">{m.name}</p>
                      <p className="text-[10px] font-bold text-gray-500 uppercase tracking-tight">{m.code}</p>
                    </td>
                    <td className="px-6 py-4">
                      <div className="space-y-1">
                        <p className="text-[10px] font-bold text-blue-400 uppercase">Req: {m.lastCreditRequest.requestedBy || '---'}</p>
                        <p className="text-[10px] font-bold text-emerald-400 uppercase">Val: {m.lastCreditRequest.validatedBy || '---'}</p>
                        <p className="text-[10px] font-bold text-purple-400 uppercase">Déc: {m.lastCreditRequest.disbursedBy || '---'}</p>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <p className="text-sm font-black text-emerald-400">{m.lastCreditRequest.capital.toLocaleString()} F</p>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <p className="text-sm font-black text-blue-400">{m.lastCreditRequest.interest.toLocaleString()} F</p>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <p className="text-sm font-black text-amber-400">{((m.lastCreditRequest.fees || 0) + (m.lastCreditRequest.penalty || 0)).toLocaleString()} F</p>
                    </td>
                    <td className="px-6 py-4 text-sm font-medium text-gray-400">
                      {new Date(m.lastCreditRequest.disbursementDate).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 text-sm font-medium text-gray-400">
                      {new Date(m.lastCreditRequest.dueDate).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className="px-2.5 py-1 bg-emerald-500/10 text-emerald-400 rounded-lg text-[10px] font-black uppercase tracking-tight">
                        Débloqué
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <button
                        onClick={() => handleCancelDisbursement(m.id)}
                        className="p-2 text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                        title="Annuler le décaissement"
                      >
                        <X size={18} />
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={9} className="px-6 py-8 text-center text-gray-600 italic text-sm">
                    Aucun déblocage récent
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <ConfirmModal
        isOpen={confirmModal.isOpen}
        title={confirmModal.title}
        message={confirmModal.message}
        onConfirm={confirmModal.onConfirm}
        onCancel={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
        type={confirmModal.type}
      />
    </div>
  );
};

export default CreditDisbursement;
