import { http, createConfig } from "wagmi"; // stock wagmi — Dynamic injects connectors via DynamicWagmiConnector
import { baseSepolia } from "viem/chains";
import type { EvmNetwork } from "@dynamic-labs/sdk-react-core";
import { ENV } from "./env";

// Donor wagmi config. No `connectors` array: DynamicWagmiConnector bridges the active
// Dynamic wallet (embedded OR external) into wagmi. `multiInjectedProviderDiscovery: false`
// is REQUIRED — Dynamic runs its own wallet discovery. baseSepolia.id === 84532 === CHAIN_ID.
export const wagmiConfig = createConfig({
  chains: [baseSepolia],
  multiInjectedProviderDiscovery: false,
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
