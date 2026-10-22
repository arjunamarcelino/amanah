"use client";

import { useState, type ReactNode } from "react";
import { WagmiProvider } from "wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createConsoleConfig } from "./wagmi";
import { ConsoleSessionProvider } from "./session";

// Console-only provider tree: own wagmi config (injected owner wallet) + its own
// QueryClient (clean connection-state isolation from the donor/Privy tree) + the
// session seam. Config/client are created once via useState so a re-render never
// drops the wallet connection. No Privy here by design.
export function ConsoleProviders({ children }: { children: ReactNode }) {
  const [config] = useState(createConsoleConfig);
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: { queries: { refetchOnWindowFocus: false, retry: 1 } },
      }),
  );

  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <ConsoleSessionProvider>{children}</ConsoleSessionProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
