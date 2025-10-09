import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { API_BASE } from "../lib/env";
import { safeJson } from "../lib/http";
import { getAccessToken } from "../lib/auth";
import { errorMessage } from "../lib/errors";

type DocListItem = {
  id: number;
  title: string;
  owner_id: number;
  updated_at: string; // ISO
};

export default function DocumentsList() {
  const [docs, setDocs] = useState<DocListItem[] | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const navigate = useNavigate();

  async function load() {
    setMsg(null);
    try {
      const token = getAccessToken();
      const r = await fetch(`${API_BASE}/documents`, {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token ?? ""}`,
        },
      });
      const data = await safeJson<DocListItem[]>(r);
      if (!r.ok) {
        setMsg(`Error ${r.status}`);
        setDocs([]);
        return;
      }
      setDocs(data ?? []);
    } catch (e: unknown) {
      setMsg(errorMessage(e));
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function delDoc(id: number) {
    if (!confirm("Delete this document? This cannot be undone.")) return;
    setBusyId(id);
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
        setDocs((prev) => (prev ? prev.filter((d) => d.id !== id) : prev));
      } else {
        const data = await safeJson<{ message?: string }>(r);
        alert(data?.message ?? `Delete failed (${r.status})`);
      }
    } catch (e: unknown) {
      alert(errorMessage(e));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Your documents</h1>
        <button
          onClick={() => navigate("/docs/new")}
          className="bg-blue-600 text-white rounded px-3 py-2 hover:bg-blue-700"
        >
          New document
        </button>
      </div>

      {msg && <div className="text-sm text-red-600">{msg}</div>}
      {!docs ? (
        <div>Loading…</div>
      ) : docs.length === 0 ? (
        <div className="text-gray-600">No documents yet.</div>
      ) : (
        <ul className="divide-y rounded border">
          {docs.map((d) => (
            <li key={d.id} className="p-3 flex items-center justify-between">
              <div>
                <Link
                  to={`/docs/${d.id}`}
                  className="text-blue-600 hover:underline font-medium"
                >
                  {d.title}
                </Link>
                <div className="text-xs text-gray-500">
                  Updated {new Date(d.updated_at).toLocaleString()}
                </div>
              </div>
              <div className="flex items-center gap-2">
                {/* placeholder link for editor page you'll add later */}
                <Link
                  to={`/doc/${d.id}`}
                  className="text-sm px-2 py-1 rounded bg-emerald-600 text-white hover:bg-emerald-700"
                >
                  Open editor
                </Link>
                <button
                  disabled={busyId === d.id}
                  onClick={() => delDoc(d.id)}
                  className="text-sm px-2 py-1 rounded bg-red-600 text-white hover:bg-red-700 disabled:opacity-60"
                >
                  {busyId === d.id ? "Deleting…" : "Delete"}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
