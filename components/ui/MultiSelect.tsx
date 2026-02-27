import React, { useState, useRef, useEffect, useMemo } from 'react';

interface MultiSelectProps {
  label?: string;
  icon?: string;
  options: { value: string; label: string; title?: string }[];
  value: string[];
  onChange: (values: string[]) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

export const MultiSelect: React.FC<MultiSelectProps> = ({ label, icon, options, value, onChange, placeholder, className = '', disabled }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setSearch('');
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredOptions = useMemo(() => {
    if (!search) return options;
    return options.filter(opt => 
      opt.label.toLowerCase().includes(search.toLowerCase())
    );
  }, [options, search]);

  const toggleOption = (optionValue: string) => {
    if (value.includes(optionValue)) {
      onChange(value.filter(v => v !== optionValue));
    } else {
      onChange([...value, optionValue]);
    }
    inputRef.current?.focus();
  };

  const removeOption = (e: React.MouseEvent, optionValue: string) => {
    e.stopPropagation();
    onChange(value.filter(v => v !== optionValue));
  };

  const selectedLabels = value.map(v => options.find(o => o.value === v)?.label || v);

  return (
    <div className="w-full min-w-0 relative" ref={containerRef}>
      {label && <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 ml-1 truncate">{label}</label>}
      <div 
        className={`relative flex flex-wrap items-center gap-1 min-h-[48px] bg-white border rounded-xl px-3 py-2 transition-all cursor-text
          ${disabled ? 'bg-slate-100 cursor-not-allowed' : ''}
          ${isOpen ? 'border-[#005ac1] ring-4 ring-[#005ac1]/5' : 'border-slate-200 hover:border-slate-400'}
          ${className}
        `}
        onClick={() => {
          if (!disabled) {
            setIsOpen(true);
            inputRef.current?.focus();
          }
        }}
      >
        {icon && (
          <span className={`material-icons-round text-[#444746] mr-1 ${isOpen || value.length > 0 ? 'text-[#005ac1]' : ''}`}>
            {icon}
          </span>
        )}
        
        {value.map(val => {
          const opt = options.find(o => o.value === val);
          return (
            <span key={val} className="flex items-center gap-1 bg-blue-50 text-blue-700 px-2 py-1 rounded-lg text-sm font-medium">
              {opt?.label || val}
              {!disabled && (
                <button type="button" onClick={(e) => removeOption(e, val)} className="hover:text-blue-900 transition-colors">
                  <span className="material-icons-round text-[14px] block">close</span>
                </button>
              )}
            </span>
          );
        })}

        <input
          ref={inputRef}
          type="text"
          disabled={disabled}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={value.length === 0 ? (placeholder || 'Выберите...') : ''}
          className="flex-grow min-w-[60px] bg-transparent outline-none text-base text-[#1c1b1f] py-1"
        />

        <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1 z-10">
            <span className={`material-icons-round text-[#444746] pointer-events-none transition-transform duration-200 ${isOpen ? 'rotate-180 text-[#005ac1]' : ''}`}>
                expand_more
            </span>
        </div>

        {isOpen && !disabled && (
          <div className="absolute top-full left-0 w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-2xl max-h-60 overflow-y-auto z-[9999] animate-in fade-in zoom-in-95 duration-100 scrollbar-hide">
            {filteredOptions.length > 0 ? (
              <ul className="py-1">
                {filteredOptions.map((opt) => {
                    const isSelected = value.includes(opt.value);
                    return (
                        <li 
                            key={opt.value}
                            onClick={(e) => {
                                e.stopPropagation();
                                toggleOption(opt.value);
                            }}
                            className={`px-4 py-2.5 text-sm cursor-pointer transition-colors flex items-center justify-between
                                ${isSelected ? 'bg-blue-50 text-blue-700 font-medium' : 'text-slate-700 hover:bg-slate-50'}
                            `}
                            title={opt.title}
                        >
                            <span className="truncate">{opt.label}</span>
                            {isSelected && <span className="material-icons-round text-sm">check</span>}
                        </li>
                    );
                })}
              </ul>
            ) : (
              <div className="px-4 py-3 text-sm text-slate-400 italic text-center">
                Ничего не найдено
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
