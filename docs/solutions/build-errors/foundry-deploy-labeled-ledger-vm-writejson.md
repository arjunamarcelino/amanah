---
title: "forge script deploy: vm.writeJson ENOENT, and why to emit a labeled address ledger instead of parsing run-latest.json"
date: 2026-10-21
category: build-errors
problem_type: deploy_failure
component: contracts
severity: blocking
status: resolved
symptoms:
  - "vm.writeJson: failed to open file \".../deployments/84532.json\": No such file or directory (os error 2)"
  - "forge script ... --broadcast reverts at the vm.writeJson step after contracts already deployed"
  - "Three MockStablecoin deploys (mUSDC/mXSGD/mIDRX) are indistinguishable in broadcast/run-latest.json"
  - "Generated addresses.ts maps the wrong token to the wrong address"
tags: [foundry, forge-script, vm-writejson, fs_permissions, deploy, base-sepolia, codegen, abi, monorepo, serializeAddress]
related:
  - PR: https://github.com/arjunamarcelino/amanah/pull/5
  - learning: docs/solutions/build-errors/turbo-monorepo-ci-forge-and-eslint-flat-config.md
---

# forge script deploy: `vm.writeJson` ENOENT, and why to emit a labeled address ledger

## Problem

A `forge script Deploy.s.sol --broadcast` run to Base Sepolia deployed and wired all contracts
successfully, then **reverted at the very end**:

```
vm.writeJson: failed to open file
"/Users/.../packages/contracts/deployments/84532.json": No such file or directory (os error 2)
```

The on-chain execution had already happened — only the post-broadcast ledger write failed — so a
naive retry would redeploy fresh contracts and waste gas.

Separately, a design problem motivated writing that ledger at all: the deploy creates **three
instances of the same `MockStablecoin` contract** (mUSDC, mXSGD, mIDRX). In Foundry's
`broadcast/Deploy.s.sol/84532/run-latest.json` all three appear with identical
`contractName: "MockStablecoin"`, so a codegen step that reads addresses from that file cannot tell
which address is which token.

## Root cause

1. **`vm.writeJson` does not create parent directories.** It opens the file for writing and fails
   with a raw `ENOENT` if the directory (`deployments/`) doesn't exist. `forge script` runs the
   whole script in simulation first, but the cheatcode's file open is evaluated for real, so the
   missing directory surfaces as a script revert.
2. **Foundry file writes are gated by `fs_permissions`.** Even with the directory present,
   `vm.writeJson` reverts with a permissions error unless `foundry.toml` grants write access to the
   path.
3. **`run-latest.json` can't disambiguate N deploys of one contract.** Addresses there are keyed by
   `contractName` (collides for the three mocks) and positional order is fragile — any interleaved
   `CALL` shifts indices, and contracts created inside a call land in `additionalContracts`, not as
   top-level `CREATE` entries.

## Solution

**Emit a self-labeled ledger from the script, and make the directory + permissions exist first.**

1. Create the output directory before the first deploy (it is not auto-created):
   ```shell
   mkdir -p packages/contracts/deployments && touch packages/contracts/deployments/.gitkeep
   ```
2. Grant write permission in `foundry.toml`:
   ```toml
   fs_permissions = [{ access = "read-write", path = "./deployments" }]
   ```
3. In the script, build a labeled JSON with explicit keys (one per logical token/contract) via
   `vm.serializeAddress` + `vm.writeJson`, **after** `vm.stopBroadcast()` (it's a local FS op, not a
   broadcast tx). This sidesteps `contractName` collisions entirely because *you* assign the keys:
   ```solidity
   string memory o = "deployment";
   vm.serializeAddress(o, "mUSDC", address(mUSDC));
   vm.serializeAddress(o, "mXSGD", address(mXSGD));
   // ... one per contract; the LAST call returns the complete JSON string ...
   string memory json = vm.serializeAddress(o, "PayoutRouter", address(router));
   vm.writeJson(json, "./deployments/84532.json");   // path relative to project root
   ```
4. Codegen reads *that* labeled file (deterministic, reorder-safe) — never `run-latest.json` — plus
   `out/<C>.sol/<C>.json`'s `.abi` for ABIs. Commit the ledger (`deployments/<chainId>.json`): it is
   public addresses only and, since `broadcast/` is gitignored, the only durable on-chain record.

**Two hardening follow-ups that belong with this pattern** (the ledger is a committed, editable file
feeding a codegen step):

- **Validate every ledger value before interpolating it into generated TypeScript.** A raw
  `` `${k}: "${ledger[k]}"` `` interpolation lets a crafted/hand-edited value break out of the string
  literal and inject code that runs when a consumer imports the package. Gate on
  `/^0x[0-9a-fA-F]{40}$/` and `fail()` otherwise. A `type Address = \`0x${string}\`` is **not** a
  sufficient backstop — it only checks the prefix.
- **Add a CI drift guard.** Both the ledger and the generated TS are committed; nothing otherwise
  forces them to agree. Regenerate and diff: `node export-shared.mjs && git diff --exit-code
  packages/shared/src`. Stale-but-valid output compiles green while pointing consumers at the wrong
  contracts.

## Prevention

- Treat `vm.writeJson`/`vm.writeFile` as "file open, no mkdir": ensure the directory exists (commit a
  `.gitkeep`) and add the `fs_permissions` entry in the same change that introduces the write.
- Whenever a deploy creates **more than one instance of the same contract**, never identify them by
  `contractName` or transaction order — assign explicit labels via `vm.serializeAddress`.
- Keep the ledger write **after** `stopBroadcast`, and run read-back `require` asserts for the
  *mutable* wiring before it, so a mis-wired deploy aborts before publishing a ledger. (Don't bother
  re-asserting constructor immutables / single-owner ownership — those are guaranteed by
  construction.)
- Any committed file that is interpolated into generated source is an injection surface: validate it.
- A deploy that does structural wiring only mints nothing — note in the runbook that mock swap/
  liquidity must be funded before exercising non-base flows.

## Verification

- `pnpm deploy:contracts` deployed 10 contracts to Base Sepolia (84532), wrote
  `deployments/84532.json`, regenerated `@amanah/shared`, and built it; `apps/web` type-checks and
  153 forge tests pass.
- Re-running codegen produces byte-identical output (drift guard clean).
