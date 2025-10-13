// src/components/ProtectedRoute.tsx
import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { getAccessToken, isTokenExpired } from "../lib/auth";

export default function ProtectedRoute({ children }: { children: React.ReactElement }) {
  const loc = useLocation();
  const next = encodeURIComponent(loc.pathname + loc.search + loc.hash);
  const token = getAccessToken();

  // No token -> go to login, preserve intended path
  if (!token) return <Navigate to={`/login?next=${next}`} replace />;

  // Token present: check expiry, guard against malformed tokens
  try {
    if (isTokenExpired(token)) {
      return <Navigate to={`/login?reason=expired&next=${next}`} replace />;
    }
  } catch {
    // e.g. bad JWT format
    return <Navigate to={`/login?reason=invalid&next=${next}`} replace />;
  }

  // All good
  return children;
}
