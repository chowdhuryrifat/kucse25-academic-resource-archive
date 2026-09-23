import React, { createContext, useContext, useEffect, useState } from 'react';
import { UserSession, StudentProfile } from '../types';
import { validateKUCSE25Email } from '../data/whitelist';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

interface AuthContextType {
  currentUser: UserSession;
  studentProfile: StudentProfile | null;
  isLoggedIn: boolean;
  isLoading: boolean;
  isSupabaseConfigured: boolean;
  // Supabase passwordless authentication methods
  sendLoginCode: (email: string) => Promise<{ success: boolean; error?: string }>;
  verifyLoginCode: (email: string, token: string) => Promise<{ success: boolean; error?: string }>;
  loginWithEmail: (email: string) => Promise<{ success: boolean; error?: string; requiresOtp?: boolean }>;
  logout: () => Promise<void>;
  // Aliases for backwards compatibility
  sendOtp: (email: string) => Promise<{ success: boolean; error?: string }>;
  verifyOtp: (email: string, token: string) => Promise<{ success: boolean; error?: string }>;
}

const PUBLIC_USER: UserSession = {
  role: 'public',
  name: 'Public Visitor',
  email: '',
  studentId: '',
  isAdmin: false,
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<UserSession>(PUBLIC_USER);
  const [studentProfile, setStudentProfile] = useState<StudentProfile | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Synchronize authoritative student profile from Supabase database
  const syncStudentProfile = async (authUserId: string, email: string) => {
    if (!supabase) return;

    try {
      // 1. Primary: invoke secure RPC get_my_student_profile()
      // This function executes database-side linking using verified JWT claims
      const { data: rpcData, error: rpcError } = await supabase.rpc('get_my_student_profile');

      let studentRec: any = null;

      if (!rpcError && Array.isArray(rpcData) && rpcData.length > 0) {
        studentRec = rpcData[0];
      } else {
        // 2. Direct query on public.students table with RLS
        const trimmedEmail = email.trim().toLowerCase();
        const { data: directData, error: directError } = await supabase
          .from('students')
          .select('*')
          .or(`id.eq.${authUserId},email.ilike.${trimmedEmail}`)
          .maybeSingle();

        if (!directError && directData) {
          studentRec = directData;
        } else {
          // 3. Fallback to profiles table if existing schema cache is active
          const { data: profileData } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', authUserId)
            .maybeSingle();
          if (profileData) {
            studentRec = profileData;
          }
        }
      }

      // If user is authenticated in auth.users, but is NOT part of the KUCSE25 students roster:
      if (!studentRec || !studentRec.is_active) {
        console.warn('Authenticated user does not belong to active KUCSE25 student roster. Signing out.');
        await supabase.auth.signOut();
        setCurrentUser(PUBLIC_USER);
        setStudentProfile(null);
        return;
      }

      const role: 'student' | 'cr' | 'acr' =
        studentRec.role === 'cr'
          ? 'cr'
          : studentRec.role === 'acr'
          ? 'acr'
          : 'student';

      const isCrOrAcr = role === 'cr' || role === 'acr';

      const profile: StudentProfile = {
        id: studentRec.id || authUserId,
        studentId: studentRec.student_id,
        name: studentRec.name,
        email: studentRec.email,
        role,
        isActive: studentRec.is_active,
        createdAt: studentRec.created_at,
        updatedAt: studentRec.updated_at,
      };

      const session: UserSession = {
        role,
        name: studentRec.name,
        email: studentRec.email,
        studentId: studentRec.student_id,
        title:
          role === 'cr'
            ? 'Class Representative (CR)'
            : role === 'acr'
            ? 'Asst. CR (ACR)'
            : 'KUCSE25 Student',
        profileId: studentRec.id || authUserId,
        authUserId,
        isAdmin: isCrOrAcr,
      };

      setStudentProfile(profile);
      setCurrentUser(session);
    } catch (err) {
      console.error('Error synchronizing student profile with Supabase:', err);
      setCurrentUser(PUBLIC_USER);
      setStudentProfile(null);
    }
  };

  // Subscribe to real Supabase Auth session lifecycle
  useEffect(() => {
    let mounted = true;

    if (!isSupabaseConfigured || !supabase) {
      // Clean development configuration state: unauthenticated visitor mode
      setCurrentUser(PUBLIC_USER);
      setStudentProfile(null);
      setIsLoading(false);
      return;
    }

    const client = supabase;

    // 1. Initial session verification on startup
    const initSession = async () => {
      try {
        const { data: { session }, error } = await client.auth.getSession();
        if (error) {
          console.error('Supabase getSession error:', error);
          if (mounted) {
            setCurrentUser(PUBLIC_USER);
            setStudentProfile(null);
          }
        } else if (session?.user && mounted) {
          await syncStudentProfile(session.user.id, session.user.email || '');
        } else if (mounted) {
          setCurrentUser(PUBLIC_USER);
          setStudentProfile(null);
        }
      } catch (err) {
        console.error('Session initialization failed:', err);
        if (mounted) setCurrentUser(PUBLIC_USER);
      } finally {
        if (mounted) setIsLoading(false);
      }
    };

    initSession();

    // 2. React to auth state changes (login, logout, token refresh, magic link callback)
    const { data: { subscription } } = client.auth.onAuthStateChange(
      async (event, session) => {
        if (!mounted) return;

        if ((event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') && session?.user) {
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
  }, []);

  /**
   * Request Supabase passwordless email OTP / Magic Link
   */
  const sendLoginCode = async (email: string): Promise<{ success: boolean; error?: string }> => {
    const trimmed = (email || '').trim().toLowerCase();
    const validation = validateKUCSE25Email(trimmed);
    if (!validation.isValid || !validation.studentId) {
      return {
        success: false,
        error: validation.error || 'This email is not part of the active KUCSE25 student roster.',
      };
    }

    if (!isSupabaseConfigured || !supabase) {
      return {
        success: false,
        error: 'Supabase authentication is not configured in this environment. Please configure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.',
      };
    }

    try {
      const redirectUrl = typeof window !== 'undefined' ? window.location.origin : undefined;
      const { error } = await supabase.auth.signInWithOtp({
        email: trimmed,
        options: {
          emailRedirectTo: redirectUrl,
        },
      });

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (err: any) {
      return {
        success: false,
        error: err.message || 'Failed to dispatch login verification code.',
      };
    }
  };

  /**
   * Verify 6-digit OTP code submitted by student
   */
  const verifyLoginCode = async (email: string, token: string): Promise<{ success: boolean; error?: string }> => {
    const trimmed = (email || '').trim().toLowerCase();
    const code = (token || '').trim();

    if (!code) {
      return { success: false, error: 'Please enter the verification code.' };
    }

    if (!isSupabaseConfigured || !supabase) {
      return {
        success: false,
        error: 'Supabase authentication is not configured.',
      };
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

      if (data?.user) {
        await syncStudentProfile(data.user.id, data.user.email || trimmed);
        return { success: true };
      }

      return { success: false, error: 'Authentication verification failed.' };
    } catch (err: any) {
      return {
        success: false,
        error: err.message || 'Failed to verify verification code.',
      };
    }
  };

  /**
   * Universal entry point for email authentication
   */
  const loginWithEmail = async (email: string): Promise<{ success: boolean; error?: string; requiresOtp?: boolean }> => {
    const trimmed = (email || '').trim().toLowerCase();
    const val = validateKUCSE25Email(trimmed);
    if (!val.isValid || !val.studentId) {
      return {
        success: false,
        error: val.error || 'This email is not part of the active KUCSE25 student roster.',
      };
    }

    const res = await sendLoginCode(trimmed);
    if (res.success) {
      return { success: true, requiresOtp: true };
    }
    return { success: false, error: res.error };
  };

  /**
   * Sign out session via Supabase Auth
   */
  const logout = async () => {
    if (isSupabaseConfigured && supabase) {
      try {
        await supabase.auth.signOut();
      } catch (err) {
        console.error('Error signing out from Supabase:', err);
      }
    }
    setCurrentUser(PUBLIC_USER);
    setStudentProfile(null);
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
        sendLoginCode,
        verifyLoginCode,
        loginWithEmail,
        logout,
        // Aliases for compatibility
        sendOtp: sendLoginCode,
        verifyOtp: verifyLoginCode,
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
