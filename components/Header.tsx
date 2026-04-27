
import React from 'react';
import { Menu, Hexagon, LogOut, Loader2 } from 'lucide-react';
import { User } from '../types';

interface HeaderProps {
  activeSection: string;
  onOpenSidebar: () => void;
  currentUser: User | null;
  onLogout: () => void;
  isSyncing?: boolean;
}

const Header: React.FC<HeaderProps> = ({ activeSection, onOpenSidebar, currentUser, onLogout, isSyncing }) => {
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
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full relative overflow-hidden flex items-center justify-center shrink-0 shadow-lg border border-white/10">
            {/* The "shutter" logo effect with CSS - inspired by user image */}
            <div className="absolute inset-0 bg-gradient-to-tr from-[#3b82f6] via-[#22c55e] to-[#22c55e]"></div>
            <div className="absolute inset-[3px] bg-[#121c32] rounded-full flex items-center justify-center">
              <div className="grid grid-cols-2 gap-0.5">
                <div className="w-0.5 h-0.5 rounded-full bg-blue-400"></div>
                <div className="w-0.5 h-0.5 rounded-full bg-blue-500"></div>
                <div className="w-0.5 h-0.5 rounded-full bg-blue-300"></div>
                <div className="w-0.5 h-0.5 rounded-full bg-emerald-400"></div>
              </div>
            </div>
            {/* Lens flare effect */}
            <div className="absolute top-0 right-0 w-1/2 h-1/2 bg-white/10 rounded-full blur-[1px]"></div>
          </div>
          <span className="text-xl font-bold text-white tracking-tighter">MicroFoX</span>
        </div>
        <span className="text-gray-700">|</span>
        <span className="text-sm font-medium text-gray-300 uppercase tracking-wider">{activeSection}</span>
        {isSyncing && (
          <div className="flex items-center gap-2 ml-4 px-3 py-1 bg-[#00c896]/10 rounded-full border border-[#00c896]/20">
            <Loader2 size={14} className="text-[#00c896] animate-spin" />
            <span className="text-[10px] font-bold text-[#00c896] uppercase tracking-tighter">Synchronisation...</span>
          </div>
        )}
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
