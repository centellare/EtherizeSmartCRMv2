import React from 'react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}

export const Modal: React.FC<ModalProps> = ({ isOpen, onClose, title, children }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-[#1c1b1f]/40 backdrop-blur-[2px] animate-in fade-in duration-200">
      <div className="bg-[#eff1f8] w-full max-w-lg rounded-[28px] shadow-xl animate-in zoom-in-95 duration-200 relative flex flex-col max-h-[90vh]">
        <div className="flex justify-between items-center p-6 shrink-0">
          <h3 className="text-2xl text-[#1c1b1f] tracking-tight font-normal">{title}</h3>
          <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full transition-colors">
            <span className="material-icons-round text-slate-500">close</span>
          </button>
        </div>
        <div className="flex-grow overflow-y-auto p-6 pt-0 scrollbar-hide">
          {children}
        </div>
      </div>
    </div>
  );
};