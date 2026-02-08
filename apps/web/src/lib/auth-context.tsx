"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { MOCK_USERS, type User, type Role } from "./mock-data";
import {
  USE_API, fetchCsrfToken, apiLogin, apiLogout, apiGetMe, apiUserToUser,
} from "./api";
import { clearAllStores } from "./offline-db";

interface AuthContextValue {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<boolean>;
  loginWithUser: (user: User) => void;
  logout: () => void;
  hasRole: (role: Role) => boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(USE_API);

  // Restore session from cookie on mount
  useEffect(() => {
    if (!USE_API) return;
    let cancelled = false;
    (async () => {
      try {
        // Ensure CSRF cookie is set before any future POST
        await fetchCsrfToken();
        const { data, status } = await apiGetMe();
        if (!cancelled) {
          if (data) {
            setUser(apiUserToUser(data));
          }
          // 401/403 = no valid session, stay logged out (normal)
          // Other errors = network issue, still stay logged out but log it
          if (!data && status !== 401 && status !== 403) {
            console.warn("Session restore failed with status", status);
          }
        }
      } catch {
        // Network error — stay logged out
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Listen for session expiry events from apiFetch (401 on any non-/me endpoint)
  useEffect(() => {
    const handleExpired = () => {
      setUser(null);
    };
    window.addEventListener("omnia-session-expired", handleExpired);
    return () => window.removeEventListener("omnia-session-expired", handleExpired);
  }, []);

  const login = useCallback(async (email: string, password: string): Promise<boolean> => {
    if (!USE_API) {
      // Mock login: match by email
      const found = MOCK_USERS.find((u) => u.email === email);
      if (found) {
        setUser(found);
        return true;
      }
      return false;
    }

    // Real API login
    try {
      // 1. Fetch CSRF token
      await fetchCsrfToken();

      // 2. Login
      const { data, error } = await apiLogin(email, password);
      if (error || !data) return false;

      // 3. Refresh CSRF token (Django rotates it after login)
      await fetchCsrfToken();

      // 4. Map to frontend User type
      setUser(apiUserToUser(data));
      return true;
    } catch {
      return false;
    }
  }, []);

  const loginWithUser = useCallback((u: User) => {
    setUser(u);
  }, []);

  const logout = useCallback(async () => {
    if (USE_API) {
      await apiLogout();
    }
    setUser(null);
    // Clear offline cached data to prevent data leak between users
    try { await clearAllStores(); } catch { /* ignore DB errors on logout */ }
  }, []);

  const hasRole = useCallback(
    (role: Role) => user?.role === role,
    [user]
  );

  const value = useMemo(
    () => ({ user, isAuthenticated: !!user, isLoading, login, loginWithUser, logout, hasRole }),
    [user, isLoading, login, loginWithUser, logout, hasRole]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
