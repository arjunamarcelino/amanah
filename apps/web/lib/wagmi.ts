import { http } from "wagmi";
import { createConfig } from "@privy-io/wagmi"; // NOT from 'wagmi' — syncs the embedded connector
import { baseSepolia } from "viem/chains";
import { addRpcUrlOverrideToChain } from "@privy-io/chains";
import { ENV } from "./env";

// Override the chain's RPC so BOTH Privy's embedded wallet and wagmi's transport
// hit the same endpoint. baseSepolia.id === 84532 already.
export const baseSepoliaOverride = addRpcUrlOverrideToChain(baseSepolia, ENV.rpcUrl);

export const wagmiConfig = createConfig({
  chains: [baseSepoliaOverride],
  transports: { [baseSepoliaOverride.id]: http(ENV.rpcUrl) },
});
