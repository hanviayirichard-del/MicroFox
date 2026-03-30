import React from 'react';
import { X, AlertCircle, CheckCircle, Info } from 'lucide-react';

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
  type?: 'confirm' | 'alert' | 'success' | 'error';
  confirmText?: string;
  cancelText?: string;
}

const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  title,
  message,
  onConfirm,
  onCancel,
  type = 'confirm',
  confirmText = 'Confirmer',
  cancelText = 'Annuler'
}) => {
  if (!isOpen) return null;

  const getIcon = () => {
    switch (type) {
      case 'confirm': return <Info className="text-blue-500" size={32} />;
      case 'alert': return <AlertCircle className="text-amber-500" size={32} />;
      case 'error': return <AlertCircle className="text-red-500" size={32} />;
      case 'success': return <CheckCircle className="text-emerald-500" size={32} />;
      default: return <Info className="text-blue-500" size={32} />;
    }
  };

  const getButtonColor = () => {
    switch (type) {
      case 'confirm': return 'bg-blue-600 hover:bg-blue-700';
      case 'alert': return 'bg-amber-600 hover:bg-amber-700';
      case 'error': return 'bg-red-600 hover:bg-red-700';
      case 'success': return 'bg-emerald-600 hover:bg-emerald-700';
      default: return 'bg-[#121c32] hover:bg-[#1a2947]';
    }
  };

  return (
    <div className="fixed inset-0 z-[999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-[2rem] w-full max-w-md overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
        <div className="p-8">
          <div className="flex items-center gap-4 mb-6">
            <div className="p-3 bg-gray-50 rounded-2xl">
              {getIcon()}
            </div>
            <h3 className="text-xl font-black text-[#121c32] uppercase tracking-tight">{title}</h3>
          </div>
          
          <p className="text-gray-600 font-medium leading-relaxed mb-8">
            {message}
          </p>

          <div className="flex items-center gap-3">
            {type === 'confirm' && (
              <button
                onClick={onCancel}
                className="flex-1 py-4 bg-gray-100 text-gray-600 rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-gray-200 transition-all"
              >
                {cancelText}
              </button>
            )}
            <button
              onClick={onConfirm}
              className={`flex-1 py-4 text-white rounded-2xl font-black uppercase tracking-widest text-xs shadow-lg active:scale-95 transition-all ${getButtonColor()}`}
            >
              {type === 'confirm' ? confirmText : 'OK'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ConfirmModal;
