import React, { useState, useEffect } from 'react';
import { useRouter } from '../../context/RouterContext';
import { useAuth } from '../../context/AuthContext';
import { ResourceService } from '../../services/resourceService';
import { COURSES } from '../../data/courses';
import { Resource } from '../../types';
import { AdminAccessGuard } from '../../components/AdminAccessGuard';
import { FileStatusBadge } from '../../components/FileStatusBadge';
import { Modal } from '../../components/Modal';
import {
  ArrowLeft,
  Check,
  X,
  Archive,
  AlertTriangle,
  BookOpen,
  CheckCheck,
  FileQuestion,
  ExternalLink,
} from 'lucide-react';

interface AdminReviewPageProps {
  resourceId: string;
}

export const AdminReviewPage: React.FC<AdminReviewPageProps> = ({ resourceId }) => {
  const { navigate } = useRouter();
  const { currentUser } = useAuth();
  const [resource, setResource] = useState<Resource | null>(null);
  const [loading, setLoading] = useState(true);
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [notice, setNotice] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const fetchResource = async () => {
    setLoading(true);
    try {
      const res = await ResourceService.getResourceById(resourceId);
      setResource(res);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchResource();
    const handleUpdate = () => fetchResource();
    window.addEventListener('kucse25_resources_updated', handleUpdate);
    return () => window.removeEventListener('kucse25_resources_updated', handleUpdate);
  }, [resourceId]);

  const handleApprove = async () => {
    if (!resource || actionLoading) return;
    setActionLoading(true);
    try {
      await ResourceService.approveResource(
        resource.id,
        `${currentUser.name} (${currentUser.title || 'Moderator'})`
      );
      setNotice({
        type: 'success',
        message: 'Resource successfully approved and published to public archive.',
      });
      setTimeout(() => setNotice(null), 3500);
      fetchResource();
    } catch {
      setNotice({
        type: 'error',
        message: 'Failed to approve resource.',
      });
    } finally {
      setActionLoading(false);
    }
  };

  const handleConfirmReject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resource || !rejectReason.trim() || actionLoading) return;
    setActionLoading(true);
    try {
      await ResourceService.rejectResource(
        resource.id,
        rejectReason.trim(),
        `${currentUser.name} (${currentUser.title || 'Moderator'})`
      );
      setRejectModalOpen(false);
      setNotice({
        type: 'info',
        message: 'Submission rejected. Feedback recorded and visible to student.',
      });
      setTimeout(() => setNotice(null), 3500);
      fetchResource();
    } catch {
      setNotice({
        type: 'error',
        message: 'Failed to record rejection.',
      });
    } finally {
      setActionLoading(false);
    }
  };

  const handleArchive = async () => {
    if (!resource || actionLoading) return;
    setActionLoading(true);
    try {
      await ResourceService.archiveResource(
        resource.id,
        `${currentUser.name} (${currentUser.title || 'Moderator'})`
      );
      setNotice({
        type: 'info',
        message: 'Resource has been moved to archival storage.',
      });
      setTimeout(() => setNotice(null), 3500);
      fetchResource();
    } catch {
      setNotice({
        type: 'error',
        message: 'Failed to archive resource.',
      });
    } finally {
      setActionLoading(false);
    }
  };

  const formatDate = (isoStr?: string) => {
    if (!isoStr) return 'N/A';
    try {
      return new Date(isoStr).toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return isoStr;
    }
  };

  return (
    <AdminAccessGuard>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Navigation Breadcrumb */}
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => navigate('/admin/pending')}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-stone-600 hover:text-stone-900 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Pending Queue</span>
          </button>

          {/* Active Moderator Attribution */}
          <div className="flex items-center gap-2 text-xs font-mono">
            <span className="text-stone-500">Reviewing as:</span>
            <span className="px-2 py-0.5 bg-stone-100 border border-stone-200 rounded font-semibold text-stone-900">
              {currentUser.name} ({currentUser.title || 'Moderator'})
            </span>
          </div>
        </div>

        {/* Action Notice Toast */}
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

        {loading ? (
          <div className="p-8 bg-white border border-stone-200 rounded-md animate-pulse space-y-4">
            <div className="h-6 bg-stone-200 rounded w-1/3" />
            <div className="h-4 bg-stone-100 rounded w-1/2" />
            <div className="h-64 bg-stone-100 rounded" />
          </div>
        ) : !resource ? (
          <div className="p-16 bg-white border border-dashed border-stone-300 rounded-md text-center space-y-3">
            <FileQuestion className="w-10 h-10 text-stone-400 mx-auto" />
            <h2 className="text-base font-bold text-stone-900">Resource Record Not Found</h2>
            <p className="text-xs text-stone-600 max-w-sm mx-auto">
              The requested academic submission ID <code className="font-mono">{resourceId}</code> does not exist or may have been permanently purged.
            </p>
            <div className="pt-2">
              <button
                type="button"
                onClick={() => navigate('/admin/resources')}
                className="px-4 py-2 text-xs font-semibold text-white bg-stone-900 hover:bg-stone-800 rounded transition-colors"
              >
                Return to Resource Directory
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* Header & Primary Action Bar: Approve, Reject, Archive */}
            <div className="p-5 bg-white border border-stone-200 rounded-md flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs font-mono font-medium text-stone-800 bg-stone-100 px-2 py-0.5 rounded border border-stone-200">
                    {resource.courseId.toUpperCase()}
                  </span>
                  <FileStatusBadge status={resource.status} />
                </div>
                <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-stone-900 break-all">
                  {resource.fileName}
                </h1>
                <p className="text-xs text-stone-500 mt-1 font-mono">
                  Document ID: {resource.id}
                </p>
              </div>

              {/* Actions: Approve, Reject, Archive */}
              <div className="flex flex-wrap items-center gap-2 self-start md:self-auto shrink-0">
                {resource.status !== 'approved' && (
                  <button
                    type="button"
                    onClick={handleApprove}
                    disabled={actionLoading}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-stone-900 hover:bg-stone-800 rounded transition-colors disabled:opacity-50"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>Approve & Publish</span>
                  </button>
                )}

                {resource.status !== 'rejected' && (
                  <button
                    type="button"
                    onClick={() => {
                      setRejectReason('');
                      setRejectModalOpen(true);
                    }}
                    disabled={actionLoading}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-rose-800 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded transition-colors disabled:opacity-50"
                  >
                    <X className="w-3.5 h-3.5" />
                    <span>Reject Submission</span>
                  </button>
                )}

                {resource.status !== 'archived' && (
                  <button
                    type="button"
                    onClick={handleArchive}
                    disabled={actionLoading}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-stone-700 bg-stone-100 hover:bg-stone-200 rounded border border-stone-200 transition-colors disabled:opacity-50"
                  >
                    <Archive className="w-3.5 h-3.5 text-stone-500" />
                    <span>Archive</span>
                  </button>
                )}
              </div>
            </div>

            {/* Mandatory Review Contents */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Left Column: Metadata Inspection */}
              <div className="space-y-6">
                <div className="p-5 bg-white border border-stone-200 rounded-md space-y-4">
                  <h2 className="text-xs font-bold text-stone-900 uppercase tracking-wider pb-2 border-b border-stone-100">
                    Submission Verification Details
                  </h2>

                  <dl className="space-y-3 text-xs">
                    <div>
                      <dt className="text-stone-500 font-mono text-[11px]">Uploader</dt>
                      <dd className="font-semibold text-stone-900 mt-0.5">
                        {resource.uploaderName}
                      </dd>
                      <dd className="text-stone-500 font-mono text-[11px]">
                        Email: {resource.uploaderEmail}
                      </dd>
                      <dd className="text-stone-500 font-mono text-[11px]">
                        Student ID: {resource.uploaderStudentId || 'N/A'}
                      </dd>
                    </div>

                    <div>
                      <dt className="text-stone-500 font-mono text-[11px]">Course</dt>
                      <dd className="text-stone-900 font-medium mt-0.5">
                        {(() => {
                          const c = COURSES.find((item) => item.id === resource.courseId);
                          return c ? `${c.code}: ${c.title}` : resource.courseId;
                        })()}
                      </dd>
                    </div>

                    <div>
                      <dt className="text-stone-500 font-mono text-[11px]">Resource Type</dt>
                      <dd className="text-stone-900 mt-0.5 font-medium">
                        {resource.resourceType}
                      </dd>
                    </div>

                    <div>
                      <dt className="text-stone-500 font-mono text-[11px]">File Size & Bytes</dt>
                      <dd className="text-stone-900 font-mono mt-0.5">
                        {resource.fileSize} ({resource.fileSizeBytes?.toLocaleString()} bytes)
                      </dd>
                    </div>

                    <div>
                      <dt className="text-stone-500 font-mono text-[11px]">Submission Time</dt>
                      <dd className="text-stone-800 font-mono mt-0.5">
                        {formatDate(resource.submittedAt)}
                      </dd>
                    </div>

                    {resource.reviewedAt && (
                      <div className="pt-2 border-t border-stone-100">
                        <dt className="text-stone-500 font-mono text-[11px]">Moderation History</dt>
                        <dd className="text-stone-700 text-[11px] mt-0.5">
                          {formatDate(resource.reviewedAt)} by{' '}
                          <strong className="text-stone-900">{resource.reviewedBy}</strong>
                        </dd>
                      </div>
                    )}
                  </dl>
                </div>

                {/* Rejection Notice if rejected */}
                {resource.status === 'rejected' && resource.rejectionReason && (
                  <div className="p-4 bg-rose-50 border border-rose-200 rounded-md text-xs text-rose-900 space-y-1.5">
                    <div className="flex items-center gap-1.5 font-semibold text-rose-950">
                      <AlertTriangle className="w-4 h-4 text-rose-600" />
                      <span>Existing Rejection Feedback</span>
                    </div>
                    <p className="text-rose-800 leading-relaxed">
                      "{resource.rejectionReason}"
                    </p>
                  </div>
                )}
              </div>

              {/* Right Column: Document/File Preview */}
              <div className="lg:col-span-2 space-y-3">
                <div className="flex items-center justify-between text-xs text-stone-500">
                  <span className="font-semibold text-stone-800 flex items-center gap-1.5">
                    <BookOpen className="w-4 h-4 text-stone-600" />
                    <span>In-Browser Document Preview</span>
                  </span>
                  <span className="font-mono text-[11px] text-stone-500">
                    Page 1 of {resource.pageCount || 1}
                  </span>
                </div>

                {/* File Preview Canvas */}
                <div className="bg-stone-900 text-stone-100 rounded-md border border-stone-800 p-6 sm:p-8 min-h-[460px] flex flex-col justify-between">
                  <div className="space-y-4">
                    <div className="pb-3 border-b border-stone-800 flex items-center justify-between text-xs text-stone-400 font-mono">
                      <span>PREVIEW MODE · KUCSE25 VERIFICATION</span>
                      <span>{resource.resourceType}</span>
                    </div>

                    <div className="space-y-2">
                      <h3 className="text-lg font-bold text-stone-100">
                        {resource.pages?.[0]?.title || resource.fileName}
                      </h3>
                      {resource.pages?.[0]?.subsections && (
                        <div className="flex flex-wrap gap-1.5 text-[11px] text-stone-400 font-mono">
                          {resource.pages[0].subsections.map((sub, i) => (
                            <span key={i} className="bg-stone-800 px-2 py-0.5 rounded">
                              § {sub}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="text-xs text-stone-300 font-mono leading-relaxed whitespace-pre-line pt-2">
                      {resource.pages?.[0]?.content ||
                        'Sample academic content for preview inspection. The full document will be rendered in high resolution upon approval.'}
                    </div>
                  </div>

                  <div className="pt-6 border-t border-stone-800 text-[11px] text-stone-400 flex items-center justify-between">
                    <span className="font-mono">{resource.fileName}</span>
                    <button
                      type="button"
                      onClick={() => navigate(`/read/${resource.id}`)}
                      className="text-stone-300 hover:text-white underline font-sans inline-flex items-center gap-1"
                    >
                      <span>Open in Full Document Reader</span>
                      <ExternalLink className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}

        {/* Reject Modal Requiring Rejection Reason */}
        <Modal
          isOpen={rejectModalOpen}
          onClose={() => setRejectModalOpen(false)}
          title="Reject Resource Submission"
        >
          <form onSubmit={handleConfirmReject} className="space-y-4">
            <div className="p-3 bg-rose-50 border border-rose-200 rounded text-xs text-rose-900">
              <p className="font-semibold">Reason Required</p>
              <p className="mt-0.5 text-rose-800">
                Provide clear, actionable feedback to <strong>{resource?.uploaderName}</strong> on why this file cannot be published.
              </p>
            </div>

            <div>
              <label className="block text-xs font-medium text-stone-700 mb-1">
                Feedback Message:
              </label>
              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="e.g. Scanned images are blurry; duplicate of Lecture 05; please compile all chapters into a single PDF..."
                rows={4}
                className="w-full p-2.5 text-xs bg-white border border-stone-300 rounded focus:outline-none focus:border-stone-900 focus:ring-1 focus:ring-stone-900"
                required
                autoFocus
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-stone-100">
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
