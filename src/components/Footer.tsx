import React from 'react';
import { useRouter } from '../context/RouterContext';

export const Footer: React.FC = () => {
  const { navigate } = useRouter();

  return (
    <footer className="bg-white border-t border-stone-200 mt-16 text-xs text-stone-600">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          {/* Institution & Archive info */}
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="font-bold tracking-tight text-stone-900 text-sm">KUCSE25</span>
              <span className="text-stone-300">·</span>
              <span className="text-stone-700 font-medium">Academic Resource Archive</span>
            </div>
            <p className="text-stone-500 text-[11px]">
              Discipline of Computer Science & Engineering · Khulna University, Bangladesh
            </p>
          </div>

          {/* Direct Archive Navigation Links */}
          <nav className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs" aria-label="Footer navigation">
            <button
              type="button"
              onClick={() => navigate('/courses')}
              className="text-stone-600 hover:text-stone-900 transition-colors"
            >
              Course Directory
            </button>
            <span className="text-stone-300" aria-hidden="true">·</span>
            <button
              type="button"
              onClick={() => navigate('/search')}
              className="text-stone-600 hover:text-stone-900 transition-colors"
            >
              Search Archive
            </button>
            <span className="text-stone-300" aria-hidden="true">·</span>
            <button
              type="button"
              onClick={() => navigate('/upload')}
              className="text-stone-600 hover:text-stone-900 transition-colors"
            >
              Submit Materials
            </button>
            <span className="text-stone-300" aria-hidden="true">·</span>
            <button
              type="button"
              onClick={() => navigate('/about')}
              className="text-stone-600 hover:text-stone-900 transition-colors"
            >
              Charter & Whitelist
            </button>
          </nav>
        </div>

        {/* Small bottom line with strict privacy notice */}
        <div className="mt-6 pt-5 border-t border-stone-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-[11px] text-stone-400">
          <p>
            © {new Date().getFullYear()} KUCSE25. Public cards display exclusively filename, uploader name, and download count.
          </p>
          <p className="font-mono text-[10px] text-stone-400">
            Batch 25 Roster (250201–250243)
          </p>
        </div>
      </div>
    </footer>
  );
};
