import React, { useState, useRef, useEffect } from 'react';
import { Resource } from '../types';
import { useRouter } from '../context/RouterContext';
import { COURSES } from '../data/courses';
import {
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  Maximize,
  Minimize,
  Download,
  ArrowLeft,
} from 'lucide-react';
import { ResourceService } from '../services/resourceService';

interface DocumentViewerProps {
  resource: Resource;
}

export const DocumentViewer: React.FC<DocumentViewerProps> = ({ resource }) => {
  const { navigate } = useRouter();
  const [currentPage, setCurrentPage] = useState(1);
  const [zoomLevel, setZoomLevel] = useState(100);
  const [fitToWidth, setFitToWidth] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [downloadSuccess, setDownloadSuccess] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const course = COURSES.find((c) => c.id === resource.courseId);
  const totalPages = resource.pageCount || (resource.pages ? resource.pages.length : 1);

  // Active page content
  const activePageData =
    resource.pages && resource.pages[currentPage - 1]
      ? resource.pages[currentPage - 1]
      : {
          pageNumber: currentPage,
          title: `Section ${currentPage}: ${resource.fileName.replace(/\.[^/.]+$/, '').replace(/_/g, ' ')}`,
          content: `Content for page ${currentPage} of ${resource.fileName}.\n\nKhulna University CSE Batch 25 Academic Archive.\nCourse: ${course ? course.code + ' - ' + course.title : resource.courseId}.\n\n[Full vector text and diagrams rendered in reading mode]`,
        };

  const handlePrevPage = () => {
    setCurrentPage((prev) => Math.max(1, prev - 1));
  };

  const handleNextPage = () => {
    setCurrentPage((prev) => Math.min(totalPages, prev + 1));
  };

  const handleZoomIn = () => {
    setFitToWidth(false);
    setZoomLevel((prev) => Math.min(180, prev + 15));
  };

  const handleZoomOut = () => {
    setFitToWidth(false);
    setZoomLevel((prev) => Math.max(60, prev - 15));
  };

  const handleResetZoom = () => {
    setFitToWidth(false);
    setZoomLevel(100);
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen?.();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen?.();
      setIsFullscreen(false);
    }
  };

  useEffect(() => {
    const handleFsChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFsChange);
    return () => document.removeEventListener('fullscreenchange', handleFsChange);
  }, []);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === 'PageDown') {
        handleNextPage();
      } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
        handlePrevPage();
      } else if (e.key === 'Escape' && !document.fullscreenElement) {
        navigate(-1 as any);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [totalPages]);

  const handleDownload = async () => {
    await ResourceService.incrementDownload(resource.id);
    const blob = new Blob([
      `KUCSE25 Archive: ${resource.fileName}\nCourse: ${course?.code || resource.courseId}\nUploader: ${resource.uploaderName}\nPage ${currentPage} of ${totalPages}\n\n${activePageData.content}`
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
  };

  return (
    <div
      ref={containerRef}
      className={`flex flex-col bg-stone-900 text-stone-100 ${
        isFullscreen ? 'fixed inset-0 z-50 h-screen w-screen' : 'min-h-[82vh] rounded-md border border-stone-800 overflow-hidden'
      }`}
    >
      {/* Top Reader Toolbar */}
      <header className="flex flex-wrap items-center justify-between px-4 py-2.5 bg-stone-950 border-b border-stone-800 text-stone-300 gap-2 shrink-0">
        {/* Left: Back & Document metadata */}
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={() => {
              if (course) {
                navigate(`/courses/${course.id}`);
              } else {
                navigate('/courses');
              }
            }}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-stone-300 hover:text-white hover:bg-stone-800 rounded transition-colors"
            title="Return to Course Resources"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Back</span>
          </button>

          <div className="h-4 w-px bg-stone-800 hidden sm:block" />

          <div className="min-w-0">
            <h1 className="text-xs sm:text-sm font-semibold text-stone-100 truncate max-w-xs sm:max-w-md">
              {resource.fileName}
            </h1>
            <p className="text-[11px] text-stone-400 font-mono truncate hidden sm:block">
              {course ? `${course.code}: ${course.title}` : resource.courseId}
            </p>
          </div>
        </div>

        {/* Center: Page Controls */}
        <div className="flex items-center gap-1.5 bg-stone-900 px-2 py-1 rounded border border-stone-800 text-xs">
          <button
            type="button"
            onClick={handlePrevPage}
            disabled={currentPage <= 1}
            className="p-1 text-stone-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed rounded"
            title="Previous Page (Left Arrow)"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          <span className="px-1.5 font-mono text-[11px] tabular-nums text-stone-200">
            Page {currentPage} of {totalPages}
          </span>

          <button
            type="button"
            onClick={handleNextPage}
            disabled={currentPage >= totalPages}
            className="p-1 text-stone-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed rounded"
            title="Next Page (Right Arrow)"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* Right: Zoom & View Controls */}
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={handleZoomOut}
            className="p-1.5 text-stone-400 hover:text-white hover:bg-stone-800 rounded transition-colors"
            title="Zoom Out"
          >
            <ZoomOut className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={handleResetZoom}
            className="px-1.5 py-0.5 text-[11px] font-mono text-stone-400 hover:text-stone-200"
            title="Reset Zoom"
          >
            {fitToWidth ? 'Fit' : `${zoomLevel}%`}
          </button>

          <button
            type="button"
            onClick={handleZoomIn}
            className="p-1.5 text-stone-400 hover:text-white hover:bg-stone-800 rounded transition-colors"
            title="Zoom In"
          >
            <ZoomIn className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={() => setFitToWidth(!fitToWidth)}
            className={`hidden sm:inline-flex px-2 py-1 text-xs rounded transition-colors ${
              fitToWidth
                ? 'bg-stone-800 text-white font-medium'
                : 'text-stone-400 hover:text-white hover:bg-stone-800/80'
            }`}
            title="Fit Document to Width"
          >
            Fit Width
          </button>

          <button
            type="button"
            onClick={toggleFullscreen}
            className="p-1.5 text-stone-400 hover:text-white hover:bg-stone-800 rounded transition-colors"
            title="Toggle Fullscreen"
          >
            {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
          </button>

          <div className="h-4 w-px bg-stone-800 mx-1" />

          {/* Download inside reader */}
          <button
            type="button"
            onClick={handleDownload}
            className={`inline-flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded transition-colors ${
              downloadSuccess
                ? 'bg-emerald-700 text-white'
                : 'bg-stone-100 text-stone-900 hover:bg-white'
            }`}
            title="Download full file"
          >
            <Download className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{downloadSuccess ? 'Saved' : 'Download'}</span>
          </button>
        </div>
      </header>

      {/* Center Reading Document Canvas */}
      <div className="flex-1 overflow-auto p-4 sm:p-8 flex items-center justify-center bg-stone-950">
        <div
          style={{
            transform: fitToWidth ? 'none' : `scale(${zoomLevel / 100})`,
            transformOrigin: 'top center',
            transition: 'transform 0.15s ease-out',
            width: fitToWidth ? '100%' : '760px',
            maxWidth: fitToWidth ? '1000px' : '92vw',
          }}
          className="bg-white text-stone-900 rounded-md shadow-md border border-stone-200 min-h-[720px] p-8 sm:p-12 flex flex-col justify-between"
        >
          {/* Page Document Header */}
          <div>
            <div className="pb-4 mb-6 border-b border-stone-200 flex items-center justify-between text-xs text-stone-500 font-mono">
              <span className="uppercase tracking-wider">
                Khulna University · CSE Batch 25 Archive
              </span>
              <span>
                Page {currentPage} of {totalPages}
              </span>
            </div>

            {/* Document Page Title */}
            <h2 className="text-xl sm:text-2xl font-bold text-stone-950 tracking-tight leading-snug">
              {activePageData.title}
            </h2>

            {/* Subsections if available */}
            {activePageData.subsections && (
              <div className="mt-3 flex flex-wrap gap-2 text-xs text-stone-600">
                {activePageData.subsections.map((sub, idx) => (
                  <span
                    key={idx}
                    className="bg-stone-100 text-stone-700 px-2 py-0.5 rounded font-mono text-[11px] border border-stone-200"
                  >
                    § {sub}
                  </span>
                ))}
              </div>
            )}

            {/* Document Content */}
            <div className="mt-6 font-sans text-sm text-stone-800 leading-relaxed whitespace-pre-line space-y-4">
              {activePageData.content}
            </div>
          </div>

          {/* Page Document Footer */}
          <div className="mt-12 pt-4 border-t border-stone-100 flex items-center justify-between text-xs text-stone-400 font-mono">
            <span>{resource.fileName}</span>
            <span>Verified KUCSE25 Resource</span>
          </div>
        </div>
      </div>

      {/* Bottom Sticky Page Quick Jumper for Mobile/Tablet */}
      <footer className="px-4 py-2 bg-stone-950 border-t border-stone-800 flex items-center justify-between text-xs text-stone-400 sm:hidden">
        <button
          type="button"
          onClick={handlePrevPage}
          disabled={currentPage <= 1}
          className="px-3 py-1 bg-stone-900 rounded text-stone-200 disabled:opacity-30"
        >
          Previous
        </button>
        <span className="font-mono tabular-nums">
          {currentPage} / {totalPages}
        </span>
        <button
          type="button"
          onClick={handleNextPage}
          disabled={currentPage >= totalPages}
          className="px-3 py-1 bg-stone-900 rounded text-stone-200 disabled:opacity-30"
        >
          Next
        </button>
      </footer>
    </div>
  );
};
