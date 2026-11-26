import { useSyncExternalStore } from "react";
import { isLiveSyncSocketConnected, subscribeLiveSyncConnection } from "../query/live-sync";

export function useLiveSyncConnection(): boolean {
  return useSyncExternalStore(subscribeLiveSyncConnection, isLiveSyncSocketConnected, () => false);
}