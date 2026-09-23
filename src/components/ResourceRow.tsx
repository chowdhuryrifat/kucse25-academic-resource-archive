import React, { useState } from 'react';
import { Resource } from '../types';
import { useRouter } from '../context/RouterContext';
import { ResourceService } from '../services/resourceService';
import { FileText, FileCode, Presentation, Image, Download, BookOpen, Check } from 'lucide-react';

interface ResourceRowProps {
  resource: Resource;
  onDownloadIncrement?: (newCount: number) => void;
}

export const ResourceRow: React.FC<ResourceRowProps> = ({ resource, onDownloadIncrement }) => {
  const { navigate } = useRouter();
  const [downloadCount, setDownloadCount] = useState(resource.downloadCount);
  const [downloading, setDownloading] = useState(false);
  const [downloadSuccess, setDownloadSuccess] = useState(false);

  const getFileIcon = () => {
    switch (resource.fileType) {
      case 'pptx':
        return <Presentation className="w-4 h-4 text-amber-800 shrink-0" />;
      case 'image':
        return <Image className="w-4 h-4 text-emerald-800 shrink-0" />;
      case 'docx':
        return <FileCode className="w-4 h-4 text-sky-800 shrink-0" />;
      case 'pdf':
      default:
        return <FileText className="w-4 h-4 text-stone-700 shrink-0" />;
    }
  };

  const handleRead = () => {
    navigate(`/read/${resource.id}`);
  };

  const handleDownload = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (downloading) return;
    setDownloading(true);

    try {
      const updatedCount = await ResourceService.incrementDownload(resource.id);
      setDownloadCount(updatedCount);
      if (onDownloadIncrement) {
        onDownloadIncrement(updatedCount);
      }

      const blob = new Blob([
        `KUCSE25 Academic Resource Archive\nFile: ${resource.fileName}\nCourse: ${resource.courseId}\nUploader: ${resource.uploaderName}\n\n[Academic Content for Khulna University CSE Batch 25]`
      ], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = resource.fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setDownloadSuccess(true);
      setTimeout(() => setDownloadSuccess(false), 2000);
    } catch (err) {
      console.error('Download error:', err);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <article
      className="group flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-white border border-stone-200 rounded-md hover:border-stone-400 transition-colors gap-3"
      aria-label={`Academic resource: ${resource.fileName}`}
    >
      {/* 1. Filename & 2. Uploader Name */}
      <div className="flex items-start sm:items-center gap-3 min-w-0 flex-1">
        <div className="p-1.5 bg-stone-100 rounded border border-stone-200 shrink-0 mt-0.5 sm:mt-0" aria-hidden="true">
          {getFileIcon()}
        </div>
        <div className="min-w-0 flex-1">
          <h3
            onClick={handleRead}
            className="text-sm font-semibold text-stone-900 tracking-tight hover:text-stone-700 cursor-pointer transition-colors truncate"
            title={resource.fileName}
          >
            {resource.fileName}
          </h3>
          <p className="text-xs text-stone-500 mt-0.5">
            Uploaded by: <span className="text-stone-800 font-medium">{resource.uploaderName}</span>
          </p>
        </div>
      </div>

      {/* Right side: 3. Download Count, 4. Read button, 5. Download button */}
      <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-stone-100">
        {/* 3. Download Count */}
        <div className="text-xs text-stone-500 tabular-nums">
          Downloads: <span className="font-semibold text-stone-900">{downloadCount}</span>
        </div>

        {/* 4. Read & 5. Download Buttons */}
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={handleRead}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-stone-700 bg-stone-100 hover:bg-stone-200 active:bg-stone-300 rounded border border-stone-200 transition-colors focus-visible:outline-2 focus-visible:outline-stone-900"
            aria-label={`Read ${resource.fileName} in browser`}
          >
            <BookOpen className="w-3.5 h-3.5 text-stone-600" aria-hidden="true" />
            <span>Read</span>
          </button>

          <button
            type="button"
            onClick={handleDownload}
            disabled={downloading}
            className={`inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded border transition-colors focus-visible:outline-2 focus-visible:outline-stone-900 ${
              downloadSuccess
                ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                : 'bg-stone-900 text-white border-stone-900 hover:bg-stone-800 active:bg-stone-950'
            }`}
            aria-label={`Download ${resource.fileName}`}
          >
            {downloadSuccess ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-700" aria-hidden="true" />
                <span>Downloaded</span>
              </>
            ) : (
              <>
                <Download className="w-3.5 h-3.5 text-stone-300" aria-hidden="true" />
                <span>{downloading ? 'Downloading...' : 'Download'}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </article>
  );
};
