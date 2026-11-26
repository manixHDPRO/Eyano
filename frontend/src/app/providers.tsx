import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { ToastProvider } from "../components/ui/Toast";
import { LiveSyncProvider } from "../lib/live-sync/LiveSyncProvider";
import { LIVE_SYNC_STALE_TIME_MS, resolveLiveRefetchInterval } from "../lib/query/live-sync";
import { AuthProvider } from "../modules/auth/AuthProvider";
import { PresentationProvider } from "../modules/presentation/PresentationProvider";
import { ThemeProvider } from "../modules/theme/ThemeProvider";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: LIVE_SYNC_STALE_TIME_MS,
      refetchOnWindowFocus: true,
      refetchOnReconnect: true,
      refetchIntervalInBackground: false,
      refetchInterval: (query) => resolveLiveRefetchInterval(query.queryKey),
    },
  },
});

type AppProvidersProps = {
  children: ReactNode;
};

export function AppProviders({ children }: AppProvidersProps) {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <PresentationProvider>
          <ToastProvider>
            <AuthProvider>
              <LiveSyncProvider>{children}</LiveSyncProvider>
            </AuthProvider>
          </ToastProvider>
        </PresentationProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
