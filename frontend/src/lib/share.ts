import { API_BASE } from "./env";
import { getAccessToken } from "./auth";
import { safeJson } from "./http";

export type PermissionLevel = "viewer" | "editor" | "owner";

export type Collaborator = {
  user_id: number;
  username: string;
  email: string;
  permission_level: PermissionLevel;
};

export async function listCollaborators(docId: number): Promise<Collaborator[]> {
  const access = getAccessToken();
  const r = await fetch(`${API_BASE}/documents/${docId}/collaborators`, {
    headers: { Authorization: `Bearer ${access}` },
  });
  // if 403/404, safeJson will still parse into something or return null
  const data = (await safeJson<Collaborator[] | { message?: string }>(r)) ?? [];
  if (!r.ok) {
    const msg = `Error ${r.status}`;
    throw new Error(msg);
  }
  return data as Collaborator[];
}

export async function addCollaborator(
  docId: number,
  userId: number,
  level: Exclude<PermissionLevel, "owner"> // API only allows viewer/editor here
): Promise<void> {
  const access = getAccessToken();
  const r = await fetch(`${API_BASE}/documents/${docId}/collaborators`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${access}` },
    body: JSON.stringify({ user_id: userId, permission_level: level }),
  });
  const data = await safeJson<{ message?: string }>(r);
  if (!r.ok) throw new Error(data?.message ?? `Error ${r.status}`);
}

export async function addCollaboratorByEmail(
  docId: number,
  email: string,
  level: Exclude<PermissionLevel, "owner">
): Promise<void> {
  const access = getAccessToken();
  const r = await fetch(`${API_BASE}/documents/${docId}/collaborators`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${access}` },
    body: JSON.stringify({ email, permission_level: level }),
  });
  if (!r.ok) {
    const data = await safeJson<{ message?: string }>(r);
    throw new Error(data?.message ?? `Failed to add collaborator (${r.status})`);
  }
}

export async function changeCollaboratorRole(
  docId: number,
  targetId: number,
  level: Exclude<PermissionLevel, "owner">
): Promise<void> {
  const access = getAccessToken();
  const r = await fetch(`${API_BASE}/documents/${docId}/collaborators/${targetId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${access}` },
    body: JSON.stringify({ permission_level: level }),
  });
  const data = await safeJson<{ message?: string }>(r);
  if (!r.ok) throw new Error(data?.message ?? `Error ${r.status}`);
}

export async function removeCollaborator(docId: number, targetId: number): Promise<void> {
  const access = getAccessToken();
  const r = await fetch(`${API_BASE}/documents/${docId}/collaborators/${targetId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${access}` },
  });
  if (!r.ok) {
    const data = await safeJson<{ message?: string }>(r);
    throw new Error(data?.message ?? `Error ${r.status}`);
  }
}

export async function transferOwnership(docId: number, newOwnerId: number): Promise<void> {
  const access = getAccessToken();
  const r = await fetch(`${API_BASE}/documents/${docId}/transfer_ownership`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${access}` },
    body: JSON.stringify({ user_id: newOwnerId }),
  });
  const data = await safeJson<{ message?: string }>(r);
  if (!r.ok) throw new Error(data?.message ?? `Error ${r.status}`);
}
