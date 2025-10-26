import { useEffect, useState, useRef } from "react";
import { API_BASE } from "../lib/env";
import { getAccessToken } from "../lib/auth";
import { useNavigate, useParams } from "react-router-dom";
import { errorMessage } from "../lib/errors";
import { safeJson, apiFetch } from "../lib/http";
import Button from "../components/ui/Button";

type DocDetail = {
  id: number;
  title: string;
  description?: string;
  owner?: { id: number; username?: string; email?: string };
  permission_level: "viewer" | "editor" | "owner";
  updated_at: string;
  content: unknown;
  summary?: string;
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
  const [summary, setSummary] = useState<string | null>(null);

  // loading UX for summarize
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);              // 0..100
  const progressTimer = useRef<number | null>(null);
  const [controller, setController] = useState<AbortController | null>(null);

  const navigate = useNavigate();

  function startProgress() {
    // Reset and start a trickle progress that slows as it approaches 90%
    setProgress(0);
    stopProgress(); // clear old timer if any
    const id = window.setInterval(() => {
      setProgress((p) => {
        if (p >= 90) return p;         // don't go past 90% until the request finishes
        const step = p < 60 ? 3 : p < 80 ? 1.5 : 0.5;
        return Math.min(p + step, 90);
      });
    }, 200);
    progressTimer.current = id;
  }

  function finishProgress() {
    // Snap to 100 then fade back to 0 after a moment
    stopProgress();
    setProgress(100);
    setTimeout(() => setProgress(0), 400);
  }

  function stopProgress() {
    if (progressTimer.current !== null) {
      window.clearInterval(progressTimer.current);
      progressTimer.current = null;
    }
  }

  async function load() {
    setMsg(null);
    try {
      const token = getAccessToken();
      const r = await apiFetch(`${API_BASE}/documents/${id}`, {
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
      setContentText(d.content ? JSON.stringify(d.content, null, 2) : "");
      setSummary(d.summary ?? null); 
    } catch (e: unknown) {
      setMsg(errorMessage(e));
    }
  }

  useEffect(() => {
    if (Number.isFinite(id)) load();
    return () => stopProgress();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function getSummary() {
    setLoading(true);
    setSummary(null);
    startProgress();

    const ctl = new AbortController();
    setController(ctl);

    try {
      const token = getAccessToken();
      const r = await apiFetch(`${API_BASE}/documents/${id}/summary`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token ?? ""}`,
        },
        signal: ctl.signal,
      });
      const body = await safeJson<{ summary: string }>(r);

      if (r.ok && body) {
        setSummary(body.summary);
      } else {
        setSummary(`Error ${r.status}`);
      }
    } catch (e: unknown) {
      // Aborts also come here; show a gentle message
      const msg = errorMessage(e);
      setSummary(msg === "The user aborted a request." ? "Canceled." : msg);
    } finally {
      setLoading(false);
      setController(null);
      finishProgress();
    }
  }

  function cancelSummary() {
    controller?.abort();
    setController(null);
    setLoading(false);
    stopProgress();
    setProgress(0);
  }

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
      const r = await apiFetch(`${API_BASE}/documents/${id}`, {
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
      const r = await apiFetch(`${API_BASE}/documents/${id}`, {
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
  const canShare = doc.permission_level === "owner";

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-4">
      {/* Top trickle progress bar */}
      {progress > 0 && (
        <div className="h-1 w-full bg-slate-200 rounded overflow-hidden">
          <div
            className="h-1 bg-indigo-600 transition-[width] duration-200 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}

      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{title}</h1>
        <div className="flex gap-2">
          <Button onClick={() => navigate(`/doc/${doc.id}`)} type="button" variant="primary">
            Open editor
          </Button>
          {canShare && (
            <Button onClick={() => navigate(`/docs/${doc.id}/share`)} type="button" variant="secondary">
              Share
            </Button>
          )}
          {canShare && (
            <Button variant="danger" type="button" onClick={destroy}>
              Delete
            </Button>
          )}
        </div>
      </div>

      {msg && <div className="text-sm text-blue-700">{msg}</div>}

      <div className="text-xs text-gray-500">
        Owner: {doc.owner?.username} • Updated: {new Date(doc.updated_at).toLocaleString()}
      </div>

      <div className="space-y-3">
        <label className="block text-sm font-medium">Title</label>
        <input className="w-full border rounded p-2" value={title} onChange={(e) => setTitle(e.target.value)} />

        <label className="block text-sm font-medium">Description</label>
        <input className="w-full border rounded p-2" value={description} onChange={(e) => setDescription(e.target.value)} />

        <div className="flex items-center gap-2">
          <Button onClick={getSummary} disabled={loading} variant="primary">
            {loading ? (
              <span className="inline-flex items-center gap-2">
                <Spinner /> Summarizing…
              </span>
            ) : (
              "Summarize with your Cat Assistant!"
            )}
          </Button>
          {loading && (
            <Button onClick={cancelSummary} variant="ghost" type="button">
              Cancel
            </Button>
          )}
        </div>

        {/* Summary area with skeleton while loading */}
        < label className="block text-sm font-medium">Summary</label>
        <div className="mt-4 rounded border p-3 text-sm min-h-[3.5rem]">
          {loading && (
            <div className="animate-pulse space-y-2">
              <div className="h-2 rounded bg-slate-200 w-5/6" />
              <div className="h-2 rounded bg-slate-200 w-2/3" />
              <div className="h-2 rounded bg-slate-200 w-4/5" />
            </div>
          )}
          {!loading && summary && <div className="whitespace-pre-wrap">{summary}</div>}
          {!loading && !summary && <div className="text-slate-400">No summary yet.</div>}
        </div>

        <div className="flex gap-2">
          <Button disabled={saving} onClick={save} variant="secondary">
            {saving ? "Saving…" : "Save"}
          </Button>
          <Button onClick={() => navigate("/docs")} variant="ghost">
            Back to list
          </Button>
        </div>
      </div>
    </div>
  );
}

/** Simple Tailwind spinner (SVG) */
function Spinner() {
  return (
    <svg
      className="h-4 w-4 animate-spin"
      viewBox="0 0 24 24"
      aria-hidden="true"
      fill="none"
    >
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
      />
    </svg>
  );
}
