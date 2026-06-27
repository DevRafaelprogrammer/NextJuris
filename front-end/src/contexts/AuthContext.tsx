import { createContext, useContext, useState, useCallback, useEffect, useRef, type ReactNode } from "react";
import { authApi } from "../api/auth";
import { ApiError } from "../api/client";
import type { User, LoginInput, RegisterInput } from "../types/auth";

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isRefreshing: boolean;
  error: ApiError | null;
  lastVerified: number;
  sessionAge: number;
}

interface AuthActions {
  login: (data: LoginInput) => Promise<User>;
  register: (data: RegisterInput) => Promise<User>;
  logout: () => Promise<void>;
  logoutAll: () => Promise<void>;
  refreshUser: () => Promise<User | null>;
  refreshSession: () => Promise<boolean>;
  clearError: () => void;
  updateUser: (partial: Partial<User>) => void;
}

type AuthContextValue = AuthState & AuthActions;

const AuthContext = createContext<AuthContextValue | null>(null);

const STORAGE_KEYS = {
  USER: "nj_persisted_user",
  SESSION_START: "nj_session_start",
  LAST_ACTIVITY: "nj_last_activity",
  AUTH_EVENT: "nj_auth_event",
} as const;

const TIMING = {
  REVALIDATE_INTERVAL: 5 * 60 * 1000,
  ACTIVITY_DEBOUNCE: 30 * 1000,
  IDLE_THRESHOLD: 30 * 60 * 1000,
  REFRESH_BEFORE_EXPIRY: 2 * 60 * 1000,
  RETRY_DELAYS: [1000, 3000, 8000],
} as const;

function getCookie(name: string): string | null {
  const match = document.cookie.match(new RegExp("(?:^|; )" + name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "=([^;]*)"));
  return match ? decodeURIComponent(match[1]) : null;
}

function parseUserCookie(): User | null {
  const raw = getCookie("nj_user");
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

function getPersistedUser(): User | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.USER);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch { return null; }
}

function persistUser(user: User | null): void {
  try {
    if (user) {
      localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(user));
    } else {
      localStorage.removeItem(STORAGE_KEYS.USER);
    }
  } catch {}
}

function getSessionStart(): number {
  try {
    return Number(localStorage.getItem(STORAGE_KEYS.SESSION_START)) || 0;
  } catch { return 0; }
}

function setSessionStart(): void {
  try { localStorage.setItem(STORAGE_KEYS.SESSION_START, String(Date.now())); } catch {}
}

function getLastActivity(): number {
  try {
    return Number(localStorage.getItem(STORAGE_KEYS.LAST_ACTIVITY)) || 0;
  } catch { return 0; }
}

function setLastActivity(): void {
  try { localStorage.setItem(STORAGE_KEYS.LAST_ACTIVITY, String(Date.now())); } catch {}
}

function broadcastAuthEvent(type: "login" | "logout" | "refresh" | "update", userId?: string): void {
  try {
    localStorage.setItem(STORAGE_KEYS.AUTH_EVENT, JSON.stringify({ type, userId, timestamp: Date.now() }));
    localStorage.removeItem(STORAGE_KEYS.AUTH_EVENT);
  } catch {}
}

function clearAllPersistence(): void {
  try {
    localStorage.removeItem(STORAGE_KEYS.USER);
    localStorage.removeItem(STORAGE_KEYS.SESSION_START);
    localStorage.removeItem(STORAGE_KEYS.LAST_ACTIVITY);
  } catch {}
}

function resolveInitialUser(): User | null {
  return parseUserCookie() || getPersistedUser();
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>(() => {
    const user = resolveInitialUser();
    return {
      user,
      isAuthenticated: !!user,
      isLoading: !!user,
      isRefreshing: false,
      error: null,
      lastVerified: 0,
      sessionAge: getSessionStart() ? Date.now() - getSessionStart() : 0,
    };
  });

  const mountedRef = useRef(true);
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const revalidateTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const activityTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const refreshingRef = useRef(false);

  const safe = useCallback((fn: () => void) => {
    if (mountedRef.current) fn();
  }, []);

  const setUser = useCallback((user: User | null) => {
    safe(() => {
      setState(prev => ({
        ...prev,
        user,
        isAuthenticated: !!user,
        isLoading: false,
        isRefreshing: false,
        error: null,
        lastVerified: user ? Date.now() : 0,
        sessionAge: user && getSessionStart() ? Date.now() - getSessionStart() : 0,
      }));
    });
    persistUser(user);
  }, [safe]);

  async function retryWithBackoff<T>(fn: () => Promise<T>, retries = TIMING.RETRY_DELAYS): Promise<T> {
    for (let i = 0; i <= retries.length; i++) {
      try {
        return await fn();
      } catch (err) {
        if (i === retries.length) throw err;
        if (err instanceof ApiError && (err.status === 401 || err.status === 403)) throw err;
        await new Promise(r => setTimeout(r, retries[i]));
      }
    }
    throw new Error("Retry exhausted");
  }

  const refreshSession = useCallback(async (): Promise<boolean> => {
    if (refreshingRef.current) return false;
    refreshingRef.current = true;
    safe(() => setState(prev => ({ ...prev, isRefreshing: true })));

    try {
      await retryWithBackoff(() => authApi.refresh());
      const user = await authApi.me();
      setUser(user);
      broadcastAuthEvent("refresh", user.id);
      return true;
    } catch {
      setUser(null);
      clearAllPersistence();
      return false;
    } finally {
      refreshingRef.current = false;
      safe(() => setState(prev => ({ ...prev, isRefreshing: false })));
    }
  }, [setUser, safe]);

  const refreshUser = useCallback(async (): Promise<User | null> => {
    try {
      const user = await retryWithBackoff(() => authApi.me());
      setUser(user);
      return user;
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        const recovered = await refreshSession();
        if (recovered) return state.user;
      }
      setUser(null);
      return null;
    }
  }, [setUser, refreshSession, state.user]);

  useEffect(() => {
    mountedRef.current = true;

    const initialUser = resolveInitialUser();
    if (initialUser) {
      refreshUser();
    } else {
      setState(prev => ({ ...prev, isLoading: false }));
    }

    return () => {
      mountedRef.current = false;
      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
      if (revalidateTimerRef.current) clearInterval(revalidateTimerRef.current);
      if (activityTimerRef.current) clearTimeout(activityTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (!state.isAuthenticated) {
      if (revalidateTimerRef.current) { clearInterval(revalidateTimerRef.current); revalidateTimerRef.current = null; }
      return;
    }

    revalidateTimerRef.current = setInterval(() => {
      const lastActivity = getLastActivity();
      const idle = Date.now() - lastActivity;

      if (idle > TIMING.IDLE_THRESHOLD) return;

      refreshUser();
    }, TIMING.REVALIDATE_INTERVAL);

    return () => {
      if (revalidateTimerRef.current) clearInterval(revalidateTimerRef.current);
    };
  }, [state.isAuthenticated, refreshUser]);

  useEffect(() => {
    if (!state.isAuthenticated) return;

    function trackActivity() {
      if (activityTimerRef.current) return;
      activityTimerRef.current = setTimeout(() => {
        setLastActivity();
        activityTimerRef.current = null;
      }, TIMING.ACTIVITY_DEBOUNCE);
    }

    const events = ["mousedown", "keydown", "scroll", "touchstart"];
    events.forEach(e => document.addEventListener(e, trackActivity, { passive: true }));
    setLastActivity();

    return () => {
      events.forEach(e => document.removeEventListener(e, trackActivity));
      if (activityTimerRef.current) clearTimeout(activityTimerRef.current);
    };
  }, [state.isAuthenticated]);

  useEffect(() => {
    function onStorageChange(e: StorageEvent) {
      if (e.key === STORAGE_KEYS.AUTH_EVENT && e.newValue) {
        try {
          const event = JSON.parse(e.newValue);
          if (event.type === "logout") {
            setUser(null);
            window.location.href = "/auth";
          } else if (event.type === "login" || event.type === "refresh") {
            refreshUser();
          }
        } catch {}
      }

      if (e.key === STORAGE_KEYS.USER) {
        if (!e.newValue) {
          setUser(null);
        } else {
          try {
            const user = JSON.parse(e.newValue);
            safe(() => setState(prev => ({ ...prev, user, isAuthenticated: true })));
          } catch {}
        }
      }
    }

    window.addEventListener("storage", onStorageChange);
    return () => window.removeEventListener("storage", onStorageChange);
  }, [setUser, refreshUser, safe]);

  useEffect(() => {
    function onOnline() {
      if (state.isAuthenticated) refreshUser();
    }

    function onVisibilityChange() {
      if (document.visibilityState === "visible" && state.isAuthenticated) {
        const sinceLastVerify = Date.now() - state.lastVerified;
        if (sinceLastVerify > TIMING.REVALIDATE_INTERVAL) {
          refreshUser();
        }
      }
    }

    window.addEventListener("online", onOnline);
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      window.removeEventListener("online", onOnline);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [state.isAuthenticated, state.lastVerified, refreshUser]);

  const login = useCallback(async (data: LoginInput): Promise<User> => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));
    try {
      const result = await authApi.login(data);
      const user = { ...result.user, permissions: result.permissions || result.user.permissions };
      setUser(user);
      setSessionStart();
      setLastActivity();
      broadcastAuthEvent("login", user.id);
      return user;
    } catch (err) {
      const apiErr = err instanceof ApiError ? err : new ApiError(500, "UNKNOWN", (err as Error).message);
      safe(() => setState(prev => ({ ...prev, isLoading: false, error: apiErr })));
      throw apiErr;
    }
  }, [setUser, safe]);

  const register = useCallback(async (data: RegisterInput): Promise<User> => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));
    try {
      const result = await authApi.register(data);
      setUser(result.user);
      setSessionStart();
      setLastActivity();
      broadcastAuthEvent("login", result.user.id);
      return result.user;
    } catch (err) {
      const apiErr = err instanceof ApiError ? err : new ApiError(500, "UNKNOWN", (err as Error).message);
      safe(() => setState(prev => ({ ...prev, isLoading: false, error: apiErr })));
      throw apiErr;
    }
  }, [setUser, safe]);

  const logout = useCallback(async () => {
    try { await authApi.logout(); } catch {}
    setUser(null);
    clearAllPersistence();
    broadcastAuthEvent("logout");
    window.location.href = "/auth";
  }, [setUser]);

  const logoutAll = useCallback(async () => {
    try { await authApi.logoutAll(); } catch {}
    setUser(null);
    clearAllPersistence();
    broadcastAuthEvent("logout");
    window.location.href = "/auth";
  }, [setUser]);

  const clearError = useCallback(() => {
    setState(prev => ({ ...prev, error: null }));
  }, []);

  const updateUser = useCallback((partial: Partial<User>) => {
    setState(prev => {
      if (!prev.user) return prev;
      const updated = { ...prev.user, ...partial };
      persistUser(updated);
      broadcastAuthEvent("update", updated.id);
      return { ...prev, user: updated };
    });
  }, []);

  const value: AuthContextValue = {
    ...state,
    login,
    register,
    logout,
    logoutAll,
    refreshUser,
    refreshSession,
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
