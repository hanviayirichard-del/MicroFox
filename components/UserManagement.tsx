import React, { useState, useEffect } from 'react';
import { UserPlus, Shield, Building2, Lock, User as UserIcon, Trash2, Search, Ban, CheckCircle, Fingerprint, ShieldCheck } from 'lucide-react';
import { User, UserRole } from '../types';
import { recordAuditLog } from '../utils/audit';

const UserManagement: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  const [formData, setFormData] = useState({
    identifiant: '',
    role: 'agent commercial' as UserRole,
    microfinance: '',
    codeMF: '',
    motDePasse: '',
    zoneCollecte: '',
    zonesCollecte: [] as string[],
    caisse: '',
    fingerprintCredential: undefined as { id: string; publicKey: string } | undefined
  });

  const [isRegisteringFingerprint, setIsRegisteringFingerprint] = useState(false);

  const handleRegisterFingerprint = async () => {
    if (!formData.identifiant.trim()) {
      alert("Veuillez saisir un identifiant avant d'enregistrer l'empreinte.");
      return;
    }
    setIsRegisteringFingerprint(true);
    try {
      const { registerFingerprint } = await import('../utils/webauthn');
      const credential = await registerFingerprint(formData.identifiant);
      setFormData(prev => ({ ...prev, fingerprintCredential: credential }));
      alert("Empreinte digitale enregistrée avec succès !");
    } catch (error: any) {
      console.error("Fingerprint error:", error);
      const errorString = error?.message || String(error);
      let msg = errorString;
      
      if (
        errorString.includes("feature is not enabled") || 
        errorString.includes("Permissions Policy") ||
        errorString.includes("NotAllowedError") ||
        errorString.includes("SecurityError")
      ) {
        msg = "L'accès biométrique est bloqué dans cet aperçu (iframe). Pour enregistrer votre empreinte, veuillez ouvrir l'application dans un nouvel onglet en cliquant sur l'icône 'Ouvrir dans un nouvel onglet' en haut à droite.";
      } else {
        msg = "Erreur lors de l'enregistrement de l'empreinte. Assurez-vous que votre appareil supporte la biométrie.";
      }
      alert(msg);
    } finally {
      setIsRegisteringFingerprint(false);
    }
  };

  const zones = ['01', '01A', '02', '02A', '03', '03A', '04', '04A', '05', '05A', '06', '06A', '07', '07A', '08', '08A', '09', '09A'];
  const caisses = ['CAISSE 1', 'CAISSE 2', 'CAISSE 3', 'CAISSE 4'];

  const roles: UserRole[] = [
    'administrateur',
    'directeur',
    'gestionnaire de crédit',
    'caissier',
    'contrôleur',
    'auditeur',
    'agent commercial'
  ];

  const loadUsers = () => {
    const savedUsers = localStorage.getItem('microfox_users');
    if (savedUsers) {
      try {
        const parsed = JSON.parse(savedUsers);
        if (Array.isArray(parsed)) {
          setUsers(parsed);
        }
      } catch (e) {
        console.error("Error parsing users in management:", e);
      }
    }
  };

  useEffect(() => {
    loadUsers();
    window.addEventListener('storage', loadUsers);
    return () => window.removeEventListener('storage', loadUsers);
  }, []);

  const handleCreateUser = (e: React.FormEvent) => {
    e.preventDefault();
    const newUser: User = {
      id: `user_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      identifiant: formData.identifiant.trim(),
      role: formData.role,
      microfinance: formData.microfinance.trim(),
      codeMF: formData.codeMF.trim().toUpperCase(),
      motDePasse: formData.motDePasse,
      zoneCollecte: formData.zonesCollecte.length > 0 ? formData.zonesCollecte[0] : '',
      zonesCollecte: formData.zonesCollecte,
      caisse: formData.caisse,
      isBlocked: false,
      fingerprintCredential: formData.fingerprintCredential
    };
    
    const updatedUsers = [...users, newUser];
    setUsers(updatedUsers);
    localStorage.setItem('microfox_users', JSON.stringify(updatedUsers));
    recordAuditLog('CREATION', 'UTILISATEURS', `Création de l'utilisateur ${newUser.identifiant} (${newUser.role})`);
    setIsModalOpen(false);
    setFormData({
      identifiant: '',
      role: 'agent commercial',
      microfinance: '',
      codeMF: '',
      motDePasse: '',
      zoneCollecte: '',
      zonesCollecte: [],
      caisse: '',
      fingerprintCredential: undefined
    });
  };

  const handleDeleteUser = (id: string) => {
    const userToDelete = users.find(u => u.id === id);
    if (!userToDelete) return;
    
    if (userToDelete.identifiant === 'RICHARD') {
      return;
    }

    const updatedUsers = users.map(u => u.id === id ? { ...u, isDeleted: true } : u);
    setUsers(updatedUsers);
    localStorage.setItem('microfox_users', JSON.stringify(updatedUsers));
    recordAuditLog('SUPPRESSION', 'UTILISATEURS', `Suppression de l'utilisateur ${userToDelete.identifiant}`);
  };

  const handleToggleBlock = (id: string) => {
    const user = users.find(u => u.id === id);
    if (!user) return;
    
    const action = user.isBlocked ? 'DÉBLOCAGE' : 'BLOCAGE';
    const updatedUsers = users.map(u => 
      u.id === id ? { ...u, isBlocked: !u.isBlocked } : u
    );
    setUsers(updatedUsers);
    localStorage.setItem('microfox_users', JSON.stringify(updatedUsers));
    recordAuditLog('MODIFICATION', 'UTILISATEURS', `${action} de l'utilisateur ${user.identifiant}`);
  };

  const handleDeleteFingerprint = (userId: string) => {
    const user = users.find(u => u.id === userId);
    if (!user) return;
    if (confirm(`Voulez-vous vraiment supprimer l'empreinte digitale de ${user.identifiant} ?`)) {
      const updatedUsers = users.map(u => 
        u.id === userId ? { ...u, fingerprintCredential: undefined } : u
      );
      setUsers(updatedUsers);
      localStorage.setItem('microfox_users', JSON.stringify(updatedUsers));
      recordAuditLog('MODIFICATION', 'UTILISATEURS', `Suppression de l'empreinte digitale de l'utilisateur ${user.identifiant}`);
      alert("Empreinte digitale supprimée.");
    }
  };

  const filteredUsers = users.filter(u => 
    !u.isDeleted && (
      u.identifiant.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.microfinance.toLowerCase().includes(searchTerm.toLowerCase())
    )
  );

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-12">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-600 shadow-sm border border-indigo-100">
            <Shield size={24} />
          </div>
          <div>
            <h1 className="text-2xl font-black text-[#121c32] uppercase tracking-tight">Gestion des Utilisateurs</h1>
            <p className="text-gray-700 text-xs font-bold uppercase tracking-widest mt-0.5">Administration des accès et rôles.</p>
          </div>
        </div>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-2 px-6 py-3 bg-[#121c32] text-white rounded-2xl font-black uppercase tracking-widest shadow-xl shadow-[#121c32]/20 transition-all active:scale-95"
        >
          <UserPlus size={20} />
          Nouveau
        </button>
      </div>

      <div className="relative">
        <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-600" size={20} />
        <input 
          type="text" 
          placeholder="Rechercher un utilisateur..." 
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-14 pr-6 py-5 bg-white border border-gray-100 rounded-[2rem] font-bold text-[#121c32] outline-none shadow-sm focus:border-indigo-200 transition-all placeholder:text-gray-300"
        />
      </div>

      <div className="bg-white rounded-[2rem] shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50/50 border-b border-gray-100">
                <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Utilisateur</th>
                <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Rôle</th>
                <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Microfinance</th>
                <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Affectation</th>
                <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filteredUsers.map(user => (
                <tr key={user.id} className={`hover:bg-gray-50 transition-colors ${user.isBlocked ? 'opacity-60' : ''}`}>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${user.isBlocked ? 'bg-red-50 text-red-600' : 'bg-indigo-50 text-indigo-600'}`}>
                        <UserIcon size={20} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-black text-[#121c32] uppercase">{user.identifiant}</p>
                          {user.isBlocked && (
                            <span className="text-[8px] font-black text-red-500 uppercase tracking-tighter bg-red-50 px-1.5 py-0.5 rounded">Bloqué</span>
                          )}
                        </div>
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-tight">{user.role}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="inline-block px-3 py-1 bg-indigo-50 text-indigo-600 rounded-full text-[10px] font-black uppercase tracking-widest">
                      {user.role}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-col">
                      <span className="text-xs font-black text-[#121c32] uppercase">{user.microfinance}</span>
                      <span className="text-[10px] font-bold text-gray-400 uppercase tracking-tight">{user.codeMF}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    {user.role === 'agent commercial' && (user.zonesCollecte?.length || user.zoneCollecte) ? (
                      <div className="flex flex-wrap gap-1">
                        {user.zonesCollecte && user.zonesCollecte.length > 0 ? (
                          user.zonesCollecte.map(z => (
                            <span key={z} className="inline-block px-2 py-0.5 bg-emerald-50 text-emerald-600 rounded-lg text-[9px] font-black uppercase">
                              Zone {z}
                            </span>
                          ))
                        ) : (
                          <span className="inline-block px-3 py-1 bg-emerald-50 text-emerald-600 rounded-lg text-[10px] font-black uppercase">
                            Zone {user.zoneCollecte}
                          </span>
                        )}
                      </div>
                    ) : user.role === 'caissier' && user.caisse ? (
                      <span className="inline-block px-3 py-1 bg-blue-50 text-blue-600 rounded-lg text-[10px] font-black uppercase">
                        {user.caisse}
                      </span>
                    ) : (
                      <span className="text-[10px] font-bold text-gray-300 uppercase italic">N/A</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button 
                        onClick={() => handleToggleBlock(user.id)}
                        className={`p-2 rounded-lg transition-all active:scale-90 ${user.isBlocked ? 'text-emerald-500 bg-emerald-50' : 'text-amber-500 bg-amber-50'}`}
                        title={user.isBlocked ? "Débloquer" : "Bloquer"}
                      >
                        {user.isBlocked ? <CheckCircle size={16} /> : <Ban size={16} />}
                      </button>
                      {user.fingerprintCredential && (
                        <button 
                          onClick={() => handleDeleteFingerprint(user.id)}
                          className="p-2 text-indigo-500 bg-indigo-50 rounded-lg transition-all active:scale-90"
                          title="Supprimer l'empreinte digitale"
                        >
                          <Fingerprint size={16} />
                        </button>
                      )}
                      <button 
                        onClick={() => handleDeleteUser(user.id)}
                        className="p-2 text-red-500 bg-red-50 rounded-lg transition-all active:scale-90"
                        title="Supprimer"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredUsers.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-gray-400 font-bold uppercase text-xs">
                    Aucun utilisateur trouvé
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-[100] bg-[#121c32]/80 backdrop-blur-sm flex items-start justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-[2.5rem] w-full max-w-md p-8 shadow-2xl animate-in zoom-in-95 duration-200 my-4 sm:my-8">
            <div className="flex items-center gap-3 mb-8">
              <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600">
                <UserPlus size={20} />
              </div>
              <h3 className="text-lg font-black uppercase tracking-tight text-[#121c32]">Créer un utilisateur</h3>
            </div>

            <form onSubmit={handleCreateUser} className="space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-600 uppercase tracking-widest ml-1">Identifiant</label>
                <input 
                  type="text" 
                  required
                  value={formData.identifiant}
                  onChange={e => setFormData({...formData, identifiant: e.target.value})}
                  className="w-full p-4 bg-gray-50 border border-transparent focus:border-indigo-200 rounded-2xl outline-none text-sm font-bold text-[#121c32] transition-all"
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-600 uppercase tracking-widest ml-1">Rôle</label>
                <select 
                  className="w-full p-4 bg-gray-50 border border-transparent focus:border-indigo-200 rounded-2xl outline-none text-sm font-bold text-[#121c32] transition-all appearance-none"
                  value={formData.role}
                  onChange={e => setFormData({...formData, role: e.target.value as UserRole})}
                >
                  {roles.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>

              {formData.role === 'agent commercial' && (
                <div className="space-y-2 animate-in fade-in slide-in-from-top-2 duration-200">
                  <label className="text-[10px] font-black text-gray-600 uppercase tracking-widest ml-1">Zones de Collecte</label>
                  <div className="grid grid-cols-3 gap-2 p-4 bg-gray-50 rounded-2xl border border-transparent focus-within:border-indigo-200 transition-all">
                    {zones.map(z => (
                      <label key={z} className="flex items-center gap-2 cursor-pointer group">
                        <input 
                          type="checkbox"
                          checked={formData.zonesCollecte.includes(z)}
                          onChange={(e) => {
                            const newZones = e.target.checked 
                              ? [...formData.zonesCollecte, z]
                              : formData.zonesCollecte.filter(item => item !== z);
                            setFormData({...formData, zonesCollecte: newZones});
                          }}
                          className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                        />
                        <span className="text-[10px] font-bold text-[#121c32] uppercase group-hover:text-indigo-600 transition-colors">Zone {z}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {formData.role === 'caissier' && (
                <div className="space-y-2 animate-in fade-in slide-in-from-top-2 duration-200">
                  <label className="text-[10px] font-black text-gray-600 uppercase tracking-widest ml-1">Caisse attribuée</label>
                  <select 
                    required
                    className="w-full p-4 bg-gray-50 border border-transparent focus:border-indigo-200 rounded-2xl outline-none text-sm font-bold text-[#121c32] transition-all appearance-none"
                    value={formData.caisse}
                    onChange={e => setFormData({...formData, caisse: e.target.value})}
                  >
                    <option value="">Sélectionner une caisse</option>
                    {caisses.map(c => <option key={c} value={c}>{c.toUpperCase()}</option>)}
                  </select>
                </div>
              )}

              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-600 uppercase tracking-widest ml-1">Microfinance (Nom)</label>
                <input 
                  type="text" 
                  required
                  value={formData.microfinance}
                  onChange={e => setFormData({...formData, microfinance: e.target.value})}
                  className="w-full p-4 bg-gray-50 border border-transparent focus:border-indigo-200 rounded-2xl outline-none text-sm font-bold text-[#121c32] transition-all"
                  placeholder="Ex: COOPEC FABES"
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-600 uppercase tracking-widest ml-1">Code Microfinance</label>
                <input 
                  type="text" 
                  required
                  value={formData.codeMF}
                  onChange={e => setFormData({...formData, codeMF: e.target.value})}
                  className="w-full p-4 bg-gray-50 border border-transparent focus:border-indigo-200 rounded-2xl outline-none text-sm font-bold text-[#121c32] transition-all"
                  placeholder="Ex: 001FABES"
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-600 uppercase tracking-widest ml-1">Mot de passe</label>
                <input 
                  type="password" 
                  required
                  value={formData.motDePasse}
                  onChange={e => setFormData({...formData, motDePasse: e.target.value})}
                  className="w-full p-4 bg-gray-50 border border-transparent focus:border-indigo-200 rounded-2xl outline-none text-sm font-bold text-[#121c32] transition-all"
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-600 uppercase tracking-widest ml-1">Sécurité Biométrique</label>
                {formData.fingerprintCredential ? (
                  <div className="flex items-center gap-3 p-4 bg-emerald-50 rounded-2xl border border-emerald-100">
                    <div className="w-8 h-8 rounded-full bg-emerald-500 flex items-center justify-center text-white">
                      <ShieldCheck size={16} />
                    </div>
                    <div className="flex-1">
                      <p className="text-xs font-black text-emerald-600 uppercase">Empreinte enregistrée</p>
                    </div>
                    <button 
                      type="button"
                      onClick={() => setFormData(prev => ({ ...prev, fingerprintCredential: undefined }))}
                      className="text-[10px] font-black text-red-500 uppercase hover:underline"
                    >
                      Supprimer
                    </button>
                  </div>
                ) : (
                  <button 
                    type="button"
                    onClick={handleRegisterFingerprint}
                    disabled={isRegisteringFingerprint}
                    className="w-full py-4 bg-indigo-50 text-indigo-600 rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-indigo-100 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {isRegisteringFingerprint ? (
                      <>
                        <div className="w-4 h-4 border-2 border-indigo-600/30 border-t-indigo-600 rounded-full animate-spin" />
                        Enregistrement...
                      </>
                    ) : (
                      <>
                        <Fingerprint size={16} />
                        Enregistrer l'empreinte
                      </>
                    )}
                  </button>
                )}
              </div>

              <div className="flex gap-4 pt-4">
                <button 
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 py-4 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-2xl font-black uppercase tracking-widest transition-all"
                >
                  Annuler
                </button>
                <button 
                  type="submit"
                  className="flex-1 py-4 bg-[#121c32] text-white rounded-2xl font-black uppercase tracking-widest shadow-xl shadow-[#121c32]/20 transition-all active:scale-95"
                >
                  Créer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserManagement;
