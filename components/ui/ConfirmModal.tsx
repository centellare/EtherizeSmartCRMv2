
import React from 'react';
import { Button } from './Button';

interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  confirmVariant?: 'primary' | 'secondary' | 'danger' | 'tonal';
  loading?: boolean;
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({ 
  isOpen, 
  onClose, 
  onConfirm, 
  title, 
  message, 
  confirmLabel = 'Подтвердить', 
  cancelLabel = 'Отмена',
  confirmVariant = 'danger',
  loading 
}) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-[1100] flex items-center justify-center p-4 bg-[#1c1b1f]/30 backdrop-blur-[1px] animate-in fade-in duration-200">
      <div className="bg-[#fffbff] w-full max-w-sm p-8 rounded-[32px] shadow-2xl animate-in zoom-in-95 duration-200">
        <div className="flex justify-center mb-6">
          <div className={`w-16 h-16 rounded-full flex items-center justify-center ${confirmVariant === 'danger' ? 'bg-red-50 text-red-600' : 'bg-blue-50 text-blue-600'}`}>
            <span className="material-icons-round text-4xl">
              {confirmVariant === 'danger' ? 'warning' : 'info'}
            </span>
          </div>
        </div>
        <h3 className="text-xl font-medium text-center text-[#1c1b1f] mb-3">{title}</h3>
        <p className="text-[#444746] text-sm text-center mb-8 leading-relaxed px-2">{message}</p>
        <div className="flex flex-col gap-2">
          <Button 
            variant={confirmVariant} 
            onClick={onConfirm} 
            loading={loading}
            className="w-full h-12"
          >
            {confirmLabel}
          </Button>
          <Button 
            variant="ghost" 
            onClick={onClose} 
            disabled={loading}
            className="w-full h-12"
          >
            {cancelLabel}
          </Button>
        </div>
      </div>
    </div>
  );
};
