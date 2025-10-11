// src/pages/LoginPage.tsx
import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { API_BASE } from "../lib/env";
import { setTokens } from "../lib/auth";
import { errorMessage } from "../lib/errors";
import { safeJson } from "../lib/http";

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

  const onChange = (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm({ ...form, [e.target.name]: e.target.value });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      const r = await fetch(`${API_BASE}/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      const data = await safeJson<LoginResponse>(r); // LoginResponse | null

      if (!r.ok) {
        // data may be null, so use optional chaining
        setMsg(data?.message ?? `Error ${r.status}`);
        return;
      }

      // runtime narrowing
      if (
        data &&
        typeof data.access_token === "string" &&
        typeof data.refresh_token === "string" &&
        typeof data.user_id === "number"
      ) {
        setTokens(data.access_token, data.refresh_token, data.user_id);
        navigate("/");
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
        <button
          disabled={busy}
          className="w-full bg-blue-600 text-white rounded p-2 hover:bg-blue-700 disabled:opacity-60"
        >
          {busy ? "Logging in…" : "Login"}
        </button>
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
