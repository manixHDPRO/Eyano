/** Racines de clés React Query à rafraîchir côté client (queryKey[0]). */
export type LiveSyncQueryRoot = string;

export type LiveSyncInvalidatePayload = {
  keys: LiveSyncQueryRoot[];
  at: string;
};

export const LIVE_SYNC_EVENT = "invalidate" as const;