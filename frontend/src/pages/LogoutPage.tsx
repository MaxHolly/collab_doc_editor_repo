import React, { useEffect, useState } from "react";
import { API_BASE } from "../lib/env";
import { getAccessToken, clearTokens } from "../lib/auth";
import { useNavigate } from "react-router-dom";
import { safeJson } from "../lib/http";

type MsgResponse = { message?: string };

export default function LogoutPage() {
  const [msg, setMsg] = useState<string | null>("Logging out…");
  const navigate = useNavigate();

  useEffect(() => {
    (async () => {
      const access = getAccessToken();
      if (!access) {
        clearTokens();
        setMsg("No token found. Redirecting…");
        setTimeout(() => navigate("/login", { replace: true }), 700);
        return;
      }
      try {
        const r = await fetch(`${API_BASE}/logout`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${access}` },
        });
        clearTokens(); // always clear locally
        const data = await safeJson<MsgResponse>(r);
        if (!r.ok) {
          setMsg(data?.message ?? `Server returned ${r.status}. Redirecting…`);
        } else {
          setMsg("Logged out. Redirecting…");
        }
      } catch {
        // optional catch binding avoids "defined but never used"
        clearTokens();
        setMsg("Network error. Redirecting…");
      } finally {
        setTimeout(() => navigate("/login", { replace: true }), 700);
      }
    })();
  }, [navigate]);

  return (
    <div className="p-6">
      <p>{msg}</p>
    </div>
  );
}
