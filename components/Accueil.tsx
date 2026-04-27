import React from 'react';
import { Home, User, Landmark, ShieldCheck, Mail, Phone, MapPin } from 'lucide-react';

const Accueil: React.FC = () => {
  const userStr = localStorage.getItem('microfox_current_user');
  const user = userStr ? JSON.parse(userStr) : null;
  const mfConfigStr = localStorage.getItem('microfox_mf_config');
  const mfConfig = mfConfigStr ? JSON.parse(mfConfigStr) : { nom: localStorage.getItem('microfox_current_mf') || 'MICROFOX' };

  if (!user) return null;

  return (
    <div className="max-w-4xl mx-auto space-y-6 lg:space-y-10 py-6 lg:py-10 px-4 sm:px-6 animate-in fade-in slide-in-from-bottom-6 duration-700 min-h-full flex flex-col justify-center">
      <div className="text-center space-y-4 mb-4 lg:mb-8">
        <div className="w-20 h-20 lg:w-24 lg:h-24 bg-blue-600/10 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-4 lg:mb-6 shadow-inner">
          <Home size={40} className="lg:w-12 lg:h-12" />
        </div>
        <h1 className="text-3xl lg:text-5xl font-black text-white uppercase tracking-tighter leading-tight">Bienvenue sur MICROFOX</h1>
        <p className="text-gray-400 font-bold uppercase tracking-[0.2em] text-[10px] lg:text-xs">Portail d'accès sécurisé à votre institution</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 lg:gap-8">
        <div className="bg-white p-6 lg:p-10 rounded-[2rem] lg:rounded-[3rem] border border-gray-100 shadow-xl shadow-gray-200/50 flex flex-col justify-between">
          <div className="space-y-6">
            <div className="flex items-center gap-4 border-b border-gray-50 pb-6">
              <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl shadow-sm">
                <User size={24} />
              </div>
              <div>
                <h2 className="text-base lg:text-lg font-black text-[#121c32] uppercase">Profil Utilisateur</h2>
                <p className="text-[10px] text-blue-600 font-black uppercase tracking-tight opacity-80">{user.role}</p>
              </div>
            </div>
            
            <div className="space-y-5">
              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 py-1">
                <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-2 shrink-0">
                  <User size={12} className="text-blue-500/50" /> Nom complet
                </span>
                <span className="text-sm lg:text-base font-black text-[#121c32] truncate">{user.nom || user.identifiant || user.name}</span>
              </div>
              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 py-1">
                <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-2 shrink-0">
                  <ShieldCheck size={12} className="text-blue-500/50" /> Identifiant
                </span>
                <span className="text-sm font-black text-blue-600 bg-blue-50 px-4 py-1.5 rounded-xl border border-blue-100/50 w-fit sm:w-auto self-start sm:self-auto font-mono">
                  {user.identifiant}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-[#121c32] p-6 lg:p-10 rounded-[2rem] lg:rounded-[3rem] shadow-2xl text-white flex flex-col justify-between relative overflow-hidden group">
          {/* Élément de fond décoratif */}
          <div className="absolute -right-10 -top-10 w-40 h-40 bg-emerald-500/10 rounded-full blur-3xl group-hover:bg-emerald-500/20 transition-all duration-700"></div>
          
          <div className="space-y-6 relative z-10">
            <div className="flex items-center gap-4 border-b border-white/10 pb-6">
              <div className="p-3 bg-white/10 text-emerald-400 rounded-2xl shadow-inner">
                <Landmark size={24} />
              </div>
              <div>
                <h2 className="text-base lg:text-lg font-black uppercase">Institution</h2>
                <p className="text-[10px] text-emerald-400 font-black uppercase tracking-tight opacity-80">Configuration Active</p>
              </div>
            </div>
            
            <div className="space-y-5">
              <div className="flex flex-col gap-1 py-1">
                <span className="text-[10px] text-gray-500 uppercase tracking-widest font-black">Raison Sociale</span>
                <span className="text-sm lg:text-base text-emerald-400 font-black uppercase truncate">{mfConfig.nom || 'MICROFOX GLOBAL'}</span>
              </div>
              <div className="flex flex-col gap-1 py-1">
                <span className="text-[10px] text-gray-500 uppercase tracking-widest font-black">Code Officiel</span>
                <span className="text-sm font-black text-white bg-white/10 px-4 py-1.5 rounded-xl border border-white/5 w-fit font-mono tracking-wider">
                  {mfConfig.code || user.codeMF || '001FABES'}
                </span>
              </div>
              {mfConfig.adresse && (
                <div className="flex items-start gap-2 pt-2 text-[10px] uppercase text-gray-500 tracking-tighter font-bold leading-tight">
                  <MapPin size={12} className="text-emerald-500 shrink-0 mt-0.5" />
                  <span className="truncate-2-lines">{mfConfig.adresse}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="bg-emerald-50/80 backdrop-blur-sm p-6 lg:p-8 rounded-[2rem] border border-emerald-100 flex flex-col sm:flex-row items-center gap-4 lg:gap-6">
        <div className="w-14 h-14 bg-emerald-500 text-white rounded-2xl flex items-center justify-center shrink-0 shadow-lg shadow-emerald-500/30">
          <ShieldCheck size={28} />
        </div>
        <div className="text-center sm:text-left">
          <h4 className="text-emerald-900 font-black text-sm lg:text-base uppercase">Session Certifiée et Sécurisée</h4>
          <p className="text-emerald-800 text-[10px] font-bold uppercase tracking-wider opacity-60 mt-1">Votre activité est auditée en temps réel pour garantir l'intégrité de vos opérations bancaires.</p>
        </div>
      </div>
    </div>
  );
};

export default Accueil;
