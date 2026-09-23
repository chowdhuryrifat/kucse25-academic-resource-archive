import React, { useState } from 'react';
import { useRouter } from '../context/RouterContext';
import { useAuth } from '../context/AuthContext';
import { ShieldAlert, ArrowLeft, ShieldCheck, UserCheck, Mail } from 'lucide-react';
import { StudentAuthModal } from './StudentAuthModal';

interface AdminAccessGuardProps {
  children: React.ReactNode;
}

export const AdminAccessGuard: React.FC<AdminAccessGuardProps> = ({ children }) => {
  const { navigate } = useRouter();
  const { currentUser, loginAsCR, loginAsACR, isSupabaseConfigured } = useAuth();
  const [authModalOpen, setAuthModalOpen] = useState(false);

  if (currentUser.role === 'admin') {
    return <>{children}</>;
  }

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

      {isSupabaseConfigured ? (
        <div className="p-5 bg-white border border-stone-200 rounded-md max-w-md mx-auto space-y-3 text-left">
          <p className="text-xs font-bold text-stone-900 uppercase tracking-wider">
            Institutional Representative Verification
          </p>
          <p className="text-xs text-stone-600 leading-relaxed">
            Please authenticate using your verified batch representative email (Tanvir Hossain: 250205@ku.ac.bd or Tahmidul Islam: 250212@ku.ac.bd) via passwordless OTP code.
          </p>
          <button
            type="button"
            onClick={() => setAuthModalOpen(true)}
            className="w-full inline-flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-stone-900 hover:bg-stone-800 rounded transition-colors"
          >
            <Mail className="w-3.5 h-3.5" />
            <span>Sign In with Representative Email</span>
          </button>
        </div>
      ) : (
        /* Demo Role Authorization Panel for local development */
        <div className="p-5 bg-white border border-stone-200 rounded-md max-w-md mx-auto space-y-3 text-left">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold text-stone-900 uppercase tracking-wider">
              Dev Mode Role Authorization
            </p>
            <span className="text-[10px] font-mono text-stone-400">Mock Fallback</span>
          </div>
          <p className="text-xs text-stone-500">
            Select an authorized representative identity to test the moderation pipeline:
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
            <button
              type="button"
              onClick={loginAsCR}
              className="flex flex-col p-3 bg-stone-50 hover:bg-stone-100 border border-stone-200 hover:border-stone-300 rounded transition-colors text-left"
            >
              <div className="flex items-center justify-between text-xs font-semibold text-stone-900">
                <span>Tanvir Hossain</span>
                <span className="text-[10px] font-mono px-1.5 py-0.2 bg-amber-100 text-amber-900 rounded font-bold">
                  CR
                </span>
              </div>
              <span className="text-[11px] font-mono text-stone-500 mt-0.5">250205@ku.ac.bd</span>
              <span className="text-xs text-stone-700 mt-2 font-medium flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5 text-stone-700" />
                <span>Login as CR</span>
              </span>
            </button>

            <button
              type="button"
              onClick={loginAsACR}
              className="flex flex-col p-3 bg-stone-50 hover:bg-stone-100 border border-stone-200 hover:border-stone-300 rounded transition-colors text-left"
            >
              <div className="flex items-center justify-between text-xs font-semibold text-stone-900">
                <span>Tahmidul Islam</span>
                <span className="text-[10px] font-mono px-1.5 py-0.2 bg-blue-100 text-blue-900 rounded font-bold">
                  ACR
                </span>
              </div>
              <span className="text-[11px] font-mono text-stone-500 mt-0.5">250212@ku.ac.bd</span>
              <span className="text-xs text-stone-700 mt-2 font-medium flex items-center gap-1">
                <UserCheck className="w-3.5 h-3.5 text-stone-700" />
                <span>Login as ACR</span>
              </span>
            </button>
          </div>
        </div>
      )}

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
