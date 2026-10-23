import { http, createConfig, createStorage } from "wagmi"; // stock wagmi — Dynamic injects connectors via DynamicWagmiConnector
import { baseSepolia } from "viem/chains";
import type { EvmNetwork } from "@dynamic-labs/sdk-react-core";
import { CHAIN_ID } from "@amanah/shared";
import { ENV } from "./env";

// Compile-time guard: the donor hooks key off CHAIN_ID (@amanah/shared) while this config +
// evmNetworks hardcode baseSepolia.id. If they ever diverge, useBalance would query a chain
// absent from `transports` and isBaseSepolia would be permanently false — fail the build instead.
type _Expect<T extends true> = T;
type _Equal<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;
type _ChainIdMatches = _Expect<_Equal<typeof CHAIN_ID, typeof baseSepolia.id>>;

// Donor wagmi config. No `connectors` array: DynamicWagmiConnector bridges the active
// Dynamic wallet (embedded OR external) into wagmi. `multiInjectedProviderDiscovery: false`
// is REQUIRED — Dynamic runs its own wallet discovery. baseSepolia.id === 84532 === CHAIN_ID.
export const wagmiConfig = createConfig({
  chains: [baseSepolia],
  multiInjectedProviderDiscovery: false,
  // ssr + explicit storage mirror the console config, so SSR'd wallet routes don't emit
  // hydration-mismatch warnings. Uses the default "wagmi" key the console deliberately avoids.
  ssr: true,
  storage: createStorage({
    key: "wagmi",
    storage: typeof window !== "undefined" ? window.localStorage : undefined,
  }),
  transports: { [baseSepolia.id]: http(ENV.rpcUrl) },
});

// Dynamic-side network config — pins the app to Base Sepolia with the SAME RPC as wagmi, so
// reads and broadcasts share one endpoint. Passed to DynamicContextProvider's
// `settings.overrides.evmNetworks` (array form replaces the dashboard's network list).
// networkId MUST equal chainId for EVM; nativeCurrency.decimals MUST be 18.
export const evmNetworks = [
  {
    blockExplorerUrls: ["https://sepolia.basescan.org/"],
    chainId: baseSepolia.id,
    networkId: baseSepolia.id,
    name: "Base Sepolia",
    iconUrls: ["https://app.dynamic.xyz/assets/networks/base.svg"],
    nativeCurrency: { name: "Sepolia Ether", symbol: "ETH", decimals: 18 },
    rpcUrls: [ENV.rpcUrl],
  },
] satisfies EvmNetwork[]; // excess-property + required-field check (networkId===chainId, decimals 18)
