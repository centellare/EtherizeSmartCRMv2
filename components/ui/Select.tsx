
import React from 'react';

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  icon?: string;
  options: { value: string; label: string; title?: string }[];
}

export const Select: React.FC<SelectProps> = ({ label, icon, options, className = '', ...props }) => (
  <div className="w-full min-w-0">
    {label && <label className="block text-xs font-medium text-[#444746] mb-1.5 ml-1 truncate">{label}</label>}
    <div className="relative group">
      {icon && (
        <span className="absolute left-4 top-1/2 -translate-y-1/2 material-icons-round text-[#444746] group-focus-within:text-[#005ac1] transition-colors pointer-events-none z-10">
          {icon}
        </span>
      )}
      <select 
        {...props}
        className={`w-full bg-transparent border border-[#747775] rounded-xl px-4 py-3 text-base text-[#1c1b1f] outline-none transition-all appearance-none focus:border-[#005ac1] focus:ring-1 focus:ring-[#005ac1] truncate pr-8 leading-normal ${icon ? 'pl-11' : ''} ${className}`}
        style={{ textOverflow: 'ellipsis' }}
      >
        {options.map(opt => (
          <option 
            key={opt.value} 
            value={opt.value} 
            title={opt.title || opt.label}
            className="py-2"
          >
            {opt.label}
          </option>
        ))}
      </select>
      <span className="absolute right-4 top-1/2 -translate-y-1/2 material-icons-round text-[#444746] pointer-events-none">
        expand_more
      </span>
    </div>
  </div>
);
