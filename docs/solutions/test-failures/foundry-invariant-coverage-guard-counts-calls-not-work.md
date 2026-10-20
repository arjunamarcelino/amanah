---
title: "Foundry invariant coverage guard false-passes: counting handler calls isn't counting work"
date: 2026-10-20
category: test-failures
problem_type: test_quality
component: contracts
severity: silent
status: resolved
symptoms:
  - "afterInvariant / call-summary shows every handler selector called ~tens of thousands of times and the suite is green, yet a whole state class (deployed yield, Halal mode) may never have been reached"
  - "A coverage guard asserts calls[selector] > 0, but the action early-returns (same-mode setMode, empty-adapter accrue, idle<=target investIdle) so the counter rises without the action doing anything"
  - "Invariants that only have teeth post-transition (invariant_inactiveAdapterEmpty, invariant_valueConservation) aren't guaranteed to have been exercised in that state"
tags: [foundry, invariant-testing, fuzzing, handler, coverage, afterInvariant, erc4626, test-quality, solidity, false-positive]
related:
  - prior-lesson: docs/solutions/test-failures/foundry-invariant-false-pass-handler-blind-spot.md
  - PR: https://github.com/arjunamarcelino/amanah/pull/3
  - review-doc: docs/reviews/2026-10-20-pr3-yield-adapters-review.md (local-only, finding P2-1)
  - fix-commit: 11ad12d
---

# Foundry invariant coverage guard false-passes: counting calls isn't counting work

This is the **second-order** version of
[the handler-blind-spot lesson](./foundry-invariant-false-pass-handler-blind-spot.md). That one said
"the handler must expose the falsifying action." This one says "once you add a coverage guard to prove
the action runs, the *guard itself* can false-pass."

## Problem

PR #3 added a yield layer to `CharityPool` and extended the invariant handler with `investIdle`,
`setMode`, and `accrue`. Having been burned once (PR #2), the suite added an `afterInvariant` coverage
guard specifically to prove those actions were exercised:

```solidity
// test/invariant/CharityPool.invariant.t.sol (first attempt)
function afterInvariant() public view {
    assertGt(handler.calls(CharityHandler.investIdle.selector), 0, "investIdle never called");
    assertGt(handler.calls(CharityHandler.setMode.selector), 0, "setMode never called");
    assertGt(handler.calls(CharityHandler.accrue.selector), 0, "accrue never called");
}
```

A code review flagged that `calls[selector] > 0` proves the fuzzer *invoked* the selector — **not** that
the call did anything. Every one of these handler actions legitimately **early-returns** on an unmet
precondition (it has to, so `fail_on_revert = true` stays valid):

- `investIdle` no-ops when `idle <= target` (nothing to deploy),
- `setMode(seed % 2)` no-ops when the requested mode equals the current mode,
- `accrue` mints 0 on an empty adapter (and early-returns before touching it).

So a run could show `accrue` called 21,000 times and still **never once** have accrued against a funded
adapter; `setMode` called 21,000 times and **never once** have actually flipped. The invariants that
only have teeth *after* a real flip / real deployment — `invariant_inactiveAdapterEmpty` and the exact
`invariant_valueConservation` — were therefore not *guaranteed* to be tested in the state they exist to
protect. Green, 128k calls, 0 reverts — and potentially vacuous on the yield axis.

## Root cause

**An early-returning handler action increments the call counter while doing no work.** Call counts
measure *reachability of the selector*, not *reachability of the state the invariant cares about*. The
first blind-spot lesson pushed everyone to add bounded, early-returning handler actions (good — it keeps
`fail_on_revert` honest). But that same early-return is exactly what makes a call-count coverage guard
hollow: the guard and the no-op are satisfied by the same incremented counter.

## Solution (commit `11ad12d`, with `964958d`)

Ghost-track **effective work**, not calls, and assert the effective-work ghosts in `afterInvariant`.

### 1. Increment a ghost only when the action actually changes state

```solidity
// CharityHandler.sol
function investIdle() external countCall {
    uint256 before = _activeDeployed();
    pool.investIdle();
    if (_activeDeployed() > before) ghost_meaningfulInvests++;   // deployed base, not a no-op
}

function setMode(uint256 seed) external countCall {
    bool before = pool.halalMode();
    pool.setMode(seed % 2 == 1);
    if (pool.halalMode() != before) ghost_modeFlips++;           // actually flipped
}

function accrue(uint256 seed) external countCall {
    uint16 bps = uint16(bound(seed, 1, MAX_BPS));
    uint256 before = pool.poolValue();
    if (pool.halalMode()) { if (halalVault.totalAssets() == 0) return; halalVault.accrue(bps); }
    else                  { if (standardVault.totalAssets() == 0) return; standardVault.accrue(bps); }
    ghost_yieldMinted += pool.poolValue() - before;              // measured yield, absorbs rounding
}
```

### 2. Assert the effective-work ghosts, not just the call counts

```solidity
function afterInvariant() public view {
    assertGt(handler.calls(CharityHandler.investIdle.selector), 0, "investIdle never called");
    assertGt(handler.calls(CharityHandler.setMode.selector), 0, "setMode never called");
    assertGt(handler.calls(CharityHandler.accrue.selector), 0, "accrue never called");
    assertGt(handler.ghost_meaningfulInvests(), 0, "no invest ever deployed base (all no-ops)");
    assertGt(handler.ghost_modeFlips(), 0, "mode never actually flipped (all same-mode no-ops)");
    assertGt(handler.ghost_yieldMinted(), 0, "no effective yield ever produced");
}
```

### 3. Make the states reachable in the first place

Effectiveness ghosts only pass if the handler can actually reach the states: donations seed idle base
(so `investIdle` has a surplus to deploy), which gives `accrue` a funded adapter to grow. Accrue only
ever the **active** adapter (so the measured `poolValue` delta is exactly its mint, and the inactive
adapter stays empty — the property `invariant_inactiveAdapterEmpty` depends on). `setMode` flips both
ways across the run, so the post-flip invariants get exercised in-state. Adding `setBufferBps` to the
fuzz set (commit `964958d`) likewise moves the invest threshold across its full range instead of
testing only the 20% default.

## Verification

```bash
forge test --mp 'test/invariant/*'
# CharityPoolInvariantTest invariants (runs: 256, calls: 128000, reverts: 0)
# all 9 invariants PASS, including inactiveAdapterEmpty + valueConservation
```

`afterInvariant` now fails the entire suite if `ghost_meaningfulInvests`, `ghost_modeFlips`, or
`ghost_yieldMinted` is still zero — i.e. if the fuzzer called the selectors but never reached the
deployed / flipped / accrued state. The yield invariants are now provably exercised in the states they
protect, not merely declared.

## Prevention

- **A coverage guard must assert effective work, not call count.** `calls[selector] > 0` only proves the
  selector was invoked; an early-returning action satisfies it while doing nothing.
- **For every invariant whose teeth depend on a specific state, add a ghost that proves that state was
  reached at least once** (deployed funds, a real mode flip, non-zero accrued yield), and assert it in
  `afterInvariant`.
- **Measure the effect into the ghost** (balance/`poolValue` delta, a state flip), rather than
  recomputing an expected value — the measured delta also absorbs rounding (e.g. 6-decimal `accrue`
  truncation) so the ghost stays exact.
- **Keep bounded early-returns for `fail_on_revert = true`** — but pair every early-return-prone action
  with an effectiveness ghost, because the early-return is precisely what makes a call-count guard lie.
- **Order/bias the handler so preconditions are satisfiable**: if action C needs the state left by B
  which needs A, a purely uniform selector draw can still reach it over 128k calls, but a ghost assert
  turns "probably reached" into "provably reached, or the suite fails."
- **Treat `show_metrics` call counts as necessary-but-not-sufficient** — the per-selector table tells you
  a selector fired and didn't all-revert; it does not tell you the call mutated the invariant's state.

## Related

- Prior lesson (first-order): [handler missing the falsifying action + wrong assertion](./foundry-invariant-false-pass-handler-blind-spot.md)
- PR [#3](https://github.com/arjunamarcelino/amanah/pull/3) — yield adapters + invest + halal mode
- Found during the PR #3 multi-agent review (finding P2-1, architecture + data-integrity reviewers); fixed in commit `11ad12d`, buffer-fuzz follow-up `964958d`.
- **Third-order follow-up:** [forcing a state to satisfy an effectiveness ghost can dilute another invariant's coverage](./foundry-invariant-forced-reachability-dilutes-coverage.md). The very buffer-fuzz coverage added here in `964958d` was later silently diluted when PR #4 forced `setBufferBps(0)` to reach the divest-during-release state without restoring it.
