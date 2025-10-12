import React, { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import Button from "../ui/Button";
import { isAuthed, getAccessToken } from "../../lib/auth";
import { API_BASE } from "../../lib/env";
import { safeJson } from "../../lib/http";

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

const SEEN_KEY = "shared_seen_ids";

function useSharedNotifications() {
  const [shared, setShared] = useState<SharedDoc[]>([]);
  const [loading, setLoading] = useState(false);

  const seenIds = useMemo<number[]>(
    () => JSON.parse(localStorage.getItem(SEEN_KEY) || "[]"),
    []
  );

  const unseenCount = shared.filter((d) => !seenIds.includes(d.id)).length;

  async function load() {
    const access = getAccessToken();
    if (!access) return;
    setLoading(true);
    try {
      const r = await fetch(`${API_BASE}/documents/overview`, {
        headers: { Authorization: `Bearer ${access}` },
      });
      const data = await safeJson<OverviewResponse>(r);
      if (r.ok && data) setShared(data.shared_with_me || []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    const id = setInterval(load, 30_000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function markAllSeen() {
    const ids = Array.from(new Set([...(shared.map((d) => d.id)), ...seenIds]));
    localStorage.setItem(SEEN_KEY, JSON.stringify(ids));
  }

  return { shared, unseenCount, loading, markAllSeen };
}

export default function Navbar() {
  const authed = isAuthed();
  const nav = useNavigate();
  const loc = useLocation();
  const [open, setOpen] = useState(false);
  const { shared, unseenCount, markAllSeen } = useSharedNotifications();

  // Close dropdown on route change
  useEffect(() => setOpen(false), [loc.pathname]);

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
              <Button variant="ghost" onClick={() => { setOpen((o) => !o); if (!open) markAllSeen(); }}>
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
                    className="absolute right-0 mt-2 w-72 rounded-xl border bg-white shadow-lg"
                  >
                    <div className="p-3 text-sm font-medium">Shared with you</div>
                    <div className="max-h-80 overflow-auto divide-y">
                      {shared.length === 0 ? (
                        <div className="p-3 text-sm text-slate-500">No shared documents yet.</div>
                      ) : (
                        shared.slice(0, 8).map((d) => (
                          <Link
                            to={`/docs/${d.id}`}
                            key={d.id}
                            className="block p-3 hover:bg-slate-50"
                          >
                            <div className="text-sm font-medium">{d.title || "Untitled"}</div>
                            <div className="text-xs text-slate-500">
                              Owner: {d.owner.username || d.owner.email || d.owner.id} · Your role: {d.permission_level}
                            </div>
                          </Link>
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
              <Button variant="secondary" onClick={() => nav("/login")}>Login</Button>
              <Button onClick={() => nav("/register")}>Register</Button>
            </>
          ) : (
            <Button variant="secondary" onClick={() => nav("/logout")}>Logout</Button>
          )}
        </div>
      </div>
    </div>
  );
}
