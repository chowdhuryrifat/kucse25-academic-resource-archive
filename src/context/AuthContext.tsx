import React, { createContext, useContext, useEffect, useState } from 'react';
import { UserRole, UserSession, StudentProfile } from '../types';
import { ACR_STUDENT_ID, CR_STUDENT_ID, KUCSE25_STUDENT_DIRECTORY, validateKUCSE25Email } from '../data/whitelist';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

interface AuthContextType {
  currentUser: UserSession;
  studentProfile: StudentProfile | null;
  isLoggedIn: boolean;
  isLoading: boolean;
  isSupabaseConfigured: boolean;
  loginWithEmail: (email: string) => Promise<{ success: boolean; error?: string; requiresOtp?: boolean }>;
  sendOtp: (email: string) => Promise<{ success: boolean; error?: string }>;
  verifyOtp: (email: string, token: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  // Explicit development-only fallback mechanisms (available only when Supabase is not configured)
  loginAsDemoStudent: () => void;
  loginAsCR: () => void;
  loginAsACR: () => void;
  loginAsPublic: () => void;
  setRole: (role: UserRole) => void;
}

const PUBLIC_USER: UserSession = {
  role: 'public',
  name: 'Public Visitor',
  email: '',
  studentId: '',
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const DEV_AUTH_KEY = 'kucse25_dev_session_v1';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<UserSession>(PUBLIC_USER);
  const [studentProfile, setStudentProfile] = useState<StudentProfile | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Load session from Supabase or dev fallback
  useEffect(() => {
    let mounted = true;
    const client = supabase;

    if (isSupabaseConfigured && client) {
      // 1. Production Supabase Auth flow
      const initSupabaseAuth = async () => {
        try {
          const { data: { session } } = await client.auth.getSession();
          if (session?.user && mounted) {
            await syncStudentProfile(session.user.id, session.user.email || '');
          } else if (mounted) {
            setCurrentUser(PUBLIC_USER);
            setStudentProfile(null);
          }
        } catch (err) {
          console.error('Error fetching Supabase session:', err);
          if (mounted) setCurrentUser(PUBLIC_USER);
        } finally {
          if (mounted) setIsLoading(false);
        }
      };

      initSupabaseAuth();

      // Listen to Supabase auth state transitions
      const { data: { subscription } } = client.auth.onAuthStateChange(
        async (event, session) => {
          if (!mounted) return;
          if (event === 'SIGNED_IN' && session?.user) {
            await syncStudentProfile(session.user.id, session.user.email || '');
          } else if (event === 'SIGNED_OUT') {
            setCurrentUser(PUBLIC_USER);
            setStudentProfile(null);
          }
        }
      );

      return () => {
        mounted = false;
        subscription.unsubscribe();
      };
    } else {
      // 2. Development Mock Mode fallback
      try {
        const saved = localStorage.getItem(DEV_AUTH_KEY);
        if (saved) {
          const parsed = JSON.parse(saved);
          setCurrentUser(parsed);
        }
      } catch {
        setCurrentUser(PUBLIC_USER);
      }
      setIsLoading(false);
    }
  }, []);

  // Fetch authoritative profile from Supabase
  const syncStudentProfile = async (authUserId: string, email: string) => {
    if (!supabase) return;
    try {
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', authUserId)
        .single();

      if (error || !profile) {
        // Fallback: check roster if profile trigger hasn't fired yet
        const validation = validateKUCSE25Email(email);
        if (!validation.isValid) {
          console.warn('Unauthorized email session detected. Logging out.');
          await supabase.auth.signOut();
          setCurrentUser(PUBLIC_USER);
          setStudentProfile(null);
          return;
        }

        const fallbackRole = validation.isCR ? 'cr' : validation.isACR ? 'acr' : 'student';
        const newSession: UserSession = {
          role: fallbackRole === 'student' ? 'student' : 'admin',
          name: validation.name || `Student (${validation.studentId})`,
          email: email.toLowerCase(),
          studentId: validation.studentId || '',
          title: validation.isCR ? 'Class Representative (CR)' : validation.isACR ? 'Asst. CR (ACR)' : 'KUCSE25 Student',
          authUserId,
        };
        setCurrentUser(newSession);
        return;
      }

      if (!profile.is_active) {
        console.warn('Student account is marked inactive in database.');
        await supabase.auth.signOut();
        setCurrentUser(PUBLIC_USER);
        setStudentProfile(null);
        return;
      }

      const isAdmin = profile.role === 'cr' || profile.role === 'acr';
      const userSession: UserSession = {
        role: isAdmin ? 'admin' : 'student',
        name: profile.name,
        email: profile.email,
        studentId: profile.student_id,
        title: profile.role === 'cr'
          ? 'Class Representative (CR)'
          : profile.role === 'acr'
          ? 'Asst. CR (ACR)'
          : 'KUCSE25 Student',
        profileId: profile.id,
        authUserId,
      };

      setStudentProfile({
        id: profile.id,
        studentId: profile.student_id,
        name: profile.name,
        email: profile.email,
        role: profile.role,
        isActive: profile.is_active,
        createdAt: profile.created_at,
      });
      setCurrentUser(userSession);
    } catch (err) {
      console.error('Error synchronizing student profile:', err);
    }
  };

  /**
   * Request passwordless OTP / Magic Link from Supabase
   */
  const sendOtp = async (email: string): Promise<{ success: boolean; error?: string }> => {
    const trimmed = email.trim().toLowerCase();
    const validation = validateKUCSE25Email(trimmed);
    if (!validation.isValid || !validation.studentId) {
      return { success: false, error: validation.error || 'Invalid student email.' };
    }

    if (!isSupabaseConfigured || !supabase) {
      // Mock mode fallback immediately approves
      loginWithEmail(trimmed);
      return { success: true };
    }

    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: trimmed,
        options: {
          emailRedirectTo: typeof window !== 'undefined' ? window.location.origin : undefined,
        },
      });

      if (error) {
        return { success: false, error: error.message };
      }
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'Failed to send OTP.' };
    }
  };

  /**
   * Verify OTP token submitted by student
   */
  const verifyOtp = async (email: string, token: string): Promise<{ success: boolean; error?: string }> => {
    const trimmed = email.trim().toLowerCase();
    const code = token.trim();

    if (!isSupabaseConfigured || !supabase) {
      return loginWithEmail(trimmed);
    }

    try {
      const { data, error } = await supabase.auth.verifyOtp({
        email: trimmed,
        token: code,
        type: 'email',
      });

      if (error) {
        return { success: false, error: error.message };
      }

      if (data.user) {
        await syncStudentProfile(data.user.id, data.user.email || trimmed);
        return { success: true };
      }

      return { success: false, error: 'Authentication verification failed.' };
    } catch (err: any) {
      return { success: false, error: err.message || 'Failed to verify OTP code.' };
    }
  };

  /**
   * Universal login entry point
   */
  const loginWithEmail = async (email: string): Promise<{ success: boolean; error?: string; requiresOtp?: boolean }> => {
    const trimmed = email.trim().toLowerCase();
    const val = validateKUCSE25Email(trimmed);
    if (!val.isValid || !val.studentId) {
      return { success: false, error: val.error || 'Invalid student email format.' };
    }

    if (isSupabaseConfigured && supabase) {
      // In Supabase mode, trigger real OTP / Magic Link
      const res = await sendOtp(trimmed);
      if (res.success) {
        return { success: true, requiresOtp: true };
      }
      return { success: false, error: res.error };
    }

    // Development Mock Fallback
    const isCRorACR = val.isCR || val.isACR;
    const session: UserSession = {
      role: isCRorACR ? 'admin' : 'student',
      name: val.name || `KUCSE25 Student (${val.studentId})`,
      email: `${val.studentId}@ku.ac.bd`,
      studentId: val.studentId,
      title: val.isCR ? 'Class Representative (CR)' : val.isACR ? 'Asst. CR (ACR)' : 'KUCSE25 Student',
    };

    setCurrentUser(session);
    try {
      localStorage.setItem(DEV_AUTH_KEY, JSON.stringify(session));
    } catch {
      // ignore
    }
    return { success: true, requiresOtp: false };
  };

  /**
   * Log out session
   */
  const logout = async () => {
    if (isSupabaseConfigured && supabase) {
      try {
        await supabase.auth.signOut();
      } catch (err) {
        console.error('Error signing out from Supabase:', err);
      }
    } else {
      try {
        localStorage.removeItem(DEV_AUTH_KEY);
      } catch {
        // ignore
      }
    }
    setCurrentUser(PUBLIC_USER);
    setStudentProfile(null);
  };

  // Development-only mock identity switchers
  const loginAsDemoStudent = () => {
    if (isSupabaseConfigured) {
      console.warn('Development login bypassed in Supabase production mode. Use Supabase Auth OTP.');
      return;
    }
    const session: UserSession = {
      role: 'student',
      name: KUCSE25_STUDENT_DIRECTORY['250233'].name,
      email: KUCSE25_STUDENT_DIRECTORY['250233'].email,
      studentId: '250233',
      title: 'KUCSE25 Student',
    };
    setCurrentUser(session);
    localStorage.setItem(DEV_AUTH_KEY, JSON.stringify(session));
  };

  const loginAsCR = () => {
    if (isSupabaseConfigured) {
      console.warn('Development login bypassed in Supabase production mode. Use Supabase Auth OTP.');
      return;
    }
    const session: UserSession = {
      role: 'admin',
      name: KUCSE25_STUDENT_DIRECTORY[CR_STUDENT_ID].name,
      email: KUCSE25_STUDENT_DIRECTORY[CR_STUDENT_ID].email,
      studentId: CR_STUDENT_ID,
      title: 'Class Representative (CR)',
    };
    setCurrentUser(session);
    localStorage.setItem(DEV_AUTH_KEY, JSON.stringify(session));
  };

  const loginAsACR = () => {
    if (isSupabaseConfigured) {
      console.warn('Development login bypassed in Supabase production mode. Use Supabase Auth OTP.');
      return;
    }
    const session: UserSession = {
      role: 'admin',
      name: KUCSE25_STUDENT_DIRECTORY[ACR_STUDENT_ID].name,
      email: KUCSE25_STUDENT_DIRECTORY[ACR_STUDENT_ID].email,
      studentId: ACR_STUDENT_ID,
      title: 'Assistant Class Representative (ACR)',
    };
    setCurrentUser(session);
    localStorage.setItem(DEV_AUTH_KEY, JSON.stringify(session));
  };

  const loginAsPublic = () => {
    if (isSupabaseConfigured && supabase) {
      supabase.auth.signOut();
    } else {
      localStorage.removeItem(DEV_AUTH_KEY);
    }
    setCurrentUser(PUBLIC_USER);
    setStudentProfile(null);
  };

  const setRole = (role: UserRole) => {
    if (role === 'public') {
      loginAsPublic();
    } else if (role === 'student') {
      loginAsDemoStudent();
    } else if (role === 'admin') {
      loginAsCR();
    }
  };

  const isLoggedIn = currentUser.role !== 'public';

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        studentProfile,
        isLoggedIn,
        isLoading,
        isSupabaseConfigured,
        loginWithEmail,
        sendOtp,
        verifyOtp,
        logout,
        loginAsDemoStudent,
        loginAsCR,
        loginAsACR,
        loginAsPublic,
        setRole,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
