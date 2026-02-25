import React from 'react';
import { Button } from './ui';

interface PendingApprovalProps {
  onLogout: () => void;
}

const PendingApproval: React.FC<PendingApprovalProps> = ({ onLogout }) => {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#f7f9fc] p-4">
      <div className="bg-white rounded-3xl shadow-xl p-8 max-w-md w-full text-center border border-slate-100">
        <div className="w-20 h-20 bg-amber-50 text-amber-500 rounded-full flex items-center justify-center mx-auto mb-6">
          <span className="material-icons-round text-4xl">hourglass_empty</span>
        </div>
        
        <h2 className="text-2xl font-bold text-slate-900 mb-2">Ожидание подтверждения</h2>
        <p className="text-slate-500 mb-8">
          Ваша учетная запись зарегистрирована, но требует подтверждения администратора. 
          Пожалуйста, свяжитесь с руководством или дождитесь уведомления.
        </p>

        <div className="bg-blue-50 p-4 rounded-xl text-sm text-blue-700 mb-8 text-left flex items-start gap-3">
          <span className="material-icons-round text-lg shrink-0 mt-0.5">info</span>
          <span>
            После подтверждения вам станут доступны все функции системы согласно вашей роли.
          </span>
        </div>

        <Button onClick={onLogout} variant="secondary" className="w-full h-12">
          Выйти из системы
        </Button>
      </div>
      
      <p className="mt-8 text-xs text-slate-400 font-medium uppercase tracking-widest">
        SmartCRM Security
      </p>
    </div>
  );
};

export default PendingApproval;
