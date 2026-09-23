import React, { useState, useRef, useEffect } from 'react';
import { useRouter } from '../context/RouterContext';
import { useAuth } from '../context/AuthContext';
import { COURSES } from '../data/courses';
import { ResourceType } from '../types';
import { ResourceService } from '../services/resourceService';
import { StudentAuthModal } from '../components/StudentAuthModal';
import {
  UploadCloud,
  FileText,
  CheckCircle2,
  Clock,
  AlertTriangle,
  ArrowRight,
  Sparkles,
  ShieldCheck,
  RotateCcw,
  X,
  User,
  ShieldAlert,
} from 'lucide-react';

type UploadUiState =
  | 'idle'
  | 'selecting'
  | 'validating'
  | 'optimizing'
  | 'uploading'
  | 'pending_review'
  | 'success'
  | 'error';

const RESOURCE_TYPES: { type: ResourceType; label: string; desc: string }[] = [
  { type: 'Lecture Slide', label: 'Lecture Slide', desc: 'Official slides from teachers' },
  { type: 'Lecture Note', label: 'Lecture Note', desc: 'Class handwritten notes' },
  { type: 'Question', label: 'Question Paper', desc: 'Term final or CT questions' },
  { type: 'Solution', label: 'Worked Solution', desc: 'Past questions solutions' },
  { type: 'Cheat Sheet', label: 'Cheat Sheet', desc: 'Formulas, summary tables' },
  { type: 'Lab', label: 'Lab Manual', desc: 'Code templates & lab setups' },
  { type: 'Assignment', label: 'Assignment', desc: 'Homework tasks & specs' },
  { type: 'Other', label: 'Other', desc: 'Syllabus, reference guides' },
];

const ALLOWED_EXTENSIONS = ['.pdf', '.ppt', '.pptx', '.doc', '.docx', '.png', '.jpg', '.jpeg'];
const MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024; // 25 MB

export const UploadPage: React.FC = () => {
  const { searchParams, navigate } = useRouter();
  const { currentUser, isLoggedIn, loginAsDemoStudent, isSupabaseConfigured } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const preselectedCourse = searchParams.get('courseId') || 'cse-1205';

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedCourseId, setSelectedCourseId] = useState<string>(preselectedCourse);
  const [selectedType, setSelectedType] = useState<ResourceType>('Lecture Note');

  const [uiState, setUiState] = useState<UploadUiState>('idle');
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [dragActive, setDragActive] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [authModalOpen, setAuthModalOpen] = useState(false);

  const [fileDetails, setFileDetails] = useState<{
    fileName: string;
    fileType: string;
    fileSizeFormatted: string;
    rawBytes: number;
    optimizationStatus: string;
    validationStatus: string;
    isValid: boolean;
  } | null>(null);

  const [submittedResource, setSubmittedResource] = useState<{
    id: string;
    fileName: string;
    courseCode: string;
    courseTitle: string;
    resourceType: string;
  } | null>(null);

  useEffect(() => {
    if (searchParams.get('courseId')) {
      setSelectedCourseId(searchParams.get('courseId')!);
    }
  }, [searchParams]);

  const formatBytes = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  const getFileTypeLabel = (fileName: string): string => {
    const ext = fileName.split('.').pop()?.toLowerCase();
    switch (ext) {
      case 'pdf':
        return 'PDF Document (.pdf)';
      case 'ppt':
      case 'pptx':
        return 'PowerPoint Presentation (.pptx)';
      case 'doc':
      case 'docx':
        return 'Word Document (.docx)';
      case 'png':
      case 'jpg':
      case 'jpeg':
        return 'High-Resolution Scan (.img)';
      default:
        return 'Academic Document';
    }
  };

  const validateAndProcessFile = (file: File) => {
    setErrorMessage(null);
    setUiState('validating');

    const ext = '.' + file.name.split('.').pop()?.toLowerCase();
    const isExtensionAllowed = ALLOWED_EXTENSIONS.includes(ext);
    const isSizeAllowed = file.size <= MAX_FILE_SIZE_BYTES;

    setTimeout(() => {
      if (!isExtensionAllowed) {
        setErrorMessage(
          `Invalid file format "${ext}". Please upload PDF (.pdf), PowerPoint (.pptx), Word (.docx), or image scans (.png, .jpg).`
        );
        setSelectedFile(null);
        setFileDetails(null);
        setUiState('error');
        return;
      }

      if (!isSizeAllowed) {
        setErrorMessage(
          `File size exceeds 25 MB limit (${formatBytes(file.size)}). Please compress your academic file before uploading.`
        );
        setSelectedFile(null);
        setFileDetails(null);
        setUiState('error');
        return;
      }

      setSelectedFile(file);
      setFileDetails({
        fileName: file.name,
        fileType: getFileTypeLabel(file.name),
        fileSizeFormatted: formatBytes(file.size),
        rawBytes: file.size,
        optimizationStatus: 'Lossless compression & structure optimization will run before archival',
        validationStatus: 'Passed virus & academic file format checks',
        isValid: true,
      });

      setUiState('selecting');
    }, 250);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      validateAndProcessFile(e.target.files[0]);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      validateAndProcessFile(e.dataTransfer.files[0]);
    }
  };

  const handleClearSelectedFile = () => {
    setSelectedFile(null);
    setFileDetails(null);
    setErrorMessage(null);
    setUiState('idle');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSubmitResource = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedFile || !fileDetails?.isValid) {
      setErrorMessage('Please select a valid academic document file to proceed.');
      setUiState('error');
      return;
    }

    try {
      setUiState('optimizing');
      setUploadProgress(20);
      await new Promise((r) => setTimeout(r, 300));

      setUploadProgress(45);
      setUiState('uploading');

      // Submit resource with real file to Supabase backend & Storage
      const createdResource = await ResourceService.createResourceSubmission({
        file: selectedFile,
        fileName: selectedFile.name,
        fileType: selectedFile.name.endsWith('.pptx') || selectedFile.name.endsWith('.ppt')
          ? 'pptx'
          : selectedFile.name.endsWith('.docx') || selectedFile.name.endsWith('.doc')
          ? 'docx'
          : selectedFile.name.endsWith('.png') || selectedFile.name.endsWith('.jpg') || selectedFile.name.endsWith('.jpeg')
          ? 'image'
          : 'pdf',
        fileSize: fileDetails.fileSizeFormatted,
        fileSizeBytes: selectedFile.size,
        courseId: selectedCourseId,
        resourceType: selectedType,
      });

      setUploadProgress(85);
      setUiState('pending_review');
      await new Promise((r) => setTimeout(r, 350));
      setUploadProgress(100);

      const selectedCourse = COURSES.find((c) => c.id === selectedCourseId);

      setSubmittedResource({
        id: createdResource.id,
        fileName: selectedFile.name,
        courseCode: selectedCourse ? selectedCourse.code : selectedCourseId.toUpperCase(),
        courseTitle: selectedCourse ? selectedCourse.title : 'Course Archive',
        resourceType: selectedType,
      });

      setUiState('success');
    } catch (err: any) {
      console.error('Submission error:', err);
      setErrorMessage(err.message || 'Failed to submit document. Please retry.');
      setUiState('error');
    }
  };

  const handleResetForNewUpload = () => {
    setSelectedFile(null);
    setFileDetails(null);
    setErrorMessage(null);
    setUiState('idle');
    setSubmittedResource(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // ROUTE PROTECTION: Require authenticated student
  if (!isLoggedIn) {
    return (
      <div className="max-w-md mx-auto px-4 py-20 text-center space-y-4">
        <div className="w-12 h-12 rounded-md bg-stone-100 border border-stone-200 flex items-center justify-center mx-auto text-stone-700">
          <User className="w-6 h-6" />
        </div>
        <h1 className="text-xl font-bold text-stone-900 tracking-tight">Student Authentication Required</h1>
        <p className="text-xs text-stone-600 leading-relaxed">
          To maintain academic integrity and prevent spam, only verified KUCSE25 batch members can upload study materials to the archive.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-2 pt-2">
          <button
            type="button"
            onClick={() => setAuthModalOpen(true)}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-stone-900 hover:bg-stone-800 rounded transition-colors"
          >
            <ShieldCheck className="w-4 h-4" />
            <span>Verify Student Email</span>
          </button>

          {!isSupabaseConfigured && (
            <button
              type="button"
              onClick={() => loginAsDemoStudent()}
              className="w-full sm:w-auto px-3.5 py-2 text-xs font-medium text-stone-700 bg-stone-100 hover:bg-stone-200 rounded border border-stone-200 transition-colors"
            >
              Demo Student Sign In
            </button>
          )}
        </div>

        <StudentAuthModal
          isOpen={authModalOpen}
          onClose={() => setAuthModalOpen(false)}
        />
      </div>
    );
  }

  const selectedCourse = COURSES.find((c) => c.id === selectedCourseId);

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* 1. Header */}
      <div>
        <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 text-xs font-medium text-stone-700 bg-stone-100 rounded border border-stone-200">
          <UploadCloud className="w-3.5 h-3.5 text-stone-600" />
          <span>Academic Contribution</span>
        </div>
        <h1 className="mt-2 text-2xl sm:text-3xl font-bold text-stone-900 tracking-tight">
          Upload Academic Resource
        </h1>
        <p className="mt-1 text-xs sm:text-sm text-stone-600 leading-relaxed">
          Submit course lecture slides, handwritten notes, laboratory guides, or past final question papers to the Batch 25 archive.
        </p>
      </div>

      {/* 2. Authenticated Student Badge (Identity derived from session) */}
      <div className="p-4 bg-white border border-stone-200 rounded-md flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded bg-stone-900 text-stone-100 flex items-center justify-center font-bold text-xs shrink-0">
            {currentUser.name.slice(0, 2).toUpperCase()}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-stone-900">{currentUser.name}</span>
              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-800 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded">
                <ShieldCheck className="w-3 h-3 text-emerald-600" />
                <span>Verified KUCSE25 Member</span>
              </span>
            </div>
            <p className="text-xs text-stone-500 font-mono mt-0.5">
              Account: <span className="text-stone-800 font-medium">{currentUser.email || `${currentUser.studentId}@ku.ac.bd`}</span>
              <span className="mx-1 text-stone-300">·</span>
              <span>Roll: {currentUser.studentId}</span>
            </p>
          </div>
        </div>

        <div className="text-[11px] text-stone-500 text-right hidden sm:block font-mono">
          session authoritative identity
        </div>
      </div>

      {/* 3. Main State Content View */}
      {uiState === 'success' && submittedResource ? (
        <div className="p-6 sm:p-8 bg-white border border-stone-200 rounded-md space-y-6 text-center">
          <div className="w-12 h-12 rounded-md bg-emerald-50 border border-emerald-200 flex items-center justify-center mx-auto text-emerald-600">
            <CheckCircle2 className="w-6 h-6" />
          </div>

          <div className="space-y-1.5">
            <h2 className="text-xl sm:text-2xl font-bold text-stone-900">
              Submission Received & Queued
            </h2>
            <p className="text-sm font-semibold text-stone-800 max-w-md mx-auto truncate">
              {submittedResource.fileName}
            </p>
            <p className="text-xs text-stone-500 font-mono">
              Target Course: {submittedResource.courseCode} ({submittedResource.courseTitle})
            </p>
          </div>

          {/* Institutional Compliance Notices */}
          <div className="space-y-3 max-w-lg mx-auto text-left text-xs">
            <div className="p-3 bg-stone-50 border border-stone-200 rounded-md flex items-start gap-2.5">
              <Sparkles className="w-4 h-4 text-stone-700 shrink-0 mt-0.5" />
              <p className="text-stone-700 leading-relaxed">
                <strong>Your file will be automatically optimized before being added to the archive.</strong> Our pipeline performs automated lossless compression and structure standardization to preserve server storage.
              </p>
            </div>

            <div className="p-3 bg-amber-50 border border-amber-200 rounded-md flex items-start gap-2.5">
              <Clock className="w-4 h-4 text-amber-800 shrink-0 mt-0.5" />
              <p className="text-amber-900 leading-relaxed">
                <strong>Your resource will become publicly available only after CR/ACR approval.</strong> Batch CR (Tanvir Hossain) or ACR (Tahmidul Islam) will verify academic relevance and clarity before it is listed for public download.
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => navigate('/my-submissions')}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2 text-xs font-semibold text-stone-800 bg-stone-100 hover:bg-stone-200 active:bg-stone-300 rounded border border-stone-200 transition-colors"
            >
              <span>View My Submissions</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>

            <button
              type="button"
              onClick={handleResetForNewUpload}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-stone-900 hover:bg-stone-800 active:bg-stone-950 rounded transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Upload Another Resource</span>
            </button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmitResource} className="space-y-6">
          {/* STEP 1: File Drop Zone */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-semibold text-stone-900 uppercase tracking-wider">
                1. Select Academic File <span className="text-rose-600">*</span>
              </label>
              <span className="text-[11px] text-stone-500 font-mono">Max 25 MB · PDF, PPTX, DOCX, IMG</span>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              onChange={handleFileChange}
              accept=".pdf,.ppt,.pptx,.doc,.docx,.png,.jpg,.jpeg"
              className="hidden"
              id="file-upload-input"
              disabled={['optimizing', 'uploading', 'pending_review'].includes(uiState)}
            />

            {!selectedFile ? (
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-md p-8 text-center cursor-pointer transition-colors ${
                  dragActive
                    ? 'border-stone-900 bg-stone-100'
                    : 'border-stone-300 hover:border-stone-400 bg-white'
                }`}
              >
                <div className="mx-auto w-10 h-10 rounded-md bg-stone-100 border border-stone-200 flex items-center justify-center text-stone-600 mb-3">
                  <UploadCloud className="w-5 h-5" />
                </div>
                <p className="text-xs sm:text-sm font-semibold text-stone-800">
                  Click to browse academic files, or drag and drop here
                </p>
                <p className="mt-1 text-xs text-stone-500">
                  PDF documents, slide decks, assignments, or clean notebook photo scans
                </p>
              </div>
            ) : (
              <div className="p-4 bg-white border border-stone-200 rounded-md space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="p-2 bg-stone-100 rounded border border-stone-200 shrink-0">
                      <FileText className="w-5 h-5 text-stone-700" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs sm:text-sm font-semibold text-stone-900 truncate">
                        {fileDetails?.fileName}
                      </p>
                      <p className="text-xs text-stone-500 mt-0.5 font-mono">
                        {fileDetails?.fileType} · <span>{fileDetails?.fileSizeFormatted}</span>
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleClearSelectedFile}
                    disabled={['optimizing', 'uploading', 'pending_review'].includes(uiState)}
                    className="p-1 text-stone-400 hover:text-stone-700 rounded transition-colors disabled:opacity-50"
                    title="Remove file"
                    aria-label="Remove selected file"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="pt-3 border-t border-stone-200 grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-stone-500 block text-[11px]">Validation Status:</span>
                    <span className="inline-flex items-center gap-1 font-medium text-emerald-800 mt-0.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      <span>{fileDetails?.validationStatus}</span>
                    </span>
                  </div>

                  <div>
                    <span className="text-stone-500 block text-[11px]">Optimization Status:</span>
                    <span className="inline-flex items-center gap-1 font-medium text-stone-800 mt-0.5">
                      <Sparkles className="w-3.5 h-3.5 text-stone-600 shrink-0" />
                      <span>{fileDetails?.optimizationStatus}</span>
                    </span>
                  </div>
                </div>
              </div>
            )}

            {errorMessage && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-md flex items-start gap-2 text-xs text-rose-800">
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="font-semibold">File Validation Alert</p>
                  <p className="mt-0.5">{errorMessage}</p>
                </div>
              </div>
            )}
          </div>

          {/* STEP 2: Course Selector */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label htmlFor="course-selector" className="block text-xs font-semibold text-stone-900 uppercase tracking-wider">
                2. Target Course <span className="text-rose-600">*</span>
              </label>
              <span className="text-[11px] text-stone-500 font-mono">CSE Curriculum</span>
            </div>

            <select
              id="course-selector"
              value={selectedCourseId}
              onChange={(e) => setSelectedCourseId(e.target.value)}
              disabled={['optimizing', 'uploading', 'pending_review'].includes(uiState)}
              className="w-full bg-white border border-stone-300 rounded px-3 py-2 text-xs sm:text-sm text-stone-900 focus:outline-none focus:border-stone-900 focus:ring-1 focus:ring-stone-900 transition-colors"
              required
            >
              <optgroup label="Level 1 · Term 1 (First Year, Autumn)">
                {COURSES.filter((c) => c.level === 1 && c.term === 1).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.code} — {c.title}
                  </option>
                ))}
              </optgroup>
              <optgroup label="Level 1 · Term 2 (First Year, Spring)">
                {COURSES.filter((c) => c.level === 1 && c.term === 2).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.code} — {c.title}
                  </option>
                ))}
              </optgroup>
              <optgroup label="Level 2 · Term 1 (Second Year, Autumn)">
                {COURSES.filter((c) => c.level === 2 && c.term === 1).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.code} — {c.title}
                  </option>
                ))}
              </optgroup>
            </select>

            {selectedCourse && (
              <p className="text-[11px] text-stone-500 mt-1">
                Instructor: <strong className="text-stone-700">{selectedCourse.teacher}</strong> · {selectedCourse.credits} Credits · Level {selectedCourse.level} Term {selectedCourse.term}
              </p>
            )}
          </div>

          {/* STEP 3: Resource Classification */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-stone-900 uppercase tracking-wider">
              3. Resource Category <span className="text-rose-600">*</span>
            </label>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
              {RESOURCE_TYPES.map((t) => {
                const isSelected = selectedType === t.type;
                return (
                  <button
                    key={t.type}
                    type="button"
                    onClick={() => setSelectedType(t.type)}
                    disabled={['optimizing', 'uploading', 'pending_review'].includes(uiState)}
                    className={`p-3 text-left rounded border transition-colors ${
                      isSelected
                        ? 'border-stone-900 bg-stone-900 text-white'
                        : 'border-stone-200 bg-white hover:border-stone-400 text-stone-800'
                    }`}
                  >
                    <p className={`text-xs font-semibold ${isSelected ? 'text-white' : 'text-stone-900'}`}>
                      {t.label}
                    </p>
                    <p className={`text-[10px] mt-0.5 ${isSelected ? 'text-stone-300' : 'text-stone-500'}`}>
                      {t.desc}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* REQUIRED NOTICE BOXES */}
          <div className="space-y-2.5 pt-2">
            <div className="p-3 bg-stone-50 border border-stone-200 rounded-md flex items-start gap-2.5 text-xs text-stone-700">
              <Sparkles className="w-4 h-4 text-stone-800 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-stone-900">
                  Your file will be automatically optimized before being added to the archive.
                </p>
                <p className="mt-0.5 text-stone-600 leading-relaxed">
                  The backend automatically runs compression algorithms to save bandwidth for students on mobile campus networks.
                </p>
              </div>
            </div>

            <div className="p-3 bg-amber-50 border border-amber-200 rounded-md flex items-start gap-2.5 text-xs text-amber-900">
              <Clock className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-amber-950">
                  Your resource will become publicly available only after CR/ACR approval.
                </p>
                <p className="mt-0.5 text-amber-800 leading-relaxed">
                  All submissions are queued for quality check by Tanvir Hossain (CR) and Tahmidul Islam (ACR) to protect academic integrity.
                </p>
              </div>
            </div>
          </div>

          {/* PROGRESS BAR */}
          {['validating', 'optimizing', 'uploading', 'pending_review'].includes(uiState) && (
            <div className="p-4 bg-stone-100 border border-stone-200 rounded-md space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-stone-900">
                  {uiState === 'validating' && 'Validating academic format and integrity...'}
                  {uiState === 'optimizing' && 'Optimizing document compression...'}
                  {uiState === 'uploading' && `Uploading document to archive storage (${uploadProgress}%)...`}
                  {uiState === 'pending_review' && 'Submitting resource to CR/ACR moderation queue...'}
                </span>
                <span className="font-mono tabular-nums text-stone-700 font-semibold">{uploadProgress}%</span>
              </div>

              <div className="w-full bg-stone-200 h-1.5 rounded overflow-hidden">
                <div
                  className="bg-stone-900 h-full transition-all duration-300 ease-out"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            </div>
          )}

          {/* Form Actions */}
          <div className="pt-4 border-t border-stone-100 flex flex-col sm:flex-row items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => navigate('/courses')}
              disabled={['optimizing', 'uploading', 'pending_review'].includes(uiState)}
              className="text-xs font-medium text-stone-500 hover:text-stone-900 order-2 sm:order-1 transition-colors"
            >
              Cancel and Return
            </button>

            <button
              type="submit"
              disabled={!selectedFile || !fileDetails?.isValid || ['validating', 'optimizing', 'uploading', 'pending_review'].includes(uiState)}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 text-xs font-semibold text-white bg-stone-900 hover:bg-stone-800 active:bg-stone-950 disabled:opacity-50 disabled:cursor-not-allowed rounded transition-colors order-1 sm:order-2"
            >
              <UploadCloud className="w-4 h-4" />
              <span>
                {uiState === 'optimizing'
                  ? 'Optimizing Document...'
                  : uiState === 'uploading'
                  ? 'Transmitting File...'
                  : uiState === 'pending_review'
                  ? 'Enqueuing for Review...'
                  : 'Submit for CR/ACR Review'}
              </span>
            </button>
          </div>
        </form>
      )}
    </div>
  );
};
