import { io, Socket } from "socket.io-client";
import { SOCKET_URL } from "./env";
import { getAccessToken, isTokenExpired, logoutAndRedirect } from "./auth";

let socket: Socket | null = null;

type ServerErrorPayload = { message?: string };
type ClientDisconnectReason =
  | "io server disconnect"
  | "io client disconnect"
  | "ping timeout"
  | "transport close"
  | "transport error"
  | "parse error";

export function refreshSocketAuth(): void {
  if (!socket) return;
  const t = getAccessToken();
  if (t) (socket.io.opts.query as Record<string, string>) = { token: t };
}

export function getAppSocket(): Socket | null {
  if (socket) return socket;

  const token = getAccessToken();
  if (!token) return null;
  if (isTokenExpired(token)) {
    logoutAndRedirect("expired");
    return null;
  }

  socket = io(SOCKET_URL || window.location.origin, {
    path: "/socket.io",                // must match nginx location
    transports: ["websocket", "polling"],
    query: { token },
    withCredentials: false,
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 500,
    reconnectionDelayMax: 5000,
    timeout: 20000,
    autoConnect: true,
    forceNew: false,
  });

  // Always refresh the token used for the next attempt
  socket.io.on("reconnect_attempt", () => refreshSocketAuth());

  // IMPORTANT: do NOT log the user out just because the socket can't connect.
  // Network/proxy hiccups are common; let API auth be the source of truth.
  socket.on("connect_error", () => {
    // no redirect here
    // you can console.warn if you like
  });

  // Only log out if the server *tells us* we're unauthenticated
  socket.on("error", (payload: ServerErrorPayload) => {
    const msg = payload?.message ?? "";
    if (/unauthenticated|invalid token|expired/i.test(msg)) {
      logoutAndRedirect("expired");
    }
  });

  socket.on("disconnect", (reason: ClientDisconnectReason) => {
    if (reason === "io server disconnect") {
      const t = getAccessToken();
      if (!t || isTokenExpired(t)) logoutAndRedirect("expired");
    }
  });

  return socket;
}

export function closeAppSocket(): void {
  try { socket?.disconnect(); } finally { socket = null; }
}
