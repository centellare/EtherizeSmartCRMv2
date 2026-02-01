import React from 'react';

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  icon?: string;
  options: { value: string; label: string }[];
}

export const Select: React.FC<SelectProps> = ({ label, icon, options, className = '', ...props }) => (
  <div className="w-full">
    {label && <label className="block text-xs font-medium text-[#444746] mb-1.5 ml-1">{label}</label>}
    <div className="relative group">
      {icon && (
        <span className="absolute left-4 top-1/2 -translate-y-1/2 material-icons-round text-[#444746] group-focus-within:text-[#005ac1] transition-colors pointer-events-none">
          {icon}
        </span>
      )}
      <select 
        {...props}
        className={`w-full bg-transparent border border-[#747775] rounded-xl px-4 py-3 text-base text-[#1c1b1f] outline-none transition-all appearance-none focus:border-[#005ac1] focus:ring-1 focus:ring-[#005ac1] ${icon ? 'pl-11' : ''} ${className}`}
      >
        {options.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
      </select>
      <span className="absolute right-4 top-1/2 -translate-y-1/2 material-icons-round text-[#444746] pointer-events-none">
        expand_more
      </span>
    </div>
  </div>
);