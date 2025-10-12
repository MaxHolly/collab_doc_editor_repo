import { io, Socket } from "socket.io-client";
import { SOCKET_URL } from "./env";
import { getAccessToken, isTokenExpired, logoutAndRedirect } from "./auth";

let socket: Socket | null = null;

type ServerErrorPayload = {
  message?: string;
};

type ClientDisconnectReason =
  | "io server disconnect"
  | "io client disconnect"
  | "ping timeout"
  | "transport close"
  | "transport error"
  | "parse error";

export function getAppSocket(): Socket | null {
  if (socket) return socket;

  const token = getAccessToken();
  if (!token) return null;

  // Proactive client-side expiry check
  if (isTokenExpired(token)) {
    logoutAndRedirect("expired");
    return null;
  }

  socket = io(SOCKET_URL || window.location.origin, {
    query: { token },
    withCredentials: false,
    autoConnect: true,
    reconnection: true,
  });

  // Server rejected handshake (often expired/invalid token)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  socket.on("connect_error", (_err: Error) => {
    const t = getAccessToken();
    if (!t || isTokenExpired(t)) {
      logoutAndRedirect("expired");
    } else {
      logoutAndRedirect("invalid");
    }
  });

  // Backend may emit "error" events like { message: "unauthenticated" }
  socket.on("error", (payload: ServerErrorPayload) => {
    const msg = payload?.message ?? "";
    if (/unauthenticated|invalid token|expired/i.test(msg)) {
      logoutAndRedirect("expired");
    }
  });

  socket.on("disconnect", (reason: ClientDisconnectReason) => {
    // If server explicitly disconnected us, check token status
    if (reason === "io server disconnect") {
      const t = getAccessToken();
      if (!t || isTokenExpired(t)) logoutAndRedirect("expired");
    }
  });

  return socket;
}

// helpful if you log out
export function closeAppSocket(): void {
  try {
    socket?.disconnect();
  } finally {
    socket = null;
  }
}
