import React, { useState, useEffect } from 'react';
import { useRouter } from '../context/RouterContext';
import { ResourceService } from '../services/resourceService';
import { Resource } from '../types';
import { DocumentViewer } from '../components/DocumentViewer';
import { ArrowLeft } from 'lucide-react';

interface DocumentReaderPageProps {
  resourceId: string;
}

export const DocumentReaderPage: React.FC<DocumentReaderPageProps> = ({ resourceId }) => {
  const { navigate } = useRouter();
  const [resource, setResource] = useState<Resource | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      ResourceService.getResourceById(resourceId),
      ResourceService.getReadUrl(resourceId),
    ])
      .then(([res, readUrl]) => {
        if (res) {
          setResource({
            ...res,
            readUrl: readUrl || undefined,
          });
        } else {
          setResource(null);
        }
      })
      .finally(() => {
        setLoading(false);
      });
  }, [resourceId]);

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-16 flex items-center justify-center">
        <div className="text-center space-y-2">
          <div className="w-8 h-8 border-2 border-stone-800 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs text-stone-500 font-mono">Loading document reader...</p>
        </div>
      </div>
    );
  }

  if (!resource) {
    return (
      <div className="max-w-md mx-auto px-4 py-20 text-center space-y-4">
        <h1 className="text-lg font-bold text-stone-900">Resource Not Found</h1>
        <p className="text-xs text-stone-500">
          The requested document could not be found or has not yet been approved for public reading.
        </p>
        <button
          type="button"
          onClick={() => navigate('/courses')}
          className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-stone-800 bg-stone-100 hover:bg-stone-200 rounded"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Return to Courses</span>
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      <DocumentViewer resource={resource} />
    </div>
  );
};
