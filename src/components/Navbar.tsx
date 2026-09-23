import React, { useState } from 'react';
import { useRouter } from '../context/RouterContext';
import { useAuth } from '../context/AuthContext';
import { isUserAdmin } from '../types';
import { Menu, X, Shield, LogOut } from 'lucide-react';
import { StudentAuthModal } from './StudentAuthModal';

export const Navbar: React.FC = () => {
  const { currentPath, navigate } = useRouter();
  const { currentUser, isLoggedIn, logout, isSupabaseConfigured } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [authModalOpen, setAuthModalOpen] = useState(false);

  const isActive = (path: string) => {
    if (path === '/') return currentPath === '/';
    return currentPath.startsWith(path);
  };

  const navLinks = [
    { label: 'Courses', path: '/courses' },
    { label: 'Search', path: '/search' },
    { label: 'Upload', path: '/upload' },
    { label: 'About', path: '/about' },
  ];

  const isAdmin = isUserAdmin(currentUser);
  const showMySubmissions = isLoggedIn && (currentUser.role === 'student' || isAdmin);
  const showAdmin = isAdmin;

  return (
    <>
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-xs border-b border-stone-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Zone 1: Brand Wordmark */}
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => navigate('/')}
                className="text-lg font-bold tracking-tight text-stone-900 hover:text-stone-700 transition-colors focus-visible:outline-2 focus-visible:outline-stone-900"
              >
                KUCSE25
              </button>
              <span className="hidden sm:inline-block text-xs font-mono text-stone-400 pl-2 border-l border-stone-200">
                Academic Archive
              </span>
            </div>

            {/* Zone 2: Navigation Links */}
            <nav className="hidden md:flex items-center gap-6 text-xs sm:text-sm font-medium text-stone-600">
              {navLinks.map((link) => (
                <button
                  key={link.path}
                  type="button"
                  onClick={() => navigate(link.path)}
                  className={`hover:text-stone-900 transition-colors py-1 ${
                    isActive(link.path)
                      ? 'text-stone-950 font-semibold border-b-2 border-stone-900 -mb-0.5'
                      : ''
                  }`}
                >
                  {link.label}
                </button>
              ))}

              {showMySubmissions && (
                <button
                  type="button"
                  onClick={() => navigate('/my-submissions')}
                  className={`hover:text-stone-900 transition-colors py-1 ${
                    isActive('/my-submissions')
                      ? 'text-stone-950 font-semibold border-b-2 border-stone-900 -mb-0.5'
                      : ''
                  }`}
                >
                  My Submissions
                </button>
              )}

              {showAdmin && (
                <button
                  type="button"
                  onClick={() => navigate('/admin')}
                  className={`hover:text-stone-900 transition-colors py-1 inline-flex items-center gap-1.5 ${
                    isActive('/admin')
                      ? 'text-stone-950 font-semibold border-b-2 border-stone-900 -mb-0.5'
                      : ''
                  }`}
                >
                  <Shield className="w-3.5 h-3.5 text-stone-700" />
                  <span>Admin ({currentUser.role === 'cr' ? 'CR' : currentUser.role === 'acr' ? 'ACR' : 'Moderator'})</span>
                </button>
              )}
            </nav>

            {/* Zone 3: Actions & Auth State */}
            <div className="flex items-center gap-3">
              {!isSupabaseConfigured && (
                <span
                  title="Supabase credentials not configured in environment"
                  className="hidden xl:inline-flex items-center text-[10px] font-mono text-amber-800 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded"
                >
                  Supabase Config Required
                </span>
              )}

              {/* Login / Identity button */}
              {isLoggedIn ? (
                <div className="hidden sm:flex items-center gap-2.5 pl-2 border-l border-stone-200">
                  <div className="text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <p className="text-xs font-semibold text-stone-900 leading-tight truncate max-w-[140px]">
                        {currentUser.name}
                      </p>
                      {currentUser.role === 'cr' ? (
                        <span className="text-[10px] font-mono font-bold px-1.5 py-0.2 bg-amber-100 text-amber-900 border border-amber-200 rounded">
                          CR
                        </span>
                      ) : currentUser.role === 'acr' ? (
                        <span className="text-[10px] font-mono font-bold px-1.5 py-0.2 bg-blue-100 text-blue-900 border border-blue-200 rounded">
                          ACR
                        </span>
                      ) : null}
                    </div>
                    <p className="text-[11px] text-stone-500 font-mono">
                      {currentUser.studentId ? `Roll ${currentUser.studentId}` : currentUser.title}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={logout}
                    className="p-1.5 text-stone-400 hover:text-stone-700 rounded transition-colors"
                    title="Sign Out"
                    aria-label="Sign Out"
                  >
                    <LogOut className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setAuthModalOpen(true)}
                  className="px-3.5 py-1.5 text-xs font-semibold text-white bg-stone-900 hover:bg-stone-800 active:bg-stone-950 rounded transition-colors whitespace-nowrap"
                >
                  Student Sign In
                </button>
              )}

              {/* Mobile menu button */}
              <button
                type="button"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="md:hidden p-2 text-stone-600 hover:text-stone-900 rounded transition-colors"
                aria-label="Toggle navigation menu"
                aria-expanded={mobileMenuOpen}
              >
                {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile menu dropdown */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-stone-200 bg-white px-4 pt-2 pb-4 space-y-1">
            {navLinks.map((link) => (
              <button
                key={link.path}
                type="button"
                onClick={() => {
                  navigate(link.path);
                  setMobileMenuOpen(false);
                }}
                className={`block w-full text-left px-3 py-2 text-xs font-medium rounded transition-colors ${
                  isActive(link.path)
                    ? 'bg-stone-100 text-stone-900 font-semibold'
                    : 'text-stone-600 hover:bg-stone-50'
                }`}
              >
                {link.label}
              </button>
            ))}

            {showMySubmissions && (
              <button
                type="button"
                onClick={() => {
                  navigate('/my-submissions');
                  setMobileMenuOpen(false);
                }}
                className={`block w-full text-left px-3 py-2 text-xs font-medium rounded transition-colors ${
                  isActive('/my-submissions')
                    ? 'bg-stone-100 text-stone-900 font-semibold'
                    : 'text-stone-600 hover:bg-stone-50'
                }`}
              >
                My Submissions
              </button>
            )}

            {showAdmin && (
              <button
                type="button"
                onClick={() => {
                  navigate('/admin');
                  setMobileMenuOpen(false);
                }}
                className={`block w-full text-left px-3 py-2 text-xs font-medium rounded transition-colors ${
                  isActive('/admin')
                    ? 'bg-stone-100 text-stone-900 font-semibold'
                    : 'text-stone-600 hover:bg-stone-50'
                }`}
              >
                Admin Moderation
              </button>
            )}

            <div className="pt-2 border-t border-stone-100 mt-2">
              {isLoggedIn ? (
                <div className="flex items-center justify-between px-3 py-2 bg-stone-50 rounded">
                  <div>
                    <p className="text-xs font-semibold text-stone-900">{currentUser.name}</p>
                    <p className="text-[11px] text-stone-500 font-mono">
                      Roll {currentUser.studentId} · {currentUser.role.toUpperCase()}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      logout();
                      setMobileMenuOpen(false);
                    }}
                    className="p-1.5 text-stone-400 hover:text-stone-700"
                    title="Sign Out"
                  >
                    <LogOut className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setAuthModalOpen(true);
                    setMobileMenuOpen(false);
                  }}
                  className="w-full text-center px-3 py-2 text-xs font-semibold text-white bg-stone-900 rounded"
                >
                  Student Sign In
                </button>
              )}
            </div>
          </div>
        )}
      </header>

      <StudentAuthModal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
      />
    </>
  );
};
