import { INITIAL_RESOURCES } from '../data/mockResources';
import {
  PublicResource,
  Resource,
  ResourceAdminRecord,
  ResourceStatus,
  ResourceSubmission,
  ResourceType,
} from '../types';
import { isSupabaseConfigured, supabase } from '../lib/supabase';

export type SubmissionStage = 'checking_duplicate' | 'reserving_storage' | 'uploading';

const DEV_STORAGE_KEY = 'kucse25_academic_resources_v1';

// Shape returned by the approved-only get_resource_read_info RPC (SECURITY DEFINER).
interface ResourceReadInfo {
  storage_path?: string | null;
  original_filename?: string | null;
}

// Shape returned by the moderator-only get_rejected_storage_cleanup_queue RPC.
interface RejectedCleanupRecord {
  id: string;
  original_filename: string;
  storage_path: string;
  optimized_size_bytes: number;
  rejected_at?: string | null;
}

// Result of a rejection. cleanupPending is true when the record is rejected but
// the physical Storage object could not be deleted (and therefore still holds
// its storage_path), meaning the file remains retryable via the cleanup queue.
export interface RejectResult {
  resource: Resource | null;
  cleanupPending: boolean;
}

// Helper: Format byte sizes
function formatBytes(bytes?: number): string {
  if (!bytes || bytes === 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

// Helper: Deduce file extension category
function deriveFileType(fileName: string): 'pdf' | 'pptx' | 'docx' | 'image' | 'archive' | 'other' {
  const ext = fileName.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'pdf':
      return 'pdf';
    case 'ppt':
    case 'pptx':
      return 'pptx';
    case 'doc':
    case 'docx':
      return 'docx';
    case 'png':
    case 'jpg':
    case 'jpeg':
    case 'webp':
      return 'image';
    case 'zip':
    case 'rar':
    case 'tar':
    case 'gz':
      return 'archive';
    default:
      return 'other';
  }
}

// Helper: Derive MIME type
function deriveMimeType(fileName: string): string {
  const ext = fileName.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'pdf':
      return 'application/pdf';
    case 'pptx':
      return 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
    case 'ppt':
      return 'application/vnd.ms-powerpoint';
    case 'docx':
      return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    case 'doc':
      return 'application/msword';
    case 'png':
      return 'image/png';
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg';
    default:
      return 'application/octet-stream';
  }
}

// Helper for local mock fallback storage
function loadMockResources(): Resource[] {
  if (typeof window === 'undefined') return INITIAL_RESOURCES;
  try {
    const raw = localStorage.getItem(DEV_STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(DEV_STORAGE_KEY, JSON.stringify(INITIAL_RESOURCES));
      return INITIAL_RESOURCES;
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : INITIAL_RESOURCES;
  } catch (err) {
    console.warn('Failed to parse resources from local dev storage:', err);
    return INITIAL_RESOURCES;
  }
}

function saveMockResources(resources: Resource[]) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(DEV_STORAGE_KEY, JSON.stringify(resources));
    window.dispatchEvent(new Event('kucse25_resources_updated'));
  } catch (err) {
    console.error('Failed to save mock resources to local dev storage:', err);
  }
}

/**
 * Production Resource Service for KUCSE25 Archive
 * Communicates with Supabase PostgreSQL, Auth & Storage with fallback for initial development.
 */
export const ResourceService = {
  /**
   * Fetch approved public resources with optional filters.
   * Strips all private student identities (uploader email, student ID, internal paths).
   */
  async getPublicResources(options?: {
    courseId?: string;
    resourceType?: string;
    searchQuery?: string;
    sortBy?: 'downloads' | 'recent' | 'name';
  }): Promise<PublicResource[]> {
    if (isSupabaseConfigured && supabase) {
      try {
        const sort = options?.sortBy || 'downloads';
        let rows: any[] = [];

        // 1. Query the dedicated public_resources privacy view ONLY. This view is
        //    the authoritative public boundary: it filters status = 'approved' and
        //    exposes a narrowly-scoped column list with zero exposure of
        //    storage_path, uploader_id, emails, student IDs, or moderation data.
        //    A direct SELECT on the resources table is intentionally not used for
        //    public reads (RLS no longer grants anon/authenticated SELECT on it).
        let viewQuery = supabase
          .from('public_resources')
          .select(
            'id, course_id, original_filename, resource_type, download_count, original_size_bytes, created_at, uploader_name'
          );
        if (options?.courseId) {
          viewQuery = viewQuery.eq('course_id', options.courseId);
        }
        if (options?.resourceType && options.resourceType !== 'All') {
          viewQuery = viewQuery.eq('resource_type', options.resourceType);
        }
        if (sort === 'downloads') {
          viewQuery = viewQuery.order('download_count', { ascending: false });
        } else if (sort === 'recent') {
          viewQuery = viewQuery.order('created_at', { ascending: false });
        } else if (sort === 'name') {
          viewQuery = viewQuery.order('original_filename', { ascending: true });
        }

        const { data: viewData, error: viewError } = await viewQuery;
        if (viewError) {
          console.error('Error querying public_resources view:', viewError);
          throw viewError;
        }

        rows = (viewData || []).map((row: any) => ({
          id: row.id,
          course_id: row.course_id,
          original_filename: row.original_filename,
          resource_type: row.resource_type,
          uploader_name: row.uploader_name || 'Verified KUCSE25 Student',
          download_count: row.download_count || 0,
          original_size_bytes: row.original_size_bytes || 0,
          created_at: row.created_at,
        }));

        let mapped: PublicResource[] = rows.map((row: any) => ({
          id: row.id,
          courseId: row.course_id,
          fileName: row.original_filename,
          fileType: deriveFileType(row.original_filename),
          fileSize: formatBytes(row.original_size_bytes),
          fileSizeBytes: row.original_size_bytes || 0,
          resourceType: row.resource_type as ResourceType,
          uploaderName: row.uploader_name || 'Verified KUCSE25 Student',
          downloadCount: row.download_count || 0,
          status: 'approved' as const,
          submittedAt: row.created_at,
          pageCount: 5,
        }));

        // Search query filtering
        if (options?.searchQuery && options.searchQuery.trim()) {
          const q = options.searchQuery.trim().toLowerCase();
          mapped = mapped.filter(
            (r) =>
              r.fileName.toLowerCase().includes(q) ||
              r.courseId.toLowerCase().includes(q) ||
              r.resourceType.toLowerCase().includes(q) ||
              r.uploaderName.toLowerCase().includes(q)
          );
        }

        return mapped;
      } catch (err: any) {
        console.error('Supabase query failed in getPublicResources:', err);
        throw new Error(`Failed to load academic resources: ${err?.message || 'Database query failed'}`);
      }
    }

    // Dev mock fallback - only when !isSupabaseConfigured
    const all = loadMockResources();
    let approved = all
      .filter((r) => r.status === 'approved')
      .map((r): PublicResource => ({
        id: r.id,
        courseId: r.courseId,
        fileName: r.fileName,
        fileType: r.fileType,
        fileSize: r.fileSize,
        fileSizeBytes: r.fileSizeBytes,
        resourceType: r.resourceType,
        uploaderName: r.uploaderName,
        downloadCount: r.downloadCount,
        status: 'approved',
        submittedAt: r.submittedAt,
        pageCount: r.pageCount || 4,
        pages: r.pages,
      }));

    if (options?.courseId) {
      approved = approved.filter((r) => r.courseId === options.courseId);
    }

    if (options?.resourceType && options.resourceType !== 'All') {
      approved = approved.filter((r) => r.resourceType === options.resourceType);
    }

    if (options?.searchQuery && options.searchQuery.trim()) {
      const q = options.searchQuery.trim().toLowerCase();
      approved = approved.filter(
        (r) =>
          r.fileName.toLowerCase().includes(q) ||
          r.courseId.toLowerCase().includes(q) ||
          r.resourceType.toLowerCase().includes(q) ||
          r.uploaderName.toLowerCase().includes(q)
      );
    }

    const sort = options?.sortBy || 'downloads';
    if (sort === 'downloads') {
      approved.sort((a, b) => b.downloadCount - a.downloadCount);
    } else if (sort === 'recent') {
      approved.sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime());
    } else if (sort === 'name') {
      approved.sort((a, b) => a.fileName.localeCompare(b.fileName));
    }

    return approved;
  },

  /**
   * Fetch single resource by ID.
   * Public reader path (default) goes through the `public_resources` privacy
   * view: approved rows only, minimal public-safe columns, and NO storage_path,
   * uploader email, or student ID. The admin/moderation path
   * ({ allowNonApproved: true }) reads the full row from `resources`, which RLS
   * restricts to CR/ACR reviewers (or the owning student).
   */
  async getResourceById(id: string, options?: { allowNonApproved?: boolean }): Promise<Resource | null> {
    if (isSupabaseConfigured && supabase) {
      // --- PUBLIC READER PATH: approved-only via the privacy view ---
      if (!options?.allowNonApproved) {
        const { data: row, error } = await supabase
          .from('public_resources')
          .select(
            'id, course_id, original_filename, resource_type, download_count, original_size_bytes, created_at, uploader_name'
          )
          .eq('id', id)
          .maybeSingle();

        if (error) {
          console.error('Error in getResourceById (public path):', error);
          return null;
        }
        if (!row) {
          return null;
        }

        return {
          id: row.id,
          fileName: row.original_filename,
          fileType: deriveFileType(row.original_filename),
          fileSize: formatBytes(row.original_size_bytes),
          fileSizeBytes: row.original_size_bytes || 0,
          courseId: row.course_id,
          resourceType: row.resource_type as ResourceType,
          uploaderName: row.uploader_name || 'Verified KUCSE25 Student',
          downloadCount: row.download_count || 0,
          status: 'approved' as const,
          submittedAt: row.created_at,
          pageCount: 5,
          pages: [
            {
              pageNumber: 1,
              title: row.original_filename.replace(/\.[^/.]+$/, '').replace(/_/g, ' '),
              content: `Official KUCSE25 Academic Resource.\nCourse: ${row.course_id.toUpperCase()}\nFile: ${row.original_filename}\nType: ${row.resource_type}\n\n[Document verified for batch study and examination preparation]`,
            },
            {
              pageNumber: 2,
              title: 'Chapter Overview & Core Fundamentals',
              content: `Topics covered in this resource module:\n• Fundamental specifications\n• Lecture concepts & theorems\n• Problem-solving techniques & algorithms\n• Batch revision notes`,
            },
            {
              pageNumber: 3,
              title: 'Worked Examples & Proofs',
              content: `Step-by-step mathematical calculations and implementation details prepared for term examinations.`,
            },
            {
              pageNumber: 4,
              title: 'Laboratory & Practice Guidelines',
              content: `Instructions and test cases conforming to Department of CSE, Khulna University syllabus.`,
            },
            {
              pageNumber: 5,
              title: 'Summary & Reference Readings',
              content: `Standard textbooks and references recommended by course instructors.`,
            },
          ],
        };
      }

      // --- ADMIN / MODERATION PATH: full row (RLS gates to CR/ACR or owner) ---
      const { data: row, error } = await supabase
        .from('resources')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (error || !row) {
        return null;
      }

      let uploaderName = 'Verified KUCSE25 Student';
      let uploaderEmail = '';
      let uploaderStudentId = '';

      if (row.uploader_id) {
        const { data: uploaderProfile } = await supabase
          .from('profiles')
          .select('name, email, student_id')
          .eq('id', row.uploader_id)
          .maybeSingle();
        if (uploaderProfile) {
          uploaderName = uploaderProfile.name || uploaderName;
          uploaderEmail = uploaderProfile.email || '';
          uploaderStudentId = uploaderProfile.student_id || '';
        }
      }

      const resource: Resource = {
        id: row.id,
        fileName: row.original_filename,
        fileType: deriveFileType(row.original_filename),
        fileSize: formatBytes(row.original_size_bytes),
        fileSizeBytes: row.original_size_bytes || 0,
        courseId: row.course_id,
        resourceType: row.resource_type as ResourceType,
        uploaderName,
        uploaderEmail,
        uploaderStudentId,
        downloadCount: row.download_count || 0,
        status: row.status as ResourceStatus,
        submittedAt: row.created_at,
        reviewedAt: row.reviewed_at,
        reviewedBy: row.reviewed_by ? 'CR/ACR Reviewer' : undefined,
        rejectionReason: row.rejection_reason,
        storagePath: row.storage_path,
        pageCount: 5,
        pages: [
          {
            pageNumber: 1,
            title: row.original_filename.replace(/\.[^/.]+$/, '').replace(/_/g, ' '),
            content: `Official KUCSE25 Academic Resource.\nCourse: ${row.course_id.toUpperCase()}\nFile: ${row.original_filename}\nType: ${row.resource_type}\n\n[Document verified for batch study and examination preparation]`,
          },
          {
            pageNumber: 2,
            title: 'Chapter Overview & Core Fundamentals',
            content: `Topics covered in this resource module:\n• Fundamental specifications\n• Lecture concepts & theorems\n• Problem-solving techniques & algorithms\n• Batch revision notes`,
          },
          {
            pageNumber: 3,
            title: 'Worked Examples & Proofs',
            content: `Step-by-step mathematical calculations and implementation details prepared for term examinations.`,
          },
          {
            pageNumber: 4,
            title: 'Laboratory & Practice Guidelines',
            content: `Instructions and test cases conforming to Department of CSE, Khulna University syllabus.`,
          },
          {
            pageNumber: 5,
            title: 'Summary & Reference Readings',
            content: `Standard textbooks and references recommended by course instructors.`,
          },
        ],
      };

      return resource;
    }

    // Dev mock fallback - only when !isSupabaseConfigured
    const all = loadMockResources();
    const found = all.find((r) => r.id === id);
    if (!found) return null;

    // Check approval status in public reader mode
    if (!options?.allowNonApproved && found.status !== 'approved') {
      return null;
    }
    return found;
  },

  /**
   * Temporary Signed URL for in-browser Document Reader.
   * The storage_path is resolved through the SECURITY DEFINER
   * get_resource_read_info RPC, which only ever returns an object path for
   * APPROVED resources — so the internal storage layout is never exposed
   * through the public reader path. Generates a 5-minute signed URL.
   */
  async getReadUrl(id: string): Promise<string | null> {
    if (!isSupabaseConfigured || !supabase) {
      return null;
    }

    try {
      const { data: rpcData, error } = await supabase
        .rpc('get_resource_read_info', { res_id: id })
        .maybeSingle();
      const info = (rpcData ?? null) as ResourceReadInfo | null;
      const storagePath = info?.storage_path || '';
      if (error || !storagePath) {
        return null;
      }

      const { data: signData, error: signError } = await supabase.storage
        .from('resources')
        .createSignedUrl(storagePath, 300); // 5 minutes validity
      if (signError) {
        console.error('Failed to create signed read URL:', signError);
        return null;
      }
      return signData?.signedUrl || null;
    } catch (err) {
      console.error('Read URL generation exception:', err);
      return null;
    }
  },

  /**
   * Atomic Download Handler:
   * 1. Resolves the resource via the SECURITY DEFINER get_resource_read_info
   *    RPC, which exposes storage metadata ONLY for approved resources.
   * 2. Increments download count atomically via the increment_download RPC;
   *    a failure here (unapproved/nonexistent/RPC error) aborts the download
   *    instead of falling back to a locally fabricated count.
   * 3. Generates a temporary signed URL with attachment disposition.
   * 4. Triggers browser download of the real stored file.
   */
  async downloadResource(id: string): Promise<{ success: boolean; newCount: number; downloadUrl?: string }> {
    if (isSupabaseConfigured && supabase) {
      // 1. Verify resource exists and is approved (RPC never leaks unapproved rows)
      const { data: rpcData, error: fetchErr } = await supabase
        .rpc('get_resource_read_info', {
          res_id: id,
        })
        .maybeSingle();
      const info = (rpcData ?? null) as ResourceReadInfo | null;
      const storagePath = info?.storage_path || '';
      const originalFilename = info?.original_filename || '';

      if (fetchErr || !storagePath) {
        throw new Error('Resource record not found or is not approved for download.');
      }

      // 2. Increment download count atomically (throws on unapproved/nonexistent)
      const { data: newCount, error: rpcErr } = await supabase.rpc('increment_download', {
        res_id: id,
      });
      if (rpcErr || typeof newCount !== 'number') {
        console.error('Atomic download counter failed:', rpcErr);
        throw new Error('Failed to record download. Please retry.');
      }

      // 3. Generate temporary signed URL with content-disposition
      let downloadUrl = '';
      const { data: signData, error: signErr } = await supabase.storage
        .from('resources')
        .createSignedUrl(storagePath, 60, {
          download: originalFilename,
        });

      if (signErr || !signData?.signedUrl) {
        console.error('Failed to create signed download URL:', signErr);
        throw new Error('The file is temporarily unavailable. Please try again.');
      }
      downloadUrl = signData.signedUrl;

      // 4. Trigger download in browser
      if (typeof window !== 'undefined' && downloadUrl) {
        const anchor = document.createElement('a');
        anchor.href = downloadUrl;
        anchor.download = originalFilename;
        anchor.rel = 'noopener noreferrer';
        document.body.appendChild(anchor);
        anchor.click();
        document.body.removeChild(anchor);
      }

      return { success: true, newCount, downloadUrl };
    }

    // Dev mock fallback
    const newCount = await this.incrementDownload(id);
    const mockRes = await this.getResourceById(id, { allowNonApproved: true });
    if (typeof window !== 'undefined' && mockRes) {
      const sample = `KUCSE25 Academic Resource Archive\nFile: ${mockRes.fileName}\nCourse: ${mockRes.courseId}\nDownloads: ${newCount}\n\n[Dev fallback document content for Khulna University CSE Batch 25]`;
      const blob = new Blob([sample], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = mockRes.fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
    return { success: true, newCount };
  },

  /**
   * Atomic increment download RPC invocation.
   * When Supabase is configured the RPC is authoritative: an RPC failure
   * (e.g. unapproved/nonexistent resource) surfaces as an error rather than
   * silently mutating local dev storage, keeping counters truthful.
   */
  async incrementDownload(id: string): Promise<number> {
    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase.rpc('increment_download', { res_id: id });
      if (error) {
        console.error('Error invoking atomic increment_download:', error);
        throw new Error(error.message || 'Failed to increment download counter.');
      }
      if (typeof data !== 'number') {
        throw new Error('Download counter RPC returned an invalid result.');
      }
      return data;
    }

    // Dev mock fallback - only when !isSupabaseConfigured
    const all = loadMockResources();
    let newCount = 0;
    const updated = all.map((r) => {
      if (r.id === id) {
        newCount = r.downloadCount + 1;
        return { ...r, downloadCount: newCount };
      }
      return r;
    });
    if (newCount === 0) {
      throw new Error('Resource not found for download.');
    }
    saveMockResources(updated);
    return newCount;
  },

  /**
   * Submit an academic resource by an authenticated student.
   * Enforces:
   * 1. Authenticated session & active student verification
   * 2. Canonical SHA-256 duplicate detection
   * 3. Atomic PostgreSQL quota reservation (800 MB safety budget)
   *    - If reserve_storage fails for ANY reason the submission ABORTS before
   *      uploading — there is deliberately no client-side fallback that could
   *      authorise an upload past the authoritative DB ceiling.
   * 4. Upload of ONLY the optimized file
   * 5. Immediate cleanup and reservation release if insert fails
   * 6. Finalization of quota upon successful insert (with explicit handling)
   */
  async createResourceSubmission(payload: {
    file: File | Blob;
    fileName: string;
    originalFileName?: string;
    originalSizeBytes?: number;
    optimizedSizeBytes?: number;
    fileHash?: string;
    mimeType?: string;
    fileType?: 'pdf' | 'pptx' | 'docx' | 'image' | 'archive' | 'other';
    courseId: string;
    resourceType: ResourceType;
    optimizationMethod?: string;
    compressionRatio?: number;
    fileSize?: string;
    fileSizeBytes?: number;
    fileSizeFormatted?: string;
    uploaderName?: string;
    uploaderEmail?: string;
    uploaderStudentId?: string;
  }, onStage?: (stage: SubmissionStage) => void): Promise<Resource> {
    const originalName = payload.originalFileName || payload.fileName;
    // Size authority: actual byte counts come from the real File/Blob in hand.
    // The browser-supplied fileSize/fileSizeBytes are only display hints and are
    // never trusted for quota math; there is no hard-coded kilo-byte fallback.
    const actualFile = payload.file;
    const originalBytes =
      payload.originalSizeBytes ||
      (actualFile instanceof Blob ? actualFile.size : payload.fileSizeBytes || 0);
    // The uploaded blob is the single source of truth for stored bytes, so
    // optimized_size_bytes always equals the exact object that reaches Storage.
    const optimizedBytes =
      actualFile instanceof Blob
        ? actualFile.size
        : payload.optimizedSizeBytes || originalBytes || 0;

    if (originalBytes <= 0 || optimizedBytes <= 0) {
      throw new Error('Unable to determine the file size for reservation. Please re-select the file.');
    }

    if (isSupabaseConfigured && supabase) {
      // 1. Enforce authenticated session
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        throw new Error('Authentication required: You must verify your KUCSE25 student email before uploading.');
      }

      // 2. Fetch authenticated profile
      const { data: profile, error: profErr } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', session.user.id)
        .single();

      if (profErr || !profile || !profile.is_active) {
        throw new Error('Access denied: Active KUCSE25 batch registration required.');
      }

      // 3. Duplicate content detection (by canonical optimized SHA-256 hash).
      //    check_duplicate_hash is an OPTIMIZATION only: the authoritative
      //    guard against the duplicate race is the DB partial unique index on
      //    resources(file_hash) whose violation surfaces as error 23505 below.
      onStage?.('checking_duplicate');
      if (payload.fileHash) {
        const { data: isDuplicate, error: dupErr } = await supabase.rpc('check_duplicate_hash', {
          p_hash: payload.fileHash,
        });
        if (dupErr) {
          console.warn('Duplicate RPC check unavailable, relying on DB unique index:', dupErr);
        } else if (isDuplicate) {
          throw new Error('This resource appears to already exist in the archive.');
        }
      }

      // 4. Atomic PostgreSQL storage quota reservation
      //    reserve_storage is SECURITY DEFINER and the ONLY authority for quota.
      //    Any failure — quota exceeded, network, DB error — aborts the upload.
      //    There is deliberately NO client-side fallback that would let a file
      //    be uploaded past the authoritative 800 MB ceiling.
      onStage?.('reserving_storage');
      let reservationId: string | null = null;
      const quotaErrCode = (qErr: any): string => {
        const msg = (qErr?.message || '').toLowerCase();
        if (msg.includes('storage_quota_exceeded')) return 'STORAGE_QUOTA_EXCEEDED';
        return '';
      };

      const { data: resId, error: quotaErr } = await supabase.rpc('reserve_storage', {
        required_bytes: optimizedBytes,
      });

      if (quotaErr) {
        console.error('Quota reservation refused:', quotaErr);
        if (quotaErrCode(quotaErr) === 'STORAGE_QUOTA_EXCEEDED') {
          throw new Error('Archive storage is temporarily full. Please try again later.');
        }
        throw new Error(`Storage reservation failed: ${quotaErr.message}`);
      }

      if (!resId) {
        throw new Error('Storage reservation returned no reservation ID.');
      }
      reservationId = resId;

      const resourceId = crypto.randomUUID();
      const sanitizedName = originalName.replace(/[^a-zA-Z0-9._-]/g, '_');
      const storagePath = `${resourceId}/${sanitizedName}`;

      // 5. Upload ONLY the optimized file to private Supabase Storage
      onStage?.('uploading');
      const { error: uploadError } = await supabase.storage
        .from('resources')
        .upload(storagePath, payload.file, {
          contentType: payload.mimeType || deriveMimeType(originalName),
          upsert: false,
        });

      if (uploadError) {
        console.error('Storage upload error:', uploadError);
        // Compensating action B: release the reserved quota on upload failure.
        if (reservationId) {
          try {
            await supabase.rpc('release_storage_reservation', { reservation_id: reservationId });
          } catch (releaseErr) {
            console.error('[RESERVATION RELEASE FAILED] After upload failure:', reservationId, releaseErr);
          }
        }
        throw new Error(`Failed to upload file to storage: ${uploadError.message}`);
      }

      // 6. Insert row into PostgreSQL resources table
      const { data: inserted, error: insertError } = await supabase
        .from('resources')
        .insert({
          id: resourceId,
          course_id: payload.courseId,
          original_filename: originalName,
          stored_filename: sanitizedName,
          storage_path: storagePath,
          resource_type: payload.resourceType,
          uploader_id: session.user.id,
          status: 'pending',
          download_count: 0,
          original_size_bytes: originalBytes,
          optimized_size_bytes: optimizedBytes,
          file_hash: payload.fileHash || null,
          mime_type: payload.mimeType || deriveMimeType(originalName),
        })
        .select()
        .single();

      if (insertError) {
        // Immediate cleanup of uploaded storage object (compensating action C):
        // the duplicate/file must not occupy quota without a DB record.
        try {
          await supabase.storage.from('resources').remove([storagePath]);
        } catch (cleanupErr) {
          console.error('[STORAGE CLEANUP FAILED] Orphaned path:', storagePath, cleanupErr);
        }
        // Release reservation (compensating action C)
        if (reservationId) {
          try {
            await supabase.rpc('release_storage_reservation', { reservation_id: reservationId });
          } catch (releaseErr) {
            console.error('[RESERVATION RELEASE FAILED] After insert failure:', reservationId, releaseErr);
          }
        }

        // Detect the DB-authoritative duplicate race: partial unique index
        // idx_resources_active_file_hash rejects a second active file_hash.
        if (insertError.code === '23505') {
          throw new Error('This resource was just submitted by someone else. It already exists in the archive.');
        }
        throw new Error(`Failed to record submission: ${insertError.message}`);
      }

      // 7. Finalize quota reservation (compensating action D).
      //    finalize_storage_reservation simply deletes the reservation row. If it
      //    fails, attempt release; if reconciliation also fails, log it loudly.
      //    A stray reservation is never a permanent inconsistency: it self-expires
      //    after 10 minutes and reserve_storage prunes expired rows while the
      //    quota lock is held, so the ceiling can never be permanently oversold.
      if (reservationId) {
        const { error: finalizeErr } = await supabase.rpc('finalize_storage_reservation', {
          reservation_id: reservationId,
        });
        if (finalizeErr) {
          console.error('[FINALIZE FAILED] Reservation not finalized:', reservationId, finalizeErr);
          try {
            await supabase.rpc('release_storage_reservation', { reservation_id: reservationId });
          } catch (releaseErr) {
            console.error(
              '[RECONCILE FAILED] Reservation remains until 10-minute expiry — quota MAY be temporarily over-reserved:',
              reservationId,
              releaseErr
            );
          }
        }
      }

      return {
        id: inserted.id,
        fileName: inserted.original_filename,
        fileType: deriveFileType(inserted.original_filename),
        fileSize: formatBytes(inserted.optimized_size_bytes || inserted.original_size_bytes),
        fileSizeBytes: inserted.optimized_size_bytes || inserted.original_size_bytes,
        courseId: inserted.course_id,
        resourceType: inserted.resource_type as ResourceType,
        uploaderName: profile.name,
        uploaderEmail: profile.email,
        uploaderStudentId: profile.student_id,
        downloadCount: 0,
        status: 'pending',
        submittedAt: inserted.created_at,
        storagePath: inserted.storage_path,
      };
    }

    // Dev mock fallback
    const all = loadMockResources();

    // Check mock duplicate
    onStage?.('checking_duplicate');
    if (payload.fileHash) {
      const isMockDup = all.some(
        (r) => (r as any).fileHash === payload.fileHash && ['pending', 'approved'].includes(r.status)
      );
      if (isMockDup) {
        throw new Error('This resource appears to already exist in the archive.');
      }
    }

    onStage?.('reserving_storage');
    onStage?.('uploading');

    const newId = `res-${Date.now()}`;
    const newResource: Resource = {
      id: newId,
      fileName: originalName,
      fileType: payload.fileType || deriveFileType(originalName),
      fileSize: formatBytes(optimizedBytes),
      fileSizeBytes: optimizedBytes,
      courseId: payload.courseId,
      resourceType: payload.resourceType,
      uploaderName: payload.uploaderName || 'KUCSE25 Student',
      uploaderEmail: payload.uploaderEmail || '',
      uploaderStudentId: payload.uploaderStudentId || '',
      downloadCount: 0,
      status: 'pending',
      submittedAt: new Date().toISOString(),
      pageCount: 6,
      pages: [
        {
          pageNumber: 1,
          title: originalName.replace(/\.[^/.]+$/, '').replace(/_/g, ' '),
          content: `Resource submitted for Course ${payload.courseId.toUpperCase()}.\n\nDocument queued for CR/ACR verification.`,
        },
      ],
    };
    (newResource as any).fileHash = payload.fileHash;
    (newResource as any).originalSizeBytes = originalBytes;
    (newResource as any).optimizedSizeBytes = optimizedBytes;

    all.unshift(newResource);
    saveMockResources(all);
    return newResource;
  },

  /**
   * Alias for backward compatibility
   */
  async submitResource(payload: any): Promise<Resource> {
    return this.createResourceSubmission(payload);
  },

  /**
   * Student: Fetch all submissions uploaded by the student
   */
  async getStudentSubmissions(studentId?: string, email?: string): Promise<ResourceSubmission[]> {
    if (isSupabaseConfigured && supabase) {
      try {
        // RLS guarantees user can only select their own submissions
        const { data, error } = await supabase
          .from('resources')
          .select('*')
          .order('created_at', { ascending: false });

        if (error) {
          console.error('Error fetching student submissions:', error);
          throw error;
        }

        const uploaderIds = [...new Set((data || []).map((r: any) => r.uploader_id).filter(Boolean))];
        const profileMap: Record<string, any> = {};
        if (uploaderIds.length > 0) {
          const { data: profs } = await supabase
            .from('profiles')
            .select('id, name, student_id')
            .in('id', uploaderIds);
          (profs || []).forEach((p: any) => {
            profileMap[p.id] = p;
          });
        }

        return (data || []).map((row: any): ResourceSubmission => {
          const prof = profileMap[row.uploader_id];
          return {
            id: row.id,
            courseId: row.course_id,
            fileName: row.original_filename,
            fileType: deriveFileType(row.original_filename),
            fileSize: formatBytes(row.original_size_bytes),
            fileSizeBytes: row.original_size_bytes || 0,
            resourceType: row.resource_type as ResourceType,
            uploaderName: prof?.name || 'You',
            uploaderStudentId: prof?.student_id || studentId || '',
            status: row.status as ResourceStatus,
            submittedAt: row.created_at,
            downloadCount: row.download_count || 0,
            reviewedAt: row.reviewed_at,
            reviewedBy: row.reviewed_by ? 'CR/ACR Reviewer' : undefined,
            rejectionReason: row.rejection_reason,
            storagePath: row.storage_path,
          };
        });
      } catch (err: any) {
        console.error('Supabase getStudentSubmissions failed:', err);
        throw new Error(`Failed to load student submissions: ${err?.message || 'Database query failed'}`);
      }
    }

    // Dev mock fallback - only when !isSupabaseConfigured
    const all = loadMockResources();
    return all
      .filter(
        (r) =>
          !studentId ||
          r.uploaderStudentId === studentId ||
          (email && r.uploaderEmail?.toLowerCase() === email.toLowerCase())
      )
      .map((r): ResourceSubmission => ({
        id: r.id,
        courseId: r.courseId,
        fileName: r.fileName,
        fileType: r.fileType,
        fileSize: r.fileSize || '1.0 MB',
        fileSizeBytes: r.fileSizeBytes || 1000000,
        resourceType: r.resourceType,
        uploaderName: r.uploaderName,
        uploaderStudentId: r.uploaderStudentId || '',
        status: r.status,
        submittedAt: r.submittedAt,
        downloadCount: r.downloadCount,
        reviewedAt: r.reviewedAt,
        reviewedBy: r.reviewedBy,
        rejectionReason: r.rejectionReason,
      }));
  },

  /**
   * Admin: Get pending submissions awaiting moderation
   */
  async getPendingSubmissions(): Promise<ResourceAdminRecord[]> {
    if (isSupabaseConfigured && supabase) {
      try {
        const { data, error } = await supabase
          .from('resources')
          .select('*')
          .eq('status', 'pending')
          .order('created_at', { ascending: false });

        if (error) throw error;

        const uploaderIds = [...new Set((data || []).map((r: any) => r.uploader_id).filter(Boolean))];
        const profileMap: Record<string, any> = {};
        if (uploaderIds.length > 0) {
          const { data: profs } = await supabase
            .from('profiles')
            .select('id, name, email, student_id')
            .in('id', uploaderIds);
          (profs || []).forEach((p: any) => {
            profileMap[p.id] = p;
          });
        }

        return (data || []).map((row: any): ResourceAdminRecord => {
          const prof = profileMap[row.uploader_id];
          return {
            id: row.id,
            courseId: row.course_id,
            fileName: row.original_filename,
            fileType: deriveFileType(row.original_filename),
            fileSize: formatBytes(row.original_size_bytes),
            fileSizeBytes: row.original_size_bytes || 0,
            storagePath: row.storage_path,
            resourceType: row.resource_type as ResourceType,
            uploaderId: row.uploader_id,
            uploaderName: prof?.name || 'KUCSE25 Student',
            uploaderEmail: prof?.email || '',
            uploaderStudentId: prof?.student_id || '',
            downloadCount: row.download_count || 0,
            status: row.status as ResourceStatus,
            submittedAt: row.created_at,
            reviewedAt: row.reviewed_at,
            reviewedBy: row.reviewed_by,
            rejectionReason: row.rejection_reason,
            pageCount: 5,
          };
        });
      } catch (err: any) {
        console.error('Supabase getPendingSubmissions error:', err);
        throw new Error(`Failed to load pending submissions: ${err?.message || 'Database query failed'}`);
      }
    }

    // Dev mock fallback - only when !isSupabaseConfigured
    const all = loadMockResources();
    return all
      .filter((r) => r.status === 'pending')
      .map((r): ResourceAdminRecord => ({
        id: r.id,
        courseId: r.courseId,
        fileName: r.fileName,
        fileType: r.fileType,
        fileSize: r.fileSize || '1.0 MB',
        fileSizeBytes: r.fileSizeBytes || 1000000,
        storagePath: `mock/${r.id}`,
        resourceType: r.resourceType,
        uploaderId: 'mock-uploader',
        uploaderName: r.uploaderName,
        uploaderEmail: r.uploaderEmail || '',
        uploaderStudentId: r.uploaderStudentId || '',
        downloadCount: r.downloadCount,
        status: r.status,
        submittedAt: r.submittedAt,
        reviewedAt: r.reviewedAt,
        reviewedBy: r.reviewedBy,
        rejectionReason: r.rejectionReason,
        pageCount: r.pageCount || 4,
        pages: r.pages,
      }));
  },

  /**
   * Admin: Get all resources across all statuses
   */
  async getAllResources(): Promise<ResourceAdminRecord[]> {
    if (isSupabaseConfigured && supabase) {
      try {
        const { data, error } = await supabase
          .from('resources')
          .select('*')
          .order('created_at', { ascending: false });

        if (error) throw error;

        const uploaderIds = [...new Set((data || []).map((r: any) => r.uploader_id).filter(Boolean))];
        const profileMap: Record<string, any> = {};
        if (uploaderIds.length > 0) {
          const { data: profs } = await supabase
            .from('profiles')
            .select('id, name, email, student_id')
            .in('id', uploaderIds);
          (profs || []).forEach((p: any) => {
            profileMap[p.id] = p;
          });
        }

        return (data || []).map((row: any): ResourceAdminRecord => {
          const prof = profileMap[row.uploader_id];
          return {
            id: row.id,
            courseId: row.course_id,
            fileName: row.original_filename,
            fileType: deriveFileType(row.original_filename),
            fileSize: formatBytes(row.original_size_bytes),
            fileSizeBytes: row.original_size_bytes || 0,
            storagePath: row.storage_path,
            resourceType: row.resource_type as ResourceType,
            uploaderId: row.uploader_id,
            uploaderName: prof?.name || 'KUCSE25 Student',
            uploaderEmail: prof?.email || '',
            uploaderStudentId: prof?.student_id || '',
            downloadCount: row.download_count || 0,
            status: row.status as ResourceStatus,
            submittedAt: row.created_at,
            reviewedAt: row.reviewed_at,
            reviewedBy: row.reviewed_by,
            rejectionReason: row.rejection_reason,
            pageCount: 5,
          };
        });
      } catch (err: any) {
        console.error('Supabase getAllResources error:', err);
        throw new Error(`Failed to load archive resources: ${err?.message || 'Database query failed'}`);
      }
    }

    // Dev mock fallback - only when !isSupabaseConfigured
    const all = loadMockResources();
    return all.map((r): ResourceAdminRecord => ({
      id: r.id,
      courseId: r.courseId,
      fileName: r.fileName,
      fileType: r.fileType,
      fileSize: r.fileSize || '1.0 MB',
      fileSizeBytes: r.fileSizeBytes || 1000000,
      storagePath: `mock/${r.id}`,
      resourceType: r.resourceType,
      uploaderId: 'mock-uploader',
      uploaderName: r.uploaderName,
      uploaderEmail: r.uploaderEmail || '',
      uploaderStudentId: r.uploaderStudentId || '',
      downloadCount: r.downloadCount,
      status: r.status,
      submittedAt: r.submittedAt,
      reviewedAt: r.reviewedAt,
      reviewedBy: r.reviewedBy,
      rejectionReason: r.rejectionReason,
      pageCount: r.pageCount || 4,
      pages: r.pages,
    }));
  },

  /**
   * Admin: Approve resource submission
   */
  async approveResource(id: string, reviewerName: string): Promise<Resource | null> {
    if (isSupabaseConfigured && supabase) {
      const { data: { session } } = await supabase.auth.getSession();
      const { data, error } = await supabase
        .from('resources')
        .update({
          status: 'approved',
          reviewed_at: new Date().toISOString(),
          reviewed_by: session?.user?.id || null,
          rejection_reason: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select()
        .single();

      if (error) {
        console.error('Error approving resource in Supabase:', error);
        throw error;
      }
      return this.getResourceById(id, { allowNonApproved: true });
    }

    // Dev mock fallback
    const all = loadMockResources();
    let updatedResource: Resource | null = null;
    const next = all.map((r) => {
      if (r.id === id) {
        updatedResource = {
          ...r,
          status: 'approved' as ResourceStatus,
          reviewedAt: new Date().toISOString(),
          reviewedBy: reviewerName,
          rejectionReason: undefined,
        };
        return updatedResource;
      }
      return r;
    });
    saveMockResources(next);
    return updatedResource;
  },

  /**
   * Admin: Reject resource submission with feedback.
   *
   * Rejection lifecycle (delete-before-clear):
   * 1. The physical Storage object is deleted FIRST.
   * 2. storage_path / optimized_size_bytes are cleared ONLY after a successful
   *    deletion.
   * 3. On deletion failure the record is still marked rejected (with reason and
   *    audit trail) but KEEPS its storage_path, so the physical file is never
   *    forgotten and remains detectable as cleanup-pending
   *    (status='rejected' AND storage_path IS NOT NULL) for retry.
   *
   * The operation is retry-safe and idempotent: retrying the cleanup (see
   * retryRejectedFileCleanup) removes a non-existent object as a no-op, then
   * clears the pointer once it is actually gone.
   */
  async rejectResource(id: string, reason: string, reviewerName: string): Promise<RejectResult> {
    if (isSupabaseConfigured && supabase) {
      const { data: { session } } = await supabase.auth.getSession();
      const reviewerId = session?.user?.id || null;
      const trimmedReason = (reason || '').trim();

      // 1. Capture the physical pointer BEFORE any mutation. A deleted object is
      //    permanent, so the path is read first and never derived later.
      const { data: existing } = await supabase
        .from('resources')
        .select('status, storage_path, optimized_size_bytes')
        .eq('id', id)
        .maybeSingle();

      if (!existing) {
        throw new Error('Resource record not found for rejection.');
      }

      const physicalPath: string | null = existing.storage_path || null;

      // 2. Record the rejection reason + audit trail. This step never touches
      //    storage metadata, so it cannot orphan the physical file.
      const { error: rejectErr } = await supabase
        .from('resources')
        .update({
          status: 'rejected',
          rejection_reason: trimmedReason,
          reviewed_at: new Date().toISOString(),
          reviewed_by: reviewerId,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id);

      if (rejectErr) {
        console.error('Error rejecting resource in Supabase:', rejectErr);
        throw rejectErr;
      }

      // 3. Attempt physical deletion BEFORE clearing storage metadata.
      let cleanupPending = false;

      if (physicalPath) {
        try {
          const { error: removeErr } = await supabase.storage
            .from('resources')
            .remove([physicalPath]);

          if (removeErr) {
            // Deletion failed: keep storage_path + optimized_size_bytes so the
            // record continues to claim quota and stays cleanup-pending.
            cleanupPending = true;
            console.error(
              '[STORAGE DELETE FAILED] Rejected but physical file retained. ' +
                `Cleanup-pending path kept for retry: ${physicalPath}. ` +
                removeErr.message
            );
          } else {
            // Deletion succeeded: only now clear the storage metadata.
            const { error: clearErr } = await supabase
              .from('resources')
              .update({ storage_path: null, optimized_size_bytes: 0 })
              .eq('id', id);

            if (clearErr) {
              // The object is gone but the DB still points at it. The cleanup
              // retry is idempotent (removing a missing object is a no-op, then
              // the pointer is cleared), so log loudly and keep the marker.
              cleanupPending = true;
              console.error(
                '[REJECT CLEAR FAILED] Physical file deleted but DB metadata not cleared:',
                id,
                physicalPath,
                clearErr.message
              );
            }
          }
        } catch (deleteErr: any) {
          cleanupPending = true;
          console.error(
            '[STORAGE DELETE EXCEPTION] Rejected but physical file retained. ' +
              `Cleanup-pending path kept for retry: ${physicalPath}. ` +
              (deleteErr?.message || deleteErr)
          );
        }
      }

      return {
        resource: await this.getResourceById(id, { allowNonApproved: true }),
        cleanupPending,
      };
    }

    // Dev mock fallback
    const all = loadMockResources();
    let updatedResource: Resource | null = null;
    const next = all.map((r) => {
      if (r.id === id) {
        updatedResource = {
          ...r,
          status: 'rejected' as ResourceStatus,
          reviewedAt: new Date().toISOString(),
          reviewedBy: reviewerName,
          rejectionReason: reason.trim(),
          storagePath: undefined,
          fileSizeBytes: 0,
        };
        (updatedResource as any).optimizedSizeBytes = 0;
        return updatedResource;
      }
      return r;
    });
    saveMockResources(next);
    return { resource: updatedResource, cleanupPending: false };
  },

  /**
   * Admin: Retry the physical deletion of a rejected file that is
   * cleanup-pending (status='rejected' AND storage_path IS NOT NULL).
   *
   * Retry-safe & idempotent:
   * - If the object is already gone, removal is a no-op and the pointer is then
   *   cleared.
   * - If removal fails again, storage_path is retained and the record stays in
   *   the cleanup queue — it is never forgotten.
   */
  async retryRejectedFileCleanup(
    id: string
  ): Promise<{ cleaned: boolean; resource: Resource | null }> {
    if (isSupabaseConfigured && supabase) {
      const { data: row } = await supabase
        .from('resources')
        .select('status, storage_path')
        .eq('id', id)
        .maybeSingle();

      const path = row?.storage_path || null;

      if (!row || row.status !== 'rejected' || !path) {
        return { cleaned: false, resource: await this.getResourceById(id, { allowNonApproved: true }) };
      }

      const { error: removeErr } = await supabase.storage.from('resources').remove([path]);

      if (removeErr) {
        console.error('[CLEANUP RETRY FAILED] Physical file still retained:', path, removeErr.message);
        throw new Error(
          'Cleanup retry failed: the physical file could not be deleted. The record remains cleanup-pending — the file path is preserved for a later retry.'
        );
      }

      const { error: clearErr } = await supabase
        .from('resources')
        .update({ storage_path: null, optimized_size_bytes: 0 })
        .eq('id', id);

      if (clearErr) {
        console.error('[CLEANUP CLEAR FAILED] Object deleted but metadata not cleared:', id, clearErr.message);
        throw new Error(
          'The physical file was deleted, but its metadata could not be cleared. Please retry once more to reconcile the record.'
        );
      }

      return { cleaned: true, resource: await this.getResourceById(id, { allowNonApproved: true }) };
    }

    return { cleaned: false, resource: null };
  },

  /**
   * Admin: List rejected resources that still hold a physical storage path
   * (cleanup-pending), via the moderator-gated cleanup-queue RPC.
   */
  async getRejectedCleanupQueue(): Promise<RejectedCleanupRecord[]> {
    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase.rpc('get_rejected_storage_cleanup_queue');
      if (error) {
        console.error('get_rejected_storage_cleanup_queue failed:', error);
        throw error;
      }
      return (data || []).map((r: any) => ({
        id: r.id,
        original_filename: r.original_filename,
        storage_path: r.storage_path,
        optimized_size_bytes: r.optimized_size_bytes || 0,
        rejected_at: r.rejected_at || null,
      }));
    }
    return [];
  },

  /**
   * Admin: Archive a resource
   */
  async archiveResource(id: string, reviewerName: string): Promise<Resource | null> {
    if (isSupabaseConfigured && supabase) {
      const { data: { session } } = await supabase.auth.getSession();
      const { error } = await supabase
        .from('resources')
        .update({
          status: 'archived',
          reviewed_at: new Date().toISOString(),
          reviewed_by: session?.user?.id || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id);

      if (error) {
        console.error('Error archiving resource in Supabase:', error);
        throw error;
      }
      return this.getResourceById(id, { allowNonApproved: true });
    }

    // Dev mock fallback
    const all = loadMockResources();
    let updatedResource: Resource | null = null;
    const next = all.map((r) => {
      if (r.id === id) {
        updatedResource = {
          ...r,
          status: 'archived' as ResourceStatus,
          reviewedAt: new Date().toISOString(),
          reviewedBy: reviewerName,
        };
        return updatedResource;
      }
      return r;
    });
    saveMockResources(next);
    return updatedResource;
  },

  /**
   * Admin: Summary metrics for dashboard with 800 MB application budget and optimization savings
   */
  async getAdminStats() {
    const BUDGET_BYTES = 800 * 1024 * 1024; // 800 MB Application safety budget

    if (isSupabaseConfigured && supabase) {
      try {
        const { data, error } = await supabase
          .from('resources')
          .select('status, download_count, original_size_bytes, optimized_size_bytes, storage_path');

        if (!error && data) {
          const pendingCount = data.filter((r) => r.status === 'pending').length;
          const approvedCount = data.filter((r) => r.status === 'approved').length;
          const rejectedCount = data.filter((r) => r.status === 'rejected').length;
          const archivedCount = data.filter((r) => r.status === 'archived').length;
          const totalDownloads = data.reduce((sum, r) => sum + (r.download_count || 0), 0);

          // Authoritative storage usage: resources physically stored in Storage bucket.
          // Rejected rows with a retained storage_path are cleanup-pending and still
          // occupy real bucket space, so they are deliberately counted too.
          const physicalResources = data.filter(
            (r) => r.storage_path && ['pending', 'approved', 'archived', 'rejected'].includes(r.status)
          );

          const totalStoredBytes = physicalResources.reduce(
            (sum, r) => sum + (r.optimized_size_bytes || 0),
            0
          );

          const totalOriginalBytes = physicalResources.reduce(
            (sum, r) => sum + (r.original_size_bytes || r.optimized_size_bytes || 0),
            0
          );

          const totalSavedBytes = physicalResources.reduce((sum, r) => {
            const orig = r.original_size_bytes || 0;
            const opt = r.optimized_size_bytes || 0;
            return sum + (orig > opt ? orig - opt : 0);
          }, 0);

          const mbUsed = (totalStoredBytes / (1024 * 1024)).toFixed(1);
          const mbRemaining = Math.max(0, (BUDGET_BYTES - totalStoredBytes) / (1024 * 1024)).toFixed(1);
          const storageUsagePercent = Math.min(100, Math.round((totalStoredBytes / BUDGET_BYTES) * 100));

          return {
            pendingCount,
            approvedCount,
            rejectedCount,
            archivedCount,
            totalResources: data.length,
            totalDownloads,
            storageUsedFormatted: `${mbUsed} MB`,
            storageLimitFormatted: 'Application Storage',
            storageBudgetFormatted: '800 MB',
            storageRemainingFormatted: `${mbRemaining} MB`,
            storageBudgetMb: 800,
            storageUsedBytes: totalStoredBytes,
            storageUsagePercent,
            spaceSavedFormatted: `${(totalSavedBytes / (1024 * 1024)).toFixed(1)} MB`,
            originalTotalFormatted: `${(totalOriginalBytes / (1024 * 1024)).toFixed(1)} MB`,
            storedTotalFormatted: `${mbUsed} MB`,
            spaceSavedBytes: totalSavedBytes,
          };
        }
        return {
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
        };
      } catch (err: any) {
        console.error('Error calculating admin stats from Supabase:', err);
        throw new Error(`Failed to calculate admin metrics: ${err?.message || 'Database query failed'}`);
      }
    }

    // Dev mock fallback - only when !isSupabaseConfigured
    const all = loadMockResources();
    const pendingCount = all.filter((r) => r.status === 'pending').length;
    const approvedCount = all.filter((r) => r.status === 'approved').length;
    const rejectedCount = all.filter((r) => r.status === 'rejected').length;
    const archivedCount = all.filter((r) => r.status === 'archived').length;
    const totalDownloads = all.reduce((sum, r) => sum + (r.downloadCount || 0), 0);

    const physicalMock = all.filter((r) => ['pending', 'approved', 'archived', 'rejected'].includes(r.status));
    const totalStoredBytes = physicalMock.reduce((sum, r) => sum + (r.fileSizeBytes || 0), 0);
    const totalOriginalBytes = physicalMock.reduce(
      (sum, r) => sum + ((r as any).originalSizeBytes || r.fileSizeBytes || 0),
      0
    );
    const totalSavedBytes = physicalMock.reduce((sum, r) => {
      const orig = (r as any).originalSizeBytes || r.fileSizeBytes || 0;
      const opt = (r as any).optimizedSizeBytes || r.fileSizeBytes || 0;
      return sum + (orig > opt ? orig - opt : 0);
    }, 0);

    const mbUsed = (totalStoredBytes / (1024 * 1024)).toFixed(1);
    const mbRemaining = Math.max(0, (BUDGET_BYTES - totalStoredBytes) / (1024 * 1024)).toFixed(1);
    const storageUsagePercent = Math.min(100, Math.round((totalStoredBytes / BUDGET_BYTES) * 100));

    return {
      pendingCount,
      approvedCount,
      rejectedCount,
      archivedCount,
      totalResources: all.length,
      totalDownloads,
      storageUsedFormatted: `${mbUsed} MB`,
      storageLimitFormatted: 'Application Storage',
      storageBudgetFormatted: '800 MB',
      storageRemainingFormatted: `${mbRemaining} MB`,
      storageBudgetMb: 800,
      storageUsedBytes: totalStoredBytes,
      storageUsagePercent,
      spaceSavedFormatted: `${(totalSavedBytes / (1024 * 1024)).toFixed(1)} MB`,
      originalTotalFormatted: `${(totalOriginalBytes / (1024 * 1024)).toFixed(1)} MB`,
      storedTotalFormatted: `${mbUsed} MB`,
      spaceSavedBytes: totalSavedBytes,
    };
  },

  /**
   * Reset local storage for testing
   */
  resetToInitial() {
    if (typeof window !== 'undefined') {
      localStorage.setItem(DEV_STORAGE_KEY, JSON.stringify(INITIAL_RESOURCES));
      window.dispatchEvent(new Event('kucse25_resources_updated'));
    }
  },
};
