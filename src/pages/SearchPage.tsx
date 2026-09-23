import React, { useState, useEffect } from 'react';
import { useRouter } from '../context/RouterContext';
import { ResourceService } from '../services/resourceService';
import { COURSES } from '../data/courses';
import { Resource } from '../types';
import { SearchBar } from '../components/SearchBar';
import { ResourceList } from '../components/ResourceList';
import { ResourceFilters } from '../components/ResourceFilters';
import { LoadingGrid } from '../components/LoadingSkeleton';
import { Search } from 'lucide-react';

export const SearchPage: React.FC = () => {
  const { searchParams } = useRouter();
  const initialQuery = searchParams.get('q') || '';
  const initialSort = (searchParams.get('sort') as 'downloads' | 'recent' | 'name') || 'downloads';

  const [query, setQuery] = useState(initialQuery);
  const [selectedCourseId, setSelectedCourseId] = useState<string>('all');
  const [selectedType, setSelectedType] = useState<string>('All');
  const [sortBy, setSortBy] = useState<'downloads' | 'recent' | 'name'>(initialSort);
  const [resources, setResources] = useState<Resource[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchFiltered = async () => {
      setLoading(true);
      try {
        const data = await ResourceService.getPublicResources({
          courseId: selectedCourseId === 'all' ? undefined : selectedCourseId,
          resourceType: selectedType,
          searchQuery: query,
          sortBy,
        });

        // Also search across course titles and teachers
        let filtered = data;
        if (query.trim()) {
          const q = query.trim().toLowerCase();
          filtered = data.filter((r) => {
            const course = COURSES.find((c) => c.id === r.courseId);
            const matchesCourse = course
              ? course.code.toLowerCase().includes(q) ||
                course.title.toLowerCase().includes(q) ||
                course.teacher.toLowerCase().includes(q)
              : false;

            return (
              r.fileName.toLowerCase().includes(q) ||
              r.uploaderName.toLowerCase().includes(q) ||
              r.resourceType.toLowerCase().includes(q) ||
              matchesCourse
            );
          });
        }

        setResources(filtered);
      } finally {
        setLoading(false);
      }
    };

    const debounce = setTimeout(fetchFiltered, 100);
    return () => clearTimeout(debounce);
  }, [query, selectedCourseId, selectedType, sortBy]);

  const handleResetFilters = () => {
    setQuery('');
    setSelectedCourseId('all');
    setSelectedType('All');
    setSortBy('downloads');
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Header */}
      <div>
        <div className="inline-flex items-center gap-1.5 text-xs font-mono text-stone-500 mb-2">
          <Search className="w-3.5 h-3.5 text-stone-700" />
          <span>Global Search Engine</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-stone-900">
          Search Academic Repository
        </h1>
        <p className="mt-1 text-xs sm:text-sm text-stone-600 max-w-xl">
          Instant query index across filenames, course codes, course titles, instructors, and resource types.
        </p>
      </div>

      {/* Main Search Input & Course Selector */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <div className="md:col-span-3">
          <SearchBar
            value={query}
            onChange={setQuery}
            placeholder="Search keywords (e.g. Recursion, CSE 1205, Dr. Alamgir, Final Exam)..."
            size="large"
            autoFocus
          />
        </div>

        <div>
          <label htmlFor="course-filter-select" className="sr-only">
            Filter by Course
          </label>
          <select
            id="course-filter-select"
            value={selectedCourseId}
            onChange={(e) => setSelectedCourseId(e.target.value)}
            className="w-full h-12 bg-white border border-stone-300 rounded-md px-3 text-xs font-medium text-stone-800 focus:outline-none focus:border-stone-900 focus:ring-1 focus:ring-stone-900 transition-colors"
          >
            <option value="all">All Courses</option>
            {COURSES.map((c) => (
              <option key={c.id} value={c.id}>
                {c.code}: {c.title.slice(0, 32)}...
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Resource Type & Sorting Tabs */}
      <ResourceFilters
        selectedType={selectedType}
        onSelectType={setSelectedType}
        sortBy={sortBy}
        onChangeSort={setSortBy}
        totalCount={resources.length}
      />

      {/* Results or Loading */}
      {loading ? (
        <LoadingGrid count={6} />
      ) : (
        <ResourceList
          resources={resources}
          emptyMessage="No academic resources found"
          emptySubtext="Try adjusting your keyword query, choosing a different course, or switching resource types."
          onClearFilters={handleResetFilters}
        />
      )}
    </div>
  );
};
