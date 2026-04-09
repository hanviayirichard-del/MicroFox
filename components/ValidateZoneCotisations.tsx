import React, { useState, useEffect } from 'react';
import { ClipboardCheck, Search, MapPin, CheckCircle, AlertCircle, ChevronRight, Users, TrendingUp, Printer, Download } from 'lucide-react';
import { recordAuditLog } from '../utils/audit';

interface ZoneCotisation {
  zone: string;
  totalAmount: number;
  count: number;
  transactions: any[];
  isValidated: boolean;
}

const ValidateZoneCotisations: React.FC = () => {
  const [zones, setZones] = useState<string[]>([]);
  const [zoneStatuses, setZoneStatuses] = useState<Record<string, 'pending' | 'validated' | 'none'>>({});
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
    return () => window.removeEventListener('storage', loadZones);
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
      const uniqueZones = Array.from(new Set(members.map((m: any) => m.zone).filter(Boolean))) as string[];
      setZones(uniqueZones.sort());

      const statuses: Record<string, 'pending' | 'validated' | 'none'> = {};
      uniqueZones.forEach(zone => {
        const zoneMembers = members.filter((m: any) => m.zone === zone);
        let hasTransactions = false;
        let hasPending = false;

        zoneMembers.forEach((m: any) => {
          const savedHistory = localStorage.getItem(`microfox_history_${m.id}`);
          const history = savedHistory ? JSON.parse(savedHistory) : (m.history || []);
          
          history.forEach((tx: any) => {
            const txDate = new Date(tx.date);
            const txDay = txDate.toISOString().split('T')[0];
            if (txDay === today && tx.type === 'cotisation' && tx.account === 'tontine') {
              hasTransactions = true;
              const validationKey = `${txDay}_${zone}`;
              const zoneValidation = validatedZones[validationKey];
              const isTxValidated = zoneValidation && txDate <= new Date(zoneValidation.validatedAt);
              if (!isTxValidated) {
                hasPending = true;
              }
            }
          });
        });

        if (!hasTransactions) {
          statuses[zone] = 'none';
        } else if (hasPending) {
          statuses[zone] = 'pending';
        } else {
          statuses[zone] = 'validated';
        }
      });
      setZoneStatuses(statuses);
    }
  };

  const loadZoneDetails = (zoneName: string) => {
    setLoading(true);
    try {
      const savedMembers = localStorage.getItem('microfox_members_data');
      const savedValidated = localStorage.getItem('microfox_validated_zone_cotisations');
      const validatedZones = savedValidated ? JSON.parse(savedValidated) : {};
      
      const today = new Date().toISOString().split('T')[0];
      const validationKey = `${today}_${zoneName}`;
      const zoneValidation = validatedZones[validationKey];

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
            const txDate = new Date(tx.date).toISOString().split('T')[0];
            if (txDate === today && tx.type === 'cotisation' && tx.account === 'tontine') {
              total += tx.amount;
              count++;
              transactions.push({
                ...tx,
                memberName: m.name,
                memberCode: m.code,
                epargneAccountNumber: m.epargneAccountNumber || 'N/A',
                tontineAccountNumber: tx.tontineAccountNumber || (m.tontineAccounts && m.tontineAccounts[0]?.number) || 'N/A',
                hasActiveCredit: (m.balances?.credit || 0) > 0
              });
            }
          });
        });

        const sortedTransactions = transactions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        
        // A zone is considered fully validated only if all its transactions for today 
        // are before the validation timestamp
        const allTransactionsValidated = transactions.length > 0 && transactions.every(tx => 
          zoneValidation && new Date(tx.date) <= new Date(zoneValidation.validatedAt)
        );

        setZoneData({
          zone: zoneName,
          totalAmount: total,
          count: count,
          transactions: sortedTransactions,
          isValidated: !!zoneValidation && allTransactionsValidated
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
      setErrorMessage("Aucune cotisation à valider pour cette zone aujourd'hui.");
      setTimeout(() => setErrorMessage(null), 5000);
      return;
    }

    try {
      const today = new Date().toISOString().split('T')[0];
      const validationKey = `${today}_${zoneData.zone}`;
      
      const savedValidated = localStorage.getItem('microfox_validated_zone_cotisations');
      const validatedZones = savedValidated ? JSON.parse(savedValidated) : {};
      
      validatedZones[validationKey] = {
        validatedAt: new Date().toISOString(),
        validatedBy: JSON.parse(localStorage.getItem('microfox_current_user') || '{}').identifiant,
        totalAmount: zoneData.totalAmount,
        count: zoneData.count
      };

      localStorage.setItem('microfox_validated_zone_cotisations', JSON.stringify(validatedZones));
      
      recordAuditLog('MODIFICATION', 'TONTINE', `Validation des cotisations de la zone ${zoneData.zone} - Total: ${zoneData.totalAmount} F (${zoneData.count} cotisations)`);

      setSuccessMessage(`Zone ${zoneData.zone} validée avec succès !`);
      setZoneData({ ...zoneData, isValidated: true });
      loadZones();
      setTimeout(() => setSuccessMessage(null), 4000);
      
      window.dispatchEvent(new Event('storage'));
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
        <title>Rapport Cotisations - Zone ${zoneData.zone}</title>
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
            <h2 style="margin-top: 10px; font-size: 16px; text-decoration: underline;">RAPPORT DE ZONE</h2>
          </div>
          <div class="text-right">
            <strong>Total: ${zoneData.totalAmount.toLocaleString()} F</strong><br>
            Nombre: ${zoneData.count}
          </div>
        </div>
        <div class="info">
          <p><strong>Zone:</strong> ${zoneData.zone}</p>
          <p><strong>Date:</strong> ${new Date().toLocaleDateString()}</p>
          <p><strong>Agent(s):</strong> ${agentsList}</p>
        </div>
        <table>
          <thead>
            <tr>
              <th>Heure</th>
              <th>Client</th>
              <th>Tontine / Épargne</th>
              <th>Agent</th>
              <th class="text-right">Montant</th>
            </tr>
          </thead>
          <tbody>
            ${zoneData.transactions.map(tx => `
              <tr>
                <td>${new Date(tx.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
                <td>
                  <strong>${tx.memberName.toUpperCase()}</strong>
                  ${tx.hasActiveCredit ? '<br/><span class="credit-mention">CRÉDIT EN COURS</span>' : ''}
                </td>
                <td>
                  T: ${tx.tontineAccountNumber}<br/>
                  É: ${tx.epargneAccountNumber}
                </td>
                <td>${(tx.cashierName || 'N/A').toUpperCase()}</td>
                <td class="text-right"><strong>${tx.amount.toLocaleString()} F</strong></td>
              </tr>
            `).join('')}
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

  const handleExportHTML = () => {
    if (!zoneData || zoneData.transactions.length === 0) return;

    const agentNames = Array.from(new Set(zoneData.transactions.map(tx => tx.cashierName).filter(Boolean))) as string[];
    const agentsList = agentNames.length > 0 ? agentNames.join(", ") : "N/A";

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Rapport Cotisations - Zone ${zoneData.zone}</title>
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
        </style>
      </head>
      <body>
        <div class="header">
          <div>
            <h1>${mfConfig.nom || 'MicroFox'}</h1>
            <p class="mf-info">${mfConfig.adresse || ''}</p>
            <p class="mf-info">${mfConfig.telephone || ''}</p>
            <h2 style="margin-top: 10px; font-size: 16px; text-decoration: underline;">RAPPORT DE ZONE</h2>
          </div>
          <div class="text-right">
            <strong>Total: ${zoneData.totalAmount.toLocaleString()} F</strong><br>
            Nombre: ${zoneData.count}
          </div>
        </div>
        <div class="info">
          <p><strong>Zone:</strong> ${zoneData.zone}</p>
          <p><strong>Date:</strong> ${new Date().toLocaleDateString()}</p>
          <p><strong>Agent(s):</strong> ${agentsList}</p>
        </div>
        <table>
          <thead>
            <tr>
              <th>Heure</th>
              <th>Client</th>
              <th>Tontine / Épargne</th>
              <th>Agent</th>
              <th class="text-right">Montant</th>
            </tr>
          </thead>
          <tbody>
            ${zoneData.transactions.map(tx => `
              <tr>
                <td>${new Date(tx.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
                <td>
                  <strong>${tx.memberName.toUpperCase()}</strong>
                  ${tx.hasActiveCredit ? '<br/><span class="credit-mention">CRÉDIT EN COURS</span>' : ''}
                </td>
                <td>
                  T: ${tx.tontineAccountNumber}<br/>
                  É: ${tx.epargneAccountNumber}
                </td>
                <td>${(tx.cashierName || 'N/A').toUpperCase()}</td>
                <td class="text-right"><strong>${tx.amount.toLocaleString()} F</strong></td>
              </tr>
            `).join('')}
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
          <p style="margin-top: 40px; font-style: italic; font-size: 9px;">Exporté le ${new Date().toLocaleString()}</p>
        </div>
      </body>
      </html>
    `;

    const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `cotisations_${zoneData.zone}_${new Date().toISOString().split('T')[0]}.html`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-12">
      <div className="flex justify-between items-start">
        <div className="flex items-start gap-3">
          <div className="mt-1 text-blue-600">
            <ClipboardCheck size={28} />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold text-[#121c32] uppercase tracking-tight leading-tight">
              Validation Cotisations<br />par Zone
            </h1>
            <p className="text-gray-500 font-medium text-sm mt-1">Valider les collectes journalières par zone géographique</p>
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

      <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-gray-100 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-end">
          <div className="space-y-2">
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Sélectionner une Zone</label>
            <div className="relative">
              <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              <select 
                value={selectedZone}
                onChange={(e) => setSelectedZone(e.target.value)}
                className="w-full pl-11 pr-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl outline-none focus:border-blue-500 font-bold text-[#121c32] transition-all text-sm appearance-none"
              >
                <option value="">Choisir une zone...</option>
                {zones.map(z => {
                  const status = zoneStatuses[z];
                  let colorClass = "";
                  let style = {};
                  
                  if (status === 'pending') {
                    style = { color: 'white', backgroundColor: '#ef4444' }; // Red
                  } else if (status === 'validated') {
                    style = { color: 'white', backgroundColor: '#10b981' }; // Green
                  } else {
                    style = { color: '#121c32', backgroundColor: 'white' }; // White
                  }

                  return (
                    <option key={z} value={z} style={style}>
                      {z} {status === 'pending' ? '(À VALIDER)' : status === 'validated' ? '(VALIDÉ)' : ''}
                    </option>
                  );
                })}
              </select>
            </div>
          </div>

          {zoneData && (
            <div className="flex items-center gap-4">
              <div className="flex-1 bg-blue-50 p-4 rounded-2xl border border-blue-100 flex items-center gap-4">
                <div className="bg-blue-600 p-2.5 rounded-xl text-white shadow-lg shadow-blue-600/20">
                  <TrendingUp size={20} />
                </div>
                <div>
                  <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest">Total Zone</p>
                  <p className="text-xl font-black text-blue-900">{zoneData.totalAmount.toLocaleString()} F</p>
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
                Détails des Cotisations - {zoneData.zone}
                {zoneData.isValidated && (
                  <span className="ml-2 px-2 py-0.5 bg-emerald-100 text-emerald-600 text-[9px] rounded-md border border-emerald-200">Validé</span>
                )}
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
                    <button 
                      onClick={handleExportHTML}
                      className="p-2.5 bg-gray-100 text-gray-600 rounded-xl hover:bg-gray-200 transition-all active:scale-95"
                      title="Exporter HTML"
                    >
                      <Download size={18} />
                    </button>
                  </>
                )}
                {!zoneData.isValidated && zoneData.transactions.length > 0 && (
                  <button 
                    onClick={handleValidate}
                    className="bg-emerald-600 text-white px-6 py-2.5 rounded-xl font-black uppercase tracking-widest text-[10px] hover:bg-emerald-700 transition-all shadow-lg active:scale-95 flex items-center gap-2"
                  >
                    <CheckCircle size={16} />
                    Valider la Zone
                  </button>
                )}
              </div>
            </div>

            <div className="bg-gray-50 rounded-2xl border border-gray-100 overflow-x-auto">
              <table className="w-full text-left min-w-[500px]">
                <thead>
                  <tr className="bg-gray-100/50 border-b border-gray-200">
                    <th className="px-6 py-3 text-[9px] font-black text-gray-500 uppercase tracking-widest">Heure</th>
                    <th className="px-6 py-3 text-[9px] font-black text-gray-500 uppercase tracking-widest">Client</th>
                    <th className="px-6 py-3 text-[9px] font-black text-gray-500 uppercase tracking-widest">Tontine / Épargne</th>
                    <th className="px-6 py-3 text-[9px] font-black text-gray-500 uppercase tracking-widest">Agent</th>
                    <th className="px-6 py-3 text-[9px] font-black text-gray-500 uppercase tracking-widest text-right">Montant</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {zoneData.transactions.length > 0 ? (
                    zoneData.transactions.map((tx, idx) => {
                      const txDate = new Date(tx.date);
                      const savedValidated = localStorage.getItem('microfox_validated_zone_cotisations');
                      const validatedZones = savedValidated ? JSON.parse(savedValidated) : {};
                      const dayKey = txDate.toISOString().split('T')[0];
                      const zoneName = zoneData.zone;
                      const validationKey = `${dayKey}_${zoneName}`;
                      const zoneValidation = validatedZones[validationKey];
                      const isTxValidated = zoneValidation && txDate <= new Date(zoneValidation.validatedAt);

                      return (
                        <tr key={tx.id || idx} className={`hover:bg-white transition-colors ${isTxValidated ? 'bg-emerald-50/30' : ''}`}>
                          <td className="px-6 py-3 text-xs font-bold text-gray-500">
                            {txDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
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
                          <td className="px-6 py-3 text-right">
                            <div className="flex items-center justify-end gap-2">
                              {isTxValidated && <CheckCircle size={12} className="text-emerald-500" />}
                              <span className="text-xs font-black text-[#121c32]">{tx.amount.toLocaleString()} F</span>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={4} className="px-6 py-12 text-center text-gray-400 italic text-xs font-medium">
                        Aucune cotisation enregistrée pour cette zone aujourd'hui.
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
              <MapPin size={32} />
            </div>
            <p className="text-sm font-bold text-gray-400 italic">Veuillez sélectionner une zone pour voir les cotisations du jour.</p>
          </div>
        )}
      </div>

      {/* Print Section */}
      <div className="hidden print:block p-8 bg-white text-black print-section">
        <div className="flex justify-between items-start border-b-2 border-black pb-4 mb-6">
          <div>
            <h1 className="text-xl font-bold uppercase">{mfConfig.nom || 'MicroFox'}</h1>
            <p className="text-xs font-bold">{mfConfig.adresse}</p>
            <p className="text-xs font-bold">{mfConfig.telephone}</p>
            <h2 className="text-lg font-bold uppercase mt-4 underline">Rapport de Zone</h2>
            <p className="text-sm mt-2">Zone: <span className="font-bold">{zoneData?.zone}</span></p>
            <p className="text-sm">Date: <span className="font-bold">{new Date().toLocaleDateString()}</span></p>
          </div>
          <div className="text-right">
            <p className="text-lg font-bold">Total: {zoneData?.totalAmount.toLocaleString()} F</p>
            <p className="text-sm">Nombre: {zoneData?.count}</p>
          </div>
        </div>

        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-black">
              <th className="py-2 text-xs font-bold uppercase">Heure</th>
              <th className="py-2 text-xs font-bold uppercase">Client</th>
              <th className="py-2 text-xs font-bold uppercase">Tontine / Épargne</th>
              <th className="py-2 text-xs font-bold uppercase">Agent</th>
              <th className="py-2 text-xs font-bold uppercase text-right">Montant</th>
            </tr>
          </thead>
          <tbody>
            {zoneData?.transactions.map((tx, idx) => (
              <tr key={idx} className="border-b border-gray-200">
                <td className="py-2 text-xs">{new Date(tx.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
                <td className="py-2 text-xs">
                  <div className="font-bold uppercase">{tx.memberName}</div>
                  {tx.hasActiveCredit && (
                    <div className="text-[8px] text-red-600 font-bold">CRÉDIT EN COURS</div>
                  )}
                </td>
                <td className="py-2 text-xs">
                  T: {tx.tontineAccountNumber}<br/>
                  É: {tx.epargneAccountNumber}
                </td>
                <td className="py-2 text-xs uppercase">{tx.cashierName || 'N/A'}</td>
                <td className="py-2 text-xs font-bold text-right">{tx.amount.toLocaleString()} F</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="mt-12 pt-4 border-t border-black">
          <div className="flex justify-between">
            <div>
              <p className="text-xs font-bold">Agent Commercial: {Array.from(new Set(zoneData?.transactions.map(tx => tx.cashierName).filter(Boolean))).join(", ") || "N/A"}</p>
              <div className="mt-8 w-48 border-t border-dashed border-black text-[10px] text-center pt-1">Signature Agent</div>
            </div>
            <div className="text-right">
              <p className="text-xs font-bold">Caisse / Responsable:</p>
              <div className="mt-8 w-48 border-t border-dashed border-black text-[10px] text-center pt-1 ml-auto">Signature Responsable</div>
            </div>
          </div>
          <p className="mt-8 text-[9px] italic">Imprimé le {new Date().toLocaleString()}</p>
        </div>
      </div>
    </div>
  );
};

export default ValidateZoneCotisations;
