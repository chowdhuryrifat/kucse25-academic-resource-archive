import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { validateKUCSE25Email } from '../data/whitelist';
import { CheckCircle2, AlertCircle, X, ShieldCheck, Mail, ArrowRight } from 'lucide-react';

interface StudentAuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export const StudentAuthModal: React.FC<StudentAuthModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const { loginWithEmail } = useAuth();
  const [emailInput, setEmailInput] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [successInfo, setSuccessInfo] = useState<{ name: string; studentId: string; isCR?: boolean } | null>(null);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    const validation = validateKUCSE25Email(emailInput);
    if (!validation.isValid || !validation.studentId) {
      setErrorMsg(validation.error || 'Invalid student email.');
      return;
    }

    const res = loginWithEmail(emailInput);
    if (res.success) {
      setSuccessInfo({
        name: validation.name || `Student ${validation.studentId}`,
        studentId: validation.studentId,
        isCR: validation.isCR,
      });

      setTimeout(() => {
        onClose();
        if (onSuccess) onSuccess();
      }, 1000);
    } else {
      setErrorMsg(res.error || 'Authentication error.');
    }
  };

  const fillQuick = (email: string) => {
    setEmailInput(email);
    setErrorMsg('');
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
            <h2 id="student-auth-title" className="text-sm font-semibold text-stone-900">
              Student Email Verification
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-stone-400 hover:text-stone-700 rounded transition-colors"
            aria-label="Close dialog"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5">
          {successInfo ? (
            <div className="text-center py-4 space-y-2">
              <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto" />
              <h3 className="text-sm font-semibold text-stone-900">Verification Confirmed</h3>
              <p className="text-xs text-stone-600">
                Welcome, <strong className="font-semibold text-stone-900">{successInfo.name}</strong> (Roll {successInfo.studentId})
                {successInfo.isCR && ' · Moderator Access Enabled'}
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="student-email-input" className="block text-xs font-medium text-stone-700 mb-1.5">
                  Khulna University Institutional Email
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
                  Allowed: 250201–250243@ku.ac.bd (excluding 10, 16, 17, 27)
                </p>
              </div>

              {errorMsg && (
                <div className="p-2.5 bg-rose-50 border border-rose-200 rounded text-xs text-rose-800 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <span>{errorMsg}</span>
                </div>
              )}

              {/* Quick Fill for testing */}
              <div className="pt-1">
                <p className="text-[11px] font-medium text-stone-500 uppercase tracking-wider mb-1.5">
                  Quick Select Demo:
                </p>
                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() => fillQuick('250233@ku.ac.bd')}
                    className="px-2 py-1 text-[11px] bg-stone-100 hover:bg-stone-200 rounded text-stone-700 font-mono border border-stone-200 transition-colors"
                  >
                    250233 (Student)
                  </button>
                  <button
                    type="button"
                    onClick={() => fillQuick('250205@ku.ac.bd')}
                    className="px-2 py-1 text-[11px] bg-amber-50 hover:bg-amber-100 rounded text-amber-900 font-mono border border-amber-200 transition-colors"
                  >
                    250205 (CR)
                  </button>
                  <button
                    type="button"
                    onClick={() => fillQuick('250212@ku.ac.bd')}
                    className="px-2 py-1 text-[11px] bg-blue-50 hover:bg-blue-100 rounded text-blue-900 font-mono border border-blue-200 transition-colors"
                  >
                    250212 (ACR)
                  </button>
                </div>
              </div>

              <div className="pt-3 border-t border-stone-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-3 py-1.5 text-xs font-medium text-stone-600 hover:text-stone-900 rounded transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-stone-900 hover:bg-stone-800 rounded transition-colors"
                >
                  <span>Verify Identity</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
