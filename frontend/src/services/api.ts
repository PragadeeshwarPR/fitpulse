const BASE = (import.meta.env.VITE_API_URL ?? "").replace(/\/$/, "");

export class ApiError extends Error {
  status: number;
  code: string;
  details?: { fieldErrors?: Record<string, string[]>; formErrors?: string[] };
  constructor(status: number, code: string, message: string, details?: ApiError["details"]) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

/** True when the failure was the network (offline, DNS, CORS), not an HTTP error. */
export const isNetworkError = (e: unknown) => e instanceof TypeError || (e instanceof ApiError && e.status === 0);

export async function api<T = unknown>(path: string, opts: RequestInit & { json?: unknown } = {}): Promise<T> {
  const headers = new Headers(opts.headers);
  headers.set("x-tz-offset", String(new Date().getTimezoneOffset()));
  let body = opts.body;
  if (opts.json !== undefined) {
    headers.set("content-type", "application/json");
    body = JSON.stringify(opts.json);
  }
  const res = await fetch(`${BASE}/api${path}`, { ...opts, body, headers, credentials: "include" });
  if (res.status === 204) return undefined as T;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = data?.error ?? {};
    throw new ApiError(res.status, err.code ?? "error", err.message ?? res.statusText, err.details);
  }
  return data as T;
}

export const apiUrl = (path: string) => `${BASE}/api${path}`;

/** First field error message for a form field, if any. */
export function fieldError(e: unknown, field: string) {
  return e instanceof ApiError ? e.details?.fieldErrors?.[field]?.[0] : undefined;
}
