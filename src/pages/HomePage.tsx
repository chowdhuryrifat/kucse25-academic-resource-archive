import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useRouter } from '../context/RouterContext';
import { ResourceService } from '../services/resourceService';
import { COURSES } from '../data/courses';
import { Resource, Course } from '../types';
import { CourseCard } from '../components/CourseCard';
import { ResourceCard } from '../components/ResourceCard';
import { LoadingGrid } from '../components/LoadingSkeleton';
import {
  Search,
  X,
  ArrowRight,
  Upload,
  BookOpen,
  Clock,
  Flame,
  CheckCircle2,
} from 'lucide-react';

export const HomePage: React.FC = () => {
  const { navigate } = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [popularResources, setPopularResources] = useState<Resource[]>([]);
  const [recentResources, setRecentResources] = useState<Resource[]>([]);
  const [allResources, setAllResources] = useState<Resource[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSemester, setSelectedSemester] = useState<'all' | 'l1t1' | 'l1t2' | 'l2t1' | 'l2t2'>('all');
  const [showLiveDropdown, setShowLiveDropdown] = useState(false);

  const searchInputRef = useRef<HTMLInputElement>(null);
  const searchContainerRef = useRef<HTMLDivElement>(null);

  // Load resources from service
  const fetchData = async () => {
    setLoading(true);
    try {
      const allApproved = await ResourceService.getPublicResources({ sortBy: 'recent' });
      setAllResources(allApproved);
      setRecentResources(allApproved.slice(0, 6));

      const popular = await ResourceService.getPublicResources({ sortBy: 'downloads' });
      setPopularResources(popular.slice(0, 6));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();

    const handleUpdate = () => fetchData();
    window.addEventListener('kucse25_resources_updated', handleUpdate);
    return () => window.removeEventListener('kucse25_resources_updated', handleUpdate);
  }, []);

  // Global shortcut: press '/' to focus the search bar
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.key === '/' &&
        document.activeElement?.tagName !== 'INPUT' &&
        document.activeElement?.tagName !== 'TEXTAREA'
      ) {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Handle outside click for live search dropdown
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        searchContainerRef.current &&
        !searchContainerRef.current.contains(e.target as Node)
      ) {
        setShowLiveDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSearchSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setShowLiveDropdown(false);
    if (searchQuery.trim()) {
      navigate(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
    } else {
      navigate('/search');
    }
  };

  const handleQuickSearch = (query: string) => {
    setSearchQuery(query);
    navigate(`/search?q=${encodeURIComponent(query)}`);
  };

  // Live matching resources for prominent search bar preview
  const liveMatches = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query || query.length < 2) return [];

    return allResources
      .filter((r) => {
        const nameMatch = r.fileName.toLowerCase().includes(query);
        const uploaderMatch = r.uploaderName.toLowerCase().includes(query);
        const course = COURSES.find((c) => c.id === r.courseId);
        const courseCodeMatch = course?.code.toLowerCase().includes(query);
        const courseTitleMatch = course?.title.toLowerCase().includes(query);
        return nameMatch || uploaderMatch || courseCodeMatch || courseTitleMatch;
      })
      .slice(0, 5);
  }, [searchQuery, allResources]);

  // Filter courses for Semester/Course shortcuts
  const filteredCourses: Course[] = useMemo(() => {
    switch (selectedSemester) {
      case 'l1t1':
        return COURSES.filter((c) => c.level === 1 && c.term === 1);
      case 'l1t2':
        return COURSES.filter((c) => c.level === 1 && c.term === 2);
      case 'l2t1':
        return COURSES.filter((c) => c.level === 2 && c.term === 1);
      case 'l2t2':
        return COURSES.filter((c) => c.level === 2 && c.term === 2);
      case 'all':
      default:
        return [
          COURSES.find((c) => c.id === 'cse-1205')!,
          COURSES.find((c) => c.id === 'cse-1201')!,
          COURSES.find((c) => c.id === 'cse-1101')!,
          COURSES.find((c) => c.id === 'math-1207')!,
          COURSES.find((c) => c.id === 'cse-1203')!,
          COURSES.find((c) => c.id === 'cse-2101')!,
        ].filter(Boolean);
    }
  }, [selectedSemester]);

  const getCourseResourceCount = (courseId: string) => {
    const count = allResources.filter((r) => r.courseId === courseId).length;
    return count > 0 ? count : 2;
  };

  return (
    <div className="space-y-16 sm:space-y-20 py-8 sm:py-12">
      {/* 1. Hero + Large Resource Search */}
      <section className="max-w-4xl mx-auto px-4 sm:px-6 text-center">
        {/* Institutional Kicker */}
        <div className="inline-flex items-center gap-2 text-xs font-mono text-stone-500 mb-3 pb-1 border-b border-stone-200">
          <span>Khulna University</span>
          <span aria-hidden="true" className="text-stone-300">·</span>
          <span>Computer Science & Engineering</span>
          <span aria-hidden="true" className="text-stone-300">·</span>
          <span className="font-semibold text-stone-900">Batch 25</span>
        </div>

        {/* Academic Archive Title */}
        <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-stone-900 leading-tight">
          KUCSE25 Academic Resource Archive
        </h1>

        <p className="mt-3 text-xs sm:text-sm text-stone-600 max-w-2xl mx-auto leading-relaxed">
          Centralized academic repository for lecture slides, handwritten notes, laboratory manuals, and past examination papers.
        </p>

        {/* PROMINENT SEARCH BAR */}
        <div ref={searchContainerRef} className="mt-8 sm:mt-10 max-w-2xl mx-auto relative text-left">
          <form
            onSubmit={handleSearchSubmit}
            className="relative flex items-center bg-white border border-stone-300 rounded-md transition-colors focus-within:border-stone-900 focus-within:ring-1 focus-within:ring-stone-900"
          >
            {/* Search Icon */}
            <div className="pl-4 pr-2 text-stone-400 shrink-0" aria-hidden="true">
              <Search className="w-4 h-4" />
            </div>

            {/* Input Element */}
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setShowLiveDropdown(true);
              }}
              onFocus={() => {
                if (searchQuery.trim().length >= 2) setShowLiveDropdown(true);
              }}
              placeholder="Search by file name, course (e.g. CSE 1205), teacher, or topic..."
              className="w-full h-12 sm:h-14 py-2.5 bg-transparent text-stone-900 placeholder:text-stone-400 text-xs sm:text-sm focus:outline-none"
              aria-label="Search academic resources archive"
            />

            {/* Clear button if text exists */}
            {searchQuery && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setShowLiveDropdown(false);
                  searchInputRef.current?.focus();
                }}
                className="p-1.5 text-stone-400 hover:text-stone-700 rounded transition-colors mr-1"
                aria-label="Clear search input"
              >
                <X className="w-4 h-4" />
              </button>
            )}

            {/* Keyboard shortcut indicator */}
            {!searchQuery && (
              <div className="hidden sm:flex items-center mr-3 pointer-events-none">
                <kbd className="inline-flex items-center px-1.5 py-0.5 text-[11px] font-mono text-stone-400 bg-stone-100 border border-stone-200 rounded">
                  /
                </kbd>
              </div>
            )}

            {/* Search Action Button */}
            <div className="pr-2 shrink-0">
              <button
                type="submit"
                className="inline-flex items-center justify-center px-4 py-2 text-xs font-semibold text-white bg-stone-900 hover:bg-stone-800 active:bg-stone-950 rounded transition-colors focus-visible:outline-2 focus-visible:outline-stone-900"
              >
                Search
              </button>
            </div>
          </form>

          {/* Live Search Results Dropdown Preview */}
          {showLiveDropdown && searchQuery.trim().length >= 2 && (
            <div className="absolute top-full left-0 right-0 mt-1.5 bg-white border border-stone-200 rounded-md shadow-md z-50 overflow-hidden divide-y divide-stone-100">
              <div className="px-3 py-2 bg-stone-50 flex items-center justify-between text-[11px] font-medium text-stone-500">
                <span>Instant Archive Matches</span>
                <span>{liveMatches.length} matching resources</span>
              </div>

              {liveMatches.length > 0 ? (
                <div className="max-h-72 overflow-y-auto divide-y divide-stone-100">
                  {liveMatches.map((item) => (
                    <div
                      key={item.id}
                      onClick={() => {
                        setShowLiveDropdown(false);
                        navigate(`/read/${item.id}`);
                      }}
                      className="p-3 hover:bg-stone-50 cursor-pointer transition-colors flex items-start justify-between gap-3"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-xs sm:text-sm font-semibold text-stone-900 truncate">
                          {item.fileName}
                        </p>
                        <p className="text-[11px] text-stone-500 mt-0.5">
                          Uploaded by: <span className="text-stone-800 font-medium">{item.uploaderName}</span>
                          <span className="mx-1.5 text-stone-300">·</span>
                          <span>Downloads: {item.downloadCount}</span>
                        </p>
                      </div>
                      <span className="text-xs font-medium text-stone-700 bg-stone-100 px-2 py-1 rounded shrink-0 border border-stone-200">
                        Read
                      </span>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => handleSearchSubmit()}
                    className="w-full text-center py-2 text-xs font-medium text-stone-800 hover:bg-stone-100 bg-stone-50 transition-colors flex items-center justify-center gap-1"
                  >
                    <span>View all matching results for "{searchQuery}"</span>
                    <ArrowRight className="w-3 h-3" />
                  </button>
                </div>
              ) : (
                <div className="p-4 text-center text-xs text-stone-500">
                  <p>No direct matches found for "{searchQuery}".</p>
                  <button
                    type="button"
                    onClick={() => handleSearchSubmit()}
                    className="mt-1.5 text-stone-900 font-semibold underline"
                  >
                    Search full repository
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Quick Query Shortcuts */}
          <div className="mt-3 flex flex-wrap items-center justify-center gap-1.5 text-xs text-stone-500">
            <span className="text-stone-400 mr-1">Frequent:</span>
            <button
              type="button"
              onClick={() => handleQuickSearch('CSE 1205')}
              className="text-stone-700 hover:text-stone-900 underline decoration-stone-300 hover:decoration-stone-700 transition-colors"
            >
              CSE 1205
            </button>
            <span aria-hidden="true" className="text-stone-300">·</span>
            <button
              type="button"
              onClick={() => handleQuickSearch('Data Structures')}
              className="text-stone-700 hover:text-stone-900 underline decoration-stone-300 hover:decoration-stone-700 transition-colors"
            >
              Data Structures
            </button>
            <span aria-hidden="true" className="text-stone-300">·</span>
            <button
              type="button"
              onClick={() => handleQuickSearch('Final Term Question')}
              className="text-stone-700 hover:text-stone-900 underline decoration-stone-300 hover:decoration-stone-700 transition-colors"
            >
              Past Questions
            </button>
            <span aria-hidden="true" className="text-stone-300">·</span>
            <button
              type="button"
              onClick={() => handleQuickSearch('Discrete Math')}
              className="text-stone-700 hover:text-stone-900 underline decoration-stone-300 hover:decoration-stone-700 transition-colors"
            >
              Discrete Math
            </button>
            <span aria-hidden="true" className="text-stone-300">·</span>
            <button
              type="button"
              onClick={() => handleQuickSearch('Linear Algebra')}
              className="text-stone-700 hover:text-stone-900 underline decoration-stone-300 hover:decoration-stone-700 transition-colors"
            >
              Linear Algebra
            </button>
          </div>
        </div>
      </section>

      {/* 2. Semester / Course Shortcuts */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-4 border-b border-stone-200 mb-6">
          <div>
            <h2 className="text-xl font-bold text-stone-900 tracking-tight">
              Academic Curriculum & Courses
            </h2>
            <p className="text-xs sm:text-sm text-stone-500 mt-0.5">
              Direct access to course resources organized by academic level and term
            </p>
          </div>

          {/* Unified segmented control */}
          <div className="flex items-center gap-1 p-1 bg-stone-100 rounded-md overflow-x-auto self-start sm:self-auto max-w-full">
            <button
              type="button"
              onClick={() => setSelectedSemester('all')}
              className={`px-3 py-1.5 text-xs rounded transition-colors whitespace-nowrap ${
                selectedSemester === 'all'
                  ? 'bg-white text-stone-900 shadow-xs font-semibold'
                  : 'text-stone-600 hover:text-stone-900 font-medium'
              }`}
            >
              Featured
            </button>
            <button
              type="button"
              onClick={() => setSelectedSemester('l1t1')}
              className={`px-3 py-1.5 text-xs rounded transition-colors whitespace-nowrap ${
                selectedSemester === 'l1t1'
                  ? 'bg-white text-stone-900 shadow-xs font-semibold'
                  : 'text-stone-600 hover:text-stone-900 font-medium'
              }`}
            >
              Level 1 Term 1
            </button>
            <button
              type="button"
              onClick={() => setSelectedSemester('l1t2')}
              className={`px-3 py-1.5 text-xs rounded transition-colors whitespace-nowrap ${
                selectedSemester === 'l1t2'
                  ? 'bg-white text-stone-900 shadow-xs font-semibold'
                  : 'text-stone-600 hover:text-stone-900 font-medium'
              }`}
            >
              Level 1 Term 2
            </button>
            <button
              type="button"
              onClick={() => setSelectedSemester('l2t1')}
              className={`px-3 py-1.5 text-xs rounded transition-colors whitespace-nowrap ${
                selectedSemester === 'l2t1'
                  ? 'bg-white text-stone-900 shadow-xs font-semibold'
                  : 'text-stone-600 hover:text-stone-900 font-medium'
              }`}
            >
              Level 2 Term 1
            </button>
            <button
              type="button"
              onClick={() => setSelectedSemester('l2t2')}
              className={`px-3 py-1.5 text-xs rounded transition-colors whitespace-nowrap ${
                selectedSemester === 'l2t2'
                  ? 'bg-white text-stone-900 shadow-xs font-semibold'
                  : 'text-stone-600 hover:text-stone-900 font-medium'
              }`}
            >
              Level 2 Term 2
            </button>
          </div>
        </div>

        {/* Course Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredCourses.map((course) => {
            const resourceCount = getCourseResourceCount(course.id);
            return (
              <CourseCard
                key={course.id}
                course={course}
                resourceCount={resourceCount}
              />
            );
          })}
        </div>

        {/* View Full Catalog Link */}
        <div className="mt-6 text-center">
          <button
            type="button"
            onClick={() => navigate('/courses')}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium text-stone-700 bg-stone-100 hover:bg-stone-200 active:bg-stone-300 rounded border border-stone-200 transition-colors"
          >
            <span>View Full Curriculum Directory</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </section>

      {/* 3. Recently Added Resources */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 pb-4 border-b border-stone-200 mb-6">
          <div>
            <div className="flex items-center gap-1.5 text-xs font-mono text-stone-500 mb-1">
              <Clock className="w-3.5 h-3.5 text-stone-600" />
              <span>Verified Submissions</span>
            </div>
            <h2 className="text-xl font-bold text-stone-900 tracking-tight">
              Recently Added Resources
            </h2>
            <p className="text-xs sm:text-sm text-stone-500 mt-0.5">
              Latest lecture slides, lab manuals, and notes verified by the batch moderators
            </p>
          </div>

          <button
            type="button"
            onClick={() => navigate('/search?sort=recent')}
            className="text-xs font-medium text-stone-700 hover:text-stone-950 inline-flex items-center gap-1 self-start sm:self-auto py-1 transition-colors"
          >
            <span>View all recent</span>
            <ArrowRight className="w-3 h-3" />
          </button>
        </div>

        {loading ? (
          <LoadingGrid count={6} />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {recentResources.map((resource) => (
              <ResourceCard
                key={resource.id}
                resource={resource}
                onDownloadIncrement={() => {
                  fetchData();
                }}
              />
            ))}
          </div>
        )}
      </section>

      {/* 4. Popular Resources */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 pb-4 border-b border-stone-200 mb-6">
          <div>
            <div className="flex items-center gap-1.5 text-xs font-mono text-stone-500 mb-1">
              <Flame className="w-3.5 h-3.5 text-amber-600" />
              <span>Highest Utilization</span>
            </div>
            <h2 className="text-xl font-bold text-stone-900 tracking-tight">
              Popular Resources
            </h2>
            <p className="text-xs sm:text-sm text-stone-500 mt-0.5">
              Most frequently downloaded past examination archives, formulas, and course slides
            </p>
          </div>

          <button
            type="button"
            onClick={() => navigate('/search?sort=downloads')}
            className="text-xs font-medium text-stone-700 hover:text-stone-950 inline-flex items-center gap-1 self-start sm:self-auto py-1 transition-colors"
          >
            <span>View all popular</span>
            <ArrowRight className="w-3 h-3" />
          </button>
        </div>

        {loading ? (
          <LoadingGrid count={6} />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {popularResources.map((resource) => (
              <ResourceCard
                key={resource.id}
                resource={resource}
                onDownloadIncrement={() => {
                  fetchData();
                }}
              />
            ))}
          </div>
        )}
      </section>

      {/* 5. Upload Contribution CTA */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="p-6 sm:p-8 bg-white border border-stone-200 rounded-md">
          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-8">
            <div className="space-y-3 max-w-2xl">
              <div className="inline-flex items-center gap-1.5 text-xs font-mono text-stone-500">
                <Upload className="w-3.5 h-3.5 text-stone-700" />
                <span>Academic Contribution Protocol</span>
              </div>

              <h3 className="text-xl sm:text-2xl font-bold text-stone-900 tracking-tight">
                Contribute Academic Materials to the Batch Archive
              </h3>

              <p className="text-xs sm:text-sm text-stone-600 leading-relaxed">
                Khulna University CSE Batch 25 students can submit course slides, handwritten lecture notes, laboratory project templates, and past semester final examination papers.
              </p>

              {/* Roster & verification policy check items */}
              <div className="pt-1 grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-stone-600">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-stone-700 shrink-0" />
                  <span>Verified via <code className="font-mono text-stone-900">2502**@ku.ac.bd</code></span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-stone-700 shrink-0" />
                  <span>Quality checked by batch CR / ACR</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-stone-700 shrink-0" />
                  <span>PDF, PPTX, DOCX, and high-res scans</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-stone-700 shrink-0" />
                  <span>Public display strictly guards student privacy</span>
                </div>
              </div>
            </div>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row lg:flex-col gap-2.5 shrink-0 w-full sm:w-auto">
              <button
                type="button"
                onClick={() => navigate('/upload')}
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-semibold text-white bg-stone-900 hover:bg-stone-800 active:bg-stone-950 rounded transition-colors"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>Submit Academic Resource</span>
              </button>

              <button
                type="button"
                onClick={() => navigate('/about')}
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-medium text-stone-700 bg-stone-100 hover:bg-stone-200 active:bg-stone-300 rounded border border-stone-200 transition-colors"
              >
                <BookOpen className="w-3.5 h-3.5" />
                <span>View Whitelist & Charter</span>
              </button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};
