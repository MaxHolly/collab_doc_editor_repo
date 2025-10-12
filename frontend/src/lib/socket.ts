import { io, Socket } from "socket.io-client";
import { SOCKET_URL } from "./env";
import { getAccessToken } from "./auth";

let socket: Socket | null = null;

export function getAppSocket(): Socket | null {
  if (socket) return socket;
  const token = getAccessToken();
  if (!token) return null;

  socket = io(SOCKET_URL || window.location.origin, {
    query: { token },
    withCredentials: false,
  });

  socket.on("disconnect", () => {
    // keep instance; it will auto-reconnect when token still valid
  });

  return socket;
}

// helpful if you log out
export function closeAppSocket() {
  try {
    socket?.disconnect();
  } finally {
    socket = null;
  }
}