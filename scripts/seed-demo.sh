#!/usr/bin/env bash
# Demo seeder — runs INSIDE the one-shot `seed` compose service against the live stack.
#   pnpm seed:demo        → docker compose run --rm seed → this script
#
# Two phases:
#   1. ON-CHAIN (external Base Sepolia RPC): forge script DemoSeed registers both demo
#      campaigns, makes one real donation to the flagship, and invests idle principal.
#      Idempotent + preflight-guarded; leaves the PARAMETRIC campaign ARMED (not fired).
#   2. OFFCHAIN (internal compose network): prisma db seed upserts campaign metadata +
#      the PH/ID rail catalog so the UI/agent can resolve them.
#
# Security: never `set -x`; never echo DEPLOYER_PRIVATE_KEY. The forge script reads the
# key from the environment (vm.envUint), NOT an argv --private-key flag, so it never
# appears in `docker top`/`/proc`. Only balances + tx hashes are logged.
set -euo pipefail

: "${BASE_SEPOLIA_RPC_URL:?BASE_SEPOLIA_RPC_URL is required}"
: "${DEPLOYER_PRIVATE_KEY:?DEPLOYER_PRIVATE_KEY is required}"
: "${DATABASE_URL:?DATABASE_URL is required}"

echo "==> [1/2] On-chain seed (forge script DemoSeed) — Base Sepolia"
(
  cd packages/contracts
  # --broadcast sends the txs; the script reads DEPLOYER_PRIVATE_KEY from env itself.
  forge script script/DemoSeed.s.sol:DemoSeed \
    --rpc-url "$BASE_SEPOLIA_RPC_URL" \
    --broadcast
)

echo "==> [2/2] Offchain seed (prisma db seed) — campaign metadata + rail catalog"
pnpm --filter @amanah/db db:seed

echo "==> seed:demo complete. PARAMETRIC flagship is ARMED — fire it live from the console."
