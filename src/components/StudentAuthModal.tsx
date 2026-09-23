import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { validateKUCSE25Email } from '../data/whitelist';
import {
  CheckCircle2,
  AlertCircle,
  X,
  ShieldCheck,
  Mail,
  ArrowRight,
  KeyRound,
  Loader2,
  Info,
} from 'lucide-react';

interface StudentAuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export const StudentAuthModal: React.FC<StudentAuthModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const { sendLoginCode, verifyLoginCode, isSupabaseConfigured, studentProfile, currentUser } = useAuth();
  const [emailInput, setEmailInput] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [step, setStep] = useState<'email' | 'otp' | 'success'>('email');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [confirmedStudent, setConfirmedStudent] = useState<{
    name: string;
    studentId: string;
    role: string;
  } | null>(null);

  if (!isOpen) return null;

  const handleSendEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    const validation = validateKUCSE25Email(emailInput);
    if (!validation.isValid || !validation.studentId) {
      setErrorMsg(validation.error || 'This email is not part of the active KUCSE25 student roster.');
      return;
    }

    if (!isSupabaseConfigured) {
      setErrorMsg(
        'Supabase authentication is not configured in this environment. Please configure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your environment.'
      );
      return;
    }

    setLoading(true);
    try {
      const res = await sendLoginCode(emailInput);
      if (res.success) {
        setStep('otp');
      } else {
        setErrorMsg(res.error || 'Failed to dispatch verification code.');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Error initiating authentication.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otpCode.trim()) {
      setErrorMsg('Please enter the 6-digit verification code received in your KU email.');
      return;
    }

    setLoading(true);
    setErrorMsg('');
    try {
      const res = await verifyLoginCode(emailInput, otpCode);
      if (res.success) {
        const studentName = studentProfile?.name || currentUser?.name || 'Verified KUCSE25 Student';
        const studentId = studentProfile?.studentId || currentUser?.studentId || '';
        const role = studentProfile?.role || currentUser?.role || 'student';

        setConfirmedStudent({
          name: studentName,
          studentId,
          role,
        });
        setStep('success');

        setTimeout(() => {
          onClose();
          if (onSuccess) onSuccess();
        }, 1500);
      } else {
        setErrorMsg(res.error || 'Invalid or expired verification code.');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to verify verification code.');
    } finally {
      setLoading(false);
    }
  };

  const fillPreset = (email: string) => {
    setEmailInput(email);
    setErrorMsg('');
  };

  const handleModalClose = () => {
    setErrorMsg('');
    setOtpCode('');
    setStep('email');
    setConfirmedStudent(null);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/50 backdrop-blur-xs">
      <div
        className="w-full max-w-md bg-white border border-stone-200 rounded-md shadow-md overflow-hidden"
        role="dialog"
        aria-modal="true"
        aria-labelledby="student-auth-title"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-stone-100 bg-stone-50">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-stone-700" />
            <div>
              <h2 id="student-auth-title" className="text-sm font-semibold text-stone-900">
                KUCSE25 Student Verification
              </h2>
              <p className="text-[11px] text-stone-500 font-mono">
                {isSupabaseConfigured
                  ? 'Supabase Passwordless Authentication'
                  : 'Supabase Configuration Required'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleModalClose}
            className="p-1 text-stone-400 hover:text-stone-700 rounded transition-colors"
            aria-label="Close dialog"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5">
          {!isSupabaseConfigured && (
            <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded text-xs text-amber-900 space-y-1">
              <div className="flex items-center gap-1.5 font-semibold">
                <Info className="w-4 h-4 text-amber-700 shrink-0" />
                <span>Configuration Notice</span>
              </div>
              <p className="text-[11px] text-amber-800 leading-relaxed">
                Supabase credentials (<code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code>) are not configured. Real email authentication requires connecting a Supabase project.
              </p>
            </div>
          )}

          {step === 'success' && confirmedStudent ? (
            <div className="text-center py-5 space-y-2">
              <CheckCircle2 className="w-10 h-10 text-emerald-600 mx-auto" />
              <h3 className="text-base font-bold text-stone-900">
                Authentication Successful
              </h3>
              <p className="text-sm font-semibold text-stone-900">
                {confirmedStudent.name}
              </p>
              <p className="text-xs text-stone-500 font-mono">
                Roll: {confirmedStudent.studentId} · Role: {confirmedStudent.role.toUpperCase()}
              </p>
              <p className="text-[11px] text-emerald-700 pt-1">
                Verified against authoritative KUCSE25 database roster.
              </p>
            </div>
          ) : step === 'otp' ? (
            <form onSubmit={handleVerifyOtp} className="space-y-4">
              <div className="p-3 bg-blue-50 border border-blue-200 rounded text-xs text-blue-900 space-y-1">
                <p className="font-semibold">Check your KU email for the login link/code.</p>
                <p className="text-[11px] text-blue-800">
                  A 6-digit confirmation code has been dispatched to{' '}
                  <strong className="font-mono">{emailInput}</strong>.
                </p>
              </div>

              <div>
                <label htmlFor="otp-input" className="block text-xs font-semibold text-stone-900 uppercase tracking-wider mb-1.5">
                  Enter 6-Digit Verification Code
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-stone-400">
                    <KeyRound className="w-4 h-4" />
                  </div>
                  <input
                    id="otp-input"
                    type="text"
                    value={otpCode}
                    onChange={(e) => {
                      setOtpCode(e.target.value);
                      setErrorMsg('');
                    }}
                    placeholder="123456"
                    maxLength={10}
                    className="w-full pl-9 pr-3 py-2 text-sm bg-white border border-stone-300 rounded focus:outline-none focus:border-stone-900 focus:ring-1 focus:ring-stone-900 font-mono tracking-widest"
                    autoFocus
                    required
                  />
                </div>
                <p className="mt-1 text-[11px] text-stone-500">
                  You can also click the magic link sent to your inbox to sign in automatically.
                </p>
              </div>

              {errorMsg && (
                <div className="p-2.5 bg-rose-50 border border-rose-200 rounded text-xs text-rose-800 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <span>{errorMsg}</span>
                </div>
              )}

              <div className="pt-3 border-t border-stone-100 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setStep('email')}
                  className="text-xs text-stone-600 hover:text-stone-900 underline"
                >
                  Change Email
                </button>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleModalClose}
                    className="px-3 py-1.5 text-xs font-medium text-stone-600 hover:text-stone-900 rounded transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-stone-900 hover:bg-stone-800 disabled:opacity-50 rounded transition-colors"
                  >
                    {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    <span>Confirm Code</span>
                  </button>
                </div>
              </div>
            </form>
          ) : (
            <form onSubmit={handleSendEmail} className="space-y-4">
              <div>
                <label
                  htmlFor="student-email-input"
                  className="block text-xs font-semibold text-stone-900 uppercase tracking-wider mb-1.5"
                >
                  Enter KU Student Email
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-stone-400">
                    <Mail className="w-4 h-4" />
                  </div>
                  <input
                    id="student-email-input"
                    type="email"
                    value={emailInput}
                    onChange={(e) => {
                      setEmailInput(e.target.value);
                      setErrorMsg('');
                    }}
                    placeholder="250233@ku.ac.bd"
                    className="w-full pl-9 pr-3 py-2 text-xs sm:text-sm bg-white border border-stone-300 rounded focus:outline-none focus:border-stone-900 focus:ring-1 focus:ring-stone-900 font-mono"
                    autoFocus
                    required
                  />
                </div>
                <p className="mt-1.5 text-[11px] text-stone-500 font-mono">
                  Format: 2502XX@ku.ac.bd (Rolls 01–43 excluding 10, 16, 17, 27)
                </p>
              </div>

              {errorMsg && (
                <div className="p-2.5 bg-rose-50 border border-rose-200 rounded text-xs text-rose-800 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <span>{errorMsg}</span>
                </div>
              )}

              {/* Roster Presets */}
              <div className="pt-1">
                <p className="text-[11px] font-medium text-stone-500 uppercase tracking-wider mb-1.5">
                  KUCSE25 Roster Presets:
                </p>
                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() => fillPreset('250233@ku.ac.bd')}
                    className="px-2 py-1 text-[11px] bg-stone-100 hover:bg-stone-200 rounded text-stone-700 font-mono border border-stone-200 transition-colors"
                  >
                    250233@ku.ac.bd (Rifat)
                  </button>
                  <button
                    type="button"
                    onClick={() => fillPreset('250221@ku.ac.bd')}
                    className="px-2 py-1 text-[11px] bg-amber-50 hover:bg-amber-100 rounded text-amber-900 font-mono border border-amber-200 transition-colors"
                  >
                    250221@ku.ac.bd (CR)
                  </button>
                  <button
                    type="button"
                    onClick={() => fillPreset('250236@ku.ac.bd')}
                    className="px-2 py-1 text-[11px] bg-blue-50 hover:bg-blue-100 rounded text-blue-900 font-mono border border-blue-200 transition-colors"
                  >
                    250236@ku.ac.bd (ACR)
                  </button>
                </div>
              </div>

              <div className="pt-3 border-t border-stone-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={handleModalClose}
                  className="px-3 py-1.5 text-xs font-medium text-stone-600 hover:text-stone-900 rounded transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-stone-900 hover:bg-stone-800 disabled:opacity-50 rounded transition-colors"
                >
                  {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Send Login Code</span>
                  {!loading && <ArrowRight className="w-3.5 h-3.5" />}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
