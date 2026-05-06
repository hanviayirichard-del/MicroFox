import React, { useState, useEffect } from 'react';
import { dispatchStorageEvent } from '../utils/events';
import { Calculator, Plus, Search, Trash2, Calendar, FileText, TrendingDown, CheckCircle, X, Printer, Download } from 'lucide-react';

interface Expense {
  id: string;
  date: string;
  category: string;
  description: string;
  amount: number;
  recordedBy: string;
  isValidated?: boolean;
  validatedBy?: string;
  isDeleted?: boolean;
  personnelId?: string;
  personnelName?: string;
  salaryType?: 'Avance' | 'Reste' | 'Total';
  salaryPeriod?: string;
}

const AdministrativeExpenses: React.FC = () => {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);
  
  // Filter state
  const [startDate, setStartDate] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
  });
  
  // Form state
  const [category, setCategory] = useState('Fournitures');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [personnelId, setPersonnelId] = useState('');
  const [salaryType, setSalaryType] = useState<'Avance' | 'Reste' | 'Total'>('Total');
  const [salaryPeriod, setSalaryPeriod] = useState(new Date().toISOString().substring(0, 7));
  const [personnelList, setPersonnelList] = useState<any[]>([]);

  const categories = [
    'Fournitures',
    'Loyer',
    'Électricité / Eau',
    'Communication',
    'Transport',
    'Salaires',
    'Maintenance',
    'Impôts & Taxes',
    'Autres'
  ];

  const loadExpenses = () => {
    const userStr = localStorage.getItem('microfox_current_user');
    if (userStr) {
      setCurrentUser(JSON.parse(userStr));
    }
    const saved = localStorage.getItem('microfox_admin_expenses');
    if (saved) {
      setExpenses(JSON.parse(saved));
    }
    const savedPersonnel = localStorage.getItem('microfox_personnel');
    if (savedPersonnel) {
      setPersonnelList(JSON.parse(savedPersonnel));
    }
  };

  useEffect(() => {
    loadExpenses();
    window.addEventListener('storage', loadExpenses);
    window.addEventListener('microfox_storage' as any, loadExpenses);
    return () => window.removeEventListener('storage', loadExpenses);
      window.removeEventListener('microfox_storage' as any, loadExpenses);
  }, []);

  const handleSave = () => {
    if (!description) {
      alert("Échec de l'enregistrement : La description / motif est obligatoire.");
      return;
    }
    if (!amount) {
      alert("Échec de l'enregistrement : Le montant est obligatoire.");
      return;
    }
    if (Number(amount) <= 0) {
      alert("Échec de l'enregistrement : Le montant doit être un nombre supérieur à 0.");
      return;
    }
    if (category === 'Salaires' && !personnelId) {
      alert("Échec de l'enregistrement : Veuillez sélectionner un membre du personnel.");
      return;
    }

    try {
      const user = currentUser || JSON.parse(localStorage.getItem('microfox_current_user') || '{}');
      const targetCaisse = user?.role === 'agent commercial' ? null : (user?.caisse || (user?.role === 'administrateur' || user?.role === 'directeur' ? 'CAISSE PRINCIPALE' : null));
      
      if (targetCaisse) {
        const cashKey = `microfox_cash_balance_${targetCaisse}`;
        const currentCashBalance = Number(localStorage.getItem(cashKey) || 0);
        
        // Mise à jour du solde de la caisse
        localStorage.setItem(cashKey, (currentCashBalance - Number(amount)).toString());

        // Enregistrer la transaction dans l'historique général pour cohérence
        const txsSaved = localStorage.getItem('microfox_vault_transactions');
        const allTxs = txsSaved ? JSON.parse(txsSaved) : [];
        const newTx = {
          id: `${Date.now()}_${Math.random().toString(36).substr(2, 9)}_exp`,
          type: 'Dépense administrative',
          from: targetCaisse,
          to: category.toUpperCase(),
          amount: Number(amount),
          date: new Date().toISOString(),
          userId: user.id || 'system',
          cashierName: user.identifiant || 'Admin',
          observation: description
        };
        localStorage.setItem('microfox_vault_transactions', JSON.stringify([newTx, ...allTxs]));
      }
      
      const selectedPersonnel = personnelList.find(p => p.id === personnelId);

      const newExpense: Expense = {
        id: `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        date,
        category,
        description,
        amount: Number(amount),
        recordedBy: user.identifiant || 'Admin',
        isValidated: false,
        isDeleted: false,
        personnelId: category === 'Salaires' ? personnelId : undefined,
        personnelName: category === 'Salaires' ? selectedPersonnel?.name : undefined,
        salaryType: category === 'Salaires' ? salaryType : undefined,
        salaryPeriod: category === 'Salaires' ? salaryPeriod : undefined
      };

      const updatedExpenses = [newExpense, ...expenses];
      localStorage.setItem('microfox_admin_expenses', JSON.stringify(updatedExpenses));
      localStorage.setItem('microfox_pending_sync', 'true');
      
      setExpenses(updatedExpenses);
      setIsModalOpen(false);
      
      // Reset form
      setDescription('');
      setAmount('');
      setPersonnelId('');
      setSalaryType('Total');
      
      dispatchStorageEvent();
    } catch (error) {
      alert("Échec de l'enregistrement : Erreur technique lors de l'accès au stockage local.");
    }
  };

  const handleDelete = (id: string) => {
    if (currentUser?.role === 'caissier') {
      alert("Accès refusé : Le caissier n'a pas le droit de supprimer les dépenses.");
      return;
    }
    
    setExpenses(prevExpenses => {
      const targetExpense = prevExpenses.find(e => String(e.id) === String(id));
      if (!targetExpense || targetExpense.isDeleted) return prevExpenses;

      if (!window.confirm("Voulez-vous vraiment supprimer cette dépense ? Cette action restaurera également le montant dans la caisse correspondante.")) {
        return prevExpenses;
      }
      
      try {
        // Restaurer le solde de la caisse si nécessaire
        const user = currentUser || JSON.parse(localStorage.getItem('microfox_current_user') || '{}');
        const targetCaisse = user?.role === 'agent commercial' ? null : (user?.caisse || (user?.role === 'administrateur' || user?.role === 'directeur' ? 'CAISSE PRINCIPALE' : null));
        
        if (targetCaisse) {
          const cashKey = `microfox_cash_balance_${targetCaisse}`;
          const currentCashBalance = Number(localStorage.getItem(cashKey) || 0);
          localStorage.setItem(cashKey, (currentCashBalance + targetExpense.amount).toString());
        }

        const updatedExpenses = prevExpenses.map(e => 
          String(e.id) === String(id) ? { ...e, isDeleted: true } : e
        );
        
        localStorage.setItem('microfox_admin_expenses', JSON.stringify(updatedExpenses));
        localStorage.setItem('microfox_pending_sync', 'true');
        
        // Dispatch storage event to notify other components and trigger local state sync
        setTimeout(() => {
          dispatchStorageEvent();
        }, 50);

        return updatedExpenses;
      } catch (error) {
        alert("Erreur lors de la suppression de la dépense.");
        return prevExpenses;
      }
    });
  };

  const filteredExpenses = expenses.filter(e => {
    if (e.isDeleted) return false;
    const eDate = e.date.split('T')[0];
    const matchesSearch = e.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         e.category.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesDate = eDate >= startDate && eDate <= endDate;
    return matchesSearch && matchesDate;
  });

  const totalExpenses = filteredExpenses.reduce((sum, e) => sum + e.amount, 0);

  const generateHTMLContent = (isForPrint = false) => {
    if (filteredExpenses.length === 0) return null;
    const mfConfig = JSON.parse(localStorage.getItem('microfox_mf_config') || '{"nom": "MicroFoX", "adresse": "", "code": ""}');
    const title = `DÉPENSES ADMINISTRATIVES DU ${new Date(startDate).toLocaleDateString()} AU ${new Date(endDate).toLocaleDateString()}`;
    const headers = ['Date', 'Catégorie', 'Description', 'Montant', 'Enregistré par'];
    
    const htmlContent = `
      <!DOCTYPE html>
      <html lang="fr">
      <head>
        <meta charset="UTF-8">
        <title>Dépenses Administratives - ${mfConfig.nom}</title>
        <style>
          body { font-family: sans-serif; padding: 20px; color: #121c32; }
          .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #121c32; padding-bottom: 10px; }
          .mf-name { font-size: 24px; font-weight: 900; text-transform: uppercase; margin: 0; }
          .mf-address { font-size: 12px; font-weight: bold; color: #666; margin: 5px 0; }
          h2 { color: #dc2626; margin-top: 20px; text-transform: uppercase; }
          table { width: 100%; border-collapse: collapse; margin-top: 20px; }
          th { background-color: #121c32; color: white; text-align: left; padding: 12px 8px; font-size: 11px; text-transform: uppercase; }
          td { border-bottom: 1px solid #eee; padding: 10px 8px; font-size: 13px; }
          tr:nth-child(even) { background-color: #f9fafb; }
          .amount { color: #dc2626; font-weight: bold; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1 class="mf-name">${mfConfig.nom}</h1>
          <p class="mf-address">${mfConfig.adresse}</p>
          <p class="mf-address">Tél: ${mfConfig.telephone || 'N/A'} | Code: ${mfConfig.code}</p>
        </div>
        <h2>${title}</h2>
        <table>
          <thead>
            <tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr>
          </thead>
          <tbody>
            ${filteredExpenses.map(e => `
              <tr>
                <td>${new Date(e.date).toLocaleDateString()}</td>
                <td>${e.category}</td>
                <td>${e.description}</td>
                <td class="amount">${e.amount.toLocaleString()} F</td>
                <td>${e.recordedBy}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
        ${isForPrint ? '<script>window.print();</script>' : ''}
      </body>
      </html>
    `;
    return htmlContent;
  };

  const handlePrint = () => {
    const htmlContent = generateHTMLContent(true);
    if (!htmlContent) return alert("Aucune donnée à imprimer.");
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(htmlContent);
      printWindow.document.close();
    }
  };

  const handleExport = () => {
    const htmlContent = generateHTMLContent();
    if (!htmlContent) return alert("Aucune donnée à exporter.");
    const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `depenses_administratives_${startDate}_${endDate}.html`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-[#121c32] uppercase tracking-tight">Dépenses Administratives</h1>
          <p className="text-gray-700 text-sm font-medium mt-1">Enregistrement et suivi des charges d'exploitation</p>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={handlePrint}
            className="p-2.5 bg-white border border-gray-200 rounded-xl text-gray-600 hover:text-blue-600 transition-all shadow-sm"
            title="Imprimer"
          >
            <Printer size={20} />
          </button>
          <button 
            onClick={handleExport}
            className="p-2.5 bg-white border border-gray-200 rounded-xl text-gray-600 hover:text-emerald-600 transition-all shadow-sm"
            title="Exporter HTML"
          >
            <Download size={20} />
          </button>
          <div className="relative w-full md:w-64">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-600" size={18} />
            <input 
              type="text" 
              placeholder="Rechercher..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl outline-none focus:border-emerald-500 font-medium transition-all shadow-sm text-sm"
            />
          </div>
          <button 
            onClick={() => setIsModalOpen(true)}
            className="bg-[#00c896] text-white px-6 py-2.5 rounded-xl font-black uppercase tracking-widest shadow-lg hover:bg-[#00a87d] transition-all flex items-center gap-2 shrink-0 text-sm"
          >
            <Plus size={18} />
            Nouvelle Dépense
          </button>
        </div>
      </div>

      <div className="bg-white p-6 rounded-[2rem] border border-gray-100 shadow-sm grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-1">
          <label className="text-[10px] font-black text-gray-600 uppercase tracking-widest ml-1">Période du</label>
          <input 
            type="date" 
            value={startDate} 
            onChange={(e) => setStartDate(e.target.value)} 
            className="w-full p-3 bg-gray-50 border border-gray-100 rounded-2xl outline-none text-sm font-bold text-[#121c32]" 
          />
        </div>
        <div className="space-y-1">
          <label className="text-[10px] font-black text-gray-600 uppercase tracking-widest ml-1">Au</label>
          <input 
            type="date" 
            value={endDate} 
            onChange={(e) => setEndDate(e.target.value)} 
            className="w-full p-3 bg-gray-50 border border-gray-100 rounded-2xl outline-none text-sm font-bold text-[#121c32]" 
          />
        </div>
      </div>

      <div className="bg-white p-6 rounded-[2rem] border border-gray-100 shadow-sm flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-red-50 text-red-600 flex items-center justify-center">
            <TrendingDown size={24} />
          </div>
          <div>
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Total des Dépenses (Période)</p>
            <p className="text-2xl font-black text-[#121c32]">{totalExpenses.toLocaleString()} F</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Nombre d'entrées</p>
          <p className="text-xl font-black text-gray-600">{filteredExpenses.length}</p>
        </div>
      </div>

      <div className="bg-white rounded-[2.5rem] shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left min-w-[800px]">
            <thead>
              <tr className="bg-gray-50/50">
                <th className="px-6 py-4 text-[10px] font-black text-gray-600 uppercase tracking-widest">Date</th>
                <th className="px-6 py-4 text-[10px] font-black text-gray-600 uppercase tracking-widest">Catégorie</th>
                <th className="px-6 py-4 text-[10px] font-black text-gray-600 uppercase tracking-widest">Description</th>
                <th className="px-6 py-4 text-[10px] font-black text-gray-600 uppercase tracking-widest text-right">Montant</th>
                <th className="px-6 py-4 text-[10px] font-black text-gray-600 uppercase tracking-widest text-center">Statut</th>
                <th className="px-6 py-4 text-[10px] font-black text-gray-600 uppercase tracking-widest text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filteredExpenses.length > 0 ? (
                filteredExpenses.map((e) => (
                  <tr key={e.id} className="hover:bg-gray-50/30 transition-colors">
                    <td className="px-6 py-4 text-sm font-bold text-gray-700">
                      {new Date(e.date).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4">
                      <span className="px-3 py-1 bg-gray-100 text-gray-600 rounded-lg text-[10px] font-black uppercase tracking-tight">
                        {e.category}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-sm font-black text-[#121c32]">{e.description}</p>
                      {e.personnelName && (
                        <p className="text-[10px] font-black text-blue-600 uppercase tracking-tight">Personnel: {e.personnelName} ({e.salaryType})</p>
                      )}
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-tight">Par: {e.recordedBy}</p>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <p className="text-sm font-black text-red-600">{e.amount.toLocaleString()} F</p>
                    </td>
                    <td className="px-6 py-4 border-l border-gray-50">
                      <div className="flex justify-center">
                        {e.isValidated ? (
                          <div className="flex items-center gap-1 bg-emerald-50 text-emerald-600 px-3 py-1 rounded-full border border-emerald-100">
                            <CheckCircle size={12} />
                            <span className="text-[9px] font-black uppercase tracking-tight">Validé</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1 bg-amber-50 text-amber-600 px-3 py-1 rounded-full border border-amber-100">
                             <TrendingDown size={12} className="animate-pulse" />
                            <span className="text-[9px] font-black uppercase tracking-tight">En attente</span>
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      {currentUser?.role !== 'caissier' && (
                        <button 
                          onClick={() => handleDelete(e.id)}
                          className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                        >
                          <Trash2 size={18} />
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="px-6 py-20 text-center">
                    <div className="w-16 h-16 bg-gray-50 text-gray-300 rounded-full flex items-center justify-center mx-auto mb-4">
                      <FileText size={32} />
                    </div>
                    <p className="text-gray-500 font-medium italic">Aucune dépense enregistrée.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal d'enregistrement */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200 my-auto">
            <div className="bg-[#121c32] p-6 flex items-center justify-between text-white sticky top-0 z-10">
              <div className="flex items-center gap-3">
                <div className="bg-emerald-500 p-2 rounded-xl">
                  <Calculator size={20} />
                </div>
                <h2 className="text-lg font-black uppercase tracking-tight">Nouvelle Dépense</h2>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="hover:bg-white/10 p-2 rounded-full transition-colors">
                <X size={20} />
              </button>
            </div>
            
            <div className="p-8 space-y-6 max-h-[70vh] overflow-y-auto custom-scrollbar">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Date</label>
                <input 
                  type="date" 
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl outline-none font-bold text-[#121c32]"
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Catégorie</label>
                <select 
                  value={category}
                  onChange={(e) => {
                    const newCat = e.target.value;
                    setCategory(newCat);
                    if (newCat !== 'Salaires') {
                      setDescription('');
                      setPersonnelId('');
                    } else if (personnelId) {
                      const p = personnelList.find(pers => pers.id === personnelId);
                      if (p) {
                        setDescription(`Salaire ${salaryType} - ${p.name} (${salaryPeriod})`);
                      }
                    }
                  }}
                  className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl outline-none font-bold text-[#121c32]"
                >
                  {categories.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>

              {category === 'Salaires' && (
                <>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Personnel</label>
                    <select 
                      value={personnelId}
                      onChange={(e) => {
                        const id = e.target.value;
                        setPersonnelId(id);
                        const p = personnelList.find(pers => pers.id === id);
                        if (p) {
                          setDescription(`Salaire ${salaryType} - ${p.name} (${salaryPeriod})`);
                        }
                      }}
                      className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl outline-none font-bold text-[#121c32]"
                    >
                      <option value="">Sélectionner un employé</option>
                      {personnelList.map(p => <option key={p.id} value={p.id}>{p.name} ({p.position})</option>)}
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Type de Paiement</label>
                      <select 
                        value={salaryType}
                        onChange={(e) => {
                          const type = e.target.value as any;
                          setSalaryType(type);
                          const p = personnelList.find(pers => pers.id === personnelId);
                          if (p) {
                            setDescription(`Salaire ${type} - ${p.name} (${salaryPeriod})`);
                          }
                        }}
                        className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl outline-none font-bold text-[#121c32]"
                      >
                        <option value="Total">Total</option>
                        <option value="Avance">Avance</option>
                        <option value="Reste">Reste</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Période (Mois)</label>
                      <input 
                        type="month" 
                        value={salaryPeriod}
                        onChange={(e) => {
                          const period = e.target.value;
                          setSalaryPeriod(period);
                          const p = personnelList.find(pers => pers.id === personnelId);
                          if (p) {
                            setDescription(`Salaire ${salaryType} - ${p.name} (${period})`);
                          }
                        }}
                        className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl outline-none font-bold text-[#121c32]"
                      />
                    </div>
                  </div>
                </>
              )}

              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Description / Motif</label>
                <input 
                  type="text" 
                  placeholder="Ex: Achat de papier A4"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl outline-none font-bold text-[#121c32] placeholder:text-gray-300"
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Montant (F)</label>
                <input 
                  type="number" 
                  placeholder="0"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl outline-none font-black text-2xl text-red-600 placeholder:text-gray-300"
                />
              </div>

              <button 
                onClick={handleSave}
                className="w-full py-5 bg-[#00c896] text-white rounded-2xl font-black uppercase tracking-widest shadow-xl shadow-emerald-500/20 hover:bg-[#00a87d] transition-all flex items-center justify-center gap-3 active:scale-95"
              >
                <CheckCircle size={24} />
                Enregistrer la dépense
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdministrativeExpenses;
