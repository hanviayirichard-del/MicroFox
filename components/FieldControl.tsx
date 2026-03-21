import React, { useState, useEffect } from 'react';
import { 
  Search, 
  ClipboardCheck, 
  AlertCircle, 
  CheckCircle, 
  History, 
  Save, 
  User, 
  Wallet,
  FileText,
  MessageSquare,
  TrendingDown,
  TrendingUp,
  Minus
} from 'lucide-react';
import { ClientAccount, TontineAccount, FieldControlReport, User as UserType } from '../types';
import { recordAuditLog } from '../utils/audit';

const FieldControl: React.FC = () => {
  const [clients, setClients] = useState<ClientAccount[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedClient, setSelectedClient] = useState<ClientAccount | null>(null);
  const [selectedTontine, setSelectedTontine] = useState<TontineAccount | null>(null);
  const [bookletBalance, setBookletBalance] = useState<string>('');
  const [observations, setObservations] = useState('');
  const [recommendations, setRecommendations] = useState('');
  const [reports, setReports] = useState<FieldControlReport[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  const currentUser: UserType | null = JSON.parse(localStorage.getItem('microfox_current_user') || 'null');

  useEffect(() => {
    const savedClients = localStorage.getItem('microfox_members_data');
    if (savedClients) {
      setClients(JSON.parse(savedClients));
    }

    const savedReports = localStorage.getItem('microfox_field_control_reports');
    if (savedReports) {
      setReports(JSON.parse(savedReports));
    }
  }, []);

  const filteredClients = clients.filter(c => {
    const matchesSearch = c.tontineAccounts.length > 0 && (
      c.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
      c.code.toLowerCase().includes(searchTerm.toLowerCase())
    );
    
    if (currentUser?.role === 'agent commercial' && currentUser?.zoneCollecte) {
      return matchesSearch && c.zone === currentUser.zoneCollecte;
    }
    
    return matchesSearch;
  });

  const handleSelectClient = (client: ClientAccount) => {
    setSelectedClient(client);
    setSelectedTontine(null);
    setBookletBalance('');
    setObservations('');
    setRecommendations('');
  };

  const handleSaveReport = () => {
    if (!selectedClient || !selectedTontine || !currentUser) {
      alert("Veuillez sélectionner un client et un compte tontine.");
      return;
    }

    const bookletVal = parseFloat(bookletBalance) || 0;
    const difference = selectedTontine.balance - bookletVal;

    if (difference !== 0 && !observations.trim()) {
      alert("La raison de la différence (Observations) est obligatoire en cas d'écart.");
      return;
    }

    const newReport: FieldControlReport = {
      id: `fcr_${Date.now()}`,
      date: new Date().toISOString(),
      clientId: selectedClient.id,
      clientName: selectedClient.name,
      clientCode: selectedClient.code,
      tontineAccountId: selectedTontine.id,
      tontineAccountNumber: selectedTontine.number,
      systemBalance: selectedTontine.balance,
      bookletBalance: bookletVal,
      difference: difference,
      observations: observations,
      recommendations: recommendations,
      controllerId: currentUser.id,
      controllerName: currentUser.identifiant
    };

    const updatedReports = [newReport, ...reports];
    setReports(updatedReports);
    localStorage.setItem('microfox_field_control_reports', JSON.stringify(updatedReports));
    localStorage.setItem('microfox_pending_sync', 'true');

    recordAuditLog(
      'CREATION', 
      'CONTRÔLE TERRAIN', 
      `Nouveau contrôle terrain pour ${selectedClient.name} (${selectedClient.code}) - Compte: ${selectedTontine.number}. Différence: ${difference} FCFA`
    );

    alert("Rapport de contrôle terrain enregistré avec succès.");
    
    // Reset form
    setSelectedClient(null);
    setSelectedTontine(null);
    setBookletBalance('');
    setObservations('');
    setRecommendations('');
    setSearchTerm('');
  };

  const handleRegularize = () => {
    if (!selectedClient || !selectedTontine || !currentUser) return;

    const bookletVal = parseFloat(bookletBalance) || 0;
    const difference = selectedTontine.balance - bookletVal;

    if (difference >= 0) return; // Only for negative difference (system < booklet)

    const amountToPay = Math.abs(difference);

    if (confirm(`Confirmer le paiement de ${amountToPay.toLocaleString()} FCFA pour régulariser le solde système ?`)) {
      const updatedClients = clients.map(c => {
        if (c.id === selectedClient.id) {
          const updatedTontineAccounts = c.tontineAccounts.map(acc => {
            if (acc.id === selectedTontine.id) {
              return { ...acc, balance: bookletVal };
            }
            return acc;
          });
          return { ...c, tontineAccounts: updatedTontineAccounts };
        }
        return c;
      });

      setClients(updatedClients);
      localStorage.setItem('microfox_members_data', JSON.stringify(updatedClients));
      localStorage.setItem('microfox_pending_sync', 'true');

      // Update selected tontine for UI
      setSelectedTontine({ ...selectedTontine, balance: bookletVal });

      recordAuditLog(
        'MODIFICATION',
        'CONTRÔLE TERRAIN',
        `Régularisation du solde système pour ${selectedClient.name} (${selectedClient.code}). Paiement de ${amountToPay} FCFA. Nouveau solde: ${bookletVal} FCFA`
      );

      alert("Le solde système a été régularisé avec succès.");
    }
  };

  const getDifferenceColor = (diff: number) => {
    if (diff === 0) return 'text-emerald-500';
    return 'text-red-500';
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-12 px-4 sm:px-6 lg:px-8">
      <div className="flex justify-between items-start">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-600 shadow-sm border border-indigo-100">
            <ClipboardCheck size={24} />
          </div>
          <div>
            <h1 className="text-2xl font-black text-[#121c32] uppercase tracking-tight">Contrôle Terrain</h1>
            <p className="text-gray-700 text-xs font-bold uppercase tracking-widest mt-0.5">Vérification des livrets et rapprochement des soldes</p>
          </div>
        </div>
        <button 
          onClick={() => setShowHistory(!showHistory)}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black transition-all shadow-sm active:scale-95 uppercase tracking-widest ${
            showHistory ? 'bg-indigo-600 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:text-indigo-600'
          }`}
        >
          <History size={16} /> {showHistory ? 'Nouveau Contrôle' : 'Historique'}
        </button>
      </div>

      {showHistory ? (
        <div className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-gray-100">
          <h2 className="text-lg font-black text-[#121c32] uppercase tracking-tight mb-6 flex items-center gap-2">
            <History size={20} className="text-indigo-600" />
            Historique des Contrôles
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-gray-50 bg-gray-50/50">
                  <th className="px-6 py-4 text-[10px] font-black text-gray-500 uppercase tracking-widest">Date / Contrôleur</th>
                  <th className="px-6 py-4 text-[10px] font-black text-gray-500 uppercase tracking-widest">Client</th>
                  <th className="px-6 py-4 text-[10px] font-black text-gray-500 uppercase tracking-widest text-right">Solde Système</th>
                  <th className="px-6 py-4 text-[10px] font-black text-gray-500 uppercase tracking-widest text-right">Solde Livret</th>
                  <th className="px-6 py-4 text-[10px] font-black text-gray-500 uppercase tracking-widest text-right">Écart</th>
                  <th className="px-6 py-4 text-[10px] font-black text-gray-500 uppercase tracking-widest">Observations</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {reports.length > 0 ? (
                  reports.map((report) => (
                    <tr key={report.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex flex-col">
                          <span className="text-xs font-black text-[#121c32]">{new Date(report.date).toLocaleDateString()}</span>
                          <span className="text-[10px] font-bold text-gray-400 uppercase">{report.controllerName}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col">
                          <span className="text-xs font-black text-[#121c32] uppercase">{report.clientName}</span>
                          <span className="text-[10px] font-bold text-indigo-500 uppercase tracking-tighter">Compte: {report.tontineAccountNumber}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right text-xs font-bold text-gray-600">{report.systemBalance.toLocaleString()} FCFA</td>
                      <td className="px-6 py-4 text-right text-xs font-bold text-gray-600">{report.bookletBalance.toLocaleString()} FCFA</td>
                      <td className={`px-6 py-4 text-right text-xs font-black ${getDifferenceColor(report.difference)}`}>
                        {report.difference > 0 ? '+' : ''}{report.difference.toLocaleString()} FCFA
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-[10px] font-medium text-gray-700 max-w-[200px] line-clamp-2">{report.observations}</p>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="px-6 py-20 text-center">
                      <div className="flex flex-col items-center gap-3 opacity-20">
                        <History size={48} />
                        <p className="text-sm font-black uppercase tracking-widest text-gray-600">Aucun rapport trouvé</p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Sélection du client */}
          <div className="lg:col-span-1 space-y-4">
            <div className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-gray-100 h-full flex flex-col">
              <h2 className="text-lg font-black text-[#121c32] uppercase tracking-tight mb-4 flex items-center gap-2">
                <User size={20} className="text-indigo-600" />
                Sélection Client
              </h2>
              <div className="relative mb-4">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                <input 
                  type="text" 
                  placeholder="Nom ou Code Client..." 
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-12 pr-4 py-3 bg-gray-50 border border-black focus:border-indigo-400 rounded-2xl outline-none text-sm font-medium text-[#121c32] transition-all"
                />
              </div>
              <div className="flex-1 overflow-y-auto max-h-[400px] space-y-2 pr-2 custom-scrollbar">
                {filteredClients.map(client => (
                  <button
                    key={client.id}
                    onClick={() => handleSelectClient(client)}
                    className={`w-full text-left p-4 rounded-2xl border transition-all ${
                      selectedClient?.id === client.id 
                        ? 'bg-indigo-50 border-indigo-200 shadow-sm' 
                        : 'bg-white border-gray-100 hover:border-indigo-100 hover:bg-gray-50'
                    }`}
                  >
                    <p className="text-xs font-black text-[#121c32] uppercase">{client.name}</p>
                    <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">{client.code}</p>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Formulaire de contrôle */}
          <div className="lg:col-span-2 space-y-6">
            {selectedClient ? (
              <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-gray-100 space-y-8 animate-in fade-in slide-in-from-right-4 duration-300">
                <div className="flex justify-between items-center border-b border-gray-50 pb-6">
                  <div>
                    <h2 className="text-xl font-black text-[#121c32] uppercase tracking-tight">{selectedClient.name}</h2>
                    <p className="text-xs font-bold text-indigo-500 uppercase tracking-[0.2em]">{selectedClient.code}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Date du contrôle</p>
                    <p className="text-sm font-black text-[#121c32]">{new Date().toLocaleDateString()}</p>
                  </div>
                </div>

                <div className="space-y-6">
                  <div>
                    <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-3 block ml-2">Sélectionner le compte tontine</label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {selectedClient.tontineAccounts.map(acc => (
                        <button
                          key={acc.id}
                          onClick={() => setSelectedTontine(acc)}
                          className={`p-4 rounded-2xl border text-left transition-all ${
                            selectedTontine?.id === acc.id
                              ? 'bg-emerald-50 border-emerald-200 ring-2 ring-emerald-500/10'
                              : 'bg-gray-50 border-transparent hover:bg-gray-100'
                          }`}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">N° {acc.number}</span>
                            <Wallet size={16} className={selectedTontine?.id === acc.id ? 'text-emerald-500' : 'text-gray-400'} />
                          </div>
                          <p className="text-lg font-black text-[#121c32]">{acc.balance.toLocaleString()} FCFA</p>
                          <p className="text-[9px] font-bold text-gray-500 uppercase tracking-widest mt-1">Solde Système</p>
                        </button>
                      ))}
                    </div>
                  </div>

                  {selectedTontine && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-4 animate-in fade-in zoom-in-95 duration-300">
                      <div className="space-y-6">
                        <div className="space-y-2">
                          <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-2 flex items-center gap-2">
                            <FileText size={14} /> Solde relevé sur le livret (FCFA)
                          </label>
                          <input 
                            type="number" 
                            value={bookletBalance}
                            onChange={(e) => setBookletBalance(e.target.value)}
                            placeholder="Entrez le solde du livret..."
                            className="w-full p-4 bg-gray-50 border border-black focus:border-indigo-400 rounded-2xl outline-none text-xl font-black text-[#121c32] transition-all"
                          />
                        </div>

                        <div className="p-6 rounded-2xl bg-gray-50 border border-gray-100 space-y-4">
                          <div className="flex justify-between items-center">
                            <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Solde Système</span>
                            <span className="text-sm font-black text-[#121c32]">{selectedTontine.balance.toLocaleString()} FCFA</span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Solde Livret</span>
                            <span className="text-sm font-black text-[#121c32]">{(parseFloat(bookletBalance) || 0).toLocaleString()} FCFA</span>
                          </div>
                          <div className="h-px bg-gray-200 my-2" />
                          <div className="flex justify-between items-center">
                            <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Écart de solde</span>
                            <div className="flex items-center gap-2">
                              {selectedTontine.balance - (parseFloat(bookletBalance) || 0) === 0 ? (
                                <CheckCircle size={16} className="text-emerald-500" />
                              ) : (
                                <AlertCircle size={16} className="text-red-500" />
                              )}
                              <span className={`text-lg font-black ${getDifferenceColor(selectedTontine.balance - (parseFloat(bookletBalance) || 0))}`}>
                                {(selectedTontine.balance - (parseFloat(bookletBalance) || 0)).toLocaleString()} FCFA
                              </span>
                            </div>
                          </div>

                          {(selectedTontine.balance - (parseFloat(bookletBalance) || 0)) < 0 && (
                            <button 
                              onClick={handleRegularize}
                              className="w-full mt-4 py-3 bg-red-50 text-red-600 border border-red-100 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-red-100 transition-all flex items-center justify-center gap-2"
                            >
                              <TrendingDown size={14} />
                              Régulariser à la caisse
                            </button>
                          )}
                        </div>
                      </div>

                      <div className="space-y-6">
                        <div className="space-y-2">
                          <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-2 flex items-center gap-2">
                            <MessageSquare size={14} /> Observations
                          </label>
                          <textarea 
                            value={observations}
                            onChange={(e) => setObservations(e.target.value)}
                            placeholder="Saisir vos observations ici..."
                            rows={3}
                            className="w-full p-4 bg-gray-50 border border-black focus:border-indigo-400 rounded-2xl outline-none text-sm font-medium text-[#121c32] transition-all resize-none"
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-2 flex items-center gap-2">
                            <CheckCircle size={14} /> Recommandations
                          </label>
                          <textarea 
                            value={recommendations}
                            onChange={(e) => setRecommendations(e.target.value)}
                            placeholder="Saisir vos recommandations ici..."
                            rows={3}
                            className="w-full p-4 bg-gray-50 border border-black focus:border-indigo-400 rounded-2xl outline-none text-sm font-medium text-[#121c32] transition-all resize-none"
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {selectedTontine && (
                    <div className="pt-6 border-t border-gray-50 flex justify-end">
                      <button
                        onClick={handleSaveReport}
                        className="flex items-center gap-3 px-8 py-4 bg-[#121c32] hover:bg-[#1a2947] text-white rounded-2xl font-black uppercase tracking-widest shadow-xl shadow-indigo-900/20 transition-all active:scale-95 group"
                      >
                        <Save size={20} className="group-hover:scale-110 transition-transform" />
                        Enregistrer le rapport
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="bg-white p-12 rounded-[2.5rem] shadow-sm border border-gray-100 flex flex-col items-center justify-center text-center space-y-4 h-full min-h-[400px]">
                <div className="w-20 h-20 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-200">
                  <User size={40} />
                </div>
                <div>
                  <h3 className="text-xl font-black text-[#121c32] uppercase tracking-tight">Aucun client sélectionné</h3>
                  <p className="text-gray-500 text-sm font-medium max-w-xs mx-auto">Veuillez sélectionner un membre dans la liste de gauche pour débuter le contrôle terrain.</p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default FieldControl;
