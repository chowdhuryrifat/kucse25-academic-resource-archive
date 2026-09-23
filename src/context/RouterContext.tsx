import React, { createContext, useContext, useEffect, useState } from 'react';

export interface RouteState {
  path: string;
  params: Record<string, string>;
  searchParams: URLSearchParams;
}

interface RouterContextType {
  currentPath: string;
  params: Record<string, string>;
  searchParams: URLSearchParams;
  navigate: (to: string) => void;
}

const RouterContext = createContext<RouterContextType | undefined>(undefined);

export const RouterProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentPath, setCurrentPath] = useState<string>(() => {
    if (typeof window === 'undefined') return '/';
    return window.location.pathname || '/';
  });

  const [searchString, setSearchString] = useState<string>(() => {
    if (typeof window === 'undefined') return '';
    return window.location.search || '';
  });

  useEffect(() => {
    const handleLocationChange = () => {
      setCurrentPath(window.location.pathname || '/');
      setSearchString(window.location.search || '');
    };

    window.addEventListener('popstate', handleLocationChange);
    return () => window.removeEventListener('popstate', handleLocationChange);
  }, []);

  const navigate = (to: string) => {
    const [pathPart, queryPart] = to.split('?');
    const normalizedPath = pathPart || '/';
    const query = queryPart ? `?${queryPart}` : '';

    if (window.location.pathname !== normalizedPath || window.location.search !== query) {
      window.history.pushState({}, '', `${normalizedPath}${query}`);
      setCurrentPath(normalizedPath);
      setSearchString(query);
      window.scrollTo(0, 0);
    }
  };

  // Route matching & dynamic params extraction
  const extractParams = (path: string): Record<string, string> => {
    const params: Record<string, string> = {};

    // Pattern: /courses/:courseId
    const courseMatch = path.match(/^\/courses\/([^/]+)$/);
    if (courseMatch) {
      params.courseId = courseMatch[1];
    }

    // Pattern: /read/:resourceId
    const readMatch = path.match(/^\/read\/([^/]+)$/);
    if (readMatch) {
      params.resourceId = readMatch[1];
    }

    // Pattern: /admin/resources/:resourceId
    const adminResourceMatch = path.match(/^\/admin\/resources\/([^/]+)$/);
    if (adminResourceMatch) {
      params.resourceId = adminResourceMatch[1];
    }

    return params;
  };

  const params = extractParams(currentPath);
  const searchParams = new URLSearchParams(searchString);

  return (
    <RouterContext.Provider value={{ currentPath, params, searchParams, navigate }}>
      {children}
    </RouterContext.Provider>
  );
};

export function useRouter() {
  const context = useContext(RouterContext);
  if (!context) {
    throw new Error('useRouter must be used within a RouterProvider');
  }
  return context;
}
