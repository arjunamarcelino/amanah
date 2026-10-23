"use client";

import { useState, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// Root provider — react-query only, so the browse/ledger routes never pull the wallet SDK.
// (Dynamic + wagmi are mounted by the wallet routes themselves — the /mint and /donate pages
// and the (auth) login layout.) QueryClient is created once per browser session via useState
// (never module scope).
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
