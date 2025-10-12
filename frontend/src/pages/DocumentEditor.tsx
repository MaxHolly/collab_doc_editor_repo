import React, { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import Button from "../components/ui/Button";
import Quill from "quill";
import { io, Socket } from "socket.io-client";
import "quill/dist/quill.snow.css";

import { getAccessToken } from "../lib/auth";
import { SOCKET_URL } from "../lib/env";

type QuillContent = Parameters<Quill["setContents"]>[0];

type LoadEvent = { title: string; description?: string; content: QuillContent | null };
type UpdatedEvent = { document_id: number; content: QuillContent; by_user_id: number };

export default function DocumentEditor() {
  const { docId } = useParams<{ docId: string }>();
  const navigate = useNavigate();

  const editorElRef = useRef<HTMLDivElement | null>(null);
  const quillRef = useRef<Quill | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const applyingRemoteRef = useRef(false);

  // If load arrives before Quill is created, stash it here
  const pendingContentRef = useRef<QuillContent | null>(null);

  const [title, setTitle] = useState("");
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);

  // 1) Initialize Quill as soon as the div exists
  useEffect(() => {
    if (!editorElRef.current || quillRef.current) return;

    const q = new Quill(editorElRef.current, {
      theme: "snow",
      placeholder: "Start writing your deep thoughts here...",
      modules: {
        toolbar: [
          [{ header: [1, 2, 3, false] }],
          ["bold", "italic", "underline", "strike"],
          [{ list: "ordered" }, { list: "bullet" }],
          ["link", "image"],
          ["clean"],
        ],
      },
    });

    // local edits → broadcast full delta
    q.on("text-change", (_delta, _old, source) => {
      if (source !== "user" || applyingRemoteRef.current) return;
      const full = q.getContents();
      socketRef.current?.emit("document_change", {
        document_id: Number(docId),
        content: full,
      });
    });

    quillRef.current = q;

    // If server content arrived earlier, apply it now
    if (pendingContentRef.current) {
      applyingRemoteRef.current = true;
      q.setContents(pendingContentRef.current);
      const len = q.getLength();
      q.setSelection(len, 0, "silent");
      q.focus();
      applyingRemoteRef.current = false;
      pendingContentRef.current = null;
    }
  }, [docId]);

  // 2) Connect socket & wire events
  useEffect(() => {
    const token = getAccessToken();
    const idNum = Number(docId);

    if (!docId || !Number.isFinite(idNum)) {
      setMsg("Invalid document ID.");
      setLoading(false);
      navigate("/docs");
      return;
    }
    if (!token) {
      setMsg("You must be logged in.");
      setLoading(false);
      navigate("/login");
      return;
    }

    const s = io(SOCKET_URL || window.location.origin, {
      query: { token },
      withCredentials: false,
      // leave transports unspecified; socket.io will negotiate
    });
    socketRef.current = s;

    s.on("connect_error", (err) => {
      setMsg("Connection error: " + err.message);
      setLoading(false);
    });

    s.on("connect", () => {
      s.emit("join_document", { document_id: idNum });
    });

    s.on("load_document_content", (data: LoadEvent) => {
      setTitle(data.title ?? "");
      const content: QuillContent = data.content ?? [];

      if (quillRef.current) {
        applyingRemoteRef.current = true;
        quillRef.current.setContents(content);
        const len = quillRef.current.getLength();
        quillRef.current.setSelection(len, 0, "silent");
        quillRef.current.focus();
        applyingRemoteRef.current = false;
      } else {
        // Quill not ready yet; apply later
        pendingContentRef.current = content;
      }
      setLoading(false);
    });

    s.on("document_updated", (data: UpdatedEvent) => {
      if (!quillRef.current) {
        pendingContentRef.current = data.content;
        return;
      }
      applyingRemoteRef.current = true;
      quillRef.current.setContents(data.content);
      applyingRemoteRef.current = false;
    });

    s.on("error", (data: { message?: string }) => {
      setMsg(data?.message || "An error occurred.");
      setLoading(false);
    });

    return () => {
      s.emit("leave_document", { document_id: idNum });
      s.disconnect();
      socketRef.current = null;
    };
  }, [docId, navigate]);


  return (
    <div className="max-w-4xl mx-auto p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl sm:text-2xl font-semibold">{title || "Untitled"}</h1>
        <Button
          onClick={() => navigate(`/docs/${docId}`)}
          variant="ghost"
        >
          Back to details
        </Button>
      </div>

      {loading && <div className="text-sm text-gray-500">Loading document…</div>}
      {msg && <div className="text-sm text-red-600">{msg}</div>}

      <div ref={editorElRef} className="h-[480px] border rounded bg-white" />
    </div>
  );
}
