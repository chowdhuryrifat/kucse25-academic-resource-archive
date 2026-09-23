import React from 'react';
import { Resource } from '../types';
import { ResourceCard } from './ResourceCard';
import { EmptyState } from './EmptyState';

interface ResourceListProps {
  resources: Resource[];
  emptyMessage?: string;
  emptySubtext?: string;
  onClearFilters?: () => void;
  onDownloadIncrement?: (resourceId: string, newCount: number) => void;
}

export const ResourceList: React.FC<ResourceListProps> = ({
  resources,
  emptyMessage = 'No resources found',
  emptySubtext = 'Try refining your search terms or clearing selected filters.',
  onClearFilters,
}) => {
  if (resources.length === 0) {
    return (
      <EmptyState
        title={emptyMessage}
        description={emptySubtext}
        actionLabel={onClearFilters ? 'Reset Filters' : undefined}
        onAction={onClearFilters}
      />
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {resources.map((resource) => (
        <ResourceCard key={resource.id} resource={resource} />
      ))}
    </div>
  );
};
