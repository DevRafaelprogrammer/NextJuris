import { createContext, useContext, useState, useCallback, useEffect, useRef, type ReactNode } from "react";
import { authApi } from "../api/auth";
import { ApiError } from "../api/client";
import type { User, LoginInput, RegisterInput } from "../types/auth";

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: ApiError | null;
}

interface AuthActions {
  login: (data: LoginInput) => Promise<User>;
  register: (data: RegisterInput) => Promise<User>;
  logout: () => Promise<void>;
  logoutAll: () => Promise<void>;
  refreshUser: () => Promise<User | null>;
  clearError: () => void;
  updateUser: (partial: Partial<User>) => void;
}

type AuthContextValue = AuthState & AuthActions;

const AuthContext = createContext<AuthContextValue | null>(null);

function getCookie(name: string): string | null {
  const match = document.cookie.match(new RegExp("(?:^|; )" + name + "=([^;]*)"));
  return match ? decodeURIComponent(match[1]) : null;
}

function parseUserCookie(): User | null {
  const raw = getCookie("nj_user");
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: parseUserCookie(),
    isAuthenticated: !!getCookie("nj_user"),
    isLoading: true,
    error: null,
  });
  const mountedRef = useRef(true);

  const setUser = useCallback((user: User | null) => {
    if (!mountedRef.current) return;
    setState(prev => ({
      ...prev,
      user,
      isAuthenticated: !!user,
      isLoading: false,
      error: null,
    }));
  }, []);

  const refreshUser = useCallback(async (): Promise<User | null> => {
    try {
      const user = await authApi.me();
      setUser(user);
      return user;
    } catch {
      setUser(null);
      return null;
    }
  }, [setUser]);

  useEffect(() => {
    mountedRef.current = true;
    if (getCookie("nj_user")) {
      refreshUser();
    } else {
      setState(prev => ({ ...prev, isLoading: false }));
    }
    return () => { mountedRef.current = false; };
  }, [refreshUser]);

  const login = useCallback(async (data: LoginInput): Promise<User> => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));
    try {
      const result = await authApi.login(data);
      const user = { ...result.user, permissions: result.permissions || result.user.permissions };
      setUser(user);
      return user;
    } catch (err) {
      const apiErr = err instanceof ApiError ? err : new ApiError(500, "UNKNOWN", (err as Error).message);
      setState(prev => ({ ...prev, isLoading: false, error: apiErr }));
      throw apiErr;
    }
  }, [setUser]);

  const register = useCallback(async (data: RegisterInput): Promise<User> => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));
    try {
      const result = await authApi.register(data);
      setUser(result.user);
      return result.user;
    } catch (err) {
      const apiErr = err instanceof ApiError ? err : new ApiError(500, "UNKNOWN", (err as Error).message);
      setState(prev => ({ ...prev, isLoading: false, error: apiErr }));
      throw apiErr;
    }
  }, [setUser]);

  const logout = useCallback(async () => {
    try { await authApi.logout(); } catch {}
    setUser(null);
    window.location.href = "/auth#login";
  }, [setUser]);

  const logoutAll = useCallback(async () => {
    try { await authApi.logoutAll(); } catch {}
    setUser(null);
    window.location.href = "/auth#login";
  }, [setUser]);

  const clearError = useCallback(() => {
    setState(prev => ({ ...prev, error: null }));
  }, []);

  const updateUser = useCallback((partial: Partial<User>) => {
    setState(prev => {
      if (!prev.user) return prev;
      return { ...prev, user: { ...prev.user, ...partial } };
    });
  }, []);

  const value: AuthContextValue = {
    ...state,
    login,
    register,
    logout,
    logoutAll,
    refreshUser,
    clearError,
    updateUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
