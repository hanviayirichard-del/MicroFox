import React, { useState } from 'react';
import { 
  BookOpen, 
  UserPlus, 
  Wallet, 
  CreditCard, 
  Repeat, 
  ShieldCheck, 
  FileText, 
  ChevronRight,
  Info,
  CheckCircle,
  AlertTriangle,
  Lock,
  ArrowRightLeft,
  GraduationCap
} from 'lucide-react';

const GuidePratique: React.FC = () => {
  const [activeTab, setActiveTab] = useState('general');

  const sections = [
    { id: 'general', label: 'Généralités', icon: <BookOpen size={18} /> },
    { id: 'membres', label: 'Gestion Membres', icon: <UserPlus size={18} /> },
    { id: 'caisse', label: 'Opérations Caisse', icon: <Wallet size={18} /> },
    { id: 'credit', label: 'Gestion Crédit', icon: <CreditCard size={18} /> },
    { id: 'tontine', label: 'Système Tontine', icon: <Repeat size={18} /> },
    { id: 'securite', label: 'Sécurité & Audit', icon: <ShieldCheck size={18} /> }
  ];

  const renderContent = () => {
    switch (activeTab) {
      case 'general':
        return (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="bg-blue-50 p-6 rounded-3xl border border-blue-100">
              <h3 className="text-lg font-black text-blue-900 uppercase mb-2 flex items-center gap-2">
                <Info size={20} /> Bienvenue sur MICROFOX
              </h3>
              <p className="text-blue-800 text-sm leading-relaxed font-medium">
                MICROFOX est une solution intégrée de gestion pour les institutions de microfinance. 
                Elle permet de centraliser les opérations d'épargne, de crédit et de tontine tout en garantissant 
                une traçabilité comptable rigoureuse.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <h4 className="font-black text-[#121c32] uppercase text-sm border-l-4 border-blue-600 pl-3">Rôles Utilisateurs</h4>
                <div className="space-y-3">
                  <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
                    <span className="text-[10px] font-black text-blue-600 uppercase mb-1 block">Administrateur / Directeur</span>
                    <p className="text-xs text-gray-500 font-medium">Accès total, validation des crédits, configuration système et rapports financiers.</p>
                  </div>
                  <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
                    <span className="text-[10px] font-black text-blue-600 uppercase mb-1 block">Caissier</span>
                    <p className="text-xs text-gray-500 font-medium">Opérations de guichet, dépôts/retraits, remboursements et clôture de caisse.</p>
                  </div>
                  <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
                    <span className="text-[10px] font-black text-blue-600 uppercase mb-1 block">Agent Commercial</span>
                    <p className="text-xs text-gray-500 font-medium">Collecte de tontine sur le terrain via l'interface mobile.</p>
                  </div>
                </div>
              </div>
              
              <div className="space-y-4">
                <h4 className="font-black text-[#121c32] uppercase text-sm border-l-4 border-emerald-500 pl-3">Cycle de Travail</h4>
                <ul className="space-y-2">
                  {[
                    "Authentification sécurisée",
                    "Ouverture de la journée (Vérification des soldes)",
                    "Saisie des opérations quotidiennes",
                    "Validation des collectes d'agents",
                    "Clôture de caisse et synchronisation"
                  ].map((step, i) => (
                    <li key={i} className="flex items-center gap-3 text-xs font-bold text-gray-600 bg-gray-50 p-3 rounded-xl">
                      <div className="w-5 h-5 rounded-full bg-[#121c32] text-white flex items-center justify-center text-[10px] shrink-0">{i+1}</div>
                      {step}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        );

      case 'membres':
        return (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-4">
                <h3 className="font-black text-[#121c32] uppercase text-sm flex items-center gap-2">
                  <UserPlus size={18} className="text-blue-600" /> Adhésion d'un Nouveau Membre
                </h3>
                <ol className="space-y-3">
                  <li className="flex gap-3">
                    <span className="font-black text-blue-600">01.</span>
                    <p className="text-xs text-gray-500 leading-relaxed font-medium">
                      Accéder à l'onglet <strong className="text-[#121c32]">Membres</strong> et cliquer sur <strong className="text-[#121c32]">Nouveau Client</strong>.
                    </p>
                  </li>
                  <li className="flex gap-3">
                    <span className="font-black text-blue-600">02.</span>
                    <p className="text-xs text-gray-500 leading-relaxed font-medium">
                      Remplir les informations (Nom, CIN, Téléphone, Photo). Un code unique est généré.
                    </p>
                  </li>
                  <li className="flex gap-3">
                    <span className="font-black text-blue-600">03.</span>
                    <p className="text-xs text-gray-500 leading-relaxed font-medium">
                      Régler les frais obligatoires : <strong className="text-emerald-600">Adhésion, Part Sociale et Livret</strong>.
                    </p>
                  </li>
                </ol>
                <div className="bg-amber-50 p-4 rounded-2xl border border-amber-100 flex gap-3">
                  <AlertTriangle className="text-amber-500 shrink-0" size={18} />
                  <p className="text-[10px] text-amber-700 font-bold leading-relaxed uppercase">
                    Le membre reste inactif tant que les frais d'adhésion minimum ne sont pas perçus.
                  </p>
                </div>
              </div>
              <div className="bg-gray-50 rounded-3xl p-6">
                <h4 className="font-black text-[#121c32] uppercase text-xs mb-4">Comptes Associés</h4>
                <div className="space-y-2">
                  {[
                    { label: "Épargne", desc: "Dépôts à vue (Compte courant)" },
                    { label: "Tontine", desc: "Épargne journalière cyclique" },
                    { label: "Crédit", desc: "Encours de prêts et garanties" },
                    { label: "Part Sociale", desc: "Capital détenu par le membre" }
                  ].map((acc, i) => (
                    <div key={i} className="flex justify-between items-center bg-white p-3 rounded-xl border border-gray-100">
                      <span className="text-xs font-black text-[#121c32]">{acc.label}</span>
                      <span className="text-[10px] font-bold text-gray-400">{acc.desc}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        );

      case 'caisse':
        return (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="bg-white rounded-3xl border border-gray-100 p-6 shadow-sm">
              <h3 className="font-black text-[#121c32] uppercase text-sm mb-6 flex items-center gap-2">
                <Wallet size={18} className="text-blue-600" /> Gestion des Opérations au Guichet
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-emerald-50/50 p-5 rounded-2xl border border-emerald-100">
                  <h4 className="text-emerald-700 text-[10px] font-black uppercase mb-3">Dépôt Épargne</h4>
                  <p className="text-[11px] text-emerald-800 font-medium leading-relaxed">
                    Saisie du montant, sélection de la source (Espèces). Génère un ticket automatique et met à jour le solde instantanément.
                  </p>
                </div>
                <div className="bg-red-50/50 p-5 rounded-2xl border border-red-100">
                  <h4 className="text-red-700 text-[10px] font-black uppercase mb-3">Retrait Épargne</h4>
                  <p className="text-[11px] text-red-800 font-medium leading-relaxed">
                    Vérification du solde disponible. Validation par le caissier. Attention aux frais de retrait si applicables.
                  </p>
                </div>
                <div className="bg-blue-50/50 p-5 rounded-2xl border border-blue-100">
                  <h4 className="text-blue-700 text-[10px] font-black uppercase mb-3">Vente de Livret</h4>
                  <p className="text-[11px] text-blue-800 font-medium leading-relaxed">
                    Opération obligatoire lors de l'adhésion ou renouvellement. Crédite le compte Produit (706).
                  </p>
                </div>
              </div>
            </div>

            <div className="flex flex-col md:flex-row gap-6">
              <div className="flex-1 bg-[#121c32] text-white p-6 rounded-3xl">
                <h4 className="font-black text-xs uppercase mb-4 flex items-center gap-2">
                  <ArrowRightLeft size={16} /> Transferts & Coffre
                </h4>
                <p className="text-xs text-gray-300 font-medium mb-4">
                  Les fonds peuvent être transférés entre les caisses secondaires et la CAISSE PRINCIPALE.
                </p>
                <div className="space-y-3">
                  <div className="text-[10px] border-l-2 border-blue-400 pl-3 py-1">
                    <strong>CAISSE Vers COFFRE :</strong> Sécurisation des excédents.
                  </div>
                  <div className="text-[10px] border-l-2 border-emerald-400 pl-3 py-1">
                    <strong>TRANSFERT BANQUE :</strong> Dépôts de fonds sur les comptes bancaires de l'institution.
                  </div>
                </div>
              </div>
              <div className="flex-1 bg-gray-50 p-6 rounded-3xl border border-gray-100">
                <h4 className="font-black text-[#121c32] uppercase text-xs mb-4">Clôture de Journée</h4>
                <ul className="space-y-2">
                  <li className="flex items-center gap-2 text-[11px] font-bold text-gray-600">
                    <CheckCircle size={14} className="text-emerald-500" /> Comptage des espèces physiques
                  </li>
                  <li className="flex items-center gap-2 text-[11px] font-bold text-gray-600">
                    <CheckCircle size={14} className="text-emerald-500" /> Comparaison avec le solde système
                  </li>
                  <li className="flex items-center gap-2 text-[11px] font-bold text-gray-600">
                    <CheckCircle size={14} className="text-emerald-500" /> Saisie des écarts (Surplus/Manquant)
                  </li>
                </ul>
              </div>
            </div>
          </div>
        );

      case 'credit':
        return (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="relative">
              <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gray-100"></div>
              <div className="space-y-8 relative">
                {[
                  { title: "Demande de Crédit", desc: "Le client remplit le formulaire. Saisie de l'objet, montant et type de garantie dans 'Demande de Crédit'." },
                  { title: "Comité de Crédit", desc: "L'administrateur analyse le dossier. Passage du statut de 'EN ATTENTE' à 'APPROUVÉ' ou 'REJETÉ'." },
                  { title: "Déblocage des Fonds", desc: "Le caissier effectue le décaissement physique une fois le prêt validé. Le compte crédit est alors débité." },
                  { title: "Remboursement", desc: "Paiements réguliers des échéances (Capital + Intérêts + Pénalités éventuelles)." }
                ].map((step, i) => (
                  <div key={i} className="flex gap-6 pl-2">
                    <div className="w-4 h-4 rounded-full bg-blue-600 flex items-center justify-center relative z-10 mt-1 ring-4 ring-white"></div>
                    <div>
                      <h4 className="text-xs font-black text-[#121c32] uppercase">{step.title}</h4>
                      <p className="text-[11px] text-gray-500 font-medium leading-relaxed mt-1">{step.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        );

      case 'tontine':
        return (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="bg-indigo-50 p-6 rounded-3xl border border-indigo-100 flex flex-col md:flex-row gap-6">
              <div className="md:w-2/3">
                <h3 className="font-black text-indigo-900 uppercase text-sm mb-3">La Collecte Mobile</h3>
                <p className="text-xs text-indigo-800 font-medium leading-relaxed">
                  L'Agent Commercial utilise l'interface simplifiée pour enregistrer les cotisations quotidiennes sur le terrain. 
                  Chaque saisie est stockée temporairement dans "Cotisations en Attente".
                </p>
              </div>
              <div className="md:w-1/3 flex items-center justify-center">
                <div className="bg-white p-4 rounded-2xl shadow-sm border border-indigo-200">
                  <Repeat size={32} className="text-indigo-600 transition-all" />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-white p-6 rounded-3xl border border-gray-100">
                <h4 className="font-black text-[#121c32] uppercase text-xs mb-4">Validation (Bureau)</h4>
                <p className="text-[11px] text-gray-500 font-medium leading-relaxed mb-4">
                  Le caissier reçoit les fonds physiques de l'agent et valide les collectes dans l'onglet "Validation Tontine". 
                  Un reçu global est généré.
                </p>
                <div className="bg-emerald-50 text-emerald-700 p-3 rounded-xl text-[10px] font-bold uppercase">
                  Aucune tontine n'est créditée au membre sans validation du bureau.
                </div>
              </div>
              <div className="bg-white p-6 rounded-3xl border border-gray-100">
                <h4 className="font-black text-[#121c32] uppercase text-xs mb-4">Retrait Tontine</h4>
                <p className="text-[11px] text-gray-500 font-medium leading-relaxed mb-4">
                  À la fin du cycle (ex: 31 jours), le membre peut retirer son épargne. La commission de tontine (ex: 1 jour de cotisation) est automatiquement déduite.
                </p>
                <div className="flex items-center gap-2 text-[10px] font-black text-blue-600">
                  <ChevronRight size={14} /> VOIR MODULE "RETRAIT TONTINE"
                </div>
              </div>
            </div>
          </div>
        );

      case 'securite':
        return (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-6">
                <div className="bg-red-50 p-6 rounded-3xl border border-red-100">
                  <h3 className="font-black text-red-900 uppercase text-sm mb-3 flex items-center gap-2">
                    <Lock size={18} /> Contrôles d'Accès
                  </h3>
                  <p className="text-xs text-red-800 font-medium leading-relaxed">
                    Chaque utilisateur possède ses propres identifiants. Il est strictement interdit déléguer sa session. 
                    Le système déconnecte automatiquement en cas d'inactivité.
                  </p>
                </div>
                <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
                  <h4 className="font-black text-[#121c32] uppercase text-xs mb-4">Audit & Traçabilité</h4>
                  <p className="text-[11px] text-gray-500 font-medium leading-relaxed">
                    Toutes les actions (Modifications, Créations, Suppressions) sont enregistrées dans le <strong>Journal d'Audit</strong> 
                    avec horodatage et adresse IP.
                  </p>
                </div>
              </div>
              <div className="bg-gray-900 text-white p-8 rounded-[2.5rem]">
                <h4 className="font-black text-xs uppercase mb-6 text-blue-400">Bonnes Pratiques de Sécurité</h4>
                <ul className="space-y-4">
                  {[
                    "Changer le mot de passe tous les 3 mois",
                    "Vérifier le solde de caisse avant chaque départ",
                    "Signaler tout écart inhabituel au directeur",
                    "Ne jamais modifier une opération validée sans autorisation"
                  ].map((rule, i) => (
                    <li key={i} className="flex gap-4">
                      <ShieldCheck size={18} className="text-emerald-500 shrink-0" />
                      <span className="text-[11px] font-bold text-gray-300 leading-relaxed uppercase tracking-tight">{rule}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-12">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-[#121c32] uppercase tracking-tight">
            Guide d'Utilisation Pratique
          </h1>
          <p className="text-gray-500 font-medium">Manuel détaillé des procédures MICROFOX</p>
        </div>
        <div className="flex items-center gap-2 bg-blue-50 px-4 py-2 rounded-2xl">
          <Info className="text-blue-600" size={18} />
          <span className="text-[10px] font-black text-blue-600 uppercase tracking-widest">Version Documentation 2.0</span>
        </div>
      </div>

      <div className="flex overflow-x-auto gap-2 pb-2 scrollbar-none">
        {sections.map((section) => (
          <button
            key={section.id}
            onClick={() => setActiveTab(section.id)}
            className={`flex items-center gap-2 px-5 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all whitespace-nowrap
              ${activeTab === section.id 
                ? 'bg-[#121c32] text-white shadow-lg shadow-blue-900/10' 
                : 'bg-white text-gray-500 hover:bg-gray-50 border border-gray-100'}`}
          >
            {section.icon}
            {section.label}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-[2.5rem] shadow-sm border border-gray-100 min-h-[500px] p-8 md:p-10">
        {renderContent()}
      </div>

      <div className="bg-[#121c32] p-8 rounded-[2.5rem] flex flex-col md:flex-row items-center justify-between gap-6 text-center md:text-left">
        <div>
          <h3 className="text-white font-black text-lg uppercase mb-1">Besoin d'aide supplémentaire ?</h3>
          <p className="text-gray-400 text-xs font-medium uppercase tracking-widest">Contactez le support technique MICROFOX</p>
        </div>
        <button className="px-8 py-4 bg-blue-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-blue-700 transition-all shadow-xl shadow-blue-900/20">
          Ouvrir un ticket support
        </button>
      </div>
    </div>
  );
};

export default GuidePratique;

