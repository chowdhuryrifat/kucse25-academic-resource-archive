import React from 'react';
import { Course } from '../types';
import { useRouter } from '../context/RouterContext';
import { ArrowUpRight } from 'lucide-react';

interface CourseCardProps {
  course: Course;
  resourceCount?: number;
}

export const CourseCard: React.FC<CourseCardProps> = ({ course, resourceCount = 0 }) => {
  const { navigate } = useRouter();

  return (
    <article
      onClick={() => navigate(`/courses/${course.id}`)}
      className="group relative flex flex-col justify-between p-5 bg-white border border-stone-200 rounded-md hover:border-stone-400 cursor-pointer transition-colors"
      aria-label={`Course ${course.code}: ${course.title}`}
    >
      <div>
        {/* Course Code & Academic Term */}
        <div className="flex items-center justify-between text-xs text-stone-500 mb-2">
          <span className="font-mono font-bold text-stone-900 bg-stone-100 px-2 py-0.5 rounded border border-stone-200">
            {course.code}
          </span>
          <span className="tabular-nums">
            Level {course.level} · Term {course.term}
          </span>
        </div>

        {/* Course Title */}
        <h3 className="text-base font-semibold text-stone-900 group-hover:text-stone-700 transition-colors leading-snug line-clamp-2">
          {course.title}
        </h3>

        {/* Teacher */}
        <p className="mt-2 text-xs text-stone-500 line-clamp-1">
          Instructor: <span className="text-stone-800 font-medium">{course.teacher}</span>
        </p>
      </div>

      {/* Footer: Resource Count & View link */}
      <div className="mt-4 pt-3 border-t border-stone-100 flex items-center justify-between text-xs text-stone-500">
        <span className="tabular-nums">
          <strong className="font-semibold text-stone-900">{resourceCount}</strong> resources available
        </span>
        <span className="inline-flex items-center gap-1 font-medium text-stone-800 group-hover:translate-x-0.5 transition-transform">
          <span>Open</span>
          <ArrowUpRight className="w-3.5 h-3.5" />
        </span>
      </div>
    </article>
  );
};
