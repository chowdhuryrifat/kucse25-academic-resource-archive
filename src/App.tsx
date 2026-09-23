import React from 'react';
import { RouterProvider, useRouter } from './context/RouterContext';
import { AuthProvider } from './context/AuthContext';
import { Navbar } from './components/Navbar';
import { Footer } from './components/Footer';

// Pages
import { HomePage } from './pages/HomePage';
import { CoursesPage } from './pages/CoursesPage';
import { CourseDetailPage } from './pages/CourseDetailPage';
import { SearchPage } from './pages/SearchPage';
import { DocumentReaderPage } from './pages/DocumentReaderPage';
import { UploadPage } from './pages/UploadPage';
import { MySubmissionsPage } from './pages/MySubmissionsPage';
import { AboutPage } from './pages/AboutPage';

// Admin Pages
import { AdminDashboardPage } from './pages/admin/AdminDashboardPage';
import { AdminPendingPage } from './pages/admin/AdminPendingPage';
import { AdminResourcesPage } from './pages/admin/AdminResourcesPage';
import { AdminReviewPage } from './pages/admin/AdminReviewPage';
import { AdminAccessGuard } from './components/AdminAccessGuard';

const AppRoutes: React.FC = () => {
  const { currentPath } = useRouter();

  // Match routes
  if (currentPath === '/') {
    return <HomePage />;
  }

  if (currentPath === '/courses') {
    return <CoursesPage />;
  }

  if (currentPath.startsWith('/courses/')) {
    const courseId = currentPath.replace('/courses/', '').split('?')[0];
    return <CourseDetailPage courseId={courseId} />;
  }

  if (currentPath.startsWith('/search')) {
    return <SearchPage />;
  }

  if (currentPath.startsWith('/read/')) {
    const resourceId = currentPath.replace('/read/', '').split('?')[0];
    return <DocumentReaderPage resourceId={resourceId} />;
  }

  if (currentPath.startsWith('/upload')) {
    return <UploadPage />;
  }

  if (currentPath.startsWith('/my-submissions')) {
    return <MySubmissionsPage />;
  }

  if (currentPath === '/admin') {
    return (
      <AdminAccessGuard>
        <AdminDashboardPage />
      </AdminAccessGuard>
    );
  }

  if (currentPath === '/admin/pending') {
    return (
      <AdminAccessGuard>
        <AdminPendingPage />
      </AdminAccessGuard>
    );
  }

  if (currentPath === '/admin/resources') {
    return (
      <AdminAccessGuard>
        <AdminResourcesPage />
      </AdminAccessGuard>
    );
  }

  if (currentPath.startsWith('/admin/resources/')) {
    const resourceId = currentPath.replace('/admin/resources/', '').split('?')[0];
    return (
      <AdminAccessGuard>
        <AdminReviewPage resourceId={resourceId} />
      </AdminAccessGuard>
    );
  }

  if (currentPath.startsWith('/about')) {
    return <AboutPage />;
  }

  // 404 fallback
  return (
    <div className="max-w-md mx-auto px-4 py-20 text-center space-y-4">
      <h1 className="text-2xl font-bold text-stone-900">404 - Page Not Found</h1>
      <p className="text-xs text-stone-500">
        The requested URL <code className="font-mono">{currentPath}</code> does not exist in the KUCSE25 archive.
      </p>
      <a
        href="/"
        className="inline-block px-4 py-2 text-xs font-semibold text-white bg-stone-900 rounded"
      >
        Return to Home
      </a>
    </div>
  );
};

export function App() {
  return (
    <AuthProvider>
      <RouterProvider>
        <div className="min-h-screen flex flex-col bg-stone-50/40 text-stone-900 selection:bg-stone-200">
          <Navbar />
          <div className="flex-1">
            <AppRoutes />
          </div>
          <Footer />
        </div>
      </RouterProvider>
    </AuthProvider>
  );
}

export default App;
