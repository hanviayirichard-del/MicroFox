import React, { useState, useEffect } from 'react';
import { Users, Plus, Search, Trash2, Calendar, FileText, TrendingUp, CheckCircle, X, Printer, Download, UserPlus, DollarSign, History as HistoryIcon } from 'lucide-react';

interface Personnel {
  id: string;
  name: string;
  position: string;
  baseSalary: number;
  hiringDate: string;
  phone: string;
  status: 'Actif' | 'Inactif';
  notes?: string;
}

interface SalaryPayment {
  id: string;
  personnelId: string;
  personnelName: string;
  date: string;
  amount: number;
  type: 'Avance' | 'Reste' | 'Total';
  period: string; // YYYY-MM
  recordedBy: string;
}

const PersonnelSalaries: React.FC = () => {
  const [personnelList, setPersonnelList] = useState<Personnel[]>([]);
  const [payments, setPayments] = useState<SalaryPayment[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isPersonnelModalOpen, setIsPersonnelModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [selectedPersonnel, setSelectedPersonnel] = useState<Personnel | null>(null);
  
  // Personnel Form state
  const [name, setName] = useState('');
  const [position, setPosition] = useState('');
  const [baseSalary, setBaseSalary] = useState('');
  const [hiringDate, setHiringDate] = useState(new Date().toISOString().split('T')[0]);
  const [phone, setPhone] = useState('');
  const [notes, setNotes] = useState('');

  // Filter state for history
  const [startDate, setStartDate] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
  });

  const loadData = () => {
    const savedPersonnel = localStorage.getItem('microfox_personnel');
    if (savedPersonnel) setPersonnelList(JSON.parse(savedPersonnel));
    
    const savedExpenses = localStorage.getItem('microfox_admin_expenses');
    if (savedExpenses) {
      const allExpenses = JSON.parse(savedExpenses);
      // Filter expenses that are salaries and have personnel info
      const salaryPayments = allExpenses
        .filter((e: any) => e.category === 'Salaires' && e.personnelId && !e.isDeleted)
        .map((e: any) => ({
          id: e.id,
          personnelId: e.personnelId,
          personnelName: e.personnelName,
          date: e.date,
          amount: e.amount,
          type: e.salaryType || 'Total',
          period: e.salaryPeriod || e.date.substring(0, 7),
          recordedBy: e.recordedBy
        }));
      setPayments(salaryPayments);
    }
  };

  useEffect(() => {
    loadData();
    window.addEventListener('storage', loadData);
    window.addEventListener('microfox_storage' as any, loadData);
    return () => window.removeEventListener('storage', loadData);
      window.removeEventListener('microfox_storage' as any, loadData);
  }, []);

  const handleSavePersonnel = () => {
    if (!name || !position || !baseSalary) {
      alert("Veuillez remplir tous les champs obligatoires.");
      return;
    }

    if (isEditing && selectedPersonnel) {
      const updatedList = personnelList.map(p => 
        p.id === selectedPersonnel.id 
          ? { ...p, name, position, baseSalary: Number(baseSalary), hiringDate, phone, notes }
          : p
      );
      localStorage.setItem('microfox_personnel', JSON.stringify(updatedList));
      setPersonnelList(updatedList);
    } else {
      const newPersonnel: Personnel = {
        id: `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        name,
        position,
        baseSalary: Number(baseSalary),
        hiringDate,
        phone,
        status: 'Actif',
        notes
      };

      const updatedList = [newPersonnel, ...personnelList];
      localStorage.setItem('microfox_personnel', JSON.stringify(updatedList));
      setPersonnelList(updatedList);
    }

    setIsPersonnelModalOpen(false);
    setIsEditing(false);
    setSelectedPersonnel(null);
    
    // Reset form
    setName('');
    setPosition('');
    setBaseSalary('');
    setPhone('');
    setNotes('');
  };

  const handleEditPersonnel = (p: Personnel) => {
    setSelectedPersonnel(p);
    setName(p.name);
    setPosition(p.position);
    setBaseSalary(p.baseSalary.toString());
    setHiringDate(p.hiringDate);
    setPhone(p.phone);
    setNotes(p.notes || '');
    setIsEditing(true);
    setIsPersonnelModalOpen(true);
  };

  const handleDeletePersonnel = (id: string) => {
    if (!window.confirm("Voulez-vous vraiment supprimer ce membre du personnel ?")) return;
    const updatedList = personnelList.filter(p => p.id !== id);
    localStorage.setItem('microfox_personnel', JSON.stringify(updatedList));
    setPersonnelList(updatedList);
  };

  const filteredPersonnel = personnelList.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.position.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredPayments = payments.filter(p => {
    const pDate = p.date.split('T')[0];
    const matchesPersonnel = !selectedPersonnel || p.personnelId === selectedPersonnel.id;
    const matchesDate = pDate >= startDate && pDate <= endDate;
    return matchesPersonnel && matchesDate;
  });

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-[#121c32] uppercase tracking-tight">Salaire du Personnel</h1>
          <p className="text-gray-700 text-sm font-medium mt-1">Gestion des employés et suivi des rémunérations</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative w-full md:w-64">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-600" size={18} />
            <input 
              type="text" 
              placeholder="Rechercher personnel..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl outline-none focus:border-blue-500 font-medium transition-all shadow-sm text-sm"
            />
          </div>
          <button 
            onClick={() => setIsPersonnelModalOpen(true)}
            className="bg-blue-600 text-white px-6 py-2.5 rounded-xl font-black uppercase tracking-widest shadow-lg hover:bg-blue-700 transition-all flex items-center gap-2 shrink-0 text-sm"
          >
            <UserPlus size={18} />
            Nouveau Personnel
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 bg-white rounded-[2.5rem] shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-6 border-b border-gray-50 flex items-center justify-between">
            <h3 className="font-black text-[#121c32] uppercase tracking-widest text-sm">Liste du Personnel</h3>
            <span className="px-3 py-1 bg-blue-50 text-blue-600 rounded-lg text-[10px] font-black uppercase tracking-tight">
              {filteredPersonnel.length} Employés
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-gray-50/50">
                  <th className="px-6 py-4 text-[10px] font-black text-gray-600 uppercase tracking-widest">Nom & Poste</th>
                  <th className="px-6 py-4 text-[10px] font-black text-gray-600 uppercase tracking-widest">Salaire de Base</th>
                  <th className="px-6 py-4 text-[10px] font-black text-gray-600 uppercase tracking-widest">Contact</th>
                  <th className="px-6 py-4 text-[10px] font-black text-gray-600 uppercase tracking-widest">Commentaires</th>
                  <th className="px-6 py-4 text-[10px] font-black text-gray-600 uppercase tracking-widest text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filteredPersonnel.length > 0 ? (
                  filteredPersonnel.map((p, idx) => (
                    <tr key={`${p.id}_${idx}`} className="hover:bg-gray-50/30 transition-colors">
                      <td className="px-6 py-4">
                        <p className="text-sm font-black text-[#121c32]">{p.name}</p>
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-tight">{p.position}</p>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-sm font-black text-emerald-600">{p.baseSalary.toLocaleString()} F</p>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-xs font-bold text-gray-600">{p.phone || 'N/A'}</p>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-[10px] font-medium text-gray-400 max-w-[150px] truncate" title={p.notes}>
                          {p.notes || '-'}
                        </p>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-center gap-2">
                          <button 
                            onClick={() => handleEditPersonnel(p)}
                            className="p-2 text-emerald-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-all"
                            title="Modifier"
                          >
                            <Plus size={18} className="rotate-45" />
                          </button>
                          <button 
                            onClick={() => {
                              setSelectedPersonnel(p);
                              setIsHistoryModalOpen(true);
                            }}
                            className="p-2 text-blue-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                            title="Historique des salaires"
                          >
                            <HistoryIcon size={18} />
                          </button>
                          <button 
                            onClick={() => handleDeletePersonnel(p.id)}
                            className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4} className="px-6 py-20 text-center">
                      <Users size={48} className="mx-auto text-gray-200 mb-4" />
                      <p className="text-gray-500 font-medium italic">Aucun personnel enregistré.</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-[#121c32] p-8 rounded-[2.5rem] text-white shadow-xl relative overflow-hidden">
            <div className="relative z-10">
              <p className="text-blue-400 text-[10px] font-black uppercase tracking-[0.2em] mb-2">Masse Salariale</p>
              <h2 className="text-3xl font-black mb-1">
                {personnelList.reduce((sum, p) => sum + p.baseSalary, 0).toLocaleString()} <span className="text-sm font-bold text-blue-400">F</span>
              </h2>
              <p className="text-white/40 text-[10px] font-bold uppercase tracking-widest">Total mensuel théorique</p>
            </div>
            <DollarSign className="absolute -right-4 -bottom-4 w-32 h-32 text-white/5" />
          </div>

          <div className="bg-white p-6 rounded-[2.5rem] border border-gray-100 shadow-sm">
            <h3 className="font-black text-[#121c32] uppercase tracking-widest text-xs mb-4 flex items-center gap-2">
              <Calendar size={16} className="text-blue-500" />
              Paiements récents
            </h3>
            <div className="space-y-4">
              {payments.slice(0, 5).map((p, idx) => (
                <div key={`${p.id}_${idx}`} className="flex items-center justify-between p-3 bg-gray-50 rounded-2xl border border-gray-100">
                  <div>
                    <p className="text-xs font-black text-[#121c32]">{p.personnelName}</p>
                    <p className="text-[10px] font-bold text-gray-400 uppercase">{p.type} - {p.period}</p>
                  </div>
                  <p className="text-xs font-black text-red-600">-{p.amount.toLocaleString()} F</p>
                </div>
              ))}
              {payments.length === 0 && (
                <p className="text-center text-gray-400 text-xs italic py-4">Aucun paiement enregistré.</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Modal Nouveau Personnel */}
      {isPersonnelModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200 my-auto">
            <div className={`${isEditing ? 'bg-emerald-600' : 'bg-blue-600'} p-6 flex items-center justify-between text-white sticky top-0 z-10`}>
              <div className="flex items-center gap-3">
                <div className="bg-white/20 p-2 rounded-xl">
                  <UserPlus size={20} />
                </div>
                <h2 className="text-lg font-black uppercase tracking-tight">{isEditing ? 'Modifier Personnel' : 'Nouveau Personnel'}</h2>
              </div>
              <button 
                onClick={() => {
                  setIsPersonnelModalOpen(false);
                  setIsEditing(false);
                  setSelectedPersonnel(null);
                  setName('');
                  setPosition('');
                  setBaseSalary('');
                  setPhone('');
                  setNotes('');
                }} 
                className="hover:bg-white/10 p-2 rounded-full transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            
            <div className="p-8 space-y-6 max-h-[70vh] overflow-y-auto custom-scrollbar">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Nom Complet</label>
                <input 
                  type="text" 
                  placeholder="Ex: Jean Dupont"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl outline-none font-bold text-[#121c32]"
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Poste / Fonction</label>
                <input 
                  type="text" 
                  placeholder="Ex: Caissier"
                  value={position}
                  onChange={(e) => setPosition(e.target.value)}
                  className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl outline-none font-bold text-[#121c32]"
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Salaire de Base (F)</label>
                <input 
                  type="number" 
                  placeholder="0"
                  value={baseSalary}
                  onChange={(e) => setBaseSalary(e.target.value)}
                  className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl outline-none font-black text-2xl text-emerald-600"
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Date d'embauche</label>
                <input 
                  type="date" 
                  value={hiringDate}
                  onChange={(e) => setHiringDate(e.target.value)}
                  className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl outline-none font-bold text-[#121c32]"
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Téléphone</label>
                <input 
                  type="text" 
                  placeholder="Ex: +228 90 00 00 00"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl outline-none font-bold text-[#121c32]"
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Commentaires / Notes</label>
                <textarea 
                  placeholder="Informations complémentaires sur l'employé..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl outline-none font-bold text-[#121c32] min-h-[100px] resize-none"
                />
              </div>

              <button 
                onClick={handleSavePersonnel}
                className={`w-full py-5 ${isEditing ? 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-500/20' : 'bg-blue-600 hover:bg-blue-700 shadow-blue-500/20'} text-white rounded-2xl font-black uppercase tracking-widest shadow-xl transition-all flex items-center justify-center gap-3 active:scale-95`}
              >
                <CheckCircle size={24} />
                {isEditing ? 'Enregistrer les modifications' : 'Enregistrer le personnel'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Historique des Salaires */}
      {isHistoryModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white w-full max-w-4xl rounded-[2.5rem] shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200 my-auto">
            <div className="bg-[#121c32] p-6 flex items-center justify-between text-white sticky top-0 z-10">
              <div className="flex items-center gap-3">
                <div className="bg-blue-500 p-2 rounded-xl">
                  <HistoryIcon size={20} />
                </div>
                <div>
                  <h2 className="text-lg font-black uppercase tracking-tight">Historique des Salaires</h2>
                  <p className="text-[10px] font-bold text-blue-400 uppercase tracking-widest">{selectedPersonnel?.name}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => {
                    const mfConfig = JSON.parse(localStorage.getItem('microfox_mf_config') || '{"nom": "MicroFoX"}');
                    const html = `
                      <html>
                        <head>
                          <title>Historique Salaires - ${selectedPersonnel?.name}</title>
                          <style>
                            body { font-family: sans-serif; padding: 40px; }
                            .header { text-align: center; border-bottom: 2px solid #121c32; padding-bottom: 20px; margin-bottom: 30px; }
                            h1 { text-transform: uppercase; margin: 0; }
                            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                            th { background: #121c32; color: white; padding: 10px; text-align: left; font-size: 12px; }
                            td { border-bottom: 1px solid #eee; padding: 10px; font-size: 14px; }
                            .total { font-weight: bold; text-align: right; margin-top: 20px; font-size: 18px; }
                          </style>
                        </head>
                        <body>
                          <div class="header">
                            <h1>${mfConfig.nom}</h1>
                            <p>HISTORIQUE DES SALAIRES - ${selectedPersonnel?.name}</p>
                            <p>Période: ${new Date(startDate).toLocaleDateString()} au ${new Date(endDate).toLocaleDateString()}</p>
                          </div>
                          <table>
                            <thead>
                              <tr>
                                <th>Date</th>
                                <th>Période</th>
                                <th>Type</th>
                                <th>Montant</th>
                              </tr>
                            </thead>
                            <tbody>
                              ${filteredPayments.map(p => `
                                <tr>
                                  <td>${new Date(p.date).toLocaleDateString()}</td>
                                  <td>${p.period}</td>
                                  <td>${p.type}</td>
                                  <td>${p.amount.toLocaleString()} F</td>
                                </tr>
                              `).join('')}
                            </tbody>
                          </table>
                          <div class="total">Total versé: ${filteredPayments.reduce((sum, p) => sum + p.amount, 0).toLocaleString()} F</div>
                          <script>window.print();</script>
                        </body>
                      </html>
                    `;
                    const win = window.open('', '_blank');
                    win?.document.write(html);
                    win?.document.close();
                  }}
                  className="p-2 bg-white/10 text-white rounded-lg hover:bg-white/20 transition-all"
                  title="Imprimer l'historique"
                >
                  <Printer size={20} />
                </button>
                <button 
                  onClick={() => {
                    const mfConfig = JSON.parse(localStorage.getItem('microfox_mf_config') || '{"nom": "MicroFoX"}');
                    const html = `
                      <html>
                        <head>
                          <title>Historique Salaires - ${selectedPersonnel?.name}</title>
                          <style>
                            body { font-family: sans-serif; padding: 40px; }
                            .header { text-align: center; border-bottom: 2px solid #121c32; padding-bottom: 20px; margin-bottom: 30px; }
                            h1 { text-transform: uppercase; margin: 0; }
                            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                            th { background: #121c32; color: white; padding: 10px; text-align: left; font-size: 12px; }
                            td { border-bottom: 1px solid #eee; padding: 10px; font-size: 14px; }
                            .total { font-weight: bold; text-align: right; margin-top: 20px; font-size: 18px; }
                          </style>
                        </head>
                        <body>
                          <div class="header">
                            <h1>${mfConfig.nom}</h1>
                            <p>HISTORIQUE DES SALAIRES - ${selectedPersonnel?.name}</p>
                            <p>Période: ${new Date(startDate).toLocaleDateString()} au ${new Date(endDate).toLocaleDateString()}</p>
                          </div>
                          <table>
                            <thead>
                              <tr>
                                <th>Date</th>
                                <th>Période</th>
                                <th>Type</th>
                                <th>Montant</th>
                              </tr>
                            </thead>
                            <tbody>
                              ${filteredPayments.map(p => `
                                <tr>
                                  <td>${new Date(p.date).toLocaleDateString()}</td>
                                  <td>${p.period}</td>
                                  <td>${p.type}</td>
                                  <td>${p.amount.toLocaleString()} F</td>
                                </tr>
                              `).join('')}
                            </tbody>
                          </table>
                          <div class="total">Total versé: ${filteredPayments.reduce((sum, p) => sum + p.amount, 0).toLocaleString()} F</div>
                        </body>
                      </html>
                    `;
                    const blob = new Blob([html], { type: 'text/html;charset=utf-8;' });
                    const link = document.createElement('a');
                    const url = URL.createObjectURL(blob);
                    link.setAttribute('href', url);
                    link.setAttribute('download', `historique_salaires_${selectedPersonnel?.name}.html`);
                    link.style.visibility = 'hidden';
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                  }}
                  className="p-2 bg-white/10 text-white rounded-lg hover:bg-white/20 transition-all"
                  title="Télécharger l'historique"
                >
                  <Download size={20} />
                </button>
                <button onClick={() => setIsHistoryModalOpen(false)} className="hover:bg-white/10 p-2 rounded-full transition-colors">
                  <X size={20} />
                </button>
              </div>
            </div>
            
            <div className="p-8 space-y-6 max-h-[80vh] overflow-y-auto custom-scrollbar">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-gray-50 p-6 rounded-[2rem] border border-gray-100">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-gray-600 uppercase tracking-widest ml-1">Période du</label>
                  <input 
                    type="date" 
                    value={startDate} 
                    onChange={(e) => setStartDate(e.target.value)} 
                    className="w-full p-3 bg-white border border-gray-100 rounded-2xl outline-none text-sm font-bold text-[#121c32]" 
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-gray-600 uppercase tracking-widest ml-1">Au</label>
                  <input 
                    type="date" 
                    value={endDate} 
                    onChange={(e) => setEndDate(e.target.value)} 
                    className="w-full p-3 bg-white border border-gray-100 rounded-2xl outline-none text-sm font-bold text-[#121c32]" 
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-red-50 p-6 rounded-[2rem] border border-red-100">
                  <p className="text-[10px] font-black text-red-600 uppercase tracking-widest mb-1">Salaire payé au cours de la période</p>
                  <p className="text-2xl font-black text-red-700">{filteredPayments.reduce((sum, p) => sum + p.amount, 0).toLocaleString()} F</p>
                </div>
                <div className="bg-blue-50 p-6 rounded-[2rem] border border-blue-100">
                  <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest mb-1">Total du salaire de la période (Base)</p>
                  <p className="text-2xl font-black text-blue-700">{selectedPersonnel?.baseSalary.toLocaleString()} F</p>
                </div>
              </div>

              <div className="bg-white rounded-3xl border border-gray-100 overflow-x-auto shadow-sm custom-scrollbar">
                <table className="w-full text-left min-w-[600px]">
                  <thead>
                    <tr className="bg-gray-50/50">
                      <th className="px-6 py-4 text-[10px] font-black text-gray-600 uppercase tracking-widest">Date</th>
                      <th className="px-6 py-4 text-[10px] font-black text-gray-600 uppercase tracking-widest">Période</th>
                      <th className="px-6 py-4 text-[10px] font-black text-gray-600 uppercase tracking-widest text-right">Montant</th>
                      <th className="px-6 py-4 text-[10px] font-black text-gray-600 uppercase tracking-widest">Statut</th>
                      <th className="px-6 py-4 text-[10px] font-black text-gray-600 uppercase tracking-widest">Enregistré par</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {filteredPayments.length > 0 ? (
                      filteredPayments.map((p, idx) => (
                        <tr key={`${p.id}_${idx}`} className="hover:bg-gray-50/30 transition-colors">
                          <td className="px-6 py-4 text-sm font-bold text-gray-700">
                            {new Date(p.date).toLocaleDateString()}
                          </td>
                          <td className="px-6 py-4 text-sm font-black text-[#121c32]">
                            {p.period}
                          </td>
                          <td className="px-6 py-4 text-right">
                            <p className="text-sm font-black text-red-600">{p.amount.toLocaleString()} F</p>
                          </td>
                          <td className="px-6 py-4">
                            <span className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-tight ${
                              p.type === 'Avance' ? 'bg-orange-50 text-orange-600' :
                              p.type === 'Reste' ? 'bg-blue-50 text-blue-600' :
                              'bg-emerald-50 text-emerald-600'
                            }`}>
                              {p.type === 'Avance' ? 'Avance sur salaire' : 
                               p.type === 'Reste' ? 'Reste du salaire' : 
                               'Total Salaire'}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-xs font-bold text-gray-400 uppercase">
                            {p.recordedBy}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={5} className="px-6 py-20 text-center">
                          <FileText size={48} className="mx-auto text-gray-100 mb-4" />
                          <p className="text-gray-400 font-medium italic">Aucun paiement trouvé pour cette période.</p>
                        </td>
                      </tr>
                    )}
                  </tbody>
                  {filteredPayments.length > 0 && (
                    <tfoot className="bg-gray-50">
                      <tr>
                        <td colSpan={3} className="px-6 py-4 text-[10px] font-black text-gray-600 uppercase tracking-widest text-right">Total versé</td>
                        <td className="px-6 py-4 text-right">
                          <p className="text-lg font-black text-red-600">{filteredPayments.reduce((sum, p) => sum + p.amount, 0).toLocaleString()} F</p>
                        </td>
                        <td></td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PersonnelSalaries;
