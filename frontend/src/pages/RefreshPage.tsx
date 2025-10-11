import React, { useState } from "react";
import { API_BASE } from "../lib/env";
import { getRefreshToken, setTokens, getAccessToken } from "../lib/auth";
import { errorMessage } from "../lib/errors";
import { safeJson } from "../lib/http";

type RefreshResponse = { access_token?: string; message?: string };

export default function RefreshPage() {
  const [msg, setMsg] = useState<string | null>(null);

  async function refreshNow() {
    const refresh = getRefreshToken();
    if (!refresh) {
      setMsg("No refresh token stored.");
      return;
    }
    try {
      const r = await fetch(`${API_BASE}/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${refresh}` },
      });
      const data = (await safeJson<RefreshResponse>(r)) ?? {};
      if (!r.ok) {
        setMsg(data.message ?? `Error ${r.status}`);
      } else if (data.access_token) {
        setTokens(data.access_token, refresh, localStorage.getItem("user_id") || "0");
        setMsg("Access token refreshed.");
      } else {
        setMsg("Malformed response from server.");
      }
    } catch (e: unknown) {
      setMsg(errorMessage(e));
    }
  }

  return (
    <div className="max-w-md mx-auto p-6 space-y-3">
      <h1 className="text-2xl font-bold">Refresh Access Token</h1>
      <button className="bg-emerald-600 text-white px-3 py-2 rounded hover:bg-emerald-700" onClick={refreshNow}>
        Refresh now
      </button>
      {msg && <div className="text-sm text-blue-700">{msg}</div>}
      <pre className="text-xs bg-gray-50 p-2 rounded overflow-auto">access: {getAccessToken() || "(none)"}</pre>
    </div>
  );
}
