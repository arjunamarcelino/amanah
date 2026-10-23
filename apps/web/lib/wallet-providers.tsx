"use client";

import type { ReactNode } from "react";
import { DynamicContextProvider } from "@dynamic-labs/sdk-react-core";
import { EthereumWalletConnectors } from "@dynamic-labs/ethereum";
import { DynamicWagmiConnector } from "@dynamic-labs/wagmi-connector";
import { WagmiProvider } from "wagmi"; // stock wagmi (no longer @privy-io/wagmi)
import { wagmiConfig, evmNetworks } from "./wagmi";
import { ENV } from "./env";

// Mounted only by the (wallet) route group's layout — keeps the wallet SDK out of the
// browse bundle. QueryClientProvider is already provided at the root, so the nesting at a
// wallet route is QueryClient(root) -> Dynamic -> Wagmi -> DynamicWagmiConnector (innermost).
// EthereumWalletConnectors covers email/social + Dynamic embedded wallets AND external EVM
// wallets (MetaMask / WalletConnect); which methods actually appear is a Dynamic Dashboard
// toggle (incl. enabling Base Sepolia / testnets + "create embedded wallet on sign up").
export function WalletProviders({ children }: { children: ReactNode }) {
  // Fail LOUD, not silent: `NEXT_PUBLIC_DYNAMIC_ENVIRONMENT_ID` is inlined at build time. If it
  // is missing we render a visible message instead of mounting DynamicContextProvider with an
  // empty id — so a misconfigured deploy shows a clear error rather than white-screening every
  // wallet route.
  if (!ENV.dynamicEnvironmentId) {
    return <WalletMisconfigured />;
  }
  return (
    <DynamicContextProvider
      theme="light"
      settings={{
        environmentId: ENV.dynamicEnvironmentId,
        // Full EVM connector set (injected/MetaMask + Coinbase + WalletConnect + embedded).
        // NOTE: WalletConnect (~300-400kB) can't be dropped via config in Dynamic v5 — the
        // package statically side-effect-imports @walletconnect/ethereum-provider with no
        // `sideEffects:false`. Trimming it needs an unsupported webpack alias hack; we keep
        // the supported full set deliberately (the weight is isolated to the (wallet) routes).
        walletConnectors: [EthereumWalletConnectors],
        overrides: { evmNetworks },
      }}
    >
      <WagmiProvider config={wagmiConfig}>
        <DynamicWagmiConnector>{children}</DynamicWagmiConnector>
      </WagmiProvider>
    </DynamicContextProvider>
  );
}

function WalletMisconfigured() {
  return (
    <div className="mx-auto mt-10 max-w-md rounded-lg border border-destructive/40 bg-card p-6 text-sm text-foreground-soft">
      Wallet features are unavailable — <code>NEXT_PUBLIC_DYNAMIC_ENVIRONMENT_ID</code> is not
      configured for this deployment.
    </div>
  );
}
