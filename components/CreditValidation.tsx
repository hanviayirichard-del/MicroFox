import React, { useState, useEffect } from 'react';
import { dispatchStorageEvent } from '../utils/events';
import { 
  Search, 
  CheckCircle,
  History as HistoryIcon,
  ShieldCheck,
  X,
  FileCheck
} from 'lucide-react';
import ConfirmModal from './ConfirmModal';

const CreditValidation: React.FC = () => {
  const [members, setMembers] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
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
    window.addEventListener('microfox_storage' as any, loadData);
    return () => window.removeEventListener('storage', loadData);
      window.removeEventListener('microfox_storage' as any, loadData);
  }, []);

  const pendingRequests = members.filter(m => 
    m.lastCreditRequest && m.lastCreditRequest.status === 'En attente'
  ).filter(m => {
    const search = searchTerm.toLowerCase();
    return m.name.toLowerCase().includes(search) || m.code.toLowerCase().includes(search);
  });

  const handleValidate = (memberId: string) => {
    const currentUser = JSON.parse(localStorage.getItem('microfox_current_user') || '{}');
    if (!['administrateur', 'directeur'].includes(currentUser.role)) {
      showAlert("Accès refusé", "Seul l'administrateur ou le directeur peut valider une demande de crédit.", "error");
      return;
    }

    showConfirm(
      "Validation de crédit",
      "Voulez-vous vraiment valider cette demande de crédit ?",
      () => {
        const saved = localStorage.getItem('microfox_members_data');
        let clients = saved ? JSON.parse(saved) : [];
        
        const updatedClients = clients.map((c: any) => {
          if (c.id === memberId) {
            let fullHistory = c.history || [];
            if (fullHistory.length === 0) {
              const savedHistory = localStorage.getItem(`microfox_history_${c.id}`);
              if (savedHistory) fullHistory = JSON.parse(savedHistory);
            }

            const newTx = {
              id: `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
              type: 'validation',
              account: 'credit',
              amount: c.lastCreditRequest.capital,
              date: new Date().toISOString(),
              description: `Demande de crédit validée par ${currentUser.identifiant || 'Inconnu'}`,
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
                status: 'Validé',
                validatedBy: currentUser.identifiant || 'Inconnu',
                validationDate: new Date().toISOString()
              }
            };
          }
          return c;
        });

        localStorage.setItem('microfox_members_data', JSON.stringify(updatedClients));
        localStorage.setItem('microfox_pending_sync', 'true');
        dispatchStorageEvent();
        loadData();
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
        showAlert("Succès", "Demande de crédit validée avec succès.", "success");
      }
    );
  };

  const handleCancelRequest = (memberId: string) => {
    const currentUser = JSON.parse(localStorage.getItem('microfox_current_user') || '{}');
    if (!['administrateur', 'directeur'].includes(currentUser.role)) {
      showAlert("Accès refusé", "Seul l'administrateur ou le directeur peut annuler une demande de crédit.", "error");
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
        dispatchStorageEvent();
        loadData();
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
        showAlert("Succès", "Demande de crédit annulée avec succès.", "success");
      }
    );
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-amber-100 text-amber-600 rounded-2xl">
            <FileCheck size={32} />
          </div>
          <div>
            <h1 className="text-2xl font-black text-[#121c32] uppercase tracking-tight">Validation de Crédit</h1>
            <p className="text-gray-700 text-sm font-medium mt-1">Approbation ou annulation des demandes en attente</p>
          </div>
        </div>
        <div className="relative w-full md:w-96">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-600" size={20} />
          <input 
            type="text" 
            placeholder="Rechercher une demande..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-12 pr-4 py-3 bg-white border border-gray-200 rounded-2xl outline-none focus:border-amber-500 font-medium transition-all shadow-sm text-[#121c32]"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {pendingRequests.length > 0 ? (
          pendingRequests.map((m, idx) => (
            <div key={`${m.id}-${idx}`} className="bg-white rounded-[2rem] p-6 border border-gray-100 shadow-sm hover:shadow-md transition-all">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-2xl bg-[#121c32] text-white flex items-center justify-center font-black text-lg">
                    {m.name.split(' ').map((n: string) => n[0]).join('')}
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-[#121c32] uppercase">{m.name}</h3>
                    <p className="text-xs font-bold text-gray-600 uppercase tracking-widest">{m.code}</p>
                    <div className="mt-2 space-y-1">
                      <p className="text-[10px] font-bold text-blue-600 uppercase tracking-tight">Épargne: {m.epargneAccountNumber || '---'}</p>
                      <p className="text-[10px] font-bold text-amber-600 uppercase tracking-tight">
                        Tontine: {m.tontineAccounts?.length > 0 ? m.tontineAccounts.map((t: any) => t.number).join(', ') : '---'}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-7 gap-4 flex-1 lg:px-8 border-l border-gray-100 lg:ml-6">
                  <div>
                    <p className="text-[9px] font-black text-gray-500 uppercase tracking-widest mb-1">Capital</p>
                    <p className="text-sm font-black text-[#121c32]">{m.lastCreditRequest.capital.toLocaleString()} F</p>
                  </div>
                  <div>
                    <p className="text-[9px] font-black text-gray-500 uppercase tracking-widest mb-1">Intérêt</p>
                    <p className="text-sm font-black text-emerald-600">{(m.lastCreditRequest.interest || 0).toLocaleString()} F</p>
                  </div>
                  <div>
                    <p className="text-[9px] font-black text-gray-500 uppercase tracking-widest mb-1">Type</p>
                    <p className="text-[11px] font-black text-emerald-600 uppercase leading-none">{m.lastCreditRequest.creditType || '---'}</p>
                  </div>
                  <div>
                    <p className="text-[9px] font-black text-gray-500 uppercase tracking-widest mb-1">Demandé par</p>
                    <p className="text-[11px] font-black text-blue-600 uppercase leading-none">{m.lastCreditRequest.requestedBy || '---'}</p>
                  </div>
                  <div>
                    <p className="text-[9px] font-black text-gray-500 uppercase tracking-widest mb-1">Déblocage</p>
                    <p className="text-sm font-black text-purple-600">{m.lastCreditRequest.unlockDate ? new Date(m.lastCreditRequest.unlockDate).toLocaleDateString() : '---'}</p>
                  </div>
                  <div>
                    <p className="text-[9px] font-black text-gray-500 uppercase tracking-widest mb-1">Échéance</p>
                    <p className="text-sm font-black text-rose-600">{new Date(m.lastCreditRequest.dueDate).toLocaleDateString()}</p>
                  </div>
                  <div>
                    <p className="text-[9px] font-black text-gray-500 uppercase tracking-widest mb-1">Durée</p>
                    <p className="text-[11px] font-black text-gray-700 uppercase leading-none">{m.lastCreditRequest.duration || '---'}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button 
                    onClick={() => handleCancelRequest(m.id)}
                    className="px-6 py-4 bg-red-50 text-red-600 hover:bg-red-100 rounded-2xl font-black uppercase tracking-widest text-xs transition-all flex items-center gap-2"
                  >
                    <X size={18} />
                    Annuler
                  </button>
                  <button 
                    onClick={() => handleValidate(m.id)}
                    className="px-8 py-4 bg-amber-500 text-white rounded-2xl font-black uppercase tracking-widest shadow-lg hover:bg-amber-600 transition-all flex items-center justify-center gap-2"
                  >
                    <ShieldCheck size={20} />
                    Valider
                  </button>
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="bg-white rounded-[2.5rem] p-20 text-center border border-dashed border-gray-200">
            <div className="w-20 h-20 bg-gray-50 text-gray-500 rounded-full flex items-center justify-center mx-auto mb-6">
              <FileCheck size={40} />
            </div>
            <h3 className="text-xl font-black text-gray-600 uppercase tracking-tight">Aucune demande à valider</h3>
            <p className="text-gray-600 text-sm mt-2">Les nouvelles demandes de crédit apparaîtront ici pour approbation.</p>
          </div>
        )}
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

export default CreditValidation;
