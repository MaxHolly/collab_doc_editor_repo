import React from "react";
import { Link } from "react-router-dom";
import { isAuthed } from "../lib/auth";

export default function Home() {
  const authed = isAuthed();
  return (
    <div className="max-w-2xl mx-auto p-6 space-y-4">
      <h1 className="text-3xl font-bold">Collaborative Editor</h1>
      <div className="space-x-3">
        {!authed ? (
          <>
            <Link to="/register" className="text-blue-600 hover:underline">Register</Link>
            <Link to="/login" className="text-blue-600 hover:underline">Login</Link>
          </>
        ) : (
          <>
            <Link to="/refresh" className="text-blue-600 hover:underline">Refresh token</Link>
            <Link to="/logout" className="text-blue-600 hover:underline">Logout</Link>
            <Link to="/docs" className="text-blue-600 hover:underline">List Docs</Link>
          </>
        )}
      </div>
      <p className="text-sm text-gray-600">
        Once logged in, open a doc route like <code className="px-1 py-0.5 bg-gray-100 rounded">/doc/1</code>.
      </p>
    </div>
  );
}
