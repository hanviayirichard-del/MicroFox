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
  Minus,
  Trash2,
  Send,
  Printer,
  Download
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
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [adminComment, setAdminComment] = useState('');
  const [selectedZone, setSelectedZone] = useState('');
  const [historyZone, setHistoryZone] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

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
    
    const matchesZone = !selectedZone || c.zone === selectedZone;
    
    if (currentUser?.role === 'agent commercial') {
      const agentZones = currentUser.zonesCollecte || (currentUser.zoneCollecte ? [currentUser.zoneCollecte] : []);
      if (agentZones.length > 0) {
        return matchesSearch && agentZones.includes(c.zone);
      }
    }
    
    return matchesSearch && matchesZone;
  });

  const filteredReports = reports.filter(r => {
    const matchesZone = !historyZone || r.zone === historyZone;
    const reportDate = new Date(r.date).toISOString().split('T')[0];
    const matchesStart = !startDate || reportDate >= startDate;
    const matchesEnd = !endDate || reportDate <= endDate;
    return matchesZone && matchesStart && matchesEnd;
  });

  const zones = ['01', '01A', '02', '02A', '03', '03A', '04', '04A', '05', '05A', '06', '06A', '07', '07A', '08', '08A', '09', '09A'];

  const handleSelectClient = (client: ClientAccount) => {
    if (selectedClient?.id === client.id) return;
    setSelectedClient(client);
    setSelectedTontine(null);
    setBookletBalance('');
    setObservations('');
    setRecommendations('');
  };

  const handleSaveReport = () => {
    if (!selectedClient) {
      alert("Veuillez sélectionner un client.");
      return;
    }
    if (!selectedTontine) {
      alert("Veuillez sélectionner un compte tontine.");
      return;
    }
    if (!currentUser) {
      alert("Erreur: Utilisateur non connecté.");
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
      controllerName: currentUser.identifiant,
      zone: selectedClient.zone
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

  const handleSaveAdminComment = (reportId: string) => {
    const updatedReports = reports.map(r => {
      if (r.id === reportId) {
        return { ...r, adminComments: adminComment };
      }
      return r;
    });
    setReports(updatedReports);
    localStorage.setItem('microfox_field_control_reports', JSON.stringify(updatedReports));
    setEditingCommentId(null);
    setAdminComment('');
    
    recordAuditLog(
      'MODIFICATION',
      'CONTRÔLE TERRAIN',
      `Ajout d'un commentaire administrateur sur le rapport ${reportId}`
    );
  };

  const handleDeleteAdminComment = (reportId: string) => {
    if (confirm("Supprimer ce commentaire ?")) {
      const updatedReports = reports.map(r => {
        if (r.id === reportId) {
          const { adminComments, ...rest } = r;
          return rest as FieldControlReport;
        }
        return r;
      });
      setReports(updatedReports);
      localStorage.setItem('microfox_field_control_reports', JSON.stringify(updatedReports));
      
      recordAuditLog(
        'SUPPRESSION',
        'CONTRÔLE TERRAIN',
        `Suppression du commentaire administrateur sur le rapport ${reportId}`
      );
    }
  };

  const handleDeleteReport = (reportId: string) => {
    if (confirm("Êtes-vous sûr de vouloir supprimer ce rapport de contrôle ? Cette action est irréversible.")) {
      const updatedReports = reports.filter(r => r.id !== reportId);
      setReports(updatedReports);
      localStorage.setItem('microfox_field_control_reports', JSON.stringify(updatedReports));
      
      recordAuditLog(
        'SUPPRESSION',
        'CONTRÔLE TERRAIN',
        `Suppression du rapport de contrôle terrain ${reportId}`
      );
    }
  };

  const generateHTMLReport = (isForPrint: boolean) => {
    const headerHtml = `
      <div style="text-align: center; margin-bottom: 30px; border-bottom: 2px solid #121c32; padding-bottom: 20px;">
        <h1 style="margin: 0; color: #121c32; text-transform: uppercase; font-size: 24px;">MicroFox - Rapport de Contrôle Terrain</h1>
        <p style="margin: 5px 0; color: #666; font-weight: bold;">Historique des Contrôles</p>
        <p style="margin: 5px 0; font-size: 12px; color: #888;">Période: ${startDate || 'Début'} au ${endDate || 'Fin'} | Zone: ${historyZone || 'Toutes'}</p>
        <p style="margin: 5px 0; font-size: 10px; color: #aaa;">Généré le: ${new Date().toLocaleString()}</p>
      </div>
    `;

    const tableHtml = `
      <table style="width: 100%; border-collapse: collapse; font-size: 11px;">
        <thead>
          <tr style="background-color: #f8f9fa; border-bottom: 1px solid #dee2e6;">
            <th style="padding: 12px; text-align: left; text-transform: uppercase;">Date / Contrôleur</th>
            <th style="padding: 12px; text-align: left; text-transform: uppercase;">Client / Zone</th>
            <th style="padding: 12px; text-align: right; text-transform: uppercase;">Solde Système</th>
            <th style="padding: 12px; text-align: right; text-transform: uppercase;">Solde Livret</th>
            <th style="padding: 12px; text-align: right; text-transform: uppercase;">Écart</th>
            <th style="padding: 12px; text-align: left; text-transform: uppercase;">Observations</th>
          </tr>
        </thead>
        <tbody>
          ${filteredReports.map(report => `
            <tr style="border-bottom: 1px solid #eee;">
              <td style="padding: 10px;">
                <strong>${new Date(report.date).toLocaleDateString()}</strong><br/>
                <span style="color: #666; text-transform: uppercase; font-size: 9px;">${report.controllerName}</span>
              </td>
              <td style="padding: 10px;">
                <strong style="text-transform: uppercase;">${report.clientName}</strong><br/>
                <span style="color: #888; font-size: 9px;">CODE: ${report.clientCode} | TONTINE: ${report.tontineAccountNumber}</span><br/>
                ${report.zone ? `<span style="color: #f59e0b; font-size: 9px; text-transform: uppercase;">Zone: ${report.zone}</span>` : ''}
              </td>
              <td style="padding: 10px; text-align: right;">${report.systemBalance.toLocaleString()} F</td>
              <td style="padding: 10px; text-align: right;">${report.bookletBalance.toLocaleString()} F</td>
              <td style="padding: 10px; text-align: right; font-weight: bold; color: ${report.difference === 0 ? '#10b981' : '#ef4444'};">
                ${report.difference > 0 ? '+' : ''}${report.difference.toLocaleString()} F
              </td>
              <td style="padding: 10px;">
                <div style="font-size: 9px;">
                  <strong>OBS:</strong> ${report.observations}<br/>
                  ${report.recommendations ? `<strong>REC:</strong> ${report.recommendations}` : ''}
                </div>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;

    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <title>Historique Contrôle Terrain</title>
          <style>
            body { font-family: sans-serif; padding: 20px; color: #333; }
            @media print {
              .no-print { display: none; }
              body { padding: 0; }
            }
          </style>
        </head>
        <body>
          ${headerHtml}
          ${tableHtml}
          ${isForPrint ? `
            <script>
              window.onload = () => {
                window.print();
                setTimeout(() => window.close(), 500);
              };
            </script>
          ` : ''}
        </body>
      </html>
    `;
  };

  const handleExport = () => {
    const htmlContent = generateHTMLReport(false);
    const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `Historique_Controle_Terrain_${new Date().toISOString().split('T')[0]}.html`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePrint = () => {
    const htmlContent = generateHTMLReport(true);
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(htmlContent);
      printWindow.document.close();
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
          <div className="flex items-center gap-2">
            <History size={20} className="text-indigo-600" />
            Historique des Contrôles
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex flex-col gap-1">
              <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest ml-1">Zone</label>
              <select
                value={historyZone}
                onChange={(e) => setHistoryZone(e.target.value)}
                className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-[10px] font-bold text-[#121c32] outline-none focus:border-indigo-400"
              >
                <option value="">Toutes les zones</option>
                {zones.map(z => <option key={z} value={z}>{z}</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest ml-1">Début</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-[10px] font-bold text-[#121c32] outline-none focus:border-indigo-400"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest ml-1">Fin</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-[10px] font-bold text-[#121c32] outline-none focus:border-indigo-400"
              />
            </div>
            <div className="flex items-end gap-2 pb-0.5">
              <button 
                onClick={handlePrint}
                className="p-2 bg-white border border-gray-200 rounded-xl text-gray-600 hover:text-indigo-600 transition-all shadow-sm"
                title="Imprimer l'historique"
              >
                <Printer size={16} />
              </button>
              <button 
                onClick={handleExport}
                className="p-2 bg-white border border-gray-200 rounded-xl text-gray-600 hover:text-emerald-600 transition-all shadow-sm"
                title="Exporter l'historique"
              >
                <Download size={16} />
              </button>
            </div>
          </div>
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-gray-50 bg-gray-50/50">
                <th className="px-6 py-4 text-[10px] font-black text-gray-500 uppercase tracking-widest">Date / Contrôleur</th>
                <th className="px-6 py-4 text-[10px] font-black text-gray-500 uppercase tracking-widest">Client / Zone</th>
                <th className="px-6 py-4 text-[10px] font-black text-gray-500 uppercase tracking-widest text-right">Solde Système</th>
                <th className="px-6 py-4 text-[10px] font-black text-gray-500 uppercase tracking-widest text-right">Solde Livret</th>
                <th className="px-6 py-4 text-[10px] font-black text-gray-500 uppercase tracking-widest text-right">Écart</th>
                <th className="px-6 py-4 text-[10px] font-black text-gray-500 uppercase tracking-widest">Observations / Recommandations</th>
                <th className="px-6 py-4 text-[10px] font-black text-gray-500 uppercase tracking-widest">Commentaires Admin</th>
                <th className="px-6 py-4 text-[10px] font-black text-gray-500 uppercase tracking-widest text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filteredReports.length > 0 ? (
                filteredReports.map((report) => (
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
                        <div className="flex items-center gap-2">
                          <span className="text-[9px] font-bold text-gray-400 uppercase">CLT: {report.clientCode}</span>
                          <span className="text-[9px] font-bold text-indigo-500 uppercase tracking-tighter">TONTINE: {report.tontineAccountNumber}</span>
                        </div>
                        {report.zone && <span className="text-[9px] font-bold text-amber-500 uppercase mt-1">Zone: {report.zone}</span>}
                      </div>
                    </td>
                      <td className="px-6 py-4 text-right text-xs font-bold text-gray-600">{report.systemBalance.toLocaleString()} FCFA</td>
                      <td className="px-6 py-4 text-right text-xs font-bold text-gray-600">{report.bookletBalance.toLocaleString()} FCFA</td>
                      <td className={`px-6 py-4 text-right text-xs font-black ${getDifferenceColor(report.difference)}`}>
                        {report.difference > 0 ? '+' : ''}{report.difference.toLocaleString()} FCFA
                      </td>
                      <td className="px-6 py-4">
                        <div className="space-y-1">
                          <p className="text-[10px] font-black text-gray-400 uppercase tracking-tighter">Observations:</p>
                          <p className="text-[11px] font-bold text-[#121c32] uppercase leading-relaxed max-w-[200px]">{report.observations}</p>
                          {report.recommendations && (
                            <>
                              <p className="text-[10px] font-black text-indigo-400 uppercase tracking-tighter mt-2">Recommandations:</p>
                              <p className="text-[10px] font-medium text-gray-700 max-w-[200px] line-clamp-2">{report.recommendations}</p>
                            </>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="space-y-2">
                          {report.adminComments ? (
                            <div className="group relative bg-amber-50 p-3 rounded-xl border border-amber-100">
                              <p className="text-[10px] font-medium text-amber-900 leading-relaxed">{report.adminComments}</p>
                              {(currentUser?.role === 'administrateur' || currentUser?.role === 'directeur') && (
                                <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                  <button 
                                    onClick={() => handleDeleteAdminComment(report.id)}
                                    className="p-1 text-red-400 hover:text-red-600 transition-colors"
                                  >
                                    <Trash2 size={12} />
                                  </button>
                                </div>
                              )}
                            </div>
                          ) : (
                            (currentUser?.role === 'administrateur' || currentUser?.role === 'directeur') && (
                              editingCommentId === report.id ? (
                                <div className="flex flex-col gap-2">
                                  <textarea
                                    value={adminComment}
                                    onChange={(e) => setAdminComment(e.target.value)}
                                    placeholder="Saisir un commentaire..."
                                    className="w-full p-2 bg-white border border-amber-200 rounded-lg text-[10px] outline-none focus:border-amber-400"
                                    rows={2}
                                  />
                                  <div className="flex justify-end gap-2">
                                    <button 
                                      onClick={() => setEditingCommentId(null)}
                                      className="text-[9px] font-black text-gray-400 uppercase"
                                    >
                                      Annuler
                                    </button>
                                    <button 
                                      onClick={() => handleSaveAdminComment(report.id)}
                                      className="flex items-center gap-1 px-2 py-1 bg-amber-500 text-white rounded-md text-[9px] font-black uppercase"
                                    >
                                      <Send size={10} /> Enregistrer
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <button 
                                  onClick={() => {
                                    setEditingCommentId(report.id);
                                    setAdminComment('');
                                  }}
                                  className="flex items-center gap-1 text-[10px] font-black text-amber-600 uppercase hover:text-amber-700 transition-colors"
                                >
                                  <MessageSquare size={12} /> Ajouter un commentaire
                                </button>
                              )
                            )
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center">
                        {(currentUser?.role === 'administrateur' || currentUser?.role === 'directeur') && (
                          <button 
                            onClick={() => handleDeleteReport(report.id)}
                            className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all active:scale-90"
                            title="Supprimer le rapport"
                          >
                            <Trash2 size={16} />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={8} className="px-6 py-20 text-center">
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
              <div className="space-y-3 mb-4">
                <div className="relative">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                  <input 
                    type="text" 
                    placeholder="Nom ou Code Client..." 
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-12 pr-4 py-3 bg-gray-50 border border-black focus:border-indigo-400 rounded-2xl outline-none text-sm font-medium text-[#121c32] transition-all"
                  />
                </div>
                <select
                  value={selectedZone}
                  onChange={(e) => setSelectedZone(e.target.value)}
                  className="w-full px-4 py-3 bg-gray-50 border border-black focus:border-indigo-400 rounded-2xl outline-none text-sm font-bold text-[#121c32] transition-all"
                >
                  <option value="">Toutes les zones</option>
                  {zones.map(z => <option key={z} value={z}>{z}</option>)}
                </select>
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
                    <div className="flex flex-wrap gap-2 mt-1">
                      <span className="text-[9px] font-black bg-indigo-50 text-indigo-600 px-1.5 py-0.5 rounded uppercase tracking-tighter">CLT: {client.code}</span>
                      {client.tontineAccounts.map(acc => (
                        <span key={acc.id} className="text-[9px] font-black bg-emerald-50 text-emerald-600 px-1.5 py-0.5 rounded uppercase tracking-tighter">TONTINE: {acc.number}</span>
                      ))}
                    </div>
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
                    <div className="flex items-center gap-3 mt-1">
                      <p className="text-xs font-bold text-indigo-500 uppercase tracking-[0.2em]">CLT: {selectedClient.code}</p>
                      {selectedClient.epargneAccountNumber && (
                        <p className="text-xs font-bold text-blue-500 uppercase tracking-[0.2em]">EP: {selectedClient.epargneAccountNumber}</p>
                      )}
                    </div>
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
