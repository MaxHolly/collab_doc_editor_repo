import { API_BASE } from "./env";
import { getAccessToken } from "./auth";
import { safeJson } from "./http";

export type UserSummary = {
  id: number;
  username: string;
  email: string;
};

export async function searchUsers(query: string): Promise<UserSummary[]> {
    const access = getAccessToken();
    const r = await fetch(`${API_BASE}/users/search?q=${encodeURIComponent(query)}`, {
      headers: { 
        "Content-Type": "application/json",
        Authorization: `Bearer ${access}` },
    });
    if (!r.ok) return [];
    return (await safeJson<UserSummary[]>(r)) ?? [];
}
