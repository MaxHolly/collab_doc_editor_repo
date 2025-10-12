// src/pages/LoginPage.tsx
import React, { useState } from "react";
import { useLocation, useNavigate, Link } from "react-router-dom";
import { API_BASE } from "../lib/env";
import { setTokens } from "../lib/auth";
import { errorMessage } from "../lib/errors";
import { safeJson } from "../lib/http";
import Button from "../components/ui/Button";

type LoginResponse = {
  access_token: string;
  refresh_token: string;
  user_id: number;
  message?: string;
};

export default function LoginPage() {
  const [form, setForm] = useState({ email: "", password: "" });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const navigate = useNavigate();

  const loc = useLocation();
  const qs = new URLSearchParams(loc.search);
  const reason = qs.get("reason");
  const next = qs.get("next") || "/"; // encoded path from redirect guard

  const banner =
    reason === "expired"
      ? "Session expired, please log in again."
      : reason === "invalid"
      ? "Invalid session, please log in again."
      : null;

  const onChange = (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm({ ...form, [e.target.name]: e.target.value });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      // IMPORTANT: Use plain fetch here (not apiFetch) to avoid "auth redirect" loops on 401
      const r = await fetch(`${API_BASE}/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      const data = await safeJson<LoginResponse>(r); // LoginResponse | null

      if (!r.ok) {
        setMsg(data?.message ?? `Error ${r.status}`);
        return;
      }

      if (
        data &&
        typeof data.access_token === "string" &&
        typeof data.refresh_token === "string" &&
        typeof data.user_id === "number"
      ) {
        setTokens(data.access_token, data.refresh_token, data.user_id);

        // Navigate back to the originally requested page (decode "next")
        const dest = decodeURIComponent(next);
        navigate(dest || "/", { replace: true });
      } else {
        setMsg("Malformed response from server.");
      }
    } catch (e: unknown) {
      setMsg(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="max-w-md mx-auto p-6 space-y-4">
      <h1 className="text-2xl font-bold">Login</h1>

      {banner && (
        <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          {banner}
        </div>
      )}

      {msg && <div className="text-sm text-red-700">{msg}</div>}

      <form onSubmit={submit} className="space-y-3">
        <input
          className="w-full border rounded p-2"
          name="email"
          placeholder="Email"
          type="email"
          value={form.email}
          onChange={onChange}
          required
        />
        <input
          className="w-full border rounded p-2"
          name="password"
          placeholder="Password"
          type="password"
          value={form.password}
          onChange={onChange}
          required
        />
        <Button disabled={busy} variant="primary">
          {busy ? "Logging in…" : "Login"}
        </Button>
      </form>

      <div className="text-sm">
        No account?{" "}
        <Link to="/register" className="text-blue-600 hover:underline">
          Register
        </Link>
      </div>
    </div>
  );
}
