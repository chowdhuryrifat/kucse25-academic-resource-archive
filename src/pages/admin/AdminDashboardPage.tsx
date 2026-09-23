import React, { useState, useEffect } from 'react';
import { useRouter } from '../../context/RouterContext';
import { useAuth } from '../../context/AuthContext';
import { ResourceService } from '../../services/resourceService';
import { COURSES } from '../../data/courses';
import { Resource } from '../../types';
import { AdminSidebar } from '../../components/AdminSidebar';
import { AdminAccessGuard } from '../../components/AdminAccessGuard';
import { Modal } from '../../components/Modal';
import { StatsCard } from '../../components/StatsCard';
import {
  Clock,
  CheckCircle2,
  HardDrive,
  DownloadCloud,
  FileText,
  Check,
  X,
  Eye,
  AlertTriangle,
  RotateCcw,
  Shield,
  Layers,
  ArrowRight,
  CheckCheck,
} from 'lucide-react';

export const AdminDashboardPage: React.FC = () => {
  const { navigate } = useRouter();
  const { currentUser } = useAuth();

  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    pendingCount: 0,
    approvedCount: 0,
    rejectedCount: 0,
    archivedCount: 0,
    totalResources: 0,
    totalDownloads: 0,
    storageUsedFormatted: '0 MB',
    storageLimitFormatted: 'Application Storage',
    storageBudgetFormatted: '800 MB',
    storageRemainingFormatted: '800.0 MB',
    storageBudgetMb: 800,
    storageUsedBytes: 0,
    storageUsagePercent: 0,
    spaceSavedFormatted: '0 MB',
    originalTotalFormatted: '0 MB',
    storedTotalFormatted: '0 MB',
    spaceSavedBytes: 0,
  });

  const [pendingQueue, setPendingQueue] = useState<Resource[]>([]);
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [targetRejectResource, setTargetRejectResource] = useState<Resource | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [actionNotice, setActionNotice] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const s = await ResourceService.getAdminStats();
      setStats(s);

      const pending = await ResourceService.getPendingSubmissions();
      setPendingQueue(pending);
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
      setActionNotice({
        type: 'success',
        message: `Approved "${resource.fileName}" for the public archive.`,
      });
      setTimeout(() => setActionNotice(null), 3500);
      loadData();
    } catch {
      setActionNotice({
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
      await ResourceService.rejectResource(
        targetRejectResource.id,
        rejectReason.trim(),
        `${currentUser.name} (${currentUser.title || 'Moderator'})`
      );

      setRejectModalOpen(false);
      setActionNotice({
        type: 'info',
        message: `Rejected "${targetRejectResource.fileName}" and cleared storage allocation. Feedback recorded for student.`,
      });
      setTimeout(() => setActionNotice(null), 3500);
      setTargetRejectResource(null);
      loadData();
    } catch {
      setActionNotice({
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

  return (
    <AdminAccessGuard>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Toast / Notification Banner */}
        {actionNotice && (
          <div
            className={`p-3 rounded-md text-xs flex items-center justify-between transition-all ${
              actionNotice.type === 'success'
                ? 'bg-stone-900 text-stone-100 border border-stone-800'
                : actionNotice.type === 'error'
                ? 'bg-rose-950 text-rose-100 border border-rose-800'
                : 'bg-stone-900 text-stone-100 border border-stone-800'
            }`}
          >
            <div className="flex items-center gap-2">
              {actionNotice.type === 'success' ? (
                <CheckCheck className="w-4 h-4 text-emerald-400 shrink-0" />
              ) : (
                <Shield className="w-4 h-4 text-stone-400 shrink-0" />
              )}
              <span className="font-medium">{actionNotice.message}</span>
            </div>
            <button
              type="button"
              onClick={() => setActionNotice(null)}
              className="text-stone-400 hover:text-white p-1 rounded"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        <div className="flex flex-col md:flex-row gap-6">
          {/* Internal Sidebar */}
          <AdminSidebar pendingCount={stats.pendingCount} />

          {/* Main Dashboard Panel */}
          <main className="flex-1 space-y-6">
            {/* Console Header */}
            <div className="p-5 bg-white border border-stone-200 rounded-md flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[10px] font-mono uppercase tracking-wider px-1.5 py-0.5 bg-stone-900 text-stone-100 rounded font-semibold">
                    INTERNAL CONSOLE
                  </span>
                  <span className="text-xs font-mono text-stone-500">
                    Khulna University CSE Batch 25
                  </span>
                </div>
                <h1 className="text-2xl font-bold tracking-tight text-stone-900">
                  Moderation Dashboard
                </h1>
                <p className="text-xs text-stone-600 mt-0.5">
                  Governed by CR (Tanvir Hossain) & ACR (Tahmidul Islam) · Acting as{' '}
                  <strong className="text-stone-900 font-semibold">{currentUser.name}</strong>
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    ResourceService.resetToInitial();
                    loadData();
                    setActionNotice({
                      type: 'info',
                      message: 'Reset demo archive to initial verified seed resources.',
                    });
                    setTimeout(() => setActionNotice(null), 3000);
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-stone-700 hover:text-stone-900 bg-stone-50 hover:bg-stone-100 border border-stone-300 rounded transition-colors"
                  title="Reset demo data to initial state"
                >
                  <RotateCcw className="w-3.5 h-3.5 text-stone-500" />
                  <span>Reset Seed Data</span>
                </button>
              </div>
            </div>

            {/* MANDATORY 5 DASHBOARD STATISTICS CARDS */}
            <section aria-label="Dashboard Key Performance Metrics">
              <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
                <StatsCard
                  label="Pending resources"
                  value={stats.pendingCount}
                  subtext="Awaiting CR/ACR review"
                  icon={<Clock className="w-4 h-4 text-amber-600" />}
                />

                <StatsCard
                  label="Approved resources"
                  value={stats.approvedCount}
                  subtext="Active on public site"
                  icon={<CheckCircle2 className="w-4 h-4 text-emerald-600" />}
                />

                <StatsCard
                  label="Total resources"
                  value={stats.totalResources}
                  subtext="All submissions"
                  icon={<Layers className="w-4 h-4 text-stone-600" />}
                />

                <StatsCard
                  label="Total downloads"
                  value={stats.totalDownloads.toLocaleString()}
                  subtext="Batch downloads"
                  icon={<DownloadCloud className="w-4 h-4 text-stone-700" />}
                />

                <StatsCard
                  label="Storage used"
                  value={stats.storageUsedFormatted}
                  subtext={`of 800 MB budget (${stats.storageUsagePercent}%)`}
                  icon={<HardDrive className="w-4 h-4 text-stone-700" />}
                />
              </div>

              {/* STORAGE QUOTA PROTECTION & OPTIMIZATION SAVINGS */}
              <div className="mt-3 sm:mt-4 p-4 bg-white border border-stone-200 rounded-md">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-stone-900 flex items-center gap-1.5">
                      <HardDrive className="w-3.5 h-3.5 text-stone-700" />
                      Application Storage Quota & Optimization
                    </h3>
                    <p className="text-xs text-stone-500 mt-0.5">
                      Enforced 800 MB application ceiling protects the free-tier quota from accidental exhaustion.
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-4 text-xs font-mono">
                    <div>
                      <span className="text-stone-400 block text-[10px] uppercase">Space Saved</span>
                      <span className="font-bold text-emerald-700">{stats.spaceSavedFormatted}</span>
                    </div>
                    <div className="border-l border-stone-200 pl-4">
                      <span className="text-stone-400 block text-[10px] uppercase">Original Total</span>
                      <span className="font-medium text-stone-700">{stats.originalTotalFormatted}</span>
                    </div>
                    <div className="border-l border-stone-200 pl-4">
                      <span className="text-stone-400 block text-[10px] uppercase">Remaining</span>
                      <span className="font-semibold text-stone-900">{stats.storageRemainingFormatted}</span>
                    </div>
                  </div>
                </div>

                <div className="mt-3">
                  <div className="flex items-center justify-between text-[11px] font-mono text-stone-500 mb-1">
                    <span>{stats.storageUsedFormatted} stored</span>
                    <span>800 MB ceiling ({stats.storageUsagePercent}%)</span>
                  </div>
                  <div className="w-full bg-stone-100 h-2 rounded overflow-hidden border border-stone-200">
                    <div
                      className={`h-full transition-all duration-500 ${
                        stats.storageUsagePercent > 85
                          ? 'bg-rose-600'
                          : stats.storageUsagePercent > 65
                          ? 'bg-amber-500'
                          : 'bg-stone-900'
                      }`}
                      style={{ width: `${Math.min(100, Math.max(1, stats.storageUsagePercent))}%` }}
                    />
                  </div>
                </div>
              </div>
            </section>

            {/* MANDATORY PENDING QUEUE TABLE */}
            <section className="bg-white border border-stone-200 rounded-md overflow-hidden">
              <div className="p-4 sm:p-5 border-b border-stone-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h2 className="text-sm font-bold text-stone-900 uppercase tracking-wide">
                    Pending Verification Queue
                  </h2>
                  <p className="text-xs text-stone-500">
                    Student submissions requiring academic legitimacy and legibility review
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono px-2 py-0.5 bg-amber-50 text-amber-900 border border-amber-200 rounded font-semibold tabular-nums">
                    {pendingQueue.length} pending
                  </span>
                  <button
                    type="button"
                    onClick={() => navigate('/admin/pending')}
                    className="text-xs font-medium text-stone-600 hover:text-stone-900 inline-flex items-center gap-1"
                  >
                    <span>View Dedicated Queue</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {loading ? (
                <div className="p-8 space-y-4 animate-pulse">
                  <div className="h-4 bg-stone-200 rounded w-1/3" />
                  <div className="space-y-2">
                    <div className="h-10 bg-stone-100 rounded" />
                    <div className="h-10 bg-stone-100 rounded" />
                    <div className="h-10 bg-stone-100 rounded" />
                  </div>
                </div>
              ) : pendingQueue.length === 0 ? (
                <div className="py-16 px-6 text-center text-xs text-stone-500 space-y-2">
                  <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto" />
                  <h3 className="text-sm font-semibold text-stone-900">All Clear: No Submissions Pending</h3>
                  <p className="max-w-sm mx-auto text-stone-600">
                    The moderation queue is completely empty. New student resource submissions will automatically arrive here for verification.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-stone-50 border-b border-stone-200 text-stone-600 font-semibold uppercase tracking-wider text-[11px]">
                      <tr>
                        <th scope="col" className="px-4 py-3">Filename</th>
                        <th scope="col" className="px-4 py-3">Uploader</th>
                        <th scope="col" className="px-4 py-3">Course</th>
                        <th scope="col" className="px-4 py-3">Resource Type</th>
                        <th scope="col" className="px-4 py-3">File Size</th>
                        <th scope="col" className="px-4 py-3">Submitted Date</th>
                        <th scope="col" className="px-4 py-3 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-100">
                      {pendingQueue.map((item) => (
                        <tr key={item.id} className="hover:bg-stone-50 transition-colors">
                          <td className="px-4 py-3.5 font-medium text-stone-900 max-w-[220px]">
                            <div className="flex items-center gap-2">
                              <FileText className="w-4 h-4 text-stone-500 shrink-0" />
                              <span className="font-semibold truncate" title={item.fileName}>
                                {item.fileName}
                              </span>
                            </div>
                          </td>

                          <td className="px-4 py-3.5 text-stone-700">
                            <div>
                              <span className="font-semibold block">{item.uploaderName}</span>
                              <span className="text-[11px] text-stone-400 font-mono">
                                {item.uploaderStudentId ? `ID: ${item.uploaderStudentId}` : item.uploaderEmail}
                              </span>
                            </div>
                          </td>

                          <td className="px-4 py-3.5">
                            <span className="font-mono font-medium text-stone-800 bg-stone-100 px-1.5 py-0.5 rounded text-[11px]">
                              {getCourseCode(item.courseId)}
                            </span>
                          </td>

                          <td className="px-4 py-3.5 text-stone-600">
                            <span className="text-[11px]">
                              {item.resourceType}
                            </span>
                          </td>

                          <td className="px-4 py-3.5 font-mono text-stone-600 tabular-nums">
                            {item.fileSize}
                          </td>

                          <td className="px-4 py-3.5 text-stone-500 tabular-nums whitespace-nowrap">
                            {formatDate(item.submittedAt)}
                          </td>

                          <td className="px-4 py-3.5 text-right space-x-1.5 whitespace-nowrap">
                            <button
                              type="button"
                              onClick={() => navigate(`/admin/resources/${item.id}`)}
                              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-stone-700 bg-stone-100 hover:bg-stone-200 rounded border border-stone-200 transition-colors"
                              title="Inspect document preview and metadata"
                            >
                              <Eye className="w-3.5 h-3.5 text-stone-500" />
                              <span>Review</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => handleApprove(item)}
                              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-emerald-800 bg-emerald-50 hover:bg-emerald-100 rounded border border-emerald-200 transition-colors"
                              title="Approve resource for public catalog"
                            >
                              <Check className="w-3.5 h-3.5 text-emerald-700" />
                              <span>Approve</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => handleOpenReject(item)}
                              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-rose-800 bg-rose-50 hover:bg-rose-100 rounded border border-rose-200 transition-colors"
                              title="Reject submission and give feedback to student"
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
              )}
            </section>
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
                <p className="font-semibold">Rejection requires an explanatory reason</p>
                <p className="mt-0.5 text-rose-800">
                  This explanation will be recorded and shown to{' '}
                  <strong>{targetRejectResource?.uploaderName}</strong> in their "My Submissions" portal so they understand what to correct.
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
                placeholder="e.g. Scanned images are blurry and unreadable; duplicate of Lecture 04; please re-upload with high contrast or compile into a single PDF..."
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
