import React from 'react';
import { Search, X } from 'lucide-react';

interface SearchBarProps {
  value: string;
  onChange: (val: string) => void;
  onSubmit?: () => void;
  placeholder?: string;
  size?: 'default' | 'large';
  autoFocus?: boolean;
}

export const SearchBar: React.FC<SearchBarProps> = ({
  value,
  onChange,
  onSubmit,
  placeholder = 'Search by file name, course code, teacher, or topic...',
  size = 'default',
  autoFocus = false,
}) => {
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && onSubmit) {
      e.preventDefault();
      onSubmit();
    }
  };

  const isLarge = size === 'large';

  return (
    <div className="relative w-full">
      <div
        className={`relative flex items-center bg-white border border-stone-300 rounded-md transition-colors focus-within:border-stone-900 focus-within:ring-1 focus-within:ring-stone-900 ${
          isLarge ? 'h-12 px-3.5' : 'h-10 px-3'
        }`}
      >
        <Search
          className={`shrink-0 text-stone-400 mr-2.5 ${isLarge ? 'w-4 h-4' : 'w-4 h-4'}`}
          aria-hidden="true"
        />
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          autoFocus={autoFocus}
          className={`w-full bg-transparent text-stone-900 placeholder:text-stone-400 focus:outline-none ${
            isLarge ? 'text-sm' : 'text-xs sm:text-sm'
          }`}
          aria-label="Search resources"
        />
        {value && (
          <button
            type="button"
            onClick={() => onChange('')}
            className="p-1 text-stone-400 hover:text-stone-600 rounded transition-colors mr-1"
            aria-label="Clear search input"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
        {onSubmit && (
          <button
            type="button"
            onClick={onSubmit}
            className="shrink-0 px-3 py-1.5 text-xs font-semibold text-white bg-stone-900 hover:bg-stone-800 rounded transition-colors"
          >
            Search
          </button>
        )}
      </div>
    </div>
  );
};
