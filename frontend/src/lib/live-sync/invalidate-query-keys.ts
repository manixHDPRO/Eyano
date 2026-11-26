import type { QueryClient } from "@tanstack/react-query";

/** Alias connus entre racines émises par l’API et clés React Query. */
const ROOT_ALIASES: Record<string, string[]> = {
  "exchange-rates": ["exchange-rates-current"],
  notifications: ["notification-unread"],
};

function queryKeyMatchesRoot(queryKey: readonly unknown[], root: string): boolean {
  const head = queryKey[0];
  if (head === root) {
    return true;
  }
  const aliases = ROOT_ALIASES[root];
  if (aliases?.includes(String(head))) {
    return true;
  }
  if (root === "exchange-rates" && head === "exchange-rates") {
    return true;
  }
  return false;
}

export function applyLiveSyncInvalidation(queryClient: QueryClient, keys: string[]): void {
  const unique = [...new Set(keys)];
  for (const root of unique) {
    void queryClient.invalidateQueries({
      predicate: (query) => queryKeyMatchesRoot(query.queryKey, root),
    });
  }
}