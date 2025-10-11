import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { API_BASE } from "../lib/env";
import { safeJson } from "../lib/http";
import { getAccessToken } from "../lib/auth";
import { errorMessage } from "../lib/errors";

type MineDoc = {
  id: number;
  title: string;
  updated_at: string;
  shared_count: number;
};

type SharedDoc = {
  id: number;
  title: string;
  updated_at: string;
  permission_level: "viewer" | "editor" | "owner";
  owner: { id: number; username?: string; email?: string };
};

type OverviewResponse = {
  mine: MineDoc[];
  shared_with_me: SharedDoc[];
};

export default function DocumentsList() {
  const [data, setData] = useState<OverviewResponse | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const navigate = useNavigate();

  async function load() {
    setMsg(null);
    try {
      const token = getAccessToken();
      const r = await fetch(`${API_BASE}/documents/overview`, {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token ?? ""}`,
        },
      });
      const body = await safeJson<OverviewResponse>(r);
      if (!r.ok) {
        setMsg(`Error ${r.status}`);
        setData({ mine: [], shared_with_me: [] });
        return;
      }
      setData(body ?? { mine: [], shared_with_me: [] });
    } catch (e: unknown) {
      setMsg(errorMessage(e));
      setData({ mine: [], shared_with_me: [] });
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
        setData((prev) =>
          prev
            ? { ...prev, mine: prev.mine.filter((d) => d.id !== id) }
            : prev
        );
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

  const renderMine = () => {
    if (!data) return <div>Loading…</div>;
    if (data.mine.length === 0)
      return <div className="text-gray-600">No owned documents yet.</div>;

    return (
      <ul className="divide-y rounded border">
        {data.mine.map((d) => (
          <li key={d.id} className="p-3 flex items-center justify-between">
            <div>
              <Link
                to={`/docs/${d.id}`}
                className="text-blue-600 hover:underline font-medium"
              >
                {d.title || "Untitled"}
              </Link>
              <div className="text-xs text-gray-500">
                Updated {new Date(d.updated_at).toLocaleString()}
                {" · "}
                {d.shared_count > 0
                  ? `Shared with ${d.shared_count}`
                  : "Private"}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Link
                to={`/doc/${d.id}`}
                className="text-sm px-2 py-1 rounded bg-emerald-600 text-white hover:bg-emerald-700"
              >
                Open editor
              </Link>
              <Link
                to={`/docs/${d.id}/share`}
                className="text-sm px-2 py-1 rounded border hover:bg-gray-50"
              >
                Share
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
    );
  };

  const renderShared = () => {
    if (!data) return null;
    if (data.shared_with_me.length === 0)
      return <div className="text-gray-600">Nothing shared with you yet.</div>;

    return (
      <ul className="divide-y rounded border">
        {data.shared_with_me.map((d) => {
          const ownerLabel = d.owner.username || d.owner.email || d.owner.id;
          return (
            <li key={d.id} className="p-3 flex items-center justify-between">
              <div>
                <Link
                  to={`/docs/${d.id}`}
                  className="text-blue-600 hover:underline font-medium"
                >
                  {d.title || "Untitled"}
                </Link>
                <div className="text-xs text-gray-500">
                  Owner: {ownerLabel} · Your role: {d.permission_level} · Updated{" "}
                  {new Date(d.updated_at).toLocaleString()}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Link
                  to={`/doc/${d.id}`}
                  className="text-sm px-2 py-1 rounded bg-emerald-600 text-white hover:bg-emerald-700"
                >
                  Open editor
                </Link>
                {/* No Share/Delete here; only owners can share/remove */}
              </div>
            </li>
          );
        })}
      </ul>
    );
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Documents</h1>
        <button
          onClick={() => navigate("/docs/new")}
          className="bg-blue-600 text-white rounded px-3 py-2 hover:bg-blue-700"
        >
          New document
        </button>
      </div>

      {msg && <div className="text-sm text-red-600">{msg}</div>}

      <section>
        <h2 className="text-lg font-semibold mb-2">My documents</h2>
        {renderMine()}
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-2">Shared with me</h2>
        {renderShared()}
      </section>
    </div>
  );
}