import React, { createContext, useContext, useEffect, useState } from 'react';
import { UserRole, UserSession } from '../types';
import { ACR_STUDENT_ID, CR_STUDENT_ID, KUCSE25_STUDENT_DIRECTORY, validateKUCSE25Email } from '../data/whitelist';

interface AuthContextType {
  currentUser: UserSession;
  isLoggedIn: boolean;
  loginWithEmail: (email: string) => { success: boolean; error?: string };
  loginAsDemoStudent: () => void;
  loginAsCR: () => void;
  loginAsACR: () => void;
  loginAsPublic: () => void;
  setRole: (role: UserRole) => void;
  logout: () => void;
}

const PUBLIC_USER: UserSession = {
  role: 'public',
  name: 'Public Visitor',
  email: '',
  studentId: '',
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const AUTH_STORAGE_KEY = 'kucse25_active_session_v1';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<UserSession>(() => {
    if (typeof window === 'undefined') return PUBLIC_USER;
    try {
      const saved = localStorage.getItem(AUTH_STORAGE_KEY);
      if (saved) {
        return JSON.parse(saved);
      }
    } catch {
      // fallback
    }
    return PUBLIC_USER;
  });

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(currentUser));
    }
  }, [currentUser]);

  const loginWithEmail = (email: string) => {
    const val = validateKUCSE25Email(email);
    if (!val.isValid || !val.studentId) {
      return { success: false, error: val.error || 'Invalid student email.' };
    }

    const isCRorACR = val.isCR || val.isACR;
    const session: UserSession = {
      role: isCRorACR ? 'admin' : 'student',
      name: val.name || `KUCSE25 Student (${val.studentId})`,
      email: `${val.studentId}@ku.ac.bd`,
      studentId: val.studentId,
      title: val.isCR ? 'Class Representative (CR)' : val.isACR ? 'Asst. CR (ACR)' : 'KUCSE25 Student',
    };

    setCurrentUser(session);
    return { success: true };
  };

  const loginAsDemoStudent = () => {
    // Rifat Ahmed (250233)
    const session: UserSession = {
      role: 'student',
      name: KUCSE25_STUDENT_DIRECTORY['250233'].name,
      email: KUCSE25_STUDENT_DIRECTORY['250233'].email,
      studentId: '250233',
      title: 'KUCSE25 Student',
    };
    setCurrentUser(session);
  };

  const loginAsCR = () => {
    // Tanvir Hossain (250205)
    const session: UserSession = {
      role: 'admin',
      name: KUCSE25_STUDENT_DIRECTORY[CR_STUDENT_ID].name,
      email: KUCSE25_STUDENT_DIRECTORY[CR_STUDENT_ID].email,
      studentId: CR_STUDENT_ID,
      title: 'Class Representative (CR)',
    };
    setCurrentUser(session);
  };

  const loginAsACR = () => {
    // Tahmidul Islam (250212)
    const session: UserSession = {
      role: 'admin',
      name: KUCSE25_STUDENT_DIRECTORY[ACR_STUDENT_ID].name,
      email: KUCSE25_STUDENT_DIRECTORY[ACR_STUDENT_ID].email,
      studentId: ACR_STUDENT_ID,
      title: 'Assistant Class Representative (ACR)',
    };
    setCurrentUser(session);
  };

  const loginAsPublic = () => {
    setCurrentUser(PUBLIC_USER);
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

  const logout = () => {
    setCurrentUser(PUBLIC_USER);
  };

  const isLoggedIn = currentUser.role !== 'public';

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        isLoggedIn,
        loginWithEmail,
        loginAsDemoStudent,
        loginAsCR,
        loginAsACR,
        loginAsPublic,
        setRole,
        logout,
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
