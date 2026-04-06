
import React, { useState, useEffect, useMemo } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, 
  LineChart, Line, AreaChart, Area 
} from 'recharts';
import { 
  TrendingUp, TrendingDown, Users, BookOpen, Calendar, Filter, 
  ArrowUpRight, ArrowDownLeft, PieChart, Activity, DollarSign,
  Download, Printer, CheckSquare, Square, CreditCard, Gem
} from 'lucide-react';

const Analyse: React.FC = () => {
  const [startDate, setStartDate] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
  });
  const [selectedZone, setSelectedZone] = useState<string>('all');
  const [groupingType, setGroupingType] = useState<string>('day');
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [data, setData] = useState<any[]>([]);
  const [members, setMembers] = useState<any[]>([]);
  const [commissions, setCommissions] = useState<any[]>([]);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [mfConfig, setMfConfig] = useState<any>(null);

  const loadData = () => {
    const savedConfig = localStorage.getItem('microfox_mf_config');
    if (savedConfig) setMfConfig(JSON.parse(savedConfig));
    const savedMembers = localStorage.getItem('microfox_members_data');
    const allMembers = savedMembers ? JSON.parse(savedMembers) : [];
    setMembers(allMembers);

    const savedCommissions = localStorage.getItem('microfox_commissions_history');
    const allCommissions = savedCommissions ? JSON.parse(savedCommissions) : [];
    setCommissions(allCommissions);

    const savedExpenses = localStorage.getItem('microfox_admin_expenses');
    const allExpenses = savedExpenses ? JSON.parse(savedExpenses) : [];
    setExpenses(allExpenses);

    const allTxs: any[] = [];
    allMembers.forEach((member: any) => {
      if (member.history) {
        member.history.forEach((tx: any) => {
          allTxs.push({
            ...tx,
            memberName: member.name,
            memberCode: member.code,
            memberZone: member.zone,
            memberCreatedAt: member.createdAt
          });
        });
      }
    });
    setData(allTxs);
  };

  useEffect(() => {
    loadData();
    window.addEventListener('storage', loadData);
    return () => window.removeEventListener('storage', loadData);
  }, []);

  const filteredData = useMemo(() => {
    return data.filter(tx => {
      const txDate = tx.date.split('T')[0];
      const dateMatch = txDate >= startDate && txDate <= endDate;
      const zoneMatch = selectedZone === 'all' || tx.memberZone === selectedZone;
      return dateMatch && zoneMatch;
    });
  }, [data, startDate, endDate, selectedZone]);

  const zones = ['01', '01A', '02', '02A', '03', '03A', '04', '04A', '05', '05A', '06', '06A', '07', '07A', '08', '08A', '09', '09A'];

  const stats = useMemo(() => {
    const result = {
      tontineDepots: 0,
      tontineRetraits: 0,
      epargneDepots: 0,
      epargneRetraits: 0,
      ventesLivretTontine: 0,
      ventesLivretEpargne: 0,
      revenuVentesLivret: 0,
      commissionsTontine: 0,
      ouverturesEpargne: 0,
      ouverturesTontine: 0,
      creditDeblocages: 0,
      creditRemboursements: 0,
      creditInterets: 0,
      creditInteretsCollectes: 0,
      creditPenalitesCollectees: 0,
      creditFrais: 0,
      partsSociales: 0,
      depensesAdmin: 0
    };

    filteredData.forEach(tx => {
      const desc = (tx.description || '').toLowerCase();
      const amount = Number(tx.amount) || 0;

      // Gérer les ventes de livrets séparément des dépôts
      if (desc.includes('vente de livret')) {
        if (desc.includes('épargne')) {
          result.ventesLivretEpargne += 1;
          result.revenuVentesLivret += amount;
        } else {
          result.ventesLivretTontine += 1;
          result.revenuVentesLivret += amount;
        }
        return; // Ne pas compter comme dépôt
      }

      if (tx.account === 'tontine') {
        if (tx.type === 'depot' || tx.type === 'cotisation') result.tontineDepots += amount;
        if (tx.type === 'retrait') result.tontineRetraits += amount;
      } else if (tx.account === 'epargne') {
        if (tx.type === 'depot') result.epargneDepots += amount;
        if (tx.type === 'retrait') result.epargneRetraits += amount;
      } else if (tx.account === 'credit') {
        if (tx.type === 'deblocage') result.creditDeblocages += amount;
        if (tx.type === 'remboursement') {
          result.creditRemboursements += amount;
          // Extraire les intérêts et pénalités si disponibles
          if (tx.rembInterest) result.creditInteretsCollectes += Number(tx.rembInterest) || 0;
          if (tx.rembPenalty) result.creditPenalitesCollectees += Number(tx.rembPenalty) || 0;
        }
      } else if (tx.account === 'frais') {
        if (desc.includes('part sociale')) {
          result.partsSociales += amount;
        } else {
          result.creditFrais += amount;
        }
      } else if (tx.account === 'partSociale') {
        if (tx.type === 'depot') result.partsSociales += amount;
        if (tx.type === 'retrait') result.partsSociales -= amount;
      }
    });

    commissions.forEach(c => {
      const cDate = c.date.split('T')[0];
      if (cDate >= startDate && cDate <= endDate) {
        result.commissionsTontine += Number(c.amount) || 0;
      }
    });

    expenses.forEach(e => {
      const eDate = e.date.split('T')[0];
      if (eDate >= startDate && eDate <= endDate) {
        result.depensesAdmin += Number(e.amount) || 0;
      }
    });

    members.forEach(m => {
      const mDate = (m.createdAt || '').split('T')[0];
      const zoneMatch = selectedZone === 'all' || m.zone === selectedZone;
      if (mDate >= startDate && mDate <= endDate && zoneMatch) {
        if (m.balances?.epargne !== undefined) result.ouverturesEpargne += 1;
        if (m.tontineAccounts?.length > 0) result.ouverturesTontine += 1;
      }
      
      // Calcul des intérêts attendus sur les crédits débloqués dans la période
      if (m.lastCreditRequest?.disbursementDate) {
        const dDate = m.lastCreditRequest.disbursementDate.split('T')[0];
        if (dDate >= startDate && dDate <= endDate && zoneMatch) {
          result.creditInterets += Number(m.lastCreditRequest.interest) || 0;
        }
      } else if (m.lastCreditDetails?.dueDate) {
        // Fallback pour les anciens crédits si disbursementDate n'est pas là
        // On utilise createdAt du membre comme approximation si c'est un nouveau membre
        const mDate = (m.createdAt || '').split('T')[0];
        if (mDate >= startDate && mDate <= endDate && zoneMatch) {
          result.creditInterets += Number(m.lastCreditDetails.interest) || 0;
        }
      }
    });

    return result;
  }, [filteredData, commissions, expenses, members, startDate, endDate, selectedZone]);

  const groupedData = useMemo(() => {
    const groups: Record<string, any> = {};
    
    filteredData.forEach(tx => {
      const date = new Date(tx.date);
      let key = '';
      let label = '';
      
      if (groupingType === 'day') {
        key = tx.date.split('T')[0];
        label = new Date(key).toLocaleDateString('fr-FR');
      } else if (groupingType === 'week') {
        const day = date.getDay() || 7;
        const monday = new Date(date);
        monday.setHours(-24 * (day - 1));
        key = monday.toISOString().split('T')[0];
        label = `Semaine du ${monday.toLocaleDateString('fr-FR')}`;
      } else if (groupingType === 'month') {
        key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        label = date.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
      } else if (groupingType === 'quarter') {
        const q = Math.floor(date.getMonth() / 3) + 1;
        key = `${date.getFullYear()}-Q${q}`;
        label = `Trimestre ${q} ${date.getFullYear()}`;
      } else if (groupingType === 'semester') {
        const s = Math.floor(date.getMonth() / 6) + 1;
        key = `${date.getFullYear()}-S${s}`;
        label = `Semestre ${s} ${date.getFullYear()}`;
      } else if (groupingType === 'year') {
        key = `${date.getFullYear()}`;
        label = key;
      }

      if (!groups[key]) {
        groups[key] = {
          id: key,
          label,
          tontineDepots: 0,
          tontineRetraits: 0,
          epargneDepots: 0,
          epargneRetraits: 0,
          creditDeblocages: 0,
          creditRemboursements: 0,
          creditInterets: 0,
          creditInteretsCollectes: 0,
          creditPenalitesCollectees: 0,
          creditFrais: 0,
          commissionsTontine: 0,
          partsSociales: 0,
          depensesAdmin: 0,
          ventesLivret: 0,
          revenuVentesLivret: 0,
          ouvertures: 0
        };
      }

      const amount = Number(tx.amount) || 0;
      const desc = (tx.description || '').toLowerCase();

      if (desc.includes('vente de livret')) {
        groups[key].ventesLivret += 1;
        groups[key].revenuVentesLivret += amount;
        return;
      }

      if (tx.account === 'tontine') {
        if (tx.type === 'depot' || tx.type === 'cotisation') groups[key].tontineDepots += amount;
        if (tx.type === 'retrait') groups[key].tontineRetraits += amount;
      } else if (tx.account === 'epargne') {
        if (tx.type === 'depot') groups[key].epargneDepots += amount;
        if (tx.type === 'retrait') groups[key].epargneRetraits += amount;
      } else if (tx.account === 'credit') {
        if (tx.type === 'deblocage') groups[key].creditDeblocages += amount;
        if (tx.type === 'remboursement') {
          groups[key].creditRemboursements += amount;
          if (tx.rembInterest) groups[key].creditInteretsCollectes += Number(tx.rembInterest) || 0;
          if (tx.rembPenalty) groups[key].creditPenalitesCollectees += Number(tx.rembPenalty) || 0;
        }
      } else if (tx.account === 'frais') {
        if (desc.includes('part sociale')) {
          groups[key].partsSociales += amount;
        } else {
          groups[key].creditFrais += amount;
        }
      } else if (tx.account === 'partSociale') {
        if (tx.type === 'depot') groups[key].partsSociales += amount;
        if (tx.type === 'retrait') groups[key].partsSociales -= amount;
      }
    });

    members.forEach(m => {
      const date = new Date(m.createdAt);
      const zoneMatch = selectedZone === 'all' || m.zone === selectedZone;
      if (!zoneMatch) return;
      
      let key = '';
      if (groupingType === 'day') key = (m.createdAt || '').split('T')[0];
      else if (groupingType === 'week') {
        const day = date.getDay() || 7;
        const monday = new Date(date);
        monday.setHours(-24 * (day - 1));
        key = monday.toISOString().split('T')[0];
      } else if (groupingType === 'month') key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      else if (groupingType === 'quarter') key = `${date.getFullYear()}-Q${Math.floor(date.getMonth() / 3) + 1}`;
      else if (groupingType === 'semester') key = `${date.getFullYear()}-S${Math.floor(date.getMonth() / 6) + 1}`;
      else if (groupingType === 'year') key = `${date.getFullYear()}`;

      if (groups[key]) {
        groups[key].ouvertures += 1;
      }

      // Intérêts attendus par période (basé sur le déblocage)
      if (m.lastCreditRequest?.disbursementDate) {
        const dDate = new Date(m.lastCreditRequest.disbursementDate);
        let dKey = '';
        if (groupingType === 'day') dKey = m.lastCreditRequest.disbursementDate.split('T')[0];
        else if (groupingType === 'week') {
          const day = dDate.getDay() || 7;
          const monday = new Date(dDate);
          monday.setHours(-24 * (day - 1));
          dKey = monday.toISOString().split('T')[0];
        } else if (groupingType === 'month') dKey = `${dDate.getFullYear()}-${String(dDate.getMonth() + 1).padStart(2, '0')}`;
        else if (groupingType === 'quarter') dKey = `${dDate.getFullYear()}-Q${Math.floor(dDate.getMonth() / 3) + 1}`;
        else if (groupingType === 'semester') dKey = `${dDate.getFullYear()}-S${Math.floor(dDate.getMonth() / 6) + 1}`;
        else if (groupingType === 'year') dKey = `${dDate.getFullYear()}`;

        if (groups[dKey]) {
          groups[dKey].creditInterets += Number(m.lastCreditRequest.interest) || 0;
        }
      }
    });

    commissions.forEach(c => {
      const date = new Date(c.date);
      let key = '';
      if (groupingType === 'day') key = c.date.split('T')[0];
      else if (groupingType === 'week') {
        const day = date.getDay() || 7;
        const monday = new Date(date);
        monday.setHours(-24 * (day - 1));
        key = monday.toISOString().split('T')[0];
      } else if (groupingType === 'month') key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      else if (groupingType === 'quarter') key = `${date.getFullYear()}-Q${Math.floor(date.getMonth() / 3) + 1}`;
      else if (groupingType === 'semester') key = `${date.getFullYear()}-S${Math.floor(date.getMonth() / 6) + 1}`;
      else if (groupingType === 'year') key = `${date.getFullYear()}`;

      if (groups[key]) {
        groups[key].commissionsTontine += Number(c.amount) || 0;
      }
    });

    expenses.forEach(e => {
      const date = new Date(e.date);
      let key = '';
      if (groupingType === 'day') key = e.date.split('T')[0];
      else if (groupingType === 'week') {
        const day = date.getDay() || 7;
        const monday = new Date(date);
        monday.setHours(-24 * (day - 1));
        key = monday.toISOString().split('T')[0];
      } else if (groupingType === 'month') key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      else if (groupingType === 'quarter') key = `${date.getFullYear()}-Q${Math.floor(date.getMonth() / 3) + 1}`;
      else if (groupingType === 'semester') key = `${date.getFullYear()}-S${Math.floor(date.getMonth() / 6) + 1}`;
      else if (groupingType === 'year') key = `${date.getFullYear()}`;

      if (groups[key]) {
        groups[key].depensesAdmin += Number(e.amount) || 0;
      }
    });

    return Object.values(groups).sort((a: any, b: any) => b.id.localeCompare(a.id));
  }, [filteredData, members, expenses, groupingType, selectedZone]);

  const dailyEvolution = useMemo(() => {
    const days: Record<string, any> = {};
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const dateStr = d.toISOString().split('T')[0];
      days[dateStr] = {
        date: dateStr,
        tontineDepots: 0,
        tontineRetraits: 0,
        epargneDepots: 0,
        epargneRetraits: 0,
        creditDeblocages: 0,
        creditRemboursements: 0,
        ventesLivret: 0,
        ouvertures: 0
      };
    }

    filteredData.forEach(tx => {
      const dateStr = tx.date.split('T')[0];
      if (days[dateStr]) {
        const amount = Number(tx.amount) || 0;
        const desc = (tx.description || '').toLowerCase();

        if (desc.includes('vente de livret')) {
          days[dateStr].ventesLivret += 1;
          return;
        }

        if (tx.account === 'tontine') {
          if (tx.type === 'depot' || tx.type === 'cotisation') days[dateStr].tontineDepots += amount;
          if (tx.type === 'retrait') days[dateStr].tontineRetraits += amount;
        } else if (tx.account === 'epargne') {
          if (tx.type === 'depot') days[dateStr].epargneDepots += amount;
          if (tx.type === 'retrait') days[dateStr].epargneRetraits += amount;
        } else if (tx.account === 'credit') {
          if (tx.type === 'deblocage') days[dateStr].creditDeblocages += amount;
          if (tx.type === 'remboursement') days[dateStr].creditRemboursements += amount;
        }
      }
    });

    members.forEach(m => {
      const dateStr = (m.createdAt || '').split('T')[0];
      const zoneMatch = selectedZone === 'all' || m.zone === selectedZone;
      if (days[dateStr] && zoneMatch) {
        days[dateStr].ouvertures += 1;
      }
    });

    return Object.values(days).sort((a: any, b: any) => a.date.localeCompare(b.date));
  }, [filteredData, members, startDate, endDate, selectedZone]);

  const agentStats = useMemo(() => {
    const agents: Record<string, any> = {};
    filteredData.forEach(tx => {
      const desc = (tx.description || '').toLowerCase();
      if (desc.includes('vente de livret')) {
        const match = desc.match(/- agent (.*)/);
        if (match && match[1]) {
          const agentName = match[1].trim().toUpperCase();
          if (!agents[agentName]) agents[agentName] = { name: agentName, ventes: 0, revenu: 0 };
          agents[agentName].ventes += 1;
          agents[agentName].revenu += Number(tx.amount) || 0;
        }
      }
    });
    return Object.values(agents).sort((a: any, b: any) => b.ventes - a.ventes);
  }, [filteredData]);

  const generateHTMLReport = (title: string, headers: string[], rows: any[][], totals?: string[]) => {
    const mfName = mfConfig?.nom || 'MICROFOX';
    const mfAddress = mfConfig?.adresse || '';
    const mfPhone = mfConfig?.telephone || '';
    const mfCode = mfConfig?.code || '';

    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <title>${title}</title>
          <style>
            body { font-family: sans-serif; color: #121c32; padding: 40px; }
            .header { text-align: center; margin-bottom: 40px; border-bottom: 2px solid #f1f5f9; padding-bottom: 20px; }
            .mf-name { font-size: 24px; font-weight: 900; margin: 0; color: #121c32; text-transform: uppercase; }
            .mf-info { font-size: 12px; color: #64748b; margin: 5px 0; font-weight: bold; }
            .report-title { font-size: 18px; font-weight: 800; margin: 20px 0; text-transform: uppercase; text-align: center; }
            .period { font-size: 12px; color: #64748b; text-align: center; margin-bottom: 30px; font-weight: bold; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th { background: #f8fafc; padding: 12px; text-align: center; font-size: 10px; text-transform: uppercase; letter-spacing: 0.05em; color: #64748b; border-bottom: 1px solid #e2e8f0; }
            td { padding: 12px; border-bottom: 1px solid #f1f5f9; font-size: 13px; text-align: center; }
            .text-right { text-align: center; }
            .font-bold { font-weight: bold; }
            .footer { margin-top: 40px; font-size: 10px; color: #94a3b8; text-align: center; }
            .total-row { background: #f8fafc; font-weight: bold; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1 class="mf-name">${mfName}</h1>
            <p class="mf-info">${mfAddress}</p>
            <p class="mf-info">Tél: ${mfPhone} | Code: ${mfCode}</p>
          </div>
          <h2 class="report-title">${title}</h2>
          <p class="period">Période du ${new Date(startDate).toLocaleDateString()} au ${new Date(endDate).toLocaleDateString()}</p>
          <table>
            <thead>
              <tr>
                ${headers.map(h => `<th>${h}</th>`).join('')}
              </tr>
            </thead>
            <tbody>
              ${rows.map(row => `
                <tr>
                  ${row.map((cell, idx) => `<td class="${idx > 0 ? 'text-right' : ''} ${idx === 0 ? 'font-bold' : ''}">${cell}</td>`).join('')}
                </tr>
              `).join('')}
            </tbody>
            ${totals ? `
              <tfoot>
                <tr class="total-row">
                  ${totals.map((t, idx) => `<td class="${idx > 0 ? 'text-right' : ''}">${t}</td>`).join('')}
                </tr>
              </tfoot>
            ` : ''}
          </table>
          <div class="footer">
            Généré le ${new Date().toLocaleString()} par MicroFox
          </div>
        </body>
      </html>
    `;
  };

  const handleExportHTML = (title: string, html: string) => {
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${title.toLowerCase().replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.html`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handlePrintHTML = (html: string) => {
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(html);
      printWindow.document.close();
      printWindow.focus();
      setTimeout(() => {
        printWindow.print();
        printWindow.close();
      }, 250);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-[#121c32] uppercase tracking-tight">Analyse & Évolution</h1>
          <p className="text-gray-500 text-sm font-medium">Suivi détaillé des performances et de la croissance</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 bg-white p-2 rounded-2xl shadow-sm border border-gray-100">
            <TrendingUp size={18} className="text-gray-400 ml-2" />
            <select 
              value={groupingType}
              onChange={(e) => {
                setGroupingType(e.target.value);
                setSelectedItems([]);
              }}
              className="border-none bg-transparent text-sm font-bold outline-none text-[#121c32]"
            >
              <option value="day">Par jour</option>
              <option value="week">Par semaine</option>
              <option value="month">Par mois</option>
              <option value="quarter">Par trimestre</option>
              <option value="semester">Par semestre</option>
              <option value="year">Par an</option>
            </select>
          </div>

          <div className="flex items-center gap-2 bg-white p-2 rounded-2xl shadow-sm border border-gray-100">
            <Filter size={18} className="text-gray-400 ml-2" />
            <select 
              value={selectedZone}
              onChange={(e) => setSelectedZone(e.target.value)}
              className="border-none bg-transparent text-sm font-bold outline-none text-[#121c32]"
            >
              <option value="all">Toutes les zones</option>
              {zones.map(zone => (
                <option key={zone} value={zone}>{zone}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2 bg-white p-2 rounded-2xl shadow-sm border border-gray-100">
            <Calendar size={18} className="text-gray-400 ml-2" />
            <input 
              type="date" 
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="border-none bg-transparent text-sm font-bold outline-none text-[#121c32]"
            />
            <span className="text-gray-300">|</span>
            <input 
              type="date" 
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="border-none bg-transparent text-sm font-bold outline-none text-[#121c32]"
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-500 flex items-center justify-center">
              <Activity size={20} />
            </div>
            <span className="text-[10px] font-black text-blue-500 uppercase tracking-widest bg-blue-50 px-2 py-1 rounded-lg">Tontine</span>
          </div>
          <div className="space-y-1">
            <p className="text-xs font-black text-gray-400 uppercase tracking-widest">Dépôts Tontine</p>
            <h3 className="text-xl font-black text-[#121c32]">{stats.tontineDepots.toLocaleString()} FCFA</h3>
          </div>
          <div className="mt-4 pt-4 border-t border-gray-50 flex items-center justify-between">
            <span className="text-[10px] font-bold text-gray-400 uppercase">Retraits</span>
            <span className="text-sm font-black text-red-500">-{stats.tontineRetraits.toLocaleString()}</span>
          </div>
        </div>

        <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-500 flex items-center justify-center">
              <DollarSign size={20} />
            </div>
            <span className="text-[10px] font-black text-emerald-500 uppercase tracking-widest bg-emerald-50 px-2 py-1 rounded-lg">Épargne</span>
          </div>
          <div className="space-y-1">
            <p className="text-xs font-black text-gray-400 uppercase tracking-widest">Dépôts Épargne</p>
            <h3 className="text-xl font-black text-[#121c32]">{stats.epargneDepots.toLocaleString()} FCFA</h3>
          </div>
          <div className="mt-4 pt-4 border-t border-gray-50 flex items-center justify-between">
            <span className="text-[10px] font-bold text-gray-400 uppercase">Retraits</span>
            <span className="text-sm font-black text-red-500">-{stats.epargneRetraits.toLocaleString()}</span>
          </div>
        </div>

        <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-500 flex items-center justify-center">
              <CreditCard size={20} />
            </div>
            <span className="text-[10px] font-black text-purple-500 uppercase tracking-widest bg-purple-50 px-2 py-1 rounded-lg">Crédits</span>
          </div>
          <div className="space-y-1">
            <p className="text-xs font-black text-gray-400 uppercase tracking-widest">Décaissements</p>
            <h3 className="text-xl font-black text-[#121c32]">{stats.creditDeblocages.toLocaleString()} FCFA</h3>
          </div>
          <div className="mt-4 pt-4 border-t border-gray-50 flex items-center justify-between">
            <span className="text-[10px] font-bold text-gray-400 uppercase">Remboursements</span>
            <span className="text-sm font-black text-emerald-600">+{stats.creditRemboursements.toLocaleString()}</span>
          </div>
        </div>

        <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-500 flex items-center justify-center">
              <TrendingUp size={20} />
            </div>
            <span className="text-[10px] font-black text-amber-500 uppercase tracking-widest bg-amber-50 px-2 py-1 rounded-lg">Revenus</span>
          </div>
          <div className="space-y-1">
            <p className="text-xs font-black text-gray-400 uppercase tracking-widest">Total Revenus Encaissés</p>
            <h3 className="text-xl font-black text-[#121c32]">{(stats.creditInteretsCollectes + stats.creditPenalitesCollectees + stats.creditFrais + stats.commissionsTontine + stats.revenuVentesLivret).toLocaleString()} FCFA</h3>
          </div>
          <div className="mt-4 pt-4 border-t border-gray-50 grid grid-cols-2 gap-2">
            <div>
              <p className="text-[10px] font-bold text-gray-400 uppercase">Intérêts</p>
              <p className="text-xs font-black text-amber-600">{stats.creditInteretsCollectes.toLocaleString()} F</p>
            </div>
            <div>
              <p className="text-[10px] font-bold text-gray-400 uppercase">Commissions</p>
              <p className="text-xs font-black text-amber-600">{stats.commissionsTontine.toLocaleString()} F</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-500 flex items-center justify-center">
              <BookOpen size={20} />
            </div>
            <span className="text-[10px] font-black text-amber-500 uppercase tracking-widest bg-amber-50 px-2 py-1 rounded-lg">Livrets</span>
          </div>
          <div className="space-y-1">
            <p className="text-xs font-black text-gray-400 uppercase tracking-widest">Ventes Livrets</p>
            <h3 className="text-xl font-black text-[#121c32]">{stats.ventesLivretTontine + stats.ventesLivretEpargne} unités</h3>
          </div>
          <div className="mt-4 pt-4 border-t border-gray-50 flex items-center justify-between">
            <span className="text-[10px] font-bold text-gray-400 uppercase">Tontine / Épargne</span>
            <span className="text-sm font-black text-amber-600">{stats.ventesLivretTontine} / {stats.ventesLivretEpargne}</span>
          </div>
        </div>

        <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-500 flex items-center justify-center">
              <Users size={20} />
            </div>
            <span className="text-[10px] font-black text-purple-500 uppercase tracking-widest bg-purple-50 px-2 py-1 rounded-lg">Croissance</span>
          </div>
          <div className="space-y-1">
            <p className="text-xs font-black text-gray-400 uppercase tracking-widest">Nouveaux Comptes</p>
            <h3 className="text-xl font-black text-[#121c32]">{stats.ouverturesEpargne + stats.ouverturesTontine} membres</h3>
          </div>
          <div className="mt-4 pt-4 border-t border-gray-50 flex items-center justify-between">
            <span className="text-[10px] font-bold text-gray-400 uppercase">Tontine / Épargne</span>
            <span className="text-sm font-black text-purple-600">{stats.ouverturesTontine} / {stats.ouverturesEpargne}</span>
          </div>
        </div>

        <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-500 flex items-center justify-center">
              <Gem size={20} />
            </div>
            <span className="text-[10px] font-black text-amber-500 uppercase tracking-widest bg-amber-50 px-2 py-1 rounded-lg">Parts Sociales</span>
          </div>
          <div className="space-y-1">
            <p className="text-xs font-black text-gray-400 uppercase tracking-widest">Total Encaissé</p>
            <h3 className="text-xl font-black text-[#121c32]">{stats.partsSociales.toLocaleString()} FCFA</h3>
          </div>
          <div className="mt-4 pt-4 border-t border-gray-50 flex items-center justify-between">
            <span className="text-[10px] font-bold text-gray-400 uppercase">Statut</span>
            <span className="text-sm font-black text-amber-600">Fonds Propres</span>
          </div>
        </div>

        <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <div className="w-10 h-10 rounded-xl bg-red-50 text-red-500 flex items-center justify-center">
              <TrendingDown size={20} />
            </div>
            <span className="text-[10px] font-black text-red-500 uppercase tracking-widest bg-red-50 px-2 py-1 rounded-lg">Dépenses</span>
          </div>
          <div className="space-y-1">
            <p className="text-xs font-black text-gray-400 uppercase tracking-widest">Frais de Fonctionnement</p>
            <h3 className="text-xl font-black text-[#121c32]">{stats.depensesAdmin.toLocaleString()} FCFA</h3>
          </div>
          <div className="mt-4 pt-4 border-t border-gray-50 flex items-center justify-between">
            <span className="text-[10px] font-bold text-gray-400 uppercase">Type</span>
            <span className="text-sm font-black text-red-500">Administratives</span>
          </div>
        </div>

        <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-gray-100 md:col-span-2 lg:col-span-3">
          <div className="flex items-center justify-between mb-4">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-500 flex items-center justify-center">
              <PieChart size={20} />
            </div>
            <span className="text-[10px] font-black text-emerald-500 uppercase tracking-widest bg-emerald-50 px-2 py-1 rounded-lg">Résultat Net</span>
          </div>
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div className="space-y-1">
              <p className="text-xs font-black text-gray-400 uppercase tracking-widest">Flux Net (Cash Flow Période)</p>
              <h3 className={`text-3xl font-black ${(stats.creditInteretsCollectes + stats.creditPenalitesCollectees + stats.creditFrais + stats.commissionsTontine + stats.revenuVentesLivret - stats.depensesAdmin) >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                {(stats.creditInteretsCollectes + stats.creditPenalitesCollectees + stats.creditFrais + stats.commissionsTontine + stats.revenuVentesLivret - stats.depensesAdmin).toLocaleString()} FCFA
              </h3>
            </div>
            <div className="flex gap-6">
              <div className="text-right">
                <p className="text-[10px] font-bold text-gray-400 uppercase">Total Revenus</p>
                <p className="text-sm font-black text-emerald-600">{(stats.creditInteretsCollectes + stats.creditPenalitesCollectees + stats.creditFrais + stats.commissionsTontine + stats.revenuVentesLivret).toLocaleString()} F</p>
              </div>
              <div className="text-right">
                <p className="text-[10px] font-bold text-gray-400 uppercase">Total Dépenses</p>
                <p className="text-sm font-black text-red-500">-{stats.depensesAdmin.toLocaleString()} F</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-gray-100">
          <h3 className="text-lg font-black text-[#121c32] uppercase tracking-tight mb-6">Évolution Tontine (Dépôts vs Retraits)</h3>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={dailyEvolution}>
                <defs>
                  <linearGradient id="colorDep" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorRet" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ef4444" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{fontSize: 10, fontWeight: 600, fill: '#94a3b8'}} />
                <YAxis axisLine={false} tickLine={false} tick={{fontSize: 10, fontWeight: 600, fill: '#94a3b8'}} />
                <Tooltip 
                  contentStyle={{borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'}}
                  labelStyle={{ color: '#121c32', fontWeight: 'bold' }}
                  itemStyle={{ fontWeight: 'bold' }}
                />
                <Legend iconType="circle" />
                <Area type="monotone" dataKey="tontineDepots" name="Dépôts" stroke="#3b82f6" fillOpacity={1} fill="url(#colorDep)" strokeWidth={3} />
                <Area type="monotone" dataKey="tontineRetraits" name="Retraits" stroke="#ef4444" fillOpacity={1} fill="url(#colorRet)" strokeWidth={3} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-gray-100">
          <h3 className="text-lg font-black text-[#121c32] uppercase tracking-tight mb-6">Évolution Épargne (Dépôts vs Retraits)</h3>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={dailyEvolution}>
                <defs>
                  <linearGradient id="colorDepE" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorRetE" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#f59e0b" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{fontSize: 10, fontWeight: 600, fill: '#94a3b8'}} />
                <YAxis axisLine={false} tickLine={false} tick={{fontSize: 10, fontWeight: 600, fill: '#94a3b8'}} />
                <Tooltip 
                  contentStyle={{borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'}}
                  labelStyle={{ color: '#121c32', fontWeight: 'bold' }}
                  itemStyle={{ fontWeight: 'bold' }}
                />
                <Legend iconType="circle" />
                <Area type="monotone" dataKey="epargneDepots" name="Dépôts" stroke="#10b981" fillOpacity={1} fill="url(#colorDepE)" strokeWidth={3} />
                <Area type="monotone" dataKey="epargneRetraits" name="Retraits" stroke="#f59e0b" fillOpacity={1} fill="url(#colorRetE)" strokeWidth={3} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-gray-100">
          <h3 className="text-lg font-black text-[#121c32] uppercase tracking-tight mb-6">Ventes de Livrets par Agent</h3>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={agentStats} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                <XAxis type="number" axisLine={false} tickLine={false} tick={{fontSize: 10, fontWeight: 600, fill: '#94a3b8'}} />
                <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{fontSize: 10, fontWeight: 600, fill: '#121c32'}} width={100} />
                <Tooltip 
                  cursor={{fill: '#f8fafc'}}
                  contentStyle={{borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'}}
                  labelStyle={{ color: '#121c32', fontWeight: 'bold' }}
                  itemStyle={{ fontWeight: 'bold' }}
                />
                <Bar dataKey="ventes" name="Ventes" fill="#f59e0b" radius={[0, 10, 10, 0]} barSize={20} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-gray-100">
          <h3 className="text-lg font-black text-[#121c32] uppercase tracking-tight mb-6">Ouvertures de Comptes & Ventes Livrets</h3>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={dailyEvolution}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{fontSize: 10, fontWeight: 600, fill: '#94a3b8'}} />
                <YAxis axisLine={false} tickLine={false} tick={{fontSize: 10, fontWeight: 600, fill: '#94a3b8'}} />
                <Tooltip 
                  contentStyle={{borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'}}
                  labelStyle={{ color: '#121c32', fontWeight: 'bold' }}
                  itemStyle={{ fontWeight: 'bold' }}
                />
                <Legend iconType="circle" />
                <Line type="monotone" dataKey="ouvertures" name="Nouveaux Comptes" stroke="#8b5cf6" strokeWidth={3} dot={{r: 4, fill: '#8b5cf6', strokeWidth: 2, stroke: '#fff'}} activeDot={{r: 6}} />
                <Line type="monotone" dataKey="ventesLivret" name="Ventes Livrets" stroke="#f59e0b" strokeWidth={3} dot={{r: 4, fill: '#f59e0b', strokeWidth: 2, stroke: '#fff'}} activeDot={{r: 6}} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-gray-100">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <h3 className="text-lg font-black text-[#121c32] uppercase tracking-tight">Détails Tontine ({groupingType === 'day' ? 'Journaliers' : 'Périodiques'})</h3>
          <div className="flex items-center gap-2">
            <button 
              onClick={() => {
                const items = groupedData.filter(i => (i.tontineDepots > 0 || i.tontineRetraits > 0) && selectedItems.includes(i.id));
                if (items.length === 0) return alert("Veuillez cocher au moins un état.");
                const html = generateHTMLReport(
                  "Détails Tontine",
                  ["Période", "Dépôts", "Retraits"],
                  items.map(i => [i.label, i.tontineDepots.toLocaleString() + " FCFA", "-" + i.tontineRetraits.toLocaleString() + " FCFA"]),
                  ["TOTAL PÉRIODE", stats.tontineDepots.toLocaleString() + " FCFA", "-" + stats.tontineRetraits.toLocaleString() + " FCFA"]
                );
                handleExportHTML("Analyse Tontine", html);
              }}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-50 text-emerald-600 rounded-xl text-xs font-bold hover:bg-emerald-100 transition-colors"
            >
              <Download size={16} />
              Exporter
            </button>
            <button 
              onClick={() => {
                const items = groupedData.filter(i => (i.tontineDepots > 0 || i.tontineRetraits > 0) && (selectedItems.length === 0 || selectedItems.includes(i.id)));
                const html = generateHTMLReport(
                  "Détails Tontine",
                  ["Période", "Dépôts", "Retraits"],
                  items.map(i => [i.label, i.tontineDepots.toLocaleString() + " FCFA", "-" + i.tontineRetraits.toLocaleString() + " FCFA"]),
                  ["TOTAL PÉRIODE", stats.tontineDepots.toLocaleString() + " FCFA", "-" + stats.tontineRetraits.toLocaleString() + " FCFA"]
                );
                handlePrintHTML(html);
              }}
              className="flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-600 rounded-xl text-xs font-bold hover:bg-blue-100 transition-colors"
            >
              <Printer size={16} />
              Imprimer
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-gray-50">
                <th className="py-4 w-10">
                  <button 
                    onClick={() => {
                      const visibleIds = groupedData.filter(i => i.tontineDepots > 0 || i.tontineRetraits > 0).map(i => i.id);
                      if (selectedItems.length === visibleIds.length) setSelectedItems([]);
                      else setSelectedItems(visibleIds);
                    }}
                    className="text-gray-400 hover:text-[#00c896]"
                  >
                    {selectedItems.length > 0 && selectedItems.length === groupedData.filter(i => i.tontineDepots > 0 || i.tontineRetraits > 0).length 
                      ? <CheckSquare size={20} className="text-[#00c896]" /> 
                      : <Square size={20} />
                    }
                  </button>
                </th>
                <th className="py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Période</th>
                <th className="py-4 text-[10px] font-black text-blue-500 uppercase tracking-widest text-right">Dépôts</th>
                <th className="py-4 text-[10px] font-black text-red-500 uppercase tracking-widest text-right">Retraits</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {groupedData
                .filter(item => item.tontineDepots > 0 || item.tontineRetraits > 0)
                .map((item: any) => (
                <tr key={item.id} className={`hover:bg-gray-50 transition-colors ${selectedItems.includes(item.id) ? 'bg-emerald-50/30' : ''}`}>
                  <td className="py-4">
                    <button 
                      onClick={() => {
                        setSelectedItems(prev => 
                          prev.includes(item.id) ? prev.filter(id => id !== item.id) : [...prev, item.id]
                        );
                      }}
                      className="text-gray-400 hover:text-[#00c896]"
                    >
                      {selectedItems.includes(item.id) ? <CheckSquare size={20} className="text-[#00c896]" /> : <Square size={20} />}
                    </button>
                  </td>
                  <td className="py-4 text-sm font-bold text-[#121c32]">{item.label}</td>
                  <td className="py-4 text-sm font-black text-blue-600 text-right">{item.tontineDepots.toLocaleString()} FCFA</td>
                  <td className="py-4 text-sm font-black text-red-600 text-right">-{item.tontineRetraits.toLocaleString()} FCFA</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-gray-50 font-black">
                <td></td>
                <td className="py-4 px-4 rounded-l-2xl text-sm text-[#121c32] uppercase tracking-tight">Total Période</td>
                <td className="py-4 text-sm text-blue-600 text-right">{stats.tontineDepots.toLocaleString()} FCFA</td>
                <td className="py-4 px-4 rounded-r-2xl text-sm text-red-600 text-right">-{stats.tontineRetraits.toLocaleString()} FCFA</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-gray-100">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <h3 className="text-lg font-black text-[#121c32] uppercase tracking-tight">Détails Épargne ({groupingType === 'day' ? 'Journaliers' : 'Périodiques'})</h3>
          <div className="flex items-center gap-2">
            <button 
              onClick={() => {
                const items = groupedData.filter(i => i.epargneDepots > 0 || i.epargneRetraits > 0);
                const html = generateHTMLReport(
                  "Détails Épargne",
                  ["Période", "Dépôts", "Retraits"],
                  items.map(i => [i.label, i.epargneDepots.toLocaleString() + " FCFA", "-" + i.epargneRetraits.toLocaleString() + " FCFA"]),
                  ["TOTAL PÉRIODE", stats.epargneDepots.toLocaleString() + " FCFA", "-" + stats.epargneRetraits.toLocaleString() + " FCFA"]
                );
                handleExportHTML("Analyse Épargne", html);
              }}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-50 text-emerald-600 rounded-xl text-xs font-bold hover:bg-emerald-100 transition-colors"
            >
              <Download size={16} />
              Exporter
            </button>
            <button 
              onClick={() => {
                const items = groupedData.filter(i => i.epargneDepots > 0 || i.epargneRetraits > 0);
                const html = generateHTMLReport(
                  "Détails Épargne",
                  ["Période", "Dépôts", "Retraits"],
                  items.map(i => [i.label, i.epargneDepots.toLocaleString() + " FCFA", "-" + i.epargneRetraits.toLocaleString() + " FCFA"]),
                  ["TOTAL PÉRIODE", stats.epargneDepots.toLocaleString() + " FCFA", "-" + stats.epargneRetraits.toLocaleString() + " FCFA"]
                );
                handlePrintHTML(html);
              }}
              className="flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-600 rounded-xl text-xs font-bold hover:bg-blue-100 transition-colors"
            >
              <Printer size={16} />
              Imprimer
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-gray-50">
                <th className="py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Période</th>
                <th className="py-4 text-[10px] font-black text-emerald-500 uppercase tracking-widest text-right">Dépôts</th>
                <th className="py-4 text-[10px] font-black text-red-500 uppercase tracking-widest text-right">Retraits</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {groupedData
                .filter(item => item.epargneDepots > 0 || item.epargneRetraits > 0)
                .map((item: any) => (
                <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                  <td className="py-4 text-sm font-bold text-[#121c32]">{item.label}</td>
                  <td className="py-4 text-sm font-black text-emerald-600 text-right">{item.epargneDepots.toLocaleString()} FCFA</td>
                  <td className="py-4 text-sm font-black text-red-600 text-right">-{item.epargneRetraits.toLocaleString()} FCFA</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-gray-50 font-black">
                <td className="py-4 px-4 rounded-l-2xl text-sm text-[#121c32] uppercase tracking-tight">Total Période</td>
                <td className="py-4 text-sm text-emerald-600 text-right">{stats.epargneDepots.toLocaleString()} FCFA</td>
                <td className="py-4 px-4 rounded-r-2xl text-sm text-red-600 text-right">-{stats.epargneRetraits.toLocaleString()} FCFA</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-gray-100">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <h3 className="text-lg font-black text-[#121c32] uppercase tracking-tight">Détails Crédits ({groupingType === 'day' ? 'Journaliers' : 'Périodiques'})</h3>
          <div className="flex items-center gap-2">
            <button 
              onClick={() => {
                const items = groupedData.filter(i => i.creditDeblocages > 0 || i.creditRemboursements > 0 || i.creditInterets > 0 || i.creditFrais > 0);
                const html = generateHTMLReport(
                  "Détails Crédits",
                  ["Période", "Décaissements", "Remboursements", "Intérêts", "Frais"],
                  items.map(i => [i.label, i.creditDeblocages.toLocaleString() + " FCFA", i.creditRemboursements.toLocaleString() + " FCFA", i.creditInterets.toLocaleString() + " FCFA", i.creditFrais.toLocaleString() + " FCFA"]),
                  ["TOTAL PÉRIODE", stats.creditDeblocages.toLocaleString() + " FCFA", stats.creditRemboursements.toLocaleString() + " FCFA", stats.creditInterets.toLocaleString() + " FCFA", stats.creditFrais.toLocaleString() + " FCFA"]
                );
                handleExportHTML("Analyse Crédits", html);
              }}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-50 text-emerald-600 rounded-xl text-xs font-bold hover:bg-emerald-100 transition-colors"
            >
              <Download size={16} />
              Exporter
            </button>
            <button 
              onClick={() => {
                const items = groupedData.filter(i => i.creditDeblocages > 0 || i.creditRemboursements > 0 || i.creditInterets > 0 || i.creditFrais > 0);
                const html = generateHTMLReport(
                  "Détails Crédits",
                  ["Période", "Décaissements", "Remboursements", "Intérêts", "Frais"],
                  items.map(i => [i.label, i.creditDeblocages.toLocaleString() + " FCFA", i.creditRemboursements.toLocaleString() + " FCFA", i.creditInterets.toLocaleString() + " FCFA", i.creditFrais.toLocaleString() + " FCFA"]),
                  ["TOTAL PÉRIODE", stats.creditDeblocages.toLocaleString() + " FCFA", stats.creditRemboursements.toLocaleString() + " FCFA", stats.creditInterets.toLocaleString() + " FCFA", stats.creditFrais.toLocaleString() + " FCFA"]
                );
                handlePrintHTML(html);
              }}
              className="flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-600 rounded-xl text-xs font-bold hover:bg-blue-100 transition-colors"
            >
              <Printer size={16} />
              Imprimer
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-gray-50">
                <th className="py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Période</th>
                <th className="py-4 text-[10px] font-black text-purple-500 uppercase tracking-widest text-right">Décaissements</th>
                <th className="py-4 text-[10px] font-black text-emerald-500 uppercase tracking-widest text-right">Remboursements</th>
                <th className="py-4 text-[10px] font-black text-blue-500 uppercase tracking-widest text-right">Intérêts</th>
                <th className="py-4 text-[10px] font-black text-amber-500 uppercase tracking-widest text-right">Frais</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {groupedData
                .filter(item => item.creditDeblocages > 0 || item.creditRemboursements > 0 || item.creditInterets > 0 || item.creditFrais > 0)
                .map((item: any) => (
                <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                  <td className="py-4 text-sm font-bold text-[#121c32]">{item.label}</td>
                  <td className="py-4 text-sm font-black text-purple-600 text-right">{item.creditDeblocages.toLocaleString()} FCFA</td>
                  <td className="py-4 text-sm font-black text-emerald-600 text-right">{item.creditRemboursements.toLocaleString()} FCFA</td>
                  <td className="py-4 text-sm font-black text-blue-600 text-right">{item.creditInterets.toLocaleString()} FCFA</td>
                  <td className="py-4 text-sm font-black text-amber-600 text-right">{item.creditFrais.toLocaleString()} FCFA</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-gray-50 font-black">
                <td className="py-4 px-4 rounded-l-2xl text-sm text-[#121c32] uppercase tracking-tight">Total Période</td>
                <td className="py-4 text-sm text-purple-600 text-right">{stats.creditDeblocages.toLocaleString()} FCFA</td>
                <td className="py-4 text-sm text-emerald-600 text-right">{stats.creditRemboursements.toLocaleString()} FCFA</td>
                <td className="py-4 text-sm text-blue-600 text-right">{stats.creditInterets.toLocaleString()} FCFA</td>
                <td className="py-4 px-4 rounded-r-2xl text-sm text-amber-600 text-right">{stats.creditFrais.toLocaleString()} FCFA</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-gray-100">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <h3 className="text-lg font-black text-[#121c32] uppercase tracking-tight">Autres Opérations ({groupingType === 'day' ? 'Journalières' : 'Périodiques'})</h3>
          <div className="flex items-center gap-2">
            <button 
              onClick={() => {
                const items = groupedData.filter(i => i.partsSociales !== 0 || i.commissionsTontine > 0 || i.depensesAdmin > 0);
                const html = generateHTMLReport(
                  "Autres Opérations",
                  ["Période", "Parts Sociales", "Commissions", "Dépenses Admin"],
                  items.map(i => [i.label, i.partsSociales.toLocaleString() + " FCFA", i.commissionsTontine.toLocaleString() + " FCFA", i.depensesAdmin.toLocaleString() + " FCFA"]),
                  ["TOTAL PÉRIODE", stats.partsSociales.toLocaleString() + " FCFA", stats.commissionsTontine.toLocaleString() + " FCFA", stats.depensesAdmin.toLocaleString() + " FCFA"]
                );
                handleExportHTML("Autres Opérations", html);
              }}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-50 text-emerald-600 rounded-xl text-xs font-bold hover:bg-emerald-100 transition-colors"
            >
              <Download size={16} />
              Exporter
            </button>
            <button 
              onClick={() => {
                const items = groupedData.filter(i => i.partsSociales !== 0 || i.commissionsTontine > 0 || i.depensesAdmin > 0);
                const html = generateHTMLReport(
                  "Autres Opérations",
                  ["Période", "Parts Sociales", "Commissions", "Dépenses Admin"],
                  items.map(i => [i.label, i.partsSociales.toLocaleString() + " FCFA", i.commissionsTontine.toLocaleString() + " FCFA", i.depensesAdmin.toLocaleString() + " FCFA"]),
                  ["TOTAL PÉRIODE", stats.partsSociales.toLocaleString() + " FCFA", stats.commissionsTontine.toLocaleString() + " FCFA", stats.depensesAdmin.toLocaleString() + " FCFA"]
                );
                handlePrintHTML(html);
              }}
              className="flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-600 rounded-xl text-xs font-bold hover:bg-blue-100 transition-colors"
            >
              <Printer size={16} />
              Imprimer
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-gray-50">
                <th className="py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Période</th>
                <th className="py-4 text-[10px] font-black text-indigo-500 uppercase tracking-widest text-right">Parts Sociales</th>
                <th className="py-4 text-[10px] font-black text-amber-500 uppercase tracking-widest text-right">Commissions</th>
                <th className="py-4 text-[10px] font-black text-red-500 uppercase tracking-widest text-right">Dépenses Admin</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {groupedData
                .filter(item => item.partsSociales !== 0 || item.commissionsTontine > 0 || item.depensesAdmin > 0)
                .map((item: any) => (
                <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                  <td className="py-4 text-sm font-bold text-[#121c32]">{item.label}</td>
                  <td className="py-4 text-sm font-black text-indigo-600 text-right">{item.partsSociales.toLocaleString()} FCFA</td>
                  <td className="py-4 text-sm font-black text-amber-600 text-right">{item.commissionsTontine.toLocaleString()} FCFA</td>
                  <td className="py-4 text-sm font-black text-red-600 text-right">{item.depensesAdmin.toLocaleString()} FCFA</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-gray-50 font-black">
                <td className="py-4 px-4 rounded-l-2xl text-sm text-[#121c32] uppercase tracking-tight">Total Période</td>
                <td className="py-4 text-sm text-indigo-600 text-right">{stats.partsSociales.toLocaleString()} FCFA</td>
                <td className="py-4 text-sm text-amber-600 text-right">{stats.commissionsTontine.toLocaleString()} FCFA</td>
                <td className="py-4 px-4 rounded-r-2xl text-sm text-red-600 text-right">{stats.depensesAdmin.toLocaleString()} FCFA</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Analyse;
