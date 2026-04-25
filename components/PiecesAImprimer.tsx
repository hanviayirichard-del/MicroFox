import React, { useState, useEffect } from 'react';
import { Printer, FileText, User, CreditCard, Landmark, Download, Search, Filter, X, CheckCircle2, AlertCircle } from 'lucide-react';

interface PrintableDoc {
  id: string;
  title: string;
  description: string;
  category: 'Membre' | 'Compte' | 'Crédit' | 'Comptabilité';
  icon: React.ReactNode;
}

const PiecesAImprimer: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>('Tous');
  const [members, setMembers] = useState<any[]>([]);
  const [selectedDoc, setSelectedDoc] = useState<PrintableDoc | null>(null);
  const [showMemberSelect, setShowMemberSelect] = useState(false);
  const [memberSearch, setMemberSearch] = useState('');
  const [alertMessage, setAlertMessage] = useState<string | null>(null);
  const [isExport, setIsExport] = useState(false);
  const [showCaisseSelect, setShowCaisseSelect] = useState(false);
  const [selectedCaisse, setSelectedCaisse] = useState<string>('all');

  useEffect(() => {
    const saved = localStorage.getItem('microfox_members_data');
    if (saved) {
      setMembers(JSON.parse(saved));
    }
  }, []);

  const documents: PrintableDoc[] = [
    {
      id: 'carte_membre',
      title: 'Carte de Membre',
      description: 'Générer la carte d\'identité de membre avec photo et QR Code.',
      category: 'Membre',
      icon: <User size={24} />
    },
    {
      id: 'livret_epargne',
      title: 'Livret d\'Épargne',
      description: 'Imprimer les pages du livret d\'épargne pour un client spécifique.',
      category: 'Compte',
      icon: <Landmark size={24} />
    },
    {
      id: 'contrat_credit',
      title: 'Contrat de Crédit',
      description: 'Document contractuel pour le déblocage de fonds.',
      category: 'Crédit',
      icon: <FileText size={24} />
    },
    {
      id: 'tableau_amortissement',
      title: 'Tableau d\'Amortissement',
      description: 'Échéancier de remboursement détaillé pour les crédits.',
      category: 'Crédit',
      icon: <CreditCard size={24} />
    },
    {
      id: 'releve_compte',
      title: 'Relevé de Compte',
      description: 'Historique des transactions sur une période donnée.',
      category: 'Compte',
      icon: <Printer size={24} />
    },
    {
      id: 'bilan_journalier',
      title: 'Bilan Journalier',
      description: 'État récapitulatif des opérations de la journée.',
      category: 'Comptabilité',
      icon: <Download size={24} />
    }
  ];

  const categories = ['Tous', 'Membre', 'Compte', 'Crédit', 'Comptabilité'];

  const filteredDocs = documents.filter(doc => {
    const matchesSearch = doc.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
                         doc.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = activeCategory === 'Tous' || doc.category === activeCategory;
    return matchesSearch && matchesCategory;
  });

  const filteredMembers = members.filter(m => 
    m.name.toLowerCase().includes(memberSearch.toLowerCase()) || 
    m.code.toLowerCase().includes(memberSearch.toLowerCase())
  );

  const handlePrintClick = (doc: PrintableDoc) => {
    setIsExport(false);
    const currentUser = JSON.parse(localStorage.getItem('microfox_current_user') || '{}');
    if (doc.id === 'bilan_journalier') {
      if (currentUser.role === 'administrateur' || currentUser.role === 'directeur') {
        setSelectedDoc(doc);
        setShowCaisseSelect(true);
      } else {
        generatePrint(doc, null, 'my');
      }
    } else {
      setSelectedDoc(doc);
      setShowMemberSelect(true);
    }
  };

  const handleExportClick = (doc: PrintableDoc) => {
    setIsExport(true);
    const currentUser = JSON.parse(localStorage.getItem('microfox_current_user') || '{}');
    if (doc.id === 'bilan_journalier') {
      if (currentUser.role === 'administrateur' || currentUser.role === 'directeur') {
        setSelectedDoc(doc);
        setShowCaisseSelect(true);
      } else {
        generatePrint(doc, null, 'my');
      }
    } else {
      setSelectedDoc(doc);
      setShowMemberSelect(true);
    }
  };

  const generatePrint = (doc: PrintableDoc, member: any | null, caisseFilter: string = 'all') => {
    const mfConfig = JSON.parse(localStorage.getItem('microfox_mf_config') || '{"nom": "MicroFoX", "adresse": "", "telephone": "", "code": ""}');
    
    let content = '';
    const dateStr = new Date().toLocaleDateString('fr-FR');

    switch(doc.id) {
      case 'carte_membre':
        content = `
          <div style="width: 85mm; height: 55mm; border: 2px solid #121c32; border-radius: 10px; padding: 10px; position: relative; overflow: hidden; background: #fff;">
            <div style="display: flex; gap: 10px; border-bottom: 1px solid #eee; padding-bottom: 5px; margin-bottom: 10px;">
              <div style="width: 40px; height: 40px; background: #121c32; border-radius: 5px; display: flex; align-items: center; justify-content: center; color: #fff; font-weight: 900; font-size: 10px;">MF</div>
              <div>
                <h2 style="margin: 0; font-size: 12px; font-weight: 900; color: #121c32; text-transform: uppercase;">${mfConfig.nom}</h2>
                <p style="margin: 0; font-size: 7px; color: #666;">${mfConfig.adresse} | ${mfConfig.telephone}</p>
                <p style="margin: 0; font-size: 8px; color: #666;">CARTE DE MEMBRE OFFICIELLE</p>
              </div>
            </div>
            <div style="display: flex; gap: 15px;">
              <div style="width: 60px; height: 75px; background: #f0f0f0; border: 1px solid #ddd; border-radius: 5px; display: flex; align-items: center; justify-content: center;">
                ${member.photo ? `<img src="${member.photo}" style="width: 100%; height: 100%; object-fit: cover; border-radius: 5px;" />` : '<span style="font-size: 8px; color: #999;">PHOTO</span>'}
              </div>
              <div style="flex: 1;">
                <p style="margin: 0 0 5px 0; font-size: 10px; font-weight: 900; text-transform: uppercase;">${member.name}</p>
                <p style="margin: 0 0 2px 0; font-size: 8px; color: #666;">TONTINE: <strong>${member.tontineAccounts?.[0]?.number || 'N/A'}</strong></p>
                <p style="margin: 0 0 2px 0; font-size: 8px; color: #666;">ÉPARGNE: <strong>${member.epargneAccountNumber || 'N/A'}</strong></p>
                <p style="margin: 0 0 2px 0; font-size: 8px; color: #666;">ADHÉSION: ${new Date(member.adhesionDate || Date.now()).toLocaleDateString()}</p>
                <p style="margin: 0 0 2px 0; font-size: 8px; color: #666;">ZONE: ${member.zone || 'N/A'}</p>
              </div>
            </div>
            <div style="position: absolute; bottom: 10px; right: 10px; width: 40px; height: 40px; background: #eee; border-radius: 5px; display: flex; align-items: center; justify-content: center; font-size: 6px; color: #999;">QR CODE</div>
          </div>
        `;
        break;
      case 'livret_epargne':
        content = `
          <div style="max-width: 800px; margin: 0 auto; padding: 20px; border: 1px solid #eee;">
            <div style="text-align: center; border-bottom: 2px solid #121c32; padding-bottom: 20px; margin-bottom: 30px;">
              <h1 style="margin: 0; font-size: 24px; font-weight: 900; color: #121c32; text-transform: uppercase;">LIVRET D'ÉPARGNE</h1>
              <p style="margin: 5px 0; font-size: 14px; color: #666;">${mfConfig.nom}</p>
              <p style="margin: 2px 0; font-size: 12px; color: #666;">${mfConfig.adresse} | ${mfConfig.telephone}</p>
            </div>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 40px;">
              <div>
                <p style="font-size: 12px; color: #666; margin-bottom: 5px;">TITULAIRE DU COMPTE</p>
                <p style="font-size: 18px; font-weight: 900; margin: 0; text-transform: uppercase;">${member.name}</p>
              </div>
              <div style="text-align: right;">
                <p style="font-size: 12px; color: #666; margin-bottom: 5px;">NUMÉRO DE COMPTE</p>
                <p style="font-size: 18px; font-weight: 900; margin: 0;">${member.epargneAccountNumber || 'N/A'}</p>
              </div>
            </div>
            <table style="width: 100%; border-collapse: collapse;">
              <thead>
                <tr style="background: #f8f9fa;">
                  <th style="border: 1px solid #ddd; padding: 10px; text-align: left; font-size: 12px;">DATE</th>
                  <th style="border: 1px solid #ddd; padding: 10px; text-align: left; font-size: 12px;">LIBELLÉ</th>
                  <th style="border: 1px solid #ddd; padding: 10px; text-align: right; font-size: 12px;">DÉBIT</th>
                  <th style="border: 1px solid #ddd; padding: 10px; text-align: right; font-size: 12px;">CRÉDIT</th>
                  <th style="border: 1px solid #ddd; padding: 10px; text-align: right; font-size: 12px;">SOLDE</th>
                </tr>
              </thead>
              <tbody>
                ${(member.history || []).filter((tx: any) => tx.account === 'epargne').map((tx: any) => `
                  <tr>
                    <td style="border: 1px solid #ddd; padding: 8px; font-size: 11px;">${new Date(tx.date).toLocaleDateString()}</td>
                    <td style="border: 1px solid #ddd; padding: 8px; font-size: 11px;">${tx.description}</td>
                    <td style="border: 1px solid #ddd; padding: 8px; font-size: 11px; text-align: right;">${tx.type === 'retrait' ? tx.amount.toLocaleString() : '-'}</td>
                    <td style="border: 1px solid #ddd; padding: 8px; font-size: 11px; text-align: right;">${tx.type === 'depot' ? tx.amount.toLocaleString() : '-'}</td>
                    <td style="border: 1px solid #ddd; padding: 8px; font-size: 11px; text-align: right; font-weight: bold;">${(tx.balanceAfter || 0).toLocaleString()} F</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        `;
        break;
      case 'bilan_journalier': {
        const today = new Date().toISOString().split('T')[0];
        const currentUser = JSON.parse(localStorage.getItem('microfox_current_user') || '{}');
        
        let reportCaisseName = '';
        if (caisseFilter === 'my') {
          reportCaisseName = currentUser.caisse || (currentUser.role === 'administrateur' ? 'CAISSE PRINCIPALE' : 'N/A');
        } else if (caisseFilter === 'all') {
          reportCaisseName = 'TOUTES LES CAISSES';
        } else {
          reportCaisseName = caisseFilter;
        }
        
        const savedMembers = localStorage.getItem('microfox_members_data');
        const allMembers = savedMembers ? JSON.parse(savedMembers) : [];
        
        const savedUsers = JSON.parse(localStorage.getItem('microfox_users') || '[]');

        let txs: any[] = [];
        allMembers.forEach((m: any) => {
          (m.history || []).forEach((tx: any) => {
            if (tx.date.startsWith(today)) {
              const txUser = savedUsers.find((u: any) => u.id === tx.userId);
              const txCaisse = txUser?.caisse || (txUser?.role === 'administrateur' ? 'CAISSE PRINCIPALE' : 'N/A');

              if (caisseFilter === 'my' && tx.userId !== currentUser.id) return;
              if (caisseFilter !== 'all' && caisseFilter !== 'my' && txCaisse !== caisseFilter) return;
              
              txs.push({ ...tx, memberName: m.name, memberCode: m.code });
            }
          });
        });

        const savedPayments = localStorage.getItem('microfox_agent_payments');
        if (savedPayments) {
          JSON.parse(savedPayments).forEach((p: any) => {
            if (p.status === 'Validé' && p.date.startsWith(today)) {
              if (caisseFilter === 'my' && p.validatorId !== currentUser.id) return;
              if (caisseFilter !== 'all' && caisseFilter !== 'my' && p.caisse !== caisseFilter) return;

              txs.push({
                id: p.id, date: p.date, type: 'depot', amount: p.observedAmount || p.totalAmount,
                description: `Versement Agent: ${p.agentName}`, memberName: 'CAISSE', memberCode: p.caisse || 'N/A', account: 'caisse'
              });
            }
          });
        }

        const savedVault = localStorage.getItem('microfox_vault_transactions');
        if (savedVault) {
          JSON.parse(savedVault).forEach((v: any) => {
            if (v.date.startsWith(today)) {
              if (caisseFilter === 'my' && v.userId !== currentUser.id) return;
              
              const vUser = savedUsers.find((u: any) => u.id === v.userId);
              const vCaisse = vUser?.caisse || (vUser?.role === 'administrateur' ? 'CAISSE PRINCIPALE' : 'N/A');
              if (caisseFilter !== 'all' && caisseFilter !== 'my' && vCaisse !== caisseFilter) return;

              txs.push({
                id: v.id, date: v.date, type: v.type.toLowerCase().includes('appro') ? 'depot' : 'retrait',
                amount: v.amount, description: v.type, memberName: 'COFFRE', memberCode: v.from, account: 'coffre'
              });
            }
          });
        }

        const savedExpenses = localStorage.getItem('microfox_admin_expenses');
        if (savedExpenses) {
          JSON.parse(savedExpenses).filter((e: any) => !e.isDeleted).forEach((e: any) => {
            if (e.date.startsWith(today)) {
              const eUser = savedUsers.find((u: any) => u.identifiant === e.recordedBy);
              const eCaisse = eUser?.caisse || (eUser?.role === 'administrateur' ? 'CAISSE PRINCIPALE' : 'N/A');

              if (caisseFilter === 'my' && e.recordedBy !== currentUser.identifiant) return;
              if (caisseFilter !== 'all' && caisseFilter !== 'my' && eCaisse !== caisseFilter) return;

              txs.push({
                id: e.id, date: e.date, type: 'retrait', amount: e.amount,
                description: `Dépense: ${e.description}`, memberName: 'ADMIN', memberCode: e.recordedBy, account: 'dépense'
              });
            }
          });
        }

        const totalIn = txs.filter(t => ['depot', 'cotisation', 'remboursement'].includes(t.type)).reduce((sum, t) => sum + t.amount, 0);
        const totalOut = txs.filter(t => ['retrait', 'transfert', 'deblocage'].includes(t.type)).reduce((sum, t) => sum + t.amount, 0);

        content = `
          <div style="max-width: 800px; margin: 0 auto; padding: 20px; font-family: 'Segoe UI', sans-serif; color: #121c32;">
            <div style="text-align: center; margin-bottom: 30px; border-bottom: 2px solid #121c32; padding-bottom: 15px;">
              <h1 style="margin: 0; font-size: 22px; font-weight: 900; text-transform: uppercase;">BILAN JOURNALIER - ${dateStr}</h1>
              <p style="margin: 5px 0; font-size: 14px; font-weight: bold; color: #00c896;">${mfConfig.nom}</p>
              <p style="margin: 2px 0; font-size: 12px; color: #666;">${mfConfig.adresse} | ${mfConfig.telephone}</p>
              <p style="margin: 5px 0; font-size: 13px; font-weight: bold; color: #121c32;">Caisse: ${reportCaisseName}</p>
            </div>
            
            <div style="display: flex; justify-content: space-between; gap: 15px; margin-bottom: 30px;">
              <div style="flex: 1; background: #f0fdf4; padding: 15px; border-radius: 15px; border: 1px solid #bbf7d0; text-align: center;">
                <p style="margin: 0; font-size: 10px; font-weight: 900; color: #166534; text-transform: uppercase; letter-spacing: 1px;">Entrées</p>
                <p style="margin: 5px 0 0 0; font-size: 20px; font-weight: 900; color: #15803d;">${totalIn.toLocaleString()} F</p>
              </div>
              <div style="flex: 1; background: #fef2f2; padding: 15px; border-radius: 15px; border: 1px solid #fecaca; text-align: center;">
                <p style="margin: 0; font-size: 10px; font-weight: 900; color: #991b1b; text-transform: uppercase; letter-spacing: 1px;">Sorties</p>
                <p style="margin: 5px 0 0 0; font-size: 20px; font-weight: 900; color: #b91c1c;">${totalOut.toLocaleString()} F</p>
              </div>
              <div style="flex: 1; background: #fffbeb; padding: 15px; border-radius: 15px; border: 1px solid #fef3c7; text-align: center;">
                <p style="margin: 0; font-size: 10px; font-weight: 900; color: #92400e; text-transform: uppercase; letter-spacing: 1px;">Solde Net</p>
                <p style="margin: 5px 0 0 0; font-size: 20px; font-weight: 900; color: #b45309;">${(totalIn - totalOut).toLocaleString()} F</p>
              </div>
            </div>

            <table style="width: 100%; border-collapse: collapse; font-size: 11px; margin-bottom: 30px;">
              <thead>
                <tr style="background: #121c32; color: #fff;">
                  <th style="padding: 12px 10px; text-align: left; text-transform: uppercase; border-radius: 10px 0 0 0;">Heure</th>
                  <th style="padding: 12px 10px; text-align: left; text-transform: uppercase;">Libellé / Client</th>
                  <th style="padding: 12px 10px; text-align: left; text-transform: uppercase;">Compte</th>
                  <th style="padding: 12px 10px; text-align: right; text-transform: uppercase;">Entrée</th>
                  <th style="padding: 12px 10px; text-align: right; text-transform: uppercase; border-radius: 0 10px 0 0;">Sortie</th>
                </tr>
              </thead>
              <tbody>
                ${txs.length > 0 ? txs.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map(t => {
                  const isCredit = ['depot', 'cotisation', 'remboursement'].includes(t.type);
                  return `
                    <tr style="border-bottom: 1px solid #f0f0f0;">
                      <td style="padding: 10px;">${new Date(t.date).toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'})}</td>
                      <td style="padding: 10px;">
                        <div style="font-weight: bold; text-transform: uppercase;">${t.memberName}</div>
                        <div style="font-size: 9px; color: #666;">${t.description}</div>
                      </td>
                      <td style="padding: 10px; text-transform: uppercase; color: #666;">${t.account || 'N/A'}</td>
                      <td style="padding: 10px; text-align: right; color: #15803d; font-weight: 900;">${isCredit ? t.amount.toLocaleString() : '-'}</td>
                      <td style="padding: 10px; text-align: right; color: #b91c1c; font-weight: 900;">${!isCredit ? t.amount.toLocaleString() : '-'}</td>
                    </tr>
                  `;
                }).join('') : `<tr><td colspan="5" style="padding: 30px; text-align: center; color: #999; font-style: italic;">Aucune opération enregistrée aujourd'hui.</td></tr>`}
              </tbody>
            </table>
            
            <div style="margin-top: 50px; display: flex; justify-content: space-between; page-break-inside: avoid;">
              <div style="text-align: center; width: 220px;">
                <p style="font-size: 10px; font-weight: 900; text-transform: uppercase; border-bottom: 2px solid #121c32; padding-bottom: 8px; margin-bottom: 15px;">Le Caissier</p>
                <div style="height: 80px; border: 1px solid #f0f0f0; border-radius: 10px; margin-bottom: 10px;"></div>
                <p style="font-size: 11px; font-weight: bold;">${caisseFilter === 'all' ? 'Multiples' : (currentUser.identifiant || 'N/A')}</p>
              </div>
              <div style="text-align: center; width: 220px;">
                <p style="font-size: 10px; font-weight: 900; text-transform: uppercase; border-bottom: 2px solid #121c32; padding-bottom: 8px; margin-bottom: 15px;">Contrôle Interne</p>
                <div style="height: 80px; border: 1px solid #f0f0f0; border-radius: 10px; margin-bottom: 10px;"></div>
              </div>
            </div>
            
            <div style="margin-top: 40px; text-align: center; font-size: 9px; color: #999; border-top: 1px solid #eee; padding-top: 10px;">
              Document généré par MicroFoX le ${new Date().toLocaleString()}
            </div>
          </div>
        `;
        break;
      }
      default:
        content = `
          <div style="padding: 40px; text-align: center; font-family: sans-serif;">
            <h1 style="color: #121c32;">${doc.title}</h1>
            <p style="color: #666;">Document en cours de préparation pour ${member ? member.name : 'l\'institution'}.</p>
            <p style="font-size: 12px; margin-top: 20px;">Date de génération: ${dateStr}</p>
          </div>
        `;
    }

    if (isExport) {
      const htmlContent = `
        <html>
          <head>
            <meta charset="UTF-8">
            <title>${doc.title} - ${mfConfig.nom}</title>
            <style>
              body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 0; padding: 20px; color: #121c32; }
              table { width: 100%; border-collapse: collapse; }
              th, td { border: 1px solid #ddd; padding: 8px; }
            </style>
          </head>
          <body>
            ${content}
          </body>
        </html>
      `;
      const blob = new Blob([htmlContent], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${doc.id}_${member ? member.code : 'institution'}_${new Date().getTime()}.html`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setShowMemberSelect(false);
      setSelectedDoc(null);
      return;
    }

    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    printWindow.document.write(`
      <html>
        <head>
          <title>${doc.title} - ${mfConfig.nom}</title>
          <style>
            body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 0; padding: 20px; color: #121c32; }
            @media print {
              .no-print { display: none; }
              body { padding: 0; }
            }
          </style>
        </head>
        <body>
          ${content}
          <script>
            window.onload = () => {
              window.print();
              setTimeout(() => window.close(), 500);
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
    setShowMemberSelect(false);
    setSelectedDoc(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-[#121c32] uppercase tracking-tight">Pièces à Imprimer</h1>
          <p className="text-gray-700 text-sm font-medium mt-1">Générez et imprimez vos documents officiels et rapports.</p>
        </div>
      </div>

      <div className="bg-white p-6 rounded-[2rem] border border-gray-100 shadow-sm space-y-6">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
            <input 
              type="text" 
              placeholder="Rechercher un document..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-12 pr-4 py-3 bg-gray-50 border border-transparent focus:border-indigo-200 rounded-2xl outline-none text-sm font-bold text-[#121c32] transition-all"
            />
          </div>
          <div className="flex gap-3 overflow-x-auto pb-2 md:pb-0 no-scrollbar items-center">
            {categories.map(cat => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`rounded-xl text-xs font-black uppercase tracking-widest transition-all whitespace-nowrap ${
                  activeCategory === cat 
                    ? 'px-10 py-4 bg-[#121c32] text-white shadow-lg scale-105' 
                    : 'px-6 py-3 bg-gray-50 text-gray-600 hover:bg-gray-100 opacity-60'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredDocs.map(doc => (
            <div key={doc.id} className="group bg-white border border-gray-100 rounded-[2rem] p-6 hover:shadow-xl hover:border-indigo-100 transition-all duration-300">
              <div className="flex items-start justify-between mb-4">
                <div className="w-12 h-12 rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-600 group-hover:scale-110 transition-transform">
                  {doc.icon}
                </div>
                <span className="px-3 py-1 bg-gray-50 text-gray-600 rounded-full text-[10px] font-black uppercase tracking-widest">
                  {doc.category}
                </span>
              </div>
              <h3 className="text-lg font-black text-[#121c32] mb-2">{doc.title}</h3>
              <p className="text-xs text-gray-600 font-medium mb-6 line-clamp-2">{doc.description}</p>
              <div className="grid grid-cols-2 gap-3">
                <button 
                  onClick={() => handlePrintClick(doc)}
                  className="py-3 bg-[#121c32] text-white rounded-2xl font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 shadow-lg shadow-[#121c32]/10 hover:shadow-xl hover:-translate-y-0.5 transition-all active:scale-95"
                >
                  <Printer size={16} />
                  Imprimer
                </button>
                <button 
                  onClick={() => handleExportClick(doc)}
                  className="py-3 bg-emerald-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/10 hover:shadow-xl hover:-translate-y-0.5 transition-all active:scale-95"
                >
                  <Download size={16} />
                  Exporter
                </button>
              </div>
            </div>
          ))}
        </div>

        {filteredDocs.length === 0 && (
          <div className="py-20 text-center">
            <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <FileText size={40} className="text-gray-300" />
            </div>
            <p className="text-gray-600 font-bold">Aucun document ne correspond à votre recherche.</p>
          </div>
        )}
      </div>

      {/* Modal de sélection de caisse */}
      {showCaisseSelect && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-[2rem] w-full max-w-md p-8 shadow-2xl animate-in fade-in zoom-in duration-200">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-black text-[#121c32] uppercase tracking-tight">Sélectionner la Caisse</h3>
              <button onClick={() => setShowCaisseSelect(false)} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                <X size={24} className="text-gray-400" />
              </button>
            </div>
            
            <div className="space-y-3">
              {[
                { id: 'all', label: 'Toutes les caisses' },
                { id: 'CAISSE PRINCIPALE', label: 'Caisse Principale' },
                { id: 'CAISSE 1', label: 'Caisse 1' },
                { id: 'CAISSE 2', label: 'Caisse 2' }
              ].map(caisse => (
                <button
                  key={caisse.id}
                  onClick={() => {
                    generatePrint(selectedDoc!, null, caisse.id);
                    setShowCaisseSelect(false);
                  }}
                  className="w-full p-4 bg-gray-50 hover:bg-indigo-50 border border-transparent hover:border-indigo-100 rounded-2xl flex items-center justify-between group transition-all"
                >
                  <span className="text-sm font-black text-[#121c32] uppercase">{caisse.label}</span>
                  <CheckCircle2 size={18} className="text-gray-300 group-hover:text-indigo-600 transition-colors" />
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Modal de sélection de membre */}
      {showMemberSelect && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-[2rem] w-full max-w-2xl max-h-[80vh] flex flex-col shadow-2xl animate-in fade-in zoom-in duration-200">
            <div className="p-6 border-b border-gray-100 flex items-center justify-between">
              <div>
                <h3 className="text-xl font-black text-[#121c32] uppercase tracking-tight">Sélectionner un Membre</h3>
                <p className="text-xs text-gray-500 font-bold uppercase mt-1">Document: {selectedDoc?.title}</p>
              </div>
              <button onClick={() => setShowMemberSelect(false)} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                <X size={24} className="text-gray-400" />
              </button>
            </div>
            
            <div className="p-6 border-b border-gray-100">
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                <input 
                  type="text" 
                  placeholder="Rechercher par nom ou code..." 
                  value={memberSearch}
                  onChange={(e) => setMemberSearch(e.target.value)}
                  className="w-full pl-12 pr-4 py-3 bg-gray-50 border border-transparent focus:border-indigo-200 rounded-xl outline-none text-sm font-bold text-[#121c32]"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-3 custom-scrollbar">
              {filteredMembers.length > 0 ? (
                filteredMembers.map(member => (
                  <button
                    key={member.id}
                    onClick={() => generatePrint(selectedDoc!, member)}
                    className="w-full p-4 bg-gray-50 hover:bg-indigo-50 border border-transparent hover:border-indigo-100 rounded-2xl flex items-center justify-between group transition-all"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-indigo-600 font-black shadow-sm">
                        {member.name.charAt(0)}
                      </div>
                      <div className="text-left">
                        <p className="text-sm font-black text-[#121c32] uppercase">{member.name}</p>
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{member.code}</p>
                      </div>
                    </div>
                    <Printer size={18} className="text-gray-300 group-hover:text-indigo-600 transition-colors" />
                  </button>
                ))
              ) : (
                <div className="py-10 text-center opacity-40">
                  <User size={40} className="mx-auto mb-2" />
                  <p className="text-xs font-black uppercase">Aucun membre trouvé</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal d'Alerte */}
      {alertMessage && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[110] flex items-center justify-center p-4">
          <div className="bg-white rounded-[2rem] w-full max-w-md p-8 shadow-2xl animate-in fade-in zoom-in duration-200">
            <div className="flex flex-col items-center text-center space-y-4">
              <div className="w-16 h-16 bg-emerald-50 text-emerald-500 rounded-full flex items-center justify-center">
                <CheckCircle2 size={32} />
              </div>
              <h3 className="text-xl font-black text-[#121c32] uppercase tracking-tight">Information</h3>
              <p className="text-gray-500 font-medium leading-relaxed">{alertMessage}</p>
              <button 
                onClick={() => setAlertMessage(null)}
                className="w-full px-6 py-3 bg-[#121c32] text-white rounded-2xl font-black uppercase text-xs tracking-widest hover:bg-[#1a2947] transition-all active:scale-95 shadow-lg shadow-[#121c32]/20"
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PiecesAImprimer;
