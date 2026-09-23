import React, { useState, useEffect } from 'react';
import { useRouter } from '../../context/RouterContext';
import { useAuth } from '../../context/AuthContext';
import { ResourceService } from '../../services/resourceService';
import { COURSES } from '../../data/courses';
import { Resource } from '../../types';
import { AdminSidebar } from '../../components/AdminSidebar';
import { AdminAccessGuard } from '../../components/AdminAccessGuard';
import { FileStatusBadge } from '../../components/FileStatusBadge';
import {
  FileText,
  Eye,
  Archive,
  CheckCircle,
  Search,
  X,
  Layers,
  CheckCheck,
  Trash2,
} from 'lucide-react';

export const AdminResourcesPage: React.FC = () => {
  const { navigate } = useRouter();
  const { currentUser } = useAuth();
  const [resources, setResources] = useState<Resource[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const list = await ResourceService.getAllResources();
      setResources(list);
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

  const handleArchive = async (resource: Resource) => {
    try {
      await ResourceService.archiveResource(resource.id, `${currentUser.name} (${currentUser.title || 'Moderator'})`);
      setNotice({
        type: 'info',
        message: `Archived "${resource.fileName}". Removed from public listings.`,
      });
      setTimeout(() => setNotice(null), 3000);
      loadData();
    } catch {
      setNotice({
        type: 'error',
        message: `Failed to archive "${resource.fileName}".`,
      });
    }
  };

  const handleApprove = async (resource: Resource) => {
    try {
      await ResourceService.approveResource(resource.id, `${currentUser.name} (${currentUser.title || 'Moderator'})`);
      setNotice({
        type: 'success',
        message: `Approved "${resource.fileName}". Now visible in public catalog.`,
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

  const handleRetryCleanup = async (resource: Resource) => {
    try {
      const { cleaned } = await ResourceService.retryRejectedFileCleanup(resource.id);
      setNotice({
        type: cleaned ? 'success' : 'info',
        message: cleaned
          ? `Purged the rejected file "${resource.fileName}" and released archive quota.`
          : `Nothing to clean up for "${resource.fileName}".`,
      });
      setTimeout(() => setNotice(null), 3000);
      loadData();
    } catch (err: any) {
      setNotice({
        type: 'error',
        message: err?.message || `Cleanup retry failed for "${resource.fileName}". The path is preserved for another attempt.`,
      });
    }
  };

  const getCourseCode = (courseId: string) => {
    const c = COURSES.find((item) => item.id === courseId);
    return c ? c.code : courseId.toUpperCase();
  };

  // Filter items
  const filtered = resources.filter((r) => {
    if (statusFilter !== 'all' && r.status !== statusFilter) return false;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      return (
        r.fileName.toLowerCase().includes(q) ||
        r.uploaderName.toLowerCase().includes(q) ||
        (r.uploaderStudentId ? r.uploaderStudentId.toLowerCase().includes(q) : false) ||
        r.courseId.toLowerCase().includes(q) ||
        r.resourceType.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const pendingCount = resources.filter((r) => r.status === 'pending').length;

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
          <AdminSidebar pendingCount={pendingCount} />

          <main className="flex-1 space-y-6">
            <div className="pb-4 border-b border-stone-200">
              <h1 className="text-2xl font-bold tracking-tight text-stone-900">
                Complete Resource Directory
              </h1>
              <p className="text-xs text-stone-600 mt-0.5">
                Internal institutional repository of approved, pending, rejected, and archived documents.
              </p>
            </div>

            {/* Search & Filter Controls */}
            <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
              <div className="relative w-full sm:w-80">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-stone-400">
                  <Search className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Filter by file, uploader, or course..."
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

              {/* Status Tabs */}
              <div className="flex items-center gap-1 p-1 bg-stone-100 rounded-md overflow-x-auto max-w-full">
                {(['all', 'approved', 'pending', 'rejected', 'archived'] as const).map((st) => {
                  const isSelected = statusFilter === st;
                  const count =
                    st === 'all'
                      ? resources.length
                      : resources.filter((r) => r.status === st).length;

                  return (
                    <button
                      key={st}
                      type="button"
                      onClick={() => setStatusFilter(st)}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded capitalize transition-colors whitespace-nowrap ${
                        isSelected
                          ? 'bg-white text-stone-900 font-semibold shadow-xs'
                          : 'text-stone-600 hover:text-stone-900 font-medium'
                      }`}
                    >
                      <span>{st}</span>
                      <span className="text-[10px] font-mono tabular-nums text-stone-500">
                        {count}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Table of all resources */}
            {loading ? (
              <div className="p-12 text-center bg-white border border-stone-200 rounded-md animate-pulse space-y-3">
                <div className="h-4 bg-stone-200 rounded w-1/4 mx-auto" />
                <div className="h-3 bg-stone-100 rounded w-1/2 mx-auto" />
              </div>
            ) : filtered.length === 0 ? (
              <div className="p-12 text-center bg-white border border-stone-200 rounded-md text-xs text-stone-500 space-y-2">
                <Layers className="w-6 h-6 text-stone-400 mx-auto" />
                <p className="font-semibold text-stone-800">No resources found</p>
                <p className="text-stone-600">
                  {search || statusFilter !== 'all'
                    ? 'No documents match your active search and filter combination.'
                    : 'The archive contains no files yet.'}
                </p>
                {(search || statusFilter !== 'all') && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearch('');
                      setStatusFilter('all');
                    }}
                    className="px-3.5 py-1.5 text-xs font-medium text-stone-700 bg-stone-100 hover:bg-stone-200 rounded border border-stone-200 transition-colors"
                  >
                    Reset Filters
                  </button>
                )}
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
                        <th scope="col" className="px-5 py-3.5">Status</th>
                        <th scope="col" className="px-5 py-3.5">Downloads</th>
                        <th scope="col" className="px-5 py-3.5 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-100">
                      {filtered.map((r) => (
                        <tr key={r.id} className="hover:bg-stone-50 transition-colors">
                          <td className="px-5 py-4 font-semibold text-stone-900 max-w-[220px]">
                            <div className="flex items-center gap-2.5">
                              <FileText className="w-4 h-4 text-stone-500 shrink-0" />
                              <span className="truncate" title={r.fileName}>
                                {r.fileName}
                              </span>
                            </div>
                          </td>

                          <td className="px-5 py-4 text-stone-700">
                            <div>
                              <span className="font-semibold block">{r.uploaderName}</span>
                              <span className="text-[11px] text-stone-400 font-mono">
                                {r.uploaderStudentId ? `ID: ${r.uploaderStudentId}` : r.uploaderEmail}
                              </span>
                            </div>
                          </td>

                          <td className="px-5 py-4">
                            <span className="font-mono font-medium text-stone-800 bg-stone-100 px-1.5 py-0.5 rounded text-[11px]">
                              {getCourseCode(r.courseId)}
                            </span>
                          </td>

                          <td className="px-5 py-4 text-stone-600">
                            <span className="text-[11px]">
                              {r.resourceType}
                            </span>
                          </td>

                          <td className="px-5 py-4">
                            <FileStatusBadge status={r.status} />
                          </td>

                          <td className="px-5 py-4 font-mono text-stone-600 tabular-nums">
                            {r.downloadCount}
                          </td>

                          <td className="px-5 py-4 text-right space-x-1.5 whitespace-nowrap">
                            <button
                              type="button"
                              onClick={() => navigate(`/admin/resources/${r.id}`)}
                              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-stone-700 bg-stone-100 hover:bg-stone-200 rounded border border-stone-200 transition-colors"
                              title="Review full resource metadata"
                            >
                              <Eye className="w-3.5 h-3.5 text-stone-500" />
                              <span>Review</span>
                            </button>

                            {r.status !== 'approved' && (
                              <button
                                type="button"
                                onClick={() => handleApprove(r)}
                                className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-emerald-800 bg-emerald-50 hover:bg-emerald-100 rounded border border-emerald-200 transition-colors"
                                title="Approve resource"
                              >
                                <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                                <span>Approve</span>
                              </button>
                            )}

                            {r.status !== 'archived' && (
                              <button
                                type="button"
                                onClick={() => handleArchive(r)}
                                className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-stone-600 bg-white hover:bg-stone-100 rounded border border-stone-300 transition-colors"
                                title="Archive resource"
                              >
                                <Archive className="w-3.5 h-3.5 text-stone-500" />
                                <span>Archive</span>
                              </button>
                            )}

                            {r.status === 'rejected' && r.storagePath && (
                              <button
                                type="button"
                                onClick={() => handleRetryCleanup(r)}
                                className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-amber-800 bg-amber-50 hover:bg-amber-100 rounded border border-amber-300 transition-colors"
                                title="This rejected file still occupies archive quota. Retry its storage cleanup."
                              >
                                <Trash2 className="w-3.5 h-3.5 text-amber-700" />
                                <span>Cleanup</span>
                              </button>
                            )}
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
      </div>
    </AdminAccessGuard>
  );
};
