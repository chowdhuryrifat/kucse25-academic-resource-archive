import React from 'react';

export const ResourceCardSkeleton: React.FC = () => {
  return (
    <div className="p-5 bg-white border border-stone-200 rounded-md animate-pulse">
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 bg-stone-200 rounded" />
        <div className="flex-1 space-y-2">
          <div className="h-4 bg-stone-200 rounded w-4/5" />
          <div className="h-3 bg-stone-100 rounded w-2/5" />
        </div>
      </div>
      <div className="mt-5 pt-3.5 border-t border-stone-100 flex items-center justify-between">
        <div className="h-3 bg-stone-100 rounded w-16" />
        <div className="flex gap-2">
          <div className="h-6 w-14 bg-stone-200 rounded" />
          <div className="h-6 w-16 bg-stone-200 rounded" />
        </div>
      </div>
    </div>
  );
};

export const LoadingGrid: React.FC<{ count?: number }> = ({ count = 6 }) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <ResourceCardSkeleton key={i} />
      ))}
    </div>
  );
};
