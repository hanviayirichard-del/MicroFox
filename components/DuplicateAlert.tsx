import React, { useState, useEffect } from 'react';
import { AlertTriangle, User, Search, Download } from 'lucide-react';
import { ClientAccount } from '../types';

const DuplicateAlert: React.FC = () => {
  const [duplicates, setDuplicates] = useState<{
    type: 'Épargne' | 'Tontine' | 'Nom';
    number: string;
    clients: { id: string; name: string; code: string; author?: string }[];
  }[]>([]);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    const savedMembers = localStorage.getItem('microfox_members_data');
    if (savedMembers) {
      const members: ClientAccount[] = JSON.parse(savedMembers);
      
      const epargneMap: { [key: string]: ClientAccount[] } = {};
      const tontineMap: { [key: string]: ClientAccount[] } = {};
      const nameMap: { [key: string]: ClientAccount[] } = {};

      members.forEach(member => {
        if (member.epargneAccountNumber) {
          const epNum = member.epargneAccountNumber.trim().toUpperCase();
          if (!epargneMap[epNum]) epargneMap[epNum] = [];
          epargneMap[epNum].push(member);
        }
        member.tontineAccounts.forEach(acc => {
          const tnNum = acc.number.trim().toUpperCase();
          if (!tontineMap[tnNum]) tontineMap[tnNum] = [];
          tontineMap[tnNum].push(member);
        });
        
        // Robust normalization: remove multiple spaces, trim, uppercase
        const normalizedName = member.name.replace(/\s+/g, ' ').trim().toUpperCase();
        if (normalizedName) {
          if (!nameMap[normalizedName]) nameMap[normalizedName] = [];
          nameMap[normalizedName].push(member);
        }
      });

      const foundDuplicates: any[] = [];

      Object.entries(epargneMap).forEach(([num, clients]) => {
        if (clients.length > 1) {
          foundDuplicates.push({
            type: 'Épargne',
            number: num,
            clients: clients.map(c => ({ 
              id: c.id, 
              name: c.name, 
              code: c.code,
              author: c.history?.[0]?.cashierName || 'Système'
            }))
          });
        }
      });

      Object.entries(tontineMap).forEach(([num, clients]) => {
        if (clients.length > 1) {
          foundDuplicates.push({
            type: 'Tontine',
            number: num,
            clients: clients.map(c => ({ 
              id: c.id, 
              name: c.name, 
              code: c.code,
              author: c.history?.[0]?.cashierName || 'Système'
            }))
          });
        }
      });

      Object.entries(nameMap).forEach(([name, clients]) => {
        if (clients.length > 1) {
          foundDuplicates.push({
            type: 'Nom',
            number: name,
            clients: clients.map(c => ({ 
              id: c.id, 
              name: c.name, 
              code: c.code,
              author: c.history?.[0]?.cashierName || 'Système'
            }))
          });
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
                      <p className="text-sm font-bold text-white truncate uppercase">{client.name}</p>
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
