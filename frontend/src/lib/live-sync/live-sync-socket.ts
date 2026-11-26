import type { QueryClient } from "@tanstack/react-query";
import { io, type Socket } from "socket.io-client";
import { getAccessToken } from "../auth/session-store";
import { setLiveSyncSocketConnected } from "../query/live-sync";
import { applyLiveSyncInvalidation } from "./invalidate-query-keys";

const LIVE_SYNC_NAMESPACE = "/live-sync";
const LIVE_SYNC_EVENT = "invalidate";

let socket: Socket | null = null;
let activeQueryClient: QueryClient | null = null;

function resolveSocketOrigin(): string {
  const fromEnv = import.meta.env.VITE_API_BASE_URL;
  if (typeof fromEnv === "string" && fromEnv.length > 0) {
    return fromEnv.replace(/\/$/, "");
  }
  return window.location.origin;
}

function bindSocketHandlers(client: Socket, queryClient: QueryClient): void {
  client.on("connect", () => {
    setLiveSyncSocketConnected(true);
    void queryClient.invalidateQueries();
  });
  client.on("disconnect", () => {
    setLiveSyncSocketConnected(false);
  });
  client.on(LIVE_SYNC_EVENT, (payload: { keys?: string[] }) => {
    const keys = payload?.keys;
    if (!Array.isArray(keys) || keys.length === 0) {
      return;
    }
    applyLiveSyncInvalidation(queryClient, keys);
  });
  client.on("connect_error", () => {
    setLiveSyncSocketConnected(false);
  });
}

export function connectLiveSyncSocket(queryClient: QueryClient): () => void {
  activeQueryClient = queryClient;
  const token = getAccessToken();
  if (!token) {
    return () => undefined;
  }

  if (socket) {
    socket.removeAllListeners();
    socket.disconnect();
    socket = null;
    setLiveSyncSocketConnected(false);
  }

  socket = io(`${resolveSocketOrigin()}${LIVE_SYNC_NAMESPACE}`, {
    path: "/socket.io",
    auth: { token },
    transports: ["websocket", "polling"],
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1_000,
    reconnectionDelayMax: 5_000,
  });

  bindSocketHandlers(socket, queryClient);

  return () => {
    disconnectLiveSyncSocket();
  };
}

export function disconnectLiveSyncSocket(): void {
  if (socket) {
    socket.removeAllListeners();
    socket.disconnect();
    socket = null;
  }
  setLiveSyncSocketConnected(false);
  activeQueryClient = null;
}

export function reconnectLiveSyncSocketWithFreshToken(): void {
  if (!activeQueryClient) {
    return;
  }
  connectLiveSyncSocket(activeQueryClient);
}