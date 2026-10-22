"use client";

import { useState, type ReactNode } from "react";
import { PrivyProvider, type PrivyClientConfig } from "@privy-io/react-auth";
import { WagmiProvider } from "@privy-io/wagmi"; // NOT from 'wagmi'
import { WagmiProvider as BaseWagmiProvider } from "wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { wagmiConfig, baseSepoliaOverride } from "./wagmi";
import { ENV } from "./env";

// Nesting is fixed: PrivyProvider -> QueryClientProvider -> WagmiProvider.
// QueryClient is created once per browser session via useState (never module scope).
const privyConfig: PrivyClientConfig = {
  embeddedWallets: { ethereum: { createOnLogin: "users-without-wallets" } }, // auto-create embedded EOA
  loginMethods: ["email", "google", "twitter"],
  defaultChain: baseSepoliaOverride,
  supportedChains: [baseSepoliaOverride],
  appearance: { theme: "light" },
};

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());

  // NEXT_PUBLIC_PRIVY_APP_ID is inlined at build time. Without it (e.g. a CI build
  // with no secrets), skip Privy/Wagmi so static prerender doesn't crash — wallet
  // features activate once the app is built with a real app id. Wallet pages are
  // `force-dynamic`, so they are never prerendered in this degraded mode.
  if (!ENV.privyAppId) {
    if (typeof window !== "undefined") {
      console.error("[amanah] NEXT_PUBLIC_PRIVY_APP_ID is not set — login is disabled.");
    }
    // Keep a WagmiProvider in the tree so read hooks don't crash (no login/connector).
    return (
      <QueryClientProvider client={queryClient}>
        <BaseWagmiProvider config={wagmiConfig}>{children}</BaseWagmiProvider>
      </QueryClientProvider>
    );
  }

  return (
    <PrivyProvider appId={ENV.privyAppId} config={privyConfig}>
      <QueryClientProvider client={queryClient}>
        <WagmiProvider config={wagmiConfig}>{children}</WagmiProvider>
      </QueryClientProvider>
    </PrivyProvider>
  );
}
