import React from 'react';
import { ResourceStatus } from '../types';
import { Clock, CheckCircle, XCircle, Archive } from 'lucide-react';

interface FileStatusBadgeProps {
  status: ResourceStatus;
}

export const FileStatusBadge: React.FC<FileStatusBadgeProps> = ({ status }) => {
  switch (status) {
    case 'approved':
      return (
        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
          <CheckCircle className="w-3 h-3 text-emerald-600" aria-hidden="true" />
          <span>Approved</span>
        </span>
      );
    case 'pending':
      return (
        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-800 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
          <Clock className="w-3 h-3 text-amber-600" aria-hidden="true" />
          <span>Pending Review</span>
        </span>
      );
    case 'rejected':
      return (
        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-rose-800 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
          <XCircle className="w-3 h-3 text-rose-600" aria-hidden="true" />
          <span>Rejected</span>
        </span>
      );
    case 'archived':
      return (
        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-stone-600 bg-stone-100 px-2 py-0.5 rounded border border-stone-200">
          <Archive className="w-3 h-3 text-stone-500" aria-hidden="true" />
          <span>Archived</span>
        </span>
      );
  }
};
