import React, { useState, useRef, useEffect } from 'react';
import { recordAuditLog } from '../utils/audit';
import { 
  Search, 
  Plus, 
  History, 
  Wallet, 
  Clock, 
  CreditCard, 
  ShieldCheck, 
  TrendingUp, 
  AlertCircle,
  ArrowUpRight,
  ArrowDownLeft,
  MoreVertical,
  ChevronRight,
  ChevronLeft,
  User,
  X,
  Camera,
  MapPin,
  CheckCircle, 
  ShieldAlert,
  UserPlus,
  Calculator,
  RefreshCw,
  Navigation,
  Trash2,
  Users as UsersIcon,
  LayoutGrid,
  Printer,
  Lock,
  BookOpen,
  PlusCircle,
  Trash,
  Gem,
  Download,
  Calendar,
  ClipboardCheck,
  FileText,
  ChevronUp,
  ChevronDown,
  ArrowRightLeft
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { ClientAccount, TontineAccount, Transaction } from '../types';
import ConfirmModal from './ConfirmModal';

const suggestNextAccountNumber = (type: 'epargne' | 'tontine', currentMembers: ClientAccount[], zone?: string): string => {
  const mfConfig = JSON.parse(localStorage.getItem('microfox_mf_config') || '{"nom": "MicroFoX", "adresse": "", "code": "00001"}');
  const instCode = (mfConfig.code || '00001').padStart(5, '0').substring(0, 5);
  const agencyCode = '00001'; // Default agency code

  if (type === 'epargne') {
    const numbers = currentMembers
      .map(m => m.epargneAccountNumber)
      .filter((n): n is string => !!n && n.length >= 21)
      .map(n => {
        // Extract the 11-digit account part (from index 10 to 21)
        const part = n.substring(10, 21);
        return /^\d+$/.test(part) ? parseInt(part, 10) : 0;
      });
    const max = numbers.length > 0 ? Math.max(...numbers) : 0;
    const nextNum = (max + 1).toString().padStart(11, '0');
    
    // Simple check digit (placeholder logic for BCEAO key)
    const key = (97 - (parseInt(instCode + agencyCode + nextNum) % 97)).toString().padStart(2, '0');
    
    return `${instCode}${agencyCode}${nextNum}${key}`;
  } else {
    // Tontine zone-based: e.g., 02A1, 02A2
    const prefix = zone || '01';
    const numbers = currentMembers
      .flatMap(m => m.tontineAccounts)
      .map(acc => acc.number)
      .filter(n => n.startsWith(prefix))
      .map(n => {
        const suffix = n.substring(prefix.length);
        return /^\d+$/.test(suffix) ? parseInt(suffix, 10) : 0;
      });
    const max = numbers.length > 0 ? Math.max(...numbers) : 0;
    return `${prefix}${max + 1}`;
  }
};

const OperationForm: React.FC<{
  onClose: () => void;
  onSave: (transaction: Omit<Transaction, 'id' | 'date'>, validatedRequestIds?: string[]) => void;
  clientId: string;
  clientName: string;
  epargneAccountNumber?: string;
  tontineAccounts: TontineAccount[];
  initialTontineId?: string;
  creditBalances?: { capital: number; interest: number; penalty: number; total: number };
  partSocialeBalance?: number;
  garantieBalance?: number;
  epargneBalance?: number;
  adhesionPaid?: number;
  livretPaid?: number;
  isEpargneBlockedByAdmin?: boolean;
}> = ({ onClose, onSave, clientId, clientName, epargneAccountNumber, tontineAccounts, initialTontineId, creditBalances, partSocialeBalance, garantieBalance, epargneBalance, adhesionPaid, livretPaid, isEpargneBlockedByAdmin }) => {
  const currentUser = JSON.parse(localStorage.getItem('microfox_current_user') || 'null');
  const [type, setType] = useState<'depot' | 'retrait' | 'remboursement' | 'transfert' | 'deblocage' | 'depot_garantie' | 'retrait_garantie'>('depot');
  const [account, setAccount] = useState<'epargne' | 'garantie' | 'partSociale' | 'credit' | 'tontine'>('epargne');
  const [transferDest, setTransferDest] = useState<'epargne' | 'garantie' | 'partSociale'>('epargne');
  const [rembCapital, setRembCapital] = useState<string>('');
  const [rembInterest, setRembInterest] = useState<string>('');
  const [rembPenalty, setRembPenalty] = useState<string>('');
  const [selectedTontineId, setSelectedTontineId] = useState<string>(initialTontineId || tontineAccounts[0]?.id || '');
  const [amount, setAmount] = useState<string>('');
  const [description, setSearchDescription] = useState('');

  const isEpargneBlocked = (((type !== 'transfert' && account === 'epargne') || (type === 'transfert' && (account === 'epargne' || transferDest === 'epargne'))) && 
                           ((partSocialeBalance || 0) < 1000 || (adhesionPaid || 0) < 2000 || (livretPaid || 0) < 300)) ||
                           (((type !== 'transfert' && account === 'epargne') || (type === 'transfert' && (account === 'epargne' || transferDest === 'epargne'))) && isEpargneBlockedByAdmin);
  
  const selectedTontine = tontineAccounts.find(a => a.id === selectedTontineId);
  const isTontineBlocked = (account === 'tontine' || (type === 'transfert' && account === 'tontine')) && selectedTontine?.isBlocked;
  
  const [validatedRequests, setValidatedRequests] = useState<any[]>([]);
  const [selectedValidatedIds, setSelectedValidatedIds] = useState<string[]>([]);

  useEffect(() => {
    if ((type === 'retrait' || type === 'transfert') && account === 'tontine') {
      const saved = localStorage.getItem('microfox_validated_withdrawals');
      if (saved) {
        const list = JSON.parse(saved);
        const clientRequests = list.filter((r: any) => r.clientId === clientId && !r.isDeleted);
        setValidatedRequests(clientRequests);
      }
    } else {
      setValidatedRequests([]);
      setSelectedValidatedIds([]);
      setAmount('');
    }
  }, [type, account, clientId]);

  useEffect(() => {
    if (type === 'transfert') {
      if (account === 'tontine') setTransferDest('epargne');
      else if (account === 'garantie') setTransferDest('epargne');
      else if (account === 'epargne') setTransferDest('garantie');
    }
  }, [type, account]);

  const handleSelectValidated = (req: any) => {
    const isSelected = selectedValidatedIds.includes(req.id);
    let newIds: string[];
    
    if (isSelected) {
      newIds = selectedValidatedIds.filter(id => id !== req.id);
    } else {
      newIds = [...selectedValidatedIds, req.id];
    }
    
    setSelectedValidatedIds(newIds);
    
    // Calculer le montant total
    const totalAmount = validatedRequests
      .filter(r => newIds.includes(r.id))
      .reduce((sum, r) => sum + r.amount, 0);
    
    setAmount(totalAmount > 0 ? totalAmount.toString() : '');
    
    if (newIds.length > 0) {
      const reasons = validatedRequests
        .filter(r => newIds.includes(r.id))
        .map(r => r.reason)
        .join(', ');
      const actionLabel = type === 'transfert' ? 'Transfert' : 'Retrait';
      setSearchDescription(`${actionLabel} ${account.charAt(0).toUpperCase() + account.slice(1)} Validé (${newIds.length}) - Motifs: ${reasons}`);
    } else {
      setSearchDescription('');
    }
  };

  const handleValidate = () => {
    const isEpargneOp = (type !== 'transfert' && account === 'epargne') || 
                        (type === 'transfert' && (account === 'epargne' || transferDest === 'epargne'));

    if (isEpargneOp) {
      if (isEpargneBlockedByAdmin) {
        alert("Opération impossible : Le compte épargne est bloqué.");
        return;
      }
      if ((partSocialeBalance || 0) < 1000 || (adhesionPaid || 0) < 2000 || (livretPaid || 0) < 300) {
        alert("Opération impossible : Le client doit d'abord s'acquitter du minimum requis (1000 F Part Sociale, 2000 F Adhésion, 300 F Livret) pour utiliser le compte épargne.");
        return;
      }
    }

    if (type === 'deblocage' && !epargneAccountNumber) {
      alert("Opération impossible : Le client ne peut pas bénéficier d'un déblocage de crédit car il n'a pas de compte épargne. Un compte épargne est obligatoire.");
      return;
    }

    if ((account === 'tontine' || (type === 'transfert' && account === 'tontine')) && isTontineBlocked && selectedValidatedIds.length === 0) {
      alert("Opération impossible : Le compte tontine est bloqué.");
      return;
    }

    if (type === 'depot' && account === 'tontine' && currentUser?.role === 'caissier') {
      alert("Opération impossible : Le caissier n'est pas autorisé à effectuer des dépôts tontine.");
      return;
    }

    if ((type === 'retrait' || type === 'retrait_garantie') && account === 'tontine' && selectedValidatedIds.length === 0) {
      alert(`Opération impossible : Aucun retrait ${account} n'est possible sans vérification préalable. Veuillez sélectionner une ou plusieurs demandes validées.`);
      return;
    }

    let numAmount = Number(amount);
    if (type === 'remboursement') {
      numAmount = (Number(rembCapital) || 0) + (Number(rembInterest) || 0) + (Number(rembPenalty) || 0);
    }

    if (!numAmount || numAmount <= 0) {
      alert("Opération impossible : Veuillez saisir un montant valide supérieur à 0.");
      return;
    }

    let finalType = type as any;
    let finalAccount = type === 'remboursement' ? 'credit' : account;

    if (type === 'depot_garantie') {
      finalType = 'depot';
      finalAccount = 'garantie';
    } else if (type === 'retrait_garantie') {
      finalType = 'retrait';
      finalAccount = 'garantie';
    }

    let finalDescription = description;
    
    if (type === 'transfert') {
      finalDescription = description || `Transfert de ${account} vers ${transferDest}`;
    } else if (type === 'remboursement') {
      const details = [];
      if (Number(rembCapital) > 0) details.push(`Cap: ${rembCapital}`);
      if (Number(rembInterest) > 0) details.push(`Int: ${rembInterest}`);
      if (Number(rembPenalty) > 0) details.push(`Pen: ${rembPenalty}`);
      finalDescription = description || `Remboursement Crédit (${details.join(', ')})`;
    } else if (type === 'deblocage') {
      finalDescription = description || `Déblocage de crédit`;
    } else if (type === 'depot_garantie') {
      finalDescription = description || `Dépôt Garantie`;
    } else if (type === 'retrait_garantie') {
      finalDescription = description || `Retrait Garantie`;
    } else {
      finalDescription = description || `${type === 'depot' ? 'Dépôt' : 'Retrait'} sur compte ${account}`;
    }

    onSave({
      type: finalType,
      account: finalAccount as 'epargne' | 'garantie' | 'credit' | 'partSociale' | 'tontine',
      tontineAccountId: (finalAccount === 'tontine' || (type === 'transfert' && account === 'tontine')) ? selectedTontineId : undefined,
      tontineAccountNumber: (finalAccount === 'tontine' || (type === 'transfert' && account === 'tontine')) ? selectedTontine?.number : undefined,
      amount: numAmount,
      description: finalDescription,
      destinationAccount: type === 'transfert' ? transferDest : undefined,
      rembCapital: type === 'remboursement' ? Number(rembCapital) || 0 : undefined,
      rembInterest: type === 'remboursement' ? Number(rembInterest) || 0 : undefined,
      rembPenalty: type === 'remboursement' ? Number(rembPenalty) || 0 : undefined
    }, selectedValidatedIds.length > 0 ? selectedValidatedIds : undefined);
  };

  return (
    <div className="fixed inset-0 z-[70] flex flex-col bg-[#0a1226] overflow-hidden">
      <div className="bg-[#121c32] p-5 flex items-center justify-between text-white shrink-0 z-10 border-b border-white/10">
        <div className="flex items-center gap-4">
          <div className="bg-white/10 p-2 rounded-xl"><Calculator size={24} /></div>
          <div className="flex flex-col">
            <h2 className="text-lg font-black uppercase tracking-tight">NOUVELLE OPÉRATION</h2>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <p className="text-[10px] font-bold text-gray-500 uppercase">{clientName}</p>
              <div className="flex items-center gap-2">
                <span className="text-[8px] px-1.5 py-0.5 bg-emerald-500/20 text-emerald-400 rounded font-black uppercase">EP: {epargneAccountNumber || '---'}</span>
                <span className="text-[8px] px-1.5 py-0.5 bg-blue-500/20 text-blue-400 rounded font-black uppercase">TN: {tontineAccounts[0]?.number || '---'}</span>
              </div>
            </div>
          </div>
        </div>
        <button onClick={onClose} className="bg-white/10 hover:bg-white/20 p-2 rounded-full transition-colors"><X size={24} /></button>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-8 bg-[#0a1226] custom-scrollbar">
        <div className="bg-[#121c32] p-6 rounded-[2rem] shadow-sm border border-white/5 space-y-8">
          <div className="space-y-4">
            <label className="text-[11px] font-black text-gray-500 uppercase tracking-widest flex items-center gap-2">
              <LayoutGrid size={14} /> Type d'opération
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <button 
                onClick={() => { setType('depot'); setAccount('epargne'); }}
                className={`py-5 rounded-2xl font-black text-[10px] uppercase transition-all flex flex-col items-center gap-2 border-2 ${type === 'depot' ? 'bg-emerald-500 border-emerald-400 text-white shadow-lg shadow-emerald-500/20' : 'bg-white/5 border-transparent text-gray-500 hover:bg-white/10 hover:border-white/10'}`}
              >
                <ArrowDownLeft size={20} />
                Dépôt
              </button>
              <button 
                onClick={() => { setType('retrait'); setAccount('epargne'); }}
                className={`py-5 rounded-2xl font-black text-[10px] uppercase transition-all flex flex-col items-center gap-2 border-2 ${type === 'retrait' ? 'bg-red-500 border-red-400 text-white shadow-lg shadow-red-500/20' : 'bg-white/5 border-transparent text-gray-500 hover:bg-white/10 hover:border-white/10'}`}
              >
                <ArrowUpRight size={20} />
                Retrait
              </button>
              <button 
                onClick={() => { setType('depot_garantie'); setAccount('garantie'); }}
                className={`py-5 rounded-2xl font-black text-[10px] uppercase transition-all flex flex-col items-center gap-2 border-2 ${type === 'depot_garantie' ? 'bg-emerald-600 border-emerald-500 text-white shadow-lg shadow-emerald-500/20' : 'bg-white/5 border-transparent text-gray-500 hover:bg-white/10 hover:border-white/10'}`}
              >
                <ShieldCheck size={20} />
                Dépôt Garantie
              </button>
              <button 
                onClick={() => { setType('retrait_garantie'); setAccount('garantie'); }}
                className={`py-5 rounded-2xl font-black text-[10px] uppercase transition-all flex flex-col items-center gap-2 border-2 ${type === 'retrait_garantie' ? 'bg-red-600 border-red-500 text-white shadow-lg shadow-red-500/20' : 'bg-white/5 border-transparent text-gray-500 hover:bg-white/10 hover:border-white/10'}`}
              >
                <ShieldAlert size={20} />
                Retrait Garantie
              </button>
              <button 
                onClick={() => { setType('remboursement'); setAccount('credit'); }}
                className={`py-5 rounded-2xl font-black text-[10px] uppercase transition-all flex flex-col items-center gap-2 border-2 ${type === 'remboursement' ? 'bg-purple-600 border-purple-500 text-white shadow-lg shadow-purple-500/20' : 'bg-white/5 border-transparent text-gray-500 hover:bg-white/10 hover:border-white/10'}`}
              >
                <RefreshCw size={20} />
                Remb.
              </button>
              <button 
                onClick={() => { setType('transfert'); setAccount('tontine'); }}
                className={`py-5 rounded-2xl font-black text-[10px] uppercase transition-all flex flex-col items-center gap-2 border-2 ${type === 'transfert' ? 'bg-blue-600 border-blue-500 text-white shadow-lg shadow-blue-500/20' : 'bg-white/5 border-transparent text-gray-500 hover:bg-white/10 hover:border-white/10'}`}
              >
                <ArrowRightLeft size={20} />
                Transfert
              </button>
            </div>
          </div>

          {type === 'transfert' ? (
            <div className="space-y-6">
              <div className="space-y-2">
                <label className="text-[11px] font-black text-gray-500 uppercase tracking-widest">Compte Source</label>
                <div className="grid grid-cols-3 gap-2">
                  <button 
                    onClick={() => setAccount('tontine')}
                    className={`py-3 rounded-2xl font-black text-[10px] uppercase transition-all ${account === 'tontine' ? 'bg-white text-[#121c32] shadow-lg' : 'bg-white/5 text-gray-500 hover:bg-white/10'}`}
                  >
                    Tontine
                  </button>
                  <button 
                    onClick={() => setAccount('epargne')}
                    className={`py-3 rounded-2xl font-black text-[10px] uppercase transition-all ${account === 'epargne' ? 'bg-white text-[#121c32] shadow-lg' : 'bg-white/5 text-gray-500 hover:bg-white/10'}`}
                  >
                    Épargne
                  </button>
                  <button 
                    onClick={() => setAccount('garantie')}
                    className={`py-3 rounded-2xl font-black text-[10px] uppercase transition-all ${account === 'garantie' ? 'bg-white text-[#121c32] shadow-lg' : 'bg-white/5 text-gray-500 hover:bg-white/10'}`}
                  >
                    Garantie
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-center py-2">
                <div className="bg-gray-100 p-2 rounded-full text-gray-400">
                  <ArrowRightLeft size={20} className="rotate-90" />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[11px] font-black text-gray-500 uppercase tracking-widest">Compte Destination</label>
                <div className="grid grid-cols-3 gap-2">
                  {account === 'garantie' ? (
                    <button 
                      className="col-span-3 py-3 rounded-2xl font-black text-[10px] uppercase bg-white text-[#121c32] shadow-lg"
                    >
                      Épargne
                    </button>
                  ) : account === 'tontine' ? (
                    <>
                      <button 
                        onClick={() => setTransferDest('epargne')}
                        className={`py-3 rounded-2xl font-black text-[10px] uppercase transition-all ${transferDest === 'epargne' ? 'bg-white text-[#121c32] shadow-lg' : 'bg-white/5 text-gray-500 hover:bg-white/10'}`}
                      >
                        Épargne
                      </button>
                      <button 
                        onClick={() => setTransferDest('garantie')}
                        className={`py-3 rounded-2xl font-black text-[10px] uppercase transition-all ${transferDest === 'garantie' ? 'bg-white text-[#121c32] shadow-lg' : 'bg-white/5 text-gray-500 hover:bg-white/10'}`}
                      >
                        Garantie
                      </button>
                    </>
                  ) : (
                    <>
                      <button 
                        onClick={() => setTransferDest('garantie')}
                        className={`py-3 rounded-2xl font-black text-[10px] uppercase transition-all ${transferDest === 'garantie' ? 'bg-white text-[#121c32] shadow-lg' : 'bg-white/5 text-gray-500 hover:bg-white/10'}`}
                      >
                        Garantie
                      </button>
                      <button 
                        onClick={() => setTransferDest('partSociale')}
                        className={`py-3 rounded-2xl font-black text-[10px] uppercase transition-all ${transferDest === 'partSociale' ? 'bg-white text-[#121c32] shadow-lg' : 'bg-white/5 text-gray-500 hover:bg-white/10'}`}
                      >
                        P. Sociale
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          ) : type === 'remboursement' ? (
            <div className="space-y-4">
              {creditBalances && creditBalances.total > 0 && (
                <div className="grid grid-cols-3 gap-2 p-4 bg-purple-50 rounded-2xl border border-purple-100">
                  <div className="text-center">
                    <p className="text-[8px] font-black text-purple-400 uppercase">Solde Cap.</p>
                    <p className="text-xs font-black text-[#121c32]">{Math.round(creditBalances.capital).toLocaleString()} F</p>
                  </div>
                  <div className="text-center border-x border-purple-100">
                    <p className="text-[8px] font-black text-purple-400 uppercase">Solde Int.</p>
                    <p className="text-xs font-black text-blue-600">{Math.round(creditBalances.interest).toLocaleString()} F</p>
                  </div>
                  <div className="text-center">
                    <p className="text-[8px] font-black text-purple-400 uppercase">Solde Pen.</p>
                    <p className="text-xs font-black text-red-500">{Math.round(creditBalances.penalty).toLocaleString()} F</p>
                  </div>
                </div>
              )}
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <label className="text-[11px] font-black text-gray-500 uppercase tracking-widest">Capital à rembourser</label>
                  {creditBalances && (
                    <span className="text-[10px] font-black text-purple-600 uppercase tracking-tighter">
                      Restant: {Math.round(creditBalances.capital).toLocaleString()} F
                    </span>
                  )}
                </div>
                <input 
                  type="number" 
                  value={rembCapital}
                  onChange={(e) => setRembCapital(e.target.value)}
                  placeholder="0"
                  className="w-full p-4 bg-gray-50 border border-gray-200 rounded-2xl text-lg font-black outline-none focus:border-purple-600 transition-all text-black"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <label className="text-[11px] font-black text-gray-500 uppercase tracking-widest">Intérêts</label>
                    {creditBalances && (
                      <span className="text-[9px] font-black text-blue-600 uppercase tracking-tighter">
                        Restant: {Math.round(creditBalances.interest).toLocaleString()} F
                      </span>
                    )}
                  </div>
                  <input 
                    type="number" 
                    value={rembInterest}
                    onChange={(e) => setRembInterest(e.target.value)}
                    placeholder="0"
                    className="w-full p-4 bg-gray-50 border border-gray-200 rounded-2xl text-lg font-black outline-none focus:border-purple-600 transition-all text-black"
                  />
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <label className="text-[11px] font-black text-gray-500 uppercase tracking-widest">Pénalité</label>
                    {creditBalances && (
                      <span className="text-[9px] font-black text-red-500 uppercase tracking-tighter">
                        Restant: {Math.round(creditBalances.penalty).toLocaleString()} F
                      </span>
                    )}
                  </div>
                  <input 
                    type="number" 
                    value={rembPenalty}
                    onChange={(e) => setRembPenalty(e.target.value)}
                    placeholder="0"
                    className="w-full p-4 bg-gray-50 border border-gray-200 rounded-2xl text-lg font-black outline-none focus:border-purple-600 transition-all text-black"
                  />
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <label className="text-[11px] font-black text-gray-500 uppercase tracking-widest">Compte concerné</label>
              <div className="grid grid-cols-3 gap-3">
                <button 
                  onClick={() => setAccount('epargne')}
                  className={`py-3 rounded-2xl font-black text-[10px] uppercase transition-all ${account === 'epargne' ? 'bg-white text-[#121c32] shadow-lg' : 'bg-white/5 text-gray-500 hover:bg-white/10'}`}
                >
                  Épargne
                </button>
                <button 
                  onClick={() => setAccount('garantie')}
                  className={`py-3 rounded-2xl font-black text-[10px] uppercase transition-all ${account === 'garantie' ? 'bg-white text-[#121c32] shadow-lg' : 'bg-white/5 text-gray-500 hover:bg-white/10'}`}
                >
                  Garantie
                </button>
                <button 
                  onClick={() => setAccount('partSociale')}
                  className={`py-3 rounded-2xl font-black text-[10px] uppercase transition-all ${account === 'partSociale' ? 'bg-white text-[#121c32] shadow-lg' : 'bg-white/5 text-gray-500 hover:bg-white/10'}`}
                >
                  P. Sociale
                </button>
                {(type === 'retrait' || (type === 'depot' && currentUser?.role !== 'caissier')) && (
                  <button 
                    onClick={() => setAccount('tontine')}
                    className={`py-3 rounded-2xl font-black text-[10px] uppercase transition-all ${account === 'tontine' ? 'bg-white text-[#121c32] shadow-lg' : 'bg-white/5 text-gray-500 hover:bg-white/10'}`}
                  >
                    Tontine
                  </button>
                )}
              </div>
            </div>
          )}

          {((type === 'retrait' || type === 'transfert') && account === 'tontine' && validatedRequests.length > 0) && (
            <div className="space-y-3 bg-blue-50/50 p-4 rounded-2xl border border-blue-100">
              <label className="text-[11px] font-black text-blue-600 uppercase tracking-widest flex items-center gap-2">
                <ClipboardCheck size={14} /> Demandes validées
              </label>
              <div className="space-y-2">
                {validatedRequests.map(req => (
                  <button
                    key={req.id}
                    onClick={() => handleSelectValidated(req)}
                    className={`w-full p-4 rounded-xl border flex items-center justify-between transition-all ${selectedValidatedIds.includes(req.id) ? 'bg-blue-600 border-blue-600 text-white shadow-md' : 'bg-white border-blue-100 text-[#121c32] hover:bg-blue-50'}`}
                  >
                    <div className="text-left">
                      <p className="text-sm font-black">{req.amount.toLocaleString()} F</p>
                      <p className={`text-[9px] font-bold uppercase ${selectedValidatedIds.includes(req.id) ? 'text-white/70' : 'text-gray-400'}`}>
                        Validé le {new Date(req.validationDate).toLocaleDateString()}
                      </p>
                      {req.gap !== undefined && req.gap !== 0 && (
                        <p className={`text-[9px] font-black uppercase mt-1 ${selectedValidatedIds.includes(req.id) ? 'text-red-200' : 'text-red-500'}`}>
                          Écart: {req.gap > 0 ? '+' : ''}{req.gap.toLocaleString()} F
                        </p>
                      )}
                      {req.report && (
                        <p className={`text-[9px] font-bold italic mt-0.5 ${selectedValidatedIds.includes(req.id) ? 'text-white/80' : 'text-gray-500'}`}>
                          Rapport: {req.report}
                        </p>
                      )}
                    </div>
                    {selectedValidatedIds.includes(req.id) && <CheckCircle size={18} />}
                  </button>
                ))}
              </div>
            </div>
          )}

          {((type === 'transfert' && account === 'tontine') || (type === 'retrait' && account === 'tontine') || (type === 'depot' && account === 'tontine')) && (
            <div className="space-y-2">
              <label className="text-[11px] font-black text-gray-500 uppercase tracking-widest">Sélectionner le compte Tontine</label>
              <select 
                value={selectedTontineId}
                onChange={(e) => setSelectedTontineId(e.target.value)}
                className="w-full p-4 bg-gray-100 border border-gray-300 rounded-2xl outline-none font-bold text-base text-black"
              >
                {tontineAccounts.map(acc => (
                  <option key={acc.id} value={acc.id}>{acc.number} (Mise: {acc.dailyMise} F)</option>
                ))}
              </select>
            </div>
          )}

          {type !== 'remboursement' && (
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <label className="text-[11px] font-black text-gray-500 uppercase tracking-widest">Montant (FCFA)</label>
                {account === 'partSociale' && partSocialeBalance !== undefined && (
                  <span className="text-[10px] font-black text-amber-600 uppercase tracking-tighter">
                    Reste à payer: {Math.max(0, 5000 - partSocialeBalance).toLocaleString()} F
                  </span>
                )}
                {account === 'garantie' && garantieBalance !== undefined && currentUser?.role !== 'agent commercial' && (
                  <span className="text-[10px] font-black text-blue-600 uppercase tracking-tighter">
                    Solde: {garantieBalance.toLocaleString()} F
                  </span>
                )}
                {account === 'epargne' && epargneBalance !== undefined && currentUser?.role !== 'agent commercial' && (
                  <span className="text-[10px] font-black text-emerald-600 uppercase tracking-tighter">
                    Solde: {epargneBalance.toLocaleString()} F
                  </span>
                )}
              </div>
              <input 
                type="number" 
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0"
                readOnly={(type === 'retrait' || type === 'transfert') && account === 'tontine'}
                disabled={((type === 'retrait' || type === 'retrait_garantie' || type === 'transfert') && account === 'tontine' && selectedValidatedIds.length === 0 && validatedRequests.length > 0) || isEpargneBlocked || isTontineBlocked}
                className={`w-full p-6 bg-gray-50 border-2 border-transparent focus:border-emerald-500 rounded-2xl text-3xl font-black outline-none transition-all text-center ${((type === 'retrait' || type === 'retrait_garantie') && account === 'tontine' && selectedValidatedIds.length === 0) || isEpargneBlocked || isTontineBlocked ? 'opacity-50 cursor-not-allowed text-gray-400' : 'text-black'}`}
              />
              {(isEpargneBlocked || isTontineBlocked) && (
                <p className="text-[9px] font-black text-red-500 uppercase tracking-widest text-center mt-2 flex items-center justify-center gap-1">
                  <Lock size={12} /> Compte bloqué
                </p>
              )}
              {((type === 'retrait' || type === 'transfert') && account === 'tontine' && selectedValidatedIds.length === 0 && validatedRequests.length > 0) && (
                <p className="text-[9px] font-black text-red-500 uppercase tracking-widest text-center mt-2 flex items-center justify-center gap-1">
                  <ShieldAlert size={12} /> Sélectionner une ou plusieurs demandes validées obligatoire
                </p>
              )}
              {isEpargneBlocked && (
                <div className="mt-4 p-4 bg-red-50 border border-red-100 rounded-2xl">
                  <p className="text-[10px] font-black text-red-600 uppercase tracking-widest flex items-center gap-2 mb-1">
                    <ShieldAlert size={14} /> Compte Épargne Bloqué
                  </p>
                  <p className="text-[11px] font-bold text-red-500 leading-relaxed">
                    Le client doit d'abord payer :
                    <br />• Min. 1000 F de Part Sociale (Actuel: {partSocialeBalance || 0} F)
                    <br />• Min. 2000 F d'Adhésion (Payé: {adhesionPaid || 0} F)
                    <br />• Min. 300 F de Frais de Livret (Payé: {livretPaid || 0} F)
                  </p>
                </div>
              )}
            </div>
          )}

          <div className="space-y-2">
            <label className="text-[11px] font-black text-gray-500 uppercase tracking-widest">Libellé / Description</label>
            <input 
              type="text" 
              value={description}
              onChange={(e) => setSearchDescription(e.target.value)}
              placeholder="Ex: Dépôt espèces agence"
              className="w-full p-4 bg-white/5 border border-white/10 rounded-2xl text-base text-white font-medium outline-none focus:border-white/20 transition-all"
            />
          </div>

          {/* Operation Summary */}
          <div className="p-5 bg-white/5 rounded-[2rem] border border-white/10 space-y-4">
            <div className="flex items-center gap-3 border-b border-white/5 pb-3">
              <ClipboardCheck size={16} className="text-gray-400" />
              <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Résumé de l'opération</h4>
            </div>
            <div className="grid grid-cols-2 gap-y-3">
              <div className="space-y-1">
                <p className="text-[9px] font-bold text-gray-500 uppercase">Client</p>
                <p className="text-xs font-black text-white uppercase">{clientName}</p>
              </div>
              <div className="space-y-1 text-right">
                <p className="text-[9px] font-bold text-gray-500 uppercase">Comptes</p>
                <div className="flex flex-col items-end">
                  <p className="text-[9px] font-black text-emerald-400 uppercase">EP: {epargneAccountNumber || '---'}</p>
                  <p className="text-[9px] font-black text-blue-400 uppercase">TN: {tontineAccounts[0]?.number || '---'}</p>
                </div>
              </div>
              <div className="space-y-1 text-right">
                <p className="text-[9px] font-bold text-gray-500 uppercase">Type</p>
                <p className={`text-xs font-black uppercase ${type === 'depot' || type === 'depot_garantie' ? 'text-emerald-400' : (type === 'retrait' || type === 'retrait_garantie' ? 'text-red-400' : (type === 'remboursement' ? 'text-purple-400' : 'text-blue-400'))}`}>{type.replace('_', ' ')}</p>
              </div>
              <div className="space-y-1">
                <p className="text-[9px] font-bold text-gray-500 uppercase">Compte</p>
                <p className="text-xs font-black text-white uppercase">{account === 'tontine' ? `Tontine (${selectedTontine?.number})` : account}</p>
              </div>
              <div className="space-y-1 text-right">
                <p className="text-[9px] font-bold text-gray-500 uppercase">Montant Total</p>
                <p className="text-sm font-black text-white">
                  {type === 'remboursement' 
                    ? ((Number(rembCapital) || 0) + (Number(rembInterest) || 0) + (Number(rembPenalty) || 0)).toLocaleString() 
                    : (Number(amount) || 0).toLocaleString()} F
                </p>
              </div>
            </div>
          </div>
        </div>

        <button 
          onClick={handleValidate}
          className={`w-full py-6 rounded-3xl font-black text-xl uppercase tracking-widest flex items-center justify-center gap-4 shadow-xl active:scale-95 transition-all text-white ${type === 'depot' || type === 'depot_garantie' ? 'bg-emerald-500 shadow-emerald-500/20' : (type === 'retrait' || type === 'retrait_garantie' ? 'bg-red-500 shadow-red-500/20' : (type === 'remboursement' ? 'bg-purple-600 shadow-purple-500/20' : (type === 'transfert' ? 'bg-blue-600 shadow-blue-500/20' : (type === 'deblocage' ? 'bg-orange-500 shadow-orange-500/20' : 'bg-gray-400'))))}`}
        >
          <CheckCircle size={24} />
          {type === 'transfert' ? 'Confirmer le transfert' : "Confirmer l'opération"}
        </button>
      </div>
    </div>
  );
};

const RegistrationForm: React.FC<{ 
  onClose: () => void;
  onRegister: (client: ClientAccount) => void;
  capturedPhoto: string | null;
  setCapturedPhoto: (val: string | null) => void;
  capturedSignature: string | null;
  setCapturedSignature: (val: string | null) => void;
}> = ({ onClose, onRegister, capturedPhoto, setCapturedPhoto, capturedSignature, setCapturedSignature }) => {
  const currentUser = JSON.parse(localStorage.getItem('microfox_current_user') || 'null');
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [isSignatureActive, setIsSignatureActive] = useState(false);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  const [stream, setStream] = useState<MediaStream | null>(null);
  
  const [clientName, setClientName] = useState('');
  const [gender, setGender] = useState('Masculin');
  const [birthDate, setBirthDate] = useState('');
  const [birthPlace, setBirthPlace] = useState('');
  const [profession, setProfession] = useState('');
  const [idType, setIdType] = useState('CNI');
  const [idNumber, setIdNumber] = useState('');
  const [nationality, setNationality] = useState('Togolaise');
  const [zone, setZone] = useState(currentUser?.role === 'agent commercial' ? (currentUser?.zoneCollecte || '01') : '01');
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  
  const zones = ['01','01A','02','02A','03','03A','04','04A','05','05A','06','06A','07','07A','08','08A','09','09A'];

  const [tontineNumber, setTontineNumber] = useState('');
  const [tontineMise, setTontineMise] = useState(500);
  
  const [isTontineSelected, setIsTontineSelected] = useState(true);
  const [isEpargneSelected, setIsEpargneSelected] = useState(false);
  const [epargneNumber, setEpargneNumber] = useState('');

  useEffect(() => {
    const savedMembers = localStorage.getItem('microfox_members_data');
    const members: ClientAccount[] = savedMembers ? JSON.parse(savedMembers) : [];

    if (isTontineSelected && !tontineNumber) {
      setTontineNumber(suggestNextAccountNumber('tontine', members, zone));
    }
    if (isEpargneSelected && !epargneNumber) {
      setEpargneNumber(suggestNextAccountNumber('epargne', members));
    }
  }, [zone, isTontineSelected, isEpargneSelected]);
  const [fraisAdhesion, setFraisAdhesion] = useState(2000);
  const [fraisLivret, setFraisLivret] = useState(300);
  const [partSocialePayee, setPartSocialePayee] = useState(5000);
  const [depotInitialEpargne, setDepotInitialEpargne] = useState(0);
  
  const videoRef = useRef<HTMLVideoElement>(null);

  const startCamera = async (target: 'photo' | 'signature', mode: 'user' | 'environment' = facingMode) => {
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: mode } });
      setStream(s);
      if (target === 'photo') {
        setIsCameraActive(true);
        setIsSignatureActive(false);
      } else {
        setIsSignatureActive(true);
        setIsCameraActive(false);
      }
      setFacingMode(mode);
    } catch (err) {
      console.error("Erreur caméra:", err);
      alert("Impossible d'accéder à la caméra.");
    }
  };

  useEffect(() => {
    if ((isCameraActive || isSignatureActive) && videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [isCameraActive, isSignatureActive, stream]);

  const takePhoto = () => {
    if (videoRef.current && videoRef.current.videoWidth > 0) {
      const canvas = document.createElement('canvas');
      canvas.width = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(videoRef.current, 0, 0);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.5);
        if (isCameraActive) {
          setCapturedPhoto(dataUrl);
        } else if (isSignatureActive) {
          setCapturedSignature(dataUrl);
        }
        stopCamera();
      }
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
    setIsCameraActive(false);
    setIsSignatureActive(false);
  };

  const toggleCamera = (e: React.MouseEvent) => {
    e.stopPropagation();
    const newMode = facingMode === 'user' ? 'environment' : 'user';
    const target = isCameraActive ? 'photo' : 'signature';
    stopCamera();
    startCamera(target, newMode);
  };

  const handleLocate = () => {
    if (!navigator.geolocation) {
      alert("La géolocalisation n'est pas supportée par votre navigateur.");
      return;
    }
    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLatitude(position.coords.latitude);
        setLongitude(position.coords.longitude);
        setIsLocating(false);
      },
      (error) => {
        console.error("Erreur géo:", error);
        alert("Impossible d'obtenir votre position.");
        setIsLocating(false);
      },
      { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
    );
  };

  const handleValidate = () => {
    if (!clientName) {
      alert("Le nom complet est obligatoire.");
      return;
    }
    
    if (isTontineSelected && (!tontineNumber || !tontineMise)) {
      alert("Veuillez remplir les informations du compte tontine.");
      return;
    }

    const savedMembers = localStorage.getItem('microfox_members_data');
    const members: ClientAccount[] = savedMembers ? JSON.parse(savedMembers) : [];

    if (isTontineSelected && members.some(m => m.tontineAccounts.some(acc => acc.number === tontineNumber))) {
      const next = suggestNextAccountNumber('tontine', members, zone);
      alert(`Ce numéro de compte tontine est déjà utilisé. Suggestion : ${next}`);
      return;
    }

    if (isEpargneSelected) {
      if (!epargneNumber) {
        alert("Veuillez saisir le numéro de compte épargne.");
        return;
      }
      
      const savedMembers = localStorage.getItem('microfox_members_data');
      const members: ClientAccount[] = savedMembers ? JSON.parse(savedMembers) : [];
      
      if (members.some(m => m.epargneAccountNumber === epargneNumber)) {
        const next = suggestNextAccountNumber('epargne', members);
        alert(`Ce numéro de compte épargne est déjà utilisé. Suggestion : ${next}`);
        return;
      }

      if (partSocialePayee < 1000) {
        alert("Le minimum pour la part sociale à l'ouverture est de 1000 F.");
        return;
      }
      if (fraisAdhesion < 2000) {
        alert("Les frais d'adhésion minimum sont de 2000 F.");
        return;
      }
      if (fraisLivret < 300) {
        alert("Les frais de livret minimum sont de 300 F.");
        return;
      }
    }

    const clientId = Date.now().toString();
    const newTontineAccounts: TontineAccount[] = isTontineSelected ? [{
      id: `${clientId}_tn_0`,
      number: tontineNumber,
      dailyMise: tontineMise,
      balance: 0,
      zone: zone
    }] : [];

    const history: Transaction[] = [];
    if (isEpargneSelected) {
      if (partSocialePayee > 0) {
        history.push({
          id: `ps-${clientId}-${Date.now()}`,
          type: 'depot',
          account: 'partSociale',
          amount: partSocialePayee,
          date: new Date().toISOString(),
          description: 'Paiement part sociale à l\'adhésion',
          userId: currentUser?.id,
          cashierName: currentUser?.identifiant
        });
      }
      if (fraisAdhesion > 0) {
        history.push({
          id: `fa-${clientId}-${Date.now()}`,
          type: 'depot',
          account: 'frais',
          amount: fraisAdhesion,
          date: new Date().toISOString(),
          description: 'Frais d\'adhésion',
          userId: currentUser?.id,
          cashierName: currentUser?.identifiant
        });
      }
      if (fraisLivret > 0) {
        history.push({
          id: `fl-${clientId}-${Date.now()}`,
          type: 'depot',
          account: 'frais',
          amount: fraisLivret,
          date: new Date().toISOString(),
          description: `Vente de Livret Épargne - Agent ${currentUser?.identifiant || 'Système'}`,
          userId: currentUser?.id,
          cashierName: currentUser?.identifiant
        });
      }
      if (depotInitialEpargne > 0) {
        history.push({
          id: `di-${clientId}-${Date.now()}`,
          type: 'depot',
          account: 'epargne',
          amount: depotInitialEpargne,
          date: new Date().toISOString(),
          description: 'Dépôt initial épargne',
          userId: currentUser?.id,
          cashierName: currentUser?.identifiant
        });
      }
    }

    const newClient: ClientAccount = {
      id: clientId,
      name: clientName,
      code: `CLT-${Math.floor(100000 + Math.random() * 900000)}`,
      epargneAccountNumber: isEpargneSelected ? epargneNumber : undefined,
      status: 'Actif',
      balances: {
        epargne: isEpargneSelected ? depotInitialEpargne : 0,
        tontine: 0,
        credit: 0,
        garantie: 0,
        partSociale: isEpargneSelected ? partSocialePayee : 0
      },
      tontineAccounts: newTontineAccounts,
      history: history,
      gender,
      birthDate,
      birthPlace,
      profession,
      idType,
      idNumber,
      nationality,
      photo: capturedPhoto,
      signature: capturedSignature,
      latitude,
      longitude,
      zone
    };
    onRegister(newClient);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-[#0a1226] overflow-hidden">
      <div className="bg-[#005a3c] p-5 flex items-center justify-between text-white shrink-0 z-10 border-b border-white/10">
        <div className="flex items-center gap-4">
          <div className="bg-white/20 p-2 rounded-xl"><UserPlus size={24} /></div>
          <h2 className="text-lg font-black uppercase tracking-tight">NOUVEAU CLIENT</h2>
        </div>
        <button onClick={onClose} className="bg-white/10 hover:bg-white/20 p-2 rounded-full transition-colors"><X size={24} /></button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 custom-scrollbar bg-[#0a1226]">
        <div className="bg-[#121c32] p-4 sm:p-8 rounded-[1.5rem] space-y-6 border border-white/5">
          <div className="flex items-center gap-4">
            <UsersIcon size={24} className="text-blue-400" />
            <h3 className="text-base font-black text-blue-400 uppercase tracking-tight">IDENTITÉ & IDENTIFICATION</h3>
          </div>
          
          <div className="bg-[#0a1226] p-4 sm:p-6 rounded-2xl border border-white/5 shadow-sm space-y-6">
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">NOM COMPLET *</label>
              <input 
                type="text" 
                placeholder="NOM Prénoms" 
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                className="w-full p-4 bg-white/5 border-2 border-gray-800 focus:border-emerald-500 rounded-2xl text-base sm:text-lg font-medium outline-none placeholder:text-gray-600 text-white transition-all" 
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4 sm:gap-6">
              <div className="space-y-2">
                <label className="text-[11px] font-bold text-gray-500 uppercase tracking-widest">GENRE</label>
                <select value={gender} onChange={(e) => setGender(e.target.value)} className="w-full p-4 bg-white/5 border border-gray-800 rounded-2xl outline-none text-white font-bold text-base focus:border-emerald-500 transition-all">
                  <option className="bg-[#121c32]">Masculin</option>
                  <option className="bg-[#121c32]">Féminin</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-[11px] font-bold text-gray-500 uppercase tracking-widest">NÉ(E) LE</label>
                <input type="text" placeholder="JJ/MM/AAAA" value={birthDate} onChange={(e) => setBirthDate(e.target.value)} className="w-full p-4 bg-white/5 border border-gray-800 rounded-2xl outline-none font-bold text-base text-white focus:border-emerald-500 transition-all" />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
              <div className="space-y-2">
                <label className="text-[11px] font-bold text-gray-500 uppercase tracking-widest">Lieu de naissance</label>
                <input type="text" placeholder="Ville / Village" value={birthPlace} onChange={(e) => setBirthPlace(e.target.value)} className="w-full p-4 bg-white/5 border border-gray-800 rounded-2xl outline-none text-base text-white focus:border-emerald-500 transition-all" />
              </div>
              <div className="space-y-2">
                <label className="text-[11px] font-bold text-gray-500 uppercase tracking-widest">Profession</label>
                <input type="text" placeholder="Ex: Revendeuse" value={profession} onChange={(e) => setProfession(e.target.value)} className="w-full p-4 bg-white/5 border border-gray-800 rounded-2xl outline-none text-base text-white focus:border-emerald-500 transition-all" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 sm:gap-6">
              <div className="space-y-2">
                <label className="text-[11px] font-bold text-gray-500 uppercase tracking-widest">Type Pièce</label>
                <select value={idType} onChange={(e) => setIdType(e.target.value)} className="w-full p-4 bg-white/5 border border-gray-800 rounded-2xl outline-none font-bold text-base text-white focus:border-emerald-500 transition-all">
                  <option className="bg-[#121c32]">CNI</option>
                  <option className="bg-[#121c32]">Passeport</option>
                  <option className="bg-[#121c32]">Carte d'électeurs</option>
                  <option className="bg-[#121c32]">Autres</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-[11px] font-bold text-gray-500 uppercase tracking-widest">Numéro Pièce</label>
                <input type="text" value={idNumber} onChange={(e) => setIdNumber(e.target.value)} className="w-full p-4 bg-white/5 border border-gray-800 rounded-2xl outline-none text-base text-white focus:border-emerald-500 transition-all" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 sm:gap-6">
              <div className="space-y-2">
                <label className="text-[11px] font-bold text-gray-500 uppercase tracking-widest">Nationalité</label>
                <input type="text" value={nationality} onChange={(e) => setNationality(e.target.value)} className="w-full p-4 bg-white/5 border border-gray-800 rounded-2xl outline-none text-base text-white focus:border-emerald-500 transition-all" />
              </div>
              <div className="space-y-2">
                <label className="text-[11px] font-bold text-gray-500 uppercase tracking-widest">Zone d'attribution</label>
                <select 
                  value={zone} 
                  onChange={(e) => setZone(e.target.value)}
                  disabled={currentUser?.role === 'agent commercial'}
                  className={`w-full p-4 bg-white/5 border border-gray-800 rounded-2xl outline-none text-white font-bold text-base focus:border-emerald-500 transition-all appearance-none ${currentUser?.role === 'agent commercial' ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  {zones.map(z => <option key={z} value={z} className="bg-[#121c32]">{z}</option>)}
                </select>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[11px] font-bold text-gray-600 uppercase tracking-widest">COORDONNÉES GÉOGRAPHIQUES</label>
              <div className="flex gap-2">
                <div className="flex-1 p-4 bg-gray-100 border border-gray-300 rounded-2xl text-base text-black flex items-center gap-2">
                  <Navigation size={16} className="text-gray-400" />
                  {latitude && longitude ? (
                    <span className="font-bold">{latitude.toFixed(6)}, {longitude.toFixed(6)}</span>
                  ) : (
                    <span className="text-gray-400 italic">Non définies</span>
                  )}
                </div>
                <button 
                  onClick={handleLocate}
                  disabled={isLocating}
                  className={`px-6 rounded-2xl font-black text-[10px] uppercase transition-all flex items-center gap-2 ${isLocating ? 'bg-gray-200 text-gray-400' : 'bg-[#1a4b8c] text-white shadow-lg'}`}
                >
                  {isLocating ? <RefreshCw size={16} className="animate-spin" /> : <MapPin size={16} />}
                  {isLocating ? 'Localisation...' : 'ACTIVER'}
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4">
              <div className="space-y-2">
                <label className="text-[11px] font-black text-gray-500 uppercase tracking-widest text-center block">PHOTO MEMBRE</label>
                <div onClick={() => !isCameraActive && !capturedPhoto && startCamera('photo')} className="border-2 border-dashed border-gray-800 rounded-[2rem] h-48 flex flex-col items-center justify-center gap-3 bg-white/5 hover:bg-white/10 cursor-pointer relative overflow-hidden transition-all group">
                  {capturedPhoto ? (
                    <>
                      <img src={capturedPhoto} alt="Membre" className="absolute inset-0 w-full h-full object-cover" />
                      <button 
                        onClick={(e) => { e.stopPropagation(); setCapturedPhoto(null); }} 
                        className="absolute top-3 right-3 bg-black/50 p-2 rounded-full text-white backdrop-blur-md transition-all active:scale-90 z-30"
                      >
                        <X size={18} />
                      </button>
                    </>
                  ) : isCameraActive ? (
                    <div className="absolute inset-0 bg-black z-20">
                      <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
                      <button onClick={toggleCamera} className="absolute bottom-4 left-4 bg-white/20 p-3 rounded-full text-white backdrop-blur-md transition-all active:scale-90"><RefreshCw size={20} /></button>
                      <button onClick={(e) => { e.stopPropagation(); takePhoto(); }} className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-white p-4 rounded-full shadow-2xl transition-all active:scale-95"><Camera size={28} className="text-[#121c32]" /></button>
                      <button onClick={(e) => { e.stopPropagation(); stopCamera(); }} className="absolute top-3 right-3 bg-black/50 p-2 rounded-full text-white"><X size={18} /></button>
                    </div>
                  ) : (
                    <>
                      <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center text-gray-600 group-hover:text-blue-400 transition-colors">
                        <Camera size={32} />
                      </div>
                      <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Capturer Photo</span>
                    </>
                  )}
                </div>
              </div>
              
              <div className="space-y-2">
                <label className="text-[11px] font-black text-gray-500 uppercase tracking-widest text-center block">SIGNATURE MEMBRE</label>
                <div onClick={() => !isSignatureActive && !capturedSignature && startCamera('signature')} className="border-2 border-dashed border-gray-800 rounded-[2rem] h-48 flex flex-col items-center justify-center gap-3 bg-white/5 hover:bg-white/10 cursor-pointer relative overflow-hidden transition-all group">
                  {capturedSignature ? (
                    <>
                      <img src={capturedSignature} alt="Signature" className="absolute inset-0 w-full h-full object-cover" />
                      <button 
                        onClick={(e) => { e.stopPropagation(); setCapturedSignature(null); }} 
                        className="absolute top-3 right-3 bg-black/50 p-2 rounded-full text-white backdrop-blur-md transition-all active:scale-90 z-30"
                      >
                        <X size={18} />
                      </button>
                    </>
                  ) : isSignatureActive ? (
                    <div className="absolute inset-0 bg-black z-20">
                      <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
                      <button onClick={toggleCamera} className="absolute bottom-4 left-4 bg-white/20 p-3 rounded-full text-white backdrop-blur-md transition-all active:scale-90"><RefreshCw size={20} /></button>
                      <button onClick={(e) => { e.stopPropagation(); takePhoto(); }} className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-white p-4 rounded-full shadow-2xl transition-all active:scale-95"><Camera size={28} className="text-[#121c32]" /></button>
                      <button onClick={(e) => { e.stopPropagation(); stopCamera(); }} className="absolute top-3 right-3 bg-black/50 p-2 rounded-full text-white"><X size={18} /></button>
                    </div>
                  ) : (
                    <>
                      <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center text-gray-600 group-hover:text-emerald-400 transition-colors">
                        <Camera size={32} />
                      </div>
                      <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Capturer Signature</span>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        <section className="space-y-4">
          <div className="bg-[#e2f9f0] p-5 sm:p-6 rounded-2xl flex items-center gap-3">
            <Wallet size={24} className="text-[#005a3c]" />
            <h3 className="text-lg font-black text-[#005a3c] uppercase tracking-tight">COMPTES & PRODUITS</h3>
          </div>
          
          <div className="space-y-4 border border-gray-200 p-5 sm:p-6 rounded-2xl bg-white shadow-sm">
            <div className="bg-[#f0fdf4] border-2 border-[#00c896] rounded-3xl p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <input 
                    type="checkbox" 
                    checked={isTontineSelected} 
                    onChange={() => setIsTontineSelected(!isTontineSelected)}
                    className="w-6 h-6 accent-[#00c896]" 
                  />
                  <h4 className="text-xl font-black text-[#121c32] uppercase">COMPTE TONTINE</h4>
                </div>
              </div>
              
              {isTontineSelected && (
                <div className="space-y-4 pl-10 pt-2 border-t border-emerald-100">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-[11px] font-black text-gray-800 uppercase tracking-tight">NUMÉRO TONTINE</label>
                      <input 
                        type="text" 
                        value={tontineNumber}
                        onChange={(e) => setTontineNumber(e.target.value)}
                        className="w-full p-4 bg-white border border-gray-300 rounded-xl outline-none text-base text-black" 
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[11px] font-black text-gray-800 uppercase tracking-tight">MISE (F)</label>
                      <input 
                        type="number" 
                        value={tontineMise}
                        onChange={(e) => setTontineMise(Number(e.target.value))}
                        className="w-full p-4 bg-white border border-gray-300 rounded-xl outline-none font-black text-lg text-black" 
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {currentUser?.role !== 'agent commercial' && (
              <div className="bg-[#fdf4ff] border-2 border-[#a855f7] rounded-3xl p-6 space-y-4">
                <div className="flex items-center gap-4">
                  <input 
                    type="checkbox" 
                    checked={isEpargneSelected} 
                    onChange={() => setIsEpargneSelected(!isEpargneSelected)}
                    className="w-6 h-6 accent-[#a855f7]" 
                  />
                  <h4 className="text-xl font-black text-[#121c32] uppercase">COMPTE ÉPARGNE</h4>
                </div>
                {isEpargneSelected && (
                  <div className="space-y-4 pl-10 pt-2 border-t border-purple-100">
                    <div className="space-y-1">
                      <label className="text-[11px] font-black text-gray-800 uppercase tracking-tight">NUMÉRO ÉPARGNE *</label>
                      <input 
                        type="text" 
                        value={epargneNumber}
                        onChange={(e) => setEpargneNumber(e.target.value)}
                        className="w-full p-4 bg-white border border-gray-300 rounded-xl outline-none text-base text-black" 
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="text-[11px] font-black text-gray-800 uppercase tracking-tight">ADHÉSION (F)</label>
                        <input 
                          type="number" 
                          value={fraisAdhesion}
                          onChange={(e) => setFraisAdhesion(Number(e.target.value))}
                          className="w-full p-4 bg-gray-50 border border-gray-200 rounded-xl outline-none font-bold text-black" 
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[11px] font-black text-gray-800 uppercase tracking-tight">LIVRET (F)</label>
                        <input 
                          type="number" 
                          value={fraisLivret}
                          onChange={(e) => setFraisLivret(Number(e.target.value))}
                          className="w-full p-4 bg-gray-50 border border-gray-200 rounded-xl outline-none font-bold text-black" 
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="text-[11px] font-black text-gray-800 uppercase tracking-tight">PART SOCIALE (F)</label>
                        <input 
                          type="number" 
                          value={partSocialePayee}
                          onChange={(e) => setPartSocialePayee(Number(e.target.value))}
                          className="w-full p-4 bg-white border border-gray-300 rounded-xl outline-none font-black text-[#a855f7]" 
                        />
                        <p className="text-[9px] font-bold text-gray-400 uppercase">Min: 1000 F / Total: 5000 F</p>
                      </div>
                      <div className="space-y-1">
                        <label className="text-[11px] font-black text-gray-800 uppercase tracking-tight">DÉPÔT INITIAL (F)</label>
                        <input 
                          type="number" 
                          value={depotInitialEpargne}
                          onChange={(e) => setDepotInitialEpargne(Number(e.target.value))}
                          className="w-full p-4 bg-white border border-gray-300 rounded-xl outline-none font-black text-emerald-600" 
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </section>

        <div className="pt-4 pb-4">
          <button 
            onClick={handleValidate} 
            className="w-full bg-[#005a3c] text-white py-4 sm:py-6 rounded-3xl font-black text-base sm:text-xl uppercase tracking-widest flex items-center justify-center gap-4 shadow-xl active:scale-95 transition-all"
          >
            VALIDER L'INSCRIPTION
          </button>
        </div>
        
        <div className="h-40"></div>
      </div>
    </div>
  );
};

const EditProfileForm: React.FC<{
  client: ClientAccount;
  onSave: (updated: ClientAccount) => void;
}> = ({ client, onSave }) => {
  const [formData, setFormData] = useState<Partial<ClientAccount>>({ ...client });
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(client.photo || null);
  const [capturedSignature, setCapturedSignature] = useState<string | null>(client.signature || null);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const zones = ['01','01A','02','02A','03','03A','04','04A','05','05A','06','06A','07','07A','08','08A','09','09A'];
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [isSignatureActive, setIsSignatureActive] = useState(false);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  const [stream, setStream] = useState<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const user = localStorage.getItem('microfox_current_user');
    if (user) setCurrentUser(JSON.parse(user));
  }, []);

  const startCamera = async (target: 'photo' | 'signature', mode: 'user' | 'environment' = facingMode) => {
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: mode } });
      setStream(s);
      if (target === 'photo') { setIsCameraActive(true); setIsSignatureActive(false); }
      else { setIsSignatureActive(true); setIsCameraActive(false); }
      setFacingMode(mode);
    } catch (err) { alert("Impossible d'accéder à la caméra."); }
  };

  useEffect(() => {
    if ((isCameraActive || isSignatureActive) && videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [isCameraActive, isSignatureActive, stream]);

  const takePhoto = () => {
    if (videoRef.current && videoRef.current.videoWidth > 0) {
      const canvas = document.createElement('canvas');
      canvas.width = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(videoRef.current, 0, 0);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.5);
        if (isCameraActive) setCapturedPhoto(dataUrl);
        else if (isSignatureActive) setCapturedSignature(dataUrl);
        stopCamera();
      }
    }
  };

  const stopCamera = () => {
    if (stream) { stream.getTracks().forEach(track => track.stop()); setStream(null); }
    setIsCameraActive(false); setIsSignatureActive(false);
  };

  const toggleCamera = (e: React.MouseEvent) => {
    e.stopPropagation();
    const newMode = facingMode === 'user' ? 'environment' : 'user';
    const target = isCameraActive ? 'photo' : 'signature';
    stopCamera();
    startCamera(target, newMode);
  };

  const handleUpdate = () => {
    if (!formData.name) { alert("Le nom est obligatoire."); return; }
    onSave({ ...client, ...formData, photo: capturedPhoto, signature: capturedSignature } as ClientAccount);
  };

  return (
    <div className="bg-[#121c32] rounded-[2.5rem] border border-white/5 shadow-sm">
      <div className="p-5 sm:p-10 space-y-12">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
          <div className="space-y-8">
            <div className="flex items-center gap-3 border-b border-white/5 pb-3">
              <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-400"><User size={18}/></div>
              <h3 className="text-xs font-black text-white uppercase tracking-[0.2em]">Informations Générales</h3>
            </div>
            
            <div className="space-y-2">
              <label className="text-[11px] font-black text-gray-500 uppercase tracking-widest ml-1">Nom Complet *</label>
              <input type="text" value={formData.name || ''} onChange={(e) => setFormData({...formData, name: e.target.value})} className="w-full p-4 bg-white/5 border-2 border-transparent focus:border-blue-500 rounded-2xl font-bold text-white outline-none transition-all" />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-[11px] font-black text-gray-500 uppercase tracking-widest ml-1">Genre</label>
                <select value={formData.gender || 'Masculin'} onChange={(e) => setFormData({...formData, gender: e.target.value})} className="w-full p-4 bg-white/5 border-2 border-transparent focus:border-blue-500 rounded-2xl font-bold text-white outline-none transition-all">
                  <option className="bg-[#121c32]">Masculin</option><option className="bg-[#121c32]">Féminin</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-[11px] font-black text-gray-500 uppercase tracking-widest ml-1">Né(e) le</label>
                <input type="text" value={formData.birthDate || ''} onChange={(e) => setFormData({...formData, birthDate: e.target.value})} className="w-full p-4 bg-white/5 border-2 border-transparent focus:border-blue-500 rounded-2xl font-bold text-white outline-none transition-all" />
              </div>
            </div>
            
            <div className="space-y-2">
              <label className="text-[11px] font-black text-gray-500 uppercase tracking-widest ml-1">Lieu de naissance</label>
              <input type="text" value={formData.birthPlace || ''} onChange={(e) => setFormData({...formData, birthPlace: e.target.value})} className="w-full p-4 bg-white/5 border-2 border-transparent focus:border-blue-500 rounded-2xl font-bold text-white outline-none transition-all" />
            </div>
            
            <div className="space-y-2">
              <label className="text-[11px] font-black text-gray-500 uppercase tracking-widest ml-1">Profession</label>
              <input type="text" value={formData.profession || ''} onChange={(e) => setFormData({...formData, profession: e.target.value})} className="w-full p-4 bg-white/5 border-2 border-transparent focus:border-blue-500 rounded-2xl font-bold text-white outline-none transition-all" />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-[11px] font-black text-gray-500 uppercase tracking-widest ml-1">Type Pièce</label>
                <select value={formData.idType || 'CNI'} onChange={(e) => setFormData({...formData, idType: e.target.value})} className="w-full p-4 bg-white/5 border-2 border-transparent focus:border-blue-500 rounded-2xl font-bold text-white outline-none transition-all">
                  <option className="bg-[#121c32]">CNI</option><option className="bg-[#121c32]">Passeport</option><option className="bg-[#121c32]">Carte d'électeurs</option><option className="bg-[#121c32]">Autres</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-[11px] font-black text-gray-500 uppercase tracking-widest ml-1">Numéro Pièce</label>
                <input type="text" value={formData.idNumber || ''} onChange={(e) => setFormData({...formData, idNumber: e.target.value})} className="w-full p-4 bg-white/5 border-2 border-transparent focus:border-blue-500 rounded-2xl font-bold text-white outline-none transition-all" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-[11px] font-black text-gray-500 uppercase tracking-widest ml-1">Nationalité</label>
                <input type="text" value={formData.nationality || ''} onChange={(e) => setFormData({...formData, nationality: e.target.value})} className="w-full p-4 bg-white/5 border-2 border-transparent focus:border-blue-500 rounded-2xl font-bold text-white outline-none transition-all" />
              </div>
              <div className="space-y-2">
                <label className="text-[11px] font-black text-gray-500 uppercase tracking-widest ml-1">Zone d'attribution</label>
                <select 
                  value={formData.zone || '01'} 
                  onChange={(e) => setFormData({...formData, zone: e.target.value})}
                  disabled={currentUser?.role === 'agent commercial'}
                  className={`w-full p-4 bg-white/5 border-2 border-transparent focus:border-blue-500 rounded-2xl font-bold text-white outline-none transition-all appearance-none ${currentUser?.role === 'agent commercial' ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  {zones.map(z => <option key={z} value={z} className="bg-[#121c32]">{z}</option>)}
                </select>
              </div>
            </div>

            {formData.tontineAccounts && formData.tontineAccounts.length > 0 && (
              <div className="space-y-2">
                <label className="text-[11px] font-black text-gray-500 uppercase tracking-widest ml-1">Numéro Tontine</label>
                <input 
                  type="text" 
                  value={formData.tontineAccounts[0].number} 
                  onChange={(e) => {
                    const newAccs = [...(formData.tontineAccounts || [])];
                    newAccs[0] = { ...newAccs[0], number: e.target.value };
                    setFormData({ ...formData, tontineAccounts: newAccs });
                  }} 
                  className="w-full p-4 bg-white/5 border-2 border-transparent focus:border-emerald-500 rounded-2xl font-bold text-white outline-none transition-all" 
                />
              </div>
            )}

            <div className="space-y-2">
              <label className="text-[11px] font-black text-gray-500 uppercase tracking-widest ml-1">Coordonnées Géographiques</label>
              <div className="flex gap-2">
                <div className="flex-1 p-4 bg-white/5 border border-gray-800 rounded-2xl text-sm font-bold text-white flex items-center gap-2">
                  <Navigation size={14} className="text-gray-500" />
                  {formData.latitude && formData.longitude ? (
                    <span>{formData.latitude.toFixed(6)}, {formData.longitude.toFixed(6)}</span>
                  ) : (
                    <span className="text-gray-600 italic">Non définies</span>
                  )}
                </div>
                <button 
                  onClick={() => {
                    if (!navigator.geolocation) return;
                    navigator.geolocation.getCurrentPosition((pos) => {
                      setFormData({...formData, latitude: pos.coords.latitude, longitude: pos.coords.longitude});
                    });
                  }}
                  className="px-4 bg-blue-500/10 text-blue-400 rounded-2xl font-black text-[10px] uppercase border border-blue-500/20 hover:bg-blue-500/20 transition-all flex items-center gap-2"
                >
                  <MapPin size={14} /> Mettre à jour
                </button>
              </div>
            </div>

            {currentUser?.role === 'administrateur' && (
              <div className="space-y-8 pt-6 border-t border-white/5">
                <div className="flex items-center gap-3 border-b border-white/5 pb-3">
                  <div className="w-8 h-8 rounded-lg bg-red-500/10 flex items-center justify-center text-red-400"><ShieldAlert size={18}/></div>
                  <h3 className="text-xs font-black text-white uppercase tracking-[0.2em]">Paramètres de Sécurité (Admin)</h3>
                </div>

                <div className="space-y-4">
                  <div className="p-4 bg-white/5 rounded-2xl border border-white/5 space-y-4">
                    <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest">Compte Épargne</p>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Lock size={14} className="text-gray-500" />
                        <span className="text-xs font-bold text-gray-300">Bloquer le compte</span>
                      </div>
                      <button 
                        onClick={() => setFormData({...formData, isEpargneBlocked: !formData.isEpargneBlocked})}
                        className={`w-12 h-6 rounded-full transition-all relative ${formData.isEpargneBlocked ? 'bg-red-500' : 'bg-gray-700'}`}
                      >
                        <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${formData.isEpargneBlocked ? 'right-1' : 'left-1'}`} />
                      </button>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <AlertCircle size={14} className="text-gray-500" />
                        <span className="text-xs font-bold text-gray-300">Rendre invisible</span>
                      </div>
                      <button 
                        onClick={() => setFormData({...formData, isEpargneInvisible: !formData.isEpargneInvisible})}
                        className={`w-12 h-6 rounded-full transition-all relative ${formData.isEpargneInvisible ? 'bg-amber-500' : 'bg-gray-700'}`}
                      >
                        <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${formData.isEpargneInvisible ? 'right-1' : 'left-1'}`} />
                      </button>
                    </div>
                  </div>

                  {formData.tontineAccounts && formData.tontineAccounts.map((acc, idx) => (
                    <div key={acc.id} className="p-4 bg-white/5 rounded-2xl border border-white/5 space-y-4">
                      <p className="text-[10px] font-black text-emerald-400 uppercase tracking-widest">Compte Tontine: {acc.number}</p>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Lock size={14} className="text-gray-500" />
                          <span className="text-xs font-bold text-gray-300">Bloquer le compte</span>
                        </div>
                        <button 
                          onClick={() => {
                            const newAccs = [...(formData.tontineAccounts || [])];
                            newAccs[idx] = { ...newAccs[idx], isBlocked: !newAccs[idx].isBlocked };
                            setFormData({ ...formData, tontineAccounts: newAccs });
                          }}
                          className={`w-12 h-6 rounded-full transition-all relative ${acc.isBlocked ? 'bg-red-500' : 'bg-gray-700'}`}
                        >
                          <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${acc.isBlocked ? 'right-1' : 'left-1'}`} />
                        </button>
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <AlertCircle size={14} className="text-gray-500" />
                          <span className="text-xs font-bold text-gray-300">Rendre invisible</span>
                        </div>
                        <button 
                          onClick={() => {
                            const newAccs = [...(formData.tontineAccounts || [])];
                            newAccs[idx] = { ...newAccs[idx], isInvisible: !newAccs[idx].isInvisible };
                            setFormData({ ...formData, tontineAccounts: newAccs });
                          }}
                          className={`w-12 h-6 rounded-full transition-all relative ${acc.isInvisible ? 'bg-amber-500' : 'bg-gray-700'}`}
                        >
                          <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${acc.isInvisible ? 'right-1' : 'left-1'}`} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="space-y-8">
            <div className="flex items-center gap-3 border-b border-white/5 pb-3">
              <div className="w-8 h-8 rounded-lg bg-red-500/10 flex items-center justify-center text-red-400"><CreditCard size={18}/></div>
              <h3 className="text-xs font-black text-white uppercase tracking-[0.2em]">Informations Dossier Crédit</h3>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-[11px] font-black text-gray-500 uppercase tracking-widest ml-1">Instructeur</label>
                <input type="text" value={formData.dossierInstruitPar || ''} onChange={(e) => setFormData({...formData, dossierInstruitPar: e.target.value})} className="w-full p-4 bg-white/5 border-2 border-transparent focus:border-red-500 rounded-2xl font-bold text-white outline-none transition-all" />
              </div>
              <div className="space-y-2">
                <label className="text-[11px] font-black text-gray-500 uppercase tracking-widest ml-1">Durée</label>
                <input type="text" value={formData.dureeCredit || ''} onChange={(e) => setFormData({...formData, dureeCredit: e.target.value})} className="w-full p-4 bg-white/5 border-2 border-transparent focus:border-red-500 rounded-2xl font-bold text-white outline-none transition-all" />
              </div>
            </div>
            
            <div className="space-y-2">
              <label className="text-[11px] font-black text-gray-500 uppercase tracking-widest ml-1">Nom de la Caution</label>
              <input type="text" value={formData.nomCaution || ''} onChange={(e) => setFormData({...formData, nomCaution: e.target.value})} className="w-full p-4 bg-white/5 border-2 border-transparent focus:border-red-500 rounded-2xl font-bold text-white outline-none transition-all" />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-[11px] font-black text-gray-500 uppercase tracking-widest ml-1">Adresse</label>
                <input type="text" value={formData.adresseCaution || ''} onChange={(e) => setFormData({...formData, adresseCaution: e.target.value})} className="w-full p-4 bg-white/5 border-2 border-transparent focus:border-red-500 rounded-2xl font-bold text-white outline-none transition-all" />
              </div>
              <div className="space-y-2">
                <label className="text-[11px] font-black text-gray-500 uppercase tracking-widest ml-1">Tél. Caution</label>
                <input type="text" value={formData.telCaution || ''} onChange={(e) => setFormData({...formData, telCaution: e.target.value})} className="w-full p-4 bg-white/5 border-2 border-transparent focus:border-red-500 rounded-2xl font-bold text-white outline-none transition-all" />
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-[11px] font-black text-gray-500 uppercase tracking-widest ml-1">Référence Caution</label>
                <input type="text" value={formData.refCaution || ''} onChange={(e) => setFormData({...formData, refCaution: e.target.value})} className="w-full p-4 bg-white/5 border-2 border-transparent focus:border-red-500 rounded-2xl font-bold text-white outline-none transition-all" />
              </div>
              <div className="space-y-2">
                <label className="text-[11px] font-black text-gray-500 uppercase tracking-widest ml-1">Tél. Référence</label>
                <input type="text" value={formData.telRefCaution || ''} onChange={(e) => setFormData({...formData, telRefCaution: e.target.value})} className="w-full p-4 bg-white/5 border-2 border-transparent focus:border-red-500 rounded-2xl font-bold text-white outline-none transition-all" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-6 pt-4 border-t border-white/5">
              <div className="space-y-2">
                <label className="text-[11px] font-black text-gray-500 uppercase tracking-widest text-center block">PHOTO MEMBRE</label>
                <div onClick={() => !isCameraActive && startCamera('photo')} className="border-2 border-dashed border-gray-800 rounded-[2rem] h-48 flex flex-col items-center justify-center gap-3 bg-white/5 hover:bg-white/10 cursor-pointer relative overflow-hidden transition-all group">
                  {capturedPhoto ? (
                    <>
                      <img src={capturedPhoto} className="absolute inset-0 w-full h-full object-cover" />
                      <button 
                        onClick={(e) => { e.stopPropagation(); setCapturedPhoto(null); }} 
                        className="absolute top-3 right-3 bg-black/50 p-2 rounded-full text-white backdrop-blur-md transition-all active:scale-90 z-30"
                      >
                        <X size={18} />
                      </button>
                    </>
                  ) : isCameraActive ? (
                    <div className="absolute inset-0 bg-black z-20">
                      <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover"/>
                      <button onClick={toggleCamera} className="absolute bottom-4 left-4 bg-white/20 p-3 rounded-full text-white backdrop-blur-md transition-all active:scale-90"><RefreshCw size={20} /></button>
                      <button onClick={(e) => {e.stopPropagation(); takePhoto();}} className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-white p-4 rounded-full shadow-2xl transition-all active:scale-95"><Camera size={28} className="text-[#121c32]"/></button>
                      <button onClick={(e) => { e.stopPropagation(); stopCamera(); }} className="absolute top-3 right-3 bg-black/50 p-2 rounded-full text-white"><X size={18} /></button>
                    </div>
                  ) : (
                    <>
                      <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center text-gray-600 group-hover:text-blue-400 transition-colors">
                        <Camera size={32} />
                      </div>
                      <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Capturer Photo</span>
                    </>
                  )}
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-[11px] font-black text-gray-500 uppercase tracking-widest text-center block">SIGNATURE MEMBRE</label>
                <div onClick={() => !isSignatureActive && startCamera('signature')} className="border-2 border-dashed border-gray-800 rounded-[2rem] h-48 flex flex-col items-center justify-center gap-3 bg-white/5 hover:bg-white/10 cursor-pointer relative overflow-hidden transition-all group">
                  {capturedSignature ? (
                    <>
                      <img src={capturedSignature} className="absolute inset-0 w-full h-full object-cover" />
                      <button 
                        onClick={(e) => { e.stopPropagation(); setCapturedSignature(null); }} 
                        className="absolute top-3 right-3 bg-black/50 p-2 rounded-full text-white backdrop-blur-md transition-all active:scale-90 z-30"
                      >
                        <X size={18} />
                      </button>
                    </>
                  ) : isSignatureActive ? (
                    <div className="absolute inset-0 bg-black z-20">
                      <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover"/>
                      <button onClick={toggleCamera} className="absolute bottom-4 left-4 bg-white/20 p-3 rounded-full text-white backdrop-blur-md transition-all active:scale-90"><RefreshCw size={20} /></button>
                      <button onClick={(e) => { e.stopPropagation(); takePhoto();}} className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-white p-4 rounded-full shadow-2xl transition-all active:scale-95"><Camera size={28} className="text-[#121c32]"/></button>
                      <button onClick={(e) => { e.stopPropagation(); stopCamera(); }} className="absolute top-3 right-3 bg-black/50 p-2 rounded-full text-white"><X size={18} /></button>
                    </div>
                  ) : (
                    <>
                      <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center text-gray-600 group-hover:text-emerald-400 transition-colors">
                        <Camera size={32} />
                      </div>
                      <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Capturer Signature</span>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {currentUser?.role !== 'agent commercial' && currentUser?.role !== 'caissier' && (
          <div className="pt-6">
            <button onClick={handleUpdate} className="w-full py-6 bg-[#121c32] text-white rounded-[1.5rem] font-black uppercase tracking-widest shadow-xl active:scale-95 transition-all flex items-center justify-center gap-3 hover:bg-black">
              <CheckCircle size={24} className="text-emerald-400" /> Mettre à jour le dossier client
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

const AddTontineModal: React.FC<{ 
  onClose: () => void; 
  onSave: (info: { number: string; mise: number; zone: string }) => void;
}> = ({ onClose, onSave }) => {
  const currentUser = JSON.parse(localStorage.getItem('microfox_current_user') || 'null');
  const [number, setNumber] = useState('');
  const [mise, setMise] = useState(500);
  const [zone, setZone] = useState(currentUser?.role === 'agent commercial' ? (currentUser?.zoneCollecte || '01') : '01');

  useEffect(() => {
    const savedMembers = localStorage.getItem('microfox_members_data');
    const members: ClientAccount[] = savedMembers ? JSON.parse(savedMembers) : [];
    
    if (!number) {
      setNumber(suggestNextAccountNumber('tontine', members, zone));
    }
  }, [zone]);

  const zones = ['01','01A','02','02A','03','03A','04','04A','05','05A','06','06A','07','07A','08','08A','09','09A'];

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center bg-black/80 p-4 backdrop-blur-sm overflow-y-auto">
      <div className="bg-[#121c32] rounded-[2rem] w-full max-w-md overflow-hidden shadow-2xl border border-white/10 my-4 sm:my-8">
        <div className="bg-[#0a1226] p-6 text-white flex items-center justify-between border-b border-white/10">
          <div className="flex items-center gap-3">
            <PlusCircle size={24} className="text-emerald-400" />
            <h3 className="text-lg font-black uppercase tracking-tight">Nouveau compte tontine</h3>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full"><X size={20} /></button>
        </div>
        <div className="p-8 space-y-6">
          <div className="space-y-2">
            <label className="text-[11px] font-black text-gray-500 uppercase tracking-widest">Numéro du compte</label>
            <input 
              type="text" 
              value={number} 
              onChange={(e) => setNumber(e.target.value)}
              placeholder="Ex: TN-1234"
              className="w-full p-4 bg-white/5 border border-gray-800 rounded-2xl outline-none focus:border-[#00c896] font-bold text-white"
            />
          </div>
          <div className="space-y-2">
            <label className="text-[11px] font-black text-gray-500 uppercase tracking-widest">Zone d'attribution</label>
            <select 
              value={zone} 
              onChange={(e) => setZone(e.target.value)}
              className="w-full p-4 bg-white/5 border border-gray-800 rounded-2xl outline-none focus:border-[#00c896] font-bold text-white appearance-none"
            >
              {zones.map(z => <option key={z} value={z} className="bg-[#121c32]">{z}</option>)}
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-[11px] font-black text-gray-500 uppercase tracking-widest">Mise journalière (F)</label>
            <input 
              type="number" 
              value={mise} 
              onChange={(e) => setMise(Number(e.target.value))}
              className="w-full p-4 bg-white/5 border border-gray-800 rounded-2xl outline-none focus:border-[#00c896] font-black text-2xl text-white"
            />
          </div>
          <button 
            onClick={() => {
              if (!number || !mise) {
                alert("Veuillez remplir tous les champs.");
                return;
              }
              
              const savedMembers = localStorage.getItem('microfox_members_data');
              const members: ClientAccount[] = savedMembers ? JSON.parse(savedMembers) : [];
              
              if (members.some(m => m.tontineAccounts.some(acc => acc.number === number))) {
                const next = suggestNextAccountNumber('tontine', members, zone);
                alert(`Ce numéro de compte tontine est déjà utilisé. Suggestion : ${next}`);
                return;
              }

              onSave({ number, mise, zone });
            }} 
            className="w-full py-5 bg-[#00c896] text-white rounded-2xl font-black uppercase tracking-widest shadow-lg active:scale-95 transition-all"
          >
            Créer le compte
          </button>
        </div>
      </div>
    </div>
  );
};

const EditTontineModal: React.FC<{ 
  onClose: () => void; 
  onSave: (info: { number: string; zone: string }) => void;
  initialNumber: string;
  initialZone: string;
}> = ({ onClose, onSave, initialNumber, initialZone }) => {
  const currentUser = JSON.parse(localStorage.getItem('microfox_current_user') || 'null');
  const [number, setNumber] = useState(initialNumber);
  const [zone, setZone] = useState(currentUser?.role === 'agent commercial' ? (currentUser?.zoneCollecte || initialZone || '01') : (initialZone || '01'));

  const zones = ['01','01A','02','02A','03','03A','04','04A','05','05A','06','06A','07','07A','08','08A','09','09A'];

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center bg-black/80 p-4 backdrop-blur-sm overflow-y-auto">
      <div className="bg-[#121c32] rounded-[2rem] w-full max-w-md overflow-hidden shadow-2xl border border-white/10 my-4 sm:my-8">
        <div className="bg-[#0a1226] p-6 text-white flex items-center justify-between border-b border-white/10">
          <div className="flex items-center gap-3">
            <RefreshCw size={24} className="text-blue-400" />
            <h3 className="text-lg font-black uppercase tracking-tight">Modifier compte tontine</h3>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full"><X size={20} /></button>
        </div>
        <div className="p-8 space-y-6">
          <div className="space-y-2">
            <label className="text-[11px] font-black text-gray-500 uppercase tracking-widest">Numéro du compte</label>
            <input 
              type="text" 
              value={number} 
              onChange={(e) => setNumber(e.target.value)}
              placeholder="Ex: TN-1234"
              className="w-full p-4 bg-white/5 border border-gray-800 rounded-2xl outline-none focus:border-[#00c896] font-bold text-white"
            />
          </div>
          <div className="space-y-2">
            <label className="text-[11px] font-black text-gray-500 uppercase tracking-widest">Zone d'attribution</label>
            <select 
              value={zone} 
              onChange={(e) => setZone(e.target.value)}
              className="w-full p-4 bg-white/5 border border-gray-800 rounded-2xl outline-none focus:border-[#00c896] font-bold text-white appearance-none"
            >
              {zones.map(z => <option key={z} value={z} className="bg-[#121c32]">{z}</option>)}
            </select>
          </div>
          <button 
            onClick={() => {
              if (!number) {
                alert("Le numéro de compte est obligatoire.");
                return;
              }
              
              if (number !== initialNumber) {
                const savedMembers = localStorage.getItem('microfox_members_data');
                const members: ClientAccount[] = savedMembers ? JSON.parse(savedMembers) : [];
                
                if (members.some(m => m.tontineAccounts.some(acc => acc.number === number))) {
                  const next = suggestNextAccountNumber('tontine', members, zone);
                  alert(`Ce numéro de compte tontine est déjà utilisé. Suggestion : ${next}`);
                  return;
                }
              }

              onSave({ number, zone });
            }} 
            className="w-full py-5 bg-blue-600 text-white rounded-2xl font-black uppercase tracking-widest shadow-lg active:scale-95 transition-all"
          >
            Mettre à jour
          </button>
        </div>
      </div>
    </div>
  );
};

const OpenEpargneModal: React.FC<{
  onClose: () => void;
  onSave: (info: { number: string; adhesion: number; livret: number; partSociale: number; depot: number }) => void;
}> = ({ onClose, onSave }) => {
  const [number, setNumber] = useState('');
  const [adhesion, setAdhesion] = useState(2000);
  const [livret, setLivret] = useState(300);
  const [partSociale, setPartSociale] = useState(5000);
  const [depot, setDepot] = useState(0);

  useEffect(() => {
    const savedMembers = localStorage.getItem('microfox_members_data');
    const members: ClientAccount[] = savedMembers ? JSON.parse(savedMembers) : [];
    
    if (!number) {
      setNumber(suggestNextAccountNumber('epargne', members));
    }
  }, []);

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center bg-black/80 p-4 backdrop-blur-sm overflow-y-auto">
      <div className="bg-[#121c32] rounded-[2rem] w-full max-w-md overflow-hidden shadow-2xl border border-white/10 my-4 sm:my-8">
        <div className="bg-[#0a1226] p-6 text-white flex items-center justify-between border-b border-white/10">
          <div className="flex items-center gap-3">
            <PlusCircle size={24} className="text-blue-400" />
            <h3 className="text-lg font-black uppercase tracking-tight">Ouvrir un compte épargne</h3>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full"><X size={20} /></button>
        </div>
        <div className="p-8 space-y-4">
          <div className="space-y-1">
            <label className="text-[11px] font-black text-gray-500 uppercase tracking-widest">Numéro Épargne *</label>
            <input 
              type="text" 
              value={number} 
              onChange={(e) => setNumber(e.target.value)}
              placeholder="Ex: EP-1234"
              className="w-full p-3 bg-white/5 border border-gray-800 rounded-xl outline-none focus:border-blue-500 font-bold text-white"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-[11px] font-black text-gray-500 uppercase tracking-widest">Adhésion (F)</label>
              <input type="number" value={adhesion} onChange={(e) => setAdhesion(Number(e.target.value))} className="w-full p-3 bg-white/5 border border-gray-800 rounded-xl outline-none font-bold text-white" />
            </div>
            <div className="space-y-1">
              <label className="text-[11px] font-black text-gray-500 uppercase tracking-widest">Livret (F)</label>
              <input type="number" value={livret} onChange={(e) => setLivret(Number(e.target.value))} className="w-full p-3 bg-white/5 border border-gray-800 rounded-xl outline-none font-bold text-white" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-[11px] font-black text-gray-500 uppercase tracking-widest">Part Sociale (F)</label>
              <input type="number" value={partSociale} onChange={(e) => setPartSociale(Number(e.target.value))} className="w-full p-3 bg-white/5 border border-gray-800 rounded-xl outline-none font-black text-blue-400" />
              <p className="text-[9px] font-bold text-gray-600 uppercase">Min: 1000 F</p>
            </div>
            <div className="space-y-1">
              <label className="text-[11px] font-black text-gray-500 uppercase tracking-widest">Dépôt Initial (F)</label>
              <input type="number" value={depot} onChange={(e) => setDepot(Number(e.target.value))} className="w-full p-3 bg-white/5 border border-gray-800 rounded-xl outline-none font-black text-emerald-400" />
            </div>
          </div>
          <button 
            onClick={() => { 
              if(!number) { alert("Numéro de compte obligatoire"); return; }

              const savedMembers = localStorage.getItem('microfox_members_data');
              const members: ClientAccount[] = savedMembers ? JSON.parse(savedMembers) : [];
              
              if (members.some(m => m.epargneAccountNumber === number)) {
                const next = suggestNextAccountNumber('epargne', members);
                alert(`Ce numéro de compte épargne est déjà utilisé. Suggestion : ${next}`);
                return;
              }

              if(partSociale < 1000) { alert("Part sociale minimum: 1000 F"); return; }
              if(adhesion < 2000) { alert("Frais d'adhésion minimum: 2000 F"); return; }
              if(livret < 300) { alert("Frais de livret minimum: 300 F"); return; }
              onSave({ number, adhesion, livret, partSociale, depot }); 
            }}
            className="w-full py-4 bg-blue-600 text-white rounded-xl font-black uppercase tracking-widest shadow-lg active:scale-95 transition-all mt-4"
          >
            Confirmer l'ouverture
          </button>
        </div>
      </div>
    </div>
  );
};

const Members: React.FC = () => {
  const [clients, setClients] = useState<ClientAccount[]>(() => {
    const saved = localStorage.getItem('microfox_members_data');
    let loadedClients: ClientAccount[] = [];
    
    if (saved) {
      loadedClients = JSON.parse(saved);
    } else {
      loadedClients = [
        {
          id: '1',
          name: 'KOFFI Ama Gertrude',
          code: 'CLT-001254',
          epargneAccountNumber: 'EP-44201',
          status: 'Actif',
          balances: { epargne: 0, tontine: 0, credit: 0, garantie: 0, partSociale: 0 },
          creditStatus: 'Sain',
          tontineAccounts: [{ id: '1_tn_0', number: 'TN-8829-01', dailyMise: 500, balance: 0 }],
          history: [],
          gender: 'Féminin', nationality: 'Togolaise', profession: 'Revendeuse',
          dossierInstruitPar: 'Agent de Crédit Principal', dureeCredit: '3 Mois'
        },
        { id: '2', name: 'MENSAH Yao Jean', code: 'CLT-001289', epargneAccountNumber: 'EP-99102', status: 'Actif', balances: { epargne: 0, tontine: 0, credit: 0, garantie: 0, partSociale: 0 }, creditStatus: 'Sain', tontineAccounts: [], history: [], gender: 'Masculin', nationality: 'Togolaise' }
      ];
    }

    // Ensure history is loaded for each client if it's empty in the main array
    return loadedClients.map(c => {
      if (!c.history || c.history.length === 0) {
        const savedHistory = localStorage.getItem(`microfox_history_${c.id}`);
        if (savedHistory) {
          return { ...c, history: JSON.parse(savedHistory) };
        }
      }
      return c;
    });
  });

  const [pendingWithdrawals, setPendingWithdrawals] = useState<any[]>([]);

  useEffect(() => {
    const loadPending = () => {
      const saved = localStorage.getItem('microfox_pending_withdrawals');
      if (saved) setPendingWithdrawals(JSON.parse(saved));
    };
    window.addEventListener('storage', loadPending);
    loadPending();
    return () => window.removeEventListener('storage', loadPending);
  }, []);

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedZone, setSelectedZone] = useState<string>('all');
  const [showActiveOnly, setShowActiveOnly] = useState<boolean>(false);
  const [selectedClientId, setSelectedClientId] = useState<string | null>('1');
  const selectedClient = clients.find(c => c.id === selectedClientId);
  const [isHeaderVisible, setIsHeaderVisible] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'epargne' | 'tontine' | 'credit' | 'garantie' | 'partSociale' | 'profile' | 'current_credit' | 'credit_archives'>('overview');
  const [tontineSubTab, setTontineSubTab] = useState<'journal' | 'cases'>('cases');
  const [selectedTontineId, setSelectedTontineId] = useState<string | null>(null);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(false);

  useEffect(() => {
    // Only auto-collapse sidebar on mobile/tablet when a tab is selected
    if (activeTab !== 'overview' && window.innerWidth < 1024) {
      setIsSidebarCollapsed(true);
      setIsHeaderVisible(false);
    } else if (activeTab === 'overview') {
      setIsSidebarCollapsed(false);
      setIsHeaderVisible(true);
    }
  }, [activeTab]);

  const handleBackToOverview = () => {
    setActiveTab('overview');
  };
  const [showRegistrationForm, setShowRegistrationForm] = useState<boolean>(false);
  const [showOperationForm, setShowOperationForm] = useState<boolean>(false);
  const [showAddTontineModal, setShowAddTontineModal] = useState<boolean>(false);
  const [showEditTontineModal, setShowEditTontineModal] = useState<boolean>(false);
  const [showOpenEpargneModal, setShowOpenEpargneModal] = useState<boolean>(false);
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    type: 'confirm' | 'alert' | 'success' | 'error';
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
    type: 'confirm'
  });

  const showAlert = (title: string, message: string, type: 'alert' | 'success' | 'error' = 'alert') => {
    setConfirmModal({
      isOpen: true,
      title,
      message,
      onConfirm: () => setConfirmModal(prev => ({ ...prev, isOpen: false })),
      type
    });
  };

  const showConfirm = (title: string, message: string, onConfirm: () => void) => {
    setConfirmModal({
      isOpen: true,
      title,
      message,
      onConfirm: onConfirm,
      type: 'confirm'
    });
  };
  const [isActionsOpen, setIsActionsOpen] = useState<boolean>(false);
  const [isEditingCredit, setIsEditingCredit] = useState<boolean>(false);
  const [creditFormData, setCreditFormData] = useState<any>({});
  
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);
  const [capturedSignature, setCapturedSignature] = useState<string | null>(null);

  const [journalStartDate, setJournalStartDate] = useState<string>('');
  const [journalEndDate, setJournalEndDate] = useState<string>('');
  const [currentUser, setCurrentUser] = useState<any>(null);

  useEffect(() => {
    const user = localStorage.getItem('microfox_current_user');
    if (user) setCurrentUser(JSON.parse(user));
  }, []);

  useEffect(() => {
    if (currentUser?.role === 'agent commercial') {
      const agentZones = currentUser.zonesCollecte || (currentUser.zoneCollecte ? [currentUser.zoneCollecte] : []);
      if (agentZones.length > 0) {
        setSelectedZone(agentZones[0]);
      }
    }
  }, [currentUser]);

  const cyclesListRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (selectedClient && selectedClient.tontineAccounts.length > 0) {
      const visibleTontines = selectedClient.tontineAccounts.filter(a => !a.isInvisible || currentUser?.role === 'administrateur');
      const currentIsVisible = selectedClient.tontineAccounts.find(a => a.id === selectedTontineId && (!a.isInvisible || currentUser?.role === 'administrateur'));
      
      if (!selectedTontineId || !currentIsVisible) {
        if (visibleTontines.length > 0) {
          setSelectedTontineId(visibleTontines[0].id);
        } else {
          setSelectedTontineId(null);
        }
      }
    } else {
      setSelectedTontineId(null);
    }
  }, [selectedClientId, selectedClient, currentUser]);

  const filteredClients = clients.filter(c => {
    // Restriction pour les agents commerciaux
    if (currentUser?.role === 'agent commercial') {
      const agentZones = currentUser.zonesCollecte || (currentUser.zoneCollecte ? [currentUser.zoneCollecte] : []);
      if (agentZones.length > 0 && !agentZones.includes(c.zone)) return false;
    }

    // Filtre par zone
    if (selectedZone !== 'all' && c.zone !== selectedZone) return false;

    // Filtre par clients actifs (au moins une opération ce mois-ci)
    if (showActiveOnly) {
      const now = new Date();
      const currentMonth = now.getMonth();
      const currentYear = now.getFullYear();
      const hasRecentOp = c.history.some(tx => {
        const txDate = new Date(tx.date);
        return txDate.getMonth() === currentMonth && txDate.getFullYear() === currentYear;
      });
      if (!hasRecentOp) return false;
    }

    const isEpargneVisible = !c.isEpargneInvisible || currentUser?.role === 'administrateur';
    const hasVisibleTontine = c.tontineAccounts.some(acc => !acc.isInvisible || currentUser?.role === 'administrateur');
    
    if (!isEpargneVisible && !hasVisibleTontine && currentUser?.role !== 'administrateur') return false;

    const search = searchTerm.toLowerCase();
    return (
      c.name.toLowerCase().includes(search) ||
      c.code.toLowerCase().includes(search) ||
      (c.epargneAccountNumber && isEpargneVisible && c.epargneAccountNumber.toLowerCase().includes(search)) ||
      c.tontineAccounts.some(acc => (!acc.isInvisible || currentUser?.role === 'administrateur') && acc.number.toLowerCase().includes(search))
    );
  });

  const getTontineStats = (grossBalance: number, dailyMise: number, history: Transaction[], accountId: string, pendingWithdrawals: any[] = []) => {
    if (dailyMise <= 0) dailyMise = 500; 
    
    const accountHistory = (history || [])
      .filter(h => h.account === 'tontine' && (h.tontineAccountId === accountId || !h.tontineAccountId) && (h.type === 'cotisation' || h.type === 'depot') && !h.description?.toLowerCase().includes('livret'))
      .sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    
    // On fusionne l'historique réel avec les demandes en attente pour le calcul des cycles
    const allWithdrawals = [
      ...(history || [])
        .filter(h => h.account === 'tontine' && (h.tontineAccountId === accountId || !h.tontineAccountId) && (h.type === 'retrait' || h.type === 'transfert')),
      ...pendingWithdrawals.map(pw => ({
        ...pw,
        type: 'retrait',
        date: pw.date || new Date().toISOString(),
        amount: pw.amount,
        description: `Retrait en attente: ${pw.reason || ''}`
      }))
    ].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    const accountWithdrawalsAmount = allWithdrawals.reduce((sum, h) => sum + h.amount, 0);

    let remainingWithdrawals = accountWithdrawalsAmount;
    
    const fmt = (d: Date) => d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const today = new Date();

    if (accountHistory.length === 0 || grossBalance <= 0) {
      return { cycles: 1, commission: 0, netBalance: 0, currentCycleCases: 0, currentCycleDates: [], cycleDetails: [{ index: 1, amount: 0, disponible: 0, commission: 0, decaissable: 0, prototype: 0, cases: 0, period: `${fmt(today)} au ...`, isRetire: grossBalance <= 0, retraitDate: null, montantRetire: 0 }] };
    }

    let cycleDetails = [];
    let currentCycleFirstDepositDate: Date | null = null;
    let currentCycleCases = 0;
    let currentCycleAmount = 0;
    let currentCycleDates: string[] = [];
    let cycleIdx = 1;
    let totalComm = 0;
    let specificWithdrawal;

    for (const tx of accountHistory) {
      const txDate = new Date(tx.date);
      let remainingAmount = tx.amount;

      while (remainingAmount > 0) {
        if (currentCycleFirstDepositDate === null) {
          currentCycleFirstDepositDate = txDate;
        }

        const cycleEndDateLimit = new Date(currentCycleFirstDepositDate.getTime() + (31 * 24 * 60 * 60 * 1000));

        // Vérifier s'il y a eu un retrait entre le début du cycle et cette transaction
        const withdrawalDuringCycle = allWithdrawals.find(w => {
          const wDate = new Date(w.date);
          return wDate >= currentCycleFirstDepositDate! && wDate < txDate;
        });

        if (txDate >= cycleEndDateLimit || withdrawalDuringCycle) {
          let isRetire = false;
          let retraitDate = null;
          let mRetire = 0;

          const comm = currentCycleAmount > 0 ? dailyMise : 0;
          const netCycleAmount = Math.max(0, currentCycleAmount - comm);

          specificWithdrawal = withdrawalDuringCycle || allWithdrawals.find(h => 
            h.description.includes(`Cycles:`) && h.description.includes(`${cycleIdx}`) &&
            new Date(h.date) >= currentCycleFirstDepositDate!
          );

          if (specificWithdrawal) {
            isRetire = true;
            retraitDate = new Date(specificWithdrawal.date).toLocaleDateString('fr-FR');
            mRetire = specificWithdrawal.amount;
          } else if (remainingWithdrawals >= netCycleAmount && netCycleAmount > 0) {
            const hasFutureWithdrawal = allWithdrawals.some(w => !w.description.includes('Cycles:') && new Date(w.date) >= currentCycleFirstDepositDate!);
            if (hasFutureWithdrawal) {
              isRetire = true;
              mRetire = netCycleAmount;
              remainingWithdrawals -= netCycleAmount;
              const fallbackWithdrawal = [...allWithdrawals].reverse().find(h => h.amount >= netCycleAmount && new Date(h.date) >= currentCycleFirstDepositDate!);
              if (fallbackWithdrawal) retraitDate = new Date(fallbackWithdrawal.date).toLocaleDateString('fr-FR');
            }
          }

          cycleDetails.push({
            index: cycleIdx,
            amount: currentCycleAmount,
            disponible: isRetire ? 0 : currentCycleAmount,
            commission: comm,
            decaissable: isRetire ? 0 : netCycleAmount,
            cases: isRetire ? 0 : Math.floor(currentCycleAmount / dailyMise),
            period: `${fmt(currentCycleFirstDepositDate)} au ${withdrawalDuringCycle ? fmt(new Date(withdrawalDuringCycle.date)) : fmt(cycleEndDateLimit)}`,
            isRetire: isRetire,
            retraitDate: retraitDate,
            montantRetire: mRetire
          });
          if (currentCycleAmount > 0) totalComm += comm;
          cycleIdx++;
          currentCycleFirstDepositDate = txDate;
          currentCycleCases = 0;
          currentCycleAmount = 0;
          currentCycleDates = [];
          continue; 
        }

        const amountToCompleteCycle = (31 * dailyMise) - currentCycleAmount;
        const casesToAddFromTx = Math.floor(remainingAmount / dailyMise);
        const space = 31 - currentCycleCases;

        if (casesToAddFromTx >= space || remainingAmount >= amountToCompleteCycle) {
          const oldTotalCases = Math.floor(currentCycleAmount / dailyMise);
          currentCycleAmount += amountToCompleteCycle;
          const newTotalCases = 31;
          const casesToAdd = newTotalCases - oldTotalCases;
          
          for (let m = 0; m < casesToAdd; m++) {
            currentCycleDates.push(new Date(tx.date).toLocaleDateString('fr-FR', {day: '2-digit', month: '2-digit'}));
          }
          currentCycleCases = 31;
          remainingAmount -= amountToCompleteCycle;

          let isRetire = false;
          let retraitDate = null;
          let mRetire = 0;
          const comm = currentCycleAmount > 0 ? dailyMise : 0;
          const netCycleAmount = Math.max(0, currentCycleAmount - comm);

          specificWithdrawal = allWithdrawals.find(h => 
            h.description.includes(`Cycles:`) && h.description.includes(`${cycleIdx}`) &&
            new Date(h.date) >= currentCycleFirstDepositDate!
          );

          if (specificWithdrawal) {
            isRetire = true;
            retraitDate = new Date(specificWithdrawal.date).toLocaleDateString('fr-FR');
            mRetire = specificWithdrawal.amount;
          } else if (remainingWithdrawals >= netCycleAmount && netCycleAmount > 0) {
            const hasFutureWithdrawal = allWithdrawals.some(w => !w.description.includes('Cycles:') && new Date(w.date) >= currentCycleFirstDepositDate!);
            if (hasFutureWithdrawal) {
              isRetire = true;
              mRetire = netCycleAmount;
              remainingWithdrawals -= netCycleAmount;
              const fallbackWithdrawal = [...allWithdrawals].reverse().find(h => h.amount >= netCycleAmount && new Date(h.date) >= currentCycleFirstDepositDate!);
              if (fallbackWithdrawal) retraitDate = new Date(fallbackWithdrawal.date).toLocaleDateString('fr-FR');
            }
          }

          cycleDetails.push({
            index: cycleIdx,
            amount: currentCycleAmount,
            disponible: isRetire ? 0 : currentCycleAmount,
            commission: comm,
            decaissable: isRetire ? 0 : netCycleAmount,
            cases: isRetire ? 0 : 31,
            period: `${fmt(currentCycleFirstDepositDate!)} au ${fmt(txDate)}`,
            isRetire: isRetire,
            retraitDate: retraitDate,
            montantRetire: mRetire,
            dates: [...currentCycleDates]
          });
          totalComm += dailyMise;
          cycleIdx++;
          currentCycleFirstDepositDate = null; 
          currentCycleCases = 0;
          currentCycleAmount = 0;
          currentCycleDates = [];
        } else {
          const oldTotalCases = Math.floor(currentCycleAmount / dailyMise);
          currentCycleAmount += remainingAmount;
          const newTotalCases = Math.floor(currentCycleAmount / dailyMise);
          const casesToAdd = newTotalCases - oldTotalCases;
          
          for (let m = 0; m < casesToAdd; m++) {
            currentCycleDates.push(new Date(tx.date).toLocaleDateString('fr-FR', {day: '2-digit', month: '2-digit'}));
          }
          currentCycleCases += casesToAdd;
          remainingAmount = 0;
        }
      }
    }

    if (currentCycleFirstDepositDate) {
      const cycleEndDateLimit = new Date(currentCycleFirstDepositDate.getTime() + (31 * 24 * 60 * 60 * 1000));
      let isRetire = false;
      let retraitDate = null;
      let mRetire = 0;
      let withdrawalValue = 0;
      const comm = currentCycleAmount > 0 ? Math.min(currentCycleAmount, dailyMise) : 0;
      const netCycleAmount = Math.max(0, currentCycleAmount - comm);

      specificWithdrawal = allWithdrawals.find(h => 
        h.description.includes(`Cycles:`) && h.description.includes(`${cycleIdx}`)
      );

      if (specificWithdrawal) {
        isRetire = true;
        retraitDate = new Date(specificWithdrawal.date).toLocaleDateString('fr-FR');
        mRetire = specificWithdrawal.amount;
        currentCycleCases = 0;
      } else if (remainingWithdrawals > 0) {
        const hasFutureWithdrawal = allWithdrawals.some(w => !w.description.includes('Cycles:') && new Date(w.date) >= currentCycleFirstDepositDate!);
        if (hasFutureWithdrawal) {
          if (remainingWithdrawals >= netCycleAmount && netCycleAmount > 0) {
            isRetire = true;
            mRetire = netCycleAmount;
            withdrawalValue = netCycleAmount;
            currentCycleCases = 0; 
            remainingWithdrawals -= netCycleAmount;
            const fallbackWithdrawal = [...allWithdrawals].reverse().find(h => h.amount >= netCycleAmount && new Date(h.date) >= currentCycleFirstDepositDate!);
            if (fallbackWithdrawal) retraitDate = new Date(fallbackWithdrawal.date).toLocaleDateString('fr-FR');
          } else {
            withdrawalValue = remainingWithdrawals;
            const withdrawnCases = Math.floor(remainingWithdrawals / dailyMise);
            currentCycleCases = Math.max(0, currentCycleCases - withdrawnCases);
            remainingWithdrawals = 0;
          }
        }
      }

      const now = new Date();
      const isExpired = now >= cycleEndDateLimit;

      cycleDetails.push({
        index: cycleIdx,
        amount: currentCycleAmount,
        disponible: isRetire ? 0 : Math.max(0, currentCycleAmount - withdrawalValue),
        commission: comm,
        decaissable: isRetire ? 0 : Math.max(0, (currentCycleAmount - withdrawalValue) - comm),
        cases: (isRetire || isExpired) ? 0 : Math.floor(Math.max(0, currentCycleAmount - withdrawalValue) / dailyMise),
        period: `${fmt(currentCycleFirstDepositDate)} au ${isExpired ? fmt(cycleEndDateLimit) : fmt(today)}`,
        isRetire: isRetire,
        isExpired: isExpired,
        retraitDate: retraitDate,
        montantRetire: mRetire,
        dates: [...currentCycleDates]
      });
      if (currentCycleAmount > 0) totalComm += comm;
    }

    const lastCycle = cycleDetails[cycleDetails.length - 1];
    let displayCycles = cycleIdx;
    let displayCycleCases = lastCycle ? lastCycle.cases : 0;
    let displayCycleDates = currentCycleDates.slice(0, displayCycleCases);

    if (lastCycle) {
      if (lastCycle.index < cycleIdx) {
        displayCycleCases = 0;
        displayCycleDates = [];
      } else {
        const isExpired = currentCycleFirstDepositDate && today >= new Date(currentCycleFirstDepositDate.getTime() + (31 * 24 * 60 * 60 * 1000));
        if (lastCycle.isRetire || isExpired) {
          displayCycles = cycleIdx + 1;
          displayCycleCases = 0;
          displayCycleDates = [];
        }
      }
    }

    return {
      cycles: displayCycles,
      commission: totalComm,
      netBalance: cycleDetails.reduce((sum, c) => sum + c.decaissable, 0),
      currentCycleCases: displayCycleCases,
      cycleDetails: cycleDetails,
      currentCycleDates: displayCycleDates
    };
  };

  const getClientTotalNetTontine = (client: ClientAccount) => {
    const clientPending = pendingWithdrawals.filter(r => r.clientId === client.id);
    return client.tontineAccounts
      .filter(acc => !acc.isInvisible || currentUser?.role === 'administrateur')
      .reduce((total, acc) => {
        const stats = getTontineStats(acc.balance, acc.dailyMise, client.history, acc.id, clientPending);
        return total + stats.netBalance;
      }, 0);
  };

  useEffect(() => {
    if (selectedClient && selectedClient.tontineAccounts.length > 0) {
      const belongs = selectedClient.tontineAccounts.some(a => a.id === selectedTontineId);
      if (!belongs) {
        setSelectedTontineId(selectedClient.tontineAccounts[0].id);
      }
    }
  }, [selectedClient, selectedTontineId]);

  useEffect(() => {
    localStorage.setItem('microfox_members_data', JSON.stringify(clients));
    localStorage.setItem('microfox_pending_sync', 'true');
  }, [clients]);

  useEffect(() => {
    const syncBalances = () => {
      const savedMembers = localStorage.getItem('microfox_members_data');
      if (savedMembers) {
        const parsed: ClientAccount[] = JSON.parse(savedMembers);
        
        // Ensure history is loaded for each client if it's empty in the saved array
        const withHistory = parsed.map(c => {
          if (!c.history || c.history.length === 0) {
            const savedHistory = localStorage.getItem(`microfox_history_${c.id}`);
            if (savedHistory) {
              return { ...c, history: JSON.parse(savedHistory) };
            }
          }
          return c;
        });

        if (JSON.stringify(withHistory) !== JSON.stringify(clients)) {
          setClients(withHistory);
        }
      }
    };

    window.addEventListener('storage', syncBalances);
    syncBalances();
    return () => window.removeEventListener('storage', syncBalances);
  }, [clients]);

  const handleRegister = (newClient: ClientAccount) => {
    const updatedClients = [newClient, ...clients];
    setClients(updatedClients);
    localStorage.setItem('microfox_members_data', JSON.stringify(updatedClients));
    localStorage.setItem('microfox_pending_sync', 'true');
    recordAuditLog('CREATION', 'MEMBRES', `Création du nouveau membre: ${newClient.name} (Code: ${newClient.code})`);
    setSelectedClientId(newClient.id);
    setIsSidebarCollapsed(true);
    localStorage.setItem(`microfox_history_${newClient.id}`, JSON.stringify(newClient.history));

    // Mise à jour du solde de la caisse ou de l'agent
    const targetCaisse = currentUser?.role === 'agent commercial' ? null : (currentUser?.caisse || (currentUser?.role === 'administrateur' || currentUser?.role === 'directeur' ? 'CAISSE PRINCIPALE' : null));
    const totalInflow = newClient.history.reduce((sum, tx) => sum + tx.amount, 0);
    if (totalInflow > 0) {
      if (targetCaisse) {
        const cashKey = `microfox_cash_balance_${targetCaisse}`;
        const currentCashBalance = Number(localStorage.getItem(cashKey) || 0);
        localStorage.setItem(cashKey, (currentCashBalance + totalInflow).toString());
      } else if (currentUser?.role === 'agent commercial') {
        const agentBalanceKey = `microfox_agent_balance_${currentUser.id}`;
        const currentAgentBalance = Number(localStorage.getItem(agentBalanceKey) || 0);
        localStorage.setItem(agentBalanceKey, (currentAgentBalance + totalInflow).toString());
      }
    }
  };

  const handleUpdateProfile = (updatedClient: ClientAccount) => {
    const updatedClients = clients.map(c => c.id === updatedClient.id ? updatedClient : c);
    setClients(updatedClients);
    localStorage.setItem('microfox_members_data', JSON.stringify(updatedClients));
    localStorage.setItem('microfox_pending_sync', 'true');
    recordAuditLog('MODIFICATION', 'MEMBRES', `Mise à jour du profil de ${updatedClient.name} (Code: ${updatedClient.code})`);
    alert("Dossier client mis à jour avec succès.");
  };

  const handleAddNewTontine = (info: { number: string; mise: number; zone: string }) => {
    if (!selectedClientId) return;
    const updated = clients.map(c => {
      if (c.id === selectedClientId) {
        const newAcc: TontineAccount = {
          id: `${c.id}_tn_${c.tontineAccounts.length}`,
          number: info.number,
          dailyMise: info.mise,
          balance: 0,
          zone: info.zone
        };
        return { ...c, tontineAccounts: [...c.tontineAccounts, newAcc] };
      }
      return c;
    });
    setClients(updated);
    localStorage.setItem('microfox_members_data', JSON.stringify(updated));
    localStorage.setItem('microfox_pending_sync', 'true');
    setShowAddTontineModal(false);
  };

  const handleUpdateTontine = (info: { number: string; zone: string }) => {
    if (!selectedClientId || !selectedTontineId) return;
    const updated = clients.map(c => {
      if (c.id === selectedClientId) {
        const updatedTontineAccounts = c.tontineAccounts.map(acc => {
          if (acc.id === selectedTontineId) {
            return { ...acc, number: info.number, zone: info.zone };
          }
          return acc;
        });
        return { ...c, tontineAccounts: updatedTontineAccounts };
      }
      return c;
    });
    setClients(updated);
    localStorage.setItem('microfox_members_data', JSON.stringify(updated));
    localStorage.setItem('microfox_pending_sync', 'true');
    setShowEditTontineModal(false);
    alert("Compte tontine mis à jour avec succès.");
  };

  const handleOpenEpargne = (info: { number: string; adhesion: number; livret: number; partSociale: number; depot: number }) => {
    if (!selectedClientId) return;
    const updated = clients.map(c => {
      if (c.id === selectedClientId) {
        const history = [...c.history];
        const now = new Date().toISOString();
        
        if (info.partSociale > 0) {
          history.unshift({
            id: `ps-${c.id}-${Date.now()}`,
            type: 'depot',
            account: 'partSociale',
            amount: info.partSociale,
            date: now,
            description: 'Ouverture compte: Part sociale',
            userId: currentUser?.id,
            cashierName: currentUser?.identifiant
          });
        }
        if (info.adhesion > 0) {
          history.unshift({
            id: `fa-${c.id}-${Date.now()}`,
            type: 'depot',
            account: 'frais',
            amount: info.adhesion,
            date: now,
            description: 'Ouverture compte: Frais d\'adhésion',
            userId: currentUser?.id,
            cashierName: currentUser?.identifiant
          });
        }
        if (info.livret > 0) {
          history.unshift({
            id: `fl-${c.id}-${Date.now()}`,
            type: 'depot',
            account: 'frais',
            amount: info.livret,
            date: now,
            description: `Vente de Livret Épargne - Agent ${currentUser?.identifiant || 'Système'}`,
            userId: currentUser?.id,
            cashierName: currentUser?.identifiant
          });
        }
        if (info.depot > 0) {
          history.unshift({
            id: `di-${c.id}-${Date.now()}`,
            type: 'depot',
            account: 'epargne',
            amount: info.depot,
            date: now,
            description: 'Ouverture compte: Dépôt initial',
            userId: currentUser?.id,
            cashierName: currentUser?.identifiant
          });
        }

        return {
          ...c,
          epargneAccountNumber: info.number,
          balances: {
            ...c.balances,
            epargne: c.balances.epargne + info.depot,
            partSociale: c.balances.partSociale + info.partSociale
          },
          history
        };
      }
      return c;
    });
    setClients(updated);
    localStorage.setItem('microfox_members_data', JSON.stringify(updated));
    localStorage.setItem('microfox_pending_sync', 'true');

    // Mise à jour du solde de la caisse ou de l'agent
    const targetCaisse = currentUser?.role === 'agent commercial' ? null : (currentUser?.caisse || (currentUser?.role === 'administrateur' || currentUser?.role === 'directeur' ? 'CAISSE PRINCIPALE' : null));
    const totalInflow = info.partSociale + info.adhesion + info.livret + info.depot;
    if (totalInflow > 0) {
      if (targetCaisse) {
        const cashKey = `microfox_cash_balance_${targetCaisse}`;
        const currentCashBalance = Number(localStorage.getItem(cashKey) || 0);
        localStorage.setItem(cashKey, (currentCashBalance + totalInflow).toString());
      } else if (currentUser?.role === 'agent commercial') {
        const agentBalanceKey = `microfox_agent_balance_${currentUser.id}`;
        const currentAgentBalance = Number(localStorage.getItem(agentBalanceKey) || 0);
        localStorage.setItem(agentBalanceKey, (currentAgentBalance + totalInflow).toString());
      }
    }

    setShowOpenEpargneModal(false);
    alert("Compte épargne ouvert avec succès.");
  };

  const handleSaveOperation = (op: Omit<Transaction, 'id' | 'date'>, validatedRequestIds?: string[]) => {
    if (!selectedClientId) return;

    // Récupérer les informations des demandes validées si elles existent pour gérer les écarts
    let totalGap = 0;
    let responsibleAgentId = '';
    if (validatedRequestIds && validatedRequestIds.length > 0) {
      const savedValidated = localStorage.getItem('microfox_validated_withdrawals');
      if (savedValidated) {
        const validatedList = JSON.parse(savedValidated);
        validatedRequestIds.forEach(id => {
          const request = validatedList.find((r: any) => r.id === id);
          if (request) {
            if (request.gap) {
              totalGap += Number(request.gap) || 0;
            }
            // On récupère l'agent responsable (celui qui a été identifié lors de la validation)
            // On cherche dans microfox_all_gaps pour trouver l'agent lié à cette demande
            const savedGaps = localStorage.getItem('microfox_all_gaps');
            if (savedGaps) {
              const allGaps = JSON.parse(savedGaps);
              const gapEntry = allGaps.find((g: any) => g.sourceId === id);
              if (gapEntry && gapEntry.userId) {
                responsibleAgentId = gapEntry.userId;
              }
            }
          }
        });
      }
    }
    
    // Vérification du solde de la caisse pour les retraits et déblocages
    const currentUser = JSON.parse(localStorage.getItem('microfox_current_user') || 'null');
    const targetCaisse = currentUser?.role === 'agent commercial' ? null : (currentUser?.caisse || (currentUser?.role === 'administrateur' || currentUser?.role === 'directeur' ? 'CAISSE PRINCIPALE' : null));
    
    if (targetCaisse && (op.type === 'retrait' || op.type === 'deblocage')) {
      const cashKey = `microfox_cash_balance_${targetCaisse}`;
      const currentCashBalance = Number(localStorage.getItem(cashKey) || 0);
      if (currentCashBalance <= 0 && (!validatedRequestIds || validatedRequestIds.length === 0)) {
        alert(`Opération impossible : Le solde de la ${targetCaisse} est de 0 F. Veuillez approvisionner la caisse.`);
        return;
      }
    }
    
    let success = false;
    const updated = clients.map(c => {
      if (c.id === selectedClientId) {
        const newBalances = { ...c.balances };
        const newTontineAccounts = [...c.tontineAccounts];

        if (op.type === 'transfert') {
          const from = op.account;
          const to = op.destinationAccount;
          
          if (from === 'tontine' && op.tontineAccountId) {
            const accIdx = newTontineAccounts.findIndex(a => a.id === op.tontineAccountId);
            if (accIdx !== -1 && newTontineAccounts[accIdx].balance >= op.amount) {
              newTontineAccounts[accIdx].balance -= op.amount;
              newBalances.tontine -= op.amount;
            } else { console.error("Opération impossible : Solde tontine insuffisant."); return c; }
          } else if (newBalances[from as keyof typeof newBalances] >= op.amount) {
            (newBalances as any)[from] -= op.amount;
          } else { console.error(`Opération impossible : Solde ${from} insuffisant.`); return c; }
          
          if (to) (newBalances as any)[to] += op.amount;
        } else if (op.type === 'depot') {
          newBalances[op.account] += op.amount;
          if (op.account === 'tontine' && op.tontineAccountId) {
            const accIdx = newTontineAccounts.findIndex(a => a.id === op.tontineAccountId);
            if (accIdx !== -1) newTontineAccounts[accIdx].balance += op.amount;
          }
        } else if (op.type === 'retrait') {
          if (op.account === 'tontine' && op.tontineAccountId) {
            const accIdx = newTontineAccounts.findIndex(a => a.id === op.tontineAccountId);
            // Autoriser le retrait si validé, même si le solde est insuffisant (cas des écarts)
            if (accIdx !== -1 && (newTontineAccounts[accIdx].balance >= op.amount || (validatedRequestIds && validatedRequestIds.length > 0))) {
              newTontineAccounts[accIdx].balance -= op.amount;
              newBalances.tontine -= op.amount;
            } else {
              alert(`Opération impossible : Solde tontine insuffisant sur ce compte (${accIdx !== -1 ? newTontineAccounts[accIdx].balance : 0} F disponibles).`);
              return c;
            }
          } else if (newBalances[op.account] >= op.amount || (validatedRequestIds && validatedRequestIds.length > 0)) {
            newBalances[op.account] -= op.amount;
          } else {
            alert(`Opération impossible : Solde insuffisant sur le compte ${op.account} (${newBalances[op.account]} F disponibles).`);
            return c;
          }
        } else if (op.type === 'remboursement') {
          if (newBalances.credit >= op.amount) {
            newBalances.credit -= op.amount;
          } else {
            newBalances.credit = 0;
          }
          
          // Mettre à jour les détails du crédit pour refléter le remboursement
          if (c.lastCreditDetails) {
            c.lastCreditDetails.capital = Math.max(0, (c.lastCreditDetails.capital || 0) - (op.rembCapital || 0));
            c.lastCreditDetails.interest = Math.max(0, (c.lastCreditDetails.interest || 0) - (op.rembInterest || 0));
            c.lastCreditDetails.penalty = Math.max(0, (c.lastCreditDetails.penalty || 0) - (op.rembPenalty || 0));
          } else if (c.lastCreditRequest) {
            c.lastCreditRequest.capital = Math.max(0, (c.lastCreditRequest.capital || 0) - (op.rembCapital || 0));
            c.lastCreditRequest.interest = Math.max(0, (c.lastCreditRequest.interest || 0) - (op.rembInterest || 0));
            c.lastCreditRequest.penalty = Math.max(0, (c.lastCreditRequest.penalty || 0) - (op.rembPenalty || 0));
          }
        } else if (op.type === 'deblocage') {
          newBalances.credit += op.amount;
        }

        const balanceBefore = op.account === 'tontine' && op.tontineAccountId 
          ? (c.tontineAccounts.find(a => a.id === op.tontineAccountId)?.balance || 0)
          : (c.balances[op.account as keyof typeof c.balances] || 0);

        const balanceAfter = op.account === 'tontine' && op.tontineAccountId
          ? (newTontineAccounts.find(a => a.id === op.tontineAccountId)?.balance || 0)
          : (newBalances[op.account as keyof typeof newBalances] || 0);

        const savedUsers = JSON.parse(localStorage.getItem('microfox_users') || '[]');
        const agentForZone = savedUsers.find((u: any) => u.role === 'agent commercial' && u.zoneCollecte === c.zone);
        const agentName = agentForZone ? agentForZone.identifiant : (currentUser?.identifiant || 'N/A');

        const newTransaction: Transaction = {
          ...op,
          id: Date.now().toString(),
          date: new Date().toISOString(),
          userId: currentUser?.id,
          cashierName: (op.account === 'tontine' && (op.type === 'depot' || op.type === 'cotisation')) ? agentName : currentUser?.identifiant,
          caisse: currentUser?.role === 'agent commercial' ? 'AGENT' : (currentUser?.caisse || (currentUser?.role === 'administrateur' || currentUser?.role === 'directeur' ? 'CAISSE PRINCIPALE' : 'N/A')),
          balance: balanceAfter,
          balanceBefore: balanceBefore
        };

        if (newTransaction.account === 'tontine' && newTransaction.type === 'depot') {
          newTransaction.type = 'cotisation';
        }

        const newHistory = [newTransaction, ...c.history];
        localStorage.setItem(`microfox_history_${c.id}`, JSON.stringify(newHistory));
        localStorage.setItem('microfox_pending_sync', 'true');
        recordAuditLog(
          op.type === 'depot' || op.type === 'cotisation' ? 'CREATION' : 'MODIFICATION',
          op.account.toUpperCase(),
          `${op.type.toUpperCase()} de ${op.amount} FCFA sur le compte ${op.account} du membre ${c.name} (${c.code})`
        );
        success = true;

        return {
          ...c,
          balances: newBalances,
          tontineAccounts: newTontineAccounts,
          history: newHistory
        };
      }
      return c;
    });

    if (success) {
      setClients(updated);
      localStorage.setItem('microfox_members_data', JSON.stringify(updated));
      localStorage.setItem('microfox_pending_sync', 'true');

      if (validatedRequestIds && validatedRequestIds.length > 0) {
        const savedValidated = localStorage.getItem('microfox_validated_withdrawals');
        if (savedValidated) {
          const validatedList = JSON.parse(savedValidated);
          const updatedValidatedList = validatedList.map((r: any) => {
            if (validatedRequestIds.includes(r.id)) {
              return { ...r, isDeleted: true };
            }
            return r;
          });
          localStorage.setItem('microfox_validated_withdrawals', JSON.stringify(updatedValidatedList));
          localStorage.setItem('microfox_pending_sync', 'true');
        }
      }

      // Mise à jour du solde de la caisse ou de l'agent
      const targetCaisse = currentUser?.role === 'agent commercial' ? null : (currentUser?.caisse || (currentUser?.role === 'administrateur' || currentUser?.role === 'directeur' ? 'CAISSE PRINCIPALE' : null));
      
      let cashDelta = 0;
      if (op.type === 'depot' || op.type === 'remboursement' || op.type === 'cotisation') {
        cashDelta = op.amount;
      } else if (op.type === 'retrait' || op.type === 'deblocage') {
        cashDelta = -op.amount;
      }
      
      if (cashDelta !== 0) {
        if (targetCaisse) {
          const cashKey = `microfox_cash_balance_${targetCaisse}`;
          const currentCashBalance = Number(localStorage.getItem(cashKey) || 0);
          
          // Si retrait tontine avec écart, on retire le montant total (décaissé + écart) de la caisse
          // La différence n'est pas retirée du compte client (déjà géré par op.amount) mais de la caisse
          const finalCashDelta = (op.account === 'tontine' && op.type === 'retrait' && totalGap > 0) 
            ? cashDelta - totalGap 
            : cashDelta;
            
          localStorage.setItem(cashKey, (currentCashBalance + finalCashDelta).toString());
          
          // Et on impute l'écart à l'agent responsable
          if (op.account === 'tontine' && op.type === 'retrait' && totalGap > 0 && responsibleAgentId) {
            const agentBalanceKey = `microfox_agent_balance_${responsibleAgentId}`;
            const currentAgentBalance = Number(localStorage.getItem(agentBalanceKey) || 0);
            localStorage.setItem(agentBalanceKey, (currentAgentBalance - totalGap).toString());
          }
        } else if (currentUser?.role === 'agent commercial') {
          const agentBalanceKey = `microfox_agent_balance_${currentUser.id}`;
          const currentAgentBalance = Number(localStorage.getItem(agentBalanceKey) || 0);
          localStorage.setItem(agentBalanceKey, (currentAgentBalance + cashDelta).toString());
        }
      }

      setShowOperationForm(false);
      showAlert("Succès", "Opération effectuée avec succès.", "success");
    }
  };

  const handleStartEditCredit = () => {
    if (!selectedClient) return;
    setCreditFormData({
      dossierInstruitPar: selectedClient.dossierInstruitPar || '',
      dureeCredit: selectedClient.dureeCredit || '',
      nomCaution: selectedClient.nomCaution || '',
      adresseCaution: selectedClient.adresseCaution || '',
      telCaution: selectedClient.telCaution || '',
      refCaution: selectedClient.refCaution || '',
      telRefCaution: selectedClient.telRefCaution || '',
      statusDossier: selectedClient.statusDossier || 'Sain'
    });
    setIsEditingCredit(true);
  };

  const handleSaveCreditInfo = () => {
    if (!selectedClientId) return;
    const updated = clients.map(c => c.id === selectedClientId ? { ...c, ...creditFormData } : c);
    setClients(updated);
    localStorage.setItem('microfox_members_data', JSON.stringify(updated));
    setIsEditingCredit(false);
    recordAuditLog('MODIFICATION', 'MEMBRES', `Mise à jour du dossier crédit de ${selectedClient.name}`);
  };

  const handleDeleteClient = (clientId: string, clientName: string) => {
    showConfirm(
      "Suppression de client",
      `Êtes-vous sûr de vouloir supprimer définitivement le client ${clientName} ? Cette action est irréversible.`,
      () => {
        const updated = clients.filter(c => c.id !== clientId);
        setClients(updated);
        localStorage.setItem('microfox_members_data', JSON.stringify(updated));
        localStorage.removeItem(`microfox_history_${clientId}`);
        localStorage.setItem('microfox_pending_sync', 'true');
        
        if (selectedClientId === clientId) {
          setSelectedClientId(null);
        }

        recordAuditLog('SUPPRESSION', 'MEMBRES', `Suppression du compte client ${clientName} (${clientId})`);
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
        showAlert("Succès", "Client supprimé avec succès.", "success");
      }
    );
  };

  const exportToHTML = () => {
    if (clients.length === 0) {
      alert("Aucun membre à exporter.");
      return;
    }

    const mfConfig = JSON.parse(localStorage.getItem('microfox_mf_config') || '{"nom": "MicroFoX", "adresse": "", "code": ""}');
    const data = clients.map(c => ({
      'Code Client': c.code,
      'Nom Complet': c.name,
      'Statut': c.status,
      'Épargne': c.balances.epargne.toLocaleString() + ' F',
      'Tontine': c.balances.tontine.toLocaleString() + ' F',
      'Crédit': c.balances.credit.toLocaleString() + ' F',
      'Garantie': c.balances.garantie.toLocaleString() + ' F',
      'Part Sociale': c.balances.partSociale.toLocaleString() + ' F',
      'Numéro Épargne': c.epargneAccountNumber || 'N/A',
      'Genre': c.gender || 'N/A',
      'Profession': c.profession || 'N/A',
      'Nationalité': c.nationality || 'N/A'
    }));

    const headers = Object.keys(data[0] || {});
    const htmlContent = `
      <!DOCTYPE html>
      <html lang="fr">
      <head>
        <meta charset="UTF-8">
        <title>Liste des Membres - ${mfConfig.nom}</title>
        <style>
          body { font-family: sans-serif; padding: 40px; color: #121c32; }
          .header { text-align: center; margin-bottom: 40px; border-bottom: 2px solid #f1f5f9; padding-bottom: 20px; }
          .mf-name { font-size: 24px; font-weight: 900; text-transform: uppercase; margin: 0; color: #121c32; }
          .mf-info { font-size: 12px; font-weight: bold; color: #64748b; margin: 5px 0; }
          .report-title { font-size: 18px; font-weight: 800; margin: 20px 0; text-transform: uppercase; text-align: center; }
          .period { font-size: 12px; color: #64748b; text-align: center; margin-bottom: 30px; font-weight: bold; }
          table { width: 100%; border-collapse: collapse; margin-top: 20px; }
          th { background: #f8fafc; padding: 12px; text-align: center; font-size: 10px; text-transform: uppercase; letter-spacing: 0.05em; color: #64748b; border-bottom: 1px solid #e2e8f0; }
          td { padding: 12px; border-bottom: 1px solid #f1f5f9; font-size: 12px; text-align: center; }
          tr:nth-child(even) { background-color: #f9fafb; }
          .text-right { text-align: center; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1 class="mf-name">${mfConfig.nom}</h1>
          <p class="mf-info">${mfConfig.adresse}</p>
          <p class="mf-info">Tél: ${mfConfig.telephone || 'N/A'} | Code: ${mfConfig.code}</p>
        </div>
        <h2 class="report-title">Liste des Membres</h2>
        <p class="period">Généré le ${new Date().toLocaleDateString()}</p>
        <table>
          <thead>
            <tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr>
          </thead>
          <tbody>
            ${data.map(row => `
              <tr>
                ${headers.map((h, idx) => `<td class="${idx >= 3 && idx <= 7 ? 'text-right' : ''}">${(row as any)[h]}</td>`).join('')}
              </tr>
            `).join('')}
          </tbody>
        </table>
      </body>
      </html>
    `;

    const blob = new Blob([htmlContent], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    const dateStr = new Date().toLocaleDateString().replace(/[\/\\]/g, '-');
    link.download = `Liste_Membres_${mfConfig.nom}_${dateStr}.html`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const activeTontine = selectedClient?.tontineAccounts.find(a => a.id === selectedTontineId);
  const clientPending = selectedClient ? pendingWithdrawals.filter(r => r.clientId === selectedClient.id) : [];
  const activeTontineStats = activeTontine && selectedClient ? getTontineStats(activeTontine.balance, activeTontine.dailyMise, selectedClient.history, activeTontine.id, clientPending) : null;

  return (
    <div className="flex flex-col lg:flex-row gap-6 h-full min-h-0">
      <div className={`flex flex-col transition-all duration-300 ${isSidebarCollapsed || showRegistrationForm || showOperationForm ? 'hidden lg:hidden' : 'w-full lg:w-80 shrink-0'}`}>
        <div className="sticky top-0 z-20 bg-[#0a1226] pb-4 space-y-4">
          <button onClick={() => setShowRegistrationForm(true)} className="w-full py-4 bg-[#121c32] text-white rounded-[2rem] font-bold flex items-center justify-center gap-2 hover:bg-black shadow-lg transition-all active:scale-95 border border-white/5">
            <Plus size={20} /> Nouveau Client
          </button>

          <div className="flex flex-col gap-2">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
                <input 
                  type="text" 
                  placeholder="Rechercher par nom, tontine..." 
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-4 bg-white/5 border border-white/5 rounded-2xl text-sm font-medium outline-none focus:border-emerald-500 shadow-sm text-white"
                />
              </div>
              <button 
                onClick={exportToHTML}
                className="p-4 bg-white/5 border border-white/5 rounded-2xl text-gray-500 hover:text-emerald-400 hover:border-emerald-500/30 transition-all shadow-sm"
                title="Exporter en HTML"
              >
                <Download size={20} />
              </button>
            </div>

            <div className="flex items-center gap-2 overflow-x-auto pb-1 custom-scrollbar no-scrollbar">
              <select 
                value={selectedZone}
                onChange={(e) => setSelectedZone(e.target.value)}
                className="bg-white/5 border border-white/5 rounded-xl px-3 py-2 text-[10px] font-black uppercase tracking-widest text-gray-400 outline-none focus:border-emerald-500/50 disabled:opacity-50"
              >
                {currentUser?.role === 'agent commercial' ? (
                  <>
                    {(currentUser.zonesCollecte && currentUser.zonesCollecte.length > 1) && (
                      <option value="all" className="bg-[#0a1226]">Mes Zones</option>
                    )}
                    {(currentUser.zonesCollecte || [currentUser.zoneCollecte]).map((z: string) => (
                      <option key={z} value={z} className="bg-[#0a1226]">Zone {z}</option>
                    ))}
                  </>
                ) : (
                  <>
                    <option value="all" className="bg-[#0a1226]">Toutes Zones</option>
                    {['01','01A','02','02A','03','03A','04','04A','05','05A','06','06A','07','07A','08','08A','09','09A'].map(z => (
                      <option key={z} value={z} className="bg-[#0a1226]">Zone {z}</option>
                    ))}
                  </>
                )}
              </select>

              <button 
                onClick={() => setShowActiveOnly(!showActiveOnly)}
                className={`whitespace-nowrap px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border ${showActiveOnly ? 'bg-emerald-500/10 border-emerald-500/50 text-emerald-400' : 'bg-white/5 border-white/5 text-gray-500'}`}
              >
                Actifs ce mois
              </button>

              <div className="ml-auto shrink-0 bg-white/5 px-3 py-2 rounded-xl border border-white/5">
                <span className="text-[10px] font-black text-emerald-500">{filteredClients.length}</span>
                <span className="text-[10px] font-black text-gray-500 ml-1 uppercase tracking-widest">Clients</span>
              </div>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar space-y-2 pr-1 min-h-0">
          {filteredClients.length > 0 ? (
            filteredClients.map(client => (
              <div
                key={client.id}
                onClick={() => {
                  setSelectedClientId(client.id);
                  if (window.innerWidth < 1024) setIsSidebarCollapsed(true);
                }}
                className={`w-full p-4 rounded-2xl flex items-center gap-3 transition-all border relative cursor-pointer ${selectedClientId === client.id ? 'bg-emerald-600 text-white shadow-lg border-emerald-500' : 'bg-white/5 text-gray-400 hover:bg-white/10 border-white/5 shadow-sm'}`}
              >
                {client.balances.credit > 0 && (() => {
                  const dueDateStr = (client as any).lastCreditRequest?.dueDate || (client as any).lastCreditDetails?.dueDate;
                  if (!dueDateStr) return <div className="absolute top-2 right-2 w-2.5 h-2.5 rounded-full shadow-sm bg-emerald-500"></div>;
                  
                  const dueDate = new Date(dueDateStr);
                  const now = new Date();
                  const diffTime = now.getTime() - dueDate.getTime();
                  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

                  let colorClass = 'bg-emerald-500';
                  if (diffDays >= 30) colorClass = 'bg-red-500';
                  else if (diffDays >= 1) colorClass = 'bg-yellow-400';

                  return <div className={`absolute top-2 right-2 w-2.5 h-2.5 rounded-full shadow-sm ${colorClass}`}></div>;
                })()}
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-xs shrink-0 overflow-hidden ${selectedClientId === client.id ? 'bg-white/20 text-white' : 'bg-emerald-500/10 text-emerald-400'}`}>
                  {client.photo ? (
                    <img src={client.photo} className="w-full h-full object-cover" alt="" />
                  ) : (
                    client.name.split(' ').map(n => n[0]).join('')
                  )}
                </div>
                <div className="text-left min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 min-w-0 flex-1">
                      <p className={`text-sm font-black uppercase truncate ${selectedClientId === client.id ? 'text-white' : 'text-gray-200'}`}>{client.name}</p>
                      {currentUser?.role === 'administrateur' && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteClient(client.id, client.name);
                          }}
                          className={`shrink-0 p-1 rounded-md transition-all ${selectedClientId === client.id ? 'text-white/40 hover:text-white hover:bg-white/10' : 'text-gray-500 hover:text-red-500 hover:bg-red-500/10'}`}
                          title="Supprimer le client"
                        >
                          <Trash2 size={12} />
                        </button>
                      )}
                    </div>
                    <span className={`text-[10px] font-black px-2 py-0.5 rounded-lg shrink-0 ${selectedClientId === client.id ? 'bg-white/20 text-white' : 'bg-white/5 text-gray-500'}`}>
                      {client.code}
                    </span>
                  </div>
                  
                  <div className={`flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-[10px] font-bold ${selectedClientId === client.id ? 'text-white/80' : 'text-gray-500'}`}>
                    {client.epargneAccountNumber && (!client.isEpargneInvisible || currentUser?.role === 'administrateur') && (
                      <div className="flex items-center gap-1">
                        <div className={`w-1 h-1 rounded-full ${client.isEpargneBlocked ? 'bg-red-500' : 'bg-blue-400'}`} />
                        <span>EP: {client.epargneAccountNumber}</span>
                      </div>
                    )}
                    {client.tontineAccounts?.filter(a => !a.isInvisible || currentUser?.role === 'administrateur')[0] && (
                      <div className="flex items-center gap-1">
                        <div className={`w-1 h-1 rounded-full ${client.tontineAccounts.filter(a => !a.isInvisible || currentUser?.role === 'administrateur')[0].isBlocked ? 'bg-red-500' : 'bg-emerald-400'}`} />
                        <span>TN: {client.tontineAccounts.filter(a => !a.isInvisible || currentUser?.role === 'administrateur')[0].number}</span>
                      </div>
                    )}
                  </div>

                  <div className="mt-3 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      <div className={`w-1.5 h-1.5 rounded-full ${client.balances.partSociale >= 5000 ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]'}`} />
                      <span className={`text-[9px] font-black uppercase tracking-tighter ${selectedClientId === client.id ? 'text-white/70' : 'text-gray-400'}`}>
                        {client.balances.partSociale >= 5000 ? 'Part Libérée' : `Part: ${client.balances.partSociale} F`}
                      </span>
                    </div>
                    <div className="text-right">
                      <p className={`text-[10px] font-black ${selectedClientId === client.id ? 'text-white' : 'text-gray-300'}`}>
                        {client.balances.epargne.toLocaleString()} F
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="text-center py-8 text-gray-600 italic text-sm">
              Aucun résultat trouvé
            </div>
          )}
        </div>
      </div>

      <div className={`flex-1 flex flex-col gap-6 ${showRegistrationForm || showOperationForm ? 'overflow-hidden' : 'overflow-y-auto custom-scrollbar'} pb-8 h-full min-h-0`}>
        <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col gap-6 h-full">
          {showAddTontineModal && (
          <AddTontineModal 
            onClose={() => setShowAddTontineModal(false)} 
            onSave={handleAddNewTontine} 
          />
        )}

        {showEditTontineModal && activeTontine && (
          <EditTontineModal 
            onClose={() => setShowEditTontineModal(false)} 
            onSave={handleUpdateTontine}
            initialNumber={activeTontine.number}
            initialZone={activeTontine.zone || ''}
          />
        )}
        
        {showOpenEpargneModal && (
          <OpenEpargneModal 
            onClose={() => setShowOpenEpargneModal(false)}
            onSave={handleOpenEpargne}
          />
        )}
        
        {showRegistrationForm ? (
          <RegistrationForm 
            onClose={() => setShowRegistrationForm(false)} 
            onRegister={handleRegister}
            capturedPhoto={capturedPhoto} setCapturedPhoto={setCapturedPhoto} 
            capturedSignature={capturedSignature} setCapturedSignature={setCapturedSignature} 
          />
        ) : showOperationForm ? (
          <OperationForm 
            onClose={() => setShowOperationForm(false)}
            onSave={handleSaveOperation}
            clientId={selectedClient?.id || ''}
            clientName={selectedClient?.name || ''}
            epargneAccountNumber={selectedClient?.epargneAccountNumber}
            tontineAccounts={selectedClient?.tontineAccounts || []}
            initialTontineId={selectedTontineId || undefined}
            isEpargneBlockedByAdmin={selectedClient?.isEpargneBlocked}
            partSocialeBalance={selectedClient?.balances.partSociale}
            garantieBalance={selectedClient?.balances.garantie}
            epargneBalance={selectedClient?.balances.epargne}
            adhesionPaid={selectedClient?.history.filter(tx => tx.account === 'frais' && tx.description.toLowerCase().includes('adhésion')).reduce((sum, tx) => sum + tx.amount, 0)}
            livretPaid={selectedClient?.history.filter(tx => tx.account === 'frais' && tx.description.toLowerCase().includes('livret')).reduce((sum, tx) => sum + tx.amount, 0)}
            creditBalances={selectedClient ? (() => {
              const total = selectedClient.balances.credit;
              const initialCap = (selectedClient as any).lastCreditDetails?.capital || (selectedClient as any).lastCreditRequest?.capital || (total * 0.9);
              const initialInt = (selectedClient as any).lastCreditDetails?.interest || (selectedClient as any).lastCreditRequest?.interest || (total * 0.1);
              const initialTot = Number(initialCap) + Number(initialInt);
              
              if (Math.abs(total - initialTot) < 1) {
                return {
                  total,
                  capital: Number(initialCap),
                  interest: Number(initialInt),
                  penalty: (selectedClient as any).lastCreditDetails?.penalty || (selectedClient as any).lastCreditRequest?.penalty || 0
                };
              }

              const capRatio = initialTot > 0 ? Number(initialCap) / initialTot : 0.9;
              const intRatio = initialTot > 0 ? Number(initialInt) / initialTot : 0.1;
              return {
                total,
                capital: Math.floor(total * capRatio),
                interest: Math.floor(total * intRatio),
                penalty: (selectedClient as any).lastCreditDetails?.penalty || (selectedClient as any).lastCreditRequest?.penalty || 0
              };
            })() : undefined}
          />
        ) : !selectedClient ? (
          <div className="flex-1 bg-[#121c32] rounded-[2rem] border border-dashed border-white/10 flex flex-col items-center justify-center text-gray-500 p-8 text-center"><User size={64} strokeWidth={1} className="mb-4 opacity-20 mx-auto" /><p className="font-bold uppercase tracking-widest text-sm">Sélectionnez un client</p></div>
        ) : (
          <>
            <div className="sticky top-0 z-30 bg-[#121c32] rounded-[2rem] p-4 sm:p-6 shadow-sm border border-white/5">
               <div className="flex justify-end mb-2">
                 <button 
                   onClick={() => setIsHeaderVisible(!isHeaderVisible)}
                   className="p-1.5 bg-white/5 text-gray-500 rounded-lg hover:text-white transition-all border border-white/5"
                 >
                   {isHeaderVisible ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                 </button>
               </div>

               {isHeaderVisible && (
                 <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-6">
                  <div className="flex items-center gap-4 sm:gap-6">
                    {isSidebarCollapsed && <button onClick={() => setIsSidebarCollapsed(false)} className="p-3 bg-white/5 text-gray-500 rounded-2xl border border-white/5 hover:text-emerald-400 transition-all"><ChevronLeft size={20} /></button>}
                    <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-[1.25rem] bg-emerald-600 flex items-center justify-center text-white text-2xl font-black shadow-xl overflow-hidden">
                      {selectedClient.photo ? (
                        <img src={selectedClient.photo} className="w-full h-full object-cover" alt="" />
                      ) : (
                        selectedClient.name.split(' ').map(n => n[0]).join('')
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <h2 className="text-xl sm:text-2xl font-black text-white uppercase tracking-tight truncate">{selectedClient.name}</h2>
                      <div className="flex flex-wrap items-center gap-3 mt-1">
                        <span className="text-xs font-bold text-gray-500 uppercase">{selectedClient.code}</span>
                        {selectedClient.epargneAccountNumber && (!selectedClient.isEpargneInvisible || currentUser?.role === 'administrateur') && (
                          <span className={`text-[10px] font-black text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded-md border border-blue-500/20 uppercase tracking-tighter shadow-sm flex items-center gap-1 ${selectedClient.isEpargneBlocked ? 'opacity-50' : ''}`}>
                            ÉPARGNE: {selectedClient.epargneAccountNumber}
                            {selectedClient.isEpargneBlocked && <Lock size={10} />}
                            {selectedClient.isEpargneInvisible && <AlertCircle size={10} className="text-amber-500" />}
                          </span>
                        )}
                        {!selectedClient.epargneAccountNumber && currentUser?.role !== 'agent commercial' && (
                          <button 
                            onClick={() => setShowOpenEpargneModal(true)}
                            className="text-[10px] font-black text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded-md border border-blue-500/20 uppercase tracking-tighter shadow-sm hover:bg-blue-500/20 transition-all"
                          >
                            + Ouvrir Épargne
                          </button>
                        )}
                        {selectedClient.tontineAccounts.filter(acc => !acc.isInvisible || currentUser?.role === 'administrateur').map(acc => (
                          <span key={acc.id} className={`text-[10px] font-black text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20 uppercase tracking-tighter shadow-sm flex items-center gap-1 ${acc.isBlocked ? 'opacity-50' : ''}`}>
                            TONTINE: {acc.number}
                            {acc.isBlocked && <Lock size={10} />}
                            {acc.isInvisible && <AlertCircle size={10} className="text-amber-500" />}
                          </span>
                        ))}
                        <button 
                          onClick={() => setShowAddTontineModal(true)}
                          className="text-[10px] font-black text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20 uppercase tracking-tighter shadow-sm hover:bg-emerald-500/20 transition-all"
                        >
                          + Ouvrir Tontine
                        </button>
                        <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-400 text-[10px] font-black uppercase rounded-md">{selectedClient.status}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {currentUser?.role !== 'agent commercial' && (
                      <button onClick={() => setShowOperationForm(true)} className="flex-1 sm:flex-none px-6 py-3 bg-[#00c896] text-white rounded-2xl font-bold text-sm shadow-lg">Opération</button>
                    )}
                    <div className="relative">
                      <button 
                        onClick={() => setIsActionsOpen(!isActionsOpen)}
                        className="p-3 bg-white/5 text-gray-500 rounded-2xl border border-white/5 hover:text-white transition-all"
                      >
                        <MoreVertical size={20} />
                      </button>
                      {isActionsOpen && (
                        <div className="absolute right-0 mt-2 w-48 bg-[#1e293b] rounded-2xl shadow-xl border border-white/10 z-50 py-2">
                          {currentUser?.role !== 'agent commercial' && currentUser?.role !== 'caissier' && (
                            <button onClick={() => { setActiveTab('profile'); setIsActionsOpen(false); }} className="w-full text-left px-4 py-2 text-xs font-bold text-gray-300 hover:bg-white/5 uppercase">Modifier Profil</button>
                          )}
                          <button onClick={() => setIsActionsOpen(false)} className="w-full text-left px-4 py-2 text-xs font-bold text-gray-300 hover:bg-white/5 uppercase">Imprimer Relevé</button>
                          <div className="h-px bg-white/5 my-1"></div>
                          <button onClick={() => setIsActionsOpen(false)} className="w-full text-left px-4 py-2 text-xs font-bold text-red-400 hover:bg-red-500/10 uppercase">Clôturer Compte</button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
               )}

              <div className="flex gap-3 overflow-x-auto pb-4 scrollbar-hide items-center w-full">
                {activeTab === 'overview' ? (
                  <>
                    <button onClick={() => setActiveTab('overview')} className="flex items-center justify-center gap-2 rounded-2xl font-bold transition-all border shrink-0 px-8 py-4 text-sm sm:text-base bg-emerald-500/10 text-emerald-400 border-emerald-500/20 shadow-lg scale-105"><History size={20} /> Synthèse</button>
                    <button onClick={() => setActiveTab('epargne')} className="flex items-center justify-center gap-2 rounded-2xl font-bold transition-all border shrink-0 px-4 py-3 text-xs bg-white/5 text-gray-500 border-transparent opacity-60 hover:opacity-100"><Wallet size={16} /> Épargne</button>
                    <button onClick={() => setActiveTab('tontine')} className="flex items-center justify-center gap-2 rounded-2xl font-bold transition-all border shrink-0 px-4 py-3 text-xs bg-white/5 text-gray-500 border-transparent opacity-60 hover:opacity-100"><Clock size={16} /> Tontine</button>
                    <button onClick={() => setActiveTab('credit')} className="flex items-center justify-center gap-2 rounded-2xl font-bold transition-all border shrink-0 px-4 py-3 text-xs bg-white/5 text-gray-500 border-transparent opacity-60 hover:opacity-100"><CreditCard size={16} /> Crédits</button>
                    <button onClick={() => setActiveTab('garantie')} className="flex items-center justify-center gap-2 rounded-2xl font-bold transition-all border shrink-0 px-4 py-3 text-xs bg-white/5 text-gray-500 border-transparent opacity-60 hover:opacity-100"><ShieldCheck size={16} /> Garanties</button>
                    <button onClick={() => setActiveTab('partSociale')} className="flex items-center justify-center gap-2 rounded-2xl font-bold transition-all border shrink-0 px-4 py-3 text-xs bg-white/5 text-gray-500 border-transparent opacity-60 hover:opacity-100"><Gem size={16} /> Part Sociale</button>
                    <button onClick={() => setActiveTab('profile')} className="flex items-center justify-center gap-2 rounded-2xl font-bold transition-all border shrink-0 px-4 py-3 text-xs bg-white/5 text-gray-500 border-transparent opacity-60 hover:opacity-100"><BookOpen size={16} /> Dossier Client</button>
                    <button onClick={() => { setActiveTab('current_credit'); setIsEditingCredit(false); }} className="flex items-center justify-center gap-2 rounded-2xl font-bold transition-all border shrink-0 px-4 py-3 text-xs bg-white/5 text-gray-500 border-transparent opacity-60 hover:opacity-100"><CreditCard size={16} /> Dossier crédit actuel</button>
                    <button onClick={() => setActiveTab('credit_archives')} className="flex items-center justify-center gap-2 rounded-2xl font-bold transition-all border shrink-0 px-4 py-3 text-xs bg-white/5 text-gray-500 border-transparent opacity-60 hover:opacity-100"><History size={16} /> Archives des crédits</button>
                  </>
                ) : (
                  <div className="flex items-center gap-4 w-full">
                    <button 
                      onClick={handleBackToOverview}
                      className="p-3 bg-white/5 text-gray-400 rounded-2xl border border-white/5 hover:text-emerald-400 transition-all shrink-0"
                    >
                      <ChevronLeft size={24} />
                    </button>
                    <div className="flex-1">
                      {activeTab === 'epargne' && <button className="w-full flex items-center justify-center gap-3 rounded-2xl font-black py-5 text-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shadow-2xl"><Wallet size={28} /> ÉPARGNE</button>}
                      {activeTab === 'tontine' && <button className="w-full flex items-center justify-center gap-3 rounded-2xl font-black py-5 text-lg bg-[#00c896]/10 text-[#00c896] border border-[#00c896]/20 shadow-2xl"><Clock size={28} /> TONTINE</button>}
                      {activeTab === 'credit' && <button className="w-full flex items-center justify-center gap-3 rounded-2xl font-black py-5 text-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shadow-2xl"><CreditCard size={28} /> CRÉDITS</button>}
                      {activeTab === 'garantie' && <button className="w-full flex items-center justify-center gap-3 rounded-2xl font-black py-5 text-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shadow-2xl"><ShieldCheck size={28} /> GARANTIES</button>}
                      {activeTab === 'partSociale' && <button className="w-full flex items-center justify-center gap-3 rounded-2xl font-black py-5 text-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shadow-2xl"><Gem size={28} /> PART SOCIALE</button>}
                      {activeTab === 'profile' && <button className="w-full flex items-center justify-center gap-3 rounded-2xl font-black py-5 text-lg bg-blue-500/10 text-blue-400 border border-blue-500/20 shadow-2xl"><BookOpen size={28} /> DOSSIER CLIENT</button>}
                      {activeTab === 'current_credit' && (
                        <div className="w-full flex items-center justify-center gap-3 rounded-2xl font-black py-5 text-lg bg-red-500/10 text-red-400 border border-red-500/20 shadow-2xl">
                          <CreditCard size={28} /> DOSSIER CRÉDIT ACTUEL
                        </div>
                      )}
                      {activeTab === 'credit_archives' && (
                        <div className="w-full flex items-center justify-center gap-3 rounded-2xl font-black py-5 text-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shadow-2xl">
                          <History size={28} /> ARCHIVES DES CRÉDITS
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="flex-1 min-h-0">
              {activeTab === 'overview' && (
                <div className="space-y-6">
                  {/* Photo & Signature Display */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-[#121c32] p-6 rounded-[2rem] border border-white/5 shadow-sm flex flex-col items-center">
                      <p className="text-xs font-black text-gray-500 uppercase tracking-widest mb-3">Photo d'identité</p>
                      <div className="w-32 h-32 rounded-2xl bg-white/5 border border-white/5 overflow-hidden flex items-center justify-center">
                        {selectedClient.photo ? (
                          <img src={selectedClient.photo} alt="Membre" className="w-full h-full object-cover" />
                        ) : (
                          <User size={40} className="text-gray-700" />
                        )}
                      </div>
                    </div>
                    <div className="bg-[#121c32] p-6 rounded-[2rem] border border-white/5 shadow-sm flex flex-col items-center">
                      <p className="text-xs font-black text-gray-500 uppercase tracking-widest mb-3">Signature validée</p>
                      <div className="w-full h-32 rounded-2xl bg-white/5 border border-white/5 overflow-hidden flex items-center justify-center p-2">
                        {selectedClient.signature ? (
                          <img src={selectedClient.signature} alt="Signature" className="w-full h-full object-contain" />
                        ) : (
                          <FileText size={40} className="text-gray-700" />
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Geolocation Display */}
                  {selectedClient.latitude && selectedClient.longitude && (
                    <div className="bg-[#121c32] p-6 rounded-[2rem] border border-white/5 shadow-sm">
                      <div className="flex items-center gap-3 mb-2">
                        <MapPin size={18} className="text-blue-400" />
                        <p className="text-xs font-black text-gray-500 uppercase tracking-widest">Localisation Client</p>
                      </div>
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-bold text-white">
                          {selectedClient.latitude.toFixed(6)}, {selectedClient.longitude.toFixed(6)}
                        </p>
                        <a 
                          href={`https://www.google.com/maps?q=${selectedClient.latitude},${selectedClient.longitude}`} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-xs font-black text-blue-400 uppercase tracking-widest hover:underline flex items-center gap-1"
                        >
                          <Navigation size={12} /> Voir sur la carte
                        </a>
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                    {(!selectedClient.isEpargneInvisible || currentUser?.role === 'administrateur') && (
                      <div className={`bg-[#121c32] p-6 rounded-[2rem] border border-white/5 shadow-sm relative overflow-hidden group hover:border-blue-500/30 transition-all ${selectedClient.isEpargneBlocked ? 'opacity-50' : ''}`}>
                        <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/5 rounded-full -mr-12 -mt-12 group-hover:scale-110 transition-transform" />
                        <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-400 mb-4 relative z-10">
                          <Wallet size={20}/>
                          {selectedClient.isEpargneBlocked && <Lock size={12} className="absolute -top-1 -right-1 text-red-500 bg-[#121c32] rounded-full p-0.5" />}
                          {selectedClient.isEpargneInvisible && <AlertCircle size={12} className="absolute -top-1 -right-1 text-amber-500 bg-[#121c32] rounded-full p-0.5" />}
                        </div>
                        <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest relative z-10">Épargne</p>
                        <p className="text-xl font-black text-white mt-1 relative z-10">{currentUser?.role === 'agent commercial' ? '*** F' : `${selectedClient.balances.epargne.toLocaleString()} F`}</p>
                      </div>
                    )}
                    <div className="bg-[#121c32] p-6 rounded-[2rem] border border-white/5 shadow-sm relative overflow-hidden group hover:border-emerald-500/30 transition-all">
                      <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 rounded-full -mr-12 -mt-12 group-hover:scale-110 transition-transform" />
                      <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-400 mb-4 relative z-10"><Clock size={20}/></div>
                      <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest relative z-10">Tontine</p>
                      <p className="text-xl font-black text-white mt-1 relative z-10">{getClientTotalNetTontine(selectedClient).toLocaleString()} F</p>
                    </div>
                    <div className="bg-[#121c32] p-6 rounded-[2rem] border border-white/5 shadow-sm relative overflow-hidden group hover:border-purple-500/30 transition-all">
                      <div className="absolute top-0 right-0 w-24 h-24 bg-purple-500/5 rounded-full -mr-12 -mt-12 group-hover:scale-110 transition-transform" />
                      <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center text-purple-400 mb-4 relative z-10"><CreditCard size={20}/></div>
                      <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest relative z-10">Crédit</p>
                      <p className="text-xl font-black text-white mt-1 relative z-10">{selectedClient.balances.credit.toLocaleString()} F</p>
                    </div>
                    <div className="bg-[#121c32] p-6 rounded-[2rem] border border-white/5 shadow-sm relative overflow-hidden group hover:border-amber-500/30 transition-all">
                      <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/5 rounded-full -mr-12 -mt-12 group-hover:scale-110 transition-transform" />
                      <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-400 mb-4 relative z-10"><ShieldCheck size={20}/></div>
                      <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest relative z-10">Garantie</p>
                      <p className="text-xl font-black text-white mt-1 relative z-10">{currentUser?.role === 'agent commercial' ? '*** F' : `${selectedClient.balances.garantie.toLocaleString()} F`}</p>
                    </div>
                    <div className="bg-[#121c32] p-6 rounded-[2rem] border border-white/5 shadow-sm relative overflow-hidden group hover:border-pink-500/30 transition-all">
                      <div className="absolute top-0 right-0 w-24 h-24 bg-pink-500/5 rounded-full -mr-12 -mt-12 group-hover:scale-110 transition-transform" />
                      <div className="w-10 h-10 rounded-xl bg-pink-500/10 flex items-center justify-center text-pink-400 mb-4 relative z-10"><Gem size={20}/></div>
                      <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest relative z-10">Part Sociale</p>
                      <p className="text-xl font-black text-white mt-1 relative z-10">{selectedClient.balances.partSociale.toLocaleString()} F</p>
                      <p className={`text-[9px] font-black uppercase mt-1 relative z-10 ${selectedClient.balances.partSociale >= 5000 ? 'text-emerald-400' : 'text-amber-500'}`}>
                        {selectedClient.balances.partSociale >= 5000 ? 'Libérée' : `Reste: ${5000 - selectedClient.balances.partSociale} F`}
                      </p>
                    </div>
                  </div>

                  <div className="bg-[#121c32] rounded-[2rem] p-6 sm:p-8 shadow-sm border border-white/5">
                    <div className="flex items-center justify-between mb-6">
                      <h3 className="text-lg font-black text-white uppercase tracking-tight">Dernières Opérations</h3>
                      <TrendingUp size={20} className="text-gray-600" />
                    </div>
                    <div className="space-y-3">
                      {selectedClient.history.length > 0 ? (
                        selectedClient.history.slice(0, 5).map((tx) => (
                          <div key={tx.id} className="flex items-center justify-between p-5 bg-white/5 rounded-[2rem] border border-white/5 hover:bg-white/10 transition-all group relative overflow-hidden">
                            <div className="absolute top-0 left-0 w-1 h-full transition-all group-hover:w-1.5" style={{ backgroundColor: tx.type === 'depot' || tx.type === 'cotisation' || (tx.type === 'transfert' && tx.destinationAccount) ? '#10b981' : (tx.type === 'remboursement' ? '#a855f7' : '#ef4444') }} />
                            <div className="flex items-center gap-5 flex-1 min-w-0">
                              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-transform group-hover:scale-110 shrink-0 ${tx.type === 'depot' || tx.type === 'cotisation' || (tx.type === 'transfert' && tx.destinationAccount) ? 'bg-emerald-500/10 text-emerald-400' : (tx.type === 'remboursement' ? 'bg-purple-500/10 text-purple-400' : 'bg-red-500/10 text-red-400')}`}>
                                {tx.type === 'depot' || tx.type === 'cotisation' || (tx.type === 'transfert' && tx.destinationAccount) ? <ArrowDownLeft size={22} /> : <ArrowUpRight size={22} />}
                              </div>
                              <div className="min-w-0">
                                <p className="text-sm font-black text-white uppercase tracking-tight">{tx.description}</p>
                                <div className="flex items-center gap-2 mt-1">
                                  <p className="text-[10px] font-bold text-gray-500 uppercase">
                                    {new Date(tx.date).toLocaleDateString()} • {new Date(tx.date).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                    {tx.cashierName && ` • OP: ${tx.cashierName}`}
                                  </p>
                                  <span className="w-1 h-1 rounded-full bg-gray-700" />
                                  <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest">{tx.account}</p>
                                </div>
                              </div>
                            </div>
                            <div className="text-right shrink-0 ml-4">
                              <p className={`text-base font-black ${tx.type === 'depot' || tx.type === 'cotisation' || (tx.type === 'transfert' && tx.destinationAccount) ? 'text-emerald-400' : (tx.type === 'remboursement' ? 'text-purple-400' : 'text-red-400')}`}>
                                {tx.type === 'depot' || tx.type === 'cotisation' || (tx.type === 'transfert' && tx.destinationAccount) ? '+' : '-'}{tx.amount.toLocaleString()} F
                              </p>
                              <div className="flex flex-col items-end gap-0.5 mt-0.5">
                                <p className="text-[9px] font-bold text-gray-600 uppercase">Avant: {tx.balanceBefore?.toLocaleString() || '---'} F</p>
                                <p className="text-[9px] font-black text-blue-400 uppercase">Solde: {tx.balance?.toLocaleString() || '---'} F</p>
                              </div>
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="flex flex-col items-center justify-center py-12 text-gray-600">
                          <History size={48} strokeWidth={1} className="mb-4 opacity-20" />
                          <p className="italic text-sm font-bold uppercase tracking-widest">Aucune opération récente</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'epargne' && (
                <div className="space-y-6">
                  <div className="bg-[#0f172a] rounded-[2rem] p-8 text-white flex items-center justify-between shadow-xl border border-white/5">
                    <div className="flex items-center gap-4">
                      <div className="bg-blue-600 p-4 rounded-2xl shadow-lg shadow-blue-600/20"><Wallet size={28} /></div>
                      <div>
                        <p className="text-[10px] font-bold text-blue-300 uppercase tracking-widest opacity-70">SOLDE ÉPARGNE À VUE</p>
                        <p className="text-4xl font-black">{currentUser?.role === 'agent commercial' ? '*** F' : `${selectedClient.balances.epargne.toLocaleString()} F`}</p>
                      </div>
                    </div>
                    <div className="text-right hidden sm:block">
                      <p className="text-[10px] font-bold text-blue-300 uppercase tracking-widest opacity-70">Compte N°</p>
                      <p className="text-lg font-black text-white">{selectedClient.epargneAccountNumber || 'N/A'}</p>
                    </div>
                  </div>

                  <div className="bg-[#121c32] rounded-[2rem] p-6 sm:p-8 shadow-sm border border-white/5">
                    <div className="flex items-center justify-between mb-8">
                      <div className="flex items-center gap-3">
                        <History size={20} className="text-blue-400" />
                        <h3 className="text-lg font-black text-white uppercase tracking-tight">Journal d'Épargne</h3>
                      </div>
                    </div>
                    
                    <div className="space-y-4">
                      {selectedClient.history.filter(tx => tx.account === 'epargne' || tx.destinationAccount === 'epargne').length > 0 ? (
                        selectedClient.history.filter(tx => tx.account === 'epargne' || tx.destinationAccount === 'epargne').map((tx) => {
                          const isIncoming = tx.destinationAccount === 'epargne' || tx.type === 'depot';
                          return (
                            <div key={tx.id} className="flex items-center justify-between p-5 bg-white/5 rounded-2xl border border-white/5 hover:border-blue-500/20 transition-all">
                              <div className="flex items-center gap-4 flex-1 min-w-0">
                                <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${isIncoming ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}>
                                  {isIncoming ? <ArrowDownLeft size={20} /> : <ArrowUpRight size={20} />}
                                </div>
                                <div className="min-w-0">
                                  <p className="text-sm font-black text-white uppercase">{tx.description}</p>
                                  <p className="text-[10px] font-bold text-gray-500 uppercase">
                                    {new Date(tx.date).toLocaleDateString()} • {new Date(tx.date).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                    {tx.cashierName && ` • OP: ${tx.cashierName}`}
                                  </p>
                                </div>
                              </div>
                              <div className="text-right shrink-0 ml-4">
                                <p className={`text-base font-black ${isIncoming ? 'text-emerald-400' : 'text-red-400'}`}>
                                  {isIncoming ? '+' : '-'}{tx.amount.toLocaleString()} F
                                </p>
                                <div className="flex flex-col items-end gap-0.5 mt-0.5">
                                  <p className="text-[9px] font-bold text-gray-600 uppercase">Avant: {tx.balanceBefore?.toLocaleString() || '---'} F</p>
                                  <p className="text-[9px] font-black text-blue-400 uppercase">Solde: {tx.balance?.toLocaleString() || '---'} F</p>
                                </div>
                              </div>
                            </div>
                          );
                        })
                      ) : (
                        <div className="py-12 text-center">
                          <p className="text-gray-600 italic text-sm">Aucune opération d'épargne enregistrée</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'tontine' && (
                <div className="space-y-6">
                  {selectedClient.tontineAccounts.length > 0 && (
                    <div className="bg-[#121c32] p-2 rounded-[1.5rem] border border-white/5 flex gap-2 overflow-x-auto scrollbar-hide shadow-sm items-center">
                      {selectedClient.tontineAccounts.filter(acc => !acc.isInvisible || currentUser?.role === 'administrateur').map(acc => (
                        <button 
                          key={acc.id} 
                          onClick={() => setSelectedTontineId(acc.id)}
                          className={`px-6 py-2 rounded-xl font-black text-xs uppercase tracking-tighter whitespace-nowrap transition-all ${selectedTontineId === acc.id ? 'bg-emerald-600 text-white shadow-md' : 'bg-white/5 text-gray-500'}`}
                        >
                          <span className="flex items-center gap-1">
                            {acc.number}
                            {acc.isBlocked && <Lock size={10} />}
                            {acc.isInvisible && <AlertCircle size={10} className="text-amber-500" />}
                          </span>
                        </button>
                      ))}
                      <button 
                        onClick={() => setShowAddTontineModal(true)}
                        className="px-4 py-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-black text-xs uppercase tracking-tighter whitespace-nowrap hover:bg-emerald-500/20 transition-all flex items-center gap-1"
                      >
                        <Plus size={14} /> Nouveau
                      </button>
                    </div>
                  )}

                  <div className="bg-[#121c32] rounded-[2rem] p-4 shadow-sm border border-white/5">
                    <div className="flex items-center justify-between gap-4 p-2 bg-white/5 rounded-[1.5rem]">
                        <button onClick={() => setTontineSubTab('journal')} className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm ${tontineSubTab === 'journal' ? 'bg-white/10 text-white shadow-sm' : 'text-gray-500'}`}><History size={18} /> JOURNAL</button>
                        <button onClick={() => setTontineSubTab('cases')} className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm ${tontineSubTab === 'cases' ? 'bg-[#00c896] text-white shadow-md' : 'text-gray-500'}`}><LayoutGrid size={18} /> CASES</button>
                    </div>
                  </div>

                  {activeTontine && tontineSubTab === 'journal' && (
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4 bg-[#121c32] p-4 rounded-2xl border border-white/5 shadow-sm">
                        <div className="space-y-1">
                          <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest flex items-center gap-1"><Calendar size={12} /> Date de début</label>
                          <input 
                            type="date" 
                            value={journalStartDate} 
                            onChange={(e) => setJournalStartDate(e.target.value)} 
                            className="w-full p-2 bg-white/5 border border-white/5 rounded-xl text-xs font-bold outline-none focus:border-[#00c896] text-white" 
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest flex items-center gap-1"><Calendar size={12} /> Date de fin</label>
                          <input 
                            type="date" 
                            value={journalEndDate} 
                            onChange={(e) => setJournalEndDate(e.target.value)} 
                            className="w-full p-2 bg-white/5 border border-white/5 rounded-xl text-xs font-bold outline-none focus:border-[#00c896] text-white" 
                          />
                        </div>
                      </div>

                      {selectedClient.history.filter(tx => {
                        const matchesAccount = tx.account === 'tontine' && (tx.tontineAccountId === activeTontine.id || !tx.tontineAccountId);
                        if (!matchesAccount) return false;
                        const txDate = tx.date.split('T')[0];
                        if (journalStartDate && txDate < journalStartDate) return false;
                        if (journalEndDate && txDate > journalEndDate) return false;
                        return true;
                      }).length > 0 ? (
                        selectedClient.history
                          .filter(tx => {
                            const matchesAccount = tx.account === 'tontine' && (tx.tontineAccountId === activeTontine.id || !tx.tontineAccountId);
                            if (!matchesAccount) return false;
                            const txDate = tx.date.split('T')[0];
                            if (journalStartDate && txDate < journalStartDate) return false;
                            if (journalEndDate && txDate > journalEndDate) return false;
                            return true;
                          })
                          .map((tx) => {
                            const isIncoming = tx.type === 'depot' || tx.type === 'cotisation';
                            return (
                              <div key={tx.id} className="bg-[#121c32] p-4 rounded-2xl border border-white/5 shadow-sm flex items-center justify-between">
                                <div className="flex items-center gap-4 flex-1 min-w-0">
                                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${isIncoming ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}>
                                    {isIncoming ? <ArrowDownLeft size={18} /> : <ArrowUpRight size={18} />}
                                  </div>
                                  <div className="min-w-0">
                                    <p className="text-sm font-black text-white uppercase">{tx.description}</p>
                                    <p className="text-[10px] font-bold text-gray-500 uppercase">
                                      {new Date(tx.date).toLocaleDateString()} • {new Date(tx.date).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                      {tx.cashierName && ` • OP: ${tx.cashierName}`}
                                    </p>
                                  </div>
                                </div>
                                <div className="flex flex-col items-end gap-0.5 shrink-0 ml-4">
                                  <p className={`text-sm font-black ${isIncoming ? 'text-emerald-400' : 'text-red-400'}`}>
                                    {isIncoming ? '+' : '-'}{tx.amount.toLocaleString()} F
                                  </p>
                                  <p className="text-[9px] font-bold text-gray-600 uppercase">Avant: {tx.balanceBefore?.toLocaleString() || '---'} F</p>
                                  <p className="text-[9px] font-black text-blue-400 uppercase">Solde: {tx.balance?.toLocaleString() || '---'} F</p>
                                </div>
                              </div>
                            );
                          })
                      ) : (
                        <div className="bg-[#121c32] rounded-[2rem] p-12 text-center border border-white/5">
                          <p className="text-gray-600 italic text-sm">Aucune opération trouvée pour cette période.</p>
                        </div>
                      )}
                    </div>
                  )}

                  {activeTontineStats && tontineSubTab === 'cases' && (
                    <div className="space-y-6">
                      <div className="bg-[#0f172a] rounded-[2rem] p-6 text-white flex items-center justify-between shadow-xl border border-white/5">
                        <div className="flex items-center gap-4">
                          <div className="bg-[#00c896] p-3 rounded-2xl"><Wallet size={24} /></div>
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest opacity-70">
                                SOLDE COMPTE {activeTontine?.number} {activeTontine?.zone ? `(ZONE ${activeTontine.zone})` : ''} (NET)
                              </p>
                              <button 
                                onClick={() => setShowEditTontineModal(true)}
                                className="p-1 hover:bg-white/10 rounded text-gray-500 hover:text-white transition-all"
                                title="Modifier le compte"
                              >
                                <RefreshCw size={12} />
                              </button>
                            </div>
                            <p className="text-3xl font-black text-white">{activeTontineStats.netBalance.toLocaleString()} F</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-[8px] font-bold text-gray-500 uppercase tracking-widest">COMMISSIONS (1ère COTIS. / CYCLE)</p>
                          <p className="text-sm font-black text-amber-400">-{activeTontineStats.commission.toLocaleString()} F</p>
                        </div>
                      </div>

                      <div className="bg-[#121c32] rounded-[2rem] p-6 border border-white/5 shadow-sm space-y-6">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-4">
                            <h4 className="text-sm font-black text-white uppercase tracking-tight">Détails des Cycles (Périodes 31 Jours)</h4>
                            <button 
                              onClick={() => {
                                if (cyclesListRef.current) {
                                  cyclesListRef.current.scrollTop = cyclesListRef.current.scrollHeight;
                                }
                              }}
                              className="text-[9px] font-black text-white bg-emerald-600 px-2 py-1 rounded-md uppercase hover:bg-emerald-700 transition-all active:scale-90 shadow-sm"
                            >
                              Dernier cycle
                            </button>
                          </div>
                          <TrendingUp size={16} className="text-emerald-400" />
                        </div>
                        
                        <div ref={cyclesListRef} className="space-y-3 max-h-[350px] overflow-y-auto pr-1 custom-scrollbar">
                          {activeTontineStats.cycleDetails.filter(c => c.amount >= 0).map((cycle, i) => (
                            <div key={i} className="flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/5 mr-1">
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center text-[10px] font-black">C{cycle.index}</div>
                                <div className="flex flex-col">
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs font-black text-white uppercase">Cycle {cycle.index} ({cycle.cases} cases payées)</span>
                                    {cycle.isRetire && <span className="bg-red-500/10 text-red-400 text-[8px] font-black px-1.5 py-0.5 rounded border border-red-500/20 uppercase">Retiré {cycle.retraitDate ? `le ${cycle.retraitDate}` : ''}</span>}
                                  </div>
                                  <span className="text-[10px] font-bold text-gray-500 uppercase">{cycle.period}</span>
                                </div>
                              </div>
                              <div className="text-right flex flex-col items-end gap-1">
                                <div className="flex items-center gap-2">
                                  <span className="text-[8px] font-bold text-gray-500 uppercase">Disponible:</span>
                                  <span className="text-xs font-black text-white">{cycle.disponible.toLocaleString()} F</span>
                                </div>
                                {cycle.isRetire && (
                                  <div className="flex items-center gap-2">
                                    <span className="text-[8px] font-bold text-red-400 uppercase">Montant retiré:</span>
                                    <span className="text-xs font-black text-red-400">{cycle.montantRetire.toLocaleString()} F</span>
                                  </div>
                                )}
                                <div className="flex items-center gap-2">
                                  <span className="text-[8px] font-bold text-red-400 uppercase">Comm:</span>
                                  <span className="text-xs font-bold text-red-400">-{cycle.commission.toLocaleString()} F</span>
                                </div>
                                <div className="flex items-center gap-2 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                                  <span className="text-[8px] font-bold text-emerald-400 uppercase">Décaissable:</span>
                                  <span className="text-sm font-black text-emerald-400">{cycle.decaissable.toLocaleString()} F</span>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div id="grille-cases" className="bg-[#121c32] rounded-[2rem] p-6 border border-white/5 shadow-sm">
                        <div className="flex items-center justify-between mb-6">
                          <h4 className="text-sm font-black text-white uppercase tracking-tight">Cycle Temporel en cours</h4>
                          <span className="text-[10px] font-black text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded-md uppercase">
                            Cycle {activeTontineStats.cycles} • Case {activeTontine.balance === 0 ? 0 : activeTontineStats.currentCycleCases}/31
                          </span>
                        </div>
                        <div className="grid grid-cols-7 sm:grid-cols-10 gap-2 sm:gap-3">
                          {Array.from({ length: 31 }).map((_, i) => {
                            const caseNum = i + 1;
                            const isBalanceZero = activeTontine.balance === 0;
                            const isPaid = !isBalanceZero && caseNum <= activeTontineStats.currentCycleCases;
                            const isCommission = caseNum === 1;
                            const isEmptyCycle = activeTontineStats.currentCycleCases === 0 || isBalanceZero;
                            const isCurrentCycleRetire = activeTontineStats.cycleDetails[activeTontineStats.cycleDetails.length - 1]?.isRetire || isBalanceZero;

                            return (
                              <div 
                                key={i} 
                                className={`aspect-square rounded-xl flex items-center justify-center font-black transition-all border-2
                                  ${isPaid 
                                    ? (isCommission ? 'bg-indigo-600 border-indigo-700 text-white shadow-sm text-xs sm:text-sm' : 'bg-[#00c896] border-[#00c896] text-white shadow-sm text-xs sm:text-sm') 
                                    : (isCommission && !isBalanceZero && !isCurrentCycleRetire)
                                      ? (isEmptyCycle ? 'bg-amber-400 border-amber-500 text-white animate-pulse text-xs sm:text-sm' : 'bg-amber-500/10 border-amber-500/20 text-amber-400 text-xs sm:text-sm') 
                                      : 'bg-white/5 border-white/5 text-gray-700 text-xs sm:text-sm'
                                  }
                                `}
                              >
                                {isBalanceZero
                                  ? ''
                                  : isPaid 
                                    ? activeTontineStats.currentCycleDates[i] 
                                    : (isCurrentCycleRetire ? '' : (isCommission ? 'COM' : caseNum))
                                }
                              </div>
                            );
                          })}
                        </div>
                        <p className="text-[9px] font-bold text-gray-500 mt-4 uppercase tracking-widest text-center">Règle : La 1ère cotisation de chaque cycle (31 jours ou 31 cases) constitue la commission de l'institution.</p>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'credit' && (
                <div className="space-y-6">
                  <div className="bg-[#0f172a] rounded-[2rem] p-8 text-white flex items-center justify-between shadow-xl border border-white/5">
                    <div className="flex items-center gap-4">
                      <div className="bg-purple-600 p-4 rounded-2xl shadow-lg shadow-purple-600/20"><CreditCard size={28} /></div>
                      <div>
                        <p className="text-[10px] font-bold text-purple-300 uppercase tracking-widest opacity-70">ENCOURS DE CRÉDIT TOTAL</p>
                        <p className="text-4xl font-black">{selectedClient.balances.credit.toLocaleString()} F</p>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-[#121c32] p-6 rounded-[2rem] border border-white/5 shadow-sm">
                      <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Date de Déblocage</p>
                      <p className="text-xl font-black text-white mt-1">
                        {(selectedClient as any).lastCreditRequest?.disbursementDate 
                          ? new Date((selectedClient as any).lastCreditRequest.disbursementDate).toLocaleDateString() 
                          : 'N/A'}
                      </p>
                    </div>
                    <div className="bg-[#121c32] p-6 rounded-[2rem] border border-white/5 shadow-sm">
                      <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Échéance</p>
                      <p className="text-xl font-black text-red-400 mt-1">
                        {(selectedClient as any).lastCreditRequest?.dueDate || (selectedClient as any).lastCreditDetails?.dueDate
                          ? new Date((selectedClient as any).lastCreditRequest?.dueDate || (selectedClient as any).lastCreditDetails?.dueDate).toLocaleDateString()
                          : 'N/A'}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="bg-[#121c32] p-6 rounded-[2rem] border border-white/5 shadow-sm">
                      <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Capital Restant</p>
                      <p className="text-xl font-black text-white mt-1">
                        {(() => {
                          const total = selectedClient.balances.credit;
                          const initialCap = (selectedClient as any).lastCreditDetails?.capital || (selectedClient as any).lastCreditRequest?.capital;
                          const initialInt = (selectedClient as any).lastCreditDetails?.interest || (selectedClient as any).lastCreditRequest?.interest;
                          const initialPen = (selectedClient as any).lastCreditDetails?.penalty || (selectedClient as any).lastCreditRequest?.penalty || 0;
                          
                          if (initialCap !== undefined) return Number(initialCap).toLocaleString();
                          
                          // Fallback if no details
                          const initialTot = Number(total);
                          return Math.floor(initialTot * 0.9).toLocaleString();
                        })()} F
                      </p>
                    </div>
                    <div className="bg-[#121c32] p-6 rounded-[2rem] border border-white/5 shadow-sm">
                      <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Intérêts Attendus</p>
                      <p className="text-xl font-black text-blue-400 mt-1">
                        {(() => {
                          const total = selectedClient.balances.credit;
                          const initialInt = (selectedClient as any).lastCreditDetails?.interest || (selectedClient as any).lastCreditRequest?.interest;
                          
                          if (initialInt !== undefined) return Number(initialInt).toLocaleString();
                          
                          // Fallback if no details
                          const initialTot = Number(total);
                          return Math.floor(initialTot * 0.1).toLocaleString();
                        })()} F
                      </p>
                    </div>
                    <div className="bg-[#121c32] p-6 rounded-[2rem] border border-white/5 shadow-sm">
                      <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Pénalités (Retard)</p>
                      <p className="text-xl font-black text-red-400 mt-1">{((selectedClient as any).lastCreditRequest?.penalty || 0).toLocaleString()} F</p>
                    </div>
                    <div className="bg-[#121c32] p-6 rounded-[2rem] border border-white/5 shadow-sm">
                      <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Ristournes</p>
                      <p className="text-xl font-black text-emerald-400 mt-1">{((selectedClient as any).lastCreditRequest?.rebate || 0).toLocaleString()} F</p>
                    </div>
                  </div>

                  <div className="bg-[#121c32] rounded-[2rem] p-6 sm:p-8 shadow-sm border border-white/5">
                    <div className="flex items-center justify-between mb-8">
                      <div className="flex items-center gap-3">
                        <History size={20} className="text-purple-400" />
                        <h3 className="text-lg font-black text-white uppercase tracking-tight">Journal des Crédits</h3>
                      </div>
                    </div>
                    <div className="space-y-4">
                      {selectedClient.history.filter(tx => tx.account === 'credit').length > 0 ? (
                        selectedClient.history.filter(tx => tx.account === 'credit').map((tx) => (
                          <div key={tx.id} className="flex items-center justify-between p-5 bg-white/5 rounded-2xl border border-white/5">
                            <div className="flex items-center gap-4 flex-1 min-w-0">
                              <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${tx.type === 'remboursement' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}>
                                {tx.type === 'remboursement' ? <ArrowDownLeft size={20} /> : <ArrowUpRight size={20} />}
                              </div>
                              <div className="min-w-0">
                                <p className="text-sm font-black text-white uppercase">{tx.description}</p>
                                <p className="text-[10px] font-bold text-gray-500 uppercase tracking-tight">
                                  {new Date(tx.date).toLocaleDateString()} • {new Date(tx.date).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                  {tx.cashierName && ` • OP: ${tx.cashierName}`}
                                </p>
                              </div>
                            </div>
                            <p className={`text-base font-black shrink-0 ml-4 ${tx.type === 'remboursement' ? 'text-emerald-400' : 'text-red-400'}`}>
                              {tx.type === 'remboursement' ? '-' : '+'}{tx.amount.toLocaleString()} F
                            </p>
                          </div>
                        ))
                      ) : (
                        <div className="py-12 text-center text-gray-600 italic text-sm">
                          Aucun historique de crédit enregistré
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'garantie' && (
                <div className="space-y-6">
                  <div className="bg-[#451a03] rounded-[2rem] p-8 text-white flex items-center justify-between shadow-xl border-b-4 border-amber-500">
                    <div className="flex items-center gap-4">
                      <div className="bg-amber-500 p-4 rounded-2xl shadow-lg shadow-amber-500/20"><ShieldCheck size={28} /></div>
                      <div>
                        <p className="text-[10px] font-bold text-amber-200 uppercase tracking-widest opacity-70">VALEUR TOTALE DES GARANTIES</p>
                        <p className="text-4xl font-black">{currentUser?.role === 'agent commercial' ? '*** F' : `${selectedClient.balances.garantie.toLocaleString()} F`}</p>
                      </div>
                    </div>
                  </div>

                  <div className="bg-[#121c32] rounded-[2rem] p-6 sm:p-8 shadow-sm border border-white/5">
                    <div className="flex items-center justify-between mb-8">
                      <div className="flex items-center gap-3">
                        <ShieldCheck size={20} className="text-amber-400" />
                        <h3 className="text-lg font-black text-white uppercase tracking-tight">Journal des Garanties</h3>
                      </div>
                    </div>
                    
                    <div className="space-y-4">
                      {selectedClient.history.filter(tx => tx.account === 'garantie' || tx.destinationAccount === 'garantie').length > 0 ? (
                        selectedClient.history.filter(tx => tx.account === 'garantie' || tx.destinationAccount === 'garantie').map((tx) => {
                          const isIncoming = tx.destinationAccount === 'garantie' || tx.type === 'depot';
                          return (
                            <div key={tx.id} className="flex items-center justify-between p-5 bg-white/5 rounded-2xl border border-white/5 hover:border-amber-500/20 transition-all">
                              <div className="flex items-center gap-4 flex-1 min-w-0">
                                <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${isIncoming ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-400'}`}>
                                  {isIncoming ? <ArrowDownLeft size={20} /> : <ArrowUpRight size={20} />}
                                </div>
                                <div className="min-w-0">
                                  <p className="text-sm font-black text-white uppercase">{tx.description}</p>
                                  <p className="text-[10px] font-bold text-gray-500 uppercase tracking-tight">
                                    {new Date(tx.date).toLocaleDateString()} • {new Date(tx.date).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                    {tx.cashierName && ` • OP: ${tx.cashierName}`}
                                  </p>
                                </div>
                              </div>
                              <p className={`text-base font-black shrink-0 ml-4 ${isIncoming ? 'text-emerald-400' : 'text-red-400'}`}>
                                {isIncoming ? '+' : '-'}{tx.amount.toLocaleString()} F
                              </p>
                            </div>
                          );
                        })
                      ) : (
                        <div className="py-12 text-center text-gray-600 italic text-sm">
                          Aucune garantie enregistrée pour ce client
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'partSociale' && (
                <div className="space-y-6">
                  <div className="bg-[#4a044e] rounded-[2rem] p-8 text-white flex items-center justify-between shadow-xl border-b-4 border-pink-500">
                    <div className="flex items-center gap-4">
                      <div className="bg-pink-500 p-4 rounded-2xl shadow-lg shadow-pink-500/20"><Gem size={28} /></div>
                      <div>
                        <p className="text-[10px] font-bold text-pink-200 uppercase tracking-widest opacity-70">CAPITAL SOCIAL (PARTS)</p>
                        <p className="text-4xl font-black">{selectedClient.balances.partSociale.toLocaleString()} F</p>
                        <div className="mt-2 flex items-center gap-2">
                          <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-md ${selectedClient.balances.partSociale >= 5000 ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'}`}>
                            {selectedClient.balances.partSociale >= 5000 ? 'Libérée (Totalité payée)' : `Partielle (Reste: ${5000 - selectedClient.balances.partSociale} F)`}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="bg-[#121c32] rounded-[2rem] p-6 sm:p-8 shadow-sm border border-white/5">
                    <div className="flex items-center justify-between mb-8">
                      <div className="flex items-center gap-3">
                        <Gem size={20} className="text-pink-400" />
                        <h3 className="text-lg font-black text-white uppercase tracking-tight">Journal des Parts Sociales</h3>
                      </div>
                    </div>
                    
                    <div className="space-y-4">
                      {selectedClient.history.filter(tx => tx.account === 'partSociale' || tx.destinationAccount === 'partSociale').length > 0 ? (
                        selectedClient.history.filter(tx => tx.account === 'partSociale' || tx.destinationAccount === 'partSociale').map((tx) => {
                          const isIncoming = tx.destinationAccount === 'partSociale' || tx.type === 'depot';
                          return (
                            <div key={tx.id} className="flex items-center justify-between p-5 bg-white/5 rounded-2xl border border-white/5 hover:border-pink-500/20 transition-all">
                              <div className="flex items-center gap-4 flex-1 min-w-0">
                                <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${isIncoming ? 'bg-emerald-500/10 text-emerald-400' : 'bg-pink-500/10 text-pink-400'}`}>
                                  {isIncoming ? <ArrowDownLeft size={20} /> : <ArrowUpRight size={20} />}
                                </div>
                                <div className="min-w-0">
                                  <p className="text-sm font-black text-white uppercase">{tx.description}</p>
                                  <p className="text-[10px] font-bold text-gray-500 uppercase tracking-tight">
                                    {new Date(tx.date).toLocaleDateString()} • {new Date(tx.date).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                    {tx.cashierName && ` • OP: ${tx.cashierName}`}
                                  </p>
                                </div>
                              </div>
                              <p className={`text-base font-black shrink-0 ml-4 ${isIncoming ? 'text-emerald-400' : 'text-pink-400'}`}>
                                {isIncoming ? '+' : '-'}{tx.amount.toLocaleString()} F
                              </p>
                            </div>
                          );
                        })
                      ) : (
                        <div className="py-12 text-center text-gray-600 italic text-sm">
                          Aucun mouvement de part sociale enregistré
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'profile' && selectedClient && (
                <EditProfileForm 
                  client={selectedClient} 
                  onSave={handleUpdateProfile} 
                />
              )}

              {activeTab === 'current_credit' && selectedClient && (
                <div className="space-y-6">
                  <div className="bg-[#121c32] rounded-[2rem] p-8 border border-white/5 shadow-sm">
                    <div className="flex items-center justify-between mb-8">
                      <div className="flex items-center gap-4">
                        <div className="bg-red-600 p-4 rounded-2xl shadow-lg text-white"><CreditCard size={28} /></div>
                        <h3 className="text-xl font-black uppercase tracking-tight text-white">Dossier crédit actuel</h3>
                      </div>
                      {!isEditingCredit ? (
                        currentUser?.role !== 'agent commercial' && currentUser?.role !== 'caissier' && (
                          <div className="flex gap-2">
                            {selectedClient.balances.credit === 0 && (
                              <button 
                                onClick={() => setActiveTab('credit')}
                                className="px-4 py-2 bg-emerald-500/20 text-emerald-400 rounded-xl font-bold text-xs hover:bg-emerald-500/30 transition-all uppercase tracking-widest border border-emerald-500/20"
                              >
                                Nouveau Crédit
                              </button>
                            )}
                            <button 
                              onClick={handleStartEditCredit}
                              className="px-4 py-2 bg-white/5 text-gray-500 rounded-xl font-bold text-xs hover:text-white transition-all uppercase tracking-widest border border-white/5 shadow-sm"
                            >
                              Mettre à jour la fiche
                            </button>
                          </div>
                        )
                      ) : (
                        <div className="flex gap-2">
                          <button 
                            onClick={() => setIsEditingCredit(false)}
                            className="px-4 py-2 bg-white/5 text-gray-500 rounded-xl font-bold text-xs uppercase tracking-widest"
                          >
                            Annuler
                          </button>
                          <button 
                            onClick={handleSaveCreditInfo}
                            className="px-4 py-2 bg-[#00c896] text-white rounded-xl font-bold text-xs uppercase tracking-widest shadow-lg active:scale-95"
                          >
                            Enregistrer
                          </button>
                        </div>
                      )}
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                      <div className="space-y-4">
                        <div className="p-5 bg-white/5 rounded-2xl border border-white/5">
                          <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">Encours total</p>
                          <p className="text-2xl font-black text-white">{selectedClient.balances.credit.toLocaleString()} F</p>
                        </div>
                        <div className="p-5 bg-white/5 rounded-2xl border border-white/5">
                          <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">Capital restant dû</p>
                          <p className="text-lg font-black text-white">
                            {(() => {
                              const total = selectedClient.balances.credit;
                              const initialCap = (selectedClient as any).lastCreditDetails?.capital || (selectedClient as any).lastCreditRequest?.capital || (total * 0.9);
                              const initialInt = (selectedClient as any).lastCreditDetails?.interest || (selectedClient as any).lastCreditRequest?.interest || (total * 0.1);
                              const initialTot = Number(initialCap) + Number(initialInt);
                              
                              // Si le solde total est égal au montant initial (capital + intérêt), on affiche le capital initial
                              if (Math.abs(total - initialTot) < 1) return Number(initialCap).toLocaleString();
                              
                              const capRatio = initialTot > 0 ? Number(initialCap) / initialTot : 0.9;
                              return Math.floor(total * capRatio).toLocaleString();
                            })()} F
                          </p>
                        </div>
                        
                        <div className="p-5 bg-white/5 rounded-2xl border border-white/5">
                          <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">Dossier instruit par</p>
                          {isEditingCredit ? (
                            <input 
                              type="text" 
                              value={creditFormData.dossierInstruitPar} 
                              onChange={(e) => setCreditFormData({...creditFormData, dossierInstruitPar: e.target.value})}
                              className="w-full bg-[#1e293b] border border-white/10 rounded-lg p-2 text-sm font-bold text-white outline-none focus:border-[#00c896]" 
                            />
                          ) : (
                            <p className="text-sm font-bold text-white">{selectedClient.dossierInstruitPar || 'N/A'}</p>
                          )}
                        </div>
                        
                        <div className="p-5 bg-white/5 rounded-2xl border border-white/5">
                          <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">Durée du crédit</p>
                          {isEditingCredit ? (
                            <input 
                              type="text" 
                              value={creditFormData.dureeCredit} 
                              onChange={(e) => setCreditFormData({...creditFormData, dureeCredit: e.target.value})}
                              className="w-full bg-[#1e293b] border border-white/10 rounded-lg p-2 text-sm font-bold text-white outline-none focus:border-[#00c896]" 
                            />
                          ) : (
                            <p className="text-sm font-bold text-white">{selectedClient.dureeCredit || (selectedClient as any).lastCreditDetails?.duration || (selectedClient as any).lastCreditRequest?.duration || 'N/A'}</p>
                          )}
                        </div>
                        
                        <div className="p-5 bg-white/5 rounded-2xl border border-white/5">
                          <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">nom caution</p>
                          {isEditingCredit ? (
                            <input 
                              type="text" 
                              value={creditFormData.nomCaution} 
                              onChange={(e) => setCreditFormData({...creditFormData, nomCaution: e.target.value})}
                              className="w-full bg-[#1e293b] border border-white/10 rounded-lg p-2 text-sm font-bold text-white outline-none focus:border-[#00c896]" 
                            />
                          ) : (
                            <p className="text-sm font-bold text-white">{selectedClient.nomCaution || 'N/A'}</p>
                          )}
                        </div>
                        
                        <div className="p-5 bg-white/5 rounded-2xl border border-white/5">
                          <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">Référence caution</p>
                          {isEditingCredit ? (
                            <input 
                              type="text" 
                              value={creditFormData.refCaution} 
                              onChange={(e) => setCreditFormData({...creditFormData, refCaution: e.target.value})}
                              className="w-full bg-[#1e293b] border border-white/10 rounded-lg p-2 text-sm font-bold text-white outline-none focus:border-[#00c896]" 
                            />
                          ) : (
                            <p className="text-sm font-bold text-white">{selectedClient.refCaution || 'N/A'}</p>
                          )}
                        </div>
                      </div>
                      
                      <div className="space-y-4">
                        <div className="p-5 bg-white/5 rounded-2xl border border-white/5">
                          <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">Intérêts attendus</p>
                          <p className="text-lg font-black text-blue-400">
                            {(() => {
                              const total = selectedClient.balances.credit;
                              const initialCap = selectedClient.lastCreditDetails?.capital || selectedClient.lastCreditRequest?.capital || (total * 0.9);
                              const initialInt = selectedClient.lastCreditDetails?.interest || selectedClient.lastCreditRequest?.interest || (total * 0.1);
                              const initialTot = Number(initialCap) + Number(initialInt);
                              
                              if (Math.abs(total - initialTot) < 1) return Number(initialInt).toLocaleString();
                              
                              const intRatio = initialTot > 0 ? Number(initialInt) / initialTot : 0.1;
                              return Math.floor(total * intRatio).toLocaleString();
                            })()} F
                          </p>
                        </div>
                        <div className="p-5 bg-white/5 rounded-2xl border border-white/5">
                          <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">Status dossier</p>
                          {isEditingCredit ? (
                            <select 
                              value={creditFormData.statusDossier} 
                              onChange={(e) => setCreditFormData({...creditFormData, statusDossier: e.target.value})}
                              className="w-full bg-[#1e293b] border border-white/10 rounded-lg p-2 text-sm font-bold text-white outline-none focus:border-[#00c896]"
                            >
                              <option value="Sain">Sain</option>
                              <option value="Retard">Retard</option>
                              <option value="Contentieux">Contentieux</option>
                            </select>
                          ) : (
                            <span className={`px-3 py-1 rounded-lg text-xs font-black uppercase ${
                              selectedClient.statusDossier === 'Sain' ? 'bg-emerald-500/10 text-emerald-400' :
                              selectedClient.statusDossier === 'Retard' ? 'bg-amber-500/10 text-amber-400' :
                              'bg-red-500/10 text-red-400'
                            }`}>
                              {selectedClient.statusDossier || 'Sain'}
                            </span>
                          )}
                        </div>
                        
                        <div className="p-5 bg-white/5 rounded-2xl border border-white/5">
                          <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">Adresse</p>
                          {isEditingCredit ? (
                            <input 
                              type="text" 
                              value={creditFormData.adresseCaution} 
                              onChange={(e) => setCreditFormData({...creditFormData, adresseCaution: e.target.value})}
                              className="w-full bg-[#1e293b] border border-white/10 rounded-lg p-2 text-sm font-bold text-white outline-none focus:border-[#00c896]" 
                            />
                          ) : (
                            <p className="text-sm font-bold text-white">{selectedClient.adresseCaution || 'N/A'}</p>
                          )}
                        </div>
                        
                        <div className="p-5 bg-white/5 rounded-2xl border border-white/5">
                          <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">Tél caution</p>
                          {isEditingCredit ? (
                            <input 
                              type="text" 
                              value={creditFormData.telCaution} 
                              onChange={(e) => setCreditFormData({...creditFormData, telCaution: e.target.value})}
                              className="w-full bg-[#1e293b] border border-white/10 rounded-lg p-2 text-sm font-bold text-white outline-none focus:border-[#00c896]" 
                            />
                          ) : (
                            <p className="text-sm font-bold text-white">{selectedClient.telCaution || 'N/A'}</p>
                          )}
                        </div>
                        
                        <div className="p-5 bg-white/5 rounded-2xl border border-white/5">
                          <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">Tél référence</p>
                          {isEditingCredit ? (
                            <input 
                              type="text" 
                              value={creditFormData.telRefCaution} 
                              onChange={(e) => setCreditFormData({...creditFormData, telRefCaution: e.target.value})}
                              className="w-full bg-[#1e293b] border border-white/10 rounded-lg p-2 text-sm font-bold text-white outline-none focus:border-[#00c896]" 
                            />
                          ) : (
                            <p className="text-sm font-bold text-white">{selectedClient.telRefCaution || 'N/A'}</p>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    <div className="mt-8 pt-8 border-t border-white/10">
                      <p className="text-sm font-medium text-gray-500 italic text-center">
                        {isEditingCredit ? "Modification du dossier de crédit..." : "Informations détaillées du crédit en cours de consultation..."}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'credit_archives' && (
                <div className="space-y-6">
                  {(() => {
                    const credits: any[] = [];
                    let currentCredit: any = null;
                    const sortedHistory = [...(selectedClient?.history || [])].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

                    sortedHistory.forEach(tx => {
                      if (tx.account === 'credit') {
                        if (tx.type === 'deblocage') {
                          if (currentCredit) credits.push(currentCredit);
                          currentCredit = {
                            id: tx.id,
                            date: tx.date,
                            amount: tx.amount,
                            description: tx.description,
                            cashierName: tx.cashierName,
                            repayments: [],
                            totalRepaid: 0
                          };
                        } else if (tx.type === 'remboursement' && currentCredit) {
                          currentCredit.repayments.push({
                            id: tx.id,
                            date: tx.date,
                            amount: tx.amount,
                            capital: tx.rembCapital || 0,
                            interest: tx.rembInterest || 0,
                            penalty: tx.rembPenalty || 0,
                            cashierName: tx.cashierName
                          });
                          currentCredit.totalRepaid += tx.amount;
                        }
                      }
                    });
                    if (currentCredit) credits.push(currentCredit);
                    const archives = credits.reverse();

                    if (archives.length === 0) {
                      return (
                        <div className="bg-[#121c32] rounded-[2rem] p-12 text-center border border-white/5">
                          <History size={48} className="text-gray-700 mx-auto mb-4 opacity-20" />
                          <p className="text-gray-500 font-bold uppercase tracking-widest text-sm">Aucun historique de crédit archivé</p>
                        </div>
                      );
                    }

                    return archives.map((credit, idx) => (
                      <div key={credit.id} className="bg-[#121c32] rounded-[2rem] border border-white/5 overflow-hidden shadow-sm">
                        <div className="bg-white/5 p-6 flex items-center justify-between border-b border-white/5">
                          <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 flex items-center justify-center text-emerald-400">
                              <CreditCard size={24} />
                            </div>
                            <div>
                              <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Crédit N° {archives.length - idx}</p>
                              <h4 className="text-lg font-black text-white uppercase tracking-tight">{credit.amount.toLocaleString()} F</h4>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Date Déblocage</p>
                            <p className="text-sm font-bold text-gray-300">
                              {new Date(credit.date).toLocaleDateString()}
                              {credit.cashierName && ` • OP: ${credit.cashierName}`}
                            </p>
                          </div>
                        </div>
                        
                        <div className="p-6 space-y-6">
                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                            <div className="p-4 bg-white/5 rounded-2xl border border-white/5 text-center">
                              <p className="text-[9px] font-black text-gray-500 uppercase tracking-widest mb-1">Total Remboursé</p>
                              <p className="text-base font-black text-emerald-400">{credit.totalRepaid.toLocaleString()} F</p>
                            </div>
                            <div className="p-4 bg-white/5 rounded-2xl border border-white/5 text-center">
                              <p className="text-[9px] font-black text-gray-500 uppercase tracking-widest mb-1">Reste à payer</p>
                              <p className="text-base font-black text-red-400">{Math.max(0, credit.amount - credit.totalRepaid).toLocaleString()} F</p>
                            </div>
                            <div className="p-4 bg-white/5 rounded-2xl border border-white/5 text-center col-span-2 sm:col-span-1">
                              <p className="text-[9px] font-black text-gray-500 uppercase tracking-widest mb-1">Statut</p>
                              <p className={`text-xs font-black uppercase ${credit.totalRepaid >= credit.amount ? 'text-emerald-400' : 'text-amber-400'}`}>
                                {credit.totalRepaid >= credit.amount ? 'Soldé' : 'En cours'}
                              </p>
                            </div>
                          </div>

                          <div className="space-y-3">
                            <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Historique des remboursements</p>
                            {credit.repayments.length > 0 ? (
                              <div className="space-y-2">
                                {credit.repayments.map((remb: any) => (
                                  <div key={remb.id} className="flex items-center justify-between p-4 bg-white/5 rounded-xl border border-white/5 hover:bg-white/10 transition-all">
                                    <div className="flex items-center gap-3">
                                      <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-400">
                                        <ArrowDownLeft size={16} />
                                      </div>
                                      <div>
                                        <p className="text-xs font-black text-white uppercase">{new Date(remb.date).toLocaleDateString()}</p>
                                        <p className="text-[9px] font-bold text-gray-500 uppercase tracking-tight">
                                          Cap: {remb.capital.toLocaleString()} | Int: {remb.interest.toLocaleString()}
                                          {remb.cashierName && ` | OP: ${remb.cashierName}`}
                                        </p>
                                      </div>
                                    </div>
                                    <p className="text-sm font-black text-emerald-400">+{remb.amount.toLocaleString()} F</p>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <div className="p-4 bg-white/5 rounded-xl border border-dashed border-white/10 text-center text-[10px] font-bold text-gray-600 uppercase">
                                Aucun remboursement effectué
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ));
                  })()}
                </div>
              )}
            </div>
          </>
        )}
      </div>
      <ConfirmModal
        isOpen={confirmModal.isOpen}
        title={confirmModal.title}
        message={confirmModal.message}
        onConfirm={confirmModal.onConfirm}
        onCancel={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
        type={confirmModal.type}
      />
    </div>
  </div>
);
};

export default Members;