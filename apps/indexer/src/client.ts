import { createPublicClient, http } from "viem";
import { baseSepolia } from "viem/chains";
import { config } from "./config.js";

// http transport has built-in retry; the backfill loop adds range-halving on top
// (a result-cap is a semantic error the transport won't resolve).
export const publicClient = createPublicClient({
  chain: baseSepolia,
  transport: http(config.rpcUrl),
});
