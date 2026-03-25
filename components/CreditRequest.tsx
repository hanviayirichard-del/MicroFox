import React, { useState, useEffect } from 'react';
import { 
  CreditCard, 
  Search, 
  CheckCircle,
  X,
  FileText,
  History
} from 'lucide-react';

const CreditRequest: React.FC = () => {
  const [members, setMembers] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedMemberId, setSelectedMemberId] = useState('');
  const [amount, setAmount] = useState('');
  const [interest, setInterest] = useState('');
  const [fees, setFees] = useState('');
  const [penalty, setPenalty] = useState('');
  const [dueDate, setDueDate] = useState('');

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
    return () => window.removeEventListener('storage', loadData);
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

  const handleSave = () => {
    if (!selectedMemberId || !amount) return alert("Veuillez remplir les champs obligatoires.");

    const saved = localStorage.getItem('microfox_members_data');
    let clients = saved ? JSON.parse(saved) : members;

    const updatedClients = clients.map((c: any) => {
      if (c.id === selectedMemberId) {
        let fullHistory = c.history || [];
        if (fullHistory.length === 0) {
          const savedHistory = localStorage.getItem(`microfox_history_${c.id}`);
          if (savedHistory) fullHistory = JSON.parse(savedHistory);
        }

        const newTx = {
          id: Date.now().toString(),
          type: 'deblocage',
          account: 'credit',
          amount: Number(amount),
          date: new Date().toISOString(),
          description: `Demande de crédit enregistrée - Échéance: ${dueDate}`
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
            penalty: Number(penalty),
            dueDate: dueDate,
            status: 'En attente'
          }
        };
      }
      return c;
    });
    
    localStorage.setItem('microfox_members_data', JSON.stringify(updatedClients));
    setMembers(updatedClients);
    localStorage.setItem('microfox_pending_sync', 'true');
    window.dispatchEvent(new Event('storage'));
    alert("Demande de crédit enregistrée avec succès.");
    
    // Reset form
    setSelectedMemberId('');
    setAmount('');
    setInterest('');
    setFees('');
    setPenalty('');
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
            <select 
              value={selectedMemberId} 
              onChange={(e) => setSelectedMemberId(e.target.value)}
              className="w-full p-4 bg-gray-50 border border-gray-200 rounded-2xl outline-none focus:border-[#00c896] font-bold text-black"
            >
              <option value="">-- Choisir un client --</option>
              {filteredMembers.map(m => (
                <option key={m.id} value={m.id}>{m.name} ({m.code})</option>
              ))}
            </select>
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
              <label className="text-[11px] font-black text-gray-600 uppercase tracking-widest">Pénalité (F)</label>
              <input 
                type="number" 
                value={penalty} 
                onChange={(e) => setPenalty(e.target.value)}
                placeholder="0"
                className="w-full p-4 bg-gray-50 border border-gray-200 rounded-2xl outline-none focus:border-[#00c896] font-bold text-black"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[11px] font-black text-gray-600 uppercase tracking-widest">Échéance</label>
              <input 
                type="date" 
                value={dueDate} 
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full p-4 bg-gray-50 border border-gray-200 rounded-2xl outline-none focus:border-[#00c896] font-bold text-black"
              />
            </div>
          </div>

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
                <th className="px-6 py-4 text-[10px] font-black text-gray-600 uppercase tracking-widest">Détails Crédit</th>
                <th className="px-6 py-4 text-[10px] font-black text-gray-600 uppercase tracking-widest">Échéance</th>
                <th className="px-6 py-4 text-[10px] font-black text-gray-600 uppercase tracking-widest">Statut</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {members.some(m => m.lastCreditRequest) ? (
                members.filter(m => m.lastCreditRequest).map((m) => (
                  <tr key={m.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4">
                      <p className="text-sm font-black text-[#121c32] uppercase">{m.name}</p>
                      <p className="text-[10px] font-bold text-gray-600 uppercase tracking-tight">{m.code}</p>
                    </td>
                    <td className="px-6 py-4">
                      <div className="space-y-1">
                        <p className="text-sm font-black text-[#121c32]">Capital: {m.lastCreditRequest.capital.toLocaleString()} F</p>
                        <div className="grid grid-cols-1 gap-0.5">
                          <p className="text-[10px] font-bold text-gray-600 uppercase tracking-tight">Intérêts: {m.lastCreditRequest.interest.toLocaleString()} F</p>
                          <p className="text-[10px] font-bold text-gray-600 uppercase tracking-tight">Frais: {m.lastCreditRequest.fees.toLocaleString()} F</p>
                          <p className="text-[10px] font-bold text-gray-600 uppercase tracking-tight">Pénalité: {m.lastCreditRequest.penalty.toLocaleString()} F</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-sm font-black text-[#121c32]">{new Date(m.lastCreditRequest.dueDate).toLocaleDateString()}</p>
                    </td>
                    <td className="px-6 py-4">
                      <span className="px-2 py-1 bg-amber-100 text-amber-700 rounded-lg text-[10px] font-black uppercase tracking-tight">
                        {m.lastCreditRequest.status}
                      </span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center text-gray-600 italic text-sm">
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
