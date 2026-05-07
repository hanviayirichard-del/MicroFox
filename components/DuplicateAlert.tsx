import React, { useState, useEffect } from 'react';
import { AlertTriangle, User, Search, Download } from 'lucide-react';
import { ClientAccount } from '../types';

const DuplicateAlert: React.FC = () => {
  const [duplicates, setDuplicates] = useState<{
    type: 'Épargne' | 'Tontine' | 'Nom';
    number: string;
    clients: { id: string; name: string; code: string; author?: string; date?: string }[];
  }[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    const userStr = localStorage.getItem('microfox_current_user');
    if (userStr) setUser(JSON.parse(userStr));

    const savedMembers = localStorage.getItem('microfox_members_data');
    if (savedMembers) {
      const members: ClientAccount[] = JSON.parse(savedMembers);
      
      const epargneMap: { [key: string]: ClientAccount[] } = {};
      const tontineMap: { [key: string]: { clients: ClientAccount[], zones: string[] } } = {};
      const nameMap: { [key: string]: ClientAccount[] } = {};

      members.forEach(member => {
        if (member.epargneAccountNumber) {
          const epNum = member.epargneAccountNumber.trim().toUpperCase();
          if (!epargneMap[epNum]) epargneMap[epNum] = [];
          epargneMap[epNum].push(member);
        }
        member.tontineAccounts.forEach(acc => {
          const tnNum = acc.number.trim().toUpperCase();
          if (!tontineMap[tnNum]) tontineMap[tnNum] = { clients: [], zones: [] };
          tontineMap[tnNum].clients.push(member);
          if (acc.zone) tontineMap[tnNum].zones.push(acc.zone);
        });
        
        // Robust normalization: remove multiple spaces, trim, uppercase
        const normalizedName = member.name.replace(/\s+/g, ' ').trim().toUpperCase();
        if (normalizedName) {
          if (!nameMap[normalizedName]) nameMap[normalizedName] = [];
          nameMap[normalizedName].push(member);
        }
      });

      const foundDuplicates: any[] = [];
      const currentUser = userStr ? JSON.parse(userStr) : null;
      const userRole = currentUser?.role;
      const userZones = currentUser?.zonesCollecte || (currentUser?.zoneCollecte ? [currentUser.zoneCollecte] : []);

      const isClientInUserZone = (c: ClientAccount) => {
        if (userRole === 'administrateur' || userRole === 'directeur' || userRole === 'auditeur' || userRole === 'contrôleur') return true;
        if (!userZones.length) return true;
        return userZones.includes(c.zone || '');
      };

      const mapClientData = (c: any) => {
        const historyData = c.history?.length > 0 ? c.history : JSON.parse(localStorage.getItem(`microfox_history_${c.id}`) || '[]').slice();
        const sortedHistory = historyData.sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime());
          
        const firstOp = sortedHistory[0]; 
        // Force checking all possible author fields, prioritizing creator
        const author = c.createdBy || firstOp?.cashierName || firstOp?.operator || 'Système';
        const date = c.createdAt || firstOp?.date;

        return { 
          id: c.id, 
          name: c.name, 
          code: c.code,
          author,
          date
        };
      };

      // Filtering logic based on role
      Object.entries(epargneMap).forEach(([num, clients]) => {
        if (clients.length > 1) {
          // Cashier rule: see epargne duplicates
          // Agent rule: see duplicates if any client is in their zone
          const showForRole = userRole === 'caissier' || (userRole === 'agent commercial' ? clients.some(isClientInUserZone) : true);
          
          if (showForRole) {
            foundDuplicates.push({
              type: 'Épargne',
              number: num,
              clients: clients.map(mapClientData)
            });
          }
        }
      });

      Object.entries(tontineMap).forEach(([num, data]) => {
        if (data.clients.length > 1) {
          // Cashier rule: only see epargne (Skip Tontine)
          if (userRole === 'caissier') return;

          // Agent rule: see if any client is in their zone
          const showForRole = userRole === 'agent commercial' 
            ? data.clients.some(isClientInUserZone)
            : true;

          if (showForRole) {
            foundDuplicates.push({
              type: 'Tontine',
              number: num,
              clients: data.clients.map(mapClientData)
            });
          }
        }
      });

      Object.entries(nameMap).forEach(([name, clients]) => {
        if (clients.length > 1) {
          // Cashier rule: only see epargne (Skip Name conflicts if not epargne?)
          // The request says: "Les caissiers verrons les doublons qui concerne des comptes d'épargne."
          // So if it's a NAME duplicate, but they are epargne accounts, should they see it?
          // Usually Name duplicates are for cross-checking. I'll hide it for cashiers if they are not epargne.
          if (userRole === 'caissier') return;

          // Agent rule: see if any client is in their zone
          const showForRole = userRole === 'agent commercial' ? clients.some(isClientInUserZone) : true;

          if (showForRole) {
            foundDuplicates.push({
              type: 'Nom',
              number: name,
              clients: clients.map(mapClientData)
            });
          }
        }
      });

      setDuplicates(foundDuplicates);
    }
  }, []);

  const filteredDuplicates = duplicates.filter(d => 
    d.number.toLowerCase().includes(searchTerm.toLowerCase()) ||
    d.clients.some(c => c.name.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-white uppercase tracking-tight">Rapport des Doublons</h2>
          <p className="text-gray-500 text-sm font-bold uppercase tracking-widest">Analyse des numéros de compte et noms en conflit</p>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
            <input 
              type="text" 
              placeholder="Rechercher un numéro ou un nom..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-4 py-3 bg-white/5 border border-white/5 rounded-2xl text-sm font-medium outline-none focus:border-emerald-500 text-white w-64"
            />
          </div>
        </div>
      </div>

      {filteredDuplicates.length === 0 ? (
        <div className="bg-[#121c32] rounded-[2rem] border border-dashed border-white/10 p-12 text-center">
          <div className="w-20 h-20 bg-emerald-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertTriangle size={40} className="text-emerald-400 opacity-20" />
          </div>
          <h3 className="text-white font-bold text-lg uppercase mb-2">Aucun doublon détecté</h3>
          <p className="text-gray-500 text-sm">Tous les noms et numéros de compte sont uniques dans le système.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {filteredDuplicates.map((dup, idx) => (
            <div key={idx} className="bg-[#121c32] rounded-[2rem] border border-white/5 p-6 shadow-sm hover:border-red-500/30 transition-all">
              <div className="flex items-start justify-between mb-6">
                <div className="flex items-center gap-4">
                  <div className={`p-3 rounded-2xl ${dup.type === 'Épargne' ? 'bg-blue-500/10 text-blue-400' : dup.type === 'Tontine' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-purple-500/10 text-purple-400'}`}>
                    <AlertTriangle size={24} />
                  </div>
                  <div>
                    <h4 className="text-lg font-black text-white uppercase tracking-tight">
                      {dup.type === 'Nom' ? 'Nom Client' : `Compte ${dup.type}`} : <span className="text-red-400">{dup.number}</span>
                    </h4>
                    <p className="text-xs font-bold text-gray-500 uppercase tracking-widest">Utilisé par {dup.clients.length} clients</p>
                  </div>
                </div>
                <span className="px-3 py-1 bg-red-500/10 text-red-400 text-[10px] font-black uppercase rounded-lg border border-red-500/20">Conflit Détecté</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {dup.clients.map((client, cIdx) => (
                  <div key={cIdx} className="bg-white/5 rounded-2xl p-4 border border-white/5 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gray-800 flex items-center justify-center text-gray-400 font-bold">
                      <User size={20} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-1 mb-1">
                        <p className="text-sm font-bold text-white truncate uppercase">{client.name}</p>
                        {client.date && (
                          <span className="text-[9px] font-bold text-emerald-400 bg-emerald-400/10 px-1.5 py-0.5 rounded">
                            {new Date(client.date).toLocaleDateString('fr-FR')}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-[10px] font-bold text-gray-500 uppercase">{client.code}</p>
                        {client.author && (
                          <p className="text-[9px] font-medium text-emerald-500/70 uppercase italic">Par: {client.author}</p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default DuplicateAlert;
