import React, { useState } from 'react';
import { useRouter } from '../context/RouterContext';
import { useAuth } from '../context/AuthContext';
import { Menu, X, Shield, UserCheck, LogOut, ArrowRight, User } from 'lucide-react';
import { StudentAuthModal } from './StudentAuthModal';

export const Navbar: React.FC = () => {
  const { currentPath, navigate } = useRouter();
  const { currentUser, isLoggedIn, logout, setRole, loginAsCR, loginAsACR, isSupabaseConfigured } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [roleSwitcherOpen, setRoleSwitcherOpen] = useState(false);

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

  const showMySubmissions = isLoggedIn && (currentUser.role === 'student' || currentUser.role === 'admin');
  const showAdmin = currentUser.role === 'admin';

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
                  <span>Admin</span>
                </button>
              )}
            </nav>

            {/* Zone 3: Actions & Role Switcher */}
            <div className="flex items-center gap-3">
              {/* Dev Mode Role selector dropdown (only when Supabase keys not set) */}
              {!isSupabaseConfigured && (
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setRoleSwitcherOpen(!roleSwitcherOpen)}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-stone-700 bg-stone-100 hover:bg-stone-200 rounded border border-stone-200 transition-colors"
                    title="Switch preview identity (Dev Mode)"
                    aria-expanded={roleSwitcherOpen}
                  >
                    {currentUser.role === 'admin' ? (
                      <Shield className="w-3.5 h-3.5 text-stone-800" />
                    ) : currentUser.role === 'student' ? (
                      <UserCheck className="w-3.5 h-3.5 text-stone-800" />
                    ) : (
                      <User className="w-3.5 h-3.5 text-stone-500" />
                    )}
                    <span className="hidden sm:inline text-stone-500">Dev Role:</span>
                    <span className="font-semibold text-stone-900">
                      {currentUser.role === 'admin'
                        ? currentUser.studentId === '250212'
                          ? 'ACR'
                          : 'CR'
                        : currentUser.role === 'student'
                        ? 'Student'
                        : 'Visitor'}
                    </span>
                  </button>

                {roleSwitcherOpen && (
                  <div className="absolute right-0 mt-1.5 w-64 p-1.5 bg-white rounded-md shadow-md border border-stone-200 z-50">
                    <div className="px-2 py-1 text-[11px] font-semibold text-stone-400 uppercase tracking-wider">
                      Switch Role Mode
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setRole('public');
                        setRoleSwitcherOpen(false);
                      }}
                      className={`w-full text-left px-2.5 py-2 text-xs rounded transition-colors ${
                        currentUser.role === 'public'
                          ? 'bg-stone-100 font-semibold text-stone-900'
                          : 'text-stone-700 hover:bg-stone-50'
                      }`}
                    >
                      <p className="font-medium">Public Visitor</p>
                      <p className="text-[11px] text-stone-500">Browse, search, and read without verification</p>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setRole('student');
                        setRoleSwitcherOpen(false);
                      }}
                      className={`w-full text-left px-2.5 py-2 text-xs rounded transition-colors mt-0.5 ${
                        currentUser.role === 'student'
                          ? 'bg-stone-100 font-semibold text-stone-900'
                          : 'text-stone-700 hover:bg-stone-50'
                      }`}
                    >
                      <p className="font-medium">KUCSE25 Student</p>
                      <p className="text-[11px] text-stone-500">Rifat Ahmed (250233) · Can submit & track</p>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        loginAsCR();
                        setRoleSwitcherOpen(false);
                      }}
                      className={`w-full text-left px-2.5 py-2 text-xs rounded transition-colors mt-0.5 ${
                        currentUser.role === 'admin' && currentUser.studentId === '250205'
                          ? 'bg-stone-100 font-semibold text-stone-900'
                          : 'text-stone-700 hover:bg-stone-50'
                      }`}
                    >
                      <div className="flex items-center gap-1.5 font-medium">
                        <span>Tanvir Hossain</span>
                        <span className="text-[10px] font-mono px-1 py-0.2 bg-amber-100 text-amber-900 rounded font-bold">
                          CR
                        </span>
                      </div>
                      <p className="text-[11px] text-stone-500">Class Representative (250205)</p>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        loginAsACR();
                        setRoleSwitcherOpen(false);
                      }}
                      className={`w-full text-left px-2.5 py-2 text-xs rounded transition-colors mt-0.5 ${
                        currentUser.role === 'admin' && currentUser.studentId === '250212'
                          ? 'bg-stone-100 font-semibold text-stone-900'
                          : 'text-stone-700 hover:bg-stone-50'
                      }`}
                    >
                      <div className="flex items-center gap-1.5 font-medium">
                        <span>Tahmidul Islam</span>
                        <span className="text-[10px] font-mono px-1 py-0.2 bg-blue-100 text-blue-900 rounded font-bold">
                          ACR
                        </span>
                      </div>
                      <p className="text-[11px] text-stone-500">Asst. Class Representative (250212)</p>
                    </button>

                    <div className="my-1 border-t border-stone-100" />
                    <button
                      type="button"
                      onClick={() => {
                        setRoleSwitcherOpen(false);
                        setAuthModalOpen(true);
                      }}
                      className="w-full text-left px-2.5 py-1.5 text-xs text-stone-600 hover:text-stone-900 hover:bg-stone-50 rounded font-medium flex items-center justify-between transition-colors"
                    >
                      <span>Verify student email</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>
              )}

              {/* Login / Identity button */}
              {isLoggedIn ? (
                <div className="hidden sm:flex items-center gap-2">
                  <div className="text-right">
                    <p className="text-xs font-semibold text-stone-900 leading-tight truncate max-w-[130px]">
                      {currentUser.name}
                    </p>
                    <p className="text-[11px] text-stone-500 font-mono">
                      {currentUser.studentId ? `Roll ${currentUser.studentId}` : currentUser.title}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={logout}
                    className="p-1.5 text-stone-400 hover:text-stone-700 rounded transition-colors"
                    title="Log out"
                    aria-label="Log out"
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
                  Student Verify
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
                Admin Dashboard
              </button>
            )}

            <div className="pt-2 border-t border-stone-100 flex items-center justify-between text-xs text-stone-500 px-3">
              <span>Role: {currentUser.role}</span>
              {isLoggedIn && (
                <button
                  type="button"
                  onClick={() => {
                    logout();
                    setMobileMenuOpen(false);
                  }}
                  className="text-stone-800 font-medium hover:underline"
                >
                  Sign Out
                </button>
              )}
            </div>
          </div>
        )}
      </header>

      {/* Student Email Verification Modal */}
      {authModalOpen && (
        <StudentAuthModal isOpen={authModalOpen} onClose={() => setAuthModalOpen(false)} />
      )}
    </>
  );
};
