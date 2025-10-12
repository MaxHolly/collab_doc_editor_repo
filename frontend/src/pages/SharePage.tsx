import React, { useEffect, useMemo, useState } from "react";
import {
  listCollaborators,
  addCollaboratorByEmail,
  changeCollaboratorRole,
  removeCollaborator,
  transferOwnership
} from "../lib/share";
import type { Collaborator, PermissionLevel } from "../lib/share";
import { useNavigate, useParams } from "react-router-dom";
import { errorMessage } from "../lib/errors";
import { searchUsers } from "../lib/users";
import type { UserSummary } from "../lib/users";
import Button from "../components/ui/Button";

export default function SharePage() {
  const { docId } = useParams<{ docId: string }>();
  const docIdNum = Number(docId);
  const navigate = useNavigate();

  const [collabs, setCollabs] = useState<Collaborator[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  // add-by-email state
  const [email, setEmail] = useState("");
  const [newLevel, setNewLevel] = useState<Exclude<PermissionLevel, "owner">>("viewer");
  const [suggestions, setSuggestions] = useState<UserSummary[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  const isOwner = useMemo(
    () => collabs.some((c) => c.permission_level === "owner"),
    [collabs]
  );

  useEffect(() => {
    if (!docIdNum) {
      navigate("/docs");
      return;
    }
    (async () => {
      try {
        const rows = await listCollaborators(docIdNum);
        setCollabs(rows);
      } catch (e) {
        setMsg(errorMessage(e));
      }
    })();
  }, [docIdNum, navigate]);

  // Debounced email search
  useEffect(() => {
    let t: number | undefined;
    (async () => {
      const q = email.trim();
      if (q.length < 2) {
        setSuggestions([]);
        return;
      }
      t = window.setTimeout(async () => {
        try {
          const results = await searchUsers(q);
          setSuggestions(results);
          setShowSuggestions(true);
        } catch {
          setSuggestions([]);
        }
      }, 250);
    })();
    return () => clearTimeout(t);
  }, [email]);

  function pickSuggestion(u: UserSummary) {
    setEmail(u.email);
    setShowSuggestions(false);
  }

  async function onAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;

    setBusy(true);
    setMsg(null);
    try {
      await addCollaboratorByEmail(docIdNum, email.trim(), newLevel);
      const rows = await listCollaborators(docIdNum);
      setCollabs(rows);
      setEmail("");
      setSuggestions([]);
      setShowSuggestions(false);
    } catch (e) {
      setMsg(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  async function onChangeRole(
    targetId: number,
    level: Exclude<PermissionLevel, "owner">
  ) {
    setBusy(true);
    setMsg(null);
    try {
      await changeCollaboratorRole(docIdNum, targetId, level);
      const rows = await listCollaborators(docIdNum);
      setCollabs(rows);
    } catch (e) {
      setMsg(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  async function onRemove(targetId: number) {
    setBusy(true);
    setMsg(null);
    try {
      await removeCollaborator(docIdNum, targetId);
      setCollabs((cs) => cs.filter((c) => c.user_id !== targetId));
    } catch (e) {
      setMsg(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  async function onTransfer(newOwnerId: number) {
    setBusy(true);
    setMsg(null);
    try {
      await transferOwnership(docIdNum, newOwnerId);
      const rows = await listCollaborators(docIdNum);
      setCollabs(rows);
    } catch (e) {
      setMsg(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl sm:text-2xl font-semibold">Share document</h1>
        <Button
          onClick={() => navigate(`/docs/${docId}`)}
          variant="ghost"
        >
          Back to details
        </Button>
      </div>

      {msg && <div className="text-sm text-red-600">{msg}</div>}

      {/* Add collaborator by email */}
      <form onSubmit={onAdd} className="flex flex-col gap-2 sm:flex-row sm:items-end">
        <div className="flex-1 relative">
          <label className="block text-sm font-medium">User email</label>
          <input
            className="w-full border rounded p-2"
            placeholder="user@example.com"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              setShowSuggestions(true);
            }}
            onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
            disabled={!isOwner || busy}
            type="email"
          />
          {showSuggestions && suggestions.length > 0 && (
            <div className="absolute z-10 w-full bg-white border rounded mt-1 shadow">
              {suggestions.map((u) => (
                <button
                  key={u.id}
                  type="button"
                  className="w-full text-left px-3 py-2 hover:bg-gray-50"
                  onClick={() => pickSuggestion(u)}
                >
                  <div className="font-medium">{u.email}</div>
                  <div className="text-xs text-gray-500">{u.username}</div>
                </button>
              ))}
            </div>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium">Permission</label>
          <select
            className="border rounded px-2 py-2"
            value={newLevel}
            onChange={(e) => setNewLevel(e.target.value as "viewer" | "editor")}
            disabled={!isOwner || busy}
          >
            <option value="viewer">viewer</option>
            <option value="editor">editor</option>
          </select>
        </div>

        <button
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-60"
          disabled={!isOwner || busy || !email.trim()}
        >
          Add
        </button>
      </form>

      {/* Collaborators table */}
      <div className="border rounded">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left px-3 py-2">User</th>
              <th className="text-left px-3 py-2">Email</th>
              <th className="text-left px-3 py-2">Role</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {collabs.map((c) => (
              <tr key={c.user_id} className="border-t">
                <td className="px-3 py-2">{c.username}</td>
                <td className="px-3 py-2">{c.email}</td>
                <td className="px-3 py-2">
                  {c.permission_level === "owner" ? (
                    <span className="px-2 py-1 rounded bg-gray-100">owner</span>
                  ) : (
                    <select
                      className="border rounded px-2 py-1"
                      value={c.permission_level}
                      onChange={(e) =>
                        onChangeRole(
                          c.user_id,
                          e.target.value as Exclude<PermissionLevel, "owner">
                        )
                      }
                      disabled={!isOwner || busy}
                    >
                      <option value="viewer">viewer</option>
                      <option value="editor">editor</option>
                    </select>
                  )}
                </td>
                <td className="px-3 py-2 text-right">
                  {isOwner && c.permission_level !== "owner" && (
                    <div className="flex gap-2 justify-end">
                      <button
                        className="px-2 py-1 border rounded hover:bg-gray-50"
                        onClick={() => onRemove(c.user_id)}
                        disabled={busy}
                      >
                        Remove
                      </button>
                      <button
                        className="px-2 py-1 border rounded hover:bg-gray-50"
                        onClick={() => onTransfer(c.user_id)}
                        disabled={busy}
                      >
                        Make owner
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
            {collabs.length === 0 && (
              <tr>
                <td className="px-3 py-4 text-gray-500" colSpan={4}>
                  No collaborators yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
