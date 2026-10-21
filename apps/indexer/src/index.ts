import { config } from "./config.js";
import { WATCHED_ADDRESSES } from "./contracts.js";

// Scaffold entry — backfill (C16), event handlers (C17), and the live poll loop
// (C18) are wired on top of this.
function main(): void {
  console.log(`[indexer] chain=${config.chainId} rpc=${config.rpcUrl}`);
  console.log(
    `[indexer] watching ${WATCHED_ADDRESSES.length} contracts from block ${config.startBlock} ` +
      `(confirmations=${config.confirmations}, pollMs=${config.pollMs})`,
  );
}

main();
