import React, { useRef, useState } from 'react';
import { UploadCloud, FileText, CheckCircle2, AlertTriangle, X } from 'lucide-react';

interface FileUploadProps {
  onFileSelect: (file: File | null) => void;
  selectedFile: File | null;
  error?: string;
}

const ALLOWED_EXTENSIONS = ['.pdf', '.ppt', '.pptx', '.doc', '.docx', '.png', '.jpg', '.jpeg'];
const MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024; // 25 MB

export const FileUpload: React.FC<FileUploadProps> = ({ onFileSelect, selectedFile, error }) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  const validateAndSetFile = (file: File) => {
    setValidationError(null);

    const ext = '.' + file.name.split('.').pop()?.toLowerCase();
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      setValidationError(
        `Unsupported file format (${ext}). Please upload PDF, PPT/PPTX, DOC/DOCX, or PNG/JPG.`
      );
      onFileSelect(null);
      return;
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      setValidationError(
        `File is too large (${formatFileSize(file.size)}). Max allowed upload limit is 25 MB.`
      );
      onFileSelect(null);
      return;
    }

    onFileSelect(file);
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      validateAndSetFile(e.dataTransfer.files[0]);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      validateAndSetFile(e.target.files[0]);
    }
  };

  const activeError = error || validationError;

  return (
    <div className="space-y-3">
      <input
        ref={inputRef}
        type="file"
        onChange={handleChange}
        accept=".pdf,.ppt,.pptx,.doc,.docx,.png,.jpg,.jpeg"
        className="hidden"
        id="academic-file-input"
      />

      {!selectedFile ? (
        <div
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
          onClick={() => inputRef.current?.click()}
          className={`flex flex-col items-center justify-center p-8 border border-dashed rounded-md cursor-pointer transition-colors text-center ${
            dragActive
              ? 'border-stone-900 bg-stone-100'
              : 'border-stone-300 hover:border-stone-400 bg-stone-50'
          }`}
          role="button"
          tabIndex={0}
          aria-label="Upload academic resource file"
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              inputRef.current?.click();
            }
          }}
        >
          <div className="w-10 h-10 bg-white border border-stone-200 rounded-md flex items-center justify-center text-stone-600 mb-3">
            <UploadCloud className="w-5 h-5" />
          </div>
          <p className="text-sm font-semibold text-stone-900">
            Click to upload or drag and drop document
          </p>
          <p className="mt-1 text-xs text-stone-500 font-mono">
            PDF, PPTX, DOCX, PNG, JPG (Up to 25 MB)
          </p>
        </div>
      ) : (
        <div className="flex items-center justify-between p-4 bg-stone-50 border border-stone-200 rounded-md">
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-2 bg-white border border-stone-200 rounded text-stone-700 shrink-0">
              <FileText className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-stone-900 truncate">
                {selectedFile.name}
              </p>
              <div className="flex items-center gap-2 text-xs text-stone-500">
                <span className="tabular-nums font-mono">{formatFileSize(selectedFile.size)}</span>
                <span>·</span>
                <span className="inline-flex items-center gap-1 text-emerald-700 font-medium">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Ready for upload
                </span>
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              onFileSelect(null);
              if (inputRef.current) inputRef.current.value = '';
            }}
            className="p-1.5 text-stone-400 hover:text-stone-700 rounded transition-colors ml-3"
            aria-label="Remove selected file"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Validation Error Feedback */}
      {activeError && (
        <div className="flex items-start gap-2 p-2.5 text-xs text-rose-800 bg-rose-50 border border-rose-200 rounded">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
          <span>{activeError}</span>
        </div>
      )}

      {/* Storage optimization informational notice */}
      <div className="p-3 bg-stone-50 border border-stone-200 rounded text-xs text-stone-600 flex items-start gap-2">
        <span className="font-semibold text-stone-900 shrink-0">Archive Notice:</span>
        <span>Your file will be automatically optimized before being added to the archive.</span>
      </div>
    </div>
  );
};
