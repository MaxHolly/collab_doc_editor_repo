import React, { useEffect, useState } from "react";
import { API_BASE } from "../lib/env";
import { getAccessToken } from "../lib/auth";
import { useNavigate, useParams, Link } from "react-router-dom";
import { errorMessage } from "../lib/errors";
import { safeJson } from "../lib/http";

type DocDetail = {
  id: number;
  title: string;
  description?: string;
  owner_id: number;
  updated_at: string;
  content: unknown;
};

type Msg = { message?: string };

export default function DocumentDetail() {
  const { docId } = useParams();
  const id = Number(docId);
  const [doc, setDoc] = useState<DocDetail | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [contentText, setContentText] = useState("");
  const navigate = useNavigate();

  async function load() {
    setMsg(null);
    try {
      const token = getAccessToken();
      const r = await fetch(`${API_BASE}/documents/${id}`, {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token ?? ""}`,
        },
      });
      const data = await safeJson<DocDetail | Msg>(r);
      if (!r.ok) {
        setMsg((data as Msg)?.message ?? `Error ${r.status}`);
        return;
      }
      const d = data as DocDetail;
      setDoc(d);
      setTitle(d.title);
      setDescription(d.description || "");
      setContentText(
        d.content ? JSON.stringify(d.content, null, 2) : ""
      );
    } catch (e: unknown) {
      setMsg(errorMessage(e));
    }
  }

  useEffect(() => {
    if (Number.isFinite(id)) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function save() {
    setSaving(true);
    setMsg(null);
    try {
      let content: unknown = undefined;
      if (contentText.trim()) {
        try {
          content = JSON.parse(contentText);
        } catch {
          setMsg("Content must be valid JSON.");
          setSaving(false);
          return;
        }
      } else {
        content = null; // allow clearing
      }

      const token = getAccessToken();
      const r = await fetch(`${API_BASE}/documents/${id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token ?? ""}`,
        },
        body: JSON.stringify({ title, description, content }),
      });
      if (!r.ok) {
        const data = await safeJson<Msg>(r);
        setMsg(data?.message ?? `Error ${r.status}`);
        return;
      }
      setMsg("Saved.");
      await load();
    } catch (e: unknown) {
      setMsg(errorMessage(e));
    } finally {
      setSaving(false);
    }
  }

  async function destroy() {
    if (!confirm("Delete this document?")) return;
    try {
      const token = getAccessToken();
      const r = await fetch(`${API_BASE}/documents/${id}`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token ?? ""}`,
        },
      });
      if (r.status === 204) {
        navigate("/docs", { replace: true });
      } else {
        const data = await safeJson<Msg>(r);
        alert(data?.message ?? `Delete failed (${r.status})`);
      }
    } catch (e: unknown) {
      alert(errorMessage(e));
    }
  }

  if (!doc) return <div className="p-6">Loading…</div>;

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Document #{doc.id}</h1>
        <div className="flex gap-2">
          {/* placeholder link for your real editor page */}
          <Link
            to={`/doc/${doc.id}`}
            className="px-3 py-2 rounded bg-emerald-600 text-white hover:bg-emerald-700"
          >
            Open editor
          </Link>
          <button
            onClick={destroy}
            className="px-3 py-2 rounded bg-red-600 text-white hover:bg-red-700"
          >
            Delete
          </button>
        </div>
      </div>

      {msg && <div className="text-sm text-blue-700">{msg}</div>}

      <div className="text-xs text-gray-500">
        Owner: {doc.owner_id} • Updated: {new Date(doc.updated_at).toLocaleString()}
      </div>

      <div className="space-y-3">
        <label className="block text-sm font-medium">Title</label>
        <input
          className="w-full border rounded p-2"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />

        < label className="block text-sm font-medium">Description</label>
        <input
          className="w-full border rounded p-2"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
        />

        <label className="block text-sm font-medium">Content (JSON)</label>
        <textarea
          className="w-full border rounded p-2 font-mono text-sm min-h-[220px]"
          value={contentText}
          onChange={(e) => setContentText(e.target.value)}
          placeholder='{"ops":[{"insert":"Hello\\n"}]}'
        />

        <div className="flex gap-2">
          <button
            disabled={saving}
            onClick={save}
            className="px-3 py-2 rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60"
          >
            {saving ? "Saving…" : "Save"}
          </button>
          <button onClick={() => navigate("/docs")} className="px-3 py-2 rounded border">
            Back to list
          </button>
        </div>
      </div>
    </div>
  );
}
