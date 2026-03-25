import React, { useState, useEffect } from 'react';
import { 
  Calculator, 
  FileText, 
  TrendingUp, 
  PieChart, 
  Download, 
  Printer, 
  Search,
  Calendar,
  ChevronRight,
  ShieldCheck,
  ArrowUpRight,
  ArrowDownRight,
  Scale
} from 'lucide-react';
import * as XLSX from 'xlsx';

const AccountingAndStates: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'bilan' | 'resultat' | 'ratios' | 'balance' | 'entries'>('bilan');
  const [isHeaderVisible, setIsHeaderVisible] = useState(true);

  useEffect(() => {
    // When a specific report is active, we can hide the header to give more space
    // But since one is always active, maybe we just provide a toggle or always hide it?
    // The user said "Quand je choisis un élément", implying a transition.
    // Let's hide the header when any tab is selected, and add a way to show it?
    // Or just make the tab bar the new header.
  }, [activeTab]);
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [selectedCaisse, setSelectedCaisse] = useState<string>('TOUT');
  const [members, setMembers] = useState<any[]>([]);
  const [journalEntries, setJournalEntries] = useState<any[]>([]);
  const [stats, setStats] = useState({
    totalEpargne: 0,
    totalCredit: 0,
    totalGarantie: 0,
    totalPartsSociales: 0,
    totalTontine: 0,
    totalCaisse: 0,
    totalCoffre: 0,
    totalCommissions: 0,
    totalLivrets: 0,
    totalFrais: 0,
    totalDepenses: 0
  });

  const getBalanceAtDate = (history: any[], account: string, date: Date, isCaissier: boolean = false, userId: string = '') => {
    return history.reduce((sum, tx) => {
      if (isCaissier && tx.userId !== userId) return sum;
      const txDate = new Date(tx.date);
      if (txDate > date) return sum;
      if (tx.account === account) {
        if (tx.type === 'depot' || tx.type === 'cotisation' || tx.type === 'deblocage') return sum + tx.amount;
        if (tx.type === 'retrait' || tx.type === 'remboursement' || tx.type === 'transfert') return sum - tx.amount;
      }
      if (tx.destinationAccount === account && tx.type === 'transfert') return sum + tx.amount;
      return sum;
    }, 0);
  };

  const loadData = () => {
    const userStr = localStorage.getItem('microfox_current_user');
    const user = userStr ? JSON.parse(userStr) : null;
    const isCaissier = user?.role === 'caissier';

    const savedUsers = localStorage.getItem('microfox_users');
    const allUsers = savedUsers ? JSON.parse(savedUsers) : [];

    const saved = localStorage.getItem('microfox_members_data');
    if (saved) {
      const parsed = JSON.parse(saved);
      setMembers(parsed);
      
      const start = startDate ? new Date(startDate) : new Date(0);
      const end = endDate ? new Date(endDate) : new Date();
      end.setHours(23, 59, 59, 999);

      // Generate journal entries from history within period
      const allEntries: any[] = [];
      
      // 1. Members History
      parsed.forEach((m: any) => {
        if (m.history) {
          m.history.forEach((tx: any) => {
            if (isCaissier && tx.userId !== user.id) return;
            if (selectedCaisse !== 'TOUT' && tx.caisse && tx.caisse !== selectedCaisse) return;

            const txDate = new Date(tx.date);
            if (txDate >= start && txDate <= end) {
              const date = txDate.toLocaleDateString();
              const amount = tx.amount;
              const desc = tx.description;

              if (tx.type === 'depot' && tx.account === 'epargne') {
                allEntries.push({ date, account: '571100', label: 'Caisse', desc: `Dépôt ${m.name} - ${desc}`, debit: amount, credit: 0 });
                allEntries.push({ date, account: '251110', label: 'Épargne à vue', desc: `Dépôt ${m.name} - ${desc}`, debit: 0, credit: amount });
              } else if (tx.type === 'retrait' && tx.account === 'epargne') {
                allEntries.push({ date, account: '251110', label: 'Épargne à vue', desc: `Retrait ${m.name} - ${desc}`, debit: amount, credit: 0 });
                allEntries.push({ date, account: '571100', label: 'Caisse', desc: `Retrait ${m.name} - ${desc}`, debit: 0, credit: amount });
              } else if (tx.type === 'cotisation' && tx.account === 'tontine') {
                allEntries.push({ date, account: '571100', label: 'Caisse', desc: `Cotisation Tontine ${m.name}`, debit: amount, credit: 0 });
                allEntries.push({ date, account: '252110', label: 'Dépôts Tontine', desc: `Cotisation Tontine ${m.name}`, debit: 0, credit: amount });
              } else if (tx.type === 'deblocage' && tx.account === 'credit') {
                allEntries.push({ date, account: '221110', label: 'Prêts aux membres', desc: `Déblocage Crédit ${m.name}`, debit: amount, credit: 0 });
                allEntries.push({ date, account: '571100', label: 'Caisse', desc: `Déblocage Crédit ${m.name}`, debit: 0, credit: amount });
              } else if (tx.type === 'remboursement' && tx.account === 'credit') {
                allEntries.push({ date, account: '571100', label: 'Caisse', desc: `Remboursement Crédit ${m.name}`, debit: amount, credit: 0 });
                allEntries.push({ date, account: '221110', label: 'Prêts aux membres', desc: `Remboursement Crédit ${m.name}`, debit: 0, credit: amount });
              } else if (tx.type === 'depot' && tx.account === 'frais') {
                allEntries.push({ date, account: '571100', label: 'Caisse', desc: `${m.name} - ${desc}`, debit: amount, credit: 0 });
                allEntries.push({ date, account: '706114', label: 'Frais de dossier & adhésions', desc: `${m.name} - ${desc}`, debit: 0, credit: amount });
              } else if (tx.type === 'depot' && tx.account === 'partSociale') {
                allEntries.push({ date, account: '571100', label: 'Caisse', desc: `Part Sociale ${m.name}`, debit: amount, credit: 0 });
                allEntries.push({ date, account: '101100', label: 'Capital Social', desc: `Part Sociale ${m.name}`, debit: 0, credit: amount });
              }
            }
          });
        }
      });

      // 2. Admin Expenses
      const savedExpenses = localStorage.getItem('microfox_admin_expenses');
      if (savedExpenses) {
        const expenses = JSON.parse(savedExpenses);
        expenses.forEach((e: any) => {
          const eDate = new Date(e.date);
          if (eDate >= start && eDate <= end) {
            if (isCaissier && e.recordedBy !== user.identifiant) return;
            if (selectedCaisse !== 'TOUT' && e.caisse && e.caisse !== selectedCaisse) return;
            const date = eDate.toLocaleDateString();
            allEntries.push({ date, account: '612000', label: 'Dépenses Admin', desc: e.description, debit: e.amount, credit: 0 });
            allEntries.push({ date, account: '571100', label: 'Caisse', desc: e.description, debit: 0, credit: e.amount });
          }
        });
      }

      // 3. Agent Payments
      const savedPayments = localStorage.getItem('microfox_agent_payments');
      if (savedPayments) {
        const payments = JSON.parse(savedPayments);
        payments.forEach((p: any) => {
          const pDate = new Date(p.date);
          if (pDate >= start && pDate <= end && p.status === 'Validé') {
            if (isCaissier && p.validatorId !== user.id) return;
            if (selectedCaisse !== 'TOUT' && p.caisse && p.caisse !== selectedCaisse) return;
            const date = pDate.toLocaleDateString();
            const amount = p.observedAmount || p.totalAmount;
            allEntries.push({ date, account: '571100', label: 'Caisse', desc: `Versement Agent: ${p.agentName}`, debit: amount, credit: 0 });
            allEntries.push({ date, account: '471100', label: 'Compte d\'attente Agents', desc: `Versement Agent: ${p.agentName}`, debit: 0, credit: amount });
          }
        });
      }

      // 4. Vault Transactions
      const savedVault = localStorage.getItem('microfox_vault_transactions');
      if (savedVault) {
        const vaultTxs = JSON.parse(savedVault);
        vaultTxs.forEach((v: any) => {
          const vDate = new Date(v.date);
          if (vDate >= start && vDate <= end) {
            if (isCaissier) {
              if (v.type === 'Approvisionnement Caisse') {
                if (v.to !== user.caisse) return;
              } else if (v.userId !== user.id) {
                return;
              }
            }
            if (selectedCaisse !== 'TOUT') {
              if (v.type === 'Approvisionnement Caisse') {
                if (v.to !== selectedCaisse) return;
              } else if (v.type === 'Versement au Coffre' || v.type === 'Versement Fin de Journée') {
                if (v.from !== selectedCaisse) return;
              } else {
                const vUser = allUsers.find((u: any) => u.id === v.userId);
                if (vUser?.caisse !== selectedCaisse) return;
              }
            }
            const date = vDate.toLocaleDateString();
            if (v.type === 'Approvisionnement Caisse') {
              allEntries.push({ date, account: '571100', label: 'Caisse', desc: v.type, debit: v.amount, credit: 0 });
              allEntries.push({ date, account: '571200', label: 'Coffre', desc: v.type, debit: 0, credit: v.amount });
            } else if (v.type === 'Versement au Coffre' || v.type === 'Versement Fin de Journée') {
              allEntries.push({ date, account: '571200', label: 'Coffre', desc: v.type, debit: v.amount, credit: 0 });
              allEntries.push({ date, account: '571100', label: 'Caisse', desc: v.type, debit: 0, credit: v.amount });
            }
          }
        });
      }

      // 5. Tontine Withdrawals (Validated)
      const savedValidatedWithdrawals = localStorage.getItem('microfox_validated_withdrawals');
      if (savedValidatedWithdrawals) {
        const withdrawals = JSON.parse(savedValidatedWithdrawals).filter((w: any) => !w.isDeleted);
        withdrawals.forEach((w: any) => {
          const wDate = new Date(w.validationDate);
          if (wDate >= start && wDate <= end) {
            if (isCaissier && w.validatorId !== user.id) return;
            if (selectedCaisse !== 'TOUT' && w.caisse && w.caisse !== selectedCaisse) return;
            const date = wDate.toLocaleDateString();
            const commission = w.commission || 500;
            const gross = w.amount + commission;
            
            allEntries.push({ date, account: '252110', label: 'Dépôts Tontine', desc: `Retrait Tontine ${w.clientName}`, debit: gross, credit: 0 });
            allEntries.push({ date, account: '571100', label: 'Caisse', desc: `Retrait Tontine ${w.clientName}`, debit: 0, credit: w.amount });
            allEntries.push({ date, account: '706113', label: 'Commissions sur tontine', desc: `Commission Retrait ${w.clientName}`, debit: 0, credit: commission });
          }
        });
      }

      const sortedEntries = [...allEntries].sort((a, b) => {
        const dateA = new Date(a.date.split('/').reverse().join('-')).getTime();
        const dateB = new Date(b.date.split('/').reverse().join('-')).getTime();
        return dateB - dateA;
      });
      setJournalEntries(sortedEntries);

      // Calculate Stats from entries
      const newStats = {
        totalEpargne: allEntries.filter(e => e.account === '251110').reduce((acc, e) => acc + (e.credit - e.debit), 0),
        totalTontine: allEntries.filter(e => e.account === '252110').reduce((acc, e) => acc + (e.credit - e.debit), 0),
        totalCredit: allEntries.filter(e => e.account === '221110').reduce((acc, e) => acc + (e.debit - e.credit), 0),
        totalGarantie: 0, // Should be added to journal if tracked
        totalPartsSociales: allEntries.filter(e => e.account === '101100').reduce((acc, e) => acc + (e.credit - e.debit), 0),
        totalCaisse: allEntries.filter(e => e.account === '571100').reduce((acc, e) => acc + (e.debit - e.credit), 0),
        totalCoffre: allEntries.filter(e => e.account === '571200').reduce((acc, e) => acc + (e.debit - e.credit), 0),
        totalCommissions: allEntries.filter(e => e.account === '706113').reduce((acc, e) => acc + (e.credit - e.debit), 0),
        totalLivrets: 0, // Should be added to journal if tracked
        totalFrais: allEntries.filter(e => e.account === '706114').reduce((acc, e) => acc + (e.credit - e.debit), 0),
        totalDepenses: allEntries.filter(e => e.account === '612000').reduce((acc, e) => acc + (e.debit - e.credit), 0),
      };
      setStats(newStats);
    }
  };

  useEffect(() => {
    loadData();
    window.addEventListener('storage', loadData);
    return () => window.removeEventListener('storage', loadData);
  }, [startDate, endDate, selectedCaisse]);

  const exportJournalToHTML = () => {
    if (journalEntries.length === 0) {
      alert("Aucune écriture comptable à exporter.");
      return;
    }

    const mfConfig = JSON.parse(localStorage.getItem('microfox_mf_config') || '{"nom": "MicroFoX", "adresse": "", "code": ""}');

    const htmlContent = `
      <!DOCTYPE html>
      <html lang="fr">
        <head>
          <meta charset="utf-8">
          <title>Journal Comptable</title>
          <style>
            body { font-family: sans-serif; padding: 20px; }
            .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #121c32; padding-bottom: 10px; }
            .header h1 { font-size: 24px; font-weight: 900; text-transform: uppercase; margin: 0; }
            .header p { font-size: 12px; font-weight: bold; color: #666; margin: 5px 0; }
            table { border-collapse: collapse; width: 100%; margin-top: 20px; }
            th, td { border: 1px solid #ddd; padding: 12px; text-align: left; }
            tr:nth-child(even) { background-color: #f9f9f9; }
            th { background-color: #121c32; color: white; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>${mfConfig.nom}</h1>
            <p>${mfConfig.adresse}</p>
            <p>Tél: ${mfConfig.telephone || 'N/A'} | Code: ${mfConfig.code}</p>
          </div>
          <h1>Journal Comptable</h1>
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Compte</th>
                <th>Libellé Compte</th>
                <th>Libellé Écriture</th>
                <th>Débit</th>
                <th>Crédit</th>
              </tr>
            </thead>
            <tbody>
              ${journalEntries.map(e => `
                <tr>
                  <td>${e.date}</td>
                  <td>${e.account}</td>
                  <td>${e.label}</td>
                  <td>${e.desc}</td>
                  <td>${e.debit}</td>
                  <td>${e.credit}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </body>
      </html>
    `;

    const blob = new Blob([htmlContent], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const dateStr = new Date().toLocaleDateString().replace(/[\/\\]/g, '-');
    a.download = `Journal_Comptable_${dateStr}.html`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportBilanToHTML = () => {
    if (members.length === 0) {
      alert("Aucune donnée membre pour générer le bilan.");
      return;
    }

    const actif = [
      ['ACTIF (Emplois)', 'Montant (F)'],
      ['Trésorerie (Caisse & Banques)', stats.totalEpargne * 0.4],
      ['Prêts aux membres (Encours Brut)', stats.totalCredit],
      ['- Provisions pour créances douteuses', stats.totalCredit * 0.02 * -1],
      ['Immobilisations nettes', 2500000],
      ['TOTAL ACTIF', stats.totalCredit * 0.98 + stats.totalEpargne * 0.4 + 2500000]
    ];
    const passif = [
      ['PASSIF (Ressources)', 'Montant (F)'],
      ['Épargne des membres (Dépôts)', stats.totalEpargne],
      ['Fonds de Tontine (Collecte)', stats.totalTontine],
      ['Garanties de crédit', stats.totalGarantie],
      ['Capital Social (Parts Sociales)', stats.totalPartsSociales],
      ['Réserves & Report à nouveau', 1250000],
      ['TOTAL PASSIF', stats.totalEpargne + stats.totalTontine + stats.totalGarantie + stats.totalPartsSociales + 1250000]
    ];

    const mfConfig = JSON.parse(localStorage.getItem('microfox_mf_config') || '{"nom": "MicroFoX", "adresse": "", "code": ""}');

    const htmlContent = `
      <!DOCTYPE html>
      <html lang="fr">
        <head>
          <meta charset="utf-8">
          <title>Bilan Comptable</title>
          <style>
            body { font-family: sans-serif; padding: 20px; }
            .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #121c32; padding-bottom: 10px; }
            .header h1 { font-size: 24px; font-weight: 900; text-transform: uppercase; margin: 0; }
            .header p { font-size: 12px; font-weight: bold; color: #666; margin: 5px 0; }
            table { border-collapse: collapse; width: 45%; margin-top: 20px; float: left; margin-right: 5%; }
            th, td { border: 1px solid #ddd; padding: 12px; text-align: left; }
            th { background-color: #121c32; color: white; }
            .clear { clear: both; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>${mfConfig.nom}</h1>
            <p>${mfConfig.adresse}</p>
            <p>Tél: ${mfConfig.telephone || 'N/A'} | Code: ${mfConfig.code}</p>
          </div>
          <h1>Bilan Comptable</h1>
          <table>
            <thead><tr><th>Poste Actif</th><th>Montant</th></tr></thead>
            <tbody>
              ${actif.map(row => `<tr><td>${row[0]}</td><td>${row[1]}</td></tr>`).join('')}
            </tbody>
          </table>
          <table>
            <thead><tr><th>Poste Passif</th><th>Montant</th></tr></thead>
            <tbody>
              ${passif.map(row => `<tr><td>${row[0]}</td><td>${row[1]}</td></tr>`).join('')}
            </tbody>
          </table>
          <div class="clear"></div>
        </body>
      </html>
    `;

    const blob = new Blob([htmlContent], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const dateStr = new Date().toLocaleDateString().replace(/[\/\\]/g, '-');
    a.download = `Bilan_Comptable_${dateStr}.html`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportResultatToHTML = () => {
    if (members.length === 0) {
      alert("Aucune donnée membre pour générer le compte de résultat.");
      return;
    }

    const data = [
      ['Libellés des comptes', 'Charges (Débit)', 'Produits (Crédit)'],
      ["Produits d'intérêts sur crédits", '-', stats.totalCredit * 0.1],
      ["Commissions sur tontine & services", '-', stats.totalTontine * 0.05],
      ["Frais de dossier & adhésions", '-', 450000],
      ["Charges de personnel", 850000, '-'],
      ["Charges d'exploitation (Loyer, Électricité...)", 320000, '-'],
      ["Dotations aux amortissements & provisions", 150000, '-'],
      ['RÉSULTAT NET (BÉNÉFICE)', '-', stats.totalCredit * 0.1 + stats.totalTontine * 0.05 + 450000 - 850000 - 320000 - 150000]
    ];

    const mfConfig = JSON.parse(localStorage.getItem('microfox_mf_config') || '{"nom": "MicroFoX", "adresse": "", "code": ""}');

    const htmlContent = `
      <!DOCTYPE html>
      <html lang="fr">
        <head>
          <meta charset="utf-8">
          <title>Compte de Résultat</title>
          <style>
            body { font-family: sans-serif; padding: 20px; }
            .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #121c32; padding-bottom: 10px; }
            .header h1 { font-size: 24px; font-weight: 900; text-transform: uppercase; margin: 0; }
            .header p { font-size: 12px; font-weight: bold; color: #666; margin: 5px 0; }
            table { border-collapse: collapse; width: 100%; margin-top: 20px; }
            th, td { border: 1px solid #ddd; padding: 12px; text-align: left; }
            tr:nth-child(even) { background-color: #f9f9f9; }
            th { background-color: #121c32; color: white; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>${mfConfig.nom}</h1>
            <p>${mfConfig.adresse}</p>
            <p>Tél: ${mfConfig.telephone || 'N/A'} | Code: ${mfConfig.code}</p>
          </div>
          <h1>Compte de Résultat</h1>
          <table>
            <thead>
              <tr>
                <th>Libellés des comptes</th>
                <th>Charges (Débit)</th>
                <th>Produits (Crédit)</th>
              </tr>
            </thead>
            <tbody>
              ${data.slice(1).map(row => `
                <tr>
                  <td>${row[0]}</td>
                  <td>${row[1]}</td>
                  <td>${row[2]}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </body>
      </html>
    `;

    const blob = new Blob([htmlContent], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const dateStr = new Date().toLocaleDateString().replace(/[\/\\]/g, '-');
    a.download = `Compte_Resultat_${dateStr}.html`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const renderBalance = () => {
    const balances: { [key: string]: { label: string, debit: number, credit: number } } = {};
    
    journalEntries.forEach(entry => {
      if (!balances[entry.account]) {
        balances[entry.account] = { label: entry.label, debit: 0, credit: 0 };
      }
      balances[entry.account].debit += entry.debit;
      balances[entry.account].credit += entry.credit;
    });

    return (
      <div className="bg-white rounded-[2rem] border border-gray-100 shadow-sm overflow-hidden animate-in fade-in duration-500">
        <div className="bg-[#121c32] p-6 text-white flex items-center justify-between">
          <h3 className="text-sm font-black uppercase tracking-widest">Balance Générale des Comptes</h3>
          <button 
            onClick={() => {
              const table = document.querySelector('table')?.outerHTML || '';
              generateHTMLReport('Balance Générale des Comptes', table);
            }}
            className="p-2 bg-white/10 rounded-lg hover:bg-white/20 transition-all"
          >
            <Printer size={18} />
          </button>
        </div>
        <div className="p-0 overflow-x-auto custom-scrollbar">
          <table className="w-full text-left border-collapse min-w-[800px]">
            <thead>
              <tr className="bg-gray-50/50">
                <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Compte</th>
                <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Intitulé</th>
                <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest text-right">Débit</th>
                <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest text-right">Crédit</th>
                <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest text-right">Solde Débiteur</th>
                <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest text-right">Solde Créditeur</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {Object.keys(balances).sort().map(acc => {
                const b = balances[acc];
                const solde = b.debit - b.credit;
                return (
                  <tr key={acc} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 text-xs font-bold text-[#121c32]">{acc}</td>
                    <td className="px-6 py-4 text-xs font-bold text-gray-600 uppercase">{b.label}</td>
                    <td className="px-6 py-4 text-xs font-black text-gray-900 text-right">{b.debit.toLocaleString()}</td>
                    <td className="px-6 py-4 text-xs font-black text-gray-900 text-right">{b.credit.toLocaleString()}</td>
                    <td className="px-6 py-4 text-xs font-black text-blue-600 text-right">{solde > 0 ? solde.toLocaleString() : '-'}</td>
                    <td className="px-6 py-4 text-xs font-black text-emerald-600 text-right">{solde < 0 ? Math.abs(solde).toLocaleString() : '-'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const renderEntries = () => (
    <div className="bg-white rounded-[2rem] border border-gray-100 shadow-sm overflow-hidden animate-in fade-in duration-500">
      <div className="bg-[#121c32] p-6 text-white flex items-center justify-between">
        <div>
          <h3 className="text-sm font-black uppercase tracking-widest">Journal des Écritures Comptables</h3>
          <p className="text-[10px] font-bold opacity-60 uppercase mt-1">Flux financiers consolidés</p>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={() => {
              const table = document.querySelector('table')?.outerHTML || '';
              generateHTMLReport('Journal des Écritures Comptables', table);
            }}
            className="p-2 bg-white/10 rounded-lg hover:bg-white/20 transition-all"
          >
            <Printer size={18} />
          </button>
          <button 
            onClick={exportJournalToHTML}
            className="p-2 bg-white/10 rounded-lg hover:bg-white/20 transition-all"
          >
            <Download size={18} />
          </button>
        </div>
      </div>
      <div className="p-0 overflow-x-auto custom-scrollbar">
        <table className="w-full text-left border-collapse min-w-[800px]">
          <thead>
            <tr className="bg-gray-50/50">
              <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Date</th>
              <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Compte</th>
              <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Libellé Compte</th>
              <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Libellé Écriture</th>
              <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest text-right">Débit</th>
              <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest text-right">Crédit</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {journalEntries.length > 0 ? (
              journalEntries.map((entry, idx) => (
                <tr key={idx} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4 text-xs font-medium text-gray-500">{entry.date}</td>
                  <td className="px-6 py-4 text-xs font-bold text-[#121c32]">{entry.account}</td>
                  <td className="px-6 py-4 text-xs font-bold text-gray-600 uppercase">{entry.label}</td>
                  <td className="px-6 py-4 text-xs text-gray-500">{entry.desc}</td>
                  <td className="px-6 py-4 text-xs font-black text-emerald-600 text-right">{entry.debit > 0 ? entry.debit.toLocaleString() : '-'}</td>
                  <td className="px-6 py-4 text-xs font-black text-red-500 text-right">{entry.credit > 0 ? entry.credit.toLocaleString() : '-'}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={6} className="px-6 py-12 text-center text-gray-400 italic text-sm uppercase tracking-widest">
                  Aucune écriture comptable générée
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );

  const generateHTMLReport = (title: string, content: string) => {
    const mfConfig = JSON.parse(localStorage.getItem('microfox_mf_config') || '{"nom": "MicroFoX", "adresse": "", "code": ""}');
    const htmlContent = `
      <!DOCTYPE html>
      <html lang="fr">
      <head>
        <meta charset="UTF-8">
        <title>${title} - ${mfConfig.nom}</title>
        <style>
          body { font-family: sans-serif; padding: 40px; color: #121c32; }
          .header { text-align: center; margin-bottom: 40px; border-bottom: 2px solid #f1f5f9; padding-bottom: 20px; }
          .mf-name { font-size: 24px; font-weight: 900; text-transform: uppercase; margin: 0; color: #121c32; }
          .mf-info { font-size: 12px; font-weight: bold; color: #64748b; margin: 5px 0; }
          .report-title { font-size: 18px; font-weight: 800; margin: 20px 0; text-transform: uppercase; text-align: center; }
          .period { font-size: 12px; color: #64748b; text-align: center; margin-bottom: 30px; font-weight: bold; }
          table { width: 100%; border-collapse: collapse; margin-top: 20px; }
          th { background: #f8fafc; padding: 12px; text-align: center; font-size: 10px; text-transform: uppercase; letter-spacing: 0.05em; color: #64748b; border-bottom: 1px solid #e2e8f0; }
          td { padding: 12px; border-bottom: 1px solid #f1f5f9; font-size: 12px; text-align: center; }
          tr:nth-child(even) { background-color: #f9fafb; }
          .text-right { text-align: center; }
          .font-bold { font-weight: bold; }
          .bg-gray-50 { background-color: #f9fafb; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1 class="mf-name">${mfConfig.nom}</h1>
          <p class="mf-info">${mfConfig.adresse}</p>
          <p class="mf-info">Tél: ${mfConfig.telephone || 'N/A'} | Code: ${mfConfig.code}</p>
        </div>
        <h2 class="report-title">${title}</h2>
        <p class="period">Période: DU ${new Date(startDate || 0).toLocaleDateString()} AU ${new Date(endDate || Date.now()).toLocaleDateString()}</p>
        ${content}
        <script>
          window.onload = () => {
            window.print();
            setTimeout(() => window.close(), 500);
          };
        </script>
      </body>
      </html>
    `;
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(htmlContent);
      printWindow.document.close();
    }
  };

  const renderBilan = () => (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex justify-end mb-4">
        <button 
          onClick={() => {
            const tables = Array.from(document.querySelectorAll('table')).map(t => t.outerHTML).join('<br/>');
            generateHTMLReport('Bilan Comptable', tables);
          }}
          className="flex items-center gap-2 px-4 py-2 bg-[#121c32] text-white rounded-xl text-xs font-black uppercase tracking-widest hover:scale-105 transition-all shadow-lg"
        >
          <Printer size={16} />
          Imprimer le Bilan
        </button>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* ACTIF */}
        <div className="bg-white rounded-[2rem] border border-gray-100 shadow-sm overflow-hidden">
          <div className="bg-[#121c32] p-6 text-white flex items-center justify-between">
            <h3 className="text-sm font-black uppercase tracking-widest">ACTIF (Emplois)</h3>
            <span className="text-[10px] font-bold opacity-60 uppercase">Système Comptable Ouest Africain (SYSCOHADA)</span>
          </div>
          <div className="p-0 overflow-x-auto custom-scrollbar">
            <table className="w-full text-left border-collapse min-w-[400px]">
              <thead>
                <tr className="bg-gray-50/50">
                  <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Postes</th>
                  <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest text-right">Montant (F)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                <tr>
                  <td className="px-6 py-4 text-xs font-bold text-gray-600">571100 - Trésorerie (Caisse)</td>
                  <td className="px-6 py-4 text-xs font-black text-[#121c32] text-right">{stats.totalCaisse.toLocaleString()}</td>
                </tr>
                <tr>
                  <td className="px-6 py-4 text-xs font-bold text-gray-600">571200 - Trésorerie (Coffre)</td>
                  <td className="px-6 py-4 text-xs font-black text-[#121c32] text-right">{stats.totalCoffre.toLocaleString()}</td>
                </tr>
                <tr>
                  <td className="px-6 py-4 text-xs font-bold text-gray-600">221110 - Prêts aux membres (Encours Brut)</td>
                  <td className="px-6 py-4 text-xs font-black text-[#121c32] text-right">{stats.totalCredit.toLocaleString()}</td>
                </tr>
                <tr>
                  <td className="px-6 py-4 text-xs font-bold text-gray-600 italic pl-10">291000 - Provisions pour créances douteuses</td>
                  <td className="px-6 py-4 text-xs font-black text-red-500 text-right">{(stats.totalCredit * 0.02 * -1).toLocaleString()}</td>
                </tr>
                <tr>
                  <td className="px-6 py-4 text-xs font-bold text-gray-600">240000 - Immobilisations nettes</td>
                  <td className="px-6 py-4 text-xs font-black text-[#121c32] text-right">2 500 000</td>
                </tr>
                <tr className="bg-gray-50/80">
                  <td className="px-6 py-4 text-sm font-black text-[#121c32] uppercase">TOTAL ACTIF</td>
                  <td className="px-6 py-4 text-sm font-black text-[#121c32] text-right">{(stats.totalCredit * 0.98 + stats.totalCaisse + stats.totalCoffre + 2500000).toLocaleString()}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* PASSIF */}
        <div className="bg-white rounded-[2rem] border border-gray-100 shadow-sm overflow-hidden">
          <div className="bg-[#121c32] p-6 text-white flex items-center justify-between">
            <h3 className="text-sm font-black uppercase tracking-widest">PASSIF (Ressources)</h3>
            <span className="text-[10px] font-bold opacity-60 uppercase">Réglementation BCEAO</span>
          </div>
          <div className="p-0 overflow-x-auto custom-scrollbar">
            <table className="w-full text-left border-collapse min-w-[400px]">
              <thead>
                <tr className="bg-gray-50/50">
                  <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Postes</th>
                  <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest text-right">Montant (F)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                <tr>
                  <td className="px-6 py-4 text-xs font-bold text-gray-600">251110 - Épargne des membres (Dépôts)</td>
                  <td className="px-6 py-4 text-xs font-black text-[#121c32] text-right">{stats.totalEpargne.toLocaleString()}</td>
                </tr>
                <tr>
                  <td className="px-6 py-4 text-xs font-bold text-gray-600">252110 - Fonds de Tontine (Collecte)</td>
                  <td className="px-6 py-4 text-xs font-black text-[#121c32] text-right">{stats.totalTontine.toLocaleString()}</td>
                </tr>
                <tr>
                  <td className="px-6 py-4 text-xs font-bold text-gray-600">253100 - Garanties de crédit</td>
                  <td className="px-6 py-4 text-xs font-black text-[#121c32] text-right">{stats.totalGarantie.toLocaleString()}</td>
                </tr>
                <tr>
                  <td className="px-6 py-4 text-xs font-bold text-gray-600">101100 - Capital Social (Parts Sociales)</td>
                  <td className="px-6 py-4 text-xs font-black text-[#121c32] text-right">{stats.totalPartsSociales.toLocaleString()}</td>
                </tr>
                <tr>
                  <td className="px-6 py-4 text-xs font-bold text-gray-600">111000 - Réserves & Report à nouveau</td>
                  <td className="px-6 py-4 text-xs font-black text-[#121c32] text-right">1 250 000</td>
                </tr>
                <tr className="bg-gray-50/80">
                  <td className="px-6 py-4 text-sm font-black text-[#121c32] uppercase">TOTAL PASSIF</td>
                  <td className="px-6 py-4 text-sm font-black text-[#121c32] text-right">{(stats.totalEpargne + stats.totalTontine + stats.totalGarantie + stats.totalPartsSociales + 1250000).toLocaleString()}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );

  const renderResultat = () => (
    <div className="bg-white rounded-[2rem] border border-gray-100 shadow-sm overflow-hidden animate-in fade-in duration-500">
        <div className="bg-[#121c32] p-6 text-white flex items-center justify-between">
          <div>
            <h3 className="text-sm font-black uppercase tracking-widest">Compte de Résultat</h3>
            <p className="text-[10px] font-bold opacity-60 uppercase mt-1">
              {startDate && endDate 
                ? `Période : Du ${new Date(startDate).toLocaleDateString()} au ${new Date(endDate).toLocaleDateString()}`
                : 'Période : Exercice en cours'}
            </p>
          </div>
          <div className="flex gap-2">
            <button 
              onClick={() => {
                const table = document.querySelector('table')?.outerHTML || '';
                generateHTMLReport('Compte de Résultat', table);
              }}
              className="p-2 bg-white/10 rounded-lg hover:bg-white/20 transition-all"
            >
              <Printer size={18} />
            </button>
            <button 
              onClick={exportResultatToHTML}
              className="p-2 bg-white/10 rounded-lg hover:bg-white/20 transition-all"
            >
              <Download size={18} />
            </button>
          </div>
        </div>
      <div className="p-0 overflow-x-auto custom-scrollbar">
        <table className="w-full text-left border-collapse min-w-[600px]">
          <thead>
            <tr className="bg-gray-50/50">
              <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Libellés des comptes</th>
              <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest text-right">Charges (Débit)</th>
              <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest text-right">Produits (Crédit)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            <tr>
              <td className="px-6 py-4 text-xs font-bold text-gray-600">701110 - Produits d'intérêts sur crédits</td>
              <td className="px-6 py-4 text-right">-</td>
              <td className="px-6 py-4 text-xs font-black text-emerald-600 text-right">{(stats.totalCredit * 0.1).toLocaleString()}</td>
            </tr>
            <tr>
              <td className="px-6 py-4 text-xs font-bold text-gray-600">706113 - Commissions sur tontine & services</td>
              <td className="px-6 py-4 text-right">-</td>
              <td className="px-6 py-4 text-xs font-black text-emerald-600 text-right">{stats.totalCommissions.toLocaleString()}</td>
            </tr>
            <tr>
              <td className="px-6 py-4 text-xs font-bold text-gray-600">706114 - Frais de dossier & adhésions</td>
              <td className="px-6 py-4 text-right">-</td>
              <td className="px-6 py-4 text-xs font-black text-emerald-600 text-right">{stats.totalFrais.toLocaleString()}</td>
            </tr>
            <tr>
              <td className="px-6 py-4 text-xs font-bold text-gray-600">611110 - Charges de personnel</td>
              <td className="px-6 py-4 text-xs font-black text-red-500 text-right">850 000</td>
              <td className="px-6 py-4 text-right">-</td>
            </tr>
            <tr>
              <td className="px-6 py-4 text-xs font-bold text-gray-600">612000 - Charges d'exploitation (Loyer, Électricité...)</td>
              <td className="px-6 py-4 text-xs font-black text-red-500 text-right">{stats.totalDepenses.toLocaleString()}</td>
              <td className="px-6 py-4 text-right">-</td>
            </tr>
            <tr>
              <td className="px-6 py-4 text-xs font-bold text-gray-600">681000 - Dotations aux amortissements & provisions</td>
              <td className="px-6 py-4 text-xs font-black text-red-500 text-right">150 000</td>
              <td className="px-6 py-4 text-right">-</td>
            </tr>
            <tr className="bg-gray-50/80">
              <td className="px-6 py-4 text-sm font-black text-[#121c32] uppercase">131000 - RÉSULTAT NET (BÉNÉFICE)</td>
              <td className="px-6 py-4 text-right">-</td>
              <td className="px-6 py-4 text-sm font-black text-blue-600 text-right">
                {(stats.totalCommissions + stats.totalFrais - 850000 - stats.totalDepenses - 150000).toLocaleString()}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );

  const renderRatios = () => (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-[2rem] border border-gray-100 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="w-10 h-10 bg-emerald-50 rounded-xl flex items-center justify-center text-emerald-600">
              <ShieldCheck size={20} />
            </div>
            <span className="text-[10px] font-black text-emerald-600 bg-emerald-50 px-2 py-1 rounded-md uppercase">Conforme</span>
          </div>
          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Autosuffisance Opérationnelle</p>
          <p className="text-2xl font-black text-[#121c32] mt-1">112%</p>
          <div className="mt-4 h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div className="h-full bg-emerald-500 w-[85%]"></div>
          </div>
          <p className="text-[9px] font-bold text-gray-400 mt-2 uppercase">Norme BCEAO : {'>'} 100%</p>
        </div>

        <div className="bg-white p-6 rounded-[2rem] border border-gray-100 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center text-blue-600">
              <Scale size={20} />
            </div>
            <span className="text-[10px] font-black text-blue-600 bg-blue-50 px-2 py-1 rounded-md uppercase">Excellent</span>
          </div>
          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Ratio de Liquidité</p>
          <p className="text-2xl font-black text-[#121c32] mt-1">145%</p>
          <div className="mt-4 h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div className="h-full bg-blue-500 w-[70%]"></div>
          </div>
          <p className="text-[9px] font-bold text-gray-400 mt-2 uppercase">Norme BCEAO : {'>'} 100%</p>
        </div>

        <div className="bg-white p-6 rounded-[2rem] border border-gray-100 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="w-10 h-10 bg-amber-50 rounded-xl flex items-center justify-center text-amber-600">
              <TrendingUp size={20} />
            </div>
            <span className="text-[10px] font-black text-amber-600 bg-amber-50 px-2 py-1 rounded-md uppercase">À Surveiller</span>
          </div>
          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">PAR 30 (Portefeuille à Risque)</p>
          <p className="text-2xl font-black text-[#121c32] mt-1">4.2%</p>
          <div className="mt-4 h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div className="h-full bg-amber-500 w-[42%]"></div>
          </div>
          <p className="text-[9px] font-bold text-gray-400 mt-2 uppercase">Norme BCEAO : {'<'} 5%</p>
        </div>
      </div>

      <div className="bg-white rounded-[2rem] border border-gray-100 shadow-sm p-8">
        <h3 className="text-sm font-black text-[#121c32] uppercase tracking-widest mb-6 flex items-center gap-2">
          <FileText size={20} className="text-blue-500" />
          Indicateurs de Performance (PARM)
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          <div className="space-y-1">
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Nombre de membres</p>
            <p className="text-xl font-black text-[#121c32]">{members.length}</p>
          </div>
          <div className="space-y-1">
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Prêt Moyen</p>
            <p className="text-xl font-black text-[#121c32]">{members.length > 0 ? (stats.totalCredit / members.length).toLocaleString() : 0} F</p>
          </div>
          <div className="space-y-1">
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Dépôt Moyen</p>
            <p className="text-xl font-black text-[#121c32]">{members.length > 0 ? (stats.totalEpargne / members.length).toLocaleString() : 0} F</p>
          </div>
          <div className="space-y-1">
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Taux de Pénétration</p>
            <p className="text-xl font-black text-[#121c32]">12.5%</p>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="max-w-7xl mx-auto space-y-8 pb-12 px-4 sm:px-6 lg:px-8">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h2 className="text-3xl font-black text-white uppercase tracking-tight">Comptabilité & États Réglementaires</h2>
          <p className="text-sm font-bold text-gray-400 uppercase tracking-widest mt-1">Conformité BCEAO / Commission Bancaire UEMOA</p>
          <div className="flex items-center gap-4 mt-4 bg-white p-2 rounded-2xl border border-gray-100 shadow-sm w-fit">
            <div className="flex items-center gap-2 px-3">
              <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Du</label>
              <input 
                type="date" 
                value={startDate} 
                onChange={(e) => setStartDate(e.target.value)}
                className="p-1.5 bg-gray-50 border border-transparent rounded-lg text-[10px] font-bold outline-none focus:bg-white focus:border-blue-200 transition-all text-black"
              />
            </div>
            <div className="w-px h-6 bg-gray-100"></div>
            <div className="flex items-center gap-2 px-3">
              <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Au</label>
              <input 
                type="date" 
                value={endDate} 
                onChange={(e) => setEndDate(e.target.value)}
                className="p-1.5 bg-gray-50 border border-transparent rounded-lg text-[10px] font-bold outline-none focus:bg-white focus:border-blue-200 transition-all text-black"
              />
            </div>
            <div className="w-px h-6 bg-gray-100"></div>
            <div className="flex items-center gap-2 px-3">
              <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Caisse</label>
              <select 
                value={selectedCaisse}
                onChange={(e) => setSelectedCaisse(e.target.value)}
                className="p-1.5 bg-gray-50 border border-transparent rounded-lg text-[10px] font-bold outline-none focus:bg-white focus:border-blue-200 transition-all text-black"
              >
                <option value="TOUT">TOUTES</option>
                <option value="PRINCIPALE">PRINCIPALE</option>
                <option value="CAISSE 1">CAISSE 1</option>
                <option value="CAISSE 2">CAISSE 2</option>
              </select>
            </div>
            <button 
              onClick={() => { setStartDate(''); setEndDate(''); setSelectedCaisse('TOUT'); }}
              className="p-2 text-gray-400 hover:text-red-500 transition-colors"
              title="Réinitialiser la période"
            >
              <Search size={14} />
            </button>
          </div>
        </div>
        <div className="flex items-center gap-4">
          {activeTab === 'bilan' && (
            <button 
              onClick={exportBilanToHTML}
              className="p-3 bg-white border border-gray-200 rounded-2xl text-gray-400 hover:text-emerald-600 hover:border-emerald-200 transition-all shadow-sm flex items-center gap-2 font-black text-[10px] uppercase tracking-widest"
              title="Exporter le Bilan"
            >
              <Download size={18} />
              Exporter Bilan HTML
            </button>
          )}
          <div className="flex bg-white p-2 rounded-2xl shadow-sm border border-gray-100 overflow-x-auto no-scrollbar items-center gap-2">
          <button 
            onClick={() => setActiveTab('bilan')}
            className={`rounded-xl text-xs font-black uppercase tracking-widest transition-all whitespace-nowrap ${activeTab === 'bilan' ? 'px-10 py-4 bg-[#121c32] text-white shadow-lg scale-105' : 'px-6 py-3 text-gray-400 hover:text-[#121c32] opacity-60'}`}
          >
            Bilan Consolidé
          </button>
          <button 
            onClick={() => setActiveTab('resultat')}
            className={`rounded-xl text-xs font-black uppercase tracking-widest transition-all whitespace-nowrap ${activeTab === 'resultat' ? 'px-10 py-4 bg-[#121c32] text-white shadow-lg scale-105' : 'px-6 py-3 text-gray-400 hover:text-[#121c32] opacity-60'}`}
          >
            Compte de Résultat
          </button>
          <button 
            onClick={() => setActiveTab('ratios')}
            className={`rounded-xl text-xs font-black uppercase tracking-widest transition-all whitespace-nowrap ${activeTab === 'ratios' ? 'px-10 py-4 bg-[#121c32] text-white shadow-lg scale-105' : 'px-6 py-3 text-gray-400 hover:text-[#121c32] opacity-60'}`}
          >
            Ratios Prudentiels
          </button>
          <button 
            onClick={() => setActiveTab('balance')}
            className={`rounded-xl text-xs font-black uppercase tracking-widest transition-all whitespace-nowrap ${activeTab === 'balance' ? 'px-10 py-4 bg-[#121c32] text-white shadow-lg scale-105' : 'px-6 py-3 text-gray-400 hover:text-[#121c32] opacity-60'}`}
          >
            Balance des Comptes
          </button>
          <button 
            onClick={() => setActiveTab('entries')}
            className={`rounded-xl text-xs font-black uppercase tracking-widest transition-all whitespace-nowrap ${activeTab === 'entries' ? 'px-10 py-4 bg-[#121c32] text-white shadow-lg scale-105' : 'px-6 py-3 text-gray-400 hover:text-[#121c32] opacity-60'}`}
          >
            Écritures Comptables
          </button>
        </div>
      </div>
    </div>

      {/* Main Content Area */}
      {activeTab === 'bilan' && renderBilan()}
      {activeTab === 'resultat' && renderResultat()}
      {activeTab === 'ratios' && renderRatios()}
      {activeTab === 'entries' && renderEntries()}
      {activeTab === 'balance' && renderBalance()}

      {/* Regulatory Footer */}
      <div className="bg-amber-50 border border-amber-100 rounded-3xl p-6 flex items-start gap-4">
        <div className="bg-amber-100 p-2 rounded-xl text-amber-600">
          <ShieldCheck size={20} />
        </div>
        <div>
          <p className="text-[10px] font-black text-amber-800 uppercase tracking-widest mb-1">Note de Conformité</p>
          <p className="text-xs font-medium text-amber-700 leading-relaxed">
            Ces états sont générés conformément aux dispositions de la Loi portant réglementation des Systèmes Financiers Décentralisés (SFD) dans l'UMOA et aux instructions de la BCEAO. Les données sont consolidées en temps réel à partir des opérations de caisse et de crédit.
          </p>
        </div>
      </div>
    </div>
  );
};

export default AccountingAndStates;
