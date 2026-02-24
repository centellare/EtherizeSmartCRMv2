
import React, { useRef, useState } from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  icon?: string;
}

export const Input: React.FC<InputProps> = ({ label, icon, className = '', type = 'text', ...props }) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [showPassword, setShowPassword] = useState(false);
  const isDate = type === 'date';
  const isPassword = type === 'password';

  const handleContainerClick = () => {
    if (isDate && inputRef.current) {
      try {
        // Программный вызов нативного календаря
        if ('showPicker' in HTMLInputElement.prototype) {
          inputRef.current.showPicker();
        } else {
          inputRef.current.focus();
        }
      } catch (e) {
        // Фолбек для старых браузеров
        inputRef.current.focus();
      }
    }
  };

  const togglePasswordVisibility = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowPassword(!showPassword);
  };

  return (
    <div className="w-full">
      {label && (
        <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 ml-1">
          {label}
        </label>
      )}
      <div 
        className={`relative group transition-all duration-200 ${isDate ? 'cursor-pointer active:scale-[0.99]' : ''}`}
        onClick={handleContainerClick}
      >
        {icon && (
          <span className={`absolute left-4 top-1/2 -translate-y-1/2 material-icons-round transition-all duration-300 ${
            isDate 
              ? 'text-[#005ac1] scale-110' // Высокий контраст для дат
              : 'text-[#444746]'
          } group-focus-within:text-[#005ac1] ${isDate ? 'group-hover:scale-125' : ''}`}>
            {icon}
          </span>
        )}
        <input 
          {...props} 
          type={isPassword ? (showPassword ? 'text' : 'password') : type}
          ref={inputRef}
          className={`w-full bg-white border border-slate-200 rounded-2xl px-4 py-3 text-base text-[#1c1b1f] outline-none transition-all placeholder:text-slate-300 focus:border-[#005ac1] focus:ring-4 focus:ring-[#005ac1]/5 ${
            isDate ? 'cursor-pointer hover:border-[#005ac1] hover:bg-slate-50' : ''
          } ${icon ? 'pl-11' : ''} ${isPassword ? 'pr-12' : ''} ${className}`}
        />
        {isDate && (
          <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
            <span className="text-[10px] font-bold text-[#005ac1] uppercase tracking-tighter">Выбрать</span>
            <span className="material-icons-round text-[#005ac1] text-sm">touch_app</span>
          </div>
        )}
        {isPassword && (
          <button
            type="button"
            onClick={togglePasswordVisibility}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-[#005ac1] transition-colors focus:outline-none"
            tabIndex={-1}
          >
            <span className="material-icons-round">
              {showPassword ? 'visibility_off' : 'visibility'}
            </span>
          </button>
        )}
      </div>
      <style>{`
        /* Скрываем стандартную иконку календаря, так как мы вызываем её по всему полю */
        input[type="date"]::-webkit-calendar-picker-indicator {
          background: transparent;
          bottom: 0;
          color: transparent;
          cursor: pointer;
          height: auto;
          left: 0;
          position: absolute;
          right: 0;
          top: 0;
          width: auto;
        }
      `}</style>
    </div>
  );
};
