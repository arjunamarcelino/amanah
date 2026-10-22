"use client";

import type { ReactNode } from "react";
import { PrivyProvider, type PrivyClientConfig } from "@privy-io/react-auth";
import { WagmiProvider } from "@privy-io/wagmi"; // NOT from 'wagmi'
import { wagmiConfig, baseSepoliaOverride } from "./wagmi";
import { ENV } from "./env";

// Mounted only by the (wallet) route group's layout — keeps the wallet SDK out of
// the browse bundle. QueryClientProvider is already provided at the root, so the
// nesting at a wallet route is QueryClient -> Privy -> Wagmi (Wagmi innermost).
const privyConfig: PrivyClientConfig = {
  embeddedWallets: { ethereum: { createOnLogin: "users-without-wallets" } },
  loginMethods: ["email", "google", "twitter"],
  defaultChain: baseSepoliaOverride,
  supportedChains: [baseSepoliaOverride],
  appearance: { theme: "light" },
};

export function WalletProviders({ children }: { children: ReactNode }) {
  // Fail LOUD, not silent: `NEXT_PUBLIC_PRIVY_APP_ID` is inlined at build time. If it
  // is missing we render a visible message instead of mounting PrivyProvider with an
  // empty id (which throws) — so a misconfigured deploy shows a clear error rather
  // than white-screening every wallet route.
  if (!ENV.privyAppId) {
    return <WalletMisconfigured />;
  }
  return (
    <PrivyProvider appId={ENV.privyAppId} config={privyConfig}>
      <WagmiProvider config={wagmiConfig}>{children}</WagmiProvider>
    </PrivyProvider>
  );
}

function WalletMisconfigured() {
  return (
    <div className="mx-auto mt-10 max-w-md rounded-lg border border-destructive/40 bg-card p-6 text-sm text-foreground-soft">
      Wallet features are unavailable — <code>NEXT_PUBLIC_PRIVY_APP_ID</code> is not
      configured for this deployment.
    </div>
  );
}
