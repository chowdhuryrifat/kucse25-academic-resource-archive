import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useRouter } from '../context/RouterContext';
import { COURSES } from '../data/courses';
import { ResourceService } from '../services/resourceService';
import { Resource, ResourceType } from '../types';
import { ResourceCard } from '../components/ResourceCard';
import { ResourceRow } from '../components/ResourceRow';
import { EmptyState } from '../components/EmptyState';
import {
  ArrowLeft,
  Search,
  X,
  Plus,
  BookOpen,
  LayoutGrid,
  List,
  User,
  FileQuestion,
  Sparkles,
} from 'lucide-react';

interface CourseDetailPageProps {
  courseId: string;
}

const ALL_RESOURCE_TYPES: ResourceType[] = [
  'Lecture Slide',
  'Lecture Note',
  'Question',
  'Solution',
  'Cheat Sheet',
  'Lab',
  'Assignment',
  'Other',
];

export const CourseDetailPage: React.FC<CourseDetailPageProps> = ({ courseId }) => {
  const { navigate } = useRouter();
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Retrieve course from metadata
  const course = useMemo(() => {
    return COURSES.find((c) => c.id === courseId);
  }, [courseId]);

  // State
  const [allCourseResources, setAllCourseResources] = useState<Resource[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState<string>('All');
  const [sortBy, setSortBy] = useState<'downloads' | 'recent' | 'name'>('downloads');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [loading, setLoading] = useState(true);

  // Fetch course resources
  const fetchResources = async () => {
    setLoading(true);
    try {
      const data = await ResourceService.getPublicResources({
        courseId,
        sortBy: 'downloads',
      });
      setAllCourseResources(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchResources();

    const handleUpdate = () => fetchResources();
    window.addEventListener('kucse25_resources_updated', handleUpdate);
    return () => window.removeEventListener('kucse25_resources_updated', handleUpdate);
  }, [courseId]);

  // Keyboard shortcut: '/' to focus in-course search, 'Escape' to clear
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.key === '/' &&
        document.activeElement?.tagName !== 'INPUT' &&
        document.activeElement?.tagName !== 'TEXTAREA'
      ) {
        e.preventDefault();
        searchInputRef.current?.focus();
      } else if (e.key === 'Escape' && document.activeElement === searchInputRef.current) {
        setSearchQuery('');
        searchInputRef.current?.blur();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Compute category counts for rapid scanning
  const typeCounts = useMemo(() => {
    const counts: Record<string, number> = { All: allCourseResources.length };
    ALL_RESOURCE_TYPES.forEach((t) => {
      counts[t] = allCourseResources.filter((r) => r.resourceType === t).length;
    });
    return counts;
  }, [allCourseResources]);

  // Available resource types with at least 1 resource (plus 'All')
  const availableTypes = useMemo(() => {
    const active = ALL_RESOURCE_TYPES.filter((t) => (typeCounts[t] || 0) > 0);
    return ['All', ...active];
  }, [typeCounts]);

  // Filter & Sort resources
  const filteredResources = useMemo(() => {
    let result = [...allCourseResources];

    // Resource Type Filter
    if (selectedType !== 'All') {
      result = result.filter((r) => r.resourceType === selectedType);
    }

    // Search Query
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      result = result.filter((r) => {
        const nameMatch = r.fileName.toLowerCase().includes(q);
        const uploaderMatch = r.uploaderName.toLowerCase().includes(q);
        const typeMatch = r.resourceType.toLowerCase().includes(q);
        return nameMatch || uploaderMatch || typeMatch;
      });
    }

    // Sorting
    result.sort((a, b) => {
      if (sortBy === 'downloads') {
        return b.downloadCount - a.downloadCount;
      }
      if (sortBy === 'recent') {
        return new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime();
      }
      if (sortBy === 'name') {
        return a.fileName.localeCompare(b.fileName);
      }
      return 0;
    });

    return result;
  }, [allCourseResources, selectedType, searchQuery, sortBy]);

  const handleDownloadIncrement = () => {
    fetchResources();
  };

  const handleResetFilters = () => {
    setSearchQuery('');
    setSelectedType('All');
    setSortBy('downloads');
    searchInputRef.current?.focus();
  };

  if (!course) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-20 text-center space-y-4">
        <h1 className="text-2xl font-bold text-stone-900">Course Not Found</h1>
        <p className="text-xs sm:text-sm text-stone-500 max-w-md mx-auto">
          The requested course <code className="font-mono text-stone-800">{courseId}</code> could not be found in the KUCSE25 curriculum archive.
        </p>
        <button
          type="button"
          onClick={() => navigate('/courses')}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-stone-700 bg-stone-100 hover:bg-stone-200 rounded border border-stone-200 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Return to Course Directory</span>
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* 1. Back to Courses Navigation */}
      <nav aria-label="Breadcrumb">
        <button
          type="button"
          onClick={() => navigate('/courses')}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-stone-600 hover:text-stone-950 transition-colors py-1"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to all courses</span>
        </button>
      </nav>

      {/* 2. Course Context Header */}
      <header className="p-5 sm:p-6 bg-white border border-stone-200 rounded-md space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          {/* Course Code & Term */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-xs font-bold text-stone-900 bg-stone-100 px-2 py-0.5 rounded border border-stone-200">
              {course.code}
            </span>
            <span className="text-xs text-stone-500 font-medium">
              Level {course.level} · Term {course.term} · {course.credits} Credits
            </span>
            <span className="text-stone-300 hidden sm:inline" aria-hidden="true">·</span>
            <span className="text-xs font-medium text-stone-700">
              {allCourseResources.length} approved {allCourseResources.length === 1 ? 'file' : 'files'}
            </span>
          </div>

          {/* Quick upload button targeting this course */}
          <button
            type="button"
            onClick={() => navigate(`/upload?courseId=${course.id}`)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-stone-900 hover:bg-stone-800 active:bg-stone-950 rounded transition-colors self-start sm:self-auto shrink-0"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Upload for {course.code}</span>
          </button>
        </div>

        {/* Course Title & Syllabus Summary */}
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-stone-900 tracking-tight leading-tight">
            {course.title}
          </h1>
          <p className="mt-2 text-xs sm:text-sm text-stone-600 leading-relaxed max-w-3xl">
            {course.description}
          </p>
        </div>

        {/* Instructor info */}
        <div className="pt-3 border-t border-stone-100 flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-stone-600">
          <div className="flex items-center gap-1.5">
            <User className="w-3.5 h-3.5 text-stone-400" />
            <span>
              Instructor: <strong className="font-semibold text-stone-900">{course.teacher}</strong>
            </span>
          </div>
          <div className="flex items-center gap-1.5 text-stone-500">
            <BookOpen className="w-3.5 h-3.5 text-stone-400" />
            <span>{course.department}</span>
          </div>
        </div>
      </header>

      {/* 3. Study Toolbar */}
      <section className="space-y-4" aria-label="Course resources filter and search">
        {/* Search within Course Bar */}
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-stone-400">
            <Search className="w-4 h-4" />
          </div>
          <input
            ref={searchInputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={`Search within ${course.code} (e.g., lecture title, topic, uploader)...`}
            className="w-full pl-10 pr-20 py-2.5 text-xs sm:text-sm bg-white border border-stone-300 rounded-md focus:outline-none focus:border-stone-900 focus:ring-1 focus:ring-stone-900 transition-colors placeholder:text-stone-400"
            aria-label={`Search within ${course.code}`}
          />
          <div className="absolute inset-y-0 right-0 pr-3 flex items-center gap-1.5">
            {searchQuery ? (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="p-1 text-stone-400 hover:text-stone-700 rounded transition-colors"
                aria-label="Clear course search"
              >
                <X className="w-4 h-4" />
              </button>
            ) : (
              <kbd className="hidden sm:inline-flex items-center px-1.5 py-0.5 text-[10px] font-mono text-stone-400 bg-stone-100 border border-stone-200 rounded pointer-events-none">
                /
              </kbd>
            )}
          </div>
        </div>

        {/* Filter Controls Row: Resource Type Tabs, Sorting, and View Switcher */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-3 border-b border-stone-200">
          {/* Resource Type Tabs */}
          <div className="flex items-center gap-1 p-1 bg-stone-100 rounded-md overflow-x-auto max-w-full">
            {availableTypes.map((type) => {
              const isSelected = selectedType === type;
              const count = typeCounts[type] ?? 0;

              return (
                <button
                  key={type}
                  type="button"
                  onClick={() => setSelectedType(type)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded transition-colors whitespace-nowrap ${
                    isSelected
                      ? 'bg-white text-stone-900 font-semibold shadow-xs'
                      : 'text-stone-600 hover:text-stone-900 font-medium'
                  }`}
                >
                  <span>{type}</span>
                  <span className="text-[10px] font-mono tabular-nums text-stone-500">
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Sort selector + Grid/List View switcher */}
          <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0 text-xs">
            {/* Sort Options */}
            <div className="flex items-center gap-1.5">
              <label htmlFor="course-sort" className="text-stone-500 font-medium whitespace-nowrap">
                Sort:
              </label>
              <select
                id="course-sort"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as 'downloads' | 'recent' | 'name')}
                className="bg-white border border-stone-300 rounded px-2.5 py-1.5 text-xs text-stone-800 font-medium focus:outline-none focus:border-stone-900 focus:ring-1 focus:ring-stone-900"
              >
                <option value="downloads">Most Downloaded</option>
                <option value="recent">Recently Added</option>
                <option value="name">File Name (A–Z)</option>
              </select>
            </div>

            {/* View Mode Toggle */}
            <div className="flex items-center p-0.5 bg-stone-100 rounded border border-stone-200">
              <button
                type="button"
                onClick={() => setViewMode('grid')}
                className={`p-1.5 rounded transition-colors ${
                  viewMode === 'grid'
                    ? 'bg-white text-stone-900 shadow-xs'
                    : 'text-stone-500 hover:text-stone-800'
                }`}
                title="Grid View"
                aria-label="Switch to Grid View"
              >
                <LayoutGrid className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setViewMode('list')}
                className={`p-1.5 rounded transition-colors ${
                  viewMode === 'list'
                    ? 'bg-white text-stone-900 shadow-xs'
                    : 'text-stone-500 hover:text-stone-800'
                }`}
                title="Compact List View"
                aria-label="Switch to Compact List View"
              >
                <List className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* 4. Resource Display: List or Grid */}
      <main aria-label="Course resource items">
        {loading ? (
          <div
            className={
              viewMode === 'grid'
                ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4'
                : 'space-y-2.5'
            }
          >
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="p-5 bg-white border border-stone-200 rounded-md animate-pulse space-y-3"
              >
                <div className="h-4 bg-stone-200 rounded w-3/4" />
                <div className="h-3 bg-stone-100 rounded w-1/2" />
                <div className="pt-3 border-t border-stone-100 flex items-center justify-between">
                  <div className="h-3 bg-stone-100 rounded w-20" />
                  <div className="flex gap-2">
                    <div className="h-7 bg-stone-200 rounded w-14" />
                    <div className="h-7 bg-stone-200 rounded w-20" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : filteredResources.length > 0 ? (
          viewMode === 'grid' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredResources.map((resource) => (
                <ResourceCard
                  key={resource.id}
                  resource={resource}
                  onDownloadIncrement={handleDownloadIncrement}
                />
              ))}
            </div>
          ) : (
            <div className="space-y-2.5">
              {filteredResources.map((resource) => (
                <ResourceRow
                  key={resource.id}
                  resource={resource}
                  onDownloadIncrement={handleDownloadIncrement}
                />
              ))}
            </div>
          )
        ) : (
          <EmptyState
            title={`No matching resources found for ${course.code}`}
            description={
              searchQuery || selectedType !== 'All'
                ? `No resources match your active search "${searchQuery}" or filter "${selectedType}".`
                : `No academic materials have been approved for ${course.code} yet.`
            }
            actionLabel={
              searchQuery || selectedType !== 'All'
                ? 'Reset Filters'
                : 'Upload First Resource'
            }
            onAction={
              searchQuery || selectedType !== 'All'
                ? handleResetFilters
                : () => navigate(`/upload?courseId=${course.id}`)
            }
            icon={<FileQuestion className="w-5 h-5 text-stone-500" />}
          />
        )}
      </main>

      {/* Quick Time-Pressure Academic Study Tip */}
      <footer className="p-4 bg-stone-50 border border-stone-200 rounded-md flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-xs text-stone-500">
        <div className="flex items-center gap-2">
          <Sparkles className="w-3.5 h-3.5 text-stone-600 shrink-0" />
          <span>
            Studying under exam deadline? Switch to <strong>Compact List view</strong> or filter directly by <strong>Question</strong> or <strong>Cheat Sheet</strong>.
          </span>
        </div>
        <div className="text-[11px] font-mono text-stone-400 shrink-0">
          KUCSE25 Verified Archive
        </div>
      </footer>
    </div>
  );
};
