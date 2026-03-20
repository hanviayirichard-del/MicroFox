import React, { useState } from 'react';
import { 
  GraduationCap, 
  BookOpen, 
  ShieldCheck, 
  Search, 
  PlayCircle, 
  Download, 
  ChevronRight, 
  Lightbulb, 
  Scale, 
  Users, 
  FileText,
  Star,
  ArrowLeft,
  CheckCircle2,
  Clock as ClockIcon,
  X
} from 'lucide-react';

const CourseViewer: React.FC<{ module: any; onClose: () => void }> = ({ module, onClose }) => {
  return (
    <div className="fixed inset-0 z-[100] bg-white overflow-hidden flex flex-col">
      <div className="bg-[#121c32] p-6 text-white flex items-center justify-between shrink-0">
        <button onClick={onClose} className="flex items-center gap-2 font-bold uppercase text-xs tracking-widest opacity-70 hover:opacity-100 transition-opacity">
          <ArrowLeft size={18} /> Retour
        </button>
        <div className="text-center">
          <p className="text-[10px] font-black text-emerald-400 uppercase tracking-[0.2em]">{module.category}</p>
          <h2 className="text-sm font-black uppercase tracking-tight">{module.title}</h2>
        </div>
        <div className="w-10"></div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 sm:p-12 max-w-4xl mx-auto w-full space-y-10 custom-scrollbar">
        <div className="space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-emerald-50 flex items-center justify-center text-emerald-600">
            {module.icon}
          </div>
          <h1 className="text-3xl font-black text-[#121c32] uppercase leading-tight">{module.title}</h1>
          <div className="flex items-center gap-6 text-xs font-bold text-gray-600 uppercase">
            <span className="flex items-center gap-2"><ClockIcon size={14} /> {module.duration}</span>
            <span className="flex items-center gap-2"><BookOpen size={14} /> {module.lessons} Leçons</span>
          </div>
        </div>

        <div className="prose prose-slate max-w-none">
          {module.fullContent.map((section: any, idx: number) => (
            <div key={idx} className="mb-12 space-y-6">
              <div className="flex items-center gap-4">
                <span className="w-8 h-8 rounded-full bg-[#121c32] text-white flex items-center justify-center text-xs font-black">{idx + 1}</span>
                <h3 className="text-xl font-black text-[#121c32] uppercase tracking-tight m-0">{section.subtitle}</h3>
              </div>
              <div className="bg-gray-50 rounded-3xl p-6 sm:p-8 border border-gray-100">
                <p className="text-gray-800 leading-relaxed text-base whitespace-pre-line font-medium">
                  {section.text}
                </p>
              </div>
            </div>
          ))}
        </div>

        <div className="bg-emerald-50 rounded-3xl p-8 border border-emerald-100 text-center space-y-6">
          <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mx-auto shadow-sm">
            <CheckCircle2 size={32} className="text-emerald-500" />
          </div>
          <div className="space-y-2">
            <h4 className="text-xl font-black text-[#121c32] uppercase">Félicitations !</h4>
            <p className="text-emerald-700 font-medium text-sm">Vous avez terminé la lecture de ce module.</p>
          </div>
          <button onClick={onClose} className="px-8 py-3 bg-emerald-500 text-white rounded-xl font-bold uppercase tracking-widest text-xs shadow-lg shadow-emerald-200 active:scale-95 transition-all">
            Marquer comme terminé
          </button>
        </div>
      </div>
    </div>
  );
};

const EducationSupport: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedModule, setSelectedModule] = useState<any | null>(null);

  const libraryDocs = [
    {
      title: "Guide d'utilisation MicroFoX.pdf",
      category: "MANUEL",
      duration: "15 min",
      lessons: "4 Sections",
      icon: <FileText className="text-blue-500" />,
      fullContent: [
        {
          subtitle: "Introduction à l'Interface",
          text: "Bienvenue sur MicroFoX. Votre application est conçue pour fonctionner en temps réel. La barre latérale est votre outil principal de navigation entre les modules de gestion des membres, de collecte et de comptabilité."
        },
        {
          subtitle: "Gestion des Adhésions",
          text: "Pour chaque nouveau client, assurez-vous de remplir tous les champs d'identification. La capture de la photo et de la signature est une exigence réglementaire pour prévenir l'usurpation d'identité."
        },
        {
          subtitle: "Collecte de Terrain",
          text: "Le module 'Tontine Journalière' permet d'enregistrer les cotisations. En cas de perte de connexion, les données sont stockées localement et synchronisées dès que le réseau est rétabli."
        },
        {
          subtitle: "Rapports & États",
          text: "Vous pouvez exporter les commissions et les journaux au format HTML. Ces rapports sont audités et servent de base aux contrôles périodiques de la direction."
        }
      ]
    },
    {
      title: "Manuel de procédure Tontine.pdf",
      category: "PROCÉDURE",
      duration: "20 min",
      lessons: "3 Chapitres",
      icon: <ClockIcon className="text-emerald-500" />,
      fullContent: [
        {
          subtitle: "Chapitre 1 : Le Cycle Temporel",
          text: "Une tontine MicroFoX est structurée en cycles de 31 jours calendaires. Chaque jour, le membre cotise sa mise définie. Le cycle est considéré comme entamé dès le premier dépôt."
        },
        {
          subtitle: "Chapitre 2 : La Commission Institutionnelle",
          text: "Conformément à la politique de l'institution, la première mise encaissée de chaque cycle est prélevée à titre de commission de gestion. Le solde 'Net' affiché au client tient compte de cette déduction automatique."
        },
        {
          subtitle: "Chapitre 3 : Protocole de Retrait",
          text: "Aucun retrait ne peut être effectué sans une demande préalable validée par le contrôleur de zone. Le contrôleur doit vérifier physiquement le livret du client et signaler tout écart avec le solde système."
        }
      ]
    },
    {
      title: "Réglementation BCEAO 2024.pdf",
      category: "LÉGAL",
      duration: "30 min",
      lessons: "3 Axes",
      icon: <Scale className="text-purple-500" />,
      fullContent: [
        {
          subtitle: "Axe 1 : Conformité KYC",
          text: "La directive 2024 impose une identification stricte des bénéficiaires effectifs. Tout compte sans pièce d'identité valide ou sans photo récente doit être suspendu immédiatement."
        },
        {
          subtitle: "Axe 2 : Ratios de Prudence",
          text: "Les SFD doivent maintenir un ratio de solvabilité minimum. MicroFoX calcule ces ratios automatiquement dans le Tableau de Bord pour aider à la prise de décision prudente."
        },
        {
          subtitle: "Axe 3 : Lutte contre le Blanchiment",
          text: "Toute opération en espèces dépassant le seuil réglementaire doit faire l'objet d'une déclaration d'opération suspecte (DOS) auprès de la CENTIF Togo."
        }
      ]
    }
  ];

  const handleDownload = (docName: string) => {
    const doc = libraryDocs.find(d => d.title === docName);
    if (doc) {
      setSelectedModule(doc);
    }
  };

  const modules = [
    {
      id: 1,
      title: "Réglementation UMOA",
      description: "Maîtriser les normes prudentielles et les exigences de conformité des SFD au Togo.",
      icon: <Scale className="text-blue-500" />,
      lessons: 8,
      duration: "2h 30",
      category: "Légal",
      fullContent: [
        {
          subtitle: "Cadre Juridique Togo/BCEAO",
          text: "La microfinance au Togo est régie par la Loi n°2008-011 portant réglementation des Systèmes Financiers Décentralisés (SFD). Ce cadre définit les conditions d'agrément, de fonctionnement et de surveillance."
        },
        {
          subtitle: "Les Organes de Contrôle",
          text: "Le secteur est supervisé par deux entités majeures :\n- La CAS-IMEC : Cellule d'Appui et de Suivi des Institutions de Microfinance au sein du Ministère de l'Économie.\n- La BCEAO : Banque Centrale des États de l'Afrique de l'Ouest, qui assure la surveillance macro-prudentielle."
        },
        {
          subtitle: "Ratios Prudentiels",
          text: "Pour garantir la pérennité, les SFD doivent respecter des normes strictes :\n- Ratio de liquidité : Doit être supérieur ou égal à 100%.\n- Ratio de solvabilité (fonds propres) : Doit être au moins de 8% des risques encourus.\n- Limitation des prêts à un seul client : Maximum 10% des fonds propres."
        }
      ]
    },
    {
      id: 2,
      title: "Gestion des Risques",
      description: "Identifier, évaluer et mitiger les risques de crédit et opérationnels.",
      icon: <ShieldCheck className="text-emerald-500" />,
      lessons: 5,
      duration: "1h 45",
      category: "Gestion",
      fullContent: [
        {
          subtitle: "Analyse du Risque de Crédit",
          text: "Avant tout octroi, l'agent doit évaluer les '5 C' :\n- Caractère (Honnêteté et antécédents)\n- Capacité (Cash-flow et revenus réels)\n- Capital (Apport personnel)\n- Collateral (Garanties et cautions)\n- Conditions (Environnement économique)"
        },
        {
          subtitle: "Suivi du Portefeuille (PAR)",
          text: "Le Portefeuille à Risque (PAR) est l'indicateur clé. Le PAR 90 (créances en retard de plus de 90 jours) ne doit idéalement pas dépasser 5% de l'encours brut."
        },
        {
          subtitle: "Le Provisionnement",
          text: "Conformément aux normes BCEAO, toute créance en retard doit faire l'objet d'une provision pour perte probable, impactant directement le résultat de l'institution."
        }
      ]
    },
    {
      id: 3,
      title: "Relation Client SFD",
      description: "Techniques d'accueil, de fidélisation et gestion des réclamations en microfinance.",
      icon: <Users className="text-purple-500" />,
      lessons: 6,
      duration: "1h 20",
      category: "Social",
      fullContent: [
        {
          subtitle: "L'Éthique Professionnelle",
          text: "L'agent de terrain doit agir avec intégrité. Il est interdit de percevoir des commissions personnelles ('dessous de table') ou de favoriser certains membres indûment."
        },
        {
          subtitle: "Transparence Financière",
          text: "Le client doit être informé du coût réel de son crédit (TEG) et des conditions de retrait de sa tontine avant toute signature de contrat."
        },
        {
          subtitle: "Gestion des Plaintes",
          text: "Une réclamation est une opportunité d'amélioration. Chaque SFD doit disposer d'un registre de réclamations accessible et d'un processus de réponse rapide (sous 15 jours)."
        }
      ]
    },
    {
      id: 4,
      title: "Sécurité Digitale",
      description: "Protéger les données des membres et sécuriser les transactions mobiles.",
      icon: <BookOpen className="text-amber-500" />,
      lessons: 4,
      duration: "50 min",
      category: "Technique",
      fullContent: [
        {
          subtitle: "Protection des Identifiants",
          text: "Ne partagez jamais vos codes d'accès MicroFoX. Utilisez des mots de passe robustes (mélange de lettres, chiffres et symboles) et changez-les tous les 90 jours."
        },
        {
          subtitle: "Vigilance Terrain",
          text: "Méfiez-vous de l'ingénierie sociale. Ne validez jamais une opération par téléphone sans avoir le livret physique ou la présence du client."
        },
        {
          subtitle: "Intégrité des Données",
          text: "Toutes les saisies effectuées sur l'application sont synchronisées et auditées. Les tentatives de modification de soldes historiques sans justification sont immédiatement détectées par le système."
        }
      ]
    }
  ];

  const tips = [
    {
      title: "Vérification Signature",
      text: "Toujours comparer la signature du livret physique avec celle du dossier numérique avant tout retrait.",
      icon: <Star size={16} className="text-amber-400" />
    },
    {
      title: "Point de Caisse",
      text: "Effectuez un comptage physique de votre caisse au moins deux fois par jour pour éviter les écarts.",
      icon: <Lightbulb size={16} className="text-blue-400" />
    }
  ];

  const filteredModules = modules.filter(m => 
    m.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
    m.category.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-12">
      {selectedModule && (
        <CourseViewer 
          module={selectedModule} 
          onClose={() => setSelectedModule(null)} 
        />
      )}

      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-3xl font-extrabold text-[#121c32] uppercase tracking-tight leading-tight">
            Conseils &<br />Formation
          </h1>
          <p className="text-gray-700 font-medium text-sm">Centre de ressources et d'apprentissage MicroFoX</p>
        </div>
        <div className="relative w-full md:w-80">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-600" size={18} />
          <input 
            type="text" 
            placeholder="Rechercher un cours ou guide..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-12 pr-4 py-3 bg-white border border-emerald-200 rounded-2xl outline-none focus:border-emerald-500 shadow-sm text-sm text-[#121c32] placeholder:text-gray-500"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-black text-[#121c32] uppercase tracking-[0.2em] flex items-center gap-2">
              <PlayCircle size={18} className="text-emerald-500" /> Modules de formation
            </h3>
            <span className="text-[10px] font-bold text-gray-600 uppercase tracking-widest">Contenu rédigé</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {filteredModules.map(module => (
              <div 
                key={module.id} 
                onClick={() => setSelectedModule(module)}
                className="bg-white rounded-[2rem] p-6 border border-gray-100 shadow-sm hover:shadow-md transition-all group cursor-pointer active:scale-95"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="w-12 h-12 rounded-2xl bg-gray-50 flex items-center justify-center group-hover:scale-110 transition-transform">
                    {module.icon}
                  </div>
                  <span className="bg-gray-100 px-2.5 py-1 rounded-lg text-[9px] font-black uppercase text-gray-700 tracking-tighter">
                    {module.category}
                  </span>
                </div>
                <h4 className="text-base font-black text-[#121c32] uppercase tracking-tight group-hover:text-emerald-600 transition-colors">{module.title}</h4>
                <p className="text-xs text-gray-700 mt-2 leading-relaxed">
                  {module.description}
                </p>
                <div className="flex items-center justify-between mt-6 pt-6 border-t border-gray-50">
                  <div className="flex items-center gap-4 text-[10px] font-bold text-gray-600">
                    <span className="flex items-center gap-1"><BookOpen size={14} /> {module.lessons} leçons</span>
                    <span className="flex items-center gap-1 font-black text-[#121c32]">{module.duration}</span>
                  </div>
                  <ChevronRight size={18} className="text-gray-500 group-hover:text-emerald-500 group-hover:translate-x-1 transition-all" />
                </div>
              </div>
            ))}
          </div>

          <div className="bg-[#121c32] rounded-[2.5rem] p-8 text-white relative overflow-hidden shadow-xl">
            <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl -mr-20 -mt-20"></div>
            <div className="relative z-10 space-y-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-emerald-500 rounded-xl"><Star size={20} className="text-white" /></div>
                <h3 className="text-lg font-black uppercase tracking-tight">Certification Agent Certifié</h3>
              </div>
              <p className="text-gray-600 text-sm leading-relaxed max-w-lg">
                Complétez tous les modules obligatoires pour obtenir votre certification interne MicroFoX et valoriser vos compétences en microfinance.
              </p>
              <button 
                onClick={() => alert("Le parcours de certification sera disponible prochainement.")}
                className="px-8 py-3 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-bold text-sm transition-all shadow-lg active:scale-95"
              >
                Commencer le parcours
              </button>
            </div>
          </div>
        </div>

        <div className="space-y-8">
          <div className="bg-white rounded-[2rem] p-8 border border-gray-100 shadow-sm space-y-6">
            <h3 className="text-xs font-black text-[#121c32] uppercase tracking-[0.2em] flex items-center gap-2">
              <Lightbulb size={18} className="text-blue-500" /> Astuces du jour
            </h3>
            <div className="space-y-4">
              {tips.map((tip, i) => (
                <div key={i} className="p-4 bg-gray-50 rounded-2xl space-y-2">
                  <div className="flex items-center gap-2">
                    {tip.icon}
                    <h5 className="text-[10px] font-black text-[#121c32] uppercase tracking-tight">{tip.title}</h5>
                  </div>
                  <p className="text-[11px] text-gray-700 leading-relaxed font-medium">
                    {tip.text}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-[2rem] p-8 border border-gray-100 shadow-sm space-y-6">
            <h3 className="text-xs font-black text-[#121c32] uppercase tracking-[0.2em] flex items-center gap-2">
              <FileText size={18} className="text-purple-500" /> Bibliothèque
            </h3>
            <div className="space-y-2">
              {libraryDocs.map((doc, i) => (
                <div 
                  key={i} 
                  onClick={() => handleDownload(doc.title)}
                  className="flex items-center justify-between p-3 border-b border-gray-50 group cursor-pointer hover:bg-gray-50 rounded-xl transition-all"
                >
                  <div className="flex items-center gap-3">
                    <FileText size={16} className="text-gray-500 group-hover:text-purple-500" />
                    <span className="text-[11px] font-bold text-gray-700 group-hover:text-[#121c32] truncate max-w-[140px]">{doc.title}</span>
                  </div>
                  <Download size={14} className="text-gray-500 group-hover:text-emerald-500" />
                </div>
              ))}
            </div>
          </div>

          <div className="bg-emerald-50 rounded-[2rem] p-8 border border-emerald-100">
            <div className="flex gap-4">
              <GraduationCap className="text-emerald-600 shrink-0" size={24} />
              <div>
                <h4 className="text-[10px] font-black text-emerald-700 uppercase tracking-widest mb-1">Support Pédagogique</h4>
                <p className="text-[11px] text-emerald-600 font-medium leading-relaxed">
                  Des webinaires hebdomadaires sont organisés chaque jeudi à 10h pour répondre à vos questions techniques.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EducationSupport;