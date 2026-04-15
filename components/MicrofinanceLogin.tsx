import React, { useState, useEffect } from 'react';
import { Building2, ArrowRight, ShieldCheck, User as UserIcon, Lock, Fingerprint } from 'lucide-react';
import { User } from '../types';

interface MicrofinanceLoginProps {
  onLogin: (user: User) => void;
}

const MicrofinanceLogin: React.FC<MicrofinanceLoginProps> = ({ onLogin }) => {
  const [identifiant, setIdentifiant] = useState('');
  const [codeMF, setCodeMF] = useState('');
  const [motDePasse, setMotDePasse] = useState('');
  const [error, setError] = useState('');
  const [attempts, setAttempts] = useState(0);
  const [lockoutTimer, setLockoutTimer] = useState(0);
  const [isAuthenticatingFingerprint, setIsAuthenticatingFingerprint] = useState(false);

  const handleFingerprintLogin = async () => {
    if (lockoutTimer > 0) return;
    setError('');
    setIsAuthenticatingFingerprint(true);

    try {
      const savedUsers = localStorage.getItem('microfox_users');
      if (!savedUsers) throw new Error("Aucun utilisateur enregistré.");

      const users: User[] = JSON.parse(savedUsers);
      const usersWithFingerprint = users.filter(u => !u.isDeleted && u.fingerprintCredential);

      if (usersWithFingerprint.length === 0) {
        throw new Error("Aucune empreinte digitale enregistrée sur cet appareil.");
      }

      const { authenticateFingerprint } = await import('../utils/webauthn');
      
      // Since we might have multiple users with fingerprints, we need to find which one is authenticating.
      // WebAuthn's navigator.credentials.get with allowCredentials will handle the selection if multiple match.
      // For simplicity, we'll try to authenticate against all registered credentials on this device.
      
      const credentialIds = usersWithFingerprint.map(u => u.fingerprintCredential!.id);
      
      // We need to try each one or use allowCredentials with all IDs.
      // Our authenticateFingerprint utility currently takes one ID. Let's modify it or loop.
      // Actually, let's just use the first one for now or prompt for identifiant first?
      // The user request says "permettre d'avoir accès à l'application".
      
      const trimmedIdentifiant = identifiant.trim();
      const trimmedCodeMF = codeMF.trim().toUpperCase();

      if (trimmedIdentifiant && trimmedCodeMF) {
        // Specific user login
        const targetUser = usersWithFingerprint.find(u => 
          u.identifiant.toLowerCase() === trimmedIdentifiant.toLowerCase() &&
          u.codeMF.toUpperCase() === trimmedCodeMF
        );

        if (!targetUser) {
          throw new Error("Utilisateur non trouvé ou empreinte non enregistrée pour cet identifiant.");
        }

        const authenticatedId = await authenticateFingerprint(targetUser.fingerprintCredential!.id);
        if (authenticatedId) {
          if (targetUser.isBlocked) {
            throw new Error('Votre compte est bloqué. Veuillez contacter l\'administrateur.');
          }
          onLogin(targetUser);
          return;
        }
      } else {
        // Try all fingerprints
        const credentialIds = usersWithFingerprint.map(u => u.fingerprintCredential!.id);
        if (credentialIds.length === 0) {
          throw new Error("Aucune empreinte digitale enregistrée dans le système.");
        }

        const authenticatedId = await authenticateFingerprint(credentialIds);
        if (authenticatedId) {
          const targetUser = usersWithFingerprint.find(u => u.fingerprintCredential!.id === authenticatedId);
          if (targetUser) {
            if (targetUser.isBlocked) {
              throw new Error('Votre compte est bloqué. Veuillez contacter l\'administrateur.');
            }
            onLogin(targetUser);
            return;
          }
        }
      }

    } catch (error: any) {
      console.error("Fingerprint login error:", error);
      let msg = error.message || "Échec de l'authentification par empreinte.";
      if (msg.includes("feature is not enabled") || msg.includes("Permissions Policy")) {
        msg = "L'accès biométrique est bloqué dans cet aperçu. Veuillez ouvrir l'application dans un nouvel onglet pour vous connecter avec votre empreinte.";
      }
      setError(msg);
    } finally {
      setIsAuthenticatingFingerprint(false);
    }
  };

  useEffect(() => {
    if (lockoutTimer > 0) {
      const timer = setInterval(() => {
        setLockoutTimer((prev) => prev - 1);
      }, 1000);
      return () => clearInterval(timer);
    } else if (lockoutTimer === 0 && attempts >= 3) {
      setAttempts(0);
    }
  }, [lockoutTimer, attempts]);

  useEffect(() => {
    // Initialiser ou mettre à jour l'admin par défaut
    const savedUsers = localStorage.getItem('microfox_users');
    let users: User[] = [];
    try {
      users = savedUsers ? JSON.parse(savedUsers) : [];
      if (!Array.isArray(users)) users = [];
    } catch (e) {
      console.error("Error parsing users:", e);
      users = [];
    }
    
    const adminIndex = users.findIndex(u => u.identifiant === 'RICHARD');
    if (adminIndex === -1) {
      const defaultAdmin: User = {
        id: 'user_admin',
        identifiant: 'RICHARD',
        role: 'administrateur',
        microfinance: 'MicroFoX Global',
        codeMF: 'GLOBAL',
        motDePasse: 'a6666'
      };
      users.push(defaultAdmin);
      localStorage.setItem('microfox_users', JSON.stringify(users));
    } else {
      // S'assurer que l'admin existant a les bonnes infos (migration)
      let changed = false;
      if (users[adminIndex].isDeleted) {
        users[adminIndex].isDeleted = false;
        changed = true;
      }
      if (users[adminIndex].motDePasse !== 'a6666') {
        users[adminIndex].motDePasse = 'a6666';
        changed = true;
      }
      if (users[adminIndex].codeMF !== 'GLOBAL') {
        users[adminIndex].codeMF = 'GLOBAL';
        changed = true;
      }
      if (changed) {
        localStorage.setItem('microfox_users', JSON.stringify(users));
      }
    }
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (lockoutTimer > 0) return;
    setError('');
    
    const savedUsers = localStorage.getItem('microfox_users');
    if (savedUsers) {
      try {
        const users: User[] = JSON.parse(savedUsers);
        const trimmedIdentifiant = identifiant.trim();
        const trimmedCodeMF = codeMF.trim().toUpperCase();
        
        const user = users.find(u => 
          !u.isDeleted &&
          (u.identifiant || '').trim().toLowerCase() === trimmedIdentifiant.toLowerCase() && 
          u.motDePasse === motDePasse && 
          (u.codeMF || '').trim().toUpperCase() === trimmedCodeMF
        );
        
        if (user) {
          if (user.isBlocked) {
            setError('Votre compte est bloqué. Veuillez contacter l\'administrateur.');
            return;
          }
          onLogin(user);
        } else {
          const newAttempts = attempts + 1;
          setAttempts(newAttempts);
          if (newAttempts >= 3) {
            setLockoutTimer(30);
            setError('Trop de tentatives. Veuillez patienter 30 secondes.');
          } else {
            setError(`Identifiant, code MF ou mot de passe incorrect (${3 - newAttempts} tentatives restantes)`);
          }
        }
      } catch (e) {
        setError('Erreur de connexion');
      }
    }
  };

  return (
    <div className="min-h-screen relative flex items-center justify-center p-4 overflow-hidden font-sans">
      {/* Background Image with Overlay */}
      <div className="absolute inset-0 z-0">
        <img 
          src="https://picsum.photos/id/10/1920/1080?blur=5" 
          alt="Background" 
          className="w-full h-full object-cover scale-105"
          referrerPolicy="no-referrer"
        />
        <div className="absolute inset-0 bg-gradient-to-br from-[#064e3b]/90 via-[#065f46]/70 to-transparent" />
      </div>

      <div className="max-w-md w-full relative z-10 bg-[#121c32]/90 backdrop-blur-2xl rounded-[3rem] shadow-2xl p-10 border border-white/10 animate-in fade-in zoom-in duration-700">
        <div className="flex flex-col items-center text-center mb-10">
          <div className="w-24 h-24 bg-[#064e3b] rounded-[2rem] flex items-center justify-center text-white mb-6 shadow-2xl shadow-black/20 transform -rotate-3 hover:rotate-0 transition-transform duration-500">
            <Building2 size={48} strokeWidth={1.5} />
          </div>
          <h1 className="text-4xl font-black text-white uppercase tracking-tighter italic">MicroFoX</h1>
          <div className="h-1 w-12 bg-emerald-500 rounded-full mt-2 mb-1" />
          <p className="text-gray-400 text-[10px] font-black uppercase tracking-[0.4em]">Accès Sécurisé</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-4">Code Microfinance</label>
            <div className="relative group">
              <Building2 className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-emerald-500 transition-colors" size={18} />
              <input 
                type="text" 
                value={codeMF}
                onChange={(e) => setCodeMF(e.target.value)}
                placeholder="Ex: 001FABES"
                className="w-full p-5 pl-14 bg-white/5 border-2 border-transparent focus:border-emerald-500/20 focus:bg-white/10 rounded-[1.5rem] outline-none text-lg font-bold text-white transition-all placeholder:text-gray-600 shadow-inner disabled:opacity-50"
                required
                disabled={lockoutTimer > 0}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-4">Identifiant</label>
            <div className="relative group">
              <UserIcon className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-emerald-500 transition-colors" size={18} />
              <input 
                type="text" 
                value={identifiant}
                onChange={(e) => setIdentifiant(e.target.value)}
                placeholder="Votre identifiant"
                className="w-full p-5 pl-14 bg-white/5 border-2 border-transparent focus:border-emerald-500/20 focus:bg-white/10 rounded-[1.5rem] outline-none text-lg font-bold text-white transition-all placeholder:text-gray-600 shadow-inner disabled:opacity-50"
                required
                disabled={lockoutTimer > 0}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-4">Mot de passe</label>
            <div className="relative group">
              <Lock className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-emerald-500 transition-colors" size={18} />
              <input 
                type="password" 
                value={motDePasse}
                onChange={(e) => setMotDePasse(e.target.value)}
                placeholder="••••••••"
                className="w-full p-5 pl-14 bg-white/5 border-2 border-transparent focus:border-emerald-500/20 focus:bg-white/10 rounded-[1.5rem] outline-none text-lg font-bold text-white transition-all placeholder:text-gray-600 shadow-inner disabled:opacity-50"
                required
                disabled={lockoutTimer > 0}
              />
            </div>
          </div>

          {error && (
            <div className={`bg-red-50 border border-red-100 p-3 rounded-xl ${lockoutTimer > 0 ? '' : 'animate-shake'}`}>
              <p className="text-[10px] font-black text-red-500 text-center uppercase tracking-widest">
                {lockoutTimer > 0 ? `Trop de tentatives. Réessayez dans ${lockoutTimer}s` : error}
              </p>
            </div>
          )}

          <button 
            type="submit"
            disabled={lockoutTimer > 0}
            className="w-full py-5 bg-[#059669] hover:bg-[#047857] disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-[1.5rem] font-black uppercase tracking-widest shadow-2xl shadow-emerald-900/40 transition-all active:scale-95 flex items-center justify-center gap-3 group"
          >
            {lockoutTimer > 0 ? `Patientez ${lockoutTimer}s` : 'Se connecter'}
            {lockoutTimer === 0 && <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />}
          </button>

          <div className="relative py-2">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-white/10"></div>
            </div>
            <div className="relative flex justify-center text-[10px] uppercase font-black tracking-widest">
              <span className="bg-[#121c32] px-4 text-gray-500">OU</span>
            </div>
          </div>

          <button 
            type="button"
            onClick={handleFingerprintLogin}
            disabled={lockoutTimer > 0 || isAuthenticatingFingerprint}
            className="w-full py-5 bg-white/5 hover:bg-white/10 border-2 border-white/10 text-white rounded-[1.5rem] font-black uppercase tracking-widest transition-all active:scale-95 flex items-center justify-center gap-3 disabled:opacity-50"
          >
            {isAuthenticatingFingerprint ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <Fingerprint size={20} className="text-emerald-400" />
            )}
            Empreinte Digitale
          </button>
        </form>

        <div className="mt-10 pt-8 border-t border-white/10 flex items-center justify-center gap-3 text-emerald-400">
          <div className="p-2 bg-emerald-500/10 rounded-lg">
            <ShieldCheck size={20} />
          </div>
          <p className="text-[9px] font-black uppercase tracking-[0.2em]">Espace sécurisé & Données isolées</p>
        </div>
      </div>
    </div>
  );
};

export default MicrofinanceLogin;
