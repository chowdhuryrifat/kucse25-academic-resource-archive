import React from 'react';
import { ResourceType } from '../types';

interface ResourceFiltersProps {
  selectedType: string;
  onSelectType: (type: string) => void;
  sortBy: 'downloads' | 'recent' | 'name';
  onChangeSort: (sort: 'downloads' | 'recent' | 'name') => void;
  totalCount?: number;
}

const RESOURCE_TYPES: (ResourceType | 'All')[] = [
  'All',
  'Lecture Slide',
  'Lecture Note',
  'Lab',
  'Assignment',
  'Question',
  'Solution',
  'Cheat Sheet',
  'Other',
];

export const ResourceFilters: React.FC<ResourceFiltersProps> = ({
  selectedType,
  onSelectType,
  sortBy,
  onChangeSort,
  totalCount,
}) => {
  return (
    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-stone-200">
      {/* Interactive Segmented Filter Control */}
      <div className="flex items-center gap-1 p-1 bg-stone-100 rounded-md overflow-x-auto max-w-full">
        {RESOURCE_TYPES.map((type) => {
          const isSelected = selectedType === type;
          return (
            <button
              key={type}
              type="button"
              onClick={() => onSelectType(type)}
              className={`px-3 py-1.5 text-xs rounded transition-colors whitespace-nowrap ${
                isSelected
                  ? 'bg-white text-stone-900 font-semibold shadow-xs'
                  : 'text-stone-600 hover:text-stone-900 font-medium'
              }`}
            >
              {type}
            </button>
          );
        })}
      </div>

      {/* Sorting & Count */}
      <div className="flex items-center justify-between sm:justify-end gap-4 text-xs shrink-0">
        {totalCount !== undefined && (
          <span className="text-stone-500 tabular-nums">
            Showing <strong className="font-semibold text-stone-900">{totalCount}</strong> results
          </span>
        )}

        <div className="flex items-center gap-2">
          <label htmlFor="sort-select" className="text-stone-500 font-medium whitespace-nowrap">
            Sort:
          </label>
          <select
            id="sort-select"
            value={sortBy}
            onChange={(e) => onChangeSort(e.target.value as 'downloads' | 'recent' | 'name')}
            className="bg-white border border-stone-300 rounded px-2.5 py-1 text-xs text-stone-800 font-medium focus:outline-none focus:border-stone-900 focus:ring-1 focus:ring-stone-900"
          >
            <option value="downloads">Most Downloaded</option>
            <option value="recent">Recently Added</option>
            <option value="name">File Name (A–Z)</option>
          </select>
        </div>
      </div>
    </div>
  );
};
