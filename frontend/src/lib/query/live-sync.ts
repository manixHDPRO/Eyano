/** Polling hors WebSocket — listes / tableaux de bord (ms). */
export const LIVE_SYNC_INTERVAL_MS = 3_000;

/** Polling hors WebSocket — caisse et alertes (ms). */
export const LIVE_SYNC_POS_INTERVAL_MS = 2_000;

/** Filet de sécurité quand le socket est connecté (ms). */
export const LIVE_SYNC_FALLBACK_INTERVAL_MS = 60_000;

let liveSyncSocketConnected = false;
const connectionListeners = new Set<(connected: boolean) => void>();

export function setLiveSyncSocketConnected(connected: boolean): void {
  if (liveSyncSocketConnected === connected) {
    return;
  }
  liveSyncSocketConnected = connected;
  for (const listener of connectionListeners) {
    listener(connected);
  }
}

export function isLiveSyncSocketConnected(): boolean {
  return liveSyncSocketConnected;
}

export function subscribeLiveSyncConnection(listener: (connected: boolean) => void): () => void {
  connectionListeners.add(listener);
  listener(liveSyncSocketConnected);
  return () => {
    connectionListeners.delete(listener);
  };
}

/** Données considérées périmées : refocus / navigation rechargent vite (ms). */
export const LIVE_SYNC_STALE_TIME_MS = 2_000;

const DETAIL_QUERY_ROOTS = new Set([
  "transfer",
  "product",
  "goods-receipt",
  "internal-issue",
  "inventory-session",
  "sale",
  "supplier",
  "user",
  "store",
  "expense",
]);

/** Fiches détail / édition : pas de polling (évite d’écraser un brouillon en cours). */
export function isDetailQueryKey(queryKey: readonly unknown[]): boolean {
  if (queryKey.length < 2) {
    return false;
  }
  const root = queryKey[0];
  return typeof root === "string" && DETAIL_QUERY_ROOTS.has(root);
}

export function resolveLiveRefetchInterval(queryKey: readonly unknown[]): number | false {
  if (isDetailQueryKey(queryKey)) {
    return false;
  }
  if (liveSyncSocketConnected) {
    return LIVE_SYNC_FALLBACK_INTERVAL_MS;
  }
  return LIVE_SYNC_INTERVAL_MS;
}

export function resolvePosRefetchInterval(): number {
  if (liveSyncSocketConnected) {
    return LIVE_SYNC_FALLBACK_INTERVAL_MS;
  }
  return LIVE_SYNC_POS_INTERVAL_MS;
}