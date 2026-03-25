import React, { useState, useEffect } from 'react';
import { 
  Bell, 
  Clock, 
  AlertCircle, 
  CheckCircle, 
  Wallet, 
  ShieldCheck, 
  Landmark,
  ArrowRight,
  Info
} from 'lucide-react';

interface Notification {
  id: string;
  type: 'warning' | 'info' | 'success' | 'error';
  title: string;
  message: string;
  date: string;
  role: string[];
  action?: string;
}

const Notifications: React.FC = () => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [currentUser, setCurrentUser] = useState<any>(null);

  const loadNotifications = () => {
    const userStr = localStorage.getItem('microfox_current_user');
    if (!userStr) return;
    const user = JSON.parse(userStr);
    setCurrentUser(user);

    const newNotifications: Notification[] = [];
    const now = new Date().toISOString();

    // 1. Agent Commercial Notifications
    if (user.role === 'agent commercial') {
      const agentBalanceKey = `microfox_agent_balance_${user.id}`;
      const balance = Number(localStorage.getItem(agentBalanceKey) || 0);
      if (balance > 0) {
        newNotifications.push({
          id: 'agent_pending_deposit',
          type: 'warning',
          title: 'Versement en attente',
          message: `Vous avez un solde de ${balance.toLocaleString()} F collecté qui n'a pas encore été versé à la caisse.`,
          date: now,
          role: ['agent commercial'],
          action: 'Versements Agents'
        });
      }
    }

    // 2. Auditeur / Contrôleur Notifications
    if (user.role === 'auditeur' || user.role === 'contrôleur' || user.role === 'administrateur') {
      const savedRequests = localStorage.getItem('microfox_pending_withdrawals');
      if (savedRequests) {
        const pending = JSON.parse(savedRequests).filter((r: any) => !r.isDeleted && r.status === 'En attente');
        if (pending.length > 0) {
          newNotifications.push({
            id: 'pending_verifications',
            type: 'info',
            title: 'Vérifications en attente',
            message: `Il y a ${pending.length} demande(s) de retrait tontine en attente de vérification.`,
            date: now,
            role: ['auditeur', 'contrôleur', 'administrateur'],
            action: 'Vérification de retrait tontine'
          });
        }
      }
    }

    // 3. Caissier Notifications
    if (user.role === 'caissier' || user.role === 'administrateur' || user.role === 'directeur') {
      // Tontine withdrawals to disburse
      const savedValidated = localStorage.getItem('microfox_validated_withdrawals');
      if (savedValidated) {
        const validated = JSON.parse(savedValidated).filter((r: any) => !r.isDeleted && r.status === 'Validé' && !r.isDisbursed);
        if (validated.length > 0) {
          newNotifications.push({
            id: 'pending_disbursements',
            type: 'info',
            title: 'Décaissements en attente',
            message: `Il y a ${validated.length} retrait(s) tontine validé(s) en attente de décaissement.`,
            date: now,
            role: ['caissier', 'administrateur', 'directeur'],
            action: 'CAISSE PRINCIPALE'
          });
        }
      }

      // Agent payments to validate
      const savedPayments = localStorage.getItem('microfox_agent_payments');
      if (savedPayments) {
        const pendingPayments = JSON.parse(savedPayments).filter((p: any) => p.status === 'En attente');
        if (pendingPayments.length > 0) {
          newNotifications.push({
            id: 'pending_agent_payments',
            type: 'warning',
            title: 'Versements agents à valider',
            message: `Il y a ${pendingPayments.length} versement(s) d'agents en attente de validation.`,
            date: now,
            role: ['caissier', 'administrateur', 'directeur'],
            action: 'Gestion Caisse'
          });
        }
      }

      // Own balance to transfer (for non-main caisses)
      if (user.role === 'caissier' && user.caisse && user.caisse !== 'CAISSE PRINCIPALE') {
        const balanceKey = `microfox_cash_balance_${user.caisse}`;
        const balance = Number(localStorage.getItem(balanceKey) || 0);
        if (balance > 0) {
          newNotifications.push({
            id: 'cashier_pending_transfer',
            type: 'warning',
            title: 'Solde caisse à verser',
            message: `Votre caisse (${user.caisse}) a un solde de ${balance.toLocaleString()} F qui doit être versé à la caisse principale ou au coffre.`,
            date: now,
            role: ['caissier'],
            action: 'Gestion Caisse'
          });
        }
      }
    }

    setNotifications(newNotifications);
  };

  useEffect(() => {
    loadNotifications();
    window.addEventListener('storage', loadNotifications);
    const interval = setInterval(loadNotifications, 10000);
    return () => {
      window.removeEventListener('storage', loadNotifications);
      clearInterval(interval);
    };
  }, []);

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-20">
      <div className="flex items-start gap-4">
        <div className="p-3 bg-blue-100 text-blue-600 rounded-2xl">
          <Bell size={32} />
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl font-black text-[#121c32] uppercase tracking-tight">Centre de Notifications</h1>
          <p className="text-gray-500 font-medium">Suivez les opérations en attente qui nécessitent votre attention.</p>
        </div>
      </div>

      <div className="space-y-4">
        {notifications.length > 0 ? (
          notifications.map((n) => (
            <div 
              key={n.id} 
              className={`p-6 rounded-[2rem] border transition-all hover:shadow-md flex items-start gap-4 ${
                n.type === 'warning' ? 'bg-amber-50 border-amber-100' :
                n.type === 'info' ? 'bg-blue-50 border-blue-100' :
                n.type === 'success' ? 'bg-emerald-50 border-emerald-100' :
                'bg-red-50 border-red-100'
              }`}
            >
              <div className={`p-3 rounded-xl ${
                n.type === 'warning' ? 'bg-amber-100 text-amber-600' :
                n.type === 'info' ? 'bg-blue-100 text-blue-600' :
                n.type === 'success' ? 'bg-emerald-100 text-emerald-600' :
                'bg-red-100 text-red-600'
              }`}>
                {n.type === 'warning' && <AlertCircle size={24} />}
                {n.type === 'info' && <Info size={24} />}
                {n.type === 'success' && <CheckCircle size={24} />}
                {n.type === 'error' && <AlertCircle size={24} />}
              </div>
              
              <div className="flex-1 space-y-1">
                <div className="flex items-center justify-between">
                  <h3 className={`text-sm font-black uppercase tracking-widest ${
                    n.type === 'warning' ? 'text-amber-900' :
                    n.type === 'info' ? 'text-blue-900' :
                    n.type === 'success' ? 'text-emerald-900' :
                    'text-red-900'
                  }`}>
                    {n.title}
                  </h3>
                  <span className="text-[10px] font-bold text-gray-400 uppercase">
                    {new Date(n.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <p className="text-sm font-medium text-gray-600 leading-relaxed">
                  {n.message}
                </p>
                {n.action && (
                  <div className="pt-3">
                    <button 
                      className={`flex items-center gap-2 text-[10px] font-black uppercase tracking-widest transition-all hover:gap-3 ${
                        n.type === 'warning' ? 'text-amber-600' :
                        n.type === 'info' ? 'text-blue-600' :
                        n.type === 'success' ? 'text-emerald-600' :
                        'text-red-600'
                      }`}
                    >
                      Aller à l'opération <ArrowRight size={14} />
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))
        ) : (
          <div className="bg-white p-12 rounded-[2.5rem] border border-gray-100 text-center space-y-4">
            <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mx-auto text-gray-200">
              <Bell size={40} />
            </div>
            <div className="space-y-1">
              <h3 className="text-lg font-black text-[#121c32] uppercase tracking-tight">Aucune notification</h3>
              <p className="text-gray-400 text-sm font-medium">Vous êtes à jour dans toutes vos opérations.</p>
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-[2rem] border border-gray-100 shadow-sm space-y-4">
          <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center">
            <Wallet size={24} />
          </div>
          <h4 className="text-xs font-black text-[#121c32] uppercase tracking-widest">Collecte Terrain</h4>
          <p className="text-[10px] text-gray-500 font-medium leading-relaxed">
            Les agents commerciaux reçoivent des alertes si leur solde collecté n'est pas versé avant la fin de journée.
          </p>
        </div>

        <div className="bg-white p-6 rounded-[2rem] border border-gray-100 shadow-sm space-y-4">
          <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center">
            <ShieldCheck size={24} />
          </div>
          <h4 className="text-xs font-black text-[#121c32] uppercase tracking-widest">Contrôle & Audit</h4>
          <p className="text-[10px] text-gray-500 font-medium leading-relaxed">
            Les auditeurs sont notifiés dès qu'une demande de retrait tontine est soumise pour vérification.
          </p>
        </div>

        <div className="bg-white p-6 rounded-[2rem] border border-gray-100 shadow-sm space-y-4">
          <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center">
            <Landmark size={24} />
          </div>
          <h4 className="text-xs font-black text-[#121c32] uppercase tracking-widest">Gestion Caisse</h4>
          <p className="text-[10px] text-gray-500 font-medium leading-relaxed">
            Les caissiers voient les versements agents à valider et les retraits clients à décaisser en temps réel.
          </p>
        </div>
      </div>
    </div>
  );
};

export default Notifications;
