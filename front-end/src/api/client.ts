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
}

async function request<T = unknown>(method: string, path: string, body?: unknown): Promise<T> {
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
