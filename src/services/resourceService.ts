import { INITIAL_RESOURCES } from '../data/mockResources';
import { Resource, ResourceStatus, ResourceType } from '../types';

const STORAGE_KEY = 'kucse25_academic_resources_v1';

// Initialize local cache from localStorage or fallback to initial mock data
function loadResourcesFromStorage(): Resource[] {
  if (typeof window === 'undefined') return INITIAL_RESOURCES;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(INITIAL_RESOURCES));
      return INITIAL_RESOURCES;
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : INITIAL_RESOURCES;
  } catch (err) {
    console.warn('Failed to parse resources from storage:', err);
    return INITIAL_RESOURCES;
  }
}

function saveResourcesToStorage(resources: Resource[]) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(resources));
    // Dispatch a custom event so other components / hooks react immediately
    window.dispatchEvent(new Event('kucse25_resources_updated'));
  } catch (err) {
    console.error('Failed to save resources to storage:', err);
  }
}

/**
 * Service methods simulating asynchronous database interactions (ready for Supabase)
 */
export const ResourceService = {
  /**
   * Fetch approved public resources with optional filters
   */
  async getPublicResources(options?: {
    courseId?: string;
    resourceType?: string;
    searchQuery?: string;
    sortBy?: 'downloads' | 'recent' | 'name';
  }): Promise<Resource[]> {
    const all = loadResourcesFromStorage();
    let approved = all.filter((r) => r.status === 'approved');

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

    // Sort
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
   * Fetch single resource by ID
   */
  async getResourceById(id: string): Promise<Resource | null> {
    const all = loadResourcesFromStorage();
    const found = all.find((r) => r.id === id);
    return found || null;
  },

  /**
   * Increment download count for a resource (simulates backend download increment)
   */
  async incrementDownload(id: string): Promise<number> {
    const all = loadResourcesFromStorage();
    let newCount = 0;
    const updated = all.map((r) => {
      if (r.id === id) {
        newCount = r.downloadCount + 1;
        return { ...r, downloadCount: newCount };
      }
      return r;
    });
    saveResourcesToStorage(updated);
    return newCount;
  },

  /**
   * Submit a new academic resource (defaults to 'pending' state awaiting CR/ACR review)
   */
  async submitResource(payload: {
    fileName: string;
    fileSizeBytes?: number;
    fileSizeFormatted?: string;
    fileSize?: string;
    fileType: 'pdf' | 'pptx' | 'docx' | 'image' | 'archive' | 'other';
    courseId: string;
    resourceType: ResourceType;
    uploaderName: string;
    uploaderEmail: string;
    uploaderStudentId: string;
  }): Promise<Resource> {
    const all = loadResourcesFromStorage();
    const newId = `res-${Date.now()}`;
    const newResource: Resource = {
      id: newId,
      fileName: payload.fileName,
      fileType: payload.fileType,
      fileSize: payload.fileSizeFormatted || payload.fileSize || '1.2 MB',
      fileSizeBytes: payload.fileSizeBytes || 1200000,
      courseId: payload.courseId,
      resourceType: payload.resourceType,
      uploaderName: payload.uploaderName,
      uploaderEmail: payload.uploaderEmail,
      uploaderStudentId: payload.uploaderStudentId,
      downloadCount: 0,
      status: 'pending',
      submittedAt: new Date().toISOString(),
      pageCount: 6,
      pages: [
        {
          pageNumber: 1,
          title: payload.fileName.replace(/\.[^/.]+$/, '').replace(/_/g, ' '),
          content: `Resource submitted by ${payload.uploaderName} for Course ${payload.courseId.toUpperCase()}.\n\nDocument contents are queued for verification by batch CR/ACR.`,
        },
      ],
    };

    all.unshift(newResource);
    saveResourcesToStorage(all);
    return newResource;
  },

  /**
   * Alias for submitResource
   */
  async createResourceSubmission(payload: {
    fileName: string;
    fileSize?: string;
    fileSizeBytes?: number;
    fileSizeFormatted?: string;
    fileType: 'pdf' | 'pptx' | 'docx' | 'image' | 'archive' | 'other';
    courseId: string;
    resourceType: ResourceType;
    uploaderName: string;
    uploaderEmail: string;
    uploaderStudentId: string;
  }): Promise<Resource> {
    return this.submitResource(payload);
  },

  /**
   * Get all submissions for a student
   */
  async getStudentSubmissions(studentId: string, email?: string): Promise<Resource[]> {
    const all = loadResourcesFromStorage();
    return all.filter(
      (r) =>
        r.uploaderStudentId === studentId ||
        (email && r.uploaderEmail.toLowerCase() === email.toLowerCase())
    );
  },

  /**
   * Admin: Get all pending submissions
   */
  async getPendingSubmissions(): Promise<Resource[]> {
    const all = loadResourcesFromStorage();
    return all.filter((r) => r.status === 'pending');
  },

  /**
   * Admin: Get all resources (approved, pending, rejected, archived)
   */
  async getAllResources(): Promise<Resource[]> {
    return loadResourcesFromStorage();
  },

  /**
   * Admin: Approve a resource
   */
  async approveResource(id: string, reviewerName: string): Promise<Resource | null> {
    const all = loadResourcesFromStorage();
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
    saveResourcesToStorage(next);
    return updatedResource;
  },

  /**
   * Admin: Reject a resource (requires reason)
   */
  async rejectResource(id: string, reason: string, reviewerName: string): Promise<Resource | null> {
    const all = loadResourcesFromStorage();
    let updatedResource: Resource | null = null;
    const next = all.map((r) => {
      if (r.id === id) {
        updatedResource = {
          ...r,
          status: 'rejected' as ResourceStatus,
          reviewedAt: new Date().toISOString(),
          reviewedBy: reviewerName,
          rejectionReason: reason.trim(),
        };
        return updatedResource;
      }
      return r;
    });
    saveResourcesToStorage(next);
    return updatedResource;
  },

  /**
   * Admin: Archive a resource
   */
  async archiveResource(id: string, reviewerName: string): Promise<Resource | null> {
    const all = loadResourcesFromStorage();
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
    saveResourcesToStorage(next);
    return updatedResource;
  },

  /**
   * Admin: Stats for dashboard
   */
  async getAdminStats() {
    const all = loadResourcesFromStorage();
    const pendingCount = all.filter((r) => r.status === 'pending').length;
    const approvedCount = all.filter((r) => r.status === 'approved').length;
    const rejectedCount = all.filter((r) => r.status === 'rejected').length;
    const archivedCount = all.filter((r) => r.status === 'archived').length;
    const totalDownloads = all.reduce((sum, r) => sum + (r.downloadCount || 0), 0);
    const totalBytes = all.reduce((sum, r) => sum + (r.fileSizeBytes || 0), 0);

    const mbUsed = (totalBytes / (1024 * 1024)).toFixed(1);
    // Supposing free-tier storage pool limit is 1 GB (1024 MB)
    const storageUsagePercent = Math.min(100, Math.round((totalBytes / (1024 * 1024 * 1024)) * 100));

    return {
      pendingCount,
      approvedCount,
      rejectedCount,
      archivedCount,
      totalResources: all.length,
      totalDownloads,
      storageUsedFormatted: `${mbUsed} MB`,
      storageLimitFormatted: '1.0 GB Free Tier Pool',
      storageUsagePercent,
    };
  },

  /**
   * Reset to initial state for testing
   */
  resetToInitial() {
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(INITIAL_RESOURCES));
      window.dispatchEvent(new Event('kucse25_resources_updated'));
    }
  },
};
