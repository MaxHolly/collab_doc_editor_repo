import React, { useState } from "react";
import { API_BASE } from "../lib/env";
import { getAccessToken } from "../lib/auth";
import { useNavigate } from "react-router-dom";
import { errorMessage } from "../lib/errors";
import { safeJson } from "../lib/http";

type CreateResponse = { id: number; title: string };
type ErrorResponse = { message?: string; errors?: unknown };

export default function DocumentCreate() {
  const [title, setTitle] = useState("");
  const [contentText, setContentText] = useState(""); // JSON string (optional)
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const navigate = useNavigate();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      let content: unknown = undefined;
      if (contentText.trim()) {
        try {
          content = JSON.parse(contentText);
        } catch {
          setMsg("Content must be valid JSON.");
          setBusy(false);
          return;
        }
      }
      const token = getAccessToken();
      const r = await fetch(`${API_BASE}/documents`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token ?? ""}`,
        },
        body: JSON.stringify({ title, content }),
      });
      if (!r.ok) {
        const data = await safeJson<ErrorResponse>(r);
        setMsg(data?.message ?? `Error ${r.status}`);
        return;
      }
      const data = await safeJson<CreateResponse>(r);
      if (data?.id) {
        navigate(`/docs/${data.id}`);
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
    <div className="max-w-xl mx-auto p-6 space-y-4">
      <h1 className="text-2xl font-bold">Create document</h1>
      {msg && <div className="text-sm text-red-600">{msg}</div>}
      <form onSubmit={submit} className="space-y-3">
        <input
          className="w-full border rounded p-2"
          placeholder="Title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          minLength={1}
          required
        />
        <textarea
          className="w-full border rounded p-2 font-mono text-sm min-h-[160px]"
          placeholder='Optional JSON content, e.g. {"ops":[{"insert":"Hello\\n"}]}'
          value={contentText}
          onChange={(e) => setContentText(e.target.value)}
        />
        <div className="flex gap-2">
          <button
            disabled={busy}
            className="bg-blue-600 text-white rounded px-3 py-2 hover:bg-blue-700 disabled:opacity-60"
          >
            {busy ? "Creating…" : "Create"}
          </button>
          <button
            type="button"
            onClick={() => navigate("/docs")}
            className="border rounded px-3 py-2"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
