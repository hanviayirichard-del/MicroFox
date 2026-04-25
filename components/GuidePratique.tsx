import React from 'react';
import { BookOpen, ShieldCheck, Users, Clock, Landmark, Calculator, ClipboardCheck, GraduationCap, Settings, LayoutDashboard, Map as MapIcon, FileText, MessageSquare, TrendingUp, RefreshCw, FileCheck, Wallet, ShoppingCart, Vault, TrendingDown, Package, Gem, CreditCard, Percent, Printer, Scale, AlertTriangle, Hexagon } from 'lucide-react';

const GuidePratique: React.FC = () => {
  const userStr = localStorage.getItem('microfox_current_user');
  const user = userStr ? JSON.parse(userStr) : { role: 'administrateur' };
  const role = user.role;

  const getRoleGuide = () => {
    switch (role) {
      case 'administrateur':
        return (
          <div className="space-y-6">
            <section className="bg-[#1a2642] p-6 rounded-2xl border border-white/5 shadow-xl">
              <h3 className="text-xl font-black text-emerald-400 uppercase tracking-tighter mb-4 flex items-center gap-2">
                <ShieldCheck size={24} />
                Rôle: Administrateur
              </h3>
              <p className="text-gray-300 leading-relaxed mb-4">
                En tant qu'administrateur, vous avez un accès complet à toutes les fonctionnalités du système. Votre rôle est de superviser l'ensemble des opérations, de configurer le système et de gérer les accès.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-[#0a1226] p-4 rounded-xl border border-white/5">
                  <h4 className="font-bold text-white mb-2 flex items-center gap-2">
                    <LayoutDashboard size={18} className="text-blue-400" />
                    Pilotage & Analyse
                  </h4>
                  <ul className="text-sm text-gray-400 space-y-2">
                    <li>• Suivi en temps réel du Tableau de Bord consolidé.</li>
                    <li>• Analyse géographique des membres et des zones.</li>
                    <li>• Consultation des Rapports Financiers et États Réglementaires.</li>
                  </ul>
                </div>
                <div className="bg-[#0a1226] p-4 rounded-xl border border-white/5">
                  <h4 className="font-bold text-white mb-2 flex items-center gap-2">
                    <Settings size={18} className="text-amber-400" />
                    Configuration & Sécurité
                  </h4>
                  <ul className="text-sm text-gray-400 space-y-2">
                    <li>• Gestion des utilisateurs et de leurs permissions.</li>
                    <li>• Configuration des paramètres de la microfinance.</li>
                    <li>• Audit des logs de sécurité et corrections d'opérations.</li>
                  </ul>
                </div>
              </div>
            </section>
          </div>
        );
      case 'caissier':
        return (
          <div className="space-y-6">
            <section className="bg-[#1a2642] p-6 rounded-2xl border border-white/5 shadow-xl">
              <h3 className="text-xl font-black text-blue-400 uppercase tracking-tighter mb-4 flex items-center gap-2">
                <Landmark size={24} />
                Rôle: Caissier
              </h3>
              <p className="text-gray-300 leading-relaxed mb-4">
                Votre rôle principal est la gestion des flux de trésorerie au guichet. Vous êtes responsable de l'exactitude des opérations de dépôt, de retrait et de la tenue de votre caisse.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-[#0a1226] p-4 rounded-xl border border-white/5">
                  <h4 className="font-bold text-white mb-2 flex items-center gap-2">
                    <Users size={18} className="text-emerald-400" />
                    Opérations Membres
                  </h4>
                  <ul className="text-sm text-gray-400 space-y-2">
                    <li>• Enregistrement des dépôts et retraits épargne.</li>
                    <li>• Encaissement des parts sociales et frais d'adhésion.</li>
                    <li>• Vente de livrets et déblocage de crédits validés.</li>
                  </ul>
                </div>
                <div className="bg-[#0a1226] p-4 rounded-xl border border-white/5">
                  <h4 className="font-bold text-white mb-2 flex items-center gap-2">
                    <Calculator size={18} className="text-purple-400" />
                    Gestion de Caisse
                  </h4>
                  <ul className="text-sm text-gray-400 space-y-2">
                    <li>• Suivi en temps réel du solde de votre CAISSE PRINCIPALE.</li>
                    <li>• Enregistrement des dépenses administratives autorisées.</li>
                    <li>• Consultation de votre Journal Global personnel.</li>
                  </ul>
                </div>
              </div>
            </section>
          </div>
        );
      case 'agent commercial':
        return (
          <div className="space-y-6">
            <section className="bg-[#1a2642] p-6 rounded-2xl border border-white/5 shadow-xl">
              <h3 className="text-xl font-black text-amber-400 uppercase tracking-tighter mb-4 flex items-center gap-2">
                <TrendingUp size={24} />
                Rôle: Agent Commercial
              </h3>
              <p className="text-gray-300 leading-relaxed mb-4">
                Vous êtes le lien direct avec les clients sur le terrain. Votre mission est la collecte de la tontine, le recrutement de nouveaux membres et le suivi des crédits dans votre zone.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-[#0a1226] p-4 rounded-xl border border-white/5">
                  <h4 className="font-bold text-white mb-2 flex items-center gap-2">
                    <Clock size={18} className="text-amber-400" />
                    Collecte & Tontine
                  </h4>
                  <ul className="text-sm text-gray-400 space-y-2">
                    <li>• Saisie des cotisations journalières via l'onglet Tontine.</li>
                    <li>• Gestion des demandes de retrait tontine pour vos clients.</li>
                    <li>• Suivi de vos commissions de collecte.</li>
                  </ul>
                </div>
                <div className="bg-[#0a1226] p-4 rounded-xl border border-white/5">
                  <h4 className="font-bold text-white mb-2 flex items-center gap-2">
                    <Wallet size={18} className="text-emerald-400" />
                    Versements & Suivi
                  </h4>
                  <ul className="text-sm text-gray-400 space-y-2">
                    <li>• Déclaration de vos versements journaliers à la caisse.</li>
                    <li>• Consultation de la carte géographique de vos membres.</li>
                    <li>• Suivi des états des écarts de votre collecte.</li>
                  </ul>
                </div>
              </div>
            </section>
          </div>
        );
      case 'gestionnaire de crédit':
        return (
          <div className="space-y-6">
            <section className="bg-[#1a2642] p-6 rounded-2xl border border-white/5 shadow-xl">
              <h3 className="text-xl font-black text-purple-400 uppercase tracking-tighter mb-4 flex items-center gap-2">
                <CreditCard size={24} />
                Rôle: Gestionnaire de Crédit
              </h3>
              <p className="text-gray-300 leading-relaxed mb-4">
                Vous êtes responsable de l'analyse des demandes de crédit, du suivi des remboursements et de la gestion du portefeuille de prêts.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-[#0a1226] p-4 rounded-xl border border-white/5">
                  <h4 className="font-bold text-white mb-2 flex items-center gap-2">
                    <FileText size={18} className="text-blue-400" />
                    Instruction & Suivi
                  </h4>
                  <ul className="text-sm text-gray-400 space-y-2">
                    <li>• Saisie et analyse des nouvelles demandes de crédit.</li>
                    <li>• Suivi rigoureux des crédits actifs et des impayés.</li>
                    <li>• Gestion des garanties et des dossiers clients.</li>
                  </ul>
                </div>
                <div className="bg-[#0a1226] p-4 rounded-xl border border-white/5">
                  <h4 className="font-bold text-white mb-2 flex items-center gap-2">
                    <RefreshCw size={18} className="text-amber-400" />
                    Opérations Diverses
                  </h4>
                  <ul className="text-sm text-gray-400 space-y-2">
                    <li>• Enregistrement des remboursements exceptionnels.</li>
                    <li>• Analyse de la rentabilité du portefeuille crédit.</li>
                    <li>• Reporting sur la qualité du portefeuille (PAR).</li>
                  </ul>
                </div>
              </div>
            </section>
          </div>
        );
      case 'contrôleur':
      case 'auditeur':
        return (
          <div className="space-y-6">
            <section className="bg-[#1a2642] p-6 rounded-2xl border border-white/5 shadow-xl">
              <h3 className="text-xl font-black text-red-400 uppercase tracking-tighter mb-4 flex items-center gap-2">
                <ClipboardCheck size={24} />
                Rôle: {role.charAt(0).toUpperCase() + role.slice(1)}
              </h3>
              <p className="text-gray-300 leading-relaxed mb-4">
                Votre mission est de garantir la conformité des opérations, de détecter les anomalies et de prévenir les risques de fraude ou d'erreurs.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-[#0a1226] p-4 rounded-xl border border-white/5">
                  <h4 className="font-bold text-white mb-2 flex items-center gap-2">
                    <AlertTriangle size={18} className="text-red-400" />
                    Vérification & Contrôle
                  </h4>
                  <ul className="text-sm text-gray-400 space-y-2">
                    <li>• Contrôle des opérations sur le terrain et au guichet.</li>
                    <li>• Vérification de la conformité des retraits tontine.</li>
                    <li>• Analyse des alertes de doublons et des réclamations.</li>
                  </ul>
                </div>
                <div className="bg-[#0a1226] p-4 rounded-xl border border-white/5">
                  <h4 className="font-bold text-white mb-2 flex items-center gap-2">
                    <Scale size={18} className="text-blue-400" />
                    Conformité & Rapports
                  </h4>
                  <ul className="text-sm text-gray-400 space-y-2">
                    <li>• Suivi des ratios réglementaires et de la LAB/FT.</li>
                    <li>• Consultation de la carte géographique pour audit.</li>
                    <li>• Rapport de conformité et recommandations.</li>
                  </ul>
                </div>
              </div>
            </section>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-12">
      <div className="flex items-center gap-4 mb-8">
        <div className="p-4 bg-emerald-500/10 text-emerald-500 rounded-3xl">
          <BookOpen size={40} />
        </div>
        <div>
          <h1 className="text-3xl font-black text-white uppercase tracking-tighter">Guide Pratique</h1>
          <p className="text-gray-400 font-medium">Bienvenue sur MicroFoX. Voici votre guide d'utilisation personnalisé.</p>
        </div>
      </div>

      {getRoleGuide()}

      <section className="bg-[#121c32] p-8 rounded-[2.5rem] border border-white/5 shadow-2xl">
        <h3 className="text-xl font-black text-white uppercase tracking-tighter mb-6 flex items-center gap-3">
          <GraduationCap size={24} className="text-emerald-400" />
          Conseils d'utilisation généraux
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div className="flex gap-4">
              <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-400 shrink-0 font-black">1</div>
              <div>
                <h4 className="font-bold text-gray-200">Synchronisation</h4>
                <p className="text-sm text-gray-400">Pensez à cliquer sur le bouton rouge "Synchronisation" en bas du menu pour envoyer vos données au serveur.</p>
              </div>
            </div>
            <div className="flex gap-4">
              <div className="w-10 h-10 rounded-full bg-amber-500/10 flex items-center justify-center text-amber-400 shrink-0 font-black">2</div>
              <div>
                <h4 className="font-bold text-gray-200">Recherche rapide</h4>
                <p className="text-sm text-gray-400">Utilisez les barres de recherche dans chaque onglet pour trouver rapidement un membre par son nom ou son code.</p>
              </div>
            </div>
          </div>
          <div className="space-y-4">
            <div className="flex gap-4">
              <div className="w-10 h-10 rounded-full bg-purple-500/10 flex items-center justify-center text-purple-400 shrink-0 font-black">3</div>
              <div>
                <h4 className="font-bold text-gray-200">Sécurité</h4>
                <p className="text-sm text-gray-400">Ne partagez jamais vos identifiants. Déconnectez-vous toujours après avoir fini vos opérations.</p>
              </div>
            </div>
            <div className="flex gap-4">
              <div className="w-10 h-10 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-400 shrink-0 font-black">4</div>
              <div>
                <h4 className="font-bold text-gray-200">Support</h4>
                <p className="text-sm text-gray-400">En cas de difficulté, consultez l'onglet "Conseils & Formation" ou contactez votre administrateur.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="bg-gradient-to-br from-emerald-600 to-teal-700 p-8 rounded-[2.5rem] text-white shadow-2xl relative overflow-hidden group">
        <div className="relative z-10">
          <h3 className="text-2xl font-black uppercase tracking-tighter mb-2">Besoin d'aide supplémentaire ?</h3>
          <p className="text-emerald-50 opacity-90 mb-6 max-w-md">Nos équipes sont à votre disposition pour vous accompagner dans la prise en main de l'outil.</p>
          <button className="bg-white text-emerald-700 px-8 py-3 rounded-2xl font-black uppercase tracking-widest text-sm hover:bg-emerald-50 transition-colors shadow-xl">
            Contacter le support
          </button>
        </div>
        <div className="absolute top-0 right-0 -translate-y-1/4 translate-x-1/4 opacity-10 group-hover:scale-110 transition-transform duration-700">
          <Hexagon size={300} />
        </div>
      </div>
    </div>
  );
};

export default GuidePratique;
