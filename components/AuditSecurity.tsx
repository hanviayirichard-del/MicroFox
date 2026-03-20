import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, 
  Search, 
  History, 
  Filter, 
  Download, 
  Printer, 
  User, 
  Activity, 
  AlertCircle,
  CheckCircle,
  Clock,
  Database,
  Lock,
  Eye,
  Edit3,
  Trash2,
  PlusCircle,
  LogIn,
  LogOut
} from 'lucide-react';
import { AuditLog } from '../types';

const AuditSecurity: React.FC = () => {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterAction, setFilterAction] = useState<string>('all');
  const [filterModule, setFilterModule] = useState<string>('all');

  const loadLogs = () => {
    const savedLogs = localStorage.getItem('microfox_audit_logs');
    if (savedLogs) {
      setLogs(JSON.parse(savedLogs));
    }
  };

  useEffect(() => {
    loadLogs();
    window.addEventListener('storage', loadLogs);
    return () => window.removeEventListener('storage', loadLogs);
  }, []);

  const filteredLogs = logs.filter(log => {
    const matchesSearch = 
      log.userName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.details.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.module.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesAction = filterAction === 'all' || log.action === filterAction;
    const matchesModule = filterModule === 'all' || log.module === filterModule;

    return matchesSearch && matchesAction && matchesModule;
  });

  const getActionIcon = (action: AuditLog['action']) => {
    switch (action) {
      case 'CONNEXION': return <LogIn size={16} className="text-emerald-500" />;
      case 'DECONNEXION': return <LogOut size={16} className="text-red-500" />;
      case 'CONSULTATION': return <Eye size={16} className="text-blue-500" />;
      case 'MODIFICATION': return <Edit3 size={16} className="text-amber-500" />;
      case 'SUPPRESSION': return <Trash2 size={16} className="text-red-600" />;
      case 'CREATION': return <PlusCircle size={16} className="text-emerald-600" />;
      default: return <Activity size={16} />;
    }
  };

  const generateHTMLContent = (isForPrint = false) => {
    if (filteredLogs.length === 0) return null;
    const mfConfig = JSON.parse(localStorage.getItem('microfox_mf_config') || '{"nom": "MicroFoX", "adresse": "", "code": ""}');
    const headers = ["Date", "Utilisateur", "Rôle", "Action", "Module", "Détails", "Statut"];
    
    const htmlContent = `
      <!DOCTYPE html>
      <html lang="fr">
      <head>
        <meta charset="UTF-8">
        <title>Audit & Sécurité - ${mfConfig.nom}</title>
        <style>
          body { font-family: sans-serif; padding: 20px; color: #121c32; }
          .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #121c32; padding-bottom: 10px; }
          .mf-name { font-size: 24px; font-weight: 900; text-transform: uppercase; margin: 0; }
          .mf-address { font-size: 12px; font-weight: bold; color: #666; margin: 5px 0; }
          h2 { color: #4f46e5; margin-top: 20px; text-transform: uppercase; }
          table { width: 100%; border-collapse: collapse; margin-top: 20px; }
          th { background-color: #121c32; color: white; text-align: left; padding: 12px 8px; font-size: 11px; text-transform: uppercase; }
          td { border-bottom: 1px solid #eee; padding: 10px 8px; font-size: 12px; }
          tr:nth-child(even) { background-color: #f9fafb; }
          .status-success { color: #059669; font-weight: bold; }
          .status-failure { color: #dc2626; font-weight: bold; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1 class="mf-name">${mfConfig.nom}</h1>
          <p class="mf-address">${mfConfig.adresse}</p>
          <p class="mf-address">Tél: ${mfConfig.telephone || 'N/A'} | Code: ${mfConfig.code}</p>
        </div>
        <h2>Journal d'Audit & Sécurité</h2>
        <table>
          <thead>
            <tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr>
          </thead>
          <tbody>
            ${filteredLogs.map(log => `
              <tr>
                <td>${new Date(log.timestamp).toLocaleString()}</td>
                <td>${log.userName}</td>
                <td>${log.userRole}</td>
                <td>${log.action}</td>
                <td>${log.module}</td>
                <td>${log.details}</td>
                <td class="${log.status === 'SUCCES' ? 'status-success' : 'status-failure'}">${log.status}</td>
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

  const handleExport = () => {
    const htmlContent = generateHTMLContent();
    if (!htmlContent) return alert("Aucune donnée à exporter.");
    const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `audit_logs_${new Date().toISOString().split('T')[0]}.html`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
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

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-12 px-4 sm:px-6 lg:px-8">
      <div className="flex justify-between items-start">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-600 shadow-sm border border-indigo-100">
            <ShieldCheck size={24} />
          </div>
          <div>
            <h1 className="text-2xl font-black text-white uppercase tracking-tight">Audit & Accès Sécurité</h1>
            <p className="text-gray-400 text-xs font-bold uppercase tracking-widest mt-0.5">Journal technique de surveillance anti-fraude</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={handleExport}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-xl text-xs font-black text-gray-600 hover:text-emerald-600 transition-all shadow-sm active:scale-95 uppercase tracking-widest"
          >
            <Download size={16} /> Exporter HTML
          </button>
          <button 
            onClick={handlePrint}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-xl text-xs font-black text-gray-600 hover:text-blue-600 transition-all shadow-sm active:scale-95 uppercase tracking-widest"
          >
            <Printer size={16} /> Imprimer
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-6 rounded-[2rem] border border-gray-100 shadow-sm flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600"><LogIn size={20} /></div>
          <div>
            <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Connexions</p>
            <p className="text-xl font-black text-[#121c32]">{logs.filter(l => l.action === 'CONNEXION').length}</p>
          </div>
        </div>
        <div className="bg-white p-6 rounded-[2rem] border border-gray-100 shadow-sm flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center text-amber-600"><Edit3 size={20} /></div>
          <div>
            <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Modifications</p>
            <p className="text-xl font-black text-[#121c32]">{logs.filter(l => l.action === 'MODIFICATION').length}</p>
          </div>
        </div>
        <div className="bg-white p-6 rounded-[2rem] border border-gray-100 shadow-sm flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600"><Eye size={20} /></div>
          <div>
            <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Consultations</p>
            <p className="text-xl font-black text-[#121c32]">{logs.filter(l => l.action === 'CONSULTATION').length}</p>
          </div>
        </div>
        <div className="bg-white p-6 rounded-[2rem] border border-gray-100 shadow-sm flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center text-red-600"><Trash2 size={20} /></div>
          <div>
            <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Suppressions</p>
            <p className="text-xl font-black text-[#121c32]">{logs.filter(l => l.action === 'SUPPRESSION').length}</p>
          </div>
        </div>
      </div>

      <div className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-gray-100 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input 
              type="text" 
              placeholder="Rechercher par utilisateur ou détail..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-12 pr-4 py-3 bg-gray-50 border border-transparent focus:border-indigo-200 rounded-2xl outline-none text-sm font-medium transition-all"
            />
          </div>
          <div className="relative">
            <Filter className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <select 
              value={filterAction}
              onChange={(e) => setFilterAction(e.target.value)}
              className="w-full pl-12 pr-4 py-3 bg-gray-50 border border-transparent focus:border-indigo-200 rounded-2xl outline-none text-sm font-bold text-[#121c32] appearance-none"
            >
              <option value="all">Toutes les actions</option>
              <option value="CONNEXION">Connexions</option>
              <option value="DECONNEXION">Déconnexions</option>
              <option value="CONSULTATION">Consultations</option>
              <option value="MODIFICATION">Modifications</option>
              <option value="SUPPRESSION">Suppressions</option>
              <option value="CREATION">Créations</option>
            </select>
          </div>
          <div className="relative">
            <Database className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <select 
              value={filterModule}
              onChange={(e) => setFilterModule(e.target.value)}
              className="w-full pl-12 pr-4 py-3 bg-gray-50 border border-transparent focus:border-indigo-200 rounded-2xl outline-none text-sm font-bold text-[#121c32] appearance-none"
            >
              <option value="all">Tous les modules</option>
              <option value="AUTHENTIFICATION">Authentification</option>
              <option value="MEMBRES">Membres</option>
              <option value="TONTINE">Tontine</option>
              <option value="CREDIT">Crédit</option>
              <option value="EPARGNE">Épargne</option>
              <option value="CORRECTIONS">Corrections</option>
              <option value="UTILISATEURS">Utilisateurs</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-gray-50 bg-gray-50/50">
                <th className="px-6 py-4 text-[10px] font-black text-gray-500 uppercase tracking-widest">Horodatage</th>
                <th className="px-6 py-4 text-[10px] font-black text-gray-500 uppercase tracking-widest">Utilisateur</th>
                <th className="px-6 py-4 text-[10px] font-black text-gray-500 uppercase tracking-widest">Action / Module</th>
                <th className="px-6 py-4 text-[10px] font-black text-gray-500 uppercase tracking-widest">Détails de l'opération</th>
                <th className="px-6 py-4 text-[10px] font-black text-gray-500 uppercase tracking-widest text-center">Statut</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filteredLogs.length > 0 ? (
                filteredLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-gray-50 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="text-xs font-black text-[#121c32]">{new Date(log.timestamp).toLocaleDateString()}</span>
                        <span className="text-[10px] font-bold text-gray-400">{new Date(log.timestamp).toLocaleTimeString()}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center text-gray-500">
                          <User size={14} />
                        </div>
                        <div className="flex flex-col">
                          <span className="text-xs font-black text-[#121c32] uppercase">{log.userName}</span>
                          <span className="text-[9px] font-bold text-gray-400 uppercase tracking-tighter">{log.userRole}</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        {getActionIcon(log.action)}
                        <div className="flex flex-col">
                          <span className="text-[10px] font-black text-[#121c32] uppercase">{log.action}</span>
                          <span className="text-[9px] font-bold text-indigo-500 uppercase tracking-widest">{log.module}</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-[10px] font-medium text-gray-700 max-w-[300px] leading-relaxed">
                        {log.details}
                      </p>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-[9px] font-black uppercase tracking-tighter ${log.status === 'SUCCES' ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}`}>
                        {log.status === 'SUCCES' ? <CheckCircle size={10} /> : <AlertCircle size={10} />}
                        {log.status}
                      </span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="px-6 py-20 text-center">
                    <div className="flex flex-col items-center gap-3 opacity-20">
                      <History size={48} />
                      <p className="text-sm font-black uppercase tracking-widest text-gray-600">Aucun log technique trouvé</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default AuditSecurity;
