import { createConfig, http, createStorage } from "wagmi";
import { injected } from "wagmi/connectors";
import { baseSepolia } from "viem/chains";
import { ENV } from "../env";

// Operator-console wallet config: PLAIN wagmi + injected() (the browser wallet holding the
// owner key). Deliberately imports viem's baseSepolia + wagmi directly and NEVER lib/wagmi.ts
// (which pulls the Dynamic wallet SDK) — keeps that SDK out of the console bundle.
//
// - `injected()` (NOT target:"metaMask") → one deterministic connector bound to the default
//   `window.ethereum`, so ANY injected wallet works. Targeting "metaMask" threw
//   ProviderNotFoundError whenever the injected provider wasn't matched as MetaMask (another
//   wallet owning window.ethereum, or MetaMask exposed only via EIP-6963 with discovery off).
// - multiInjectedProviderDiscovery:false keeps it to that single connector (no EIP-6963 dupes).
// - distinct storage `key` so it never clobbers the donor config's "wagmi" key.
// - `batch: { multicall: true }` collapses the console's ~9 per-refresh reads into one
//   eth_call (viem's baseSepolia carries Multicall3) — keeps the public RPC under its
//   rate limit when the yield ticker polls.
export function createConsoleConfig() {
  return createConfig({
    chains: [baseSepolia],
    connectors: [injected()],
    multiInjectedProviderDiscovery: false,
    ssr: true,
    storage: createStorage({
      key: "wagmi.console",
      storage: typeof window !== "undefined" ? window.localStorage : undefined,
    }),
    batch: { multicall: true },
    transports: {
      [baseSepolia.id]: http(ENV.rpcUrl, { batch: true }),
    },
  });
}
