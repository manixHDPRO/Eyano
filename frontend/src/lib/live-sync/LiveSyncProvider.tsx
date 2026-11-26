import { useQueryClient } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { useEffect } from "react";
import { onAccessTokenCleared } from "../auth/session-store";
import { useAuth } from "../../modules/auth/AuthProvider";
import { connectLiveSyncSocket, disconnectLiveSyncSocket } from "./live-sync-socket";

type LiveSyncProviderProps = {
  children: ReactNode;
};

export function LiveSyncProvider({ children }: LiveSyncProviderProps) {
  const { user, ready } = useAuth();
  const queryClient = useQueryClient();

  useEffect(() => {
    const unsubscribe = onAccessTokenCleared(() => {
      disconnectLiveSyncSocket();
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!ready || !user) {
      disconnectLiveSyncSocket();
      return undefined;
    }
    return connectLiveSyncSocket(queryClient);
  }, [ready, user?.id, queryClient]);

  return children;
}