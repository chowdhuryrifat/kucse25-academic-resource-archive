import React from 'react';
import { FolderSearch } from 'lucide-react';

interface EmptyStateProps {
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  icon?: React.ReactNode;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  title,
  description,
  actionLabel,
  onAction,
  icon,
}) => {
  return (
    <div className="py-12 px-6 text-center border border-dashed border-stone-300 rounded-md bg-white">
      <div className="w-10 h-10 rounded-md bg-stone-100 border border-stone-200 flex items-center justify-center mx-auto text-stone-500 mb-3">
        {icon || <FolderSearch className="w-5 h-5" />}
      </div>
      <h3 className="text-sm font-semibold text-stone-900 tracking-tight">{title}</h3>
      <p className="mt-1 text-xs text-stone-500 max-w-sm mx-auto leading-relaxed">{description}</p>
      {actionLabel && onAction && (
        <button
          type="button"
          onClick={onAction}
          className="mt-4 inline-flex items-center justify-center px-3.5 py-1.5 text-xs font-medium text-stone-700 bg-stone-100 hover:bg-stone-200 active:bg-stone-300 rounded border border-stone-200 transition-colors"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
};
