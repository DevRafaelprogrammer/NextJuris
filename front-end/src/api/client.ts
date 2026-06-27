export class ApiError extends Error {
  status: number;
  code: string;
  details: unknown;
  context: Record<string, unknown> | null;

  constructor(status: number, code: string, message: string, details: unknown = null, context: Record<string, unknown> | null = null) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = details;
    this.context = context;
  }

  get isAuth() { return this.status === 401; }
  get isForbidden() { return this.status === 403; }
  get isValidation() { return this.code === "VALIDATION_ERROR"; }
  get isDuplicate() { return this.code === "DUPLICATE_ENTRY"; }
  get isRateLimit() { return this.status === 429; }
  get isServerError() { return this.status >= 500; }
  get isTokenExpired() { return this.code === "TOKEN_EXPIRED"; }
}

let refreshPromise: Promise<boolean> | null = null;

async function tryRefreshOnce(): Promise<boolean> {
  if (refreshPromise) return refreshPromise;

  refreshPromise = (async () => {
    try {
      const res = await fetch("/api/auth/refresh", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
      });
      return res.ok;
    } catch {
      return false;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

const AUTH_PATHS = ["/auth/login", "/auth/register", "/auth/refresh", "/auth/forgot-password", "/auth/reset-password"];

async function request<T = unknown>(method: string, path: string, body?: unknown, isRetry = false): Promise<T> {
  const config: RequestInit = {
    method,
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
  };

  if (body && method !== "GET") config.body = JSON.stringify(body);

  let url = `/api${path}`;
  if (body && method === "GET") {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(body as Record<string, unknown>)) {
      if (v !== undefined && v !== null && v !== "") params.set(k, String(v));
    }
    const qs = params.toString();
    if (qs) url += "?" + qs;
  }

  const res = await fetch(url, config);

  if (res.status === 204) return null as T;

  if (res.status === 401 && !isRetry && !AUTH_PATHS.includes(path)) {
    const json = await res.clone().json().catch(() => ({}));
    const code = json?.error?.code;

    if (code === "TOKEN_EXPIRED" || code === "UNAUTHORIZED") {
      const refreshed = await tryRefreshOnce();
      if (refreshed) {
        return request<T>(method, path, body, true);
      }
    }

    localStorage.removeItem("nj_persisted_user");
    window.location.href = "/auth";
    throw new ApiError(401, code || "UNAUTHORIZED", json?.error?.message || "Sessao expirada");
  }

  const json = await res.json();

  if (!res.ok) {
    const e = json.error || {};
    throw new ApiError(res.status, e.code || `HTTP_${res.status}`, e.message || `Erro ${res.status}`, e.details, e.context);
  }

  return json.data ?? json;
}

export const api = {
  get: <T,>(path: string, params?: unknown) => request<T>("GET", path, params),
  post: <T,>(path: string, body?: unknown) => request<T>("POST", path, body),
  patch: <T,>(path: string, body?: unknown) => request<T>("PATCH", path, body),
  del: <T,>(path: string) => request<T>("DELETE", path),
};
