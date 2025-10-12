const isProduction = import.meta.env.PROD;
export const API_BASE =
  (import.meta.env.VITE_API_BASE as string | undefined) ||
  (isProduction ? "/api" : "http://localhost:8000/api");export const WS_ORIGIN = import.meta.env.VITE_WS_ORIGIN || "";
export const SOCKET_URL =
  (import.meta.env.VITE_SOCKET_URL as string | undefined) ||
  (isProduction ? "" : "http://localhost:8000");
export const WS_PATH = import.meta.env.VITE_WS_PATH || "/socket.io";
