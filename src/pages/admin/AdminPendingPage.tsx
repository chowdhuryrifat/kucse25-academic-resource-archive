import React, { useState, useEffect } from 'react';
import { useRouter } from '../../context/RouterContext';
import { useAuth } from '../../context/AuthContext';
import { ResourceService } from '../../services/resourceService';
import { COURSES } from '../../data/courses';
import { Resource } from '../../types';
import { AdminSidebar } from '../../components/AdminSidebar';
import { AdminAccessGuard } from '../../components/AdminAccessGuard';
import { Modal } from '../../components/Modal';
import {
  FileText,
  Check,
  X,
  Eye,
  AlertTriangle,
  Clock,
  CheckCircle2,
  Search,
  CheckCheck,
} from 'lucide-react';

export const AdminPendingPage: React.FC = () => {
  const { navigate } = useRouter();
  const { currentUser } = useAuth();
  const [pendingQueue, setPendingQueue] = useState<Resource[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [targetRejectResource, setTargetRejectResource] = useState<Resource | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [notice, setNotice] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const list = await ResourceService.getPendingSubmissions();
      setPendingQueue(list);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const handleUpdate = () => loadData();
    window.addEventListener('kucse25_resources_updated', handleUpdate);
    return () => window.removeEventListener('kucse25_resources_updated', handleUpdate);
  }, []);

  const handleApprove = async (resource: Resource) => {
    try {
      await ResourceService.approveResource(resource.id, `${currentUser.name} (${currentUser.title || 'Moderator'})`);
      setNotice({
        type: 'success',
        message: `Approved "${resource.fileName}". It is now accessible on the public catalog.`,
      });
      setTimeout(() => setNotice(null), 3000);
      loadData();
    } catch {
      setNotice({
        type: 'error',
        message: `Failed to approve "${resource.fileName}".`,
      });
    }
  };

  const handleOpenReject = (resource: Resource) => {
    setTargetRejectResource(resource);
    setRejectReason('');
    setRejectModalOpen(true);
  };

  const handleConfirmReject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetRejectResource || !rejectReason.trim()) return;

    try {
      const result = await ResourceService.rejectResource(
        targetRejectResource.id,
        rejectReason.trim(),
        `${currentUser.name} (${currentUser.title || 'Moderator'})`
      );

      setRejectModalOpen(false);
      setNotice({
        type: 'info',
        message: result.cleanupPending
          ? `Rejected "${targetRejectResource.fileName}", but the physical file could not be purged. It is cleanup-pending and still counts against archive quota — use Retry File Cleanup.`
          : `Rejected "${targetRejectResource.fileName}" and freed storage allocation. Feedback recorded for student.`,
      });
      setTimeout(() => setNotice(null), 4500);
      setTargetRejectResource(null);
      loadData();
    } catch {
      setNotice({
        type: 'error',
        message: 'Failed to record rejection.',
      });
    }
  };

  const getCourseCode = (courseId: string) => {
    const c = COURSES.find((item) => item.id === courseId);
    return c ? c.code : courseId.toUpperCase();
  };

  const formatDate = (isoStr: string) => {
    try {
      return new Date(isoStr).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return isoStr;
    }
  };

  const filtered = pendingQueue.filter((item) => {
    if (!search.trim()) return true;
    const q = search.trim().toLowerCase();
    return (
      item.fileName.toLowerCase().includes(q) ||
      item.uploaderName.toLowerCase().includes(q) ||
      (item.uploaderStudentId ? item.uploaderStudentId.toLowerCase().includes(q) : false) ||
      item.courseId.toLowerCase().includes(q) ||
      item.resourceType.toLowerCase().includes(q)
    );
  });

  return (
    <AdminAccessGuard>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {notice && (
          <div
            className={`p-3 rounded-md text-xs flex items-center justify-between transition-all ${
              notice.type === 'success'
                ? 'bg-stone-900 text-stone-100 border border-stone-800'
                : notice.type === 'error'
                ? 'bg-rose-950 text-rose-100 border border-rose-800'
                : 'bg-stone-900 text-stone-100 border border-stone-800'
            }`}
          >
            <div className="flex items-center gap-2">
              {notice.type === 'success' && <CheckCheck className="w-4 h-4 text-emerald-400 shrink-0" />}
              <span className="font-medium">{notice.message}</span>
            </div>
            <button
              type="button"
              onClick={() => setNotice(null)}
              className="text-stone-400 hover:text-white p-1 rounded"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        <div className="flex flex-col md:flex-row gap-6">
          <AdminSidebar pendingCount={pendingQueue.length} />

          <main className="flex-1 space-y-6">
            {/* Header */}
            <div className="pb-4 border-b border-stone-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-stone-900">
                  Pending Submissions Queue
                </h1>
                <p className="text-xs text-stone-600 mt-0.5">
                  Review submitted materials for academic integrity, legibility, and proper curriculum alignment.
                </p>
              </div>
              <div className="flex items-center gap-1.5 text-xs font-mono text-stone-700 bg-stone-100 border border-stone-200 px-3 py-1.5 rounded">
                <Clock className="w-3.5 h-3.5 text-amber-600" />
                <span className="font-semibold tabular-nums">{pendingQueue.length} pending verification</span>
              </div>
            </div>

            {/* Filter / Search within Pending Queue */}
            {pendingQueue.length > 0 && (
              <div className="relative max-w-sm">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-stone-400">
                  <Search className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Filter pending files by name, uploader, course..."
                  className="w-full pl-9 pr-8 py-2 text-xs bg-white border border-stone-300 rounded focus:outline-none focus:border-stone-900 focus:ring-1 focus:ring-stone-900 transition-colors"
                />
                {search && (
                  <button
                    type="button"
                    onClick={() => setSearch('')}
                    className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-stone-400 hover:text-stone-700"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            )}

            {loading ? (
              <div className="p-12 text-center bg-white border border-stone-200 rounded-md space-y-3 animate-pulse">
                <div className="h-4 bg-stone-200 rounded w-1/4 mx-auto" />
                <div className="h-3 bg-stone-100 rounded w-1/2 mx-auto" />
              </div>
            ) : pendingQueue.length === 0 ? (
              <div className="p-12 text-center bg-white border border-stone-200 rounded-md space-y-2">
                <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto" />
                <h2 className="text-base font-bold text-stone-900">Moderation Queue is Empty</h2>
                <p className="mt-1 text-xs text-stone-600 max-w-sm mx-auto">
                  All submitted student resources have been processed. When a student uploads a new document, it will immediately appear here.
                </p>
                <div className="pt-2">
                  <button
                    type="button"
                    onClick={() => navigate('/admin/resources')}
                    className="px-3.5 py-1.5 text-xs font-medium text-stone-700 bg-stone-100 hover:bg-stone-200 rounded border border-stone-200 transition-colors"
                  >
                    View All Archived Resources
                  </button>
                </div>
              </div>
            ) : filtered.length === 0 ? (
              <div className="p-8 text-center bg-white border border-dashed border-stone-300 rounded-md text-xs text-stone-500 space-y-2">
                <p className="font-semibold text-stone-800">No pending items match "{search}"</p>
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  className="text-stone-800 underline"
                >
                  Clear search
                </button>
              </div>
            ) : (
              <div className="bg-white border border-stone-200 rounded-md overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-stone-50 border-b border-stone-200 text-stone-600 font-semibold uppercase tracking-wider text-[11px]">
                      <tr>
                        <th scope="col" className="px-5 py-3.5">Filename</th>
                        <th scope="col" className="px-5 py-3.5">Uploader</th>
                        <th scope="col" className="px-5 py-3.5">Course</th>
                        <th scope="col" className="px-5 py-3.5">Resource Type</th>
                        <th scope="col" className="px-5 py-3.5">File Size</th>
                        <th scope="col" className="px-5 py-3.5">Submitted Date</th>
                        <th scope="col" className="px-5 py-3.5 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-100">
                      {filtered.map((item) => (
                        <tr key={item.id} className="hover:bg-stone-50 transition-colors">
                          <td className="px-5 py-4 font-semibold text-stone-900 max-w-[240px]">
                            <div className="flex items-center gap-2.5">
                              <FileText className="w-4 h-4 text-stone-500 shrink-0" />
                              <span className="truncate" title={item.fileName}>
                                {item.fileName}
                              </span>
                            </div>
                          </td>

                          <td className="px-5 py-4 text-stone-700">
                            <div>
                              <span className="font-semibold block">{item.uploaderName}</span>
                              <span className="text-[11px] text-stone-400 font-mono">
                                {item.uploaderStudentId ? `ID: ${item.uploaderStudentId}` : item.uploaderEmail}
                              </span>
                            </div>
                          </td>

                          <td className="px-5 py-4">
                            <span className="font-mono font-medium text-stone-800 bg-stone-100 px-1.5 py-0.5 rounded text-[11px]">
                              {getCourseCode(item.courseId)}
                            </span>
                          </td>

                          <td className="px-5 py-4 text-stone-600">
                            <span className="text-[11px]">
                              {item.resourceType}
                            </span>
                          </td>

                          <td className="px-5 py-4 font-mono text-stone-600 tabular-nums">
                            {item.fileSize}
                          </td>

                          <td className="px-5 py-4 text-stone-500 tabular-nums whitespace-nowrap">
                            {formatDate(item.submittedAt)}
                          </td>

                          <td className="px-5 py-4 text-right space-x-1.5 whitespace-nowrap">
                            <button
                              type="button"
                              onClick={() => navigate(`/admin/resources/${item.id}`)}
                              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-stone-700 bg-stone-100 hover:bg-stone-200 rounded border border-stone-200 transition-colors"
                              title="Inspect file contents and verified uploader details"
                            >
                              <Eye className="w-3.5 h-3.5 text-stone-500" />
                              <span>Review</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => handleApprove(item)}
                              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-emerald-800 bg-emerald-50 hover:bg-emerald-100 rounded border border-emerald-200 transition-colors"
                              title="Approve for public release"
                            >
                              <Check className="w-3.5 h-3.5 text-emerald-700" />
                              <span>Approve</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => handleOpenReject(item)}
                              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-rose-800 bg-rose-50 hover:bg-rose-100 rounded border border-rose-200 transition-colors"
                              title="Reject with explanatory student feedback"
                            >
                              <X className="w-3.5 h-3.5 text-rose-700" />
                              <span>Reject</span>
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </main>
        </div>

        {/* Reject Modal Requiring Rejection Reason */}
        <Modal
          isOpen={rejectModalOpen}
          onClose={() => setRejectModalOpen(false)}
          title="Reject Resource Submission"
        >
          <form onSubmit={handleConfirmReject} className="space-y-4">
            <div className="flex items-start gap-3 p-3 bg-rose-50 border border-rose-200 rounded text-xs text-rose-900">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">Rejection reason is mandatory</p>
                <p className="mt-0.5 text-rose-800">
                  Please provide clear feedback for <strong>{targetRejectResource?.uploaderName}</strong> explaining why this document cannot be approved for public archive.
                </p>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-stone-700 mb-1">
                Document: <span className="font-bold text-stone-900">{targetRejectResource?.fileName}</span>
              </label>
              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="e.g. Incomplete lab report; low contrast handwritten scans; file is a duplicate of Lecture 02..."
                rows={4}
                className="w-full p-2.5 text-xs bg-white border border-stone-300 rounded focus:outline-none focus:border-stone-900 focus:ring-1 focus:ring-stone-900"
                required
                autoFocus
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-stone-100">
              <button
                type="button"
                onClick={() => setRejectModalOpen(false)}
                className="px-3.5 py-1.5 text-xs text-stone-600 hover:text-stone-900 font-medium"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!rejectReason.trim()}
                className="px-4 py-1.5 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 disabled:opacity-50 rounded transition-colors"
              >
                Confirm Rejection
              </button>
            </div>
          </form>
        </Modal>
      </div>
    </AdminAccessGuard>
  );
};
