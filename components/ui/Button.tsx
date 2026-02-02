
import React from 'react';

interface ButtonProps {
  onClick?: (e: React.MouseEvent) => void;
  children?: React.ReactNode;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'tonal';
  disabled?: boolean;
  loading?: boolean;
  className?: string;
  type?: 'button' | 'submit';
  icon?: string;
}

export const Button: React.FC<ButtonProps> = ({ 
  onClick, 
  children, 
  variant = 'primary', 
  disabled, 
  loading, 
  className = '', 
  type = 'button', 
  icon 
}) => {
  const variants = {
    primary: 'bg-[#005ac1] hover:bg-[#004a9d] text-white shadow-sm',
    secondary: 'border border-[#747775] text-[#005ac1] hover:bg-[#005ac1]/5',
    tonal: 'bg-[#d3e4ff] text-[#001d3d] hover:bg-[#bacde5]',
    danger: 'bg-[#ba1a1a] hover:bg-[#93000a] text-white',
    ghost: 'text-[#005ac1] hover:bg-[#005ac1]/10'
  };
  
  return (
    <button 
      type={type}
      disabled={disabled || loading}
      onClick={(e) => {
        if (onClick) {
          e.stopPropagation();
          onClick(e);
        }
      }}
      className={`h-10 px-6 rounded-full font-medium text-sm transition-all flex items-center justify-center gap-2 tracking-[.00714em] disabled:opacity-38 ${variants[variant]} ${className}`}
    >
      {loading ? (
        <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
      ) : (
        <>
          {icon && <span className="material-icons-round text-[18px]">{icon}</span>}
          {children}
        </>
      )}
    </button>
  );
};
