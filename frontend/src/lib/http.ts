import { getAccessToken, isTokenExpired, logoutAndRedirect } from "./auth";

// Safe JSON parsing that won't throw if body is empty or invalid
export async function safeJson<T = unknown>(res: Response): Promise<T | null> {
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

// Wrapper around fetch() that checks for token expiry before making the call
export async function apiFetch(input: RequestInfo | URL, init: RequestInit = {}) {
  const token = getAccessToken();
  const headers: HeadersInit = {
    ...(init.headers || {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
  const resp = await fetch(input, { ...init, headers });

  if (resp.status === 401 || resp.status === 403) {
    const looksExpired = token ? isTokenExpired(token) : true;
    logoutAndRedirect(looksExpired ? "expired" : "invalid");
    throw new Error("AUTH_REDIRECT");
  }
  return resp;
}