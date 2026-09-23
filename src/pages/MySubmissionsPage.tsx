import React, { useState, useEffect } from 'react';
import { useRouter } from '../context/RouterContext';
import { useAuth } from '../context/AuthContext';
import { ResourceService } from '../services/resourceService';
import { COURSES } from '../data/courses';
import { Resource } from '../types';
import { FileStatusBadge } from '../components/FileStatusBadge';
import { EmptyState } from '../components/EmptyState';
import { StudentAuthModal } from '../components/StudentAuthModal';
import {
  FileText,
  AlertCircle,
  Plus,
  BookOpen,
  ArrowRight,
  User,
} from 'lucide-react';

export const MySubmissionsPage: React.FC = () => {
  const { navigate } = useRouter();
  const { currentUser, isLoggedIn, loginAsDemoStudent } = useAuth();
  const [submissions, setSubmissions] = useState<Resource[]>([]);
  const [, setLoading] = useState(true);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [expandedRejectionId, setExpandedRejectionId] = useState<string | null>(null);

  const fetchMySubmissions = async () => {
    if (!isLoggedIn) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const data = await ResourceService.getStudentSubmissions(
        currentUser.studentId,
        currentUser.email
      );
      setSubmissions(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMySubmissions();

    const handleUpdate = () => fetchMySubmissions();
    window.addEventListener('kucse25_resources_updated', handleUpdate);
    return () => window.removeEventListener('kucse25_resources_updated', handleUpdate);
  }, [currentUser, isLoggedIn]);

  if (!isLoggedIn) {
    return (
      <div className="max-w-md mx-auto px-4 py-16 text-center space-y-4">
        <div className="w-10 h-10 rounded-md bg-stone-100 border border-stone-200 flex items-center justify-center mx-auto text-stone-600">
          <User className="w-5 h-5" />
        </div>
        <h1 className="text-xl font-bold text-stone-900 tracking-tight">Student Sign In Required</h1>
        <p className="text-xs text-stone-600 leading-relaxed">
          Please verify your Khulna University CSE student email to view your submitted academic resources and their moderation status.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-2 pt-2">
          <button
            type="button"
            onClick={() => loginAsDemoStudent()}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-stone-900 hover:bg-stone-800 rounded transition-colors"
          >
            <span>Continue as Rifat Ahmed (250233)</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setAuthModalOpen(true)}
            className="w-full sm:w-auto px-3.5 py-2 text-xs font-medium text-stone-700 bg-stone-100 hover:bg-stone-200 rounded border border-stone-200 transition-colors"
          >
            Verify Other Email
          </button>
        </div>

        <StudentAuthModal
          isOpen={authModalOpen}
          onClose={() => setAuthModalOpen(false)}
          onSuccess={fetchMySubmissions}
        />
      </div>
    );
  }

  const getCourseCode = (courseId: string) => {
    const course = COURSES.find((c) => c.id === courseId);
    return course ? course.code : courseId;
  };

  const formatDate = (isoStr: string) => {
    try {
      const d = new Date(isoStr);
      return d.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return isoStr;
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-stone-200">
        <div>
          <div className="inline-flex items-center gap-1.5 text-xs font-mono text-stone-500 mb-2">
            <span>Student Dashboard</span>
            <span aria-hidden="true">·</span>
            <span>{currentUser.name}</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-stone-900">
            My Submissions
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-stone-600">
            Track the status of academic resources you contributed to the KUCSE25 archive.
          </p>
        </div>

        <button
          type="button"
          onClick={() => navigate('/upload')}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-stone-900 hover:bg-stone-800 rounded transition-colors shrink-0 self-start sm:self-auto"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Submit New Resource</span>
        </button>
      </div>

      {/* Submissions Table / List */}
      {submissions.length === 0 ? (
        <EmptyState
          title="No resources submitted yet"
          description="You haven't contributed any resources to the batch archive yet. Share lecture notes, slides, or previous examination solutions."
          actionLabel="Submit your first resource"
          onAction={() => navigate('/upload')}
        />
      ) : (
        <div className="bg-white border border-stone-200 rounded-md overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-stone-50 border-b border-stone-200 text-stone-600 font-semibold uppercase tracking-wider text-[11px]">
                <tr>
                  <th scope="col" className="px-5 py-3.5">
                    File Name
                  </th>
                  <th scope="col" className="px-5 py-3.5">
                    Course
                  </th>
                  <th scope="col" className="px-5 py-3.5">
                    Status
                  </th>
                  <th scope="col" className="px-5 py-3.5">
                    Submitted Date
                  </th>
                  <th scope="col" className="px-5 py-3.5 text-right">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {submissions.map((item) => (
                  <React.Fragment key={item.id}>
                    <tr className="hover:bg-stone-50 transition-colors">
                      <td className="px-5 py-4 font-medium text-stone-900">
                        <div className="flex items-center gap-2.5">
                          <FileText className="w-4 h-4 text-stone-500 shrink-0" />
                          <div>
                            <span className="font-semibold block">{item.fileName}</span>
                            <span className="text-[11px] text-stone-500 font-mono">
                              {item.fileSize} · {item.resourceType}
                            </span>
                          </div>
                        </div>
                      </td>

                      <td className="px-5 py-4 text-stone-700 font-mono">
                        {getCourseCode(item.courseId)}
                      </td>

                      <td className="px-5 py-4">
                        <FileStatusBadge status={item.status} />
                      </td>

                      <td className="px-5 py-4 text-stone-500 tabular-nums">
                        {formatDate(item.submittedAt)}
                      </td>

                      <td className="px-5 py-4 text-right space-x-2">
                        {item.status === 'approved' && (
                          <button
                            type="button"
                            onClick={() => navigate(`/read/${item.id}`)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-stone-700 bg-stone-100 hover:bg-stone-200 rounded border border-stone-200 transition-colors"
                          >
                            <BookOpen className="w-3 h-3" />
                            <span>Read</span>
                          </button>
                        )}

                        {item.status === 'rejected' && item.rejectionReason && (
                          <button
                            type="button"
                            onClick={() =>
                              setExpandedRejectionId(
                                expandedRejectionId === item.id ? null : item.id
                              )
                            }
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-rose-700 bg-rose-50 hover:bg-rose-100 rounded border border-rose-200 transition-colors"
                          >
                            <AlertCircle className="w-3 h-3" />
                            <span>
                              {expandedRejectionId === item.id ? 'Hide Reason' : 'View Reason'}
                            </span>
                          </button>
                        )}

                        {item.status === 'pending' && (
                          <span className="text-stone-400 italic text-[11px]">In Review</span>
                        )}
                      </td>
                    </tr>

                    {/* Rejection Reason Display row */}
                    {item.status === 'rejected' && item.rejectionReason && expandedRejectionId === item.id && (
                      <tr className="bg-rose-50/50">
                        <td colSpan={5} className="px-6 py-3.5 border-t border-rose-100">
                          <div className="flex items-start gap-2.5 text-xs text-rose-900">
                            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                            <div>
                              <p className="font-semibold text-rose-950">
                                Moderation Feedback from CR/ACR ({item.reviewedBy || 'Batch Moderator'}):
                              </p>
                              <p className="mt-1 text-rose-800 leading-relaxed font-normal">
                                "{item.rejectionReason}"
                              </p>
                              <p className="mt-1.5 text-[11px] text-rose-600">
                                You can address these notes and submit an updated version anytime.
                              </p>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
