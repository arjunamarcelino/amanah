"use client";

import { useState, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// Root provider — react-query only, so the browse route never pulls the wallet SDK.
// (Dynamic + wagmi live in the (wallet) route group's layout.) QueryClient is created
// once per browser session via useState (never module scope).
export function QueryProvider({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          // Campaign/balance data changes slowly on testnet — avoid refetch churn.
          queries: { staleTime: 30_000, refetchOnWindowFocus: false },
        },
      }),
  );
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
