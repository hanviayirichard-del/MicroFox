import React, { useState, useEffect } from 'react';
import { 
  FileCheck, 
  Download, 
  Printer, 
  Calendar, 
  ChevronDown,
  Calculator,
  TrendingUp,
  ArrowUpRight,
  ArrowDownRight,
  PieChart
} from 'lucide-react';
import * as XLSX from 'xlsx';

const RegulatoryReports: React.FC = () => {
  const [startDate, setStartDate] = useState<string>(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState<string>(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
  });
  const [members, setMembers] = useState<any[]>([]);
  
  const [sigData, setSigData] = useState({
    produits: {
      carnetsTontine: 0,
      carnetsMembre: 0,
      commissionsTontine: 0,
      fraisDossier: 0,
      interetsCredit: 0,
      droitAdhesion: 0,
      partSociale: 0,
      total: 0
    },
    charges: {
      salaires: 0,
      depensesAdmin: 0,
      total: 0
    },
    marge: 0,
    depots: {
      ordinaires: 0,
      retraitsOrdinaires: 0,
      tontines: 0,
      retraitsTontines: 0,
      garantie: 0,
      retraitsGarantie: 0
    },
    credits: {
      accordes: 0,
      rembourse: 0,
      interets: 0
    }
  });

  const months = [
    "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
    "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"
  ];

  const years = [2024, 2025, 2026];

  const loadData = () => {
    const userStr = localStorage.getItem('microfox_current_user');
    const user = userStr ? JSON.parse(userStr) : null;
    const isCaissier = user?.role === 'caissier';

    const saved = localStorage.getItem('microfox_members_data');
    if (saved) {
      const allMembers = JSON.parse(saved);
      setMembers(allMembers);

      const start = startDate ? new Date(startDate) : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
      const end = endDate ? new Date(endDate) : new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0);
      end.setHours(23, 59, 59, 999);

      const data = {
        produits: { carnetsTontine: 0, carnetsMembre: 0, commissionsTontine: 0, fraisDossier: 0, interetsCredit: 0, droitAdhesion: 0, partSociale: 0, total: 0 },
        charges: { salaires: 0, depensesAdmin: 0, total: 0 },
        depots: { ordinaires: 0, retraitsOrdinaires: 0, tontines: 0, retraitsTontines: 0, garantie: 0, retraitsGarantie: 0 },
        credits: { accordes: 0, rembourse: 0, interets: 0 },
        marge: 0
      };

      allMembers.forEach((m: any) => {
        // Calcul des commissions tontine (logique synchronisée avec Commissions.tsx)
        const tontineAccounts = m.tontineAccounts || [];
        tontineAccounts.forEach((acc: any) => {
          const dailyMise = Number(acc.dailyMise) || 500;
          if (dailyMise <= 0) return;

          const tontineTxs = (m.history || [])
            .filter((t: any) => t.account === 'tontine' && (t.type === 'cotisation' || t.type === 'depot') && (t.tontineAccountId === acc.id || !t.tontineAccountId))
            .sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime());

          const accountWithdrawals = (m.history || [])
            .filter((h: any) => h.account === 'tontine' && (h.tontineAccountId === acc.id || !h.tontineAccountId) && h.type === 'retrait')
            .sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime());

          if (tontineTxs.length === 0) return;

          let currentCycleFirstDepositDate: Date | null = null;
          let currentCycleAmount = 0;
          let cycleIdx = 1;

          for (const tx of tontineTxs) {
            const txDate = new Date(tx.date);
            let remainingAmount = Number(tx.amount);

            while (remainingAmount > 0) {
              if (currentCycleFirstDepositDate === null) {
                currentCycleFirstDepositDate = txDate;
                if (txDate >= start && txDate <= end) {
                  if (!isCaissier || tx.userId === user.id) {
                    data.produits.commissionsTontine += dailyMise;
                  }
                }
              }

              const cycleEndDateLimit = new Date(currentCycleFirstDepositDate.getTime() + (31 * 24 * 60 * 60 * 1000));
              const withdrawalDuringCycle = accountWithdrawals.find((w: any) => {
                const wDate = new Date(w.date);
                return wDate >= currentCycleFirstDepositDate! && wDate < txDate;
              });

              if (txDate >= cycleEndDateLimit || withdrawalDuringCycle) {
                cycleIdx++;
                currentCycleFirstDepositDate = txDate;
                currentCycleAmount = 0;
                if (txDate >= start && txDate <= end) {
                  if (!isCaissier || tx.userId === user.id) {
                    data.produits.commissionsTontine += dailyMise;
                  }
                }
                continue;
              }

              const amountToCompleteCycle = (31 * dailyMise) - currentCycleAmount;
              if (remainingAmount >= amountToCompleteCycle) {
                remainingAmount -= amountToCompleteCycle;
                currentCycleAmount = 0;
                cycleIdx++;
                currentCycleFirstDepositDate = remainingAmount > 0 ? txDate : null;
                if (remainingAmount > 0 && txDate >= start && txDate <= end) {
                  if (!isCaissier || tx.userId === user.id) {
                    data.produits.commissionsTontine += dailyMise;
                  }
                }
              } else {
                currentCycleAmount += remainingAmount;
                remainingAmount = 0;
              }
            }
          }
        });

        (m.history || []).forEach((tx: any) => {
          if (isCaissier && tx.userId !== user.id) return;
          const txDate = new Date(tx.date);
          if (txDate >= start && txDate <= end) {
            const desc = (tx.description || '').toLowerCase();
            const amount = Number(tx.amount || 0);

            // Categorize by account type first, then by description
            if (tx.account === 'partSociale') {
              data.produits.partSociale += amount;
            } else {
              // Produits d'exploitation
              if (desc.includes('livret tontine') || desc.includes('carnet tontine')) {
                data.produits.carnetsTontine += amount;
              } else if (desc.includes('livret épargne') || desc.includes('livret epargne') || desc.includes('carnet membre') || desc.includes('livret de compte')) {
                data.produits.carnetsMembre += amount;
              } else if (desc.includes('frais de dossier')) {
                data.produits.fraisDossier += amount;
              } else if (desc.includes('intérêt') || desc.includes('interet')) {
                // Do not count credit capital repayments as interest
                if (tx.account === 'credit' && tx.type === 'remboursement') {
                   // interest is handled separately in the credit section below
                } else if (tx.account !== 'credit') {
                  data.produits.interetsCredit += amount;
                }
              } else if (desc.includes('adhésion') || desc.includes('adhesion')) {
                data.produits.droitAdhesion += amount;
              }
            }

            // Charges (already separated by description or specific accounts)
            if (desc.includes('salaire')) data.charges.salaires += amount;
            else if (desc.includes('dépense admin') || desc.includes('depense admin')) data.charges.depensesAdmin += amount;

            // État des dépôts
            if (tx.account === 'epargne') {
              if (tx.type === 'depot') data.depots.ordinaires += amount;
              if (tx.type === 'retrait') data.depots.retraitsOrdinaires += amount;
            } else if (tx.account === 'tontine') {
              if (tx.type === 'cotisation' || tx.type === 'depot') data.depots.tontines += amount;
              if (tx.type === 'retrait') data.depots.retraitsTontines += amount;
            } else if (tx.account === 'garantie' || tx.type === 'depot_garantie' || tx.type === 'retrait_garantie') {
              if (tx.type === 'depot' || tx.type === 'depot_garantie') data.depots.garantie += amount;
              if (tx.type === 'retrait' || tx.type === 'retrait_garantie') data.depots.retraitsGarantie += amount;
            }

            // État des crédits
            if (tx.account === 'credit') {
              if (tx.type === 'deblocage' && !desc.includes('demande de crédit enregistrée')) data.credits.accordes += amount;
              if (tx.type === 'remboursement') {
                const cap = tx.rembCapital !== undefined ? Number(tx.rembCapital) : amount;
                const int = tx.rembInterest !== undefined ? Number(tx.rembInterest) : 0;
                data.credits.rembourse += cap;
                data.credits.interets += int;
                data.produits.interetsCredit += int;
              }
            }
          }
        });
      });

      // Load Administrative Expenses
      const savedExpenses = localStorage.getItem('microfox_admin_expenses');
      if (savedExpenses) {
        const allExpenses = JSON.parse(savedExpenses);
        allExpenses.forEach((e: any) => {
          // Respect soft delete flag
          if (e.isDeleted) return;

          const eDate = new Date(e.date);
          if (eDate >= start && eDate <= end) {
            if (isCaissier && e.recordedBy !== user.identifiant) return;
            if (e.category === 'Salaires') {
              data.charges.salaires += e.amount;
            } else {
              data.charges.depensesAdmin += e.amount;
            }
          }
        });
      }

      // Calculation: total should be sum of others
      data.produits.total = data.produits.carnetsTontine + data.produits.carnetsMembre + data.produits.commissionsTontine + data.produits.fraisDossier + data.produits.interetsCredit + data.produits.droitAdhesion;
      data.charges.total = data.charges.salaires + data.charges.depensesAdmin;
      data.marge = data.produits.total - data.charges.total;

      setSigData(data);
    }
  };

  useEffect(() => {
    loadData();
    window.addEventListener('storage', loadData);
    window.addEventListener('microfox_storage' as any, loadData);
    return () => window.removeEventListener('storage', loadData);
      window.removeEventListener('microfox_storage' as any, loadData);
  }, [startDate, endDate]);

  const generateHTMLContent = (isForPrint = false) => {
    const mfConfig = JSON.parse(localStorage.getItem('microfox_mf_config') || '{"nom": "MicroFoX", "adresse": "", "code": ""}');
    const periodLabel = startDate && endDate 
      ? `Du ${new Date(startDate).toLocaleDateString('fr-FR')} au ${new Date(endDate).toLocaleDateString('fr-FR')}`
      : months[new Date().getMonth()] + ' ' + new Date().getFullYear();
    
    const sigRows = [
      ['SOLDE INTERMEDIAIRE DE GESTION', periodLabel],
      [''],
      ['COMPTES D\'EXPLOITATION', '', ''],
      ['COMPTE', 'LIBELLÉS', 'MONTANTS'],
      ['70611000', 'Produits d\'exploitation (A)', sigData.produits.total],
      ['70611100', 'Carnets Tontine vendus', sigData.produits.carnetsTontine],
      ['70611200', 'Carnets membre vendus', sigData.produits.carnetsMembre],
      ['70611300', 'Commissions sur Tontine', sigData.produits.commissionsTontine],
      ['70611400', 'Frais de dossiers sur crédit accordé', sigData.produits.fraisDossier],
      ['70111000', 'Intérêt remboursé sur crédit accordé', sigData.produits.interetsCredit],
      ['70611500', 'Droit d\'adhésion', sigData.produits.droitAdhesion],
      ['', 'Total produits d\'exploitation (A)', sigData.produits.total],
      [''],
      ['61110000', 'Charges d\'exploitation (B)', sigData.charges.total],
      ['61111000', 'Salaire', sigData.charges.salaires],
      ['61200000', 'Dépenses administratives', sigData.charges.depensesAdmin],
      ['', 'Total charges d\'exploitation (B)', sigData.charges.total],
      ['13100000', 'Marge bénéficiaire (A - B)', sigData.marge],
      [''],
      ['COMPTE D\'INVESTISSEMENT', '', ''],
      ['', 'Ressource (A)', sigData.marge],
      ['10110000', 'Capital souscrit appelé versé', sigData.produits.partSociale],
      ['13100000', 'Marge bénéficiaire', sigData.marge],
      ['24000000', 'Investissement (B)', 0],
      ['', 'Investissement', 0],
      ['62000000', 'Autres charges (C)', 0],
      ['', 'Autres charges', 0],
      ['', 'Situation du mois (A-B-C)', sigData.marge + sigData.produits.partSociale],
      [''],
      ['ÉTAT DES DÉPÔTS', '', ''],
      ['COMPTE', 'ÉLÉMENTS', 'MONTANTS'],
      ['25111000', 'Dépôts ordinaires', sigData.depots.ordinaires],
      ['25111000', 'Retraits ordinaires', sigData.depots.retraitsOrdinaires],
      ['', 'ECART', sigData.depots.ordinaires - sigData.depots.retraitsOrdinaires],
      ['25211000', 'Dépôts Tontines', sigData.depots.tontines],
      ['25211000', 'Retraits Tontines', sigData.depots.retraitsTontines],
      ['', 'ECART', sigData.depots.tontines - sigData.depots.retraitsTontines],
      ['25311000', 'Dépôts Garantie', sigData.depots.garantie],
      ['25311000', 'Retraits Garantie', sigData.depots.retraitsGarantie],
      ['', 'ECART (GARANTIE)', sigData.depots.garantie - sigData.depots.retraitsGarantie],
      [''],
      ['ÉTAT DES CRÉDITS EN COURS', '', ''],
      ['COMPTE', 'LIBELLÉS', 'MONTANTS'],
      ['22111000', 'Crédits accordés', sigData.credits.accordes],
      ['22111000', 'Capital remboursé', sigData.credits.rembourse],
      ['70111000', 'Intérêts remboursés', sigData.credits.interets]
    ];

    const htmlContent = `
      <!DOCTYPE html>
      <html lang="fr">
        <head>
          <meta charset="utf-8">
          <title>SIG - ${periodLabel}</title>
          <style>
            body { font-family: sans-serif; padding: 20px; }
            table { border-collapse: collapse; width: 100%; margin-top: 20px; }
            th, td { border: 1px solid #ddd; padding: 12px; text-align: left; }
            tr:nth-child(even) { background-color: #f9f9f9; }
            th { background-color: #121c32; color: white; }
            .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #121c32; padding-bottom: 10px; }
            .mf-name { font-size: 24px; font-weight: 900; text-transform: uppercase; margin: 0; }
            .mf-address { font-size: 12px; font-weight: bold; color: #666; margin: 5px 0; }
            h1.report-title { text-align: center; color: #121c32; margin-top: 20px; font-size: 20px; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1 class="mf-name">${mfConfig.nom}</h1>
            <p class="mf-address">${mfConfig.adresse}</p>
            <p class="mf-address">Tél: ${mfConfig.telephone || 'N/A'} | Code: ${mfConfig.code}</p>
          </div>
          <h1 class="report-title">SOLDE INTERMEDIAIRE DE GESTION</h1>
          <p style="text-align: center;">${periodLabel}</p>
          <table>
            ${sigRows.map(row => `
              <tr>
                ${row.map(cell => `<td>${cell}</td>`).join('')}
              </tr>
            `).join('')}
          </table>
          ${isForPrint ? '<script>window.print();</script>' : ''}
        </body>
      </html>
    `;
    return htmlContent;
  };

  const exportToHTML = () => {
    const htmlContent = generateHTMLContent();
    const blob = new Blob([htmlContent], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `SIG_${startDate || 'period'}.html`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handlePrint = () => {
    const htmlContent = generateHTMLContent(true);
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(htmlContent);
      printWindow.document.close();
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-8 pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 flex items-center justify-center text-emerald-600 shadow-sm border border-emerald-100">
            <FileCheck size={24} />
          </div>
          <div>
            <h1 className="text-2xl font-black text-white uppercase tracking-tight">États Réglementaires</h1>
            <p className="text-gray-400 text-xs font-bold uppercase tracking-widest mt-0.5">Solde Intermédiaire de Gestion & Rapports Mensuels</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={handlePrint}
            className="p-3 bg-white text-gray-400 rounded-2xl border border-gray-200 hover:text-[#121c32] hover:border-[#121c32] transition-all shadow-sm"
          >
            <Printer size={20} />
          </button>
          <button 
            onClick={exportToHTML}
            className="p-3 bg-emerald-600 text-white rounded-2xl shadow-lg shadow-emerald-200 hover:bg-emerald-700 transition-all active:scale-95 flex items-center gap-2 font-black text-[10px] uppercase tracking-widest"
          >
            <Download size={18} />
            Exporter HTML
          </button>
        </div>
      </div>

      {/* Selectors */}
      <div className="bg-white p-6 rounded-[2.5rem] border border-gray-100 shadow-sm flex flex-wrap items-center gap-6">
        <div className="flex-1 min-w-[300px] space-y-2">
          <label className="text-[10px] font-black text-gray-600 uppercase tracking-widest ml-1">Période du rapport</label>
          <div className="flex flex-wrap gap-4 items-end">
            <div className="space-y-1 flex-1">
              <label className="text-[9px] font-bold text-gray-600 uppercase tracking-widest">Du</label>
              <input 
                type="date" 
                value={startDate} 
                onChange={(e) => setStartDate(e.target.value)}
                className="block w-full p-2.5 bg-gray-50 border border-gray-100 rounded-xl text-sm font-bold outline-none focus:bg-white focus:border-emerald-500 text-black transition-all"
              />
            </div>
            <div className="space-y-1 flex-1">
              <label className="text-[9px] font-bold text-gray-600 uppercase tracking-widest">Au</label>
              <input 
                type="date" 
                value={endDate} 
                onChange={(e) => setEndDate(e.target.value)}
                className="block w-full p-2.5 bg-gray-50 border border-gray-100 rounded-xl text-sm font-bold outline-none focus:bg-white focus:border-emerald-500 text-black transition-all"
              />
            </div>
            <button 
              onClick={() => { setStartDate(''); setEndDate(''); }}
              className="px-4 py-2.5 text-[10px] font-black text-gray-400 uppercase tracking-widest hover:text-red-500 transition-colors"
            >
              Réinitialiser
            </button>
          </div>
        </div>
        <div className="h-12 w-px bg-gray-100 hidden md:block"></div>
        <div className="flex-1 min-w-[200px] bg-[#121c32] rounded-3xl p-6 text-white shadow-xl relative overflow-hidden">
          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-600 mb-1">Marge Bénéficiaire</p>
          <div className="flex items-baseline gap-1">
            <span className={`text-3xl font-black ${sigData.marge >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              {sigData.marge.toLocaleString()}
            </span>
            <span className="text-sm font-bold opacity-60">F</span>
          </div>
          <TrendingUp className="absolute right-[-10px] bottom-[-10px] w-20 h-20 text-white/5" />
        </div>
      </div>

      {/* SIG Table */}
      <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-sm overflow-hidden">
        <div className="bg-[#121c32] p-6 text-white flex items-center justify-between">
          <div>
            <h3 className="text-sm font-black uppercase tracking-widest">Solde Intermédiaire de Gestion</h3>
            <p className="text-[10px] font-bold opacity-60 uppercase mt-1">
              {startDate && endDate 
                ? `Du ${new Date(startDate).toLocaleDateString('fr-FR')} au ${new Date(endDate).toLocaleDateString('fr-FR')}`
                : `Mois de ${months[new Date().getMonth()]} ${new Date().getFullYear()}`}
            </p>
          </div>
          <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest bg-white/10 px-3 py-1.5 rounded-lg">
            <PieChart size={14} className="text-emerald-400" />
            Rapport Consolidé
          </div>
        </div>
        
        <div className="p-0 overflow-x-auto custom-scrollbar">
          <table className="w-full text-left border-collapse min-w-[800px]">
            <thead>
              <tr className="bg-gray-50/50">
                <th className="px-6 py-4 text-[10px] font-black text-gray-600 uppercase tracking-widest w-24">Compte</th>
                <th className="px-6 py-4 text-[10px] font-black text-gray-600 uppercase tracking-widest">Libellés</th>
                <th className="px-6 py-4 text-[10px] font-black text-gray-600 uppercase tracking-widest text-right">Montants (FCFA)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {/* Section Exploitation */}
              <tr className="bg-gray-50/30">
                <td colSpan={3} className="px-6 py-3 text-[11px] font-black text-[#121c32] uppercase tracking-widest">Comptes d'Exploitation</td>
              </tr>
              <tr>
                <td className="px-6 py-3 text-xs font-bold text-gray-400">70611000</td>
                <td className="px-6 py-3 text-xs font-black text-[#121c32] uppercase">Produits d'exploitation (A)</td>
                <td className="px-6 py-3 text-xs font-black text-[#121c32] text-right">{sigData.produits.total.toLocaleString()}</td>
              </tr>
              <tr className="text-gray-500">
                <td className="px-6 py-2 text-[10px] font-bold">70611100</td>
                <td className="px-6 py-2 text-[10px] font-bold pl-12 italic">Carnets Tontine vendus</td>
                <td className="px-6 py-2 text-[10px] font-bold text-right">{sigData.produits.carnetsTontine.toLocaleString()}</td>
              </tr>
              <tr className="text-gray-500">
                <td className="px-6 py-2 text-[10px] font-bold">70611200</td>
                <td className="px-6 py-2 text-[10px] font-bold pl-12 italic">Carnets membre vendus</td>
                <td className="px-6 py-2 text-[10px] font-bold text-right">{sigData.produits.carnetsMembre.toLocaleString()}</td>
              </tr>
              <tr className="text-gray-500">
                <td className="px-6 py-2 text-[10px] font-bold">70611300</td>
                <td className="px-6 py-2 text-[10px] font-bold pl-12 italic">Commissions sur Tontine</td>
                <td className="px-6 py-2 text-[10px] font-bold text-right">{sigData.produits.commissionsTontine.toLocaleString()}</td>
              </tr>
              <tr className="text-gray-500">
                <td className="px-6 py-2 text-[10px] font-bold">70611400</td>
                <td className="px-6 py-2 text-[10px] font-bold pl-12 italic">Frais de dossiers sur crédit accordé</td>
                <td className="px-6 py-2 text-[10px] font-bold text-right">{sigData.produits.fraisDossier.toLocaleString()}</td>
              </tr>
              <tr className="text-gray-500">
                <td className="px-6 py-2 text-[10px] font-bold">70111000</td>
                <td className="px-6 py-2 text-[10px] font-bold pl-12 italic">Intérêt remboursé sur crédit accordé</td>
                <td className="px-6 py-2 text-[10px] font-bold text-right">{sigData.produits.interetsCredit.toLocaleString()}</td>
              </tr>
              <tr className="text-gray-500">
                <td className="px-6 py-2 text-[10px] font-bold">70611500</td>
                <td className="px-6 py-2 text-[10px] font-bold pl-12 italic">Droit d'adhésion</td>
                <td className="px-6 py-2 text-[10px] font-bold text-right">{sigData.produits.droitAdhesion.toLocaleString()}</td>
              </tr>
              <tr className="bg-emerald-50/30">
                <td className="px-6 py-3 text-xs font-bold text-emerald-600"></td>
                <td className="px-6 py-3 text-xs font-black text-emerald-700 uppercase">Total produits d'exploitation (A)</td>
                <td className="px-6 py-3 text-xs font-black text-emerald-700 text-right">{sigData.produits.total.toLocaleString()}</td>
              </tr>
 
              <tr className="bg-gray-50/10">
                <td className="px-6 py-3 text-xs font-bold text-gray-400">61110000</td>
                <td className="px-6 py-3 text-xs font-black text-[#121c32] uppercase">Charges d'exploitation (B)</td>
                <td className="px-6 py-3 text-xs font-black text-[#121c32] text-right">{sigData.charges.total.toLocaleString()}</td>
              </tr>
              <tr className="text-gray-500">
                <td className="px-6 py-2 text-[10px] font-bold">61111000</td>
                <td className="px-6 py-2 text-[10px] font-bold pl-12 italic">Salaires</td>
                <td className="px-6 py-2 text-[10px] font-bold text-right">{sigData.charges.salaires.toLocaleString()}</td>
              </tr>
              <tr className="text-gray-500">
                <td className="px-6 py-2 text-[10px] font-bold">61200000</td>
                <td className="px-6 py-2 text-[10px] font-bold pl-12 italic">Dépenses administratives</td>
                <td className="px-6 py-2 text-[10px] font-bold text-right">{sigData.charges.depensesAdmin.toLocaleString()}</td>
              </tr>
              <tr className="bg-red-50/30">
                <td className="px-6 py-3 text-xs font-bold text-red-600"></td>
                <td className="px-6 py-3 text-xs font-black text-red-700 uppercase">Total charges d'exploitation (B)</td>
                <td className="px-6 py-3 text-xs font-black text-red-700 text-right">{sigData.charges.total.toLocaleString()}</td>
              </tr>
              <tr className="bg-[#121c32] text-white">
                <td className="px-6 py-4 text-xs font-bold opacity-50">13100000</td>
                <td className="px-6 py-4 text-sm font-black uppercase tracking-widest">Marge bénéficiaire (A - B)</td>
                <td className="px-6 py-4 text-sm font-black text-right">{sigData.marge.toLocaleString()}</td>
              </tr>
 
              {/* Section Investissement */}
              <tr className="bg-gray-50/30">
                <td colSpan={3} className="px-6 py-3 text-[11px] font-black text-[#121c32] uppercase tracking-widest">Compte d'Investissement</td>
              </tr>
              <tr>
                <td className="px-6 py-3 text-xs font-bold text-gray-400"></td>
                <td className="px-6 py-3 text-xs font-black text-[#121c32] uppercase">Ressource (A)</td>
                <td className="px-6 py-3 text-xs font-black text-[#121c32] text-right">{sigData.marge.toLocaleString()}</td>
              </tr>
              <tr className="text-gray-500">
                <td className="px-6 py-2 text-[10px] font-bold">10110000</td>
                <td className="px-6 py-2 text-[10px] font-bold pl-12 italic">Capital souscrit appelé versé</td>
                <td className="px-6 py-2 text-[10px] font-bold text-right">{sigData.produits.partSociale.toLocaleString()}</td>
              </tr>
              <tr className="text-gray-500">
                <td className="px-6 py-2 text-[10px] font-bold">13100000</td>
                <td className="px-6 py-2 text-[10px] font-bold pl-12 italic">Marge bénéficiaire</td>
                <td className="px-6 py-2 text-[10px] font-bold text-right">{sigData.marge.toLocaleString()}</td>
              </tr>
              <tr>
                <td className="px-6 py-3 text-xs font-bold text-gray-400">24000000</td>
                <td className="px-6 py-3 text-xs font-black text-[#121c32] uppercase">Investissement (B)</td>
                <td className="px-6 py-3 text-xs font-black text-[#121c32] text-right">0</td>
              </tr>
              <tr>
                <td className="px-6 py-3 text-xs font-bold text-gray-400">62000000</td>
                <td className="px-6 py-3 text-xs font-black text-[#121c32] uppercase">Autres charges (C)</td>
                <td className="px-6 py-3 text-xs font-black text-[#121c32] text-right">0</td>
              </tr>
              <tr className="bg-blue-900 text-white">
                <td className="px-6 py-4 text-xs font-bold opacity-50">13100000</td>
                <td className="px-6 py-4 text-sm font-black uppercase tracking-widest">Situation du mois (A-B-C)</td>
                <td className="px-6 py-4 text-sm font-black text-right">{(sigData.marge + sigData.produits.partSociale).toLocaleString()}</td>
              </tr>
 
              {/* Section Dépôts */}
              <tr className="bg-gray-50/30">
                <td colSpan={3} className="px-6 py-3 text-[11px] font-black text-[#121c32] uppercase tracking-widest">État des Dépôts</td>
              </tr>
              <tr>
                <td className="px-6 py-3 text-xs font-bold text-gray-400">25111000</td>
                <td className="px-6 py-3 text-xs font-bold text-gray-600 uppercase">Dépôts ordinaires</td>
                <td className="px-6 py-3 text-xs font-black text-[#121c32] text-right">{sigData.depots.ordinaires.toLocaleString()}</td>
              </tr>
              <tr>
                <td className="px-6 py-3 text-xs font-bold text-gray-400">25111000</td>
                <td className="px-6 py-3 text-xs font-bold text-gray-600 uppercase">Retraits ordinaires</td>
                <td className="px-6 py-3 text-xs font-black text-[#121c32] text-right">{sigData.depots.retraitsOrdinaires.toLocaleString()}</td>
              </tr>
              <tr className="bg-blue-50/30">
                <td className="px-6 py-2 text-xs font-bold"></td>
                <td className="px-6 py-2 text-xs font-black text-blue-700 uppercase italic">ECART (Épargne)</td>
                <td className="px-6 py-2 text-xs font-black text-blue-700 text-right">{(sigData.depots.ordinaires - sigData.depots.retraitsOrdinaires).toLocaleString()}</td>
              </tr>
              <tr>
                <td className="px-6 py-3 text-xs font-bold text-gray-400">25211000</td>
                <td className="px-6 py-3 text-xs font-bold text-gray-600 uppercase">Dépôts Tontines</td>
                <td className="px-6 py-3 text-xs font-black text-[#121c32] text-right">{sigData.depots.tontines.toLocaleString()}</td>
              </tr>
              <tr>
                <td className="px-6 py-3 text-xs font-bold text-gray-400">25211000</td>
                <td className="px-6 py-3 text-xs font-bold text-gray-600 uppercase">Retraits Tontines</td>
                <td className="px-6 py-3 text-xs font-black text-[#121c32] text-right">{sigData.depots.retraitsTontines.toLocaleString()}</td>
              </tr>
              <tr className="bg-amber-50/30">
                <td className="px-6 py-2 text-xs font-bold"></td>
                <td className="px-6 py-2 text-xs font-black text-amber-700 uppercase italic">ECART (Tontine)</td>
                <td className="px-6 py-2 text-xs font-black text-amber-700 text-right">{(sigData.depots.tontines - sigData.depots.retraitsTontines).toLocaleString()}</td>
              </tr>
              <tr>
                <td className="px-6 py-3 text-xs font-bold text-gray-400">25311000</td>
                <td className="px-6 py-3 text-xs font-bold text-gray-600 uppercase">Dépôts Garantie</td>
                <td className="px-6 py-3 text-xs font-black text-[#121c32] text-right">{sigData.depots.garantie.toLocaleString()}</td>
              </tr>
              <tr>
                <td className="px-6 py-3 text-xs font-bold text-gray-400">25311000</td>
                <td className="px-6 py-3 text-xs font-bold text-gray-600 uppercase">Retraits Garantie</td>
                <td className="px-6 py-3 text-xs font-black text-[#121c32] text-right">{sigData.depots.retraitsGarantie.toLocaleString()}</td>
              </tr>
              <tr className="bg-purple-50/30">
                <td className="px-6 py-2 text-xs font-bold"></td>
                <td className="px-6 py-2 text-xs font-black text-purple-700 uppercase italic">ECART (Garantie)</td>
                <td className="px-6 py-2 text-xs font-black text-purple-700 text-right">{(sigData.depots.garantie - sigData.depots.retraitsGarantie).toLocaleString()}</td>
              </tr>
 
              {/* Section Crédits */}
              <tr className="bg-gray-50/30">
                <td colSpan={3} className="px-6 py-3 text-[11px] font-black text-[#121c32] uppercase tracking-widest">État des Crédits en Cours</td>
              </tr>
              <tr>
                <td className="px-6 py-3 text-xs font-bold text-gray-400">22111000</td>
                <td className="px-6 py-3 text-xs font-bold text-gray-600 uppercase">Crédits accordés</td>
                <td className="px-6 py-3 text-xs font-black text-[#121c32] text-right">{sigData.credits.accordes.toLocaleString()}</td>
              </tr>
              <tr>
                <td className="px-6 py-3 text-xs font-bold text-gray-400">22111000</td>
                <td className="px-6 py-3 text-xs font-bold text-gray-600 uppercase">Capital remboursé</td>
                <td className="px-6 py-3 text-xs font-black text-[#121c32] text-right">{sigData.credits.rembourse.toLocaleString()}</td>
              </tr>
              <tr>
                <td className="px-6 py-3 text-xs font-bold text-gray-400">70111000</td>
                <td className="px-6 py-3 text-xs font-bold text-gray-600 uppercase">Intérêts remboursés</td>
                <td className="px-6 py-3 text-xs font-black text-[#121c32] text-right">{sigData.credits.interets.toLocaleString()}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Footer */}
      <div className="bg-blue-50 border border-blue-100 rounded-3xl p-6 flex items-start gap-4">
        <div className="bg-blue-100 p-2 rounded-xl text-blue-600">
          <Calculator size={20} />
        </div>
        <div>
          <p className="text-[10px] font-black text-blue-800 uppercase tracking-widest mb-1">Note de Calcul</p>
          <p className="text-xs font-medium text-blue-700 leading-relaxed">
            Le Solde Intermédiaire de Gestion (SIG) est calculé sur la base des flux réels enregistrés dans le système pour la période sélectionnée. Les numéros de compte correspondent au plan comptable OHADA spécifique aux SFD.
          </p>
        </div>
      </div>
    </div>
  );
};

export default RegulatoryReports;
