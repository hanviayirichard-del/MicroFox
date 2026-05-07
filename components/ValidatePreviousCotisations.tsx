import React, { useState, useEffect } from 'react';
import { dispatchStorageEvent } from '../utils/events';
import { Clock, Search, MapPin, CheckCircle, AlertCircle, ChevronRight, Users, TrendingUp, Printer, Download, ChevronDown } from 'lucide-react';
import { recordAuditLog } from '../utils/audit';

interface ZoneCotisation {
  zone: string;
  totalAmount: number;
  count: number;
  transactions: any[];
  isValidated: boolean;
}

const ALL_ZONES = ['01', '01A', '02', '02A', '03', '03A', '04', '04A', '05', '05A', '06', '06A', '07', '07A', '08', '08A', '09', '09A'];

const ValidatePreviousCotisations: React.FC = () => {
  const [zones] = useState<string[]>(ALL_ZONES);
  const [zoneStatuses, setZoneStatuses] = useState<Record<string, 'pending' | 'validated' | 'none'>>({});
  const [pendingCotisations, setPendingCotisations] = useState<any[]>([]);
  const [selectedZone, setSelectedZone] = useState<string>('');
  const [zoneData, setZoneData] = useState<ZoneCotisation | null>(null);
  const [loading, setLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [mfConfig] = useState(() => {
    const saved = localStorage.getItem('microfox_mf_config');
    return saved ? JSON.parse(saved) : { nom: 'MicroFox', adresse: '', telephone: '' };
  });

  useEffect(() => {
    loadZones();
    window.addEventListener('storage', loadZones);
    window.addEventListener('microfox_storage' as any, loadZones);
    const interval = setInterval(loadZones, 3000);
    return () => {
      window.removeEventListener('storage', loadZones);
      window.removeEventListener('microfox_storage' as any, loadZones);
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    if (selectedZone) {
      loadZoneDetails(selectedZone);
    } else {
      setZoneData(null);
    }
  }, [selectedZone]);

  const loadZones = () => {
    const savedMembers = localStorage.getItem('microfox_members_data');
    const savedValidated = localStorage.getItem('microfox_validated_zone_cotisations');
    const validatedZones = savedValidated ? JSON.parse(savedValidated) : {};
    const today = new Date().toISOString().split('T')[0];

    if (savedMembers) {
      const members = JSON.parse(savedMembers);

      const statuses: Record<string, 'pending' | 'validated' | 'none'> = {};
      const allPending: any[] = [];

      ALL_ZONES.forEach(zone => {
        const zoneMembers = members.filter((m: any) => m.zone === zone);
        let hasAnyPendingPrevious = false;

        zoneMembers.forEach((m: any) => {
          const savedHistory = localStorage.getItem(`microfox_history_${m.id}`);
          const history = savedHistory ? JSON.parse(savedHistory) : (m.history || []);
          
          history.forEach((tx: any) => {
            if (tx.isDeleted || tx.type === 'annulation') return;
            
            if (tx.type === 'cotisation' && tx.account === 'tontine') {
              const txDate = new Date(tx.date);
              const txDay = txDate.toISOString().split('T')[0];
              
              // Only interested in previous days
              if (txDay >= today) return;

              const validationKey = `${txDay}_${zone}`;
              const zoneValidation = validatedZones[validationKey];
              const isTxValidated = zoneValidation && txDate.getTime() <= new Date(zoneValidation.validatedAt).getTime();

              if (!isTxValidated) {
                hasAnyPendingPrevious = true;
                allPending.push({
                   ...tx,
                   zone,
                   memberName: m.name,
                   memberCode: m.code
                });
              }
            }
          });
        });

        statuses[zone] = hasAnyPendingPrevious ? 'pending' : 'none';
      });
      setZoneStatuses(statuses);
      setPendingCotisations(allPending);
    }
  };

  const loadZoneDetails = (zoneName: string) => {
    setLoading(true);
    try {
      const savedMembers = localStorage.getItem('microfox_members_data');
      const savedValidated = localStorage.getItem('microfox_validated_zone_cotisations');
      const validatedZones = savedValidated ? JSON.parse(savedValidated) : {};
      
      const today = new Date().toISOString().split('T')[0];

      if (savedMembers) {
        const members = JSON.parse(savedMembers);
        const zoneMembers = members.filter((m: any) => m.zone === zoneName);
        
        let total = 0;
        let count = 0;
        const transactions: any[] = [];

        zoneMembers.forEach((m: any) => {
          const savedHistory = localStorage.getItem(`microfox_history_${m.id}`);
          const history = savedHistory ? JSON.parse(savedHistory) : (m.history || []);
          
          history.forEach((tx: any) => {
            if (tx.isDeleted || tx.type === 'annulation') return;
            
            if (tx.type === 'cotisation' && tx.account === 'tontine') {
              const txDate = new Date(tx.date);
              const txDay = txDate.toISOString().split('T')[0];
              
              // Only interested in previous days
              if (txDay >= today) return;

              const validationKey = `${txDay}_${zoneName}`;
              const zoneValidation = validatedZones[validationKey];
              const isTxValidated = zoneValidation && txDate.getTime() <= new Date(zoneValidation.validatedAt).getTime();

              if (!isTxValidated) {
                total += tx.amount;
                count++;
                transactions.push({
                  ...tx,
                  memberName: m.name,
                  memberCode: m.code,
                  dailyMise: tx.dailyMise || (m.tontineAccounts?.find((acc: any) => acc.number === (tx.tontineAccountNumber || (m.tontineAccounts && m.tontineAccounts[0]?.number)))?.dailyMise) || (m.tontineAccounts && m.tontineAccounts[0]?.dailyMise) || 0,
                  epargneAccountNumber: m.epargneAccountNumber || 'N/A',
                  tontineAccountNumber: tx.tontineAccountNumber || (m.tontineAccounts && m.tontineAccounts[0]?.number) || 'N/A',
                  hasActiveCredit: (m.balances?.credit || 0) > 0,
                  isValidated: isTxValidated
                });
              }
            }
          });
        });

        const sortedTransactions = transactions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        
        setZoneData({
          zone: zoneName,
          totalAmount: total,
          count: count,
          transactions: sortedTransactions,
          isValidated: transactions.length === 0 // If no transactions found, it's "validated" in sense of fully processed
        });
      }
    } catch (error) {
      console.error("Error loading zone details:", error);
      setErrorMessage("Erreur lors du chargement des détails de la zone.");
    } finally {
      setLoading(false);
    }
  };

  const handleValidate = () => {
    if (!zoneData || zoneData.isValidated) return;

    if (zoneData.transactions.length === 0) {
      setErrorMessage("Aucune cotisation à valider pour cette zone.");
      setTimeout(() => setErrorMessage(null), 5000);
      return;
    }

    try {
      const savedValidated = localStorage.getItem('microfox_validated_zone_cotisations');
      const validatedZones = savedValidated ? JSON.parse(savedValidated) : {};
      
      const maxTxDate = zoneData.transactions.reduce((max, tx) => {
        return tx.date > max ? tx.date : max;
      }, "");
      
      const now = new Date().toISOString();
      const validationTimestamp = (maxTxDate && maxTxDate > now) ? maxTxDate : now;
      
      const currentUser = JSON.parse(localStorage.getItem('microfox_current_user') || '{}').identifiant;

      const pendingByDay: Record<string, { total: number, count: number }> = {};
      
      zoneData.transactions.forEach(tx => {
        if (!tx.isValidated) {
          const day = new Date(tx.date).toISOString().split('T')[0];
          if (!pendingByDay[day]) {
            pendingByDay[day] = { total: 0, count: 0 };
          }
          pendingByDay[day].total += tx.amount;
          pendingByDay[day].count += 1;
        }
      });

      Object.keys(pendingByDay).forEach(day => {
        const validationKey = `${day}_${zoneData.zone}`;
        const prevTotal = validatedZones[validationKey]?.totalAmount || 0;
        const prevCount = validatedZones[validationKey]?.count || 0;

        validatedZones[validationKey] = {
          validatedAt: validationTimestamp,
          validatedBy: currentUser,
          totalAmount: prevTotal + pendingByDay[day].total,
          count: prevCount + pendingByDay[day].count
        };
      });

      localStorage.setItem('microfox_validated_zone_cotisations', JSON.stringify(validatedZones));
      
      recordAuditLog('MODIFICATION', 'TONTINE', `Validation des cotisations ANTÉRIEURES de la zone ${zoneData.zone} - Total validé: ${zoneData.totalAmount} F (${zoneData.count} cotisations)`);

      setSuccessMessage(`Cotisations antérieures de la zone ${zoneData.zone} validées avec succès !`);
      setZoneData({ 
        ...zoneData, 
        isValidated: true,
        transactions: zoneData.transactions.map(tx => ({ ...tx, isValidated: true }))
      });
      loadZones();
      setTimeout(() => setSuccessMessage(null), 4000);
      
      dispatchStorageEvent();
    } catch (error) {
      setErrorMessage("Une erreur est survenue lors de la validation.");
      setTimeout(() => setErrorMessage(null), 5000);
    }
  };

  const handlePrint = () => {
    if (!zoneData || zoneData.transactions.length === 0) return;

    const agentNames = Array.from(new Set(zoneData.transactions.map(tx => tx.cashierName).filter(Boolean))) as string[];
    const agentsList = agentNames.length > 0 ? agentNames.join(", ") : "N/A";

    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Rapport Cotisations Antérieures - Zone ${zoneData.zone}</title>
        <style>
          body { font-family: sans-serif; padding: 20px; color: #121c32; }
          .header { border-bottom: 2px solid #121c32; padding-bottom: 10px; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: flex-start; }
          .header h1 { margin: 0; text-transform: uppercase; font-size: 20px; }
          .mf-info { font-size: 12px; font-weight: bold; }
          .info { margin-bottom: 15px; }
          .info p { margin: 2px 0; font-size: 13px; }
          table { width: 100%; border-collapse: collapse; margin-top: 10px; }
          th, td { border: 1px solid #e5e7eb; padding: 4px 8px; text-align: left; font-size: 10px; }
          th { background-color: #f9fafb; font-weight: bold; text-transform: uppercase; }
          .text-right { text-align: right; }
          .credit-mention { color: #ef4444; font-weight: bold; font-size: 8px; }
          .footer { margin-top: 20px; border-top: 1px solid #121c32; padding-top: 10px; font-size: 12px; }
          .signatures { display: flex; justify-content: space-between; margin-top: 20px; }
          .signature-box { width: 200px; border-top: 1px dashed #000; margin-top: 30px; text-align: center; font-size: 10px; }
          @media print {
            body { padding: 0; }
            .no-print { display: none; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div>
            <h1>${mfConfig.nom || 'MicroFox'}</h1>
            <p class="mf-info">${mfConfig.adresse || ''}</p>
            <p class="mf-info">${mfConfig.telephone || ''}</p>
            <h2 style="margin-top: 10px; font-size: 16px; text-decoration: underline;">RAPPORT DE ZONE - JOURS ANTÉRIEURS</h2>
          </div>
          <div class="text-right">
            <strong>Total: ${zoneData.totalAmount.toLocaleString()} F</strong><br>
            Nombre: ${zoneData.count}
          </div>
        </div>
        <div class="info">
          <p><strong>Zone:</strong> ${zoneData.zone}</p>
          <p><strong>Date Impression:</strong> ${new Date().toLocaleDateString()}</p>
          <p><strong>Agent(s):</strong> ${agentsList}</p>
        </div>
        <table>
          <thead>
            <tr>
              <th>Date / Heure</th>
              <th>Client</th>
              <th>Tontine / Épargne</th>
              <th>Agent</th>
              <th>Mise</th>
              <th class="text-right">Montant</th>
            </tr>
          </thead>
          <tbody>
            ${zoneData.transactions.map(tx => {
              const txDate = new Date(tx.date);
              return `
              <tr>
                <td>
                  <div style="font-size: 8px; color: #3b82f6; font-weight: bold;">${txDate.toLocaleDateString()}</div>
                  ${txDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </td>
                <td>
                  <strong>${tx.memberName.toUpperCase()}</strong>
                  ${tx.hasActiveCredit ? '<br/><span class="credit-mention">CRÉDIT EN COURS</span>' : ''}
                </td>
                <td>
                  T: ${tx.tontineAccountNumber}<br/>
                  É: ${tx.epargneAccountNumber}
                </td>
                <td>${(tx.cashierName || 'N/A').toUpperCase()}</td>
                <td><strong>${(tx.dailyMise || 0).toLocaleString()} F</strong></td>
                <td class="text-right"><strong>${tx.amount.toLocaleString()} F</strong></td>
              </tr>
            `}).join('')}
          </tbody>
        </table>
        
        <div class="footer">
          <div class="signatures">
            <div>
              <p><strong>Agent Commercial:</strong> ${agentsList}</p>
              <div class="signature-box">Signature Agent</div>
            </div>
            <div class="text-right">
              <p><strong>Caisse / Responsable:</strong></p>
              <div class="signature-box">Signature Responsable</div>
            </div>
          </div>
          <p style="margin-top: 40px; font-style: italic; font-size: 9px;">Imprimé le ${new Date().toLocaleString()}</p>
        </div>
        <script>
          window.onload = () => {
            window.print();
            setTimeout(() => window.close(), 500);
          };
        </script>
      </body>
      </html>
    `;

    printWindow.document.write(htmlContent);
    printWindow.document.close();
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-12">
      <div className="flex justify-between items-start">
        <div className="flex items-start gap-3">
          <div className="mt-1 text-blue-600">
            <Clock size={28} />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold text-[#121c32] uppercase tracking-tight leading-tight">
              Validation Cotisations<br />Jours Antérieures
            </h1>
            <p className="text-gray-500 font-medium text-sm mt-1">Valider les collectes des jours passés non encore validées</p>
          </div>
        </div>
      </div>

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

      <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-gray-100 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-black text-[#121c32] uppercase tracking-tight flex items-center gap-2">
            <AlertCircle size={18} className="text-amber-500" />
            Cotisations antérieures en attente
          </h2>
          <div className="flex items-center gap-2">
            <div className="px-3 py-1 bg-amber-50 text-amber-600 rounded-full text-[10px] font-black uppercase tracking-widest border border-amber-100">
              {pendingCotisations.length} Cotisation(s)
            </div>
            <div className="px-3 py-1 bg-gray-50 text-gray-600 rounded-full text-[10px] font-black uppercase tracking-widest border border-gray-100">
              {Object.values(zoneStatuses).filter(s => s === 'pending').length} Zone(s)
            </div>
          </div>
        </div>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {zones.map(zone => {
            const status = zoneStatuses[zone];
            if (status !== 'pending') return null;
            
            const zonePending = pendingCotisations.filter(p => p.zone === zone);
            const pendingAmount = zonePending.reduce((sum, p) => sum + p.amount, 0);
            
            return (
              <button
                key={zone}
                onClick={() => setSelectedZone(zone)}
                className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl border border-gray-100 hover:border-amber-200 hover:bg-amber-50/30 transition-all group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-amber-500 shadow-sm border border-amber-50 border-dashed">
                    <MapPin size={20} />
                  </div>
                  <div className="text-left">
                    <p className="text-xs font-black text-[#121c32] uppercase">{zone}</p>
                    <p className="text-[10px] font-bold text-amber-600">{pendingAmount.toLocaleString()} F • {zonePending.length} cotis.</p>
                  </div>
                </div>
                <ChevronRight size={16} className="text-gray-300 group-hover:text-amber-400 group-hover:translate-x-1 transition-all" />
              </button>
            );
          })}
          {pendingCotisations.length === 0 && (
            <div className="col-span-full py-6 text-center bg-gray-50 rounded-2xl border border-dashed border-gray-200">
              <p className="text-xs font-bold text-gray-400 italic">Toutes les cotisations des jours antérieurs sont validées.</p>
            </div>
          )}
        </div>
      </div>

      <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-gray-100 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-end">
          <div className="space-y-2">
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Sélectionner une Zone</label>
              <div className="relative">
                <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                <select 
                  value={selectedZone}
                  onChange={(e) => setSelectedZone(e.target.value)}
                  className="w-full pl-11 pr-10 py-3 bg-gray-50 border border-gray-100 rounded-2xl outline-none focus:border-blue-500 font-bold text-[#121c32] transition-all text-sm appearance-none cursor-pointer"
                >
                  <option value="">Choisir une zone...</option>
                  {zones.map(z => {
                    const status = zoneStatuses[z];
                    return (
                      <option key={z} value={z}>{z} {status === 'pending' ? '(À VALIDER)' : ''}</option>
                    );
                  })}
                </select>
                <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={18} />
              </div>
          </div>

          {zoneData && (
            <div className="flex items-center gap-4">
              <div className="flex-1 bg-amber-50 p-4 rounded-2xl border border-amber-100 flex items-center gap-4">
                <div className="bg-amber-600 p-2.5 rounded-xl text-white shadow-lg shadow-amber-600/20">
                  <TrendingUp size={20} />
                </div>
                <div>
                  <p className="text-[10px] font-black text-amber-400 uppercase tracking-widest">Total Antérieur</p>
                  <p className="text-xl font-black text-amber-900">{zoneData.totalAmount.toLocaleString()} F</p>
                </div>
              </div>
              <div className="flex-1 bg-gray-50 p-4 rounded-2xl border border-gray-100 flex items-center gap-4">
                <div className="bg-gray-600 p-2.5 rounded-xl text-white shadow-lg shadow-gray-600/20">
                  <Users size={20} />
                </div>
                <div>
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Cotisations</p>
                  <p className="text-xl font-black text-gray-900">{zoneData.count}</p>
                </div>
              </div>
            </div>
          )}
        </div>

        {zoneData && (
          <div className="pt-6 border-t border-gray-50 space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-black text-[#121c32] uppercase tracking-tight flex items-center gap-2">
                Détails des Cotisations Antérieures - {zoneData.zone}
              </h3>
              <div className="flex items-center gap-2">
                {zoneData.transactions.length > 0 && (
                  <>
                    <button 
                      onClick={handlePrint}
                      className="p-2.5 bg-gray-100 text-gray-600 rounded-xl hover:bg-gray-200 transition-all active:scale-95"
                      title="Imprimer"
                    >
                      <Printer size={18} />
                    </button>
                  </>
                )}
                {!zoneData.isValidated && zoneData.transactions.length > 0 && (
                  <button 
                    onClick={handleValidate}
                    className="bg-emerald-600 text-white px-6 py-2.5 rounded-xl font-black uppercase tracking-widest text-[10px] hover:bg-emerald-700 transition-all shadow-lg active:scale-95 flex items-center gap-2"
                  >
                    <CheckCircle size={16} />
                    Valider le retard
                  </button>
                )}
              </div>
            </div>

            <div className="bg-gray-50 rounded-2xl border border-gray-100 overflow-x-auto">
              <table className="w-full text-left min-w-[500px]">
                <thead>
                  <tr className="bg-gray-100/50 border-b border-gray-200">
                    <th className="px-6 py-3 text-[9px] font-black text-gray-500 uppercase tracking-widest">Date / Heure</th>
                    <th className="px-6 py-3 text-[9px] font-black text-gray-500 uppercase tracking-widest">Client</th>
                    <th className="px-6 py-3 text-[9px] font-black text-gray-500 uppercase tracking-widest">Tontine / Épargne</th>
                    <th className="px-6 py-3 text-[9px] font-black text-gray-500 uppercase tracking-widest">Agent</th>
                    <th className="px-6 py-3 text-[9px] font-black text-gray-500 uppercase tracking-widest">Mise</th>
                    <th className="px-6 py-3 text-[9px] font-black text-gray-500 uppercase tracking-widest text-right">Montant</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {zoneData.transactions.length > 0 ? (
                    zoneData.transactions.map((tx, idx) => {
                      const txDate = new Date(tx.date);
                      return (
                        <tr key={tx.id || idx} className="hover:bg-white transition-colors">
                          <td className="px-6 py-3">
                            <div className="flex flex-col">
                              <span className="text-[10px] font-black text-blue-600">{txDate.toLocaleDateString()}</span>
                              <span className="text-xs font-bold text-gray-500">
                                {txDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>
                          </td>
                          <td className="px-6 py-3">
                            <div className="flex flex-col">
                              <span className="text-xs font-black text-[#121c32] uppercase">{tx.memberName}</span>
                              {tx.hasActiveCredit && (
                                <span className="text-[8px] font-black text-red-500 uppercase">Crédit en cours</span>
                              )}
                            </div>
                          </td>
                          <td className="px-6 py-3">
                            <div className="flex flex-col">
                              <span className="text-[10px] font-bold text-gray-600">T: {tx.tontineAccountNumber}</span>
                              <span className="text-[10px] font-bold text-gray-400">É: {tx.epargneAccountNumber}</span>
                            </div>
                          </td>
                          <td className="px-6 py-3 text-xs font-bold text-gray-600 uppercase">
                            {tx.cashierName || 'N/A'}
                          </td>
                          <td className="px-6 py-3 text-xs font-black text-blue-600">
                            {(tx.dailyMise || 0).toLocaleString()} F
                          </td>
                          <td className="px-6 py-3 text-right">
                            <span className="text-xs font-black text-[#121c32]">{tx.amount.toLocaleString()} F</span>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={6} className="px-6 py-12 text-center text-gray-400 italic text-xs font-medium">
                        Aucune cotisation antérieure en attente pour cette zone.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {!selectedZone && (
          <div className="py-20 text-center space-y-4">
            <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto text-gray-300">
              <Clock size={32} />
            </div>
            <p className="text-sm font-bold text-gray-400 italic">Veuillez sélectionner une zone pour voir les cotisations antérieures.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ValidatePreviousCotisations;
