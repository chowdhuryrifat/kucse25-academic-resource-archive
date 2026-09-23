import React, { useState, useEffect, useMemo } from 'react';
import { COURSES } from '../data/courses';
import { CourseCard } from '../components/CourseCard';
import { ResourceService } from '../services/resourceService';
import { Resource } from '../types';
import { Search, X, BookOpen, Layers } from 'lucide-react';
import { EmptyState } from '../components/EmptyState';

export const CoursesPage: React.FC = () => {
  const [search, setSearch] = useState('');
  const [selectedSemester, setSelectedSemester] = useState<'all' | '1-1' | '1-2' | '2-1' | '2-2'>('all');
  const [resources, setResources] = useState<Resource[]>([]);
  const [, setLoading] = useState(true);

  useEffect(() => {
    const loadResources = async () => {
      setLoading(true);
      try {
        const data = await ResourceService.getPublicResources();
        setResources(data);
      } finally {
        setLoading(false);
      }
    };
    loadResources();
  }, []);

  // Filter courses by search query
  const searchedCourses = useMemo(() => {
    if (!search.trim()) return COURSES;
    const q = search.trim().toLowerCase();
    return COURSES.filter((c) => {
      return (
        c.code.toLowerCase().includes(q) ||
        c.title.toLowerCase().includes(q) ||
        c.teacher.toLowerCase().includes(q) ||
        c.description.toLowerCase().includes(q)
      );
    });
  }, [search]);

  // Semester groupings
  const semesterGroups = useMemo(() => {
    const groups = [
      {
        id: '1-1',
        level: 1,
        term: 1,
        title: 'Level 1 · Term 1',
        subtitle: 'First Year, First Term (Autumn)',
        courses: searchedCourses.filter((c) => c.level === 1 && c.term === 1),
      },
      {
        id: '1-2',
        level: 1,
        term: 2,
        title: 'Level 1 · Term 2',
        subtitle: 'First Year, Second Term (Spring)',
        courses: searchedCourses.filter((c) => c.level === 1 && c.term === 2),
      },
      {
        id: '2-1',
        level: 2,
        term: 1,
        title: 'Level 2 · Term 1',
        subtitle: 'Second Year, First Term (Autumn)',
        courses: searchedCourses.filter((c) => c.level === 2 && c.term === 1),
      },
      {
        id: '2-2',
        level: 2,
        term: 2,
        title: 'Level 2 · Term 2',
        subtitle: 'Second Year, Second Term (Spring)',
        courses: searchedCourses.filter((c) => c.level === 2 && c.term === 2),
      },
    ];

    if (selectedSemester === 'all') return groups;
    return groups.filter((g) => g.id === selectedSemester);
  }, [searchedCourses, selectedSemester]);

  // Count resources for a given course
  const getResourceCount = (courseId: string) => {
    return resources.filter((r) => r.courseId === courseId).length;
  };

  const totalFilteredCourses = searchedCourses.length;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-6 border-b border-stone-200">
        <div>
          <div className="inline-flex items-center gap-2 text-xs font-mono text-stone-500 mb-2">
            <Layers className="w-3.5 h-3.5 text-stone-700" />
            <span>Academic Curriculum Directory</span>
            <span aria-hidden="true" className="text-stone-300">·</span>
            <span>Batch 25</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-stone-900">
            Khulna University CSE Courses
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-stone-600 max-w-2xl leading-relaxed">
            Organized sequentially across academic levels and terms. Select any course to access its dedicated repository of lecture notes, slides, lab guides, and past examination papers.
          </p>
        </div>

        {/* Filter Input */}
        <div className="w-full md:w-80 shrink-0">
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-stone-400">
              <Search className="w-4 h-4" />
            </div>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search code, title, teacher..."
              className="w-full pl-9 pr-8 py-2 text-xs sm:text-sm bg-white border border-stone-300 rounded focus:outline-none focus:border-stone-900 focus:ring-1 focus:ring-stone-900 transition-colors"
              aria-label="Filter courses"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-stone-400 hover:text-stone-700"
                aria-label="Clear search"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Semester Filter Tabs & Summary stats */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2">
        <div className="flex items-center gap-1 p-1 bg-stone-100 rounded-md overflow-x-auto max-w-full">
          <button
            type="button"
            onClick={() => setSelectedSemester('all')}
            className={`px-3 py-1.5 text-xs rounded transition-colors whitespace-nowrap ${
              selectedSemester === 'all'
                ? 'bg-white text-stone-900 font-semibold shadow-xs'
                : 'text-stone-600 hover:text-stone-900 font-medium'
            }`}
          >
            All Semesters ({searchedCourses.length})
          </button>
          <button
            type="button"
            onClick={() => setSelectedSemester('1-1')}
            className={`px-3 py-1.5 text-xs rounded transition-colors whitespace-nowrap ${
              selectedSemester === '1-1'
                ? 'bg-white text-stone-900 font-semibold shadow-xs'
                : 'text-stone-600 hover:text-stone-900 font-medium'
            }`}
          >
            Level 1 Term 1
          </button>
          <button
            type="button"
            onClick={() => setSelectedSemester('1-2')}
            className={`px-3 py-1.5 text-xs rounded transition-colors whitespace-nowrap ${
              selectedSemester === '1-2'
                ? 'bg-white text-stone-900 font-semibold shadow-xs'
                : 'text-stone-600 hover:text-stone-900 font-medium'
            }`}
          >
            Level 1 Term 2
          </button>
          <button
            type="button"
            onClick={() => setSelectedSemester('2-1')}
            className={`px-3 py-1.5 text-xs rounded transition-colors whitespace-nowrap ${
              selectedSemester === '2-1'
                ? 'bg-white text-stone-900 font-semibold shadow-xs'
                : 'text-stone-600 hover:text-stone-900 font-medium'
            }`}
          >
            Level 2 Term 1
          </button>
          <button
            type="button"
            onClick={() => setSelectedSemester('2-2')}
            className={`px-3 py-1.5 text-xs rounded transition-colors whitespace-nowrap ${
              selectedSemester === '2-2'
                ? 'bg-white text-stone-900 font-semibold shadow-xs'
                : 'text-stone-600 hover:text-stone-900 font-medium'
            }`}
          >
            Level 2 Term 2
          </button>
        </div>

        <div className="text-xs text-stone-500 tabular-nums">
          Showing <strong className="font-semibold text-stone-900">{totalFilteredCourses}</strong> courses
          {search && <span className="ml-1 text-stone-400">matching "{search}"</span>}
        </div>
      </div>

      {/* Course Groups by Academic Semester */}
      <div className="space-y-12">
        {semesterGroups.map((group) => {
          if (group.courses.length === 0) return null;

          return (
            <section key={group.id} className="space-y-4">
              {/* Semester Header */}
              <div className="flex items-center gap-3">
                <div className="flex items-baseline gap-2">
                  <h2 className="text-base sm:text-lg font-bold text-stone-900 tracking-tight">
                    {group.title}
                  </h2>
                  <span className="text-xs text-stone-500 hidden sm:inline">
                    — {group.subtitle}
                  </span>
                </div>
                <div className="h-px flex-1 bg-stone-200" />
                <span className="text-xs text-stone-500 font-mono tabular-nums">
                  {group.courses.length} courses
                </span>
              </div>

              {/* Course Cards Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {group.courses.map((course) => {
                  const count = getResourceCount(course.id);
                  return (
                    <CourseCard
                      key={course.id}
                      course={course}
                      resourceCount={count}
                    />
                  );
                })}
              </div>
            </section>
          );
        })}

        {/* Empty state when search yields zero courses */}
        {totalFilteredCourses === 0 && (
          <EmptyState
            title={`No courses found matching "${search}"`}
            description="Check the course code format (e.g. CSE 1205) or instructor spelling."
            actionLabel="Reset Search & Filters"
            onAction={() => {
              setSearch('');
              setSelectedSemester('all');
            }}
            icon={<BookOpen className="w-5 h-5 text-stone-500" />}
          />
        )}
      </div>
    </div>
  );
};
