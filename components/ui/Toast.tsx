
import React, { useEffect } from 'react';

interface ToastProps {
  message: string;
  type?: 'success' | 'error' | 'info';
  onClose: () => void;
  duration?: number;
}

export const Toast: React.FC<ToastProps> = ({ message, type = 'success', onClose, duration = 3000 }) => {
  useEffect(() => {
    const timer = setTimeout(onClose, duration);
    return () => clearTimeout(timer);
  }, [onClose, duration]);

  const styles = {
    success: 'bg-emerald-600 text-white',
    error: 'bg-red-600 text-white',
    info: 'bg-blue-600 text-white'
  };

  const icons = {
    success: 'check_circle',
    error: 'error',
    info: 'info'
  };

  return (
    <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[1200] animate-in slide-in-from-bottom-4 duration-300">
      <div className={`${styles[type]} px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-3 min-w-[300px]`}>
        <span className="material-icons-round">{icons[type]}</span>
        <span className="text-sm font-bold tracking-tight">{message}</span>
      </div>
    </div>
  );
};
