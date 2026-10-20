---
title: "Foundry invariant: forcing a state to satisfy an effectiveness ghost can silently dilute another invariant's coverage"
date: 2026-10-21
category: test-failures
problem_type: test_quality
component: contracts
severity: silent
status: resolved
symptoms:
  - "afterInvariant fails 'divest-during-release branch never exercised: 0 <= 0' — a new effectiveness ghost is 0 because the fuzzer rarely reaches the state the ghost proves"
  - "After forcing that state inside a handler action, afterInvariant then fails on a DIFFERENT, earlier assertion ('investIdle never called: 0 <= 0') with runs:1 / calls:1 and a ~10ms run"
  - "The 1-call 'failure' is actually a stale replay — the log says 'Warning: Replayed invariant failure from persisted file'"
  - "Suite is green but a previously-guaranteed coverage axis (buffer fuzzed 0%..100%) is quietly pinned to one value by the forcing code, with no assertion to catch it"
tags: [foundry, invariant-testing, fuzzing, handler, coverage, afterInvariant, forge-clean, test-quality, solidity, false-positive]
related:
  - prior-lesson: docs/solutions/test-failures/foundry-invariant-false-pass-handler-blind-spot.md
  - prior-lesson: docs/solutions/test-failures/foundry-invariant-coverage-guard-counts-calls-not-work.md
  - PR: https://github.com/arjunamarcelino/amanah/pull/4
  - fix-commits: e69efa7 (reachability force), 4ac27cf (save/restore)
---

# Foundry invariant: forcing a state to satisfy an effectiveness ghost can silently dilute another invariant's coverage

This is the **third-order** entry in the invariant-coverage series:

1. [handler must expose the falsifying action](./foundry-invariant-false-pass-handler-blind-spot.md) — add the action + assert the TRUE invariant (`>=`, not `==`).
2. [a coverage guard must assert effective work, not call count](./foundry-invariant-coverage-guard-counts-calls-not-work.md) — early-returning actions increment the counter while doing nothing, so assert ghost deltas.
3. **(this) once you force the state so the effective-work ghost is non-zero, the *forcing itself* can mutate shared fuzz parameters and silently dilute a *different* invariant's coverage.** Plus a tooling trap: Foundry **persists and replays** the last invariant failure, so a stale replay masquerades as a new regression until `forge clean`.

## Problem

PR #4 added a `release` action to `CharityPool`'s invariant handler and an `afterInvariant` guard:

```solidity
assertGt(handler.ghost_releasedSum(), 0, "no effective release ever occurred");
assertGt(handler.ghost_releasesFromDeployed(), 0, "divest-during-release branch never exercised");
```

`ghost_releasesFromDeployed` counts releases that actually pulled from a **deployed** adapter — the slice's novel `_divest`-during-release code. A fresh run passed all 9 invariants but **failed `afterInvariant`** with `ghost_releasesFromDeployed == 0`: the uniform fuzzer almost never hit a release whose amount exceeded idle *while the active adapter held funds* (the natural precondition `available > idle` rarely held once funds were deployed). The branch the invariant exists to protect was effectively never exercised.

## Root cause (two distinct traps)

### Trap A — forcing the state pinned a shared fuzz parameter

To make the divest branch reachable, the `release` action forced it: when idle alone could cover the payout, deploy the surplus first so the release *must* divest.

```solidity
// CharityHandler.release() — FIRST attempt (coverage-diluting)
uint256 idle = usdc.balanceOf(address(pool));
if (idle >= available) {
    pool.setBufferBps(0);   // deploy everything...
    pool.investIdle();      // ...so idle drops below `available` and the release divests
    idle = usdc.balanceOf(address(pool));
}
```

This works for the divest ghost — but `setBufferBps(0)` is **never restored**. `release` fires ~16k times per run, so the liquidity buffer spends most of the campaign pinned at 0 until the separate `setBufferBps` fuzz action happens to raise it again. That silently undermines a *previously guaranteed* coverage axis — commit `964958d` added buffer fuzzing specifically so the invest/divest math is exercised across 0%..100%. Nothing failed, because `afterInvariant` has **no buffer-range ghost** — the dilution was invisible. This is the second-order lesson turned on itself: the fix for one coverage gap opened another, and only an assertion would have caught it (there wasn't one).

### Trap B — a persisted failure replayed as a phantom regression

After adding the forcing code, the next run failed with:

```
[FAIL: investIdle never called: 0 <= 0]  (runs: 1, calls: 1, reverts: 0)   // finished in ~10ms
  sender=... calldata=setBufferBps(uint256) args=[6653]
Warning: Replayed invariant failure from persisted file.
Run `forge clean` or remove file to ignore failure ...
```

This is **not** a new regression. Foundry persisted the *previous* run's shrunk counterexample (a 1-call `setBufferBps` sequence) under `cache/invariant/` and **replayed only that** against the *new* `afterInvariant` assertions — so it tripped on the first assertion (`investIdle never called`) because a 1-call replay obviously never calls `investIdle`. The giveaways: `runs: 1, calls: 1`, a sub-second runtime (a real campaign is 128k calls / ~90s), and the explicit `Replayed invariant failure from persisted file` warning. Misreading it as a real failure cost a diagnostic cycle.

## Solution

### A. Assert effective work WITHOUT permanently mutating shared fuzz state — save/restore

```solidity
// CharityHandler.release() — FIXED (commit 4ac27cf)
uint256 idle = usdc.balanceOf(address(pool));
if (idle >= available) {
    uint16 savedBuffer = pool.minLiquidityBufferBps();
    pool.setBufferBps(0);
    pool.investIdle();
    pool.setBufferBps(savedBuffer);   // <-- restore so buffer-range coverage isn't pinned
    idle = usdc.balanceOf(address(pool));
}
```

`investIdle` has already deployed the surplus (idle ≈ 0), so restoring the buffer afterward does not re-divest — it only returns the shared parameter to whatever the fuzzer last set, keeping `964958d`'s full-range coverage intact. The release then divests from the adapter and `ghost_releasesFromDeployed` increments. Both coverage axes are preserved.

### B. Clear the persisted corpus after changing invariants/assertions

```bash
forge clean                       # or: rm -rf cache/fuzz cache/invariant
forge test --mp 'test/invariant/*'
# CharityPoolInvariantTest invariants (runs: 256, calls: 128000, reverts: 0)
```

A fresh campaign (not a 1-call replay) is the only valid signal after you edit handler actions or `afterInvariant`. The stale replay is scoped to the *old* shrunk sequence and cannot exercise new code paths.

## Verification

```bash
forge clean && forge test --mp 'test/invariant/*'
# runs: 256, calls: 128000, reverts: 0 — all invariants + afterInvariant pass
# release selector ~15.9k calls; ghost_releasedSum > 0 AND ghost_releasesFromDeployed > 0
```

With the save/restore in place the divest-during-release branch is provably exercised **and** the buffer still ranges across its full domain; with `forge clean` the run is a real 128k-call campaign, not a replay.

## Prevention

- **A handler action that forces a precondition must leave shared fuzz state as it found it.** Save/restore any global knob (buffer, mode, delay) you mutate to set up a scenario — otherwise you bias every subsequent action and silently shrink another invariant's domain.
- **Every coverage axis you care about needs its own effectiveness ghost.** The buffer-range dilution was invisible precisely because nothing asserted it. If a parameter's full range matters, assert it was actually visited (e.g. ghost-track min/max buffer seen), so a future "harmless" forcing can't quietly pin it.
- **Prefer biasing *inputs* over mutating *shared config*.** Reaching a state by choosing the action's own arguments (e.g. a release amount in `(idle, available]`) is self-contained; flipping a contract-wide setting is not.
- **After editing any invariant handler or `afterInvariant`, `forge clean` before trusting a pass/fail.** Treat `runs: 1 / calls: 1`, a sub-second invariant run, or the `Replayed invariant failure from persisted file` warning as "stale replay," not "new bug." The persisted counterexample lives in `cache/invariant/` and is evaluated against your *new* assertions.
- A green run after an assertion change is only meaningful if it was a **full fresh campaign** — check the `runs/calls` line.

## Related

- First-order: [handler missing the falsifying action](./foundry-invariant-false-pass-handler-blind-spot.md)
- Second-order: [coverage guard counts calls, not work](./foundry-invariant-coverage-guard-counts-calls-not-work.md)
- PR [#4](https://github.com/arjunamarcelino/amanah/pull/4) — trigger + staged payout + router; found during its multi-agent review (data-integrity reviewer, the "forced setBufferBps(0) dilutes 964958d coverage" finding P2-2). Fix commits `e69efa7` (reachability force) and `4ac27cf` (save/restore).
