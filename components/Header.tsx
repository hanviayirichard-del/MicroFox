
import React from 'react';
import { Menu, Hexagon, LogOut } from 'lucide-react';
import { User } from '../types';

interface HeaderProps {
  activeSection: string;
  onOpenSidebar: () => void;
  currentUser: User | null;
  onLogout: () => void;
}

const Header: React.FC<HeaderProps> = ({ activeSection, onOpenSidebar, currentUser, onLogout }) => {
  return (
    <header className="bg-[#121c32] border-b border-gray-800 h-16 flex items-center justify-between px-6 shrink-0">
      <div className="flex items-center gap-4">
        <button 
          onClick={onOpenSidebar}
          className="p-2 hover:bg-gray-800 rounded-lg text-gray-400 transition-colors"
          title="Ouvrir le menu"
        >
          <Menu size={24} />
        </button>
        <div className="flex items-center gap-2">
          <Hexagon className="text-[#00c896]" size={28} />
          <span className="text-xl font-bold text-white">MicroFoX</span>
        </div>
        <span className="text-gray-700">|</span>
        <span className="text-sm font-medium text-gray-300 uppercase tracking-wider">{activeSection}</span>
      </div>
      
      <div className="flex items-center gap-6">
        <div className="flex items-center gap-4">
          <div className="flex flex-col items-end">
            <span className="text-[10px] text-gray-500 uppercase font-black tracking-widest">{currentUser?.microfinance || 'Session'}</span>
            <span className="text-sm font-semibold text-gray-200 capitalize">{currentUser?.role || 'Administrateur'}</span>
          </div>
          <div className="w-10 h-10 rounded-full bg-indigo-900/50 flex items-center justify-center text-indigo-300 font-bold border border-indigo-500/30">
            {currentUser ? currentUser.identifiant.substring(0, 2).toUpperCase() : 'AD'}
          </div>
        </div>
        
        <button 
          onClick={onLogout}
          className="p-2 text-gray-400 hover:text-red-400 transition-colors"
          title="Se déconnecter"
        >
          <LogOut size={20} />
        </button>
      </div>
    </header>
  );
};

export default Header;
