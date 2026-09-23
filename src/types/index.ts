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

export interface Resource {
  id: string;
  fileName: string;
  fileType: 'pdf' | 'pptx' | 'docx' | 'image' | 'archive' | 'other';
  fileSize: string; // e.g. "2.4 MB"
  fileSizeBytes: number;
  courseId: string;
  resourceType: ResourceType;
  uploaderName: string;
  uploaderEmail: string;
  uploaderStudentId: string;
  downloadCount: number;
  status: ResourceStatus;
  submittedAt: string; // ISO date string
  reviewedAt?: string;
  reviewedBy?: string;
  rejectionReason?: string;
  // Simulated document pages for DocumentViewer
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

export type UserRole = 'public' | 'student' | 'admin';

export interface UserSession {
  role: UserRole;
  name: string;
  email: string;
  studentId: string;
  title?: string; // e.g. "Class Representative (CR)" or "Student"
}

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
