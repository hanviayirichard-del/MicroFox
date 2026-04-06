
import React, { useState, useEffect } from 'react';
import { 
  Activity, 
  Users, 
  Clock, 
  Search, 
  Filter, 
  User, 
  MapPin, 
  Eye, 
  Edit3, 
  Trash2, 
  PlusCircle, 
  LogIn, 
  LogOut,
  ShieldCheck,
  TrendingUp
} from 'lucide-react';
import { AuditLog, User as UserType } from '../types';

const UserActivity: React.FC = () => {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [users, setUsers] = useState<UserType[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterAction, setFilterAction] = useState<string>('all');
  const [view, setView] = useState<'live' | 'history'>('live');

  const loadData = () => {
    const savedLogs = localStorage.getItem('microfox_audit_logs');
    if (savedLogs) {
      setLogs(JSON.parse(savedLogs));
    }
    const savedUsers = localStorage.getItem('microfox_users');
    if (savedUsers) {
      setUsers(JSON.parse(savedUsers));
    }
  };

  useEffect(() => {
    loadData();
    window.addEventListener('storage', loadData);
    const interval = setInterval(loadData, 5000);
    return () => {
      window.removeEventListener('storage', loadData);
      clearInterval(interval);
    };
  }, []);

  const getActionIcon = (action: AuditLog['action']) => {
    switch (action) {
      case 'CONNEXION': return <LogIn size={14} className="text-emerald-500" />;
      case 'DECONNEXION': return <LogOut size={14} className="text-red-500" />;
      case 'CONSULTATION': return <Eye size={14} className="text-blue-500" />;
      case 'MODIFICATION': return <Edit3 size={14} className="text-amber-500" />;
      case 'SUPPRESSION': return <Trash2 size={14} className="text-red-600" />;
      case 'CREATION': return <PlusCircle size={14} className="text-emerald-600" />;
      default: return <Activity size={14} />;
    }
  };

  const filteredLogs = logs.filter(log => {
    const matchesSearch = 
      log.userName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.details.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesAction = filterAction === 'all' || log.action === filterAction;
    return matchesSearch && matchesAction;
  });

  const onlineUsers = users.filter(u => {
    if (!u.lastUpdate) return false;
    const lastUpdate = new Date(u.lastUpdate).getTime();
    const now = new Date().getTime();
    return (now - lastUpdate) < 600000; // Online if updated in last 10 minutes
  });

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-12 px-4 sm:px-6 lg:px-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 flex items-center justify-center text-emerald-600 shadow-sm border border-emerald-100">
            <Activity size={24} />
          </div>
          <div>
            <h1 className="text-2xl font-black text-white uppercase tracking-tight">Suivi des Activités</h1>
            <p className="text-gray-400 text-xs font-bold uppercase tracking-widest mt-0.5">Surveillance en temps réel des utilisateurs</p>
          </div>
        </div>
        <div className="flex bg-[#1e2a44] p-1 rounded-2xl border border-gray-800">
          <button 
            onClick={() => setView('live')}
            className={`px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${view === 'live' ? 'bg-[#00c896] text-white shadow-lg' : 'text-gray-400 hover:text-white'}`}
          >
            En Direct
          </button>
          <button 
            onClick={() => setView('history')}
            className={`px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${view === 'history' ? 'bg-[#00c896] text-white shadow-lg' : 'text-gray-400 hover:text-white'}`}
          >
            Historique
          </button>
        </div>
      </div>

      {view === 'live' ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1 space-y-6">
            <div className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-gray-100">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-sm font-black text-[#121c32] uppercase tracking-widest">Utilisateurs en Ligne</h2>
                <span className="px-3 py-1 bg-emerald-50 text-emerald-600 rounded-full text-[10px] font-black uppercase tracking-widest">
                  {onlineUsers.length} Actifs
                </span>
              </div>
              <div className="space-y-4">
                {onlineUsers.length > 0 ? onlineUsers.map(u => (
                  <div key={u.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl border border-transparent hover:border-emerald-100 transition-all">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-white shadow-sm flex items-center justify-center text-gray-400 border border-gray-100">
                        <User size={18} />
                      </div>
                      <div>
                        <p className="text-xs font-black text-[#121c32] uppercase">{u.identifiant}</p>
                        <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">{u.role}</p>
                      </div>
                    </div>
                    <div className="flex flex-col items-end">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse mb-1"></span>
                      <span className="text-[9px] font-bold text-emerald-600 uppercase">Connecté</span>
                    </div>
                  </div>
                )) : (
                  <div className="text-center py-8 opacity-30">
                    <Users size={32} className="mx-auto mb-2" />
                    <p className="text-[10px] font-black uppercase tracking-widest">Aucun utilisateur actif</p>
                  </div>
                )}
              </div>
            </div>

            <div className="bg-[#121c32] p-6 rounded-[2.5rem] shadow-xl border border-gray-800 text-white">
              <h2 className="text-sm font-black text-emerald-400 uppercase tracking-widest mb-6">Statistiques du Jour</h2>
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-500"><TrendingUp size={16} /></div>
                    <span className="text-[10px] font-black uppercase tracking-widest">Total Actions</span>
                  </div>
                  <span className="text-lg font-black">{logs.filter(l => new Date(l.timestamp).toDateString() === new Date().toDateString()).length}</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-500"><ShieldCheck size={16} /></div>
                    <span className="text-[10px] font-black uppercase tracking-widest">Modules Touchés</span>
                  </div>
                  <span className="text-lg font-black">{new Set(logs.map(l => l.module)).size}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-gray-100">
              <h2 className="text-sm font-black text-[#121c32] uppercase tracking-widest mb-6">Dernières Actions</h2>
              <div className="space-y-4">
                {logs.slice(0, 15).map((log) => (
                  <div key={log.id} className="flex items-start gap-4 p-4 bg-gray-50 rounded-2xl border border-transparent hover:bg-white hover:shadow-md hover:border-gray-100 transition-all group">
                    <div className="mt-1">
                      {getActionIcon(log.action)}
                    </div>
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-black text-[#121c32] uppercase">
                          {log.userName} <span className="text-[9px] text-gray-400 font-bold ml-2">({log.userRole})</span>
                        </p>
                        <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">
                          {new Date(log.timestamp).toLocaleTimeString()}
                        </span>
                      </div>
                      <p className="text-[10px] font-medium text-gray-600 leading-relaxed">
                        {log.details}
                      </p>
                      <div className="flex items-center gap-2 pt-1">
                        <span className="px-2 py-0.5 bg-indigo-50 text-indigo-600 rounded-md text-[8px] font-black uppercase tracking-widest">
                          {log.module}
                        </span>
                        <span className={`px-2 py-0.5 rounded-md text-[8px] font-black uppercase tracking-widest ${log.status === 'SUCCES' ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}`}>
                          {log.status}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-gray-100 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              <input 
                type="text" 
                placeholder="Rechercher un utilisateur ou une action..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-12 pr-4 py-3 bg-gray-50 border border-transparent focus:border-emerald-200 rounded-2xl outline-none text-sm font-medium transition-all"
              />
            </div>
            <div className="relative">
              <Filter className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              <select 
                value={filterAction}
                onChange={(e) => setFilterAction(e.target.value)}
                className="w-full pl-12 pr-4 py-3 bg-gray-50 border border-transparent focus:border-emerald-200 rounded-2xl outline-none text-sm font-bold text-[#121c32] appearance-none"
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
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-gray-50 bg-gray-50/50">
                  <th className="px-6 py-4 text-[10px] font-black text-gray-500 uppercase tracking-widest">Horodatage</th>
                  <th className="px-6 py-4 text-[10px] font-black text-gray-500 uppercase tracking-widest">Utilisateur</th>
                  <th className="px-6 py-4 text-[10px] font-black text-gray-500 uppercase tracking-widest">Action</th>
                  <th className="px-6 py-4 text-[10px] font-black text-gray-500 uppercase tracking-widest">Détails</th>
                  <th className="px-6 py-4 text-[10px] font-black text-gray-500 uppercase tracking-widest text-center">Statut</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filteredLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="text-xs font-black text-[#121c32]">{new Date(log.timestamp).toLocaleDateString()}</span>
                        <span className="text-[10px] font-bold text-gray-400">{new Date(log.timestamp).toLocaleTimeString()}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="text-xs font-black text-[#121c32] uppercase">{log.userName}</span>
                        <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">{log.userRole}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        {getActionIcon(log.action)}
                        <span className="text-[10px] font-black text-[#121c32] uppercase">{log.action}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-[10px] font-medium text-gray-700 max-w-[300px] leading-relaxed">{log.details}</p>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-[9px] font-black uppercase tracking-tighter ${log.status === 'SUCCES' ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}`}>
                        {log.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserActivity;
