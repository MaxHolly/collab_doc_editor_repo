import React, { useState } from "react";
import { API_BASE } from "../lib/env";
import { errorMessage } from "../lib/errors";
import { safeJson } from "../lib/http";
import { Link } from "react-router-dom";
import Button from "../components/ui/Button";


type ErrorResponse = { message?: string; errors?: unknown };

export default function RegisterPage() {
  const [form, setForm] = useState({ username: "", email: "", password: "" });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [errors, setErrors] = useState<unknown>(null);

  const onChange = (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm({ ...form, [e.target.name]: e.target.value });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    setErrors(null);
    try {
      const r = await fetch(`${API_BASE}/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await safeJson<ErrorResponse>(r);
      if (!r.ok) {
        setMsg(data?.message ?? `Error ${r.status}`);
        setErrors(data?.errors ?? null);
      } else {
        setMsg("Registered! You can now login.");
      }
    } catch (e: unknown) {
      setMsg(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="max-w-md mx-auto p-6 space-y-4">
      <h1 className="text-2xl font-bold">Register</h1>
      {msg && <div className="text-sm text-blue-700">{msg}</div>}
      {!!errors && (
        <pre className="text-xs text-red-600 bg-red-50 p-2 rounded">
          {JSON.stringify(errors, null, 2)}
        </pre>
      )}
      <form onSubmit={submit} className="space-y-3">
        <input className="w-full border rounded p-2" name="username" placeholder="Username" value={form.username} onChange={onChange} required />
        <input className="w-full border rounded p-2" name="email" placeholder="Email" type="email" value={form.email} onChange={onChange} required />
        <input className="w-full border rounded p-2" name="password" placeholder="Password" type="password" value={form.password} onChange={onChange} required />
        <Button disabled={busy} variant="primary">
          {busy ? "Creating…" : "Create account"}
        </Button>
      </form>
        <div className="text-sm">
            Already have an account?{" "}
            <Link to="/login" className="text-blue-600 hover:underline">Back to login</Link>
        </div>
    </div>
  );
}
