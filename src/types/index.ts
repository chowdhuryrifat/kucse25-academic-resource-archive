export type ResourceType =
  | 'Lecture Slide'
  | 'Lecture Note'
  | 'Lab'
  | 'Assignment'
  | 'Question'
  | 'Solution'
  | 'Cheat Sheet'
  | 'Other';

export type ResourceStatus = 'pending' | 'approved' | 'rejected' | 'archived';

export type StudentRole = 'student' | 'cr' | 'acr';

export interface StudentProfile {
  id: string; // auth.users UUID
  studentId: string; // e.g. "250233"
  name: string;
  email: string;
  role: StudentRole;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

/**
 * Public view of an approved resource.
 * Enforces privacy boundary: zero exposure of uploader email, student ID,
 * internal storage paths, or moderation details.
 */
export interface PublicResource {
  id: string;
  courseId: string;
  fileName: string;
  fileType: 'pdf' | 'pptx' | 'docx' | 'image' | 'archive' | 'other';
  resourceType: ResourceType;
  uploaderName: string;
  downloadCount: number;
  status: 'approved';
  submittedAt: string;
  fileSize?: string;
  fileSizeBytes?: number;
  // Reader and download pointers
  readUrl?: string;
  downloadUrl?: string;
  pageCount?: number;
  pages?: {
    pageNumber: number;
    title: string;
    content: string;
    subsections?: string[];
  }[];
}

/**
 * Student view for tracking their own submissions.
 */
export interface ResourceSubmission {
  id: string;
  courseId: string;
  fileName: string;
  fileType: 'pdf' | 'pptx' | 'docx' | 'image' | 'archive' | 'other';
  fileSize: string;
  fileSizeBytes: number;
  resourceType: ResourceType;
  uploaderName: string;
  uploaderStudentId: string;
  status: ResourceStatus;
  submittedAt: string;
  downloadCount: number;
  reviewedAt?: string;
  reviewedBy?: string;
  rejectionReason?: string;
  storagePath?: string;
}

/**
 * Admin view with full metadata, verification info, and audit trail.
 */
export interface ResourceAdminRecord {
  id: string;
  courseId: string;
  fileName: string;
  fileType: 'pdf' | 'pptx' | 'docx' | 'image' | 'archive' | 'other';
  fileSize: string;
  fileSizeBytes: number;
  storagePath: string;
  resourceType: ResourceType;
  uploaderId: string;
  uploaderName: string;
  uploaderEmail: string;
  uploaderStudentId: string;
  downloadCount: number;
  status: ResourceStatus;
  submittedAt: string;
  reviewedAt?: string;
  reviewedBy?: string;
  reviewedById?: string;
  rejectionReason?: string;
  mimeType?: string;
  pageCount?: number;
  pages?: {
    pageNumber: number;
    title: string;
    content: string;
    subsections?: string[];
  }[];
}

/**
 * Unified interface for components supporting multiple contexts
 */
export interface Resource {
  id: string;
  fileName: string;
  fileType: 'pdf' | 'pptx' | 'docx' | 'image' | 'archive' | 'other';
  fileSize?: string;
  fileSizeBytes?: number;
  courseId: string;
  resourceType: ResourceType;
  uploaderName: string;
  uploaderEmail?: string;
  uploaderStudentId?: string;
  downloadCount: number;
  status: ResourceStatus;
  submittedAt: string;
  reviewedAt?: string;
  reviewedBy?: string;
  rejectionReason?: string;
  storagePath?: string;
  readUrl?: string;
  downloadUrl?: string;
  pageCount?: number;
  pages?: {
    pageNumber: number;
    title: string;
    content: string;
    subsections?: string[];
  }[];
}

export interface Course {
  id: string;
  code: string;
  title: string;
  level: number; // 1, 2, 3, 4
  term: number; // 1 or 2
  credits: number;
  teacher: string;
  department: string;
  description: string;
}

export type UserRole = 'public' | 'student' | 'cr' | 'acr' | 'admin';

export interface UserSession {
  role: UserRole;
  name: string;
  email: string;
  studentId: string;
  title?: string; // e.g. "Class Representative (CR)" or "KUCSE25 Student"
  profileId?: string;
  authUserId?: string;
  isAdmin?: boolean;
}

/**
 * Checks whether user has CR, ACR, or Admin moderation privileges
 */
export const isUserAdmin = (user?: UserSession | null): boolean => {
  if (!user) return false;
  return user.role === 'cr' || user.role === 'acr' || user.role === 'admin' || !!user.isAdmin;
};

export interface SubmissionDraft {
  file: File | null;
  fileName: string;
  fileSize: string;
  fileSizeBytes: number;
  courseId: string;
  resourceType: ResourceType;
}

export interface ResourceFilterState {
  query: string;
  courseId: string;
  resourceType: string;
  sortBy: 'downloads' | 'name' | 'recent';
}

export interface OptimizationResult {
  originalFile: File;
  optimizedFile: File | Blob;
  originalSizeBytes: number;
  optimizedSizeBytes: number;
  originalHash: string;
  optimizedHash: string;
  optimizationApplied: boolean;
  optimizationMethod: string;
  compressionRatio: number;
  savingsBytes: number;
  savingsPercentage: number;
}

