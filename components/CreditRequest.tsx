import React, { useState, useEffect, useRef } from 'react';
import { 
  CreditCard, 
  Search, 
  CheckCircle,
  X,
  FileText,
  History,
  ChevronDown
} from 'lucide-react';

const CreditRequest: React.FC = () => {
  const [members, setMembers] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedMemberId, setSelectedMemberId] = useState('');
  const [amount, setAmount] = useState('');
  const [interest, setInterest] = useState('');
  const [fees, setFees] = useState('');
  const [creditNumber, setCreditNumber] = useState('');
  const [creditType, setCreditType] = useState('Crédit Ordinaire (ORD)');
  const [clientPhone, setClientPhone] = useState('');
  const [guarantorName, setGuarantorName] = useState('');
  const [guarantorPhone, setGuarantorPhone] = useState('');
  const [duration, setDuration] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const loadData = () => {
      const saved = localStorage.getItem('microfox_members_data');
      if (saved) {
        setMembers(JSON.parse(saved));
      } else {
        setMembers([
          { id: '1', name: 'KOFFI Ama Gertrude', code: 'CLT-001254', epargneAccountNumber: 'EP-44201', tontineAccounts: [{ number: 'TN-8829-01' }] },
          { id: '2', name: 'MENSAH Yao Jean', code: 'CLT-001289', epargneAccountNumber: 'EP-99102', tontineAccounts: [] }
        ]);
      }
    };

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
    return (
      m.name.toLowerCase().includes(search) ||
      m.code.toLowerCase().includes(search) ||
      (m.epargneAccountNumber && m.epargneAccountNumber.toLowerCase().includes(search)) ||
      (m.tontineAccounts && m.tontineAccounts.some((acc: any) => acc.number.toLowerCase().includes(search)))
    );
  });

  const handleCancelRequest = (memberId: string) => {
    const currentUser = JSON.parse(localStorage.getItem('microfox_current_user') || '{}');
    if (!['administrateur', 'directeur', 'gestionnaire de crédit'].includes(currentUser.role)) {
      alert("Seul l'administrateur, le directeur ou le gestionnaire de crédit peut annuler une demande de crédit.");
      return;
    }

    const saved = localStorage.getItem('microfox_members_data');
    let clients = saved ? JSON.parse(saved) : members;

    const updatedClients = clients.map((c: any) => {
      if (c.id === memberId && c.lastCreditRequest?.status === 'En attente') {
        let fullHistory = c.history || [];
        if (fullHistory.length === 0) {
          const savedHistory = localStorage.getItem(`microfox_history_${c.id}`);
          if (savedHistory) fullHistory = JSON.parse(savedHistory);
        }

        const newTx = {
          id: Date.now().toString(),
          type: 'annulation',
          account: 'credit',
          amount: c.lastCreditRequest.capital,
          date: new Date().toISOString(),
          description: `Demande de crédit annulée par ${currentUser.identifiant || 'Inconnu'}`,
          operator: currentUser.identifiant || 'Inconnu',
          cashierName: currentUser.identifiant || 'Inconnu'
        };

        const newHistory = [newTx, ...fullHistory];
        localStorage.setItem(`microfox_history_${c.id}`, JSON.stringify(newHistory));

        return {
          ...c,
          history: newHistory,
          lastCreditRequest: {
            ...c.lastCreditRequest,
            status: 'Annulé',
            cancelledBy: currentUser.identifiant || 'Inconnu',
            cancelDate: new Date().toISOString()
          }
        };
      }
      return c;
    });

    localStorage.setItem('microfox_members_data', JSON.stringify(updatedClients));
    setMembers(updatedClients);
    localStorage.setItem('microfox_pending_sync', 'true');
    window.dispatchEvent(new Event('storage'));
    alert("Demande de crédit annulée.");
  };

  const handleSave = () => {
    if (!selectedMemberId) {
      const msg = "La demande de crédit n'a pas été enregistrée. Raison : Aucun membre n'a été sélectionné.";
      setStatusMessage({ text: msg, type: 'error' });
      alert(msg);
      return;
    }
    if (!amount || Number(amount) <= 0) {
      const msg = "La demande de crédit n'a pas été enregistrée. Raison : Le montant du crédit est invalide ou manquant.";
      setStatusMessage({ text: msg, type: 'error' });
      alert(msg);
      return;
    }
    if (!creditNumber) {
      const msg = "La demande de crédit n'a pas été enregistrée. Raison : Le numéro de crédit est manquant.";
      setStatusMessage({ text: msg, type: 'error' });
      alert(msg);
      return;
    }
    if (!dueDate) {
      const msg = "La demande de crédit n'a pas été enregistrée. Raison : La date d'échéance est manquante.";
      setStatusMessage({ text: msg, type: 'error' });
      alert(msg);
      return;
    }

    const saved = localStorage.getItem('microfox_members_data');
    let clients = saved ? JSON.parse(saved) : members;

    const selectedMember = clients.find((c: any) => c.id === selectedMemberId);
    if (!selectedMember?.epargneAccountNumber) {
      const msg = "La demande de crédit n'a pas été enregistrée. Raison : Ce client ne possède pas de compte épargne. Un compte épargne est obligatoire pour toute demande de crédit.";
      setStatusMessage({ text: msg, type: 'error' });
      alert(msg);
      return;
    }

    // Vérifier si le client a déjà un crédit en cours ou une demande en attente
    if (selectedMember.balances?.credit > 0) {
      const msg = "La demande de crédit n'a pas été enregistrée. Raison : Ce client a déjà un crédit en cours non soldé.";
      setStatusMessage({ text: msg, type: 'error' });
      alert(msg);
      return;
    }

    if (selectedMember.lastCreditRequest && (selectedMember.lastCreditRequest.status === 'En attente' || selectedMember.lastCreditRequest.status === 'Validé')) {
      const msg = `La demande de crédit n'a pas été enregistrée. Raison : Une demande de crédit est déjà ${selectedMember.lastCreditRequest.status.toLowerCase()} pour ce client.`;
      setStatusMessage({ text: msg, type: 'error' });
      alert(msg);
      return;
    }

    const updatedClients = clients.map((c: any) => {
      if (c.id === selectedMemberId) {
        let fullHistory = c.history || [];
        if (fullHistory.length === 0) {
          const savedHistory = localStorage.getItem(`microfox_history_${c.id}`);
          if (savedHistory) fullHistory = JSON.parse(savedHistory);
        }

        const currentUser = JSON.parse(localStorage.getItem('microfox_current_user') || '{}');
        const newTx = {
          id: Date.now().toString(),
          type: 'deblocage',
          account: 'credit',
          amount: Number(amount),
          date: new Date().toISOString(),
          description: `Demande de crédit enregistrée par ${currentUser.identifiant || 'Inconnu'} - Échéance: ${dueDate}`,
          operator: currentUser.identifiant || 'Inconnu',
          cashierName: currentUser.identifiant || 'Inconnu'
        };
        
        const newHistory = [newTx, ...fullHistory];
        localStorage.setItem(`microfox_history_${c.id}`, JSON.stringify(newHistory));

        return {
          ...c,
          history: newHistory,
          lastCreditRequest: {
            capital: Number(amount),
            interest: Number(interest),
            fees: Number(fees),
            creditNumber: creditNumber,
            creditType: creditType,
            clientPhone: clientPhone,
            guarantorName: guarantorName,
            guarantorPhone: guarantorPhone,
            duration: duration,
            dueDate: dueDate,
            status: 'En attente',
            requestedBy: currentUser.identifiant || 'Inconnu',
            requestDate: new Date().toISOString()
          }
        };
      }
      return c;
    });
    
    localStorage.setItem('microfox_members_data', JSON.stringify(updatedClients));
    setMembers(updatedClients);
    localStorage.setItem('microfox_pending_sync', 'true');
    window.dispatchEvent(new Event('storage'));
    
    const successMsg = "Demande de crédit enregistrée avec succès.";
    setStatusMessage({ text: successMsg, type: 'success' });
    alert(successMsg);
    
    // Reset form
    setSelectedMemberId('');
    setAmount('');
    setInterest('');
    setFees('');
    setCreditNumber('');
    setCreditType('Crédit Ordinaire (ORD)');
    setClientPhone('');
    setGuarantorName('');
    setGuarantorPhone('');
    setDuration('');
    setDueDate('');
    setSearchTerm('');
  };

  return (
    <div className="max-w-2xl mx-auto">
      <div className="bg-white rounded-[2rem] overflow-hidden shadow-xl border border-gray-100">
        <div className="bg-[#121c32] p-6 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <FileText size={24} className="text-emerald-400" />
            <h3 className="text-lg font-black uppercase tracking-tight">Nouvelle Demande de Crédit</h3>
          </div>
        </div>
        
        <div className="p-8 space-y-6">
          <div className="space-y-2">
            <label className="text-[11px] font-black text-gray-600 uppercase tracking-widest">Rechercher le Membre</label>
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-600" size={18} />
              <input 
                type="text" 
                placeholder="Nom, N° Épargne ou Tontine..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-12 pr-4 py-4 bg-gray-50 border border-gray-200 rounded-2xl outline-none focus:border-[#00c896] font-bold text-black text-sm"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[11px] font-black text-gray-600 uppercase tracking-widest">Sélectionner le Membre</label>
            <div className="relative" ref={dropdownRef}>
              <button
                type="button"
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                className="w-full p-4 bg-gray-50 border border-gray-200 rounded-2xl outline-none focus:border-[#00c896] font-bold text-black text-left flex items-center justify-between"
              >
                <span className="truncate">
                  {selectedMemberId 
                    ? members.find(m => m.id === selectedMemberId)?.name 
                    : "-- Choisir un client --"}
                </span>
                <ChevronDown size={20} className={`transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} />
              </button>

              {isDropdownOpen && (
                <div className="absolute z-50 w-full mt-2 bg-white border border-gray-200 rounded-2xl shadow-2xl max-h-60 overflow-y-auto py-2">
                  {filteredMembers.length > 0 ? (
                    filteredMembers.map(m => (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => {
                          setSelectedMemberId(m.id);
                          setIsDropdownOpen(false);
                        }}
                        className="w-full px-4 py-3 text-left hover:bg-gray-50 transition-colors border-b border-gray-50 last:border-0"
                      >
                        <p className="text-sm font-black text-[#121c32] uppercase">{m.name} ({m.code})</p>
                        <p className="text-[10px] font-bold text-gray-500 uppercase tracking-tight">
                          EP: <span className="text-emerald-600">{m.epargneAccountNumber}</span> | 
                          TN: <span className="text-amber-600">{m.tontineAccounts?.[0]?.number || '---'}</span>
                        </p>
                      </button>
                    ))
                  ) : (
                    <div className="px-4 py-3 text-sm text-gray-500 italic">Aucun membre trouvé</div>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[11px] font-black text-gray-600 uppercase tracking-widest">Numéro de téléphone ☎️ client</label>
            <input 
              type="tel" 
              value={clientPhone} 
              onChange={(e) => setClientPhone(e.target.value)}
              placeholder="Ex: +228 90 00 00 00"
              className="w-full p-4 bg-gray-50 border border-gray-200 rounded-2xl outline-none focus:border-[#00c896] font-bold text-black"
            />
          </div>

          <div className="space-y-2">
            <label className="text-[11px] font-black text-gray-600 uppercase tracking-widest">Type de crédit</label>
            <select 
              value={creditType} 
              onChange={(e) => setCreditType(e.target.value)}
              className="w-full p-4 bg-gray-50 border border-gray-200 rounded-2xl outline-none focus:border-[#00c896] font-bold text-black"
            >
              <option value="Crédit Pré-Payé(P.P)">Crédit Pré-Payé(P.P)</option>
              <option value="Crédit Ordinaire (ORD)">Crédit Ordinaire (ORD)</option>
              <option value="Autres">Autres</option>
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-[11px] font-black text-gray-600 uppercase tracking-widest">Numéro du Crédit</label>
            <input 
              type="text" 
              value={creditNumber} 
              onChange={(e) => setCreditNumber(e.target.value)}
              placeholder="Ex: CR-2024-001"
              className="w-full p-4 bg-gray-50 border border-gray-200 rounded-2xl outline-none focus:border-[#00c896] font-bold text-black"
            />
          </div>

          <div className="space-y-2">
            <label className="text-[11px] font-black text-gray-600 uppercase tracking-widest">Montant du Crédit (F)</label>
            <input 
              type="number" 
              value={amount} 
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0"
              className="w-full p-4 bg-gray-50 border border-gray-200 rounded-2xl outline-none focus:border-[#00c896] font-black text-2xl text-[#121c32]"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-[11px] font-black text-gray-600 uppercase tracking-widest">Intérêt à payer (F)</label>
              <input 
                type="number" 
                value={interest} 
                onChange={(e) => setInterest(e.target.value)}
                placeholder="0"
                className="w-full p-4 bg-gray-50 border border-gray-200 rounded-2xl outline-none focus:border-[#00c896] font-bold text-black"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[11px] font-black text-gray-600 uppercase tracking-widest">Frais de dossier (F)</label>
              <input 
                type="number" 
                value={fees} 
                onChange={(e) => setFees(e.target.value)}
                placeholder="0"
                className="w-full p-4 bg-gray-50 border border-gray-200 rounded-2xl outline-none focus:border-[#00c896] font-bold text-black"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-[11px] font-black text-gray-600 uppercase tracking-widest">Durée du crédit</label>
              <input 
                type="text" 
                value={duration} 
                onChange={(e) => setDuration(e.target.value)}
                placeholder="Ex: 3 mois"
                className="w-full p-4 bg-gray-50 border border-gray-200 rounded-2xl outline-none focus:border-[#00c896] font-bold text-black"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[11px] font-black text-gray-600 uppercase tracking-widest">Date prévue de déblocage</label>
              <input 
                type="date" 
                value={dueDate} 
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full p-4 bg-gray-50 border border-gray-200 rounded-2xl outline-none focus:border-[#00c896] font-bold text-black"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-[11px] font-black text-gray-600 uppercase tracking-widest">Nom de la caution</label>
              <input 
                type="text" 
                value={guarantorName} 
                onChange={(e) => setGuarantorName(e.target.value)}
                placeholder="Nom complet du garant"
                className="w-full p-4 bg-gray-50 border border-gray-200 rounded-2xl outline-none focus:border-[#00c896] font-bold text-black"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[11px] font-black text-gray-600 uppercase tracking-widest">Numéro téléphone ☎️ caution</label>
              <input 
                type="tel" 
                value={guarantorPhone} 
                onChange={(e) => setGuarantorPhone(e.target.value)}
                placeholder="Téléphone du garant"
                className="w-full p-4 bg-gray-50 border border-gray-200 rounded-2xl outline-none focus:border-[#00c896] font-bold text-black"
              />
            </div>
          </div>

          {statusMessage && (
            <div className={`mt-4 p-4 rounded-xl text-sm font-bold flex items-center gap-3 animate-in fade-in slide-in-from-top-2 duration-300 ${
              statusMessage.type === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-red-50 text-red-700 border border-red-100'
            }`}>
              {statusMessage.type === 'success' ? <CheckCircle size={18} /> : <X size={18} />}
              {statusMessage.text}
            </div>
          )}

          <button 
            onClick={handleSave}
            className="w-full py-5 bg-[#00c896] text-white rounded-2xl font-black uppercase tracking-widest shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2 mt-4"
          >
            <CheckCircle size={20} />
            Enregistrer la Demande
          </button>
        </div>
      </div>

      {/* Historique des demandes */}
      <div className="mt-8 bg-white rounded-[2rem] overflow-hidden shadow-xl border border-gray-100">
        <div className="bg-[#121c32] p-6 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <History size={24} className="text-amber-400" />
            <h3 className="text-lg font-black uppercase tracking-tight">Historique des Demandes</h3>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-gray-50/50">
                <th className="px-6 py-4 text-[10px] font-black text-gray-600 uppercase tracking-widest">Client</th>
                <th className="px-6 py-4 text-[10px] font-black text-gray-600 uppercase tracking-widest">N° Crédit</th>
                <th className="px-6 py-4 text-[10px] font-black text-gray-600 uppercase tracking-widest">Opérateur</th>
                <th className="px-6 py-4 text-[10px] font-black text-gray-600 uppercase tracking-widest">Détails Crédit</th>
                <th className="px-6 py-4 text-[10px] font-black text-gray-600 uppercase tracking-widest">Échéance</th>
                <th className="px-6 py-4 text-[10px] font-black text-gray-600 uppercase tracking-widest">Statut</th>
                <th className="px-6 py-4 text-[10px] font-black text-gray-600 uppercase tracking-widest text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {members.some(m => m.lastCreditRequest) ? (
                members.filter(m => m.lastCreditRequest).map((m) => (
                  <tr key={m.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4">
                      <p className="text-sm font-black text-[#121c32] uppercase">{m.name}</p>
                      <p className="text-[10px] font-bold text-gray-600 uppercase tracking-tight">{m.code}</p>
                      <div className="mt-1 space-y-0.5">
                        <p className="text-[9px] font-bold text-blue-600 uppercase tracking-tight">Épargne: {m.epargneAccountNumber || '---'}</p>
                        <p className="text-[9px] font-bold text-amber-600 uppercase tracking-tight">
                          Tontine: {m.tontineAccounts?.length > 0 ? m.tontineAccounts.map(t => t.number).join(', ') : '---'}
                        </p>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-xs font-bold text-emerald-600 uppercase">{m.lastCreditRequest.creditNumber || '---'}</p>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-xs font-bold text-blue-600 uppercase">{m.lastCreditRequest.requestedBy || '---'}</p>
                    </td>
                    <td className="px-6 py-4">
                      <div className="space-y-1">
                        <p className="text-xs font-black text-emerald-600 uppercase">{m.lastCreditRequest.creditType || '---'}</p>
                        <p className="text-sm font-black text-[#121c32]">Capital: {m.lastCreditRequest.capital.toLocaleString()} F</p>
                        <div className="grid grid-cols-1 gap-0.5">
                          <p className="text-[10px] font-bold text-gray-600 uppercase tracking-tight">Intérêts: {m.lastCreditRequest.interest.toLocaleString()} F</p>
                          <p className="text-[10px] font-bold text-gray-600 uppercase tracking-tight">Frais: {m.lastCreditRequest.fees.toLocaleString()} F</p>
                          <p className="text-[10px] font-bold text-blue-600 uppercase tracking-tight">Tél Client: {m.lastCreditRequest.clientPhone || '---'}</p>
                          <p className="text-[10px] font-bold text-purple-600 uppercase tracking-tight">Caution: {m.lastCreditRequest.guarantorName || '---'} ({m.lastCreditRequest.guarantorPhone || '---'})</p>
                          <p className="text-[10px] font-bold text-gray-500 uppercase tracking-tight">Durée: {m.lastCreditRequest.duration || '---'}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-sm font-black text-[#121c32]">{new Date(m.lastCreditRequest.dueDate).toLocaleDateString()}</p>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded-lg text-[10px] font-black uppercase tracking-tight ${
                        m.lastCreditRequest.status === 'Annulé' ? 'bg-red-100 text-red-700' :
                        m.lastCreditRequest.status === 'Débloqué' ? 'bg-emerald-100 text-emerald-700' :
                        m.lastCreditRequest.status === 'Validé' ? 'bg-blue-100 text-blue-700' :
                        'bg-amber-100 text-amber-700'
                      }`}>
                        {m.lastCreditRequest.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      {m.lastCreditRequest.status === 'En attente' && (
                        <button
                          onClick={() => handleCancelRequest(m.id)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="Annuler la demande"
                        >
                          <X size={18} />
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-gray-600 italic text-sm">
                    Aucune demande enregistrée
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

export default CreditRequest;
