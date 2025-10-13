import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import Button from "../ui/Button";
import { isAuthed, getAccessToken } from "../../lib/auth";
import { API_BASE } from "../../lib/env";
import { safeJson } from "../../lib/http";
import { getAppSocket } from "../../lib/socket";

type SharedDoc = {
  id: number;
  title: string;
  updated_at: string;
  permission_level: "viewer" | "editor" | "owner";
  owner: { id: number; username?: string; email?: string };
};

type OverviewResponse = {
  mine: unknown[];
  shared_with_me: SharedDoc[];
};

type NotifyEvent =
  | {
      type: "share_added";
      doc_id: number;
      title: string;
      permission_level: "viewer" | "editor";
      by_user_id: number;
    }
  | {
      type: "share_role_changed";
      doc_id: number;
      title: string;
      permission_level: "viewer" | "editor";
      by_user_id: number;
      target_user_id: number;
    }
  | {
      type: "ownership_gained";
      doc_id: number;
      title: string;
      by_user_id: number;
    }
  | {
      type: "ownership_lost";
      doc_id: number;
      title: string;
      by_user_id: number;
    }
  | {
      type: "share_removed";
      doc_id: number;
      by_user_id: number;
    };

export default function Navbar() {
  const authed = isAuthed();
  const nav = useNavigate();
  const loc = useLocation();

  const [open, setOpen] = useState(false);
  const [shared, setShared] = useState<SharedDoc[]>([]);
  // Separate "unseen notifications" list (doc IDs). These can be dismissed individually.
  const [unseenIds, setUnseenIds] = useState<number[]>([]);

  const unseenCount = useMemo(() => unseenIds.length, [unseenIds]);

  async function refreshSharedOverview() {
    const access = getAccessToken();
    if (!access) return;
    const r = await fetch(`${API_BASE}/documents/overview`, {
      headers: { Authorization: `Bearer ${access}` },
    });
    const data = await safeJson<OverviewResponse>(r);
    if (r.ok && data) {
      setShared(data.shared_with_me || []);
      // Do not auto-clear unseen on refresh; we want explicit user dismissal
    }
  }

  // Initial load + socket wiring
  useEffect(() => {
    if (!authed) return;

    // 1) Load initial list
    refreshSharedOverview();

    // 2) Ensure a single global socket and wire listeners
    const s = getAppSocket(); // forces connection if not already
    if (!s) return;

    const onNotify = (evt: NotifyEvent) => {
      setShared((prev: SharedDoc[]) => {
        switch (evt.type) {
          case "share_added": {
            // Upsert
            const exists = prev.find((d) => d.id === evt.doc_id);
            if (exists) {
              // Update title/permission
              const next = prev.map((d) =>
                d.id === evt.doc_id
                  ? { ...d, title: evt.title, permission_level: evt.permission_level }
                  : d
              );
              return next;
            }
            // Create minimal doc; owner is who shared with you (by_user_id)
            const newDoc: SharedDoc = {
              id: evt.doc_id,
              title: evt.title,
              updated_at: new Date().toISOString(),
              permission_level: evt.permission_level,
              owner: { id: evt.by_user_id }, // we may enrich on next overview refresh
            };
            return [newDoc, ...prev];
          }

          case "share_role_changed": {
            const hasIt = prev.some((d) => d.id === evt.doc_id);
            if (!hasIt) {
              // If we don't have it, sync from server
              void refreshSharedOverview();
              return prev;
            }
            return prev.map((d) =>
              d.id === evt.doc_id ? { ...d, title: evt.title, permission_level: evt.permission_level } : d
            );
          }

          case "share_removed":
          case "ownership_gained": {
            // No longer in "shared with me"
            return prev.filter((d) => d.id !== evt.doc_id);
          }

          case "ownership_lost": {
            // Might now appear in shared list; refresh
            void refreshSharedOverview();
            return prev;
          }

          default:
            return prev;
        }
      });

      // Maintain unseen IDs (badge + closable notifications).
      setUnseenIds((prev) => {
        switch (evt.type) {
          case "share_added":
          case "share_role_changed":
          case "ownership_lost": {
            // Add if not already present
            return prev.includes(evt.doc_id) ? prev : [evt.doc_id, ...prev];
          }
          case "share_removed":
          case "ownership_gained": {
            // Remove if present
            return prev.filter((id) => id !== evt.doc_id);
          }
          default:
            return prev;
        }
      });
    };

    const onConnect = () => {
      // When socket connects/reconnects, align with server
      void refreshSharedOverview();
    };

    s.on("connect", onConnect);
    s.on("notify", onNotify);

    return () => {
      s.off("connect", onConnect);
      s.off("notify", onNotify);
    };
  }, [authed]);

  // Close dropdown on route change
  useEffect(() => setOpen(false), [loc.pathname]);

  function dismissOne(docId: number) {
    setUnseenIds((prev) => prev.filter((id) => id !== docId));
  }
  function markAllRead() {
    setUnseenIds([]);
  }

  // Resolve doc info for unseen list
  const unseenDocs: SharedDoc[] = useMemo(() => {
    const byId = new Map(shared.map((d) => [d.id, d]));
    return unseenIds
      .map((id) => byId.get(id))
      .filter((d): d is SharedDoc => Boolean(d));
  }, [shared, unseenIds]);

  return (
    <div className="sticky top-0 z-40 border-b bg-white/80 backdrop-blur">
      <div className="container mx-auto px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link to="/" className="text-lg font-semibold text-slate-900">
            ✨ CollabDocs
          </Link>
          {authed && (
            <>
              <Link to="/docs" className="text-sm text-slate-600 hover:text-slate-900">
                Documents
              </Link>
              <Link to="/docs/new" className="text-sm text-slate-600 hover:text-slate-900">
                New
              </Link>
            </>
          )}
        </div>

        <div className="flex items-center gap-2">
          {authed && (
            <div className="relative">
              <Button
                variant="ghost"
                onClick={() => setOpen((o) => !o)}
                aria-label="Notifications"
              >
                <span className="relative inline-flex">
                  🔔
                  {unseenCount > 0 && (
                    <span className="absolute -top-2 -right-2 inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-rose-600 px-1 text-[10px] font-semibold text-white">
                      {unseenCount}
                    </span>
                  )}
                </span>
              </Button>

              <AnimatePresence>
                {open && (
                  <motion.div
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    className="absolute right-0 mt-2 w-80 rounded-xl border bg-white shadow-lg"
                  >
                    {/* Notifications section */}
                    <div className="p-3 flex items-center justify-between">
                      <div className="text-sm font-medium">Notifications</div>
                      {unseenCount > 0 && (
                        <button
                          className="text-xs text-slate-500 hover:text-slate-700"
                          onClick={markAllRead}
                        >
                          Mark all read
                        </button>
                      )}
                    </div>
                    <div className="max-h-64 overflow-auto divide-y">
                      {unseenCount === 0 ? (
                        <div className="p-3 text-sm text-slate-500">No new notifications.</div>
                      ) : (
                        unseenDocs.map((d) => (
                          <div key={d.id} className="p-3 flex items-start gap-2 hover:bg-slate-50">
                            <div className="flex-1">
                              <Link to={`/docs/${d.id}`} className="block">
                                <div className="text-sm font-medium">
                                  {d.title || "Untitled"}
                                </div>
                                <div className="text-xs text-slate-500">
                                  Owner: {d.owner.username || d.owner.email || d.owner.id} · Your role:{" "}
                                  {d.permission_level}
                                </div>
                              </Link>
                            </div>
                            <button
                                className="text-slate-400 hover:text-slate-700 text-sm"
                                aria-label="Dismiss"
                                onClick={(e) => { e.preventDefault(); e.stopPropagation(); dismissOne(d.id); }}
                                title="Dismiss"
                            >
                                x
                            </button>
                          </div>
                        ))
                      )}
                    </div>

                    <div className="p-2 text-right">
                      <Button variant="ghost" onClick={() => setOpen(false)}>
                        Close
                      </Button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}

          {!authed ? (
            <>
              <Button variant="secondary" onClick={() => nav("/login")}>
                Login
              </Button>
              <Button onClick={() => nav("/register")}>Register</Button>
            </>
          ) : (
            <Button variant="secondary" onClick={() => nav("/logout")}>
              Logout
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
