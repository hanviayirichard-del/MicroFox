import React, { useState, useEffect } from 'react';
import { dispatchStorageEvent } from '../utils/events';
import { 
  Gem, 
  Download, 
  Calendar, 
  ChevronDown, 
  Users, 
  TrendingUp, 
  AlertCircle,
  CheckCircle2,
  Search,
  ArrowRight
} from 'lucide-react';
import * as XLSX from 'xlsx';

const FraisPartsSociales: React.FC = () => {
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<'overview' | 'members'>('overview');
  
  const [stats, setStats] = useState({
    totalAdhesions: 0,
    countAdhesions: 0,
    totalPartSociale: 0,
    restePartSociale: 0,
    members: [] as any[]
  });

  const months = [
    "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
    "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"
  ];

  const years = [2024, 2025, 2026];

  const loadData = () => {
    const saved = localStorage.getItem('microfox_members_data');
    if (saved) {
      const allMembers = JSON.parse(saved);
      let totalAdh = 0;
      let countAdh = 0;
      let totalPS = 0;
      let restePS = 0;

      allMembers.forEach((member: any) => {
        // Calcul des frais sur la période sélectionnée
        const periodTxs = (member.history || []).filter((tx: any) => {
          const txDate = new Date(tx.date);
          return txDate.getMonth() === selectedMonth && txDate.getFullYear() === selectedYear;
        });

        periodTxs.forEach((tx: any) => {
          if (tx.account === 'frais') {
            if (tx.description.toLowerCase().includes('adhésion')) {
              totalAdh += tx.amount;
              countAdh++;
            }
          }
        });

        // Parts sociales (global car c'est du capital)
        const paidPS = member.balances?.partSociale || 0;
        totalPS += paidPS;
        
        // On suppose un objectif de 5000 F par membre pour la part sociale
        const targetPS = 5000;
        if (paidPS < targetPS) {
          restePS += (targetPS - paidPS);
        }
      });

      setStats({
        totalAdhesions: totalAdh,
        countAdhesions: countAdh,
        totalPartSociale: totalPS,
        restePartSociale: restePS,
        members: allMembers
      });
    }
  };

  useEffect(() => {
    loadData();
    window.addEventListener('storage', loadData);
    window.addEventListener('microfox_storage' as any, loadData);
    return () => window.removeEventListener('storage', loadData);
      window.removeEventListener('microfox_storage' as any, loadData);
  }, [selectedMonth, selectedYear]);

  const [selectedMember, setSelectedMember] = useState<any | null>(null);
  const [paymentAmount, setPaymentAmount] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handlePayment = () => {
    if (!selectedMember || !paymentAmount || isSubmitting) return;
    const amount = parseInt(paymentAmount);
    if (isNaN(amount) || amount <= 0) return alert("Montant invalide");

    setIsSubmitting(true);
    
    const saved = localStorage.getItem('microfox_members_data');
    if (saved) {
      const allMembers = JSON.parse(saved);
      const memberIdx = allMembers.findIndex((m: any) => m.id === selectedMember.id);
      
      if (memberIdx !== -1) {
        const member = allMembers[memberIdx];
        
        let fullHistory = member.history || [];
        if (fullHistory.length === 0) {
          const savedHistory = localStorage.getItem(`microfox_history_${member.id}`);
          if (savedHistory) fullHistory = JSON.parse(savedHistory);
        }

        const txId = `tx_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
        const newTx = {
          id: txId,
          date: new Date().toISOString(),
          type: 'depot',
          account: 'partSociale',
          amount: amount,
          description: 'Paiement part sociale (Complément)',
          reference: `PS-${Date.now().toString().slice(-6)}`
        };

        const newHistory = [newTx, ...fullHistory];
        member.history = newHistory;
        localStorage.setItem(`microfox_history_${member.id}`, JSON.stringify(newHistory));

        member.balances = {
          ...member.balances,
          partSociale: (member.balances?.partSociale || 0) + amount
        };

        localStorage.setItem('microfox_members_data', JSON.stringify(allMembers));
        localStorage.setItem('microfox_pending_sync', 'true');
        dispatchStorageEvent();
        
        setSelectedMember(null);
        setPaymentAmount('');
        alert("Paiement enregistré avec succès");
      }
    }
    setIsSubmitting(false);
  };

  const exportToHTML = () => {
    if (stats.members.length === 0) {
      alert("Aucune donnée à exporter.");
      return;
    }

    const htmlContent = `
      <!DOCTYPE html>
      <html lang="fr">
        <head>
          <meta charset="utf-8">
          <title>Parts Sociales - ${months[selectedMonth]} ${selectedYear}</title>
          <style>
            body { font-family: sans-serif; padding: 20px; }
            table { border-collapse: collapse; width: 100%; margin-top: 20px; }
            th, td { border: 1px solid #ddd; padding: 12px; text-align: left; }
            tr:nth-child(even) { background-color: #f9f9f9; }
            th { background-color: #121c32; color: white; }
            .header { text-align: center; margin-bottom: 30px; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>Parts Sociales & Adhésions</h1>
            <p>Période : ${months[selectedMonth]} ${selectedYear}</p>
          </div>
          <table>
            <thead>
              <tr>
                <th>Code Membre</th>
                <th>Nom Complet</th>
                <th>Part Sociale Payée</th>
                <th>Objectif Part Sociale</th>
                <th>Reste à Payer</th>
                <th>Statut</th>
                <th>Compte Épargne</th>
                <th>Compte Tontine</th>
              </tr>
            </thead>
            <tbody>
              ${stats.members.map(m => `
                <tr>
                  <td>${m.code}</td>
                  <td>${m.name}</td>
                  <td>${m.balances?.partSociale || 0}</td>
                  <td>5000</td>
                  <td>${Math.max(0, 5000 - (m.balances?.partSociale || 0))}</td>
                  <td>${(m.balances?.partSociale || 0) >= 5000 ? 'Libérée' : 'Partielle'}</td>
                  <td>${m.epargneAccountNumber || 'N/A'}</td>
                  <td>${m.tontineAccounts?.[0]?.number || 'N/A'}</td>
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
    a.download = `Parts_Sociales_${months[selectedMonth]}_${selectedYear}_${dateStr}.html`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const filteredMembers = stats.members.filter(m => 
    m.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    m.code.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12">
      {selectedMember && (
        <div className="fixed inset-0 z-[100] bg-[#121c32]/80 backdrop-blur-sm flex items-start justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-[2.5rem] w-full max-w-md p-8 shadow-2xl animate-in zoom-in-95 duration-200 my-4 sm:my-8">
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-purple-50 flex items-center justify-center text-purple-600">
                  <Gem size={20} />
                </div>
                <h3 className="text-lg font-black uppercase tracking-tight text-[#121c32]">Libérer Part Sociale</h3>
              </div>
              <button onClick={() => setSelectedMember(null)} className="text-gray-400 hover:text-gray-600 transition-colors">
                <ArrowRight className="rotate-180" size={24} />
              </button>
            </div>

            <div className="space-y-6">
              <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100">
                <p className="text-[10px] font-black text-gray-600 uppercase tracking-widest mb-1">Membre</p>
                <p className="text-base font-black text-[#121c32] uppercase">{selectedMember.name}</p>
                <p className="text-xs font-bold text-gray-700">{selectedMember.code}</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-100">
                  <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest mb-1">Déjà payé</p>
                  <p className="text-lg font-black text-emerald-700">{(selectedMember.balances?.partSociale || 0).toLocaleString()} F</p>
                </div>
                <div className="p-4 bg-amber-50 rounded-2xl border border-amber-100">
                  <p className="text-[10px] font-black text-amber-600 uppercase tracking-widest mb-1">Reste à payer</p>
                  <p className="text-lg font-black text-amber-700">{Math.max(0, 5000 - (selectedMember.balances?.partSociale || 0)).toLocaleString()} F</p>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-600 uppercase tracking-widest ml-1">Montant du versement (F)</label>
                <input 
                  type="number" 
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  placeholder="Ex: 1000"
                  className="w-full p-4 bg-gray-50 border border-transparent focus:border-purple-200 rounded-2xl outline-none text-lg font-black text-[#121c32] transition-all"
                />
              </div>

              <button 
                onClick={handlePayment}
                disabled={isSubmitting}
                className="w-full py-4 bg-purple-600 hover:bg-purple-700 text-white rounded-2xl font-black uppercase tracking-widest shadow-xl shadow-purple-200 transition-all active:scale-95 disabled:opacity-50"
              >
                {isSubmitting ? 'Enregistrement...' : 'Valider le paiement'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-purple-50 flex items-center justify-center text-purple-600 shadow-sm border border-purple-100">
            <Gem size={24} />
          </div>
          <div>
            <h1 className="text-2xl font-black text-[#121c32] uppercase tracking-tight">Frais & Parts Sociales</h1>
            <p className="text-gray-700 text-xs font-bold uppercase tracking-widest mt-0.5">Suivi des adhésions et du capital social.</p>
          </div>
        </div>
        <button 
          onClick={exportToHTML}
          className="p-3 bg-purple-50 text-purple-600 rounded-2xl border border-purple-100 hover:bg-purple-100 transition-colors shadow-sm"
        >
          <Download size={20} />
        </button>
      </div>

      <div className="flex items-center gap-3 p-1 bg-gray-100 rounded-2xl w-fit">
        <button 
          onClick={() => setActiveTab('overview')}
          className={`px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'overview' ? 'bg-white text-purple-600 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
        >
          Aperçu Mensuel
        </button>
        <button 
          onClick={() => setActiveTab('members')}
          className={`px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'members' ? 'bg-white text-purple-600 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
        >
          Détail Membres
        </button>
      </div>

      {activeTab === 'overview' ? (
        <>
          <div className="bg-white p-6 rounded-[2.5rem] border border-gray-100 shadow-sm flex flex-wrap items-center gap-6">
            <div className="flex-1 min-w-[200px] space-y-2">
              <label className="text-[10px] font-black text-gray-600 uppercase tracking-widest ml-1">Période d'analyse</label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <select 
                    value={selectedMonth}
                    onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
                    className="w-full pl-10 pr-8 py-3 bg-gray-50 border border-transparent rounded-2xl text-sm font-bold text-[#121c32] outline-none appearance-none cursor-pointer focus:bg-white focus:border-purple-200 transition-all"
                  >
                    {months.map((m, i) => <option key={m} value={i}>{m}</option>)}
                  </select>
                  <Calendar className="absolute left-3.5 top-1/2 -translate-y-1/2 text-purple-500" size={16} />
                  <ChevronDown className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={14} />
                </div>
                <div className="relative w-32">
                  <select 
                    value={selectedYear}
                    onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                    className="w-full pl-4 pr-8 py-3 bg-gray-50 border border-transparent rounded-2xl text-sm font-bold text-[#121c32] outline-none appearance-none cursor-pointer focus:bg-white focus:border-purple-200 transition-all"
                  >
                    {years.map(y => <option key={y} value={y}>{y}</option>)}
                  </select>
                  <ChevronDown className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={14} />
                </div>
              </div>
            </div>

            <div className="h-12 w-px bg-gray-100 hidden md:block"></div>

            <div className="flex-1 min-w-[200px] bg-purple-600 rounded-3xl p-6 text-white shadow-lg shadow-purple-200 relative overflow-hidden">
              <div className="relative z-10">
                <p className="text-[10px] font-bold uppercase tracking-widest text-purple-200 mb-1">Reste à Payer</p>
                <div className="flex items-baseline gap-1">
                  <span className="text-3xl font-black">{stats.restePartSociale.toLocaleString()}</span>
                  <span className="text-sm font-bold opacity-80 text-purple-200">F</span>
                </div>
                <p className="text-[9px] font-bold text-purple-200 uppercase mt-1 tracking-tighter">Parts sociales non libérées</p>
              </div>
              <TrendingUp className="absolute right-[-10px] bottom-[-10px] w-24 h-24 text-white/10" />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6">
            <div className="bg-white rounded-[2.5rem] p-8 border border-gray-100 shadow-sm space-y-8 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-50 rounded-bl-[5rem] -mr-8 -mt-8 opacity-50"></div>
              <div>
                <p className="text-[10px] font-black text-gray-600 uppercase tracking-[0.2em] mb-2">Frais d'adhésion (2000 F)</p>
                <div className="flex items-baseline gap-2">
                  <span className="text-6xl font-black text-[#121c32]">{stats.totalAdhesions.toLocaleString()}</span>
                  <span className="text-2xl font-black text-gray-300">F</span>
                </div>
                <div className="mt-4 inline-flex items-center gap-2 px-3 py-1 bg-emerald-50 text-emerald-600 rounded-full text-[10px] font-black uppercase tracking-widest">
                  {stats.countAdhesions} Adhésions
                </div>
              </div>
              <div className="pt-6 border-t border-gray-50 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-600">
                    <CheckCircle2 size={16} />
                  </div>
                  <span className="text-xs font-bold text-gray-700 uppercase">Objectif atteint</span>
                </div>
                <span className="text-xs font-black text-emerald-600">100%</span>
              </div>
            </div>
          </div>

          <div className="bg-[#121c32] rounded-[2.5rem] p-10 text-white shadow-xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-purple-500/10 rounded-full blur-3xl -mr-20 -mt-20"></div>
            <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-8">
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-purple-500 rounded-xl shadow-lg shadow-purple-500/20">
                    <Gem size={24} className="text-white" />
                  </div>
                  <h3 className="text-xl font-black uppercase tracking-tight">Capital Social Consolidé</h3>
                </div>
                <p className="text-gray-700 text-sm leading-relaxed max-w-md font-medium">
                  Total des parts sociales libérées par l'ensemble des membres de l'institution. Ce montant constitue le socle de solvabilité réglementaire.
                </p>
              </div>
              <div className="text-center md:text-right">
                <div className="flex items-baseline justify-center md:justify-end gap-2">
                  <span className="text-7xl font-black text-purple-400">{stats.totalPartSociale.toLocaleString()}</span>
                  <span className="text-2xl font-black text-purple-400/50">F</span>
                </div>
                <p className="text-[10px] font-bold text-gray-700 uppercase tracking-[0.3em] mt-2">Fonds Propres SFD</p>
              </div>
            </div>
          </div>
        </>
      ) : (
        <div className="space-y-6">
          <div className="relative">
            <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
            <input 
              type="text" 
              placeholder="Rechercher un membre par nom ou code..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-14 pr-6 py-5 bg-white border border-gray-100 rounded-[2rem] font-bold text-[#121c32] outline-none shadow-sm focus:border-purple-200 transition-all placeholder:text-gray-300"
            />
          </div>

          <div className="grid grid-cols-1 gap-4">
            {filteredMembers.map((member) => {
              const paid = member.balances?.partSociale || 0;
              const target = 5000;
              const percent = Math.min((paid / target) * 100, 100);
              
              return (
                <div key={member.id} className="bg-white p-6 rounded-[2rem] border border-gray-100 shadow-sm flex items-center justify-between group hover:shadow-md transition-all">
                  <div className="flex items-center gap-4 flex-1 min-w-0">
                    <div className="w-14 h-14 rounded-2xl bg-gray-50 flex items-center justify-center text-gray-600 font-black text-sm shrink-0 group-hover:bg-purple-50 group-hover:text-purple-600 transition-colors">
                      {member.name.split(' ').map((n: string) => n[0]).join('')}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-base font-black text-[#121c32] uppercase truncate">{member.name}</p>
                        {percent === 100 && <CheckCircle2 size={14} className="text-emerald-500 shrink-0" />}
                      </div>
                      <p className="text-[10px] font-bold text-gray-600 uppercase tracking-widest">{member.code}</p>
                      <div className="flex flex-col mt-1">
                        {member.epargneAccountNumber && (
                          <p className="text-[9px] font-black text-blue-600 uppercase tracking-tighter">Épargne: {member.epargneAccountNumber}</p>
                        )}
                        {member.tontineAccounts?.[0]?.number && (
                          <p className="text-[9px] font-black text-amber-600 uppercase tracking-tighter">Tontine: {member.tontineAccounts[0].number}</p>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-8 shrink-0">
                    <div className="w-48 hidden md:block">
                      <div className="flex justify-between mb-1.5">
                        <span className="text-[10px] font-black text-gray-600 uppercase tracking-tighter">Part Sociale</span>
                        <span className="text-[10px] font-black text-[#121c32]">{paid.toLocaleString()} / {target.toLocaleString()} F</span>
                      </div>
                      <div className="h-2 bg-gray-50 rounded-full overflow-hidden border border-gray-100">
                        <div 
                          className={`h-full transition-all duration-500 ${percent === 100 ? 'bg-emerald-500' : 'bg-purple-500'}`} 
                          style={{ width: `${percent}%` }}
                        ></div>
                      </div>
                    </div>

                    <div className="text-right min-w-[80px]">
                      <p className="text-[10px] font-black text-gray-600 uppercase tracking-tighter">Statut</p>
                      <span className={`text-[10px] font-black uppercase tracking-widest ${percent === 100 ? 'text-emerald-600' : 'text-amber-600'}`}>
                        {percent === 100 ? 'Libérée' : 'Partielle'}
                      </span>
                    </div>
                    
                    <button 
                      onClick={() => setSelectedMember(member)}
                      className={`p-3 rounded-xl transition-all active:scale-95 ${percent === 100 ? 'text-emerald-500 bg-emerald-50' : 'text-purple-600 bg-purple-50 hover:bg-purple-100'}`}
                    >
                      {percent === 100 ? <CheckCircle2 size={20} /> : <ArrowRight size={20} />}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default FraisPartsSociales;
