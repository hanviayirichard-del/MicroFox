import React, { useState, useEffect } from 'react';
import { Wallet, Calendar, AlertCircle, CheckCircle, TrendingUp, HelpCircle, RefreshCw } from 'lucide-react';
import { recordAuditLog } from '../utils/audit';
import { dispatchStorageEvent } from '../utils/events';

const VersementDuJour: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [selectedZone, setSelectedZone] = useState<string>('');
  const [zonesList, setZonesList] = useState<string[]>([]);
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [totalExpected, setTotalExpected] = useState<number>(0);
  const [actualAmount, setActualAmount] = useState<string>('');
  const [reason, setReason] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [validationInfo, setValidationInfo] = useState<any>(null);

  useEffect(() => {
    const user = localStorage.getItem('microfox_current_user');
    if (user) {
      setCurrentUser(JSON.parse(user));
    }
    loadData();

    window.addEventListener('storage', loadData);
    window.addEventListener('microfox_storage' as any, loadData);
    return () => {
      window.removeEventListener('storage', loadData);
      window.removeEventListener('microfox_storage' as any, loadData);
    };
  }, [selectedDate, selectedZone]);

  const loadData = () => {
    const savedMembers = localStorage.getItem('microfox_members_data');
    if (!savedMembers) return;

    const allMembers = JSON.parse(savedMembers);
    
    const uniqueZones = Array.from(new Set(allMembers.map((m: any) => m.zone).filter(Boolean))) as string[];
    const sortedZones = uniqueZones.sort();
    setZonesList(sortedZones);

    if (sortedZones.length > 0 && !selectedZone) {
      setSelectedZone(sortedZones[0]);
      return;
    }

    if (!selectedZone) return;

    const savedValidated = localStorage.getItem('microfox_validated_zone_cotisations');
    const validatedZones = savedValidated ? JSON.parse(savedValidated) : {};
    const validationKey = `${selectedDate}_${selectedZone}`;
    const pastValidation = validatedZones[validationKey];

    const normalizeZone = (z: string | undefined | null) => {
      if (!z) return '';
      return z.toString().toUpperCase().replace('ZONE', '').replace(/\s+/g, '').replace(/_/g, '').trim();
    };

    let sum = 0;
    allMembers.forEach((m: any) => {
      if (!m || m.isDeleted) return;
      if (normalizeZone(m.zone) !== normalizeZone(selectedZone)) return;

      let history = m.history;
      if (!Array.isArray(history)) {
        const savedHistory = localStorage.getItem(`microfox_history_${m.id}`);
        try {
          history = savedHistory ? JSON.parse(savedHistory) : [];
        } catch (err) {
          history = [];
        }
      }
      if (!Array.isArray(history)) return;

      history.forEach((tx: any) => {
        if (!tx || tx.isDeleted || tx.type === 'annulation') return;
        if ((tx.type === 'cotisation' || tx.type === 'depot' || tx.type === 'deposit') && tx.account === 'tontine') {
          let txDateString = '';
          try {
            if (tx.date) {
              if (typeof tx.date === 'string') {
                txDateString = tx.date.split('T')[0].split(' ')[0];
              } else {
                const dParsed = new Date(tx.date);
                if (!isNaN(dParsed.getTime())) {
                  const year = dParsed.getFullYear();
                  const month = String(dParsed.getMonth() + 1).padStart(2, '0');
                  const day = String(dParsed.getDate()).padStart(2, '0');
                  txDateString = `${year}-${month}-${day}`;
                }
              }
            }
          } catch (e) {}

          if (txDateString === selectedDate) {
            sum += tx.amount || 0;
          }
        }
      });
    });

    setTotalExpected(sum);

    if (pastValidation) {
      setValidationInfo(pastValidation);
      setActualAmount(pastValidation.amountReceived !== undefined ? String(pastValidation.amountReceived) : String(pastValidation.totalAmount || sum));
      setReason(pastValidation.reason || '');
    } else {
      setValidationInfo(null);
      setActualAmount('');
      setReason('');
    }
  };

  const handleValidate = () => {
    if (!selectedZone) {
      setErrorMessage("Veuillez sélectionner une zone.");
      setTimeout(() => setErrorMessage(null), 4000);
      return;
    }

    if (actualAmount === '') {
      setErrorMessage("Veuillez saisir le montant réellement apporté.");
      setTimeout(() => setErrorMessage(null), 4000);
      return;
    }

    const realAmount = Number(actualAmount);
    if (isNaN(realAmount) || realAmount < 0) {
      setErrorMessage("Montant saisi invalide.");
      setTimeout(() => setErrorMessage(null), 4000);
      return;
    }

    setIsSubmitting(true);

    setTimeout(() => {
      try {
        const savedMembers = localStorage.getItem('microfox_members_data');
        if (!savedMembers) {
          setIsSubmitting(false);
          return;
        }

        const allMembers = JSON.parse(savedMembers);
        const savedValidated = localStorage.getItem('microfox_validated_zone_cotisations') || '{}';
        const validatedZones = JSON.parse(savedValidated);
        const validationKey = `${selectedDate}_${selectedZone}`;
        const now = new Date().toISOString();

        const normalizeZone = (z: string | undefined | null) => {
          if (!z) return '';
          return z.toString().toUpperCase().replace('ZONE', '').replace(/\s+/g, '').replace(/_/g, '').trim();
        };

        let count = 0;
        const updatedMembers = allMembers.map((m: any) => {
          if (normalizeZone(m.zone) !== normalizeZone(selectedZone)) return m;

          let history = m.history;
          if (!Array.isArray(history)) {
            const savedHistory = localStorage.getItem(`microfox_history_${m.id}`);
            try {
              history = savedHistory ? JSON.parse(savedHistory) : [];
            } catch (err) {
              history = [];
            }
          }
          if (!Array.isArray(history)) return m;

          let changed = false;
          const updatedHistory = history.map((tx: any) => {
            let txDateString = '';
            try {
              if (tx.date) {
                if (typeof tx.date === 'string') {
                  txDateString = tx.date.split('T')[0].split(' ')[0];
                } else {
                  const dParsed = new Date(tx.date);
                  if (!isNaN(dParsed.getTime())) {
                    const year = dParsed.getFullYear();
                    const month = String(dParsed.getMonth() + 1).padStart(2, '0');
                    const day = String(dParsed.getDate()).padStart(2, '0');
                    txDateString = `${year}-${month}-${day}`;
                  }
                }
              }
            } catch (e) {}

            if (txDateString === selectedDate) {
              const isCotisation = (tx.type === 'cotisation' || tx.type === 'depot' || tx.type === 'deposit') && tx.account === 'tontine';
              const isVenteLivret = (tx.description && tx.description.toLowerCase().includes('livret')) || tx.account === 'epargne';
              
              if ((isCotisation || isVenteLivret) && !tx.isDeleted && tx.type !== 'annulation') {
                tx.isValidated = true;
                changed = true;
                count++;
              }
            }
            return tx;
          });

          if (changed) {
            localStorage.setItem(`microfox_history_${m.id}`, JSON.stringify(updatedHistory));
            return {
              ...m,
              history: updatedHistory
            };
          }
          return m;
        });

        const gap = realAmount - totalExpected;
        validatedZones[validationKey] = {
          validatedAt: now,
          validatedBy: currentUser?.identifiant || 'SYSTEM',
          totalAmount: totalExpected,
          amountReceived: realAmount,
          gap: gap,
          reason: reason,
          count: count
        };

        localStorage.setItem('microfox_validated_zone_cotisations', JSON.stringify(validatedZones));
        localStorage.setItem('microfox_members_data', JSON.stringify(updatedMembers));
        localStorage.setItem('microfox_pending_sync', 'true');

        recordAuditLog('MODIFICATION', 'VERSEMENT_DU_JOUR', `Validation versement du jour zone ${selectedZone} du ${selectedDate} - Total cotisations: ${totalExpected} F, Montant apporté: ${realAmount} F, Écart: ${gap} F, Raison: ${reason || 'Aucune'}`);

        const userObj = currentUser || JSON.parse(localStorage.getItem('microfox_current_user') || '{}');
        const isAuthorizedRole = userObj.role === 'admin' || userObj.role === 'administrateur' || userObj.role === 'caissier';
        if (isAuthorizedRole) {
          const txsSaved = localStorage.getItem('microfox_vault_transactions');
          const allTxs = txsSaved ? JSON.parse(txsSaved) : [];
          const newVaultTx = {
            id: `vdj_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            type: 'Versement du jour',
            amount: realAmount,
            date: now,
            cashierName: userObj.identifiant || 'VÉRIFICATEUR',
            observation: `Versement du jour Zone ${selectedZone} du ${selectedDate} - Apporté: ${realAmount} F (Écart: ${gap} F)`
          };
          localStorage.setItem('microfox_vault_transactions', JSON.stringify([newVaultTx, ...allTxs]));
        }

        dispatchStorageEvent();
        loadData();

        setSuccessMessage("Le versement de fin de journée a été validé avec succès. Les cotisations et ventes de livrets associées sont maintenant verrouillées.");
        setIsSubmitting(false);
        setTimeout(() => setSuccessMessage(null), 5000);
      } catch (error) {
        console.error(error);
        setErrorMessage("Une erreur est survenue lors de la validation du versement.");
        setIsSubmitting(false);
        setTimeout(() => setErrorMessage(null), 5000);
      }
    }, 1200);
  };

  const gap = actualAmount !== '' ? Number(actualAmount) - totalExpected : 0;

  return (
    <div className="max-w-xl mx-auto space-y-8 pb-20 animate-in fade-in duration-300">
      <div className="flex items-start gap-4">
        <div className="p-3 bg-red-100 text-[#121c32] rounded-2xl">
          <Wallet size={32} />
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl font-black text-[#121c32] uppercase tracking-tight">Versement du Jour</h1>
          <p className="text-gray-500 font-medium">Contrôler le montant réel apporté par zone et date.</p>
        </div>
      </div>

      {successMessage && (
        <div className="bg-emerald-500 text-white p-4 rounded-2xl flex items-center justify-center gap-3 shadow-lg">
          <CheckCircle size={20} />
          <span className="font-bold uppercase tracking-tight text-xs text-center">{successMessage}</span>
        </div>
      )}

      {errorMessage && (
        <div className="bg-red-500 text-white p-4 rounded-2xl flex items-center justify-center gap-3 shadow-lg">
          <AlertCircle size={20} />
          <span className="font-bold uppercase tracking-tight text-xs text-center">{errorMessage}</span>
        </div>
      )}

      <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-gray-100 space-y-6">
        
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Choisir une Date</label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
              <input 
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="w-full pl-10 pr-4 py-3 bg-gray-50 text-[#121c32] rounded-xl font-bold outline-none border border-gray-100 focus:border-red-500 transition-all text-sm"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Zone de Collecte</label>
            <select 
              value={selectedZone}
              onChange={(e) => setSelectedZone(e.target.value)}
              className="w-full px-4 py-3 bg-gray-50 border border-gray-100 text-[#121c32] rounded-xl font-bold outline-none focus:border-red-500 transition-all text-sm cursor-pointer"
            >
              {zonesList.length > 0 ? (
                zonesList.map(zone => (
                  <option key={zone} value={zone}>Zone {zone}</option>
                ))
              ) : (
                <option value="">Aucune zone disponible</option>
              )}
            </select>
          </div>
        </div>

        {validationInfo && (
          <div className="bg-emerald-50 border border-emerald-100 p-4 rounded-2xl flex items-start gap-3">
            <CheckCircle className="text-emerald-600 shrink-0 mt-0.5" size={18} />
            <div className="text-[11px] text-emerald-800 font-bold space-y-1">
              <p className="uppercase tracking-wide">Ce versement de fin de journée a été validé !</p>
              <p className="text-gray-500 font-medium normal-case">
                Validé le {new Date(validationInfo.validatedAt).toLocaleDateString()} à {new Date(validationInfo.validatedAt).toLocaleTimeString()} par <span className="font-bold">{validationInfo.validatedBy}</span>. Les transactions correspondantes sont verrouillées.
              </p>
            </div>
          </div>
        )}

        <hr className="border-gray-100" />

        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl border border-gray-100">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-red-100 text-red-600 flex items-center justify-center">
                <TrendingUp size={20} />
              </div>
              <div>
                <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest block">Total Cotisations Filtrées</span>
                <span className="text-[11px] font-bold text-gray-500 uppercase block">Annulation Cotisation</span>
              </div>
            </div>
            <span className="text-xl font-black text-[#121c32]">{totalExpected.toLocaleString()} F</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Montant Réellement Apporté</label>
              <input 
                type="number"
                min="0"
                placeholder="Ex: 250000"
                value={actualAmount}
                disabled={!!validationInfo}
                onChange={(e) => setActualAmount(e.target.value)}
                className="w-full px-4 py-3 bg-gray-50 text-[#121c32] rounded-xl font-bold outline-none border border-gray-100 focus:border-red-500 disabled:opacity-75 transition-all text-sm"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Écart Observé</label>
              <div className={`px-4 py-3.5 rounded-xl font-bold text-sm border flex items-center justify-between ${
                actualAmount === '' ? 'bg-gray-50 border-gray-100 text-gray-400' :
                gap === 0 ? 'bg-emerald-50 border-emerald-100 text-emerald-600' :
                gap > 0 ? 'bg-blue-50 border-blue-100 text-blue-600' : 'bg-red-50 border-red-100 text-red-600'
              }`}>
                <span>{actualAmount === '' ? 'En attente...' : `${gap > 0 ? '+' : ''}${gap.toLocaleString()} F`}</span>
                {actualAmount !== '' && (
                  <span className="text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md bg-white border">
                    {gap === 0 ? 'Conforme' : gap > 0 ? 'Excédent' : 'Déficit'}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Raison de l'écart</label>
            <input 
              type="text"
              placeholder="Saisissez la raison en cas d'écart..."
              value={reason}
              disabled={!!validationInfo}
              onChange={(e) => setReason(e.target.value)}
              className="w-full px-4 py-3 bg-gray-50 text-[#121c32] rounded-xl font-bold outline-none border border-gray-100 focus:border-red-500 disabled:opacity-75 transition-all text-sm uppercase placeholder:normal-case placeholder:font-medium"
            />
          </div>
        </div>

        <button
          onClick={handleValidate}
          disabled={isSubmitting || !!validationInfo || !selectedZone || actualAmount === ''}
          className={`w-full py-4 rounded-xl flex items-center justify-center gap-3 font-black uppercase tracking-widest text-xs transition-all shadow-md active:scale-95 ${
            isSubmitting ? 'bg-gray-100 text-gray-400 cursor-not-allowed' :
            validationInfo ? 'bg-emerald-50 text-emerald-500 border border-emerald-200 cursor-not-allowed' :
            (!selectedZone || actualAmount === '') ? 'bg-gray-100 text-gray-400 cursor-not-allowed' :
            'bg-[#121c32] text-white hover:bg-black/90'
          }`}
        >
          {isSubmitting ? (
            <>
              <RefreshCw size={16} className="animate-spin" />
              <span>Validation en cours...</span>
            </>
          ) : validationInfo ? (
            <>
              <CheckCircle size={16} />
              <span>Versement Déjà Validé</span>
            </>
          ) : (
            <>
              <CheckCircle size={16} />
              <span>Valider le Versement</span>
            </>
          )}
        </button>

      </div>
    </div>
  );
};

export default VersementDuJour;
