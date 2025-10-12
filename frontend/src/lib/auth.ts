export function setTokens(access: string, refresh: string, userId: number | string) {
  localStorage.setItem("access_token", access);
  localStorage.setItem("refresh_token", refresh);
  localStorage.setItem("user_id", String(userId));
}

export function getAccessToken(): string | null {
  return localStorage.getItem("access_token");
}

export function getRefreshToken(): string | null {
  return localStorage.getItem("refresh_token");
}

export function clearTokens() {
  localStorage.removeItem("access_token");
  localStorage.removeItem("refresh_token");
  localStorage.removeItem("user_id");
}

// --- new helpers ---
export function decodeJwt<T = unknown>(token?: string | null): T | null {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  try {
    const json = atob(parts[1].replace(/-/g, "+").replace(/_/g, "/"));
    // escape/unescape handles unicode inside atob payloads
    return JSON.parse(decodeURIComponent(escape(json)));
  } catch {
    return null;
  }
}

export function isTokenExpired(token?: string | null, skewSeconds = 15): boolean {
  const payload = decodeJwt<{ exp?: number }>(token);
  if (!payload?.exp) return true; // treat missing/invalid as expired
  const now = Math.floor(Date.now() / 1000);
  return payload.exp <= (now + skewSeconds);
}

// Make isAuthed stricter: token exists AND not expired
export function isAuthed(): boolean {
  const token = getAccessToken();
  return !!token && !isTokenExpired(token);
}

// Centralized logout + redirect with reason and return path.
export function logoutAndRedirect(reason: "expired" | "invalid" | "logout" = "expired") {
  try {
    // Close any live socket if present (best-effort)
    void import("./socket").then((m) => m.closeAppSocket?.());
  } catch {
    /* noop */
  }
  clearTokens();

  const next = encodeURIComponent(window.location.pathname + window.location.search);
  window.location.replace(`/login?reason=${reason}&next=${next}`);
}