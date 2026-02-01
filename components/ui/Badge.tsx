import React from 'react';

interface BadgeProps {
  children: React.ReactNode;
  color?: 'blue' | 'emerald' | 'amber' | 'purple' | 'slate' | 'red';
}

export const Badge: React.FC<BadgeProps> = ({ children, color = 'slate' }) => {
  const colors = { 
    blue: 'bg-[#d3e4ff] text-[#001d3d]', 
    emerald: 'bg-[#cce8cd] text-[#06210d]', 
    amber: 'bg-[#ffe08d] text-[#241a00]', 
    purple: 'bg-[#eaddff] text-[#21005d]', 
    slate: 'bg-[#e1e2e1] text-[#1c1b1f]', 
    red: 'bg-[#ffdad6] text-[#410002]' 
  };
  return <span className={`text-[11px] px-3 py-1 rounded-lg font-medium tracking-wide ${colors[color]}`}>{children}</span>;
};