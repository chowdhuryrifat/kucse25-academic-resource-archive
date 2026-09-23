import React from 'react';

interface StatsCardProps {
  label: string;
  value: string | number;
  subtext?: string;
  icon?: React.ReactNode;
}

export const StatsCard: React.FC<StatsCardProps> = ({ label, value, subtext, icon }) => {
  return (
    <div className="p-5 bg-white border border-stone-200 rounded-md">
      <div className="flex items-center justify-between text-xs text-stone-500 mb-2">
        <span className="font-medium text-stone-600">{label}</span>
        {icon && <div className="text-stone-400">{icon}</div>}
      </div>
      <div className="text-2xl font-bold text-stone-900 tracking-tight tabular-nums">
        {value}
      </div>
      {subtext && (
        <p className="mt-1 text-xs text-stone-500 font-normal leading-relaxed">{subtext}</p>
      )}
    </div>
  );
};
