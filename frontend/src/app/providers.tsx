import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { ToastProvider } from "../components/ui/Toast";
import { AuthProvider } from "../modules/auth/AuthProvider";
import { PresentationProvider } from "../modules/presentation/PresentationProvider";
import { ThemeProvider } from "../modules/theme/ThemeProvider";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
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
            <AuthProvider>{children}</AuthProvider>
          </ToastProvider>
        </PresentationProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
