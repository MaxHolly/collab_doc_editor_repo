import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { getAccessToken, isTokenExpired, isAuthed } from "../lib/auth";

export default function ProtectedRoute({ children }: { children: React.ReactElement }) {
  const loc = useLocation();
  const next = encodeURIComponent(loc.pathname + loc.search);
  const token = getAccessToken();

  // No token at all -> go to login, keep return path
  if (!token) return <Navigate to={`/login?next=${next}`} replace />;

  // Token present but expired -> send explicit reason
  if (isTokenExpired(token)) return <Navigate to={`/login?reason=expired&next=${next}`} replace />;

  // cover malformed or otherwise invalid tokens
  if (!isAuthed()) return <Navigate to={`/login?next=${next}`} replace />;

  return children;
}
