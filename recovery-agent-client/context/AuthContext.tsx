'use client';

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';
import { AuthUser, AuthResponse } from '../lib/types';
import { getToken, setToken, removeToken } from '../lib/auth';

interface AuthContextValue {
  user: AuthUser | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (response: AuthResponse) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setTokenState] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // On mount, restore auth state from localStorage
  useEffect(() => {
    const storedToken = getToken();
    const storedUser = localStorage.getItem('ra_user');

    if (storedToken && storedUser) {
      try {
        setTokenState(storedToken);
        setUser(JSON.parse(storedUser));
      } catch {
        removeToken();
      }
    }
    setIsLoading(false);
  }, []);

  const login = useCallback((response: AuthResponse) => {
    setToken(response.access_token);
    localStorage.setItem('ra_user', JSON.stringify(response.user));
    setTokenState(response.access_token);
    setUser(response.user);
  }, []);

  const logout = useCallback(() => {
    removeToken();
    setTokenState(null);
    setUser(null);
  }, []);

  const bypassAuth = process.env.NEXT_PUBLIC_AUTH_BYPASS === 'true';

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isLoading,
        isAuthenticated: bypassAuth || Boolean(token),
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
