import React, { useState } from 'react';
import { useRouter } from '../context/RouterContext';
import { useAuth } from '../context/AuthContext';
import { isUserAdmin } from '../types';
import { ShieldAlert, ArrowLeft, Mail, LogOut, ShieldX } from 'lucide-react';
import { StudentAuthModal } from './StudentAuthModal';

interface AdminAccessGuardProps {
  children: React.ReactNode;
}

export const AdminAccessGuard: React.FC<AdminAccessGuardProps> = ({ children }) => {
  const { navigate } = useRouter();
  const { currentUser, isLoggedIn, logout, isSupabaseConfigured } = useAuth();
  const [authModalOpen, setAuthModalOpen] = useState(false);

  // Authorized: Class Representative (CR) or Assistant Class Representative (ACR)
  if (isUserAdmin(currentUser)) {
    return <>{children}</>;
  }

  // Case 1: Logged in, but regular student (not CR or ACR)
  if (isLoggedIn) {
    return (
      <div className="max-w-xl mx-auto px-4 py-16 text-center space-y-6">
        <div className="w-12 h-12 rounded-md bg-rose-50 border border-rose-200 flex items-center justify-center mx-auto text-rose-700">
          <ShieldX className="w-6 h-6" />
        </div>

        <div className="space-y-2">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 text-[11px] font-mono font-medium text-rose-900 bg-rose-100 rounded border border-rose-200">
            403 · Access Denied
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-stone-900">
            Representative Authorization Required
          </h1>
          <p className="text-xs sm:text-sm text-stone-600 max-w-md mx-auto leading-relaxed">
            You are currently signed in as a KUCSE25 student (
            <strong className="text-stone-900">{currentUser.name}</strong>, Roll {currentUser.studentId}), but the moderation console is strictly restricted to the batch Class Representative (CR) and Assistant Class Representative (ACR).
          </p>
        </div>

        <div className="p-4 bg-stone-50 border border-stone-200 rounded-md max-w-md mx-auto text-left text-xs space-y-2">
          <p className="font-semibold text-stone-900">Authorized Moderators:</p>
          <ul className="text-stone-600 space-y-1 font-mono text-[11px]">
            <li>• Class Representative (CR): Taufiq E Elahi (250221)</li>
            <li>• Asst. Class Representative (ACR): Argha Roy (250236)</li>
          </ul>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
          <button
            type="button"
            onClick={() => navigate('/')}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-semibold text-stone-700 bg-stone-100 hover:bg-stone-200 rounded border border-stone-200 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Return to Archive</span>
          </button>

          <button
            type="button"
            onClick={logout}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign Out Current Account</span>
          </button>
        </div>
      </div>
    );
  }

  // Case 2: Unauthenticated Visitor
  return (
    <div className="max-w-2xl mx-auto px-4 py-16 text-center space-y-6">
      <div className="w-12 h-12 rounded-md bg-amber-50 border border-amber-200 flex items-center justify-center mx-auto text-amber-700">
        <ShieldAlert className="w-6 h-6" />
      </div>

      <div className="space-y-2">
        <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 text-[11px] font-mono font-medium text-amber-900 bg-amber-100 rounded border border-amber-200">
          Private Internal Portal
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-stone-900">
          Moderation Access Required
        </h1>
        <p className="text-xs sm:text-sm text-stone-600 max-w-md mx-auto leading-relaxed">
          The moderation console is private and restricted to the elected Khulna University CSE Batch 25 Class Representative (CR) and Assistant Class Representative (ACR).
        </p>
      </div>

      <div className="p-5 bg-white border border-stone-200 rounded-md max-w-md mx-auto space-y-3 text-left">
        <p className="text-xs font-bold text-stone-900 uppercase tracking-wider">
          Batch Representative Authentication
        </p>
        <p className="text-xs text-stone-600 leading-relaxed">
          Please authenticate using your verified institutional email (CR: 250221@ku.ac.bd or ACR: 250236@ku.ac.bd) via passwordless verification code.
        </p>
        <button
          type="button"
          onClick={() => setAuthModalOpen(true)}
          className="w-full inline-flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-stone-900 hover:bg-stone-800 rounded transition-colors"
        >
          <Mail className="w-3.5 h-3.5" />
          <span>Sign In with Representative Email</span>
        </button>

        {!isSupabaseConfigured && (
          <p className="text-[11px] text-amber-800 bg-amber-50 p-2 rounded border border-amber-200">
            Note: Supabase credentials are not configured in environment. Please configure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.
          </p>
        )}
      </div>

      <div>
        <button
          type="button"
          onClick={() => navigate('/')}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-stone-500 hover:text-stone-900 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Return to public website</span>
        </button>
      </div>

      <StudentAuthModal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
      />
    </div>
  );
};
